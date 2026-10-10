import React, { useState, useEffect } from 'react';
import { User } from './types/index.js';
import { tokenStorage, mobileApi } from './services/api.js';
import { LoginScreen } from './screens/LoginScreen.js';
import { DashboardScreen } from './screens/DashboardScreen.js';
import { InvoicesScreen } from './screens/InvoicesScreen.js';
import { LogisticsScreen } from './screens/LogisticsScreen.js';
import { LedgerScreen } from './screens/LedgerScreen.js';
import { PaymentsScreen } from './screens/PaymentsScreen.js';
import { BankRoutingScreen } from './screens/BankRoutingScreen.js';

type Tab = 'dashboard' | 'invoices' | 'shipments' | 'ledger' | 'payments' | 'bank';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isInitializing, setIsInitializing] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check initial network status
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    // Attempt automatic session restore
    const restoreSession = async () => {
      try {
        const token = await tokenStorage.getToken();
        if (token) {
          const user = await mobileApi.getMe();
          setCurrentUser(user);
        }
      } catch {
        await tokenStorage.removeToken();
      } finally {
        setIsInitializing(false);
      }
    };
    restoreSession();
  }, []);

  const handleLogout = async () => {
    await tokenStorage.removeToken();
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  if (isInitializing) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <div>Starting AQ Mobile Client...</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', backgroundColor: '#020617', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <LoginScreen onLoginSuccess={user => setCurrentUser(user)} />
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: 480,
      margin: '0 auto',
      minHeight: '100vh',
      backgroundColor: '#020617',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative',
      boxShadow: '0 0 40px rgba(0,0,0,0.8)'
    }}>
      {/* Network Alert Banner */}
      {!isOnline && (
        <div style={{ backgroundColor: '#dc2626', color: '#ffffff', padding: '6px 12px', fontSize: 12, textAlign: 'center', fontWeight: 600 }}>
          ⚠️ Offline Mode: Central backend unreachable. Queuing submissions.
        </div>
      )}

      {/* Mobile Top Bar */}
      <header style={{
        backgroundColor: '#0f172a',
        borderBottom: '1px solid #1e293b',
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🚢</span>
          <div>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', letterSpacing: 0.5 }}>AQ COMPANIES</span>
            <span style={{ display: 'block', fontSize: 10, color: '#10b981', fontWeight: 600 }}>● SECURE GATEWAY</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 12,
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            color: '#38bdf8',
            fontWeight: 700
          }}>
            {currentUser.roles?.[0] || 'USER'}
          </span>
          <button
            onClick={handleLogout}
            title="Log Out"
            style={{
              padding: '6px 10px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 6,
              color: '#f87171',
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Screen Content Scroll Area */}
      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        {activeTab === 'dashboard' && <DashboardScreen user={currentUser} onNavigate={tab => setActiveTab(tab as Tab)} />}
        {activeTab === 'invoices' && <InvoicesScreen user={currentUser} />}
        {activeTab === 'shipments' && <LogisticsScreen user={currentUser} />}
        {activeTab === 'ledger' && <LedgerScreen user={currentUser} />}
        {activeTab === 'payments' && <PaymentsScreen user={currentUser} />}
        {activeTab === 'bank' && <BankRoutingScreen user={currentUser} />}
      </main>

      {/* Bottom Thumb-Friendly Tab Bar */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        maxWidth: 480,
        margin: '0 auto',
        backgroundColor: '#0f172a',
        borderTop: '1px solid #1e293b',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '6px 0 10px',
        zIndex: 50
      }}>
        <button
          onClick={() => setActiveTab('dashboard')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'dashboard' ? '#38bdf8' : '#64748b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: 10,
            fontWeight: activeTab === 'dashboard' ? 700 : 500,
            cursor: 'pointer',
            padding: '4px 6px',
            minWidth: 44,
            minHeight: 44
          }}
        >
          <span style={{ fontSize: 18, marginBottom: 2 }}>🏠</span>
          <span>Home</span>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'invoices' ? '#38bdf8' : '#64748b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: 10,
            fontWeight: activeTab === 'invoices' ? 700 : 500,
            cursor: 'pointer',
            padding: '4px 6px',
            minWidth: 44,
            minHeight: 44
          }}
        >
          <span style={{ fontSize: 18, marginBottom: 2 }}>📄</span>
          <span>Invoices</span>
        </button>

        <button
          onClick={() => setActiveTab('shipments')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'shipments' ? '#38bdf8' : '#64748b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: 10,
            fontWeight: activeTab === 'shipments' ? 700 : 500,
            cursor: 'pointer',
            padding: '4px 6px',
            minWidth: 44,
            minHeight: 44
          }}
        >
          <span style={{ fontSize: 18, marginBottom: 2 }}>🚢</span>
          <span>Logistics</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'ledger' ? '#38bdf8' : '#64748b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: 10,
            fontWeight: activeTab === 'ledger' ? 700 : 500,
            cursor: 'pointer',
            padding: '4px 6px',
            minWidth: 44,
            minHeight: 44
          }}
        >
          <span style={{ fontSize: 18, marginBottom: 2 }}>📊</span>
          <span>Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'payments' ? '#38bdf8' : '#64748b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: 10,
            fontWeight: activeTab === 'payments' ? 700 : 500,
            cursor: 'pointer',
            padding: '4px 6px',
            minWidth: 44,
            minHeight: 44
          }}
        >
          <span style={{ fontSize: 18, marginBottom: 2 }}>💳</span>
          <span>Payments</span>
        </button>

        <button
          onClick={() => setActiveTab('bank')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'bank' ? '#38bdf8' : '#64748b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: 10,
            fontWeight: activeTab === 'bank' ? 700 : 500,
            cursor: 'pointer',
            padding: '4px 6px',
            minWidth: 44,
            minHeight: 44
          }}
        >
          <span style={{ fontSize: 18, marginBottom: 2 }}>🔒</span>
          <span>Bank</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
