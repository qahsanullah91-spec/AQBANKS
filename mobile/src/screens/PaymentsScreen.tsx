import React, { useEffect, useState } from 'react';
import { mobileApi, mobileRequest } from '../services/api.js';
import { User } from '../types/index.js';

interface PaymentsScreenProps {
  user: User;
}

export const PaymentsScreen: React.FC<PaymentsScreenProps> = ({ user }) => {
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
      await mobileApi.createPayment({
        amount: parseFloat(amount),
        currency: 'USD',
        paymentType: type,
        paymentDate: new Date(paymentDate).toISOString(),
        referenceNumber: referenceNumber || undefined,
        description: description || undefined
      });

      setMessage({ text: 'Payment successfully recorded with idempotency protection.', type: 'success' });
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

  const canCreate = user.roles?.includes('ADMIN') || user.roles?.includes('FINANCE');

  return (
    <div style={{ padding: 16, color: '#f8fafc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase' }}>Treasury & Remittances</span>
          <h2 style={{ margin: 0, fontSize: 18, color: '#ffffff', fontWeight: 700 }}>Payments</h2>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {canCreate && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              style={{
                padding: '8px 12px',
                backgroundColor: showAddForm ? '#334155' : '#059669',
                border: 'none',
                borderRadius: 8,
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 600,
                minHeight: 44,
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
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#38bdf8',
              fontSize: 12,
              minHeight: 44,
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

      {/* Payment Entry Form */}
      {showAddForm && (
        <form onSubmit={handleSubmitPayment} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#ffffff' }}>Record Financial Remittance</h3>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>Remittance Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setType('INWARD_CREDIT')}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  minHeight: 40,
                  backgroundColor: type === 'INWARD_CREDIT' ? '#059669' : '#1e293b',
                  border: `1px solid ${type === 'INWARD_CREDIT' ? '#10b981' : '#334155'}`,
                  borderRadius: 6,
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                📥 Inward Credit
              </button>
              <button
                type="button"
                onClick={() => setType('OUTWARD_DEBIT')}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  minHeight: 40,
                  backgroundColor: type === 'OUTWARD_DEBIT' ? '#dc2626' : '#1e293b',
                  border: `1px solid ${type === 'OUTWARD_DEBIT' ? '#ef4444' : '#334155'}`,
                  borderRadius: 6,
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                📤 Outward Debit
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>Amount (USD)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', minHeight: 44, borderRadius: 6, backgroundColor: '#020617', border: '1px solid #334155', color: '#ffffff', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>Effective Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              required
              style={{ width: '100%', padding: '10px 12px', minHeight: 44, borderRadius: 6, backgroundColor: '#020617', border: '1px solid #334155', color: '#ffffff', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>Bank Ref / Wire Number</label>
            <input
              type="text"
              placeholder="e.g. WIRE-2026-99182"
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', minHeight: 44, borderRadius: 6, backgroundColor: '#020617', border: '1px solid #334155', color: '#ffffff', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>Description / Payee</label>
            <input
              type="text"
              placeholder="e.g. Deposit for shipment freight"
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', minHeight: 44, borderRadius: 6, backgroundColor: '#020617', border: '1px solid #334155', color: '#ffffff', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
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
            {submitting ? 'Verifying & Posting...' : '🔒 Submit Payment (Idempotent)'}
          </button>
        </form>
      )}

      {/* Payment List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>Loading remittances...</div>
      ) : payments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#64748b', backgroundColor: '#0f172a', borderRadius: 8 }}>
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
                  backgroundColor: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: 10,
                  padding: 12
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : 'N/A'}
                    </span>
                    {p.referenceNumber && (
                      <span style={{ fontSize: 11, color: '#38bdf8', marginLeft: 6, fontFamily: 'monospace' }}>
                        #{p.referenceNumber}
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    backgroundColor: isCredit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: isCredit ? '#34d399' : '#f87171',
                    border: `1px solid ${isCredit ? '#059669' : '#dc2626'}`
                  }}>
                    {isCredit ? 'CREDIT' : 'DEBIT'}
                  </span>
                </div>

                <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500, marginBottom: 8 }}>
                  {p.description || (isCredit ? 'Inward Wire Transfer' : 'Disbursement Payment')}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #1e293b' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    Status: <strong style={{ color: '#cbd5e1' }}>{p.status || 'COMPLETED'}</strong>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: isCredit ? '#34d399' : '#f87171' }}>
                    {isCredit ? '+' : '-'} ${Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
