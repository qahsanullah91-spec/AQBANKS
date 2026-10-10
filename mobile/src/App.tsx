import React, { useState, useEffect } from 'react';
import { User } from './types/index.js';
import { tokenStorage, mobileApi } from './services/api.js';
import { ThemeProvider, useTheme } from './theme/ThemeContext.js';
import { LoginScreen } from './screens/LoginScreen.js';
import { DashboardScreen } from './screens/DashboardScreen.js';
import { InvoicesScreen } from './screens/InvoicesScreen.js';
import { LogisticsScreen } from './screens/LogisticsScreen.js';
import { LedgerScreen } from './screens/LedgerScreen.js';
import { PaymentsScreen } from './screens/PaymentsScreen.js';
import { ReceiptsScreen } from './screens/ReceiptsScreen.js';
import { BankRoutingScreen } from './screens/BankRoutingScreen.js';

type Tab = 'dashboard' | 'invoices' | 'shipments' | 'ledger' | 'payments' | 'receipts' | 'bank';

const MobileMain: React.FC = () => {
  const { theme, colors, toggleTheme } = useTheme();
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
      <div style={{
        minHeight: '100vh',
        backgroundColor: colors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.textMuted,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48,
            height: 48,
            backgroundColor: '#020617',
            borderRadius: 12,
            margin: '0 auto 12px',
            padding: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img src="/logo.png" alt="AQ Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Starting AQ Mobile Client...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{
        maxWidth: 480,
        margin: '0 auto',
        minHeight: '100vh',
        backgroundColor: colors.bg,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <LoginScreen onLoginSuccess={user => setCurrentUser(user)} />
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: 480,
      margin: '0 auto',
      minHeight: '100vh',
      backgroundColor: colors.bg,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative',
      boxShadow: theme === 'light' ? '0 0 30px rgba(0,0,0,0.08)' : '0 0 40px rgba(0,0,0,0.8)'
    }}>
      {/* Network Alert Banner */}
      {!isOnline && (
        <div style={{ backgroundColor: colors.danger, color: '#ffffff', padding: '6px 12px', fontSize: 12, textAlign: 'center', fontWeight: 700 }}>
          ⚠️ Offline Mode: Central backend unreachable. Queuing submissions.
        </div>
      )}

      {/* Mobile Top Header */}
      <header style={{
        backgroundColor: colors.headerBg,
        borderBottom: `1px solid ${colors.headerBorder}`,
        padding: '10px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.04)' : 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34,
            height: 34,
            backgroundColor: '#020617',
            borderRadius: 8,
            padding: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
          }}>
            <img
              src="/logo.png"
              alt="AQ Companies Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <span style={{ fontSize: 13, fontWeight: 900, color: colors.text, letterSpacing: 0.5 }}>
              AQ COMPANIES
            </span>
            <span style={{ display: 'block', fontSize: 9, color: colors.accent, fontWeight: 700 }}>
              ● SECURE GATEWAY
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            style={{
              padding: '6px 8px',
              backgroundColor: colors.card,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 6,
              color: colors.text,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 36,
              minHeight: 36
            }}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          <span style={{
            fontSize: 10,
            padding: '3px 8px',
            borderRadius: 12,
            backgroundColor: colors.badgeBg,
            border: `1px solid ${colors.cardBorder}`,
            color: colors.primary,
            fontWeight: 800
          }}>
            {currentUser.roles?.[0] || 'USER'}
          </span>

          <button
            onClick={handleLogout}
            title="Log Out"
            style={{
              padding: '6px 10px',
              backgroundColor: colors.dangerBg,
              border: `1px solid ${colors.danger}`,
              borderRadius: 6,
              color: colors.danger,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              minHeight: 36
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Screen Content Scroll Area */}
      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 85 }}>
        {activeTab === 'dashboard' && <DashboardScreen user={currentUser} onNavigate={tab => setActiveTab(tab as Tab)} />}
        {activeTab === 'invoices' && <InvoicesScreen user={currentUser} />}
        {activeTab === 'shipments' && <LogisticsScreen user={currentUser} />}
        {activeTab === 'ledger' && <LedgerScreen user={currentUser} />}
        {activeTab === 'payments' && <PaymentsScreen user={currentUser} onNavigateToReceipts={() => setActiveTab('receipts')} />}
        {activeTab === 'receipts' && <ReceiptsScreen user={currentUser} />}
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
        backgroundColor: colors.navBg,
        borderTop: `1px solid ${colors.navBorder}`,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '4px 2px 8px',
        zIndex: 50,
        boxShadow: theme === 'light' ? '0 -2px 8px rgba(0,0,0,0.04)' : '0 -2px 12px rgba(0,0,0,0.4)'
      }}>
        <button
          onClick={() => setActiveTab('dashboard')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'dashboard' ? colors.primary : colors.textMuted,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: 9,
            fontWeight: activeTab === 'dashboard' ? 800 : 500,
            cursor: 'pointer',
            padding: '3px 2px',
            minWidth: 40,
            minHeight: 44
          }}
        >
          <span style={{ fontSize: 16, marginBottom: 2 }}>🏠</span>
          <span>Home</span>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'invoices' ? colors.primary : colors.textMuted,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: 9,
            fontWeight: activeTab === 'invoices' ? 800 : 500,
            cursor: 'pointer',
            padding: '3px 2px',
            minWidth: 40,
            minHeight: 44
          }}
        >
          <span style={{ fontSize: 16, marginBottom: 2 }}>📄</span>
          <span>Invoices</span>
        </button>

        <button
          onClick={() => setActiveTab('shipments')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'shipments' ? colors.primary : colors.textMuted,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: 9,
            fontWeight: activeTab === 'shipments' ? 800 : 500,
            cursor: 'pointer',
            padding: '3px 2px',
            minWidth: 40,
            minHeight: 44
          }}
        >
          <span style={{ fontSize: 16, marginBottom: 2 }}>🚢</span>
          <span>Freight</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'ledger' ? colors.primary : colors.textMuted,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: 9,
            fontWeight: activeTab === 'ledger' ? 800 : 500,
            cursor: 'pointer',
            padding: '3px 2px',
            minWidth: 40,
            minHeight: 44
          }}
        >
          <span style={{ fontSize: 16, marginBottom: 2 }}>📊</span>
          <span>Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'payments' ? colors.primary : colors.textMuted,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: 9,
            fontWeight: activeTab === 'payments' ? 800 : 500,
            cursor: 'pointer',
            padding: '3px 2px',
            minWidth: 40,
            minHeight: 44
          }}
        >
          <span style={{ fontSize: 16, marginBottom: 2 }}>💳</span>
          <span>Pay</span>
        </button>

        <button
          onClick={() => setActiveTab('receipts')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'receipts' ? colors.primary : colors.textMuted,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: 9,
            fontWeight: activeTab === 'receipts' ? 800 : 500,
            cursor: 'pointer',
            padding: '3px 2px',
            minWidth: 40,
            minHeight: 44
          }}
        >
          <span style={{ fontSize: 16, marginBottom: 2 }}>🧾</span>
          <span>Receipts</span>
        </button>

        <button
          onClick={() => setActiveTab('bank')}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'bank' ? colors.primary : colors.textMuted,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontSize: 9,
            fontWeight: activeTab === 'bank' ? 800 : 500,
            cursor: 'pointer',
            padding: '3px 2px',
            minWidth: 40,
            minHeight: 44
          }}
        >
          <span style={{ fontSize: 16, marginBottom: 2 }}>🔒</span>
          <span>Bank</span>
        </button>
      </nav>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <MobileMain />
    </ThemeProvider>
  );
};

export default App;
