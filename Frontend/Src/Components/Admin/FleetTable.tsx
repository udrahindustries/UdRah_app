// Hardware Fleet Management Table Component
// Displays All Deployed Fleet Hardware, Statuses, Ownership, And Decommissioning Actions

import React, { useState } from 'react';
import { Cpu, Trash2, Plus, Wifi, MapPin } from 'lucide-react';
import { ApiService } from '../../Services/ApiService';

interface FleetTableProps {
  devices: any[];
  onRefresh: () => void;
}

export const FleetTable: React.FC<FleetTableProps> = ({ devices, onRefresh }) => {
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [deviceCode, setDeviceCode] = useState('');
  const [authKey, setAuthKey] = useState('');
  const [name, setName] = useState('');
  const [modelType, setModelType] = useState('AirRoute Pro');

  const handleDecommission = async (deviceId: number, code: string) => {
    if (!window.confirm(`Are You Sure You Want To Decommission Sensor ${code}? This Action Removes All Associated Telemetry History.`)) {
      return;
    }

    try {
      await ApiService.DecommissionDevice(deviceId);
      onRefresh();
    } catch (e) {
      console.error('Failed To Decommission Hardware Device');
    }
  };

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApiService.ProvisionDevice({
        device_code: deviceCode.trim().toUpperCase(),
        auth_key: authKey.trim(),
        name: name.trim(),
        model_type: modelType,
      });
      setIsProvisioning(false);
      setDeviceCode('');
      setAuthKey('');
      setName('');
      onRefresh();
    } catch (e) {
      console.error('Failed To Provision Hardware Sensor');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Hardware Fleet Roster</h2>
          <p className="text-xs text-slate-500">Monitor Deployed Physical Sensors Across Delhi NCR</p>
        </div>
        <button
          onClick={() => setIsProvisioning(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Provision New Sensor
        </button>
      </div>

      {/* Provisioning Form Accordion */}
      {isProvisioning && (
        <form onSubmit={handleProvisionSubmit} className="p-5 bg-blue-50/50 border-b border-blue-100 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Serial Code</label>
            <input
              type="text"
              required
              placeholder="E.g., AIR-PRO-007"
              value={deviceCode}
              onChange={(e) => setDeviceCode(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono-numbers"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Auth Secret Key</label>
            <input
              type="text"
              required
              placeholder="E.g., KEY-PRO-007"
              value={authKey}
              onChange={(e) => setAuthKey(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono-numbers"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Hardware Label</label>
            <input
              type="text"
              required
              placeholder="E.g., Okhla Industrial Sensor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700"
            >
              Save Sensor
            </button>
            <button
              type="button"
              onClick={() => setIsProvisioning(false)}
              className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-200/50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Roster Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
            <tr>
              <th className="px-5 py-3">Device Code & Name</th>
              <th className="px-5 py-3">Hardware Model</th>
              <th className="px-5 py-3">Assigned Owner</th>
              <th className="px-5 py-3">Coordinates</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {devices.map((device) => (
              <tr key={device.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="font-bold text-slate-900">{device.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono-numbers">{device.device_code}</div>
                </td>
                <td className="px-5 py-3.5 font-medium text-blue-600">{device.model_type}</td>
                <td className="px-5 py-3.5">
                  {device.owner_email ? (
                    <div>
                      <div className="font-medium text-slate-800">{device.owner_name}</div>
                      <div className="text-[11px] text-slate-400">{device.owner_email}</div>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">Unassigned (Inventory)</span>
                  )}
                </td>
                <td className="px-5 py-3.5 font-mono-numbers text-slate-500">
                  {device.lat?.toFixed(3)}°, {device.lon?.toFixed(3)}°
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Wifi className="w-3 h-3" />
                    Online
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    onClick={() => handleDecommission(device.id, device.device_code)}
                    title="Decommission Sensor"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
