// My Devices Hardware Dashboard View
// Manages User Owned Hardware Sensors, Claiming New Sensors, And Viewing Realtime Telemetry Streams

import React, { useState } from 'react';
import { Cpu, Plus, Radio, ShieldCheck, Sparkles, Inbox } from 'lucide-react';
import { ApiService, MyDevice, TelemetryReading } from '../../Services/ApiService';
import { DeviceCard } from './DeviceCard';
import { ClaimDeviceModal } from './ClaimDeviceModal';

interface DeviceDashboardProps {
  devices: MyDevice[];
  onDeviceClaimed: (device: MyDevice) => void;
  latestTelemetry?: TelemetryReading;
}

export const DeviceDashboard: React.FC<DeviceDashboardProps> = ({ devices, onDeviceClaimed, latestTelemetry }) => {
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);

  const handleUpdatePrivacy = async (deviceId: number, isPublic: boolean, locationMasking: boolean) => {
    try {
      await ApiService.UpdateDeviceVisibility(deviceId, isPublic, locationMasking);
    } catch (e) {
      console.error('Failed To Persist Privacy Settings To Backend Database');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Dashboard Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">My AirRoute Hardware</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {devices.length} {devices.length === 1 ? 'Sensor' : 'Sensors'} Active
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Private Hardware Telemetry Dashboard & Environmental Intelligence
          </p>
        </div>

        <button
          onClick={() => setIsClaimModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm shadow-blue-200 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Claim New Device
        </button>
      </div>

      {/* Hardware Devices List */}
      {devices.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100">
            <Inbox className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">No Hardware Sensors Claimed Yet</h3>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            Pair Your First AirRoute Pro, AirRoute Mini, Or AirRoute Pocket Sensor To Stream Realtime Telemetry Directly Into Your Personal Dashboard.
          </p>
          <button
            onClick={() => setIsClaimModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm mx-auto"
          >
            <Plus className="w-4 h-4" />
            Claim Your Sensor
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              latestTelemetry={latestTelemetry}
              onUpdatePrivacy={handleUpdatePrivacy}
            />
          ))}
        </div>
      )}

      {/* Claim Device Modal */}
      <ClaimDeviceModal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        onDeviceClaimed={onDeviceClaimed}
      />
    </div>
  );
};
