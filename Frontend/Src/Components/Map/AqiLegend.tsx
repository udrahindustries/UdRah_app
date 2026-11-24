// Air Quality Index Category Color Legend Component
// Visualizes Standard Indian Central Pollution Control Board (CPCB) Thresholds

import React from 'react';
import { Wind, Shield } from 'lucide-react';

export const AqiLegend: React.FC = () => {
  const categories = [
    { label: 'Good', range: '0–50', color: '#10b981', textColor: 'text-emerald-700', bg: 'bg-emerald-50/90', border: 'border-emerald-200/60' },
    { label: 'Satisfactory', range: '51–100', color: '#84cc16', textColor: 'text-lime-700', bg: 'bg-lime-50/90', border: 'border-lime-200/60' },
    { label: 'Moderate', range: '101–200', color: '#f59e0b', textColor: 'text-amber-700', bg: 'bg-amber-50/90', border: 'border-amber-200/60' },
    { label: 'Poor', range: '201–300', color: '#f97316', textColor: 'text-orange-700', bg: 'bg-orange-50/90', border: 'border-orange-200/60' },
    { label: 'Very Poor', range: '301–400', color: '#ef4444', textColor: 'text-red-700', bg: 'bg-red-50/90', border: 'border-red-200/60' },
    { label: 'Severe', range: '401–500', color: '#881337', textColor: 'text-rose-900', bg: 'bg-rose-50/90', border: 'border-rose-200/60' },
  ];

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-3xl p-5 border border-slate-200/90 shadow-2xl shadow-slate-900/10 transition-all">
      {/* Title & Metadata Row */}
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <Wind className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
            Air Quality Index (CPCB NAQI Standard)
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          National Standard
        </div>
      </div>

      {/* Smooth Continuous Gradient Spectrum Bar */}
      <div
        className="w-full h-2.5 rounded-full mb-3.5 shadow-inner"
        style={{
          background: 'linear-gradient(to right, #10b981 0%, #84cc16 20%, #f59e0b 40%, #f97316 60%, #ef4444 80%, #881337 100%)',
        }}
      ></div>

      {/* 6 Balanced Category Chips With Ample Breathing Room */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
        {categories.map((cat) => (
          <div
            key={cat.label}
            className={`p-2.5 rounded-2xl border ${cat.border} ${cat.bg} flex flex-col justify-center items-center shadow-xs transition-transform hover:-translate-y-0.5`}
          >
            <div className={`text-xs font-extrabold ${cat.textColor} leading-tight`}>{cat.label}</div>
            <div className="text-[10px] text-slate-500 font-mono-numbers font-semibold mt-1">{cat.range}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
