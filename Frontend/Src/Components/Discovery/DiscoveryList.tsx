// Community Discovery List View Component
// Phase 2 Nearby Products Map & Community Sensor Radar

import React from 'react';
import { Radio, ShieldCheck, MapPin, Eye, Compass, Wifi } from 'lucide-react';
import { DiscoveredDevice } from '../../Services/ApiService';

interface DiscoveryListProps {
  devices: DiscoveredDevice[];
  onFocusDevice: (device: DiscoveredDevice) => void;
}

export const DiscoveryList: React.FC<DiscoveryListProps> = ({ devices, onFocusDevice }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Community Sensor Discovery</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {devices.length} Devices In Range
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Discover Publicly Opted-In AirRoute Hardware Units Monitoring Air Across Delhi NCR
          </p>
        </div>

        {/* Privacy Assurance Pill */}
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold self-start sm:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          Zero Telemetry Leakage Enforced • 300m Location Masking Active
        </div>
      </div>

      {/* Grid Of Discovered Devices */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {devices.map((device) => (
          <div
            key={device.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{device.name}</h3>
                    <div className="text-xs text-blue-600 font-semibold">{device.model_type}</div>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Wifi className="w-3 h-3" />
                  Online
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600 my-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Radial Distance:</span>
                  <span className="font-bold text-slate-800 font-mono-numbers">~{device.distance_km.toFixed(1)} km Away</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Fuzzed Coordinates:</span>
                  <span className="font-mono-numbers text-slate-500">
                    {device.approx_latitude.toFixed(3)}°, {device.approx_longitude.toFixed(3)}°
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onFocusDevice(device)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold border border-slate-200 transition-colors"
            >
              <Compass className="w-3.5 h-3.5" />
              View Location On Map
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
