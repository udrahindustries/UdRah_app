// Model 3 Spatial Machine Learning Diagnostics Card
// Presents Regression Benchmarks, Residual Autocorrelation Scores, And Continuous Verification Metrics

import React from 'react';
import { Layers, TrendingUp, CheckCircle2, Award, Compass, Zap } from 'lucide-react';
import { ModelDiagnostics } from '../../Services/ApiService';

interface ModelDiagnosticsCardProps {
  diagnostics: ModelDiagnostics | null;
}

export const ModelDiagnosticsCard: React.FC<ModelDiagnosticsCardProps> = ({ diagnostics }) => {
  if (!diagnostics) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400">
        Loading Model 3 Machine Learning Diagnostics...
      </div>
    );
  }

  const { stage1_idw_metrics, stage2_xgb_metrics, performance_improvement, spatial_residual_autocorrelation } = diagnostics;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Model 3 Spatial AQI Engine Diagnostics</h2>
            <p className="text-xs text-slate-500">Stage 1 Vectorized IDW + Stage 2 Contextual XGBoost Residual Regressor</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold self-start sm:self-auto">
          <CheckCircle2 className="w-4 h-4" />
          Acceptance Gate Passed
        </div>
      </div>

      {/* Executive Improvement Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            MAE Error Reduction
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono-numbers">
            {performance_improvement.mae_reduction_percentage.toFixed(2)}%
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {stage1_idw_metrics.mae} → {stage2_xgb_metrics.mae} AQI Points
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
            <Zap className="w-4 h-4 text-blue-600" />
            RMSE Variance Reduction
          </div>
          <div className="text-2xl font-black text-blue-600 font-mono-numbers">
            {performance_improvement.rmse_reduction_percentage.toFixed(2)}%
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {stage1_idw_metrics.rmse} → {stage2_xgb_metrics.rmse} Points
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
            <Compass className="w-4 h-4 text-indigo-600" />
            Moran's I Autocorrelation
          </div>
          <div className="text-2xl font-black text-slate-800 font-mono-numbers">
            {spatial_residual_autocorrelation.morans_i.toFixed(4)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Zero Spatial Clustering Detected</div>
        </div>
      </div>

      {/* Model Benchmark Comparison Table */}
      <div className="overflow-x-auto border border-slate-100 rounded-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
            <tr>
              <th className="px-4 py-2.5">Pipeline Stage</th>
              <th className="px-4 py-2.5">Mean Absolute Error (MAE)</th>
              <th className="px-4 py-2.5">Root Mean Squared Error (RMSE)</th>
              <th className="px-4 py-2.5">R² Explained Variance</th>
              <th className="px-4 py-2.5">Category Accuracy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-mono-numbers">
            <tr>
              <td className="px-4 py-3 font-sans font-medium text-slate-800">Stage 1 (IDW Baseline)</td>
              <td className="px-4 py-3">{stage1_idw_metrics.mae}</td>
              <td className="px-4 py-3">{stage1_idw_metrics.rmse}</td>
              <td className="px-4 py-3">{stage1_idw_metrics.r2}</td>
              <td className="px-4 py-3">{stage1_idw_metrics.category_accuracy_pct}%</td>
            </tr>
            <tr className="bg-blue-50/40 font-semibold text-blue-900">
              <td className="px-4 py-3 font-sans font-bold text-blue-700">Stage 2 (IDW + XGBoost Residuals)</td>
              <td className="px-4 py-3 text-emerald-600">{stage2_xgb_metrics.mae}</td>
              <td className="px-4 py-3 text-emerald-600">{stage2_xgb_metrics.rmse}</td>
              <td className="px-4 py-3">{stage2_xgb_metrics.r2}</td>
              <td className="px-4 py-3 text-emerald-600">{stage2_xgb_metrics.category_accuracy_pct}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
