import React, { useEffect, useState } from 'react';
import { mobileApi } from '../services/api.js';
import { BankAccount, User } from '../types/index.js';

interface BankRoutingScreenProps {
  user: User;
}

export const BankRoutingScreen: React.FC<BankRoutingScreenProps> = ({ user }) => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedAccounts, setRevealedAccounts] = useState<Record<string, string>>({});
  const [activeRevealTarget, setActiveRevealTarget] = useState<string | null>(null);
  const [revealReason, setRevealReason] = useState('Wire verification with beneficiary bank');
  const [revealing, setRevealing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchBankAccounts = async () => {
    setLoading(true);
    try {
      const res = await mobileApi.getBankAccounts();
      setAccounts(res.data || res);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load banking details', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  const handleReveal = async () => {
    if (!activeRevealTarget) return;
    if (!revealReason.trim()) {
      setMessage({ text: 'A business audit reason is mandatory to reveal full banking details.', type: 'error' });
      return;
    }

    setRevealing(true);
    setMessage(null);
    try {
      const res = await mobileApi.revealBankAccount(activeRevealTarget, revealReason);
      setRevealedAccounts(prev => ({
        ...prev,
        [activeRevealTarget]: res.accountNumber || res.unmaskedAccountNumber
      }));
      setMessage({ text: 'Account number revealed and logged to the central security audit ledger.', type: 'success' });
      setActiveRevealTarget(null);

      // Auto-hide after 45 seconds for mobile security
      setTimeout(() => {
        setRevealedAccounts(prev => {
          const updated = { ...prev };
          delete updated[activeRevealTarget];
          return updated;
        });
      }, 45000);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to reveal bank account. Access denied.', type: 'error' });
    } finally {
      setRevealing(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const canReveal = user.roles?.includes('ADMIN') || user.roles?.includes('FINANCE') || user.roles?.includes('AUDITOR');

  return (
    <div style={{ padding: 16, color: '#f8fafc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase' }}>Verified Instructions</span>
          <h2 style={{ margin: 0, fontSize: 18, color: '#ffffff', fontWeight: 700 }}>Bank Wire Routing</h2>
        </div>
        <button
          onClick={fetchBankAccounts}
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

      {message && (
        <div style={{
          padding: 12,
          backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
          borderRadius: 8,
          color: message.type === 'success' ? '#6ee7b7' : '#fca5a5',
          fontSize: 13,
          marginBottom: 12
        }}>
          {message.text}
        </div>
      )}

      {/* Security Banner */}
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 14 }}>🔒</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>SOC-2 / PCI-DSS Masking Invariant</span>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
          Bank account numbers are masked by default. Revealing unmasked numbers generates an immutable audit log timestamped with your user ID and IP address.
        </p>
      </div>

      {/* Account Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>Loading banking instructions...</div>
      ) : accounts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#64748b', backgroundColor: '#0f172a', borderRadius: 8 }}>
          No bank accounts configured.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {accounts.map(acc => {
            const isRevealed = !!revealedAccounts[acc.id];
            const displayAccNum = isRevealed ? revealedAccounts[acc.id] : acc.accountNumberMasked;

            return (
              <div
                key={acc.id}
                style={{
                  backgroundColor: '#0f172a',
                  border: isRevealed ? '1px solid #38bdf8' : '1px solid #1e293b',
                  borderRadius: 10,
                  padding: 16,
                  boxShadow: isRevealed ? '0 0 12px rgba(56, 189, 248, 0.2)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
                      {acc.bankName}
                    </span>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                      Currency: <strong style={{ color: '#34d399' }}>{acc.currency}</strong>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 12,
                    backgroundColor: isRevealed ? 'rgba(56, 189, 248, 0.2)' : 'rgba(148, 163, 184, 0.1)',
                    color: isRevealed ? '#38bdf8' : '#94a3b8',
                    border: `1px solid ${isRevealed ? '#0284c7' : '#334155'}`
                  }}>
                    {isRevealed ? '🔓 REVEALED (AUDITED)' : '🔒 MASKED'}
                  </span>
                </div>

                {/* Beneficiary */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Beneficiary Name:</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>
                    {acc.beneficiaryName}
                  </div>
                </div>

                {/* Account Number Field */}
                <div style={{ backgroundColor: '#020617', padding: 12, borderRadius: 8, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Account Number:</span>
                    {isRevealed && (
                      <span style={{ fontSize: 10, color: '#fbbf24' }}>Auto-hides in 45s</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: 15,
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      color: isRevealed ? '#34d399' : '#e2e8f0',
                      letterSpacing: isRevealed ? 1 : 2
                    }}>
                      {displayAccNum}
                    </span>
                    {isRevealed && (
                      <button
                        onClick={() => copyToClipboard(displayAccNum, acc.id)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: 4,
                          color: copiedId === acc.id ? '#34d399' : '#38bdf8',
                          fontSize: 11,
                          cursor: 'pointer'
                        }}
                      >
                        {copiedId === acc.id ? '✓ Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                </div>

                {/* SWIFT & Intermediary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div style={{ backgroundColor: '#020617', padding: 8, borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: '#64748b' }}>SWIFT / BIC</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
                      {acc.swiftCode}
                    </div>
                  </div>
                  {acc.correspondentSwift && (
                    <div style={{ backgroundColor: '#020617', padding: 8, borderRadius: 6 }}>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Intermediary SWIFT</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', fontFamily: 'monospace' }}>
                        {acc.correspondentSwift}
                      </div>
                    </div>
                  )}
                </div>

                {acc.correspondentBank && (
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
                    Intermediary Bank: <span style={{ color: '#cbd5e1' }}>{acc.correspondentBank}</span>
                  </div>
                )}

                {/* Reveal Action Button */}
                {!isRevealed && canReveal && (
                  <button
                    onClick={() => setActiveRevealTarget(acc.id)}
                    style={{
                      width: '100%',
                      minHeight: 44,
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      color: '#38bdf8',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    👁️ Reveal Full Account Number (Audited)
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Audited Reason Dialog */}
      {activeRevealTarget && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          zIndex: 100
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            borderTop: '2px solid #334155',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: 20
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#ffffff' }}>
              Audited Reveal Authorization
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
              Enter the business justification. Your user identity, device timestamp, and this justification will be permanently saved to the immutable audit trail.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginBottom: 6 }}>
                Business Reason / Purpose:
              </label>
              <input
                type="text"
                value={revealReason}
                onChange={e => setRevealReason(e.target.value)}
                placeholder="e.g. Beneficiary wire verification"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  minHeight: 44,
                  borderRadius: 8,
                  backgroundColor: '#020617',
                  border: '1px solid #334155',
                  color: '#ffffff',
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setActiveRevealTarget(null)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  color: '#cbd5e1',
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={revealing}
                onClick={handleReveal}
                style={{
                  flex: 2,
                  minHeight: 44,
                  backgroundColor: '#0284c7',
                  border: 'none',
                  borderRadius: 8,
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {revealing ? 'Authenticating & Logging...' : 'Authorize & Reveal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
