// Point Inspector Component
// Presents High-Fidelity Model 3 Estimates, Health Guidance, And Pollutant Breakdown When A Coordinate Is Selected

import React from 'react';
import { X, Activity, Compass, ShieldAlert, Award, Layers } from 'lucide-react';
import { SpatialEstimate } from '../../Services/ApiService';

interface PointInspectorProps {
  estimate: SpatialEstimate;
  onClose: () => void;
}

export const PointInspector: React.FC<PointInspectorProps> = ({ estimate, onClose }) => {
  // Determine Visual Theme Based On Estimated AQI
  const getBadgeStyle = (aqi: number) => {
    if (aqi <= 50) return { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' };
    if (aqi <= 100) return { bg: 'bg-lime-100', text: 'text-lime-800', border: 'border-lime-300' };
    if (aqi <= 200) return { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' };
    if (aqi <= 300) return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' };
    if (aqi <= 400) return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' };
    return { bg: 'bg-rose-100', text: 'text-rose-900', border: 'border-rose-300' };
  };

  const badge = getBadgeStyle(estimate.estimated_aqi);
  const confidencePercent = Math.round(estimate.confidence_score * 100);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-5 max-w-sm w-full transition-all">
      {/* Header With Coordinates & Close Button */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <div>
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            Coordinate Spatial Inspection
          </div>
          <div className="text-xs text-slate-500 font-mono-numbers mt-0.5">
            {estimate.latitude.toFixed(4)}° N, {estimate.longitude.toFixed(4)}° E
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main AQI Score Display */}
      <div className={`rounded-xl p-4 border ${badge.bg} ${badge.border} mb-4 flex items-center justify-between`}>
        <div>
          <div className="text-xs font-medium text-slate-600">Estimated Composite NAQI</div>
          <div className="text-4xl font-extrabold text-slate-900 font-mono-numbers tracking-tight">
            {Math.round(estimate.estimated_aqi)}
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider ${badge.text} bg-white shadow-sm border border-slate-200`}>
          {estimate.category}
        </div>
      </div>

      {/* Health Recommendation Card */}
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <div className="text-xs font-semibold text-slate-800">Health Advisory</div>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{estimate.health_advisory}</p>
        </div>
      </div>

      {/* Dominant Pollutant & Nearest Sensor Details */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Activity className="w-3 h-3 text-blue-500" />
            Dominant Pollutant
          </div>
          <div className="text-sm font-bold text-slate-800 font-mono-numbers mt-0.5">
            {(estimate.dominant_pollutant || 'PM2.5').toUpperCase()}
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Award className="w-3 h-3 text-emerald-500" />
            Confidence Level
          </div>
          <div className="text-sm font-bold text-slate-800 font-mono-numbers mt-0.5">
            {confidencePercent}%
          </div>
        </div>
      </div>

      {/* Model 3 Two-Stage ML Architecture Card */}
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs">
        <div className="font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          Model 3 Spatial Architecture
        </div>
        <div className="space-y-1.5 text-slate-600">
          <div className="flex justify-between">
            <span>Stage 1 IDW Baseline:</span>
            <span className="font-semibold font-mono-numbers">{Math.round(estimate.stage1_idw_aqi)}</span>
          </div>
          <div className="flex justify-between">
            <span>Stage 2 XGBoost Residual Shift:</span>
            <span className={`font-semibold font-mono-numbers ${estimate.stage2_residual_correction >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {estimate.stage2_residual_correction >= 0 ? '+' : ''}
              {estimate.stage2_residual_correction.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Nearest Ground Station:</span>
            <span className="font-medium truncate max-w-[150px]">{estimate.nearest_station_name} ({estimate.nearest_station_km.toFixed(1)} km)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
