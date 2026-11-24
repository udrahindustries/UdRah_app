// Device Sensor Card Component
// Displays Realtime Sensor Metrics, Waveforms, Privacy Settings, And Telemetry Testing Controls

import React, { useState, useEffect } from 'react';
import { Cpu, Wifi, Eye, Shield, Send, Thermometer, Droplets, Gauge, AlertCircle } from 'lucide-react';
import { ApiService, MyDevice, TelemetryReading } from '../../Services/ApiService';
import { TelemetryChart } from './TelemetryChart';

interface DeviceCardProps {
  device: MyDevice;
  latestTelemetry?: TelemetryReading;
  onUpdatePrivacy: (deviceId: number, isPublic: boolean, locationMasking: boolean) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({ device, latestTelemetry, onUpdatePrivacy }) => {
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [isPublic, setIsPublic] = useState(Boolean(device.is_public_discovery));
  const [isMasked, setIsMasked] = useState(Boolean(device.location_masking));
  const [isSendingBurst, setIsSendingBurst] = useState(false);

  // Load Initial Telemetry Stream
  useEffect(() => {
    let isMounted = true;
    ApiService.GetDeviceTelemetry(device.id, 20)
      .then((res) => {
        if (isMounted) setReadings(res.readings);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [device.id]);

  // Append Inbound Realtime Packets
  useEffect(() => {
    if (latestTelemetry && latestTelemetry.device_id === device.id) {
      setReadings((prev) => [...prev.slice(-19), latestTelemetry]);
    }
  }, [latestTelemetry, device.id]);

  const handleTogglePublic = async () => {
    const nextPublic = !isPublic;
    setIsPublic(nextPublic);
    onUpdatePrivacy(device.id, nextPublic, isMasked);
  };

  const handleToggleMasking = async () => {
    const nextMasked = !isMasked;
    setIsMasked(nextMasked);
    onUpdatePrivacy(device.id, isPublic, nextMasked);
  };

  const handleSendBurst = async () => {
    setIsSendingBurst(true);
    try {
      const authKey = `KEY-${device.device_code.slice(4)}`;
      await ApiService.SendTestBurst(device.device_code, authKey);
    } catch (e) {
      console.error('Failed To Ingest Test Sensor Burst');
    } finally {
      setIsSendingBurst(false);
    }
  };

  const activeReading = readings[readings.length - 1];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 transition-all hover:shadow-md">
      {/* Device Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-900">{device.name}</h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold font-mono-numbers">
                {device.device_code}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-blue-600 font-medium">{device.model_type}</span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <Wifi className="w-3 h-3" />
                Online
              </span>
            </div>
          </div>
        </div>

        {/* Quick Send Test Burst Button */}
        <button
          onClick={handleSendBurst}
          disabled={isSendingBurst}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          {isSendingBurst ? 'Transmitting...' : 'Send Test Burst'}
        </button>
      </div>

      {/* Realtime Sensor Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="text-[11px] text-slate-500">PM2.5</div>
          <div className="text-lg font-extrabold text-blue-600 font-mono-numbers">
            {activeReading ? `${activeReading.pm2_5}` : '—'}
          </div>
          <div className="text-[10px] text-slate-400">µg/m³</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="text-[11px] text-slate-500">PM10</div>
          <div className="text-lg font-extrabold text-slate-800 font-mono-numbers">
            {activeReading ? `${activeReading.pm10}` : '—'}
          </div>
          <div className="text-[10px] text-slate-400">µg/m³</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="text-[11px] text-slate-500">CO2</div>
          <div className="text-lg font-extrabold text-amber-600 font-mono-numbers">
            {activeReading ? `${activeReading.co2}` : '—'}
          </div>
          <div className="text-[10px] text-slate-400">ppm</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Thermometer className="w-3 h-3 text-red-500" />
            Temp
          </div>
          <div className="text-lg font-extrabold text-slate-800 font-mono-numbers">
            {activeReading ? `${activeReading.temperature}°C` : '—'}
          </div>
          <div className="text-[10px] text-slate-400">Ambient</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Droplets className="w-3 h-3 text-blue-400" />
            Humidity
          </div>
          <div className="text-lg font-extrabold text-slate-800 font-mono-numbers">
            {activeReading ? `${activeReading.humidity}%` : '—'}
          </div>
          <div className="text-[10px] text-slate-400">Relative</div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Gauge className="w-3 h-3 text-indigo-500" />
            Pressure
          </div>
          <div className="text-lg font-extrabold text-slate-800 font-mono-numbers">
            {activeReading ? `${Math.round(activeReading.pressure)}` : '—'}
          </div>
          <div className="text-[10px] text-slate-400">hPa</div>
        </div>
      </div>

      {/* Realtime Waveform Chart */}
      <div className="mb-5">
        <TelemetryChart readings={readings} />
      </div>

      {/* Privacy Settings Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-4">
          {/* Public Discovery Switch */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={handleTogglePublic}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-slate-700 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-blue-500" />
              Community Discovery
            </span>
          </label>

          {/* Location Fuzzing Switch */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isMasked}
              onChange={handleToggleMasking}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-medium text-slate-700 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              Location Masking (300m Fuzzing)
            </span>
          </label>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
          Sensor Telemetry Is Never Shared Publicly
        </div>
      </div>
    </div>
  );
};
