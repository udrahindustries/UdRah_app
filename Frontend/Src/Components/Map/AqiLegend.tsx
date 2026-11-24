// Air Quality Index Category Color Legend Component
// Visualizes Standard Indian Central Pollution Control Board (CPCB) Thresholds

import React from 'react';

export const AqiLegend: React.FC = () => {
  const categories = [
    { label: 'Good', range: '0–50', color: '#10b981', textColor: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Satisfactory', range: '51–100', color: '#84cc16', textColor: 'text-lime-700', bg: 'bg-lime-50' },
    { label: 'Moderate', range: '101–200', color: '#f59e0b', textColor: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'Poor', range: '201–300', color: '#f97316', textColor: 'text-orange-700', bg: 'bg-orange-50' },
    { label: 'Very Poor', range: '301–400', color: '#ef4444', textColor: 'text-red-700', bg: 'bg-red-50' },
    { label: 'Severe', range: '401–500', color: '#881337', textColor: 'text-rose-900', bg: 'bg-rose-50' },
  ];

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl px-5 py-3.5 border border-slate-200/80 shadow-xl shadow-slate-900/5 transition-all">
      {/* Title & Continuous Gradient Bar */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Air Quality Standard (CPCB NAQI)
        </div>
        <div className="text-[10px] text-slate-400 font-medium">India National Standard</div>
      </div>

      {/* Smooth Continuous Gradient Bar */}
      <div className="w-full h-2 rounded-full mb-3" style={{ background: 'linear-gradient(to right, #10b981 0%, #84cc16 20%, #f59e0b 40%, #f97316 60%, #ef4444 80%, #881337 100%)' }}></div>

      {/* Categories Row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
        {categories.map((cat) => (
          <div key={cat.label} className={`px-2 py-1.5 rounded-xl border border-slate-100 ${cat.bg}`}>
            <div className="text-[11px] font-bold text-slate-800 leading-tight">{cat.label}</div>
            <div className="text-[10px] text-slate-500 font-mono-numbers mt-0.5">{cat.range}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
