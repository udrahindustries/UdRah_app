// Interactive Air Quality & Geospatial Map Component
// Combines Model 3 Spatial Interpolation Surface, Fixed Stations, And Community Discovery Markers

import React, { useEffect, useRef } from 'react';
import { Layers, Sparkles } from 'lucide-react';
import { AqiStation, DiscoveredDevice, SpatialEstimate } from '../../Services/ApiService';
import { PointInspector } from './PointInspector';
import { AqiLegend } from './AqiLegend';

// Declare Leaflet Global From CDN
declare const L: any;

interface AqiMapProps {
  stations: AqiStation[];
  discoveredDevices: DiscoveredDevice[];
  onSelectCoordinate: (lat: number, lon: number) => Promise<SpatialEstimate>;
  surfaceGeoJson: any;
  showDiscovery: boolean;
}

export const AqiMap: React.FC<AqiMapProps> = ({
  stations,
  discoveredDevices,
  onSelectCoordinate,
  surfaceGeoJson,
  showDiscovery,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const surfaceLayerRef = useRef<any>(null);
  const stationsLayerRef = useRef<any>(null);
  const discoveryLayerRef = useRef<any>(null);

  const [activeLayers, setActiveLayers] = React.useState({
    surface: true,
    stations: true,
    discovery: showDiscovery,
  });

  const [selectedEstimate, setSelectedEstimate] = React.useState<SpatialEstimate | null>(null);
  const [isLoadingPoint, setIsLoadingPoint] = React.useState(false);

  // Helper For CPCB Color Hex
  const getCpcbColor = (aqi: number) => {
    if (aqi <= 50) return '#10b981';
    if (aqi <= 100) return '#84cc16';
    if (aqi <= 200) return '#f59e0b';
    if (aqi <= 300) return '#f97316';
    if (aqi <= 400) return '#ef4444';
    return '#881337';
  };

  // Initialize Map Instance
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Create Leaflet Map Instance
    const map = L.map(mapContainerRef.current, {
      center: [28.6139, 77.2090],
      zoom: 11,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topleft' }).addTo(map);

    // High-Clarity Watermark-Free OpenStreetMap Basemap (Familiar To Everyday Users)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap Contributors',
      maxZoom: 18,
      className: 'corporate-tiles',
    }).addTo(map);

    // Initialize Layer Groups
    surfaceLayerRef.current = L.layerGroup().addTo(map);
    stationsLayerRef.current = L.layerGroup().addTo(map);
    discoveryLayerRef.current = L.layerGroup().addTo(map);

    // Map Click Handler: Query Model 3 Spatial Engine
    map.on('click', async (e: any) => {
      const { lat, lng } = e.latlng;
      setIsLoadingPoint(true);
      try {
        const estimate = await onSelectCoordinate(lat, lng);
        setSelectedEstimate(estimate);
      } catch (err) {
        console.error('Failed To Estimate Spatial AQI At Clicked Coordinate');
      } finally {
        setIsLoadingPoint(false);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Surface Layer (Model 3 Interpolated Heatmap Surface)
  useEffect(() => {
    if (!mapInstanceRef.current || !surfaceLayerRef.current) return;
    surfaceLayerRef.current.clearLayers();

    if (activeLayers.surface && surfaceGeoJson?.features) {
      // Use pointToLayer To Render Seamless Translucent Heat Circles Instead Of Default Blue Pin Icons
      const geoLayer = L.geoJSON(surfaceGeoJson, {
        pointToLayer: (feature: any, latlng: any) => {
          const rawAqi = feature.properties?.aqi || feature.properties?.estimated_aqi || 200;
          const aqi = isNaN(rawAqi) ? 200 : Math.round(rawAqi);
          const color = getCpcbColor(aqi);

          const circle = L.circleMarker(latlng, {
            radius: 22,
            fillColor: color,
            fillOpacity: 0.38,
            stroke: false,
          });

          const category = feature.properties?.category || 'Moderate';
          circle.bindTooltip(`
            <div style="font-family: sans-serif; font-size: 11px; padding: 2px 4px;">
              <span style="font-weight: 800; color: ${color};">${aqi} AQI</span>
              <span style="color: #64748b;"> • ${category}</span>
            </div>
          `, { sticky: true, className: 'aqi-tooltip' });

          return circle;
        },
      });
      surfaceLayerRef.current.addLayer(geoLayer);
    }
  }, [surfaceGeoJson, activeLayers.surface]);

  // Update Monitoring Stations (Clean Elevated Badges)
  useEffect(() => {
    if (!mapInstanceRef.current || !stationsLayerRef.current) return;
    stationsLayerRef.current.clearLayers();

    if (activeLayers.stations && stations.length > 0) {
      stations.forEach((station) => {
        const rawAqi = station.current_aqi !== undefined ? station.current_aqi : (station as any).aqi ?? 0;
        const aqi = isNaN(rawAqi) ? 0 : Math.round(rawAqi);
        const color = getCpcbColor(aqi);
        const dominant = (station.dominant_pollutant || (station as any).pm2_5 ? 'PM2.5' : 'PM10').toUpperCase();
        const city = station.city || 'Delhi NCR';

        const markerHtml = `
          <div style="background-color: ${color}; color: white; padding: 3px 8px; border-radius: 9999px; font-weight: 700; font-size: 11px; box-shadow: 0 4px 12px rgba(0,0,0,0.22); border: 2px solid white; display: flex; align-items: center; justify-content: center; white-space: nowrap; font-family: 'JetBrains Mono', monospace; cursor: pointer; transition: transform 0.15s ease;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
            ${aqi}
          </div>
        `;

        const customIcon = L.divIcon({
          html: markerHtml,
          className: 'station-marker',
          iconSize: [44, 26],
          iconAnchor: [22, 13],
        });

        const marker = L.marker([station.latitude, station.longitude], { icon: customIcon });
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; padding: 6px; min-width: 180px;">
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">${station.station_name}</div>
            <div style="color: #64748b; font-size: 11px; margin-bottom: 8px;">${city} (Official CAAQMS)</div>
            <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 6px 8px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <span style="font-size: 15px; font-weight: 800; color: ${color};">${aqi} AQI</span>
              <span style="background: white; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 11px; border: 1px solid #cbd5e1;">${dominant}</span>
            </div>
          </div>
        `);
        stationsLayerRef.current.addLayer(marker);
      });
    }
  }, [stations, activeLayers.stations]);

  // Update Discovery Layer (Phase 2 Nearby Products)
  useEffect(() => {
    if (!mapInstanceRef.current || !discoveryLayerRef.current) return;
    discoveryLayerRef.current.clearLayers();

    if (activeLayers.discovery && discoveredDevices.length > 0) {
      discoveredDevices.forEach((device) => {
        const markerHtml = `
          <div style="background-color: #2563eb; color: white; width: 30px; height: 30px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(37,99,235,0.35); border: 2px solid white; cursor: pointer; transition: transform 0.15s ease;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/>
              <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/>
              <circle cx="12" cy="12" r="2"/>
              <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/>
              <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>
            </svg>
          </div>
        `;

        const customIcon = L.divIcon({
          html: markerHtml,
          className: 'discovery-marker',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        const marker = L.marker([device.approx_latitude, device.approx_longitude], { icon: customIcon });
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; padding: 6px; max-width: 210px;">
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">${device.name}</div>
            <div style="color: #2563eb; font-weight: 600; font-size: 11px; margin-bottom: 4px;">${device.model_type}</div>
            <div style="color: #64748b; font-size: 11px; margin-bottom: 6px;">Distance: ~${device.distance_km.toFixed(1)} km away</div>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 6px; font-size: 10px; color: #475569;">
              🔒 Location Masked (300m Fuzzing). Telemetry Is Private.
            </div>
          </div>
        `);
        discoveryLayerRef.current.addLayer(marker);
      });
    }
  }, [discoveredDevices, activeLayers.discovery]);

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] overflow-hidden">
      {/* Map Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Layer Controls (Top Right With Generous Padding) */}
      <div className="absolute top-5 right-5 z-10 flex flex-col gap-2">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-slate-200/80 shadow-xl shadow-slate-900/5 min-w-[210px]">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            Map Layers
          </div>
          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 hover:text-slate-900 hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={activeLayers.surface}
                onChange={(e) => setActiveLayers((prev) => ({ ...prev, surface: e.target.checked }))}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              AQI Heatmap Surface (Model 3)
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 hover:text-slate-900 hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={activeLayers.stations}
                onChange={(e) => setActiveLayers((prev) => ({ ...prev, stations: e.target.checked }))}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Physical Stations (38 CAAQMS)
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 hover:text-slate-900 hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={activeLayers.discovery}
                onChange={(e) => setActiveLayers((prev) => ({ ...prev, discovery: e.target.checked }))}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Community Devices
            </label>
          </div>
        </div>
      </div>

      {/* Floating Point Inspector (Top Left) */}
      {selectedEstimate && (
        <div className="absolute top-5 left-5 z-20">
          <PointInspector estimate={selectedEstimate} onClose={() => setSelectedEstimate(null)} />
        </div>
      )}

      {/* Floating AQI Legend (Bottom Center With Generous Padding) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-full max-w-xl px-4 pointer-events-auto">
        <AqiLegend />
      </div>

      {/* Click To Inspect Banner (Bottom Left) */}
      <div className="absolute bottom-6 left-6 z-10 hidden md:flex items-center gap-2.5 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-200/80 shadow-lg shadow-slate-900/5 text-xs font-semibold text-slate-700">
        <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
        Click Anywhere On Map To Query Model 3 Spatial AQI
      </div>
    </div>
  );
};
