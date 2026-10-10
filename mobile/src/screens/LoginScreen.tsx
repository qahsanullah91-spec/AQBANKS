import React, { useState } from 'react';
import { mobileApi } from '../services/api.js';
import { User } from '../types/index.js';
import { useTheme } from '../theme/ThemeContext.js';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { theme, colors, toggleTheme } = useTheme();
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
    <div style={{
      padding: 24,
      backgroundColor: colors.bg,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      color: colors.text,
      position: 'relative'
    }}>
      {/* Top Bar with Theme Toggle */}
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          style={{
            padding: '8px 12px',
            backgroundColor: colors.card,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 8,
            color: colors.text,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 40
          }}
        >
          <span>{theme === 'light' ? '🌙' : '☀️'}</span>
          <span style={{ fontSize: 11, fontWeight: 700 }}>{theme === 'light' ? 'Dark' : 'Light'}</span>
        </button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          width: 80,
          height: 80,
          backgroundColor: '#020617',
          borderRadius: 20,
          margin: '0 auto 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
        }}>
          <img
            src="/logo.png"
            alt="AQ Companies Logo"
            style={{ width: '80%', height: '80%', objectFit: 'contain' }}
          />
        </div>
        <h1 style={{ color: colors.text, fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: 0.5 }}>
          AQ COMPANIES
        </h1>
        <p style={{ color: colors.textMuted, fontSize: 12, margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
          Mobile Native Portal • iOS & Android
        </p>
      </div>

      {errorMessage && (
        <div style={{
          padding: 12,
          backgroundColor: colors.dangerBg,
          border: `1px solid ${colors.danger}`,
          borderRadius: 8,
          color: colors.danger,
          fontSize: 13,
          marginBottom: 16,
          fontWeight: 600
        }}>
          {errorMessage}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
          Email Address
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 14px',
            minHeight: 44,
            borderRadius: 8,
            backgroundColor: colors.inputBg,
            border: `1px solid ${colors.inputBorder}`,
            color: colors.text,
            fontSize: 14,
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 14px',
            minHeight: 44,
            borderRadius: 8,
            backgroundColor: colors.inputBg,
            border: `1px solid ${colors.inputBorder}`,
            color: colors.text,
            fontSize: 14,
            boxSizing: 'border-box'
          }}
        />
      </div>

      <button
        onClick={handleLogin}
        disabled={loading}
        style={{
          width: '100%',
          minHeight: 48,
          borderRadius: 8,
          backgroundColor: colors.accent,
          color: '#ffffff',
          fontSize: 15,
          fontWeight: 800,
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        {loading ? 'Authenticating...' : 'Sign In to Mobile Portal'}
      </button>

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${colors.divider}` }}>
        <span style={{ color: colors.textMuted, fontSize: 11, display: 'block', marginBottom: 10, textTransform: 'uppercase', fontWeight: 700 }}>
          Quick Demo Credentials:
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            onClick={() => setRole('admin@aqcompanies.com')}
            style={{
              padding: '8px 10px',
              minHeight: 44,
              backgroundColor: colors.card,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 6,
              color: colors.text,
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            👑 Admin
          </button>
          <button
            onClick={() => setRole('finance@aqcompanies.com')}
            style={{
              padding: '8px 10px',
              minHeight: 44,
              backgroundColor: colors.card,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 6,
              color: colors.text,
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            💰 Finance
          </button>
          <button
            onClick={() => setRole('logistics@aqcompanies.com')}
            style={{
              padding: '8px 10px',
              minHeight: 44,
              backgroundColor: colors.card,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 6,
              color: colors.text,
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            🚢 Logistics
          </button>
          <button
            onClick={() => setRole('auditor@aqcompanies.com')}
            style={{
              padding: '8px 10px',
              minHeight: 44,
              backgroundColor: colors.card,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 6,
              color: colors.text,
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'left',
              cursor: 'pointer'
            }}
          >
            🔍 Auditor
          </button>
        </div>
      </div>
    </div>
  );
};
