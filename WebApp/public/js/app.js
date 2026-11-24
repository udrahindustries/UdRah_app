/**
 * AirRoute Tactical Cyberpunk Platform Controller.
 * Handles:
 * - View Switching (Map Radar vs Full Admin Command Console)
 * - Map-First AQI Visualization With Model 3 Stage 2 XGBoost Residual Surface
 * - Official CAAQMS Stations & Interactive Point Inference
 * - Product Discovery Map With Strict Location Masking (~600m)
 * - Private Hardware Fleet Dashboard, Waveform Charts, And WebSockets
 * - Full Admin Console (Fleet Management, Ingestion Logs, User RBAC, Model 3 Diagnostics)
 */

// Application Global State
const state = {
  currentView: 'map', // 'map' or 'admin'
  adminTab: 'admin-tab-overview',
  user: null,
  token: localStorage.getItem('airroute_jwt') || null,
  map: null,
  layers: {
    aqiSurface: null,
    stations: null,
    discovery: null,
  },
  toggles: {
    aqiSurface: true,
    stations: true,
    discovery: true,
  },
  myDevices: [],
  selectedDeviceId: null,
  ws: null,
  telemetryChart: null,
};

// Tactical CPCB Color Palette
function GetCpcbColor(aqi) {
  if (aqi === null || aqi === undefined || isNaN(aqi)) return '#4c5d78';
  if (aqi <= 50) return '#00ff9d'; // Good (Matrix Neon Green)
  if (aqi <= 100) return '#84cc16'; // Satisfactory
  if (aqi <= 200) return '#ffb800'; // Moderate (Amber)
  if (aqi <= 300) return '#ff7700'; // Poor (Orange)
  if (aqi <= 400) return '#ff0055'; // Very Poor (Neon Crimson)
  return '#7f0028'; // Severe (Deep Maroon)
}

function GetCpcbCategory(aqi) {
  if (aqi === null || aqi === undefined || isNaN(aqi)) return 'UNKNOWN';
  if (aqi <= 50) return 'GOOD';
  if (aqi <= 100) return 'SATISFACTORY';
  if (aqi <= 200) return 'MODERATE';
  if (aqi <= 300) return 'POOR';
  if (aqi <= 400) return 'VERY POOR';
  return 'SEVERE';
}

// 1. Initialize Map Canvas With Free, Watermark-Free Esri Dark Canvas
function InitMap() {
  state.map = L.map('map', {
    center: [28.6139, 77.2090],
    zoom: 11,
    zoomControl: false,
  });

  L.control.zoom({ position: 'topleft' }).addTo(state.map);

  // Free Watermark-Free Dark Canvas Tiles With Cyberpunk CSS Filter
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri &copy; OpenStreetMap',
    maxZoom: 16,
    className: 'cyber-tiles',
  }).addTo(state.map);

  // Tactical Layer Groups
  state.layers.aqiSurface = L.layerGroup().addTo(state.map);
  state.layers.stations = L.layerGroup().addTo(state.map);
  state.layers.discovery = L.layerGroup().addTo(state.map);

  // Map Click Listener For Model 3 Spatial AQI Point Estimation
  state.map.on('click', async (e) => {
    const { lat, lng } = e.latlng;
    await QueryPointAqi(lat, lng);
  });
}

// 2. Phase 1: Load Model 3 Continuous 2D Spatial AQI Surface Grid
async function LoadAqiSurface() {
  try {
    const res = await fetch('/api/aqi/surface?lat_step=0.015&lon_step=0.015&stage2=true');
    const geojson = await res.json();

    state.layers.aqiSurface.clearLayers();

    if (geojson && geojson.features) {
      geojson.features.forEach((feature) => {
        const [lon, lat] = feature.geometry.coordinates;
        const aqi = feature.properties.aqi;
        const color = GetCpcbColor(aqi);

        // Tactical Rectangular Cell Grid
        const delta = 0.0075;
        const bounds = [
          [lat - delta, lon - delta],
          [lat + delta, lon + delta],
        ];

        const cell = L.rectangle(bounds, {
          color: 'rgba(0, 240, 255, 0.15)',
          weight: 0.5,
          fillColor: color,
          fillOpacity: 0.45,
        });

        cell.bindTooltip(`
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem;">
            <strong style="color: ${color};">AQI ${aqi}</strong> [${feature.properties.category}]<br>
            <span style="color: #8b9bb4;">MODEL: ${feature.properties.model_stage}</span><br>
            <span style="color: #00f0ff;">CONFIDENCE: ${feature.properties.confidence}</span>
          </div>
        `, { sticky: true });

        cell.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev);
          DisplayPointInspection({
            latitude: lat,
            longitude: lon,
            estimated_aqi: aqi,
            aqi_category: feature.properties.category,
            confidence_score: feature.properties.confidence,
            stage1_idw_aqi: feature.properties.stage1_idw,
            residual_correction: feature.properties.residual,
            nearest_distance_km: 1.8,
            dominant_pollutant: 'PM2.5',
            model_architecture_stage: feature.properties.model_stage,
          });
        });

        state.layers.aqiSurface.addLayer(cell);
      });
    }
  } catch (err) {
    console.warn('[Map] Could not load AQI surface:', err);
  }
}

