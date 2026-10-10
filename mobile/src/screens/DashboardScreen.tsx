import React, { useEffect, useState } from 'react';
import { mobileApi } from '../services/api.js';
import { DashboardMetrics, User } from '../types/index.js';
import { useTheme } from '../theme/ThemeContext.js';

interface DashboardScreenProps {
  user: User;
  onNavigate: (tab: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ user, onNavigate }) => {
  const { theme, colors } = useTheme();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await mobileApi.getDashboardOverview();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const formatCurrency = (val: string | number | undefined) => {
    if (val === undefined || val === null) return '$0.00';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(isNaN(num) ? 0 : num);
  };

  return (
    <div style={{ padding: 16, color: colors.text, backgroundColor: colors.bg, minHeight: '100%' }}>
      {/* Welcome header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40,
            height: 40,
            backgroundColor: '#020617',
            borderRadius: 10,
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
          }}>
            <img
              src="/logo.png"
              alt="AQ Companies Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <span style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
              Mobile Command Center
            </span>
            <h2 style={{ margin: 0, fontSize: 16, color: colors.text, fontWeight: 800 }}>
              Hello, {user.firstName || user.email.split('@')[0]}
            </h2>
          </div>
        </div>
        <button
          onClick={fetchDashboard}
          style={{
            padding: '8px 12px',
            backgroundColor: colors.card,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 8,
            color: colors.primary,
            fontSize: 12,
            minHeight: 40,
            cursor: 'pointer'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div style={{
          padding: 12,
          backgroundColor: colors.dangerBg,
          border: `1px solid ${colors.danger}`,
          borderRadius: 8,
          color: colors.danger,
          fontSize: 13,
          marginBottom: 16
        }}>
          {error}
        </div>
      )}

      {/* Primary KPI Card: Available Balance */}
      <div style={{
        background: theme === 'light'
          ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
          : 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
        border: theme === 'light' ? '1px solid #0284c7' : '1px solid #059669',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        color: '#ffffff',
        boxShadow: theme === 'light' ? '0 4px 12px rgba(2, 132, 199, 0.25)' : '0 4px 12px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.9)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            🏦 Available Bank Balance
          </span>
          <span style={{ fontSize: 11, backgroundColor: 'rgba(255, 255, 255, 0.2)', color: '#ffffff', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
            Live
          </span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#ffffff', letterSpacing: -0.5 }}>
          {loading ? 'Loading...' : formatCurrency(metrics?.availableBalance)}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255, 255, 255, 0.85)' }}>
          Deterministic Balance: Opening + Total Inward Credits - Outward Debits
        </div>
      </div>

      {/* Secondary Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 10,
          padding: 12,
          boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
        }}>
          <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Total Inward Credits</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: colors.accent }}>
            {loading ? '...' : formatCurrency(metrics?.totalCredits)}
          </div>
        </div>

        <div style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 10,
          padding: 12,
          boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
        }}>
          <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Total Outward Debits</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: colors.danger }}>
            {loading ? '...' : formatCurrency(metrics?.totalDebits)}
          </div>
        </div>

        <div style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 10,
          padding: 12,
          boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
        }}>
          <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Total Invoiced</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: colors.primary }}>
            {loading ? '...' : formatCurrency(metrics?.totalInvoiced)}
          </div>
        </div>

        <div style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 10,
          padding: 12,
          boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
        }}>
          <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>Pending Receivables</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: colors.warning }}>
            {loading ? '...' : formatCurrency(metrics?.pendingReceivables)}
          </div>
        </div>
      </div>

      {/* Quick Actions for Mobile */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Quick Navigation
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <button
            onClick={() => onNavigate('receipts')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 6px',
              minHeight: 52,
              backgroundColor: colors.card,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 8,
              color: colors.text,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <span style={{ fontSize: 20, marginBottom: 4 }}>🧾</span>
            <span>Receipts</span>
          </button>

          <button
            onClick={() => onNavigate('payments')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 6px',
              minHeight: 52,
              backgroundColor: colors.card,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 8,
              color: colors.text,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <span style={{ fontSize: 20, marginBottom: 4 }}>💳</span>
            <span>Payments</span>
          </button>

          <button
            onClick={() => onNavigate('invoices')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 6px',
              minHeight: 52,
              backgroundColor: colors.card,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 8,
              color: colors.text,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <span style={{ fontSize: 20, marginBottom: 4 }}>📄</span>
            <span>Invoices</span>
          </button>

          <button
            onClick={() => onNavigate('shipments')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 6px',
              minHeight: 52,
              backgroundColor: colors.card,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 8,
              color: colors.text,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <span style={{ fontSize: 20, marginBottom: 4 }}>🚢</span>
            <span>Shipments</span>
          </button>

          <button
            onClick={() => onNavigate('ledger')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 6px',
              minHeight: 52,
              backgroundColor: colors.card,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 8,
              color: colors.text,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <span style={{ fontSize: 20, marginBottom: 4 }}>📊</span>
            <span>Ledger</span>
          </button>

          <button
            onClick={() => onNavigate('bank')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 6px',
              minHeight: 52,
              backgroundColor: colors.card,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 8,
              color: colors.text,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <span style={{ fontSize: 20, marginBottom: 4 }}>🔒</span>
            <span>Bank Routing</span>
          </button>
        </div>
      </div>

      {/* Security & Invariant Notice */}
      <div style={{
        backgroundColor: colors.card,
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: 8,
        padding: 12,
        boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 14 }}>🛡️</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: colors.accent }}>Automatic Receipts & Idempotency</span>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: colors.textMuted, lineHeight: 1.4 }}>
          Inward payments generate instant numbered receipts. Transactions are secured with idempotency guards and 128-bit decimal precision.
        </p>
      </div>
    </div>
  );
};
