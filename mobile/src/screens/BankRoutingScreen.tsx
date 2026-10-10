import React, { useEffect, useState } from 'react';
import { mobileApi } from '../services/api.js';
import { BankAccount, User } from '../types/index.js';
import { useTheme } from '../theme/ThemeContext.js';

interface BankRoutingScreenProps {
  user: User;
}

export const BankRoutingScreen: React.FC<BankRoutingScreenProps> = ({ user }) => {
  const { theme, colors } = useTheme();
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
    <div style={{ padding: 16, color: colors.text, backgroundColor: colors.bg, minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Verified Instructions</span>
          <h2 style={{ margin: 0, fontSize: 18, color: colors.text, fontWeight: 800 }}>Bank Wire Routing</h2>
        </div>
        <button
          onClick={fetchBankAccounts}
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

      {message && (
        <div style={{
          padding: 12,
          backgroundColor: message.type === 'success' ? colors.accentBg : colors.dangerBg,
          border: `1px solid ${message.type === 'success' ? colors.accent : colors.danger}`,
          borderRadius: 8,
          color: message.type === 'success' ? colors.accent : colors.danger,
          fontSize: 13,
          marginBottom: 12,
          fontWeight: 600
        }}>
          {message.text}
        </div>
      )}

      {/* Security Banner */}
      <div style={{ backgroundColor: colors.card, border: `1px solid ${colors.cardBorder}`, borderRadius: 8, padding: 12, marginBottom: 16, boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 14 }}>🔒</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: colors.primary }}>SOC-2 / PCI-DSS Masking Invariant</span>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: colors.textMuted, lineHeight: 1.4 }}>
          Bank account numbers are masked by default. Revealing unmasked numbers generates an immutable audit log timestamped with your user ID and IP address.
        </p>
      </div>

      {/* Account Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted }}>Loading banking instructions...</div>
      ) : accounts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted, backgroundColor: colors.card, border: `1px solid ${colors.cardBorder}`, borderRadius: 10 }}>
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
                  backgroundColor: colors.card,
                  border: isRevealed ? `1px solid ${colors.primary}` : `1px solid ${colors.cardBorder}`,
                  borderRadius: 10,
                  padding: 16,
                  boxShadow: isRevealed
                    ? (theme === 'light' ? '0 0 12px rgba(2, 132, 199, 0.2)' : '0 0 12px rgba(56, 189, 248, 0.2)')
                    : (theme === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none')
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 16, fontWeight: 800, color: colors.text }}>
                      {acc.bankName}
                    </span>
                    <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                      Currency: <strong style={{ color: colors.accent }}>{acc.currency}</strong>
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 12,
                    backgroundColor: isRevealed ? colors.primaryBg : colors.badgeBg,
                    color: isRevealed ? colors.primary : colors.textMuted,
                    border: `1px solid ${isRevealed ? colors.primary : colors.cardBorder}`
                  }}>
                    {isRevealed ? '🔓 REVEALED (AUDITED)' : '🔒 MASKED'}
                  </span>
                </div>

                {/* Beneficiary */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>Beneficiary Name:</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>
                    {acc.beneficiaryName}
                  </div>
                </div>

                {/* Account Number Field */}
                <div style={{ backgroundColor: colors.inputBg, border: `1px solid ${colors.cardBorder}`, padding: 12, borderRadius: 8, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: colors.textMuted }}>Account Number:</span>
                    {isRevealed && (
                      <span style={{ fontSize: 10, color: colors.warning, fontWeight: 600 }}>Auto-hides in 45s</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: 15,
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      color: isRevealed ? colors.accent : colors.text,
                      letterSpacing: isRevealed ? 1 : 2
                    }}>
                      {displayAccNum}
                    </span>
                    {isRevealed && (
                      <button
                        onClick={() => copyToClipboard(displayAccNum, acc.id)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: colors.card,
                          border: `1px solid ${colors.cardBorder}`,
                          borderRadius: 4,
                          color: copiedId === acc.id ? colors.accent : colors.primary,
                          fontSize: 11,
                          fontWeight: 600,
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
                  <div style={{ backgroundColor: colors.inputBg, border: `1px solid ${colors.cardBorder}`, padding: 8, borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: colors.textMuted }}>SWIFT / BIC</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: colors.primary, fontFamily: 'monospace' }}>
                      {acc.swiftCode}
                    </div>
                  </div>
                  {acc.correspondentSwift && (
                    <div style={{ backgroundColor: colors.inputBg, border: `1px solid ${colors.cardBorder}`, padding: 8, borderRadius: 6 }}>
                      <div style={{ fontSize: 10, color: colors.textMuted }}>Intermediary SWIFT</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: colors.warning, fontFamily: 'monospace' }}>
                        {acc.correspondentSwift}
                      </div>
                    </div>
                  )}
                </div>

                {acc.correspondentBank && (
                  <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 12 }}>
                    Intermediary Bank: <span style={{ color: colors.text }}>{acc.correspondentBank}</span>
                  </div>
                )}

                {/* Reveal Action Button */}
                {!isRevealed && canReveal && (
                  <button
                    onClick={() => setActiveRevealTarget(acc.id)}
                    style={{
                      width: '100%',
                      minHeight: 44,
                      backgroundColor: colors.card,
                      border: `1px solid ${colors.cardBorder}`,
                      borderRadius: 8,
                      color: colors.primary,
                      fontSize: 13,
                      fontWeight: 700,
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
            backgroundColor: colors.card,
            borderTop: `2px solid ${colors.primary}`,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: 20,
            color: colors.text
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, color: colors.text, fontWeight: 800 }}>
              Audited Reveal Authorization
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: colors.textMuted, lineHeight: 1.4 }}>
              Enter the business justification. Your user identity, device timestamp, and this justification will be permanently saved to the immutable audit trail.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: colors.textSecondary, fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
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
                  backgroundColor: colors.inputBg,
                  border: `1px solid ${colors.inputBorder}`,
                  color: colors.text,
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
                  backgroundColor: colors.card,
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: 8,
                  color: colors.textMuted,
                  fontSize: 13,
                  fontWeight: 600,
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
                  backgroundColor: colors.primary,
                  border: 'none',
                  borderRadius: 8,
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: revealing ? 'not-allowed' : 'pointer'
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
