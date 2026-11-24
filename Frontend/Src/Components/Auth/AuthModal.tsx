// Authentication Modal Component
// Supports Sign In, Registration, And Instant One-Click Demo / Admin Profiles

import React, { useState } from 'react';
import { X, Lock, Mail, User, Shield, ArrowRight, AlertCircle } from 'lucide-react';
import { ApiService, UserProfile } from '../../Services/ApiService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const response = await ApiService.Login(email.trim(), password);
        localStorage.setItem('airroute_token', response.token);
        onLoginSuccess(response.user, response.token);
        onClose();
      } else {
        const response = await ApiService.Register(email.trim(), password, fullName.trim());
        localStorage.setItem('airroute_token', response.token);
        onLoginSuccess(response.user, response.token);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication Failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick One-Click Authentication Pre-Sets
  const handleQuickLogin = async (targetEmail: string, targetPass: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await ApiService.Login(targetEmail, targetPass);
      localStorage.setItem('airroute_token', response.token);
      onLoginSuccess(response.user, response.token);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Quick Authentication Failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {mode === 'login' ? 'Sign In To AirRoute' : 'Create AirRoute Account'}
            </h2>
            <p className="text-xs text-slate-500">
              {mode === 'login'
                ? 'Access Your Private Hardware Fleet And Personal Telemetry Stream'
                : 'Join The Delhi NCR Environmental Monitoring Network'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick One-Click Profile Shortcuts */}
        <div className="mb-5 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            Instant One-Click Login Profiles
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('demo@airroute.io', 'Password123!')}
              className="px-3 py-2 rounded-xl bg-white hover:bg-blue-50 text-slate-800 hover:text-blue-700 border border-slate-200 text-xs font-semibold shadow-xs text-left transition-colors"
            >
              <div className="font-bold text-slate-900">Demo User</div>
              <div className="text-[10px] text-slate-400 font-mono-numbers">3 Sensors Owned</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('admin@airroute.io', 'Password123!')}
              className="px-3 py-2 rounded-xl bg-white hover:bg-purple-50 text-slate-800 hover:text-purple-700 border border-slate-200 text-xs font-semibold shadow-xs text-left transition-colors"
            >
              <div className="font-bold text-purple-700">Administrator</div>
              <div className="text-[10px] text-slate-400 font-mono-numbers">Fleet & ML Access</div>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="E.g., Priya Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50 mt-2"
          >
            {isLoading ? 'Verifying...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Mode Toggle Switch */}
        <div className="text-center mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500">
          {mode === 'login' ? (
            <div>
              Don't Have An Account?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="font-bold text-blue-600 hover:text-blue-700 underline"
              >
                Sign Up Here
              </button>
            </div>
          ) : (
            <div>
              Already Have An Account?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="font-bold text-blue-600 hover:text-blue-700 underline"
              >
                Sign In Instead
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
