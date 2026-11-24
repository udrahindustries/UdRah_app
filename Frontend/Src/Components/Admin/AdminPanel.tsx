// System Administration & Fleet Command Console Component
// Enables Comprehensive Executive Oversight, User Roles, Device Fleets, And Model Diagnostics

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, Users, Activity, Layers, Radio, Lock } from 'lucide-react';
import { ApiService, AdminMetrics, AdminUser, ModelDiagnostics } from '../../Services/ApiService';
import { FleetTable } from './FleetTable';
import { UsersTable } from './UsersTable';
import { TelemetryStreamTable } from './TelemetryStreamTable';
import { ModelDiagnosticsCard } from './ModelDiagnosticsCard';

interface AdminPanelProps {
  currentUserRole: 'user' | 'admin' | null;
  onOpenAuth: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ currentUserRole, onOpenAuth }) => {
  const [activeTab, setActiveTab] = useState<'fleet' | 'users' | 'telemetry' | 'ml'>('fleet');
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [telemetryStream, setTelemetryStream] = useState<any[]>([]);
  const [diagnostics, setDiagnostics] = useState<ModelDiagnostics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const loadAdminData = async () => {
    setIsLoading(true);
    setAccessDenied(false);

    try {
      const [overviewData, usersData, devicesData, telemetryData, mlData] = await Promise.all([
        ApiService.GetAdminOverview(),
        ApiService.GetAdminUsers(),
        ApiService.GetAdminDevices(),
        ApiService.GetRecentTelemetry(30),
        ApiService.GetModelDiagnostics(),
      ]);

      setMetrics(overviewData.metrics);
      setUsers(usersData.users);
      setDevices(devicesData.devices);
      setTelemetryStream(telemetryData.stream);
      setDiagnostics(mlData);
    } catch (err: any) {
      if (err.message?.includes('403') || err.message?.includes('Access Denied')) {
        setAccessDenied(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUserRole === 'admin') {
      loadAdminData();
    } else {
      setAccessDenied(true);
    }
  }, [currentUserRole]);

  // Access Denied State (Non-Admin Users)
  if (currentUserRole !== 'admin' || accessDenied) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm text-center">
        <div className="w-16 h-16 rounded-3xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-4 border border-purple-100">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Administrator Access Required</h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          The System Administration & Fleet Command Console Is Strictly Restricted To Authorized Administrators. Log In With An Elevated Administrator Profile (E.g., admin@airroute.io) To Proceed.
        </p>
        <button
          onClick={onOpenAuth}
          className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-sm transition-all"
        >
          Authenticate As Administrator
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">System Administration Console</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Root Authority
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Enterprise Fleet Command, User Access Control, And Geospatial Model Verification
          </p>
        </div>
      </div>

      {/* Top Level Metric Cards */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500 font-medium">Registered Accounts</div>
            <div className="text-2xl font-extrabold text-slate-900 font-mono-numbers mt-1">
              {metrics.total_users}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Enterprise Users & Admins</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500 font-medium">Total Hardware Fleet</div>
            <div className="text-2xl font-extrabold text-blue-600 font-mono-numbers mt-1">
              {metrics.total_devices}
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
              {metrics.online_devices} Units Online
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500 font-medium">Packets Ingested</div>
            <div className="text-2xl font-extrabold text-indigo-600 font-mono-numbers mt-1">
              {metrics.telemetry_packets_ingested}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Time-Series Telemetry DB</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500 font-medium">Model 3 Improvement</div>
            <div className="text-2xl font-extrabold text-emerald-600 font-mono-numbers mt-1">
              +15.06%
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">MAE Error Reduction</div>
          </div>
        </div>
      )}

      {/* Tab Controls */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('fleet')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'fleet'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Cpu className="w-4 h-4" />
          Hardware Fleet
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'users'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          User Accounts
        </button>

        <button
          onClick={() => setActiveTab('telemetry')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'telemetry'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          Telemetry Audit Stream
        </button>

        <button
          onClick={() => setActiveTab('ml')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ml'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          Model 3 Diagnostics
        </button>
      </div>

      {/* Active Tab Views */}
      {activeTab === 'fleet' && <FleetTable devices={devices} onRefresh={loadAdminData} />}
      {activeTab === 'users' && <UsersTable users={users} onRefresh={loadAdminData} />}
      {activeTab === 'telemetry' && <TelemetryStreamTable stream={telemetryStream} />}
      {activeTab === 'ml' && <ModelDiagnosticsCard diagnostics={diagnostics} />}
    </div>
  );
};
