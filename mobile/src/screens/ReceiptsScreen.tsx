import React, { useEffect, useState } from 'react';
import { mobileApi } from '../services/api.js';
import { User, Receipt } from '../types/index.js';
import { useTheme } from '../theme/ThemeContext.js';

interface ReceiptsScreenProps {
  user: User;
  initialReceiptId?: string | null;
  onClearInitialReceipt?: () => void;
}

export const ReceiptsScreen: React.FC<ReceiptsScreenProps> = ({
  user,
  initialReceiptId,
  onClearInitialReceipt
}) => {
  const { theme, colors } = useTheme();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ISSUED' | 'VOID'>('ALL');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const res = await mobileApi.getReceipts({ search: search || undefined });
      const list = res.data || res;
      setReceipts(Array.isArray(list) ? list : []);

      if (initialReceiptId) {
        const found = (Array.isArray(list) ? list : []).find((r: Receipt) => r.id === initialReceiptId || r.receiptNumber === initialReceiptId);
        if (found) {
          setSelectedReceipt(found);
          onClearInitialReceipt?.();
        }
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load receipts', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [search]);

  const filteredReceipts = receipts.filter(r => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.receiptNumber.toLowerCase().includes(q) ||
        r.receivedFrom.toLowerCase().includes(q) ||
        (r.referenceNumber && r.referenceNumber.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalAmount = receipts
    .filter(r => r.status === 'ISSUED')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const handleVoidReceipt = async () => {
    if (!selectedReceipt) return;
    if (!voidReason.trim()) {
      setMessage({ text: 'Please enter a justification reason for voiding.', type: 'error' });
      return;
    }

    setVoiding(true);
    try {
      await mobileApi.voidReceipt(selectedReceipt.id, voidReason.trim());
      setMessage({ text: `Receipt ${selectedReceipt.receiptNumber} successfully voided.`, type: 'success' });
      setShowVoidModal(false);
      setVoidReason('');
      setSelectedReceipt(null);
      await fetchReceipts();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to void receipt', type: 'error' });
    } finally {
      setVoiding(false);
    }
  };

  const canVoid = user.roles?.includes('ADMIN') || user.roles?.includes('FINANCE');

  return (
    <div style={{ padding: 16, color: colors.text, backgroundColor: colors.bg, minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>
            Automated Audit Proofs
          </span>
          <h2 style={{ margin: 0, fontSize: 18, color: colors.text, fontWeight: 800 }}>
            Official Receipts
          </h2>
        </div>
        <button
          onClick={fetchReceipts}
          style={{
            padding: '6px 12px',
            backgroundColor: colors.card,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 8,
            color: colors.primary,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: 40
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Alert Banner */}
      {message && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          marginBottom: 14,
          fontSize: 12,
          fontWeight: 600,
          backgroundColor: message.type === 'success' ? colors.accentBg : colors.dangerBg,
          color: message.type === 'success' ? colors.accent : colors.danger,
          border: `1px solid ${message.type === 'success' ? colors.accent : colors.danger}`
        }}>
          {message.text}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        <div style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 10,
          padding: 10,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase' }}>Issued Total</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.accent, marginTop: 2 }}>
            ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 10,
          padding: 10,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase' }}>Count</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.primary, marginTop: 2 }}>
            {receipts.filter(r => r.status === 'ISSUED').length}
          </div>
        </div>

        <div style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 10,
          padding: 10,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase' }}>Voided</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.danger, marginTop: 2 }}>
            {receipts.filter(r => r.status === 'VOID').length}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="🔍 Search receipt #, payer, reference..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 14px',
            backgroundColor: colors.inputBg,
            border: `1px solid ${colors.inputBorder}`,
            borderRadius: 8,
            color: colors.text,
            fontSize: 13,
            outline: 'none',
            minHeight: 44
          }}
        />
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['ALL', 'ISSUED', 'VOID'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              border: `1px solid ${statusFilter === tab ? colors.primary : colors.cardBorder}`,
              backgroundColor: statusFilter === tab ? (theme === 'light' ? '#e0f2fe' : '#0369a1') : colors.card,
              color: statusFilter === tab ? (theme === 'light' ? '#0369a1' : '#ffffff') : colors.textMuted,
              minHeight: 36
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Receipt Cards List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: colors.textMuted, fontSize: 13 }}>
          Loading official receipts...
        </div>
      ) : filteredReceipts.length === 0 ? (
        <div style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: 12,
          padding: 30,
          textAlign: 'center',
          color: colors.textMuted
        }}>
          <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>🧾</span>
          <div style={{ fontSize: 13, fontWeight: 600 }}>No receipts found</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>
            Receipts are automatically generated whenever incoming funds are deposited.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredReceipts.map(r => (
            <div
              key={r.id}
              onClick={() => setSelectedReceipt(r)}
              style={{
                backgroundColor: colors.card,
                border: `1px solid ${colors.cardBorder}`,
                borderRadius: 10,
                padding: 12,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  fontWeight: 800,
                  color: colors.primary,
                  backgroundColor: colors.badgeBg,
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: `1px solid ${colors.cardBorder}`
                }}>
                  {r.receiptNumber}
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 10,
                  backgroundColor: r.status === 'ISSUED' ? colors.accentBg : colors.dangerBg,
                  color: r.status === 'ISSUED' ? colors.accent : colors.danger,
                  border: `1px solid ${r.status === 'ISSUED' ? colors.accent : colors.danger}`
                }}>
                  {r.status}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>
                    {r.receivedFrom}
                  </div>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                    {new Date(r.issuedAt).toLocaleDateString()} • {r.paymentMethod}
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: r.status === 'ISSUED' ? colors.accent : colors.danger }}>
                  ${Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: `1px solid ${colors.divider}`, fontSize: 10, color: colors.textMuted }}>
                <span>Account: {r.bankAccountMasked || '101502******0472'}</span>
                <span style={{ color: colors.primary, fontWeight: 600 }}>Tap to view ➜</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Official Receipt Modal */}
      {selectedReceipt && (
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
            {/* Modal Header with Logo */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  backgroundColor: '#020617',
                  borderRadius: 8,
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  <img
                    src="/logo.png"
                    alt="AQ Logo"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: colors.text, letterSpacing: 0.5 }}>
                    AQ COMPANIES
                  </div>
                  <div style={{ fontSize: 10, color: colors.textMuted, fontWeight: 600 }}>
                    TREASURY & DEPOSIT RECEIPT
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: colors.textMuted,
                  padding: 4
                }}
              >
                ✕
              </button>
            </div>

            {/* Official Receipt Box */}
            <div style={{
              backgroundColor: theme === 'light' ? '#f1f5f9' : '#020617',
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 10,
              padding: 14,
              marginBottom: 16
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'monospace', color: colors.primary }}>
                  {selectedReceipt.receiptNumber}
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 10,
                  backgroundColor: selectedReceipt.status === 'ISSUED' ? colors.accentBg : colors.dangerBg,
                  color: selectedReceipt.status === 'ISSUED' ? colors.accent : colors.danger
                }}>
                  {selectedReceipt.status}
                </span>
              </div>

              <div style={{ fontSize: 11, color: colors.textMuted }}>
                Date: {new Date(selectedReceipt.issuedAt).toLocaleString()}
              </div>

              <div style={{ marginTop: 12, borderTop: `1px dashed ${colors.cardBorder}`, paddingTop: 10 }}>
                <div style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase' }}>Received From</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: colors.text, marginTop: 2 }}>
                  {selectedReceipt.receivedFrom}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase' }}>Amount Received</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: colors.accent, marginTop: 2 }}>
                  ${Number(selectedReceipt.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {selectedReceipt.currency}
                </div>
              </div>

              <div style={{ marginTop: 10, backgroundColor: colors.card, padding: 8, borderRadius: 6, border: `1px solid ${colors.cardBorder}` }}>
                <div style={{ fontSize: 9, color: colors.textMuted, textTransform: 'uppercase' }}>Amount in Words</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: colors.primary, marginTop: 2, fontStyle: 'italic' }}>
                  "{selectedReceipt.amountInWords}"
                </div>
              </div>

              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
                <div>
                  <span style={{ color: colors.textMuted }}>Method:</span> {selectedReceipt.paymentMethod}
                </div>
                <div>
                  <span style={{ color: colors.textMuted }}>Ref:</span> {selectedReceipt.referenceNumber || 'N/A'}
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: colors.textMuted }}>Target Account:</span> {selectedReceipt.bankAccountMasked || '101502******0472'}
                </div>
              </div>

              {selectedReceipt.purpose && (
                <div style={{ marginTop: 10, fontSize: 11 }}>
                  <span style={{ color: colors.textMuted }}>Purpose / Reference:</span> {selectedReceipt.purpose}
                </div>
              )}

              {selectedReceipt.status === 'VOID' && (
                <div style={{
                  marginTop: 12,
                  padding: 8,
                  backgroundColor: colors.dangerBg,
                  borderRadius: 6,
                  border: `1px solid ${colors.danger}`,
                  color: colors.danger,
                  fontSize: 11
                }}>
                  ⚠️ <strong>VOIDED:</strong> {selectedReceipt.voidReason || 'No reason specified'}
                  <div style={{ fontSize: 9, marginTop: 2 }}>Voided at: {selectedReceipt.voidedAt ? new Date(selectedReceipt.voidedAt).toLocaleString() : 'N/A'}</div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
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

              {canVoid && selectedReceipt.status === 'ISSUED' && (
                <button
                  onClick={() => setShowVoidModal(true)}
                  style={{
                    padding: '10px 14px',
                    backgroundColor: colors.dangerBg,
                    border: `1px solid ${colors.danger}`,
                    borderRadius: 8,
                    color: colors.danger,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    minHeight: 44
                  }}
                >
                  Void Receipt
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Audited Void Confirmation Modal */}
      {showVoidModal && selectedReceipt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 110,
          padding: 16
        }}>
          <div style={{
            backgroundColor: colors.card,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 14,
            width: '100%',
            maxWidth: 400,
            padding: 20,
            color: colors.text
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, color: colors.danger }}>
              Confirm Void Receipt
            </h3>
            <p style={{ fontSize: 12, color: colors.textMuted, margin: '0 0 14px' }}>
              Voiding receipt <strong>{selectedReceipt.receiptNumber}</strong> is permanent and logged in the security audit trail.
            </p>

            <textarea
              placeholder="Mandatory reason for voiding this receipt..."
              value={voidReason}
              onChange={e => setVoidReason(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px',
                backgroundColor: colors.inputBg,
                border: `1px solid ${colors.inputBorder}`,
                borderRadius: 8,
                color: colors.text,
                fontSize: 12,
                outline: 'none',
                marginBottom: 14
              }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setShowVoidModal(false);
                  setVoidReason('');
                }}
                disabled={voiding}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: colors.card,
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: 8,
                  color: colors.textMuted,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: 44
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleVoidReceipt}
                disabled={voiding || !voidReason.trim()}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: colors.danger,
                  border: 'none',
                  borderRadius: 8,
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: voiding || !voidReason.trim() ? 'not-allowed' : 'pointer',
                  opacity: voiding || !voidReason.trim() ? 0.6 : 1,
                  minHeight: 44
                }}
              >
                {voiding ? 'Voiding...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
