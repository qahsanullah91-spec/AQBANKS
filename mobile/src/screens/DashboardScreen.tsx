import React, { useEffect, useState } from 'react';
import { mobileApi } from '../services/api.js';
import { DashboardMetrics, User } from '../types/index.js';

interface DashboardScreenProps {
  user: User;
  onNavigate: (tab: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ user, onNavigate }) => {
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
    <div style={{ padding: 16, color: '#f8fafc' }}>
      {/* Welcome header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, backgroundColor: '#0f172a', borderRadius: 10, padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <img
              src="/logo.png"
              alt="AQ Companies Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Mobile Overview</span>
            <h2 style={{ margin: 0, fontSize: 16, color: '#ffffff', fontWeight: 700 }}>
              Hello, {user.firstName || user.email.split('@')[0]}
            </h2>
          </div>
        </div>
        <button
          onClick={fetchDashboard}
          style={{
            padding: '8px 12px',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 8,
            color: '#38bdf8',
            fontSize: 12,
            minHeight: 44,
            cursor: 'pointer'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: 8, color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Primary KPI Card: Available Balance */}
      <div style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
        border: '1px solid #059669',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: '#6ee7b7', fontWeight: 600, textTransform: 'uppercase' }}>
            🏦 Available Bank Balance
          </span>
          <span style={{ fontSize: 11, backgroundColor: '#059669', color: '#ffffff', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
            Live
          </span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#ffffff', letterSpacing: -0.5 }}>
          {loading ? 'Loading...' : formatCurrency(metrics?.availableBalance)}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: '#a7f3d0' }}>
          Deterministic Balance: Opening + Total Inward Credits - Outward Debits
        </div>
      </div>

      {/* Secondary Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Total Inward Credits</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#34d399' }}>
            {loading ? '...' : formatCurrency(metrics?.totalCredits)}
          </div>
        </div>

        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Total Outward Debits</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f87171' }}>
            {loading ? '...' : formatCurrency(metrics?.totalDebits)}
          </div>
        </div>

        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Total Invoiced</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8' }}>
            {loading ? '...' : formatCurrency(metrics?.totalInvoiced)}
          </div>
        </div>

        <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Pending Receivables</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fbbf24' }}>
            {loading ? '...' : formatCurrency(metrics?.pendingReceivables)}
          </div>
        </div>
      </div>

      {/* Quick Actions for Mobile */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase' }}>
          Quick Actions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            onClick={() => onNavigate('invoices')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 12,
              minHeight: 48,
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#e2e8f0',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <span>📄</span>
            <span>Invoices</span>
          </button>

          <button
            onClick={() => onNavigate('shipments')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 12,
              minHeight: 48,
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#e2e8f0',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <span>🚢</span>
            <span>Shipments</span>
          </button>

          <button
            onClick={() => onNavigate('ledger')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 12,
              minHeight: 48,
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#e2e8f0',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <span>📊</span>
            <span>Statement</span>
          </button>

          <button
            onClick={() => onNavigate('bank')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 12,
              minHeight: 48,
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#e2e8f0',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <span>🔒</span>
            <span>Bank Routing</span>
          </button>
        </div>
      </div>

      {/* Security & Invariant Notice */}
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 14 }}>🛡️</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>Idempotency & Precision Active</span>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
          Mobile transactions are secured with double-tap idempotency keys. All monetary calculations use 128-bit decimal precision.
        </p>
      </div>
    </div>
  );
};
