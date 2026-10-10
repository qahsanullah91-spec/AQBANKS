import React, { useEffect, useState } from 'react';
import { mobileApi } from '../services/api.js';
import { Invoice, User } from '../types/index.js';
import { useTheme } from '../theme/ThemeContext.js';

interface InvoicesScreenProps {
  user: User;
}

export const InvoicesScreen: React.FC<InvoicesScreenProps> = ({ user }) => {
  const { theme, colors } = useTheme();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await mobileApi.getInvoices();
      setInvoices(res.data || res);
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load invoices', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleIssue = async (invoiceId: string) => {
    setActionLoading(true);
    setMessage(null);
    try {
      await mobileApi.issueInvoice(invoiceId);
      setMessage({ text: 'Invoice successfully issued and locked.', type: 'success' });
      await fetchInvoices();
      if (selectedInvoice && selectedInvoice.id === invoiceId) {
        setSelectedInvoice({ ...selectedInvoice, status: 'ISSUED' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to issue invoice', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const openInvoiceDetails = async (inv: Invoice) => {
    try {
      const full = await mobileApi.getInvoice(inv.id);
      setSelectedInvoice(full);
    } catch {
      setSelectedInvoice(inv);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const q = search.toLowerCase();
    const invNum = (inv.sourceInvoiceRef || inv.invoiceNumber || '').toLowerCase();
    const cust = (inv.customer?.companyName || '').toLowerCase();
    return invNum.includes(q) || cust.includes(q);
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ISSUED':
      case 'PAID':
        return { bg: colors.accentBg, text: colors.accent, border: colors.accent };
      case 'PARTIALLY_PAID':
        return { bg: colors.warningBg, text: colors.warning, border: colors.warning };
      case 'OVERDUE':
      case 'VOID':
        return { bg: colors.dangerBg, text: colors.danger, border: colors.danger };
      default:
        return { bg: colors.badgeBg, text: colors.textMuted, border: colors.cardBorder };
    }
  };

  return (
    <div style={{ padding: 16, color: colors.text, backgroundColor: colors.bg, minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Commercial Billing</span>
          <h2 style={{ margin: 0, fontSize: 18, color: colors.text, fontWeight: 800 }}>Invoices & Proformas</h2>
        </div>
        <button
          onClick={fetchInvoices}
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

      {/* Search Bar */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search by invoice number or customer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
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

      {/* Invoices List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted }}>Loading invoices...</div>
      ) : filteredInvoices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted, backgroundColor: colors.card, border: `1px solid ${colors.cardBorder}`, borderRadius: 10 }}>
          No invoices found matching criteria.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredInvoices.map(inv => {
            const statusStyle = getStatusColor(inv.paymentStatus || inv.status);
            return (
              <div
                key={inv.id}
                onClick={() => openInvoiceDetails(inv)}
                style={{
                  backgroundColor: colors.card,
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: 10,
                  padding: 14,
                  cursor: 'pointer',
                  boxShadow: theme === 'light' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>
                      {inv.sourceInvoiceRef || inv.invoiceNumber}
                    </span>
                    <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                      {inv.customer?.companyName || 'General Account'}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 12,
                    backgroundColor: statusStyle.bg,
                    color: statusStyle.text,
                    border: `1px solid ${statusStyle.border}`
                  }}>
                    {inv.paymentStatus || inv.status}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${colors.divider}` }}>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>
                    Date: {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : 'N/A'}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: colors.primary }}>
                    ${Number(inv.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invoice Details Bottom Sheet / Modal */}
      {selectedInvoice && (
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
            maxHeight: '85vh',
            overflowY: 'auto',
            padding: 20,
            color: colors.text
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase' }}>Proforma Invoice</span>
                <h3 style={{ margin: 0, fontSize: 18, color: colors.text, fontWeight: 800 }}>
                  {selectedInvoice.sourceInvoiceRef || selectedInvoice.invoiceNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: colors.card,
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: 6,
                  color: colors.text,
                  minHeight: 36,
                  cursor: 'pointer'
                }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ marginBottom: 16, backgroundColor: colors.inputBg, padding: 12, borderRadius: 8, border: `1px solid ${colors.cardBorder}` }}>
              <div style={{ fontSize: 12, color: colors.textMuted }}>Client:</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginBottom: 6 }}>
                {selectedInvoice.customer?.companyName || 'General Account'}
              </div>
              <div style={{ fontSize: 12, color: colors.textMuted }}>Payment Terms:</div>
              <div style={{ fontSize: 13, color: colors.textSecondary }}>{selectedInvoice.paymentTerms || 'Standard'}</div>
            </div>

            {/* Line Items */}
            {selectedInvoice.lines && selectedInvoice.lines.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase' }}>
                  Line Items
                </div>
                {selectedInvoice.lines.map((line: any, idx: number) => (
                  <div key={idx} style={{
                    padding: '8px 10px',
                    backgroundColor: colors.inputBg,
                    border: `1px solid ${colors.cardBorder}`,
                    borderRadius: 6,
                    marginBottom: 6,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: 13, color: colors.text, fontWeight: 600 }}>{line.description}</div>
                      <div style={{ fontSize: 11, color: colors.textMuted }}>
                        Qty: {line.quantity} × ${Number(line.unitPrice).toFixed(2)}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: colors.primary }}>
                      ${Number(line.totalAmount).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 12,
              backgroundColor: colors.inputBg,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 8,
              marginBottom: 20
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: colors.textSecondary }}>Total Calculated:</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: colors.accent }}>
                ${Number(selectedInvoice.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selectedInvoice.status === 'DRAFT' && (user.roles?.includes('ADMIN') || user.roles?.includes('FINANCE')) && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleIssue(selectedInvoice.id)}
                  style={{
                    width: '100%',
                    minHeight: 48,
                    backgroundColor: colors.accent,
                    border: 'none',
                    borderRadius: 8,
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {actionLoading ? 'Issuing...' : '🔒 Issue & Lock Invoice'}
                </button>
              )}
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') window.print();
                }}
                style={{
                  width: '100%',
                  minHeight: 44,
                  backgroundColor: colors.card,
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: 8,
                  color: colors.primary,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                📄 View / Share Proforma Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
