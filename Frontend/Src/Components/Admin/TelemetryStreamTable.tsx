// Realtime Telemetry Stream Audit Table Component
// Displays Inbound Sensor Transmissions With Live Timestamping

import React from 'react';
import { Activity, Clock } from 'lucide-react';

interface TelemetryStreamTableProps {
  stream: any[];
}

export const TelemetryStreamTable: React.FC<TelemetryStreamTableProps> = ({ stream }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Live Ingested Telemetry Stream</h2>
          <p className="text-xs text-slate-500">Realtime Audit Log Of Incoming Hardware Environmental Packets</p>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
          <Activity className="w-3.5 h-3.5" />
          Live Audit Log
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
            <tr>
              <th className="px-5 py-3">Device Identity</th>
              <th className="px-5 py-3">PM2.5</th>
              <th className="px-5 py-3">PM10</th>
              <th className="px-5 py-3">CO2</th>
              <th className="px-5 py-3">Temp / Humidity</th>
              <th className="px-5 py-3">Pressure</th>
              <th className="px-5 py-3 text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-mono-numbers">
            {stream.map((packet, idx) => (
              <tr key={packet.id || idx} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-5 py-3 font-sans">
                  <div className="font-bold text-slate-900">{packet.device_name || 'AirRoute Sensor'}</div>
                  <div className="text-[11px] text-slate-400 font-mono-numbers">{packet.device_code}</div>
                </td>
                <td className="px-5 py-3 font-bold text-blue-600">{packet.pm2_5} µg/m³</td>
                <td className="px-5 py-3">{packet.pm10} µg/m³</td>
                <td className="px-5 py-3 font-semibold text-amber-600">{packet.co2} ppm</td>
                <td className="px-5 py-3">
                  {packet.temperature}°C / {packet.humidity}%
                </td>
                <td className="px-5 py-3">{Math.round(packet.pressure)} hPa</td>
                <td className="px-5 py-3 text-right text-slate-400 text-[11px]">
                  {packet.recorded_at ? packet.recorded_at.replace('T', ' ').slice(0, 19) : 'Just Now'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
