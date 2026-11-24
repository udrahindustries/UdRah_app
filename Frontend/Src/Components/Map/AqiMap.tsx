// Interactive Air Quality & Geospatial Map Component
// Combines Model 3 Spatial Interpolation Surface, Fixed Stations, And Community Discovery Markers

import React, { useEffect, useRef } from 'react';
import { Layers, Sparkles, Sliders } from 'lucide-react';
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

  // Update Surface Layer (Model 3 Interpolated Heatmap Surface - Smooth Contiguous Cloud)
  useEffect(() => {
    if (!mapInstanceRef.current || !surfaceLayerRef.current) return;
    surfaceLayerRef.current.clearLayers();

    if (activeLayers.surface && surfaceGeoJson?.features) {
      // Use pointToLayer With Radius 38 To Create A Contiguous Blended Heat Surface
      const geoLayer = L.geoJSON(surfaceGeoJson, {
        pointToLayer: (feature: any, latlng: any) => {
          const rawAqi = feature.properties?.aqi || feature.properties?.estimated_aqi || 200;
          const aqi = isNaN(rawAqi) ? 200 : Math.round(rawAqi);
          const color = getCpcbColor(aqi);

          const circle = L.circleMarker(latlng, {
            radius: 42,
            fillColor: color,
            fillOpacity: 0.38,
            stroke: false,
            className: 'aqi-surface-cell',
          });

          const category = feature.properties?.category || 'Moderate';
          circle.bindTooltip(`
            <div style="font-family: sans-serif; font-size: 11px; padding: 3px 6px;">
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

  // Update Monitoring Stations (Clean Elevated Badges With Ring Beacon)
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
          <div style="background-color: ${color}; color: white; padding: 4px 10px; border-radius: 9999px; font-weight: 800; font-size: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.25); border: 2.5px solid white; display: flex; align-items: center; gap: 4px; white-space: nowrap; font-family: 'JetBrains Mono', monospace; cursor: pointer; transition: transform 0.15s ease;" onmouseover="this.style.transform='scale(1.12)'" onmouseout="this.style.transform='scale(1)'">
            <span style="width: 5px; height: 5px; border-radius: 50%; background: white; opacity: 0.9;"></span>
            <span>${aqi}</span>
          </div>
        `;

        const customIcon = L.divIcon({
          html: markerHtml,
          className: 'station-marker',
          iconSize: [52, 28],
          iconAnchor: [26, 14],
        });

        const marker = L.marker([station.latitude, station.longitude], { icon: customIcon });
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; padding: 6px; min-width: 200px;">
            <div style="font-weight: 800; color: #0f172a; margin-bottom: 2px;">${station.station_name}</div>
            <div style="color: #64748b; font-size: 11px; margin-bottom: 8px;">${city} (Official CAAQMS)</div>
            <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 6px 10px; border-radius: 10px; border: 1px solid #e2e8f0;">
              <span style="font-size: 16px; font-weight: 800; color: ${color};">${aqi} AQI</span>
              <span style="background: white; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; border: 1px solid #cbd5e1;">${dominant}</span>
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
          <div style="background-color: #2563eb; color: white; width: 34px; height: 34px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(37,99,235,0.4); border: 2.5px solid white; cursor: pointer; transition: transform 0.15s ease;" onmouseover="this.style.transform='scale(1.12)'" onmouseout="this.style.transform='scale(1)'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const marker = L.marker([device.approx_latitude, device.approx_longitude], { icon: customIcon });
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; padding: 6px; max-width: 220px;">
            <div style="font-weight: 800; color: #0f172a; margin-bottom: 2px;">${device.name}</div>
            <div style="color: #2563eb; font-weight: 700; font-size: 11px; margin-bottom: 4px;">${device.model_type}</div>
            <div style="color: #64748b; font-size: 11px; margin-bottom: 6px;">Distance: ~${device.distance_km.toFixed(1)} km away</div>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 8px; font-size: 10px; color: #475569;">
              🔒 Location Masked (300m Fuzzing). Telemetry Is Private.
            </div>
          </div>
        `);
        discoveryLayerRef.current.addLayer(marker);
      });
    }
  }, [discoveredDevices, activeLayers.discovery]);

  return (
    <div className="relative w-full h-[calc(100vh-5rem)] overflow-hidden">
      {/* Map Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Layer Controls (Top Right With Generous 24px Margin & Padding) */}
      <div className="absolute top-6 right-6 z-10 flex flex-col gap-2">
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-2xl shadow-slate-900/10 min-w-[240px]">
          <div className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              Map Layers
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              Filter
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <label className="flex items-center justify-between cursor-pointer text-slate-700 hover:text-slate-900 hover:bg-slate-50 px-2.5 py-2 rounded-xl transition-colors font-medium">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 shrink-0"></span>
                AQI Heatmap Surface (Model 3)
              </span>
              <input
                type="checkbox"
                checked={activeLayers.surface}
                onChange={(e) => setActiveLayers((prev) => ({ ...prev, surface: e.target.checked }))}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer text-slate-700 hover:text-slate-900 hover:bg-slate-50 px-2.5 py-2 rounded-xl transition-colors font-medium">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0"></span>
                Physical Stations (38 CAAQMS)
              </span>
              <input
                type="checkbox"
                checked={activeLayers.stations}
                onChange={(e) => setActiveLayers((prev) => ({ ...prev, stations: e.target.checked }))}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer text-slate-700 hover:text-slate-900 hover:bg-slate-50 px-2.5 py-2 rounded-xl transition-colors font-medium">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                Community Devices
              </span>
              <input
                type="checkbox"
                checked={activeLayers.discovery}
                onChange={(e) => setActiveLayers((prev) => ({ ...prev, discovery: e.target.checked }))}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Floating Point Inspector (Top Left) */}
      {selectedEstimate && (
        <div className="absolute top-6 left-6 z-20">
          <PointInspector estimate={selectedEstimate} onClose={() => setSelectedEstimate(null)} />
        </div>
      )}

      {/* Floating AQI Legend (Bottom Center With 32px Floor Margin) */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 w-full max-w-2xl px-4 pointer-events-auto">
        <AqiLegend />
      </div>

      {/* Click To Inspect Banner (Bottom Left With 32px Floor Margin) */}
      <div className="absolute bottom-8 left-6 z-10 hidden md:flex items-center gap-3 bg-white/95 backdrop-blur-md px-5 py-3 rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-900/10 text-xs font-bold text-slate-800">
        <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
        Click Anywhere On Map To Query Model 3 Spatial AQI
      </div>
    </div>
  );
};
