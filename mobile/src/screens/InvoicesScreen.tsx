import React, { useEffect, useState } from 'react';
import { mobileApi } from '../services/api.js';
import { Invoice, User } from '../types/index.js';

interface InvoicesScreenProps {
  user: User;
}

export const InvoicesScreen: React.FC<InvoicesScreenProps> = ({ user }) => {
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
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: '#059669' };
      case 'PARTIALLY_PAID':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: '#d97706' };
      case 'OVERDUE':
      case 'VOID':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: '#dc2626' };
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: '#475569' };
    }
  };

  return (
    <div style={{ padding: 16, color: '#f8fafc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase' }}>Commercial Billing</span>
          <h2 style={{ margin: 0, fontSize: 18, color: '#ffffff', fontWeight: 700 }}>Invoices & Proformas</h2>
        </div>
        <button
          onClick={fetchInvoices}
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
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            color: '#ffffff',
            fontSize: 14,
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Invoices List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>Loading invoices...</div>
      ) : filteredInvoices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#64748b', backgroundColor: '#0f172a', borderRadius: 8 }}>
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
                  backgroundColor: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: 10,
                  padding: 14,
                  cursor: 'pointer',
                  transition: 'border-color 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
                      {inv.sourceInvoiceRef || inv.invoiceNumber}
                    </span>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid #1e293b' }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    Date: {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : 'N/A'}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#38bdf8' }}>
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
            backgroundColor: '#0f172a',
            borderTop: '2px solid #334155',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '85vh',
            overflowY: 'auto',
            padding: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Proforma Invoice</span>
                <h3 style={{ margin: 0, fontSize: 18, color: '#ffffff' }}>
                  {selectedInvoice.sourceInvoiceRef || selectedInvoice.invoiceNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: 6,
                  color: '#ffffff',
                  minHeight: 36,
                  cursor: 'pointer'
                }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ marginBottom: 16, backgroundColor: '#020617', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Client:</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc', marginBottom: 6 }}>
                {selectedInvoice.customer?.companyName || 'General Account'}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Payment Terms:</div>
              <div style={{ fontSize: 13, color: '#e2e8f0' }}>{selectedInvoice.paymentTerms || 'Standard'}</div>
            </div>

            {/* Line Items */}
            {selectedInvoice.lines && selectedInvoice.lines.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 8, textTransform: 'uppercase' }}>
                  Line Items
                </div>
                {selectedInvoice.lines.map((line: any, idx: number) => (
                  <div key={idx} style={{
                    padding: '8px 10px',
                    backgroundColor: '#1e293b',
                    borderRadius: 6,
                    marginBottom: 6,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#ffffff', fontWeight: 500 }}>{line.description}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        Qty: {line.quantity} × ${Number(line.unitPrice).toFixed(2)}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8' }}>
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
              backgroundColor: '#020617',
              borderRadius: 8,
              marginBottom: 20
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#cbd5e1' }}>Total Calculated:</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#34d399' }}>
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
                    backgroundColor: '#059669',
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
                onClick={() => alert(`Proforma Invoice PDF data generated for ${selectedInvoice.sourceInvoiceRef || selectedInvoice.invoiceNumber}. Ready to export.`)}
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
                📄 View / Share Proforma Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
