import React, { useEffect, useState } from 'react';
import { mobileApi, mobileRequest } from '../services/api.js';
import { User, Receipt } from '../types/index.js';
import { useTheme } from '../theme/ThemeContext.js';

interface PaymentsScreenProps {
  user: User;
  onNavigateToReceipts?: () => void;
}

export const PaymentsScreen: React.FC<PaymentsScreenProps> = ({ user, onNavigateToReceipts }) => {
  const { theme, colors } = useTheme();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form state
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'INWARD_CREDIT' | 'OUTWARD_DEBIT'>('INWARD_CREDIT');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [description, setDescription] = useState('');

  // Generated receipt modal state
  const [generatedReceipt, setGeneratedReceipt] = useState<Receipt | null>(null);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await mobileRequest('/payments');
      setPayments(res.data || res);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load payments', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setMessage({ text: 'Please enter a valid payment amount.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      // Create payment using double-tap protected mobile API
      const res = await mobileApi.createPayment({
        amount: parseFloat(amount),
        currency: 'USD',
        paymentType: type,
        paymentDate: new Date(paymentDate).toISOString(),
        referenceNumber: referenceNumber || undefined,
        description: description || undefined
      });

      const receipt = res?.data?.receipt || res?.receipt;
      if (receipt) {
        setGeneratedReceipt(receipt);
        setMessage({
          text: `Payment recorded & Official Receipt ${receipt.receiptNumber} automatically generated!`,
          type: 'success'
        });
      } else {
        setMessage({ text: 'Payment successfully recorded with idempotency protection.', type: 'success' });
      }

      setAmount('');
      setReferenceNumber('');
      setDescription('');
      setShowAddForm(false);
      await fetchPayments();
    } catch (err: any) {
      setMessage({ text: err.message || 'Payment submission failed', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenReceiptForPayment = async (paymentId: string) => {
    try {
      const res = await mobileApi.getReceipts();
      const list = res.data || res;
      const found = (Array.isArray(list) ? list : []).find((r: Receipt) => r.paymentId === paymentId);
      if (found) {
        setGeneratedReceipt(found);
      } else {
        setMessage({ text: 'No receipt found for this payment transaction.', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: 'Unable to retrieve receipt: ' + err.message, type: 'error' });
    }
  };

  const canCreate = user.roles?.includes('ADMIN') || user.roles?.includes('FINANCE');

  return (
    <div style={{ padding: 16, color: colors.text, backgroundColor: colors.bg, minHeight: '100%' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>
            Treasury & Remittances
          </span>
          <h2 style={{ margin: 0, fontSize: 18, color: colors.text, fontWeight: 800 }}>
            Payments
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {canCreate && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              style={{
                padding: '8px 12px',
                backgroundColor: showAddForm ? colors.card : colors.accent,
                border: showAddForm ? `1px solid ${colors.cardBorder}` : 'none',
                borderRadius: 8,
                color: showAddForm ? colors.text : '#ffffff',
                fontSize: 12,
                fontWeight: 600,
                minHeight: 40,
                cursor: 'pointer'
              }}
            >
              {showAddForm ? '✕ Cancel' : '+ Record'}
            </button>
          )}
          <button
            onClick={fetchPayments}
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
            🔄
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          padding: 12,
          backgroundColor: message.type === 'success' ? colors.accentBg : colors.dangerBg,
          border: `1px solid ${message.type === 'success' ? colors.accent : colors.danger}`,
          borderRadius: 8,
          color: message.type === 'success' ? colors.accent : colors.danger,
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 12
        }}>
          {message.text}
        </div>
      )}

      {/* Payment Entry Form */}
      {showAddForm && (
        <form onSubmit={handleSubmitPayment} style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          boxShadow: theme === 'light' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: colors.text, fontWeight: 700 }}>
            Record Financial Remittance
          </h3>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', color: colors.textMuted, fontSize: 11, marginBottom: 4, fontWeight: 600 }}>
              Remittance Type
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setType('INWARD_CREDIT')}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  minHeight: 44,
                  backgroundColor: type === 'INWARD_CREDIT' ? colors.accent : colors.inputBg,
                  border: `1px solid ${type === 'INWARD_CREDIT' ? colors.accent : colors.inputBorder}`,
                  borderRadius: 6,
                  color: type === 'INWARD_CREDIT' ? '#ffffff' : colors.textMuted,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                📥 Inward Credit (Auto-Receipt)
              </button>
              <button
                type="button"
                onClick={() => setType('OUTWARD_DEBIT')}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  minHeight: 44,
                  backgroundColor: type === 'OUTWARD_DEBIT' ? colors.danger : colors.inputBg,
                  border: `1px solid ${type === 'OUTWARD_DEBIT' ? colors.danger : colors.inputBorder}`,
                  borderRadius: 6,
                  color: type === 'OUTWARD_DEBIT' ? '#ffffff' : colors.textMuted,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                📤 Outward Debit
              </button>
            </div>
            {type === 'INWARD_CREDIT' && (
              <span style={{ display: 'block', fontSize: 10, color: colors.accent, marginTop: 4, fontWeight: 600 }}>
                ✓ An official numbered receipt (RCP-YYYY-XXXX) will be generated automatically.
              </span>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', color: colors.textMuted, fontSize: 11, marginBottom: 4, fontWeight: 600 }}>
              Amount (USD)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                minHeight: 44,
                borderRadius: 6,
                backgroundColor: colors.inputBg,
                border: `1px solid ${colors.inputBorder}`,
                color: colors.text,
                fontSize: 14,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', color: colors.textMuted, fontSize: 11, marginBottom: 4, fontWeight: 600 }}>
              Effective Date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                minHeight: 44,
                borderRadius: 6,
                backgroundColor: colors.inputBg,
                border: `1px solid ${colors.inputBorder}`,
                color: colors.text,
                fontSize: 14,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', color: colors.textMuted, fontSize: 11, marginBottom: 4, fontWeight: 600 }}>
              Bank Ref / Wire Number
            </label>
            <input
              type="text"
              placeholder="e.g. WIRE-2026-99182"
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                minHeight: 44,
                borderRadius: 6,
                backgroundColor: colors.inputBg,
                border: `1px solid ${colors.inputBorder}`,
                color: colors.text,
                fontSize: 14,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: colors.textMuted, fontSize: 11, marginBottom: 4, fontWeight: 600 }}>
              Description / Payee
            </label>
            <input
              type="text"
              placeholder="e.g. Inward deposit for shipment clearance"
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                minHeight: 44,
                borderRadius: 6,
                backgroundColor: colors.inputBg,
                border: `1px solid ${colors.inputBorder}`,
                color: colors.text,
                fontSize: 14,
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              minHeight: 48,
              backgroundColor: colors.accent,
              border: 'none',
              borderRadius: 8,
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Verifying & Posting...' : '🔒 Submit Payment (Idempotent)'}
          </button>
        </form>
      )}

      {/* Payment List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted, fontSize: 13 }}>
          Loading remittances...
        </div>
      ) : payments.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 32,
          color: colors.textMuted,
          backgroundColor: colors.card,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 12
        }}>
          No recorded payments found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {payments.map(p => {
            const isCredit = p.paymentType === 'INWARD_CREDIT';
            return (
              <div
                key={p.id}
                style={{
                  backgroundColor: colors.card,
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: 10,
                  padding: 12,
                  boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 11, color: colors.textMuted }}>
                      {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : 'N/A'}
                    </span>
                    {p.referenceNumber && (
                      <span style={{ fontSize: 11, color: colors.primary, marginLeft: 6, fontFamily: 'monospace', fontWeight: 600 }}>
                        #{p.referenceNumber}
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    backgroundColor: isCredit ? colors.accentBg : colors.dangerBg,
                    color: isCredit ? colors.accent : colors.danger,
                    border: `1px solid ${isCredit ? colors.accent : colors.danger}`
                  }}>
                    {isCredit ? 'CREDIT' : 'DEBIT'}
                  </span>
                </div>

                <div style={{ fontSize: 13, color: colors.text, fontWeight: 600, marginBottom: 8 }}>
                  {p.description || (isCredit ? 'Inward Wire Transfer' : 'Disbursement Payment')}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: `1px solid ${colors.divider}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 11, color: colors.textMuted }}>
                      Status: <strong style={{ color: colors.text }}>{p.status || 'COMPLETED'}</strong>
                    </div>
                    {isCredit && (
                      <button
                        onClick={() => handleOpenReceiptForPayment(p.id)}
                        style={{
                          padding: '3px 8px',
                          backgroundColor: colors.badgeBg,
                          border: `1px solid ${colors.cardBorder}`,
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          color: colors.primary,
                          cursor: 'pointer'
                        }}
                      >
                        🧾 Receipt
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: isCredit ? colors.accent : colors.danger }}>
                    {isCredit ? '+' : '-'} ${Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Auto-Generated Receipt Popup Modal */}
      {generatedReceipt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 16
        }}>
          <div style={{
            backgroundColor: colors.card,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 14,
            width: '100%',
            maxWidth: 440,
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 20,
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            color: colors.text
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>🎉</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: colors.accent }}>
                    Receipt Automatically Generated
                  </div>
                  <div style={{ fontSize: 10, color: colors.textMuted }}>
                    Official proof created atomically with deposit
                  </div>
                </div>
              </div>
              <button
                onClick={() => setGeneratedReceipt(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: colors.textMuted }}
              >
                ✕
              </button>
            </div>

            <div style={{
              backgroundColor: theme === 'light' ? '#f1f5f9' : '#020617',
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 10,
              padding: 14,
              marginBottom: 16
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: colors.primary }}>
                  {generatedReceipt.receiptNumber}
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 10,
                  backgroundColor: colors.accentBg,
                  color: colors.accent
                }}>
                  {generatedReceipt.status}
                </span>
              </div>

              <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8 }}>
                Date: {new Date(generatedReceipt.issuedAt).toLocaleString()}
              </div>

              <div style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase' }}>Received From</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: colors.text, marginBottom: 8 }}>
                {generatedReceipt.receivedFrom}
              </div>

              <div style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase' }}>Amount</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: colors.accent, marginBottom: 8 }}>
                ${Number(generatedReceipt.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {generatedReceipt.currency}
              </div>

              <div style={{ backgroundColor: colors.card, padding: 8, borderRadius: 6, border: `1px solid ${colors.cardBorder}`, marginBottom: 8 }}>
                <div style={{ fontSize: 9, color: colors.textMuted, textTransform: 'uppercase' }}>Amount in Words</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: colors.primary, fontStyle: 'italic' }}>
                  "{generatedReceipt.amountInWords}"
                </div>
              </div>

              <div style={{ fontSize: 11, color: colors.textMuted }}>
                Account: {generatedReceipt.bankAccountMasked || '101502******0472'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') window.print();
                }}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  backgroundColor: colors.primary,
                  border: 'none',
                  borderRadius: 8,
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  minHeight: 44
                }}
              >
                🖨️ Print / Share
              </button>

              {onNavigateToReceipts && (
                <button
                  onClick={() => {
                    setGeneratedReceipt(null);
                    onNavigateToReceipts();
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    backgroundColor: colors.card,
                    border: `1px solid ${colors.cardBorder}`,
                    borderRadius: 8,
                    color: colors.text,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    minHeight: 44
                  }}
                >
                  View in Receipts Tab ➜
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
