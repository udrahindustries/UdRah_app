// Lightweight SVG Telemetry Line Chart Component
// Visualizes Realtime PM2.5 And CO2 Time-Series Waveforms Without External Chart Bloat

import React from 'react';
import { TelemetryReading } from '../../Services/ApiService';

interface TelemetryChartProps {
  readings: TelemetryReading[];
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({ readings }) => {
  if (!readings || readings.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        Waiting For Realtime Sensor Packets...
      </div>
    );
  }

  // Calculate Bounds
  const pmValues = readings.map((r) => r.pm2_5);
  const co2Values = readings.map((r) => r.co2);

  const minPm = Math.max(0, Math.min(...pmValues) - 10);
  const maxPm = Math.max(...pmValues) + 15;
  const minCo2 = Math.max(350, Math.min(...co2Values) - 20);
  const maxCo2 = Math.max(...co2Values) + 20;

  const width = 360;
  const height = 110;

  // Generate SVG Points For PM2.5 (Cyan/Blue Line)
  const pmPoints = readings
    .map((r, idx) => {
      const x = (idx / (readings.length - 1)) * width;
      const y = height - ((r.pm2_5 - minPm) / (maxPm - minPm || 1)) * height;
      return `${x},${y}`;
    })
    .join(' ');

  // Generate SVG Points For CO2 (Amber Dotted Line)
  const co2Points = readings
    .map((r, idx) => {
      const x = (idx / (readings.length - 1)) * width;
      const y = height - ((r.co2 - minCo2) / (maxCo2 - minCo2 || 1)) * height;
      return `${x},${y}`;
    })
    .join(' ');

  const latest = readings[readings.length - 1];

  return (
    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
      <div className="flex items-center justify-between text-xs mb-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-blue-600 font-medium">
            <span className="w-2.5 h-1 bg-blue-600 rounded-full"></span>
            PM2.5 ({latest.pm2_5} µg/m³)
          </div>
          <div className="flex items-center gap-1.5 text-amber-600 font-medium">
            <span className="w-2.5 h-1 border-t-2 border-dashed border-amber-500"></span>
            CO2 ({latest.co2} ppm)
          </div>
        </div>
        <span className="text-[10px] text-slate-400 font-mono-numbers">Live 20-Sample Stream</span>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28 overflow-visible">
          {/* Subtle Grid Guidelines */}
          <line x1="0" y1="25" x2={width} y2="25" stroke="#e2e8f0" strokeDasharray="3 3" />
          <line x1="0" y1="55" x2={width} y2="55" stroke="#e2e8f0" strokeDasharray="3 3" />
          <line x1="0" y1="85" x2={width} y2="85" stroke="#e2e8f0" strokeDasharray="3 3" />

          {/* PM2.5 Path */}
          <polyline fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pmPoints} />

          {/* CO2 Path */}
          <polyline fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round" points={co2Points} />
        </svg>
      </div>
    </div>
  );
};
