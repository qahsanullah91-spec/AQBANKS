import React, { useState } from 'react';
import { mobileApi } from '../services/api.js';
import { User } from '../types/index.js';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@aqcompanies.com');
  const [password, setPassword] = useState('AQCompanies@2026');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await mobileApi.login({ email, password });
      onLoginSuccess(res.user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const setRole = (targetEmail: string) => {
    setEmail(targetEmail);
    setPassword('AQCompanies@2026');
  };

  return (
    <div style={{ padding: 24, backgroundColor: '#020617', minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ width: 80, height: 80, backgroundColor: '#0f172a', borderRadius: 20, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255, 255, 255, 0.15)', boxShadow: '0 0 20px rgba(255,255,255,0.08)' }}>
          <img
            src="/logo.png"
            alt="AQ Companies Logo"
            style={{ width: '80%', height: '80%', objectFit: 'contain', filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.4))' }}
          />
        </div>
        <h1 style={{ color: '#ffffff', fontSize: 22, fontWeight: 'bold', margin: 0 }}>AQ COMPANIES</h1>
        <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: 1 }}>
          Mobile Native Portal • iOS & Android
        </p>
      </div>

      {errorMessage && (
        <div style={{ padding: 12, backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: 8, color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
          {errorMessage}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginBottom: 6 }}>Email Address</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: '12px 14px', minHeight: 44, borderRadius: 8, backgroundColor: '#0f172a', border: '1px solid #334155', color: '#ffffff', fontSize: 14, boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginBottom: 6 }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ width: '100%', padding: '12px 14px', minHeight: 44, borderRadius: 8, backgroundColor: '#0f172a', border: '1px solid #334155', color: '#ffffff', fontSize: 14, boxSizing: 'border-box' }}
        />
      </div>

      <button
        onClick={handleLogin}
        disabled={loading}
        style={{ width: '100%', minHeight: 48, borderRadius: 8, backgroundColor: '#059669', color: '#ffffff', fontSize: 15, fontWeight: 'bold', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s' }}
      >
        {loading ? 'Authenticating...' : 'Sign In to Mobile Portal'}
      </button>

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #1e293b' }}>
        <span style={{ color: '#64748b', fontSize: 11, display: 'block', marginBottom: 10, textTransform: 'uppercase', fontWeight: 600 }}>
          Switch Role Profile:
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={() => setRole('admin@aqcompanies.com')} style={{ padding: '8px 10px', minHeight: 44, backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 12, textAlign: 'left', cursor: 'pointer' }}>
            👑 Admin
          </button>
          <button onClick={() => setRole('finance@aqcompanies.com')} style={{ padding: '8px 10px', minHeight: 44, backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 12, textAlign: 'left', cursor: 'pointer' }}>
            💰 Finance
          </button>
          <button onClick={() => setRole('logistics@aqcompanies.com')} style={{ padding: '8px 10px', minHeight: 44, backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 12, textAlign: 'left', cursor: 'pointer' }}>
            🚢 Logistics
          </button>
          <button onClick={() => setRole('auditor@aqcompanies.com')} style={{ padding: '8px 10px', minHeight: 44, backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 12, textAlign: 'left', cursor: 'pointer' }}>
            🔍 Auditor
          </button>
        </div>
      </div>
    </div>
  );
};
