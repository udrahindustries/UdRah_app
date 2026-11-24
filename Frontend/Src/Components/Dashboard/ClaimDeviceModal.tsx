// Claim / Register New AirRoute Hardware Sensor Modal
// Allows Users To Pair New Physical AirRoute Devices Using Serial Code And Secret Key

import React, { useState } from 'react';
import { X, Cpu, Key, Tag, MapPin, CheckCircle, AlertCircle } from 'lucide-react';
import { ApiService, MyDevice } from '../../Services/ApiService';

interface ClaimDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceClaimed: (device: MyDevice) => void;
}

export const ClaimDeviceModal: React.FC<ClaimDeviceModalProps> = ({ isOpen, onClose, onDeviceClaimed }) => {
  const [deviceCode, setDeviceCode] = useState('');
  const [authKey, setAuthKey] = useState('');
  const [customName, setCustomName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await ApiService.RegisterDevice(deviceCode.trim(), authKey.trim(), customName.trim());
      onDeviceClaimed(response.device);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed To Claim AirRoute Hardware Sensor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 transition-all">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Claim AirRoute Sensor</h2>
              <p className="text-xs text-slate-500">Pair Your Hardware With Your Personal Account</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Device Serial Code
            </label>
            <div className="relative">
              <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                placeholder="E.g., AIR-PRO-001 Or AIR-MINI-002"
                value={deviceCode}
                onChange={(e) => setDeviceCode(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono-numbers focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Printed On The Back Plate Or Retail Packaging Box</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Secret Hardware Authentication Key
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                placeholder="E.g., KEY-PRO-001"
                value={authKey}
                onChange={(e) => setAuthKey(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono-numbers focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Provided With Your Initial Purchase Warranty Card</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Custom Friendly Name (Optional)
            </label>
            <input
              type="text"
              placeholder="E.g., Living Room Monitor, Balcony Sensor"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {isLoading ? 'Verifying Hardware...' : 'Claim Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
