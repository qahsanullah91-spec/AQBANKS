import React, { useState } from 'react';
import { api, setAuthToken } from '../services/api';
import { ShieldCheck, Lock, Mail, Building2, AlertCircle } from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@aqcompanies.com');
  const [password, setPassword] = useState('AQCompanies@2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login({ email, password });
      setAuthToken(res.accessToken);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const setRoleAccount = (targetEmail: string) => {
    setEmail(targetEmail);
    setPassword('AQCompanies@2026');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-24 h-24 bg-slate-950 p-2 rounded-2xl flex items-center justify-center mb-3 border border-slate-700/80 shadow-[0_0_25px_rgba(255,255,255,0.1)]">
            <img
              src="/logo.png"
              alt="AQ Companies Official Logo"
              className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
            />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">AQ COMPANIES</h1>
          <p className="text-xs uppercase tracking-widest text-slate-400 mt-1">Logistics & Financial Management Portal</p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5" /> Sky Ariana Ltd Banking & Cargo Engine
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800/80 rounded-lg flex items-center gap-2.5 text-sm text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="user@aqcompanies.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-lg transition shadow-lg shadow-emerald-950 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-800">
          <p className="text-xs text-slate-400 mb-2 font-medium">Quick Role Selector (Demo):</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => setRoleAccount('admin@aqcompanies.com')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-left text-slate-200 border border-slate-700"
            >
              👑 <span className="font-semibold">Admin</span>
            </button>
            <button
              onClick={() => setRoleAccount('finance@aqcompanies.com')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-left text-slate-200 border border-slate-700"
            >
              💰 <span className="font-semibold">Finance Mgr</span>
            </button>
            <button
              onClick={() => setRoleAccount('logistics@aqcompanies.com')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-left text-slate-200 border border-slate-700"
            >
              🚢 <span className="font-semibold">Logistics Coord</span>
            </button>
            <button
              onClick={() => setRoleAccount('auditor@aqcompanies.com')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-left text-slate-200 border border-slate-700"
            >
              🔍 <span className="font-semibold">Auditor</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
