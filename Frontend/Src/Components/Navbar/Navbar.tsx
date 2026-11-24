// Top Navigation Bar For AirRoute Corporate Web Platform
// Displays Brand Identity, High-Level View Switcher, Live Telemetry Status, And User Authentication

import React from 'react';
import { Wind, MapPin, Cpu, ShieldCheck, LogIn, LogOut, Radio, Search } from 'lucide-react';
import { UserProfile } from '../../Services/ApiService';

interface NavbarProps {
  activeView: 'map' | 'discovery' | 'devices' | 'admin';
  setActiveView: (view: 'map' | 'discovery' | 'devices' | 'admin') => void;
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  deviceCount: number;
  onSearchLocation: (query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  setActiveView,
  currentUser,
  onOpenAuth,
  onLogout,
  deviceCount,
  onSearchLocation,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearchLocation(searchQuery.trim());
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Brand Identity */}
          <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => setActiveView('map')}>
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-200 shrink-0">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-slate-900 tracking-tight">AirRoute</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-100">
                  Delhi NCR
                </span>
              </div>
              <p className="hidden xl:block text-[11px] text-slate-400 font-medium leading-none mt-0.5">
                Ambient Intelligence & IoT Platform
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 shrink-0">
            <button
              onClick={() => setActiveView('map')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'map'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Air Quality Map
            </button>

            <button
              onClick={() => setActiveView('discovery')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'discovery'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Community Devices
            </button>

            <button
              onClick={() => setActiveView('devices')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'devices'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              My Hardware
              {deviceCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                  {deviceCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveView('admin')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeView === 'admin'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin Console
              {currentUser?.role === 'admin' && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                  Admin
                </span>
              )}
            </button>
          </nav>

          {/* Quick Search & User Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Quick Search */}
            <form onSubmit={handleSearchSubmit} className="hidden lg:flex items-center relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search Delhi Location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 w-40 xl:w-56 focus:w-64 rounded-xl bg-slate-100/90 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </form>

            {/* Live Feed Status Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-medium shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-dot shrink-0"></span>
              Live Feed Active
            </div>

            {/* User Session Profile & Controls */}
            {currentUser ? (
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-900 leading-tight">{currentUser.full_name}</div>
                  <div className="text-[11px] text-slate-400 font-mono-numbers">{currentUser.email}</div>
                </div>

                <button
                  onClick={onLogout}
                  title="Sign Out Of Platform"
                  className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200/80 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