// 3. Phase 1: Load Fixed CAAQMS Monitoring Stations
async function LoadStations() {
  try {
    const res = await fetch('/api/aqi/stations');
    const data = await res.json();

    state.layers.stations.clearLayers();

    if (data && data.stations) {
      data.stations.forEach((st) => {
        const color = GetCpcbColor(st.aqi);
        const iconHtml = `<div class="station-pin" style="background-color: ${color}; width: 28px; height: 28px;">${st.aqi || '--'}</div>`;
        const icon = L.divIcon({
          className: 'custom-station-icon',
          html: iconHtml,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([st.latitude, st.longitude], { icon });
        marker.bindPopup(`
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; background: #070c16; color: #fff; padding: 4px;">
            <strong style="color: #00f0ff;">${st.station_name}</strong><br>
            <div style="margin: 6px 0; padding: 3px 6px; background: ${color}; color: #000; font-weight: 800; display: inline-block;">
              AQI ${st.aqi} // ${GetCpcbCategory(st.aqi)}
            </div><br>
            <span>PM2.5: ${st.pm2_5 || 'N/A'} µg/m³</span><br>
            <span>PM10:  ${st.pm10 || 'N/A'} µg/m³</span><br>
            <small style="color: #8b9bb4;">PHYSICAL CAAQMS TELEMETRY</small>
          </div>
        `);

        state.layers.stations.addLayer(marker);
      });
    }
  } catch (err) {
    console.warn('[Map] Could not load physical stations:', err);
  }
}

// 4. Phase 2: Nearby Product Discovery Map With Privacy Safeguards
async function LoadDiscoveryDevices() {
  try {
    const res = await fetch('/api/discovery/nearby?lat=28.6139&lon=77.2090&radius_km=35');
    const data = await res.json();

    state.layers.discovery.clearLayers();

    if (data && data.devices) {
      data.devices.forEach((dev) => {
        const iconHtml = `
          <div class="device-pin">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
            </svg>
          </div>
        `;

        const icon = L.divIcon({
          className: 'custom-dev-icon',
          html: iconHtml,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        // 650m Privacy Ring Indicator
        if (dev.is_approximate_location) {
          const privacyRing = L.circle([dev.approx_latitude, dev.approx_longitude], {
            radius: 650,
            color: '#00ff9d',
            weight: 1,
            dashArray: '3, 4',
            fillColor: '#00ff9d',
            fillOpacity: 0.06,
          });
          state.layers.discovery.addLayer(privacyRing);
        }

        const marker = L.marker([dev.approx_latitude, dev.approx_longitude], { icon });

        // Zero Telemetry Exposed - Public Metadata Only Per Product Specification
        marker.bindPopup(`
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; background: #070c16; color: #fff; padding: 4px;">
            <strong style="color: #00ff9d;">AIRROUTE HARDWARE DISCOVERY</strong><br>
            <strong>${dev.name}</strong><br>
            <span style="color: #8b9bb4;">TYPE: ${dev.model_type}</span><br>
            <span style="color: #00f0ff;">STATUS: ${dev.status.toUpperCase()}</span><br>
            <div style="margin-top: 6px; padding: 4px; background: rgba(0, 255, 157, 0.1); border-left: 2px solid #00ff9d; font-size: 0.68rem; color: #00ff9d;">
              🔒 APPROXIMATE LOCATION (${dev.distance_km} KM AWAY)
            </div>
          </div>
        `);

        state.layers.discovery.addLayer(marker);
      });
    }
  } catch (err) {
    console.warn('[Discovery] Could not load nearby devices:', err);
  }
}

// 5. Query Point AQI Using Model 3 (Stage 2 XGBoost Residual)
async function QueryPointAqi(lat, lon) {
  try {
    const res = await fetch('/api/aqi/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: lat, longitude: lon, use_stage_two: true }),
    });

    if (res.ok) {
      const data = await res.json();
      DisplayPointInspection(data);
    }
  } catch (err) {
    console.error('[AQI Query] Error estimating point:', err);
  }
}

function DisplayPointInspection(data) {
  const card = document.getElementById('point-inspector');
  const color = GetCpcbColor(data.estimated_aqi);

  document.getElementById('point-aqi-value').textContent = data.estimated_aqi || '--';
  document.getElementById('point-aqi-value').style.color = color;

  const catBadge = document.getElementById('point-category');
  catBadge.textContent = data.aqi_category || 'UNKNOWN';
  catBadge.style.backgroundColor = color;
  catBadge.style.color = '#03060c';

  document.getElementById('point-stage').textContent = data.model_architecture_stage.split('—')[0].trim() || 'Model 3';
  document.getElementById('point-confidence').textContent = data.confidence_score !== undefined ? data.confidence_score : '--';
  document.getElementById('point-idw-base').textContent = data.stage1_idw_aqi || '--';
  document.getElementById('point-residual').textContent = (data.residual_correction > 0 ? '+' : '') + data.residual_correction;
  document.getElementById('point-nearest-dist').textContent = (data.nearest_distance_km || '--') + ' km';
  document.getElementById('point-dominant').textContent = data.dominant_pollutant || 'PM2.5';
  document.getElementById('point-coords-text').textContent = `${Number(data.latitude).toFixed(6)}°N, ${Number(data.longitude).toFixed(6)}°E`;

  card.classList.remove('hidden');
}

// 6. Phase 3: My Devices Dashboard & Private Telemetry
async function LoadMyDevices() {
  if (!state.token) {
    document.getElementById('device-cards-list').innerHTML = `
      <div style="text-align: center; padding: 24px; font-family: 'JetBrains Mono', monospace;">
        <p style="color: #8b9bb4; font-size: 0.8rem; margin-bottom: 12px;">Sign in to view your private registered hardware.</p>
        <button class="hud-btn hud-btn-primary" onclick="ShowAuthModal()">SIGN IN</button>
      </div>
    `;
    return;
  }

  try {
    const res = await fetch('/api/devices', {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (res.ok) {
      const data = await res.json();
      state.myDevices = data.devices || [];
      document.getElementById('my-device-count').textContent = state.myDevices.length;
      RenderDeviceCards();

      if (state.myDevices.length > 0 && !state.selectedDeviceId) {
        SelectDevice(state.myDevices[0].id);
      }
    } else if (res.status === 401) {
      Logout();
    }
  } catch (err) {
    console.error('[Dashboard] Error loading devices:', err);
  }
}

function RenderDeviceCards() {
  const container = document.getElementById('device-cards-list');
  if (state.myDevices.length === 0) {
    container.innerHTML = `<div class="loading-state" style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #8b9bb4;">No claimed hardware. Click "+ CLAIM DEVICE" to register serial.</div>`;
    return;
  }

  container.innerHTML = state.myDevices
    .map((dev) => {
      const isSelected = dev.id === state.selectedDeviceId;
      const readings = dev.latest_readings;
      return `
      <div class="device-item-card ${isSelected ? 'active' : ''}" onclick="SelectDevice(${dev.id})">
        <div class="dev-item-header">
          <span class="dev-name">${dev.name}</span>
          <span class="dev-type">${dev.model_type}</span>
        </div>
        <div class="dev-item-meta">
          <span>CODE: ${dev.device_code}</span>
          <span style="color: ${dev.status === 'online' ? '#00ff9d' : '#8b9bb4'};">● ${dev.status.toUpperCase()}</span>
        </div>
        ${
          readings
            ? `
          <div style="margin-top: 6px; font-size: 0.72rem; color: #00f0ff; font-family: 'JetBrains Mono', monospace;">
            PM2.5: ${readings.pm2_5} | CO2: ${readings.co2} ppm | TEMP: ${readings.temperature}°C
          </div>
        `
            : ''
        }
      </div>
    `;
    })
    .join('');
}

async function SelectDevice(deviceId) {
  state.selectedDeviceId = deviceId;
  RenderDeviceCards();

  const dev = state.myDevices.find((d) => d.id === deviceId);
  if (!dev) return;

  const detailSec = document.getElementById('device-detail-section');
  detailSec.classList.remove('hidden');

  document.getElementById('active-device-title').textContent = dev.name;
  document.getElementById('active-device-code').textContent = `CODE: ${dev.device_code} // ${dev.model_type.toUpperCase()}`;
  document.getElementById('toggle-optin-discovery').checked = dev.is_public_discovery === 1;

  // Fetch Telemetry History
  try {
    const res = await fetch(`/api/devices/${deviceId}/telemetry?limit=24`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (res.ok) {
      const data = await res.json();
      UpdateTelemetryDisplay(data.readings);
    }
  } catch (err) {
    console.error('[Telemetry] Failed to fetch device telemetry:', err);
  }
}

function UpdateTelemetryDisplay(readings) {
  if (!readings || readings.length === 0) return;

  const latest = readings[readings.length - 1];
  document.getElementById('metric-pm25').textContent = latest.pm2_5 !== null ? latest.pm2_5 : '--';
  document.getElementById('metric-pm10').textContent = latest.pm10 !== null ? latest.pm10 : '--';
  document.getElementById('metric-co2').textContent = latest.co2 !== null ? latest.co2 : '--';
  document.getElementById('metric-temp').textContent = latest.temperature !== null ? latest.temperature : '--';
  document.getElementById('metric-hum').textContent = latest.humidity !== null ? latest.humidity : '--';

  RenderTelemetryChart(readings);
}

function RenderTelemetryChart(readings) {
  const ctx = document.getElementById('telemetryChart').getContext('2d');
  const labels = readings.map((r) => r.recorded_at.split(' ')[1] || r.recorded_at.split('T')[1]?.slice(0, 5) || '');
  const pm25Data = readings.map((r) => r.pm2_5);
  const co2Data = readings.map((r) => r.co2);

  if (state.telemetryChart) {
    state.telemetryChart.destroy();
  }

  state.telemetryChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'PM2.5 (µg/m³)',
          data: pm25Data,
          borderColor: '#00f0ff',
          backgroundColor: 'rgba(0, 240, 255, 0.08)',
          fill: true,
          tension: 0.25,
          yAxisID: 'y',
        },
        {
          label: 'CO2 (ppm)',
          data: co2Data,
          borderColor: '#ffb800',
          backgroundColor: 'transparent',
          borderDash: [3, 3],
          tension: 0.25,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8b9bb4', font: { family: 'JetBrains Mono', size: 9 } } },
      },
      scales: {
        x: { ticks: { color: '#4c5d78', font: { family: 'JetBrains Mono', size: 8 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
        y: { position: 'left', ticks: { color: '#00f0ff', font: { family: 'JetBrains Mono', size: 8 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
        y1: { position: 'right', ticks: { color: '#ffb800', font: { family: 'JetBrains Mono', size: 8 } }, grid: { drawOnChartArea: false } },
      },
    },
  });
}

// 7. WebSocket Live Telemetry Dispatcher Feed
function InitWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    document.getElementById('ws-status').style.borderColor = 'rgba(0, 255, 157, 0.5)';
    document.getElementById('ws-status-text').textContent = 'FEED: SYNCHRONIZED';

    if (state.token) {
      state.ws.send(JSON.stringify({ type: 'AUTH', token: state.token }));
    }
  };

  state.ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'TELEMETRY_UPDATE') {
        const data = msg.data;

        // Append to Admin live log if open
        const adminLog = document.getElementById('admin-terminal-log');
        if (adminLog) {
          const line = document.createElement('div');
          line.className = 'log-line text-cyan';
          line.textContent = `[INGEST] [${data.device_code}] PM2.5=${data.pm2_5} | CO2=${data.co2} | TEMP=${data.temperature}°C @ ${new Date().toLocaleTimeString()}`;
          adminLog.prepend(line);
        }

        // Update active device view
        if (state.selectedDeviceId === data.device_id) {
          document.getElementById('metric-pm25').textContent = data.pm2_5;
          document.getElementById('metric-pm10').textContent = data.pm10;
          document.getElementById('metric-co2').textContent = data.co2;
          document.getElementById('metric-temp').textContent = data.temperature;
          document.getElementById('metric-hum').textContent = data.humidity;
        }

        LoadMyDevices();
      }
    } catch (err) {
      // Ignore
    }
  };

  state.ws.onclose = () => {
    document.getElementById('ws-status').style.borderColor = 'rgba(255, 0, 85, 0.4)';
    document.getElementById('ws-status-text').textContent = 'FEED: RECONNECTING...';
    setTimeout(InitWebSocket, 4000);
  };
}

// 8. Admin Panel Controller
async function InitAdminPanel() {
  // Load initial tab
  await SwitchAdminTab('admin-tab-overview');
}

async function SwitchAdminTab(tabId) {
  state.adminTab = tabId;
  document.querySelectorAll('.admin-nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.admin-tab-pane').forEach((pane) => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  if (!state.token) return;

  if (tabId === 'admin-tab-overview') {
    await LoadAdminOverview();
  } else if (tabId === 'admin-tab-fleet') {
    await LoadAdminFleet();
  } else if (tabId === 'admin-tab-telemetry') {
    await LoadAdminTelemetryStream();
  } else if (tabId === 'admin-tab-users') {
    await LoadAdminUsers();
  } else if (tabId === 'admin-tab-ml') {
    await LoadAdminMlDiagnostics();
  }
}

async function LoadAdminOverview() {
  try {
    const res = await fetch('/api/admin/overview', {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (res.ok) {
      const data = await res.json();
      document.getElementById('stat-total-users').textContent = data.metrics.total_users;
      document.getElementById('stat-total-devices').textContent = data.metrics.total_devices;
      document.getElementById('stat-devices-online-ratio').textContent = `${data.metrics.online_devices} Online / ${data.metrics.offline_devices} Offline`;
      document.getElementById('stat-total-packets').textContent = data.metrics.telemetry_packets_ingested.toLocaleString();

      // Populate recent telemetry table
      const tbody = document.getElementById('admin-recent-telemetry-rows');
      tbody.innerHTML = data.latest_telemetry_stream
        .map(
          (t) => `
        <tr>
          <td>#${t.id}</td>
          <td class="text-cyan">${t.device_code}</td>
          <td>${t.device_name}</td>
          <td><strong>${t.pm2_5 || '--'}</strong></td>
          <td>${t.pm10 || '--'}</td>
          <td class="text-amber">${t.co2 || '--'}</td>
          <td>${t.temperature || '--'}</td>
          <td>${t.humidity || '--'}%</td>
          <td style="color: #8b9bb4;">${t.recorded_at}</td>
        </tr>
      `
        )
        .join('');
    }
  } catch (err) {
    console.error('[Admin] Error loading overview:', err);
  }
}

async function LoadAdminFleet() {
  try {
    const res = await fetch('/api/admin/devices', {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (res.ok) {
      const data = await res.json();
      const tbody = document.getElementById('admin-fleet-device-rows');
      tbody.innerHTML = data.devices
        .map(
          (d) => `
        <tr>
          <td>${d.id}</td>
          <td class="text-cyan"><strong>${d.device_code}</strong></td>
          <td>${d.name}</td>
          <td><span class="hud-pill">${d.model_type}</span></td>
          <td>${d.owner_email || '<span style="color: #4c5d78;">Unassigned</span>'}</td>
          <td style="font-size: 0.7rem;">${Number(d.lat).toFixed(4)}, ${Number(d.lon).toFixed(4)}</td>
          <td>${d.is_public_discovery ? '<span class="text-green">Opt-in</span>' : '<span style="color: #4c5d78;">Private</span>'}</td>
          <td><span style="color: ${d.status === 'online' ? '#00ff9d' : '#ff0055'};">● ${d.status.toUpperCase()}</span></td>
          <td>${d.packet_count}</td>
          <td>
            <button class="hud-btn hud-btn-secondary" style="padding: 2px 6px; font-size: 0.65rem;" onclick="DecommissionDevice(${d.id})">Decommission</button>
          </td>
        </tr>
      `
        )
        .join('');
    }
  } catch (err) {
    console.error('[Admin] Error loading fleet:', err);
  }
}

async function DecommissionDevice(deviceId) {
  if (!confirm(`Confirm decommissioning of Hardware Device ID ${deviceId}?`)) return;
  try {
    const res = await fetch(`/api/admin/devices/${deviceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (res.ok) {
      LoadAdminFleet();
      LoadDiscoveryDevices();
    }
  } catch (err) {
    alert('Failed to decommission device');
  }
}

async function LoadAdminTelemetryStream() {
  try {
    const res = await fetch('/api/admin/telemetry/recent?limit=40', {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (res.ok) {
      const data = await res.json();
      const logBox = document.getElementById('admin-terminal-log');
      logBox.innerHTML = data.stream
        .map(
          (t) => `
        <div class="log-line">
          <span style="color: #4c5d78;">[${t.recorded_at}]</span> <span class="text-cyan">[${t.device_code}]</span> PM2.5=${t.pm2_5} µg/m³ | PM10=${t.pm10} | CO2=${t.co2} ppm | TEMP=${t.temperature}°C | HUM=${t.humidity}%
        </div>
      `
        )
        .join('');
    }
  } catch (err) {
    console.error('[Admin] Error loading telemetry logs:', err);
  }
}

async function LoadAdminUsers() {
  try {
    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (res.ok) {
      const data = await res.json();
      const tbody = document.getElementById('admin-user-rows');
      tbody.innerHTML = data.users
        .map(
          (u) => `
        <tr>
          <td>${u.id}</td>
          <td><strong>${u.full_name}</strong></td>
          <td class="text-cyan">${u.email}</td>
          <td><span class="hud-pill" style="border-color: ${u.role === 'admin' ? '#00ff9d' : '#00f0ff'}; color: ${u.role === 'admin' ? '#00ff9d' : '#00f0ff'};">${u.role.toUpperCase()}</span></td>
          <td>${u.registered_device_count} Devices</td>
          <td style="color: #8b9bb4;">${u.created_at}</td>
          <td>
            <select class="cyber-select" style="padding: 2px 4px; font-size: 0.65rem;" onchange="UpdateUserRole(${u.id}, this.value)">
              <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
          </td>
        </tr>
      `
        )
        .join('');
    }
  } catch (err) {
    console.error('[Admin] Error loading users:', err);
  }
}

async function UpdateUserRole(userId, newRole) {
  try {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.token}`,
      },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      LoadAdminUsers();
    }
  } catch (err) {
    alert('Failed to update user role');
  }
}

async function LoadAdminMlDiagnostics() {
  try {
    const res = await fetch('/api/admin/ml/diagnostics', {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (res.ok) {
      const data = await res.json();
      const manifest = document.getElementById('admin-ml-manifest');
      manifest.innerHTML = `
        <div class="log-line text-green">[STATUS] ${data.status}</div>
        <div class="log-line text-cyan">[BENCHMARK] MAE Reduction: ${data.performance_improvement?.mae_reduction_points} Points (${data.performance_improvement?.mae_reduction_percentage}%)</div>
        <div class="log-line text-cyan">[BENCHMARK] RMSE Reduction: ${data.performance_improvement?.rmse_reduction_points} Points (${data.performance_improvement?.rmse_reduction_percentage}%)</div>
        <div class="log-line text-amber">[MORAN'S I] Spatial Autocorrelation: ${data.spatial_residual_autocorrelation?.morans_i} (Spatially Random = ${!data.spatial_residual_autocorrelation?.spatial_structure_detected})</div>
        <div class="log-line">[HYPERPARAMETERS] ${JSON.stringify(data.hyperparameters || {})}</div>
        <div class="log-line" style="color: #8b9bb4;">[FEATURES] ${JSON.stringify(data.feature_manifest || [])}</div>
      `;
    }
  } catch (err) {
    console.error('[Admin] Error loading ML diagnostics:', err);
  }
}

// 9. Authentication Management
async function InitAuth() {
  if (state.token) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${state.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        state.user = data.user;
        UpdateAuthUI();
        LoadMyDevices();
      } else {
        Logout();
      }
    } catch (err) {
      Logout();
    }
  } else {
    // Auto-login with Admin credentials for immediate access to both Map & Admin Console
    AutoLoginAdmin();
  }
}

async function AutoLoginAdmin() {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@airroute.io', password: 'Password123!' }),
    });
    if (res.ok) {
      const data = await res.json();
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('airroute_jwt', state.token);
      UpdateAuthUI();
      LoadMyDevices();
      if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({ type: 'AUTH', token: state.token }));
      }
    }
  } catch (err) {
    console.warn('[Auth] Auto-login admin failed:', err);
  }
}

function UpdateAuthUI() {
  const container = document.getElementById('auth-controls');
  if (state.user) {
    document.getElementById('user-display-email').textContent = state.user.email;
    document.getElementById('admin-user-name').textContent = state.user.full_name;

    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; color: #00f0ff;">[${state.user.role.toUpperCase()}] ${state.user.full_name}</span>
        <button class="hud-btn hud-btn-secondary" onclick="Logout()">SIGN OUT</button>
      </div>
    `;
  } else {
    container.innerHTML = `<button id="btn-login" class="hud-btn hud-btn-primary" onclick="ShowAuthModal()">SIGN IN</button>`;
  }
}

function Logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('airroute_jwt');
  UpdateAuthUI();
  document.getElementById('my-device-count').textContent = '0';
  document.getElementById('device-cards-list').innerHTML = '';
  document.getElementById('device-detail-section').classList.add('hidden');
}

// 10. Event Listeners Setup
function SetupEventListeners() {
  // View Switcher (Map vs Admin Console)
  document.getElementById('view-tab-map').addEventListener('click', () => {
    state.currentView = 'map';
    document.getElementById('view-tab-map').classList.add('active');
    document.getElementById('view-tab-admin').classList.remove('active');
    document.getElementById('panel-map-view').classList.remove('hidden');
    document.getElementById('panel-admin-view').classList.add('hidden');
    document.getElementById('map-layer-controls').style.display = 'flex';
    if (state.map) state.map.invalidateSize();
  });

  document.getElementById('view-tab-admin').addEventListener('click', () => {
    state.currentView = 'admin';
    document.getElementById('view-tab-admin').classList.add('active');
    document.getElementById('view-tab-map').classList.remove('active');
    document.getElementById('panel-admin-view').classList.remove('hidden');
    document.getElementById('panel-map-view').classList.add('hidden');
    document.getElementById('map-layer-controls').style.display = 'none';
    InitAdminPanel();
  });

  // Admin Nav Tabs
  document.querySelectorAll('.admin-nav-item').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const tab = e.currentTarget.getAttribute('data-tab');
      SwitchAdminTab(tab);
    });
  });

  // Refresh stream button
  const refStream = document.getElementById('btn-refresh-stream');
  if (refStream) {
    refStream.addEventListener('click', LoadAdminTelemetryStream);
  }

  // Provisioning Modal
  const btnProv = document.getElementById('btn-provision-device');
  if (btnProv) {
    btnProv.addEventListener('click', () => {
      document.getElementById('modal-provision').classList.remove('hidden');
    });
  }
  document.getElementById('close-provision-modal').addEventListener('click', () => {
    document.getElementById('modal-provision').classList.add('hidden');
  });
  document.getElementById('cancel-provision').addEventListener('click', () => {
    document.getElementById('modal-provision').classList.add('hidden');
  });

  // Provisioning Form Submit
  document.getElementById('form-provision-device').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('prov-device-code').value;
    const key = document.getElementById('prov-auth-key').value;
    const name = document.getElementById('prov-name').value;
    const model = document.getElementById('prov-model-type').value;
    const lat = document.getElementById('prov-lat').value;
    const lon = document.getElementById('prov-lon').value;

    try {
      const res = await fetch('/api/admin/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({
          device_code: code,
          auth_key: key,
          name: name,
          model_type: model,
          lat: parseFloat(lat),
          lon: parseFloat(lon),
          is_public_discovery: 1,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert('Hardware Device Provisioned Successfully into Fleet Registry.');
        document.getElementById('modal-provision').classList.add('hidden');
        LoadAdminFleet();
        LoadDiscoveryDevices();
      } else {
        alert(data.error || 'Provisioning Failed');
      }
    } catch (err) {
      alert('Error connecting to backend');
    }
  });

  // Layer Toggles
  document.getElementById('toggle-aqi-surface').addEventListener('click', (e) => {
    state.toggles.aqiSurface = !state.toggles.aqiSurface;
    e.currentTarget.classList.toggle('active', state.toggles.aqiSurface);
    if (state.toggles.aqiSurface) {
      state.map.addLayer(state.layers.aqiSurface);
    } else {
      state.map.removeLayer(state.layers.aqiSurface);
    }
  });

  document.getElementById('toggle-stations').addEventListener('click', (e) => {
    state.toggles.stations = !state.toggles.stations;
    e.currentTarget.classList.toggle('active', state.toggles.stations);
    if (state.toggles.stations) {
      state.map.addLayer(state.layers.stations);
    } else {
      state.map.removeLayer(state.layers.stations);
    }
  });

  document.getElementById('toggle-discovery').addEventListener('click', (e) => {
    state.toggles.discovery = !state.toggles.discovery;
    e.currentTarget.classList.toggle('active', state.toggles.discovery);
    if (state.toggles.discovery) {
      state.map.addLayer(state.layers.discovery);
    } else {
      state.map.removeLayer(state.layers.discovery);
    }
  });

  // Dashboard Drawer Toggle
  document.getElementById('btn-open-dashboard').addEventListener('click', () => {
    document.getElementById('dashboard-drawer').classList.remove('hidden');
    LoadMyDevices();
  });
  document.getElementById('btn-close-dashboard').addEventListener('click', () => {
    document.getElementById('dashboard-drawer').classList.add('hidden');
  });

  // Point Inspection Close
  document.getElementById('close-point-card').addEventListener('click', () => {
    document.getElementById('point-inspector').classList.add('hidden');
  });

  // Device Privacy Toggle
  document.getElementById('toggle-optin-discovery').addEventListener('change', async (e) => {
    if (!state.selectedDeviceId || !state.token) return;
    try {
      await fetch(`/api/devices/${state.selectedDeviceId}/visibility`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({ is_public_discovery: e.target.checked ? 1 : 0 }),
      });
      LoadDiscoveryDevices();
    } catch (err) {
      console.error('[Privacy Toggle] Error:', err);
    }
  });

  // Simulate Telemetry Packet Button
  document.getElementById('btn-simulate-packet').addEventListener('click', async () => {
    const dev = state.myDevices.find((d) => d.id === state.selectedDeviceId) || state.myDevices[0];
    if (!dev) return;

    const pm25 = Math.round(160 + Math.random() * 80);
    const pm10 = Math.round(pm25 * 1.5 + Math.random() * 30);
    const co2 = Math.round(400 + Math.random() * 150);
    const temp = +(21 + Math.random() * 5).toFixed(1);
    const hum = +(55 + Math.random() * 25).toFixed(1);

    try {
      const res = await fetch('/api/iot/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_code: dev.device_code,
          auth_key: `KEY-${dev.device_code.slice(4)}`,
          pm2_5: pm25,
          pm10: pm10,
          co2: co2,
          temperature: temp,
          humidity: hum,
          pressure: 1012,
        }),
      });

      if (res.ok) {
        console.log('[Simulate] Sensor packet ingested successfully!');
      }
    } catch (err) {
      console.error('[Simulate] Failed to ingest:', err);
    }
  });

  // Modals
  document.getElementById('btn-register-device').addEventListener('click', () => {
    document.getElementById('modal-register').classList.remove('hidden');
  });
  document.getElementById('close-register-modal').addEventListener('click', () => {
    document.getElementById('modal-register').classList.add('hidden');
  });
  document.getElementById('cancel-register').addEventListener('click', () => {
    document.getElementById('modal-register').classList.add('hidden');
  });

  // Device Claiming Form
  document.getElementById('form-register-device').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('reg-device-code').value;
    const key = document.getElementById('reg-auth-key').value;
    const name = document.getElementById('reg-custom-name').value;
    const lat = document.getElementById('reg-lat').value;
    const lon = document.getElementById('reg-lon').value;

    try {
      const res = await fetch('/api/devices/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({
          device_code: code,
          auth_key: key,
          custom_name: name,
          lat: lat ? parseFloat(lat) : undefined,
          lon: lon ? parseFloat(lon) : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        document.getElementById('modal-register').classList.add('hidden');
        LoadMyDevices();
        LoadDiscoveryDevices();
      } else {
        alert(data.error || 'Registration Failed');
      }
    } catch (err) {
      alert('Error connecting to backend server');
    }
  });

  // Auth Modal
  document.getElementById('close-auth-modal').addEventListener('click', () => {
    document.getElementById('modal-auth').classList.add('hidden');
  });
}

function ShowAuthModal() {
  document.getElementById('modal-auth').classList.remove('hidden');
}

// 11. Bootstrap Application
document.addEventListener('DOMContentLoaded', async () => {
  InitMap();
  SetupEventListeners();
  InitWebSocket();
  await InitAuth();

  // Load Map Layers In Parallel
  await Promise.all([LoadAqiSurface(), LoadStations(), LoadDiscoveryDevices()]);
});
