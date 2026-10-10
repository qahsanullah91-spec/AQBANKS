import React, { useEffect, useState } from 'react';
import { mobileApi } from '../services/api.js';
import { LedgerTransaction, User } from '../types/index.js';

interface LedgerScreenProps {
  user: User;
}

export const LedgerScreen: React.FC<LedgerScreenProps> = () => {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchLedger = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await mobileApi.getLedger();
      setTransactions(res.data || res);
    } catch (err: any) {
      setError(err.message || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const formatCurrency = (val: string | number | undefined) => {
    if (val === undefined || val === null) return '$0.00';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(isNaN(num) ? 0 : num);
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'CREDIT' && tx.category !== 'CREDIT') return false;
    if (filter === 'DEBIT' && tx.category !== 'DEBIT') return false;
    if (search) {
      const q = search.toLowerCase();
      const desc = (tx.description || '').toLowerCase();
      const ref = (tx.reference || '').toLowerCase();
      return desc.includes(q) || ref.includes(q);
    }
    return true;
  });

  return (
    <div style={{ padding: 16, color: '#f8fafc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase' }}>Financial Ledger</span>
          <h2 style={{ margin: 0, fontSize: 18, color: '#ffffff', fontWeight: 700 }}>Account Statement</h2>
        </div>
        <button
          onClick={fetchLedger}
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
        <div style={{ padding: 12, backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: 8, color: '#fca5a5', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Filter Chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(['ALL', 'CREDIT', 'DEBIT'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            style={{
              flex: 1,
              padding: '8px 0',
              minHeight: 40,
              backgroundColor: filter === cat ? '#0284c7' : '#1e293b',
              border: `1px solid ${filter === cat ? '#38bdf8' : '#334155'}`,
              borderRadius: 6,
              color: filter === cat ? '#ffffff' : '#94a3b8',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {cat === 'ALL' ? 'All Rows' : cat === 'CREDIT' ? 'Inward Credits' : 'Outward Debits'}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: 14 }}>
        <input
          type="text"
          placeholder="Filter description or reference..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            minHeight: 44,
            borderRadius: 8,
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            color: '#ffffff',
            fontSize: 13,
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Ledger Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>Loading account statement...</div>
      ) : filteredTransactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#64748b', backgroundColor: '#0f172a', borderRadius: 8 }}>
          No transactions found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredTransactions.map(tx => {
            const isCredit = tx.category === 'CREDIT';
            const isDebit = tx.category === 'DEBIT';
            const isBalance = tx.category === 'BALANCE';

            return (
              <div
                key={tx.id}
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
                      {tx.effectiveDate ? new Date(tx.effectiveDate).toLocaleDateString() : 'N/A'}
                    </span>
                    {tx.reference && (
                      <span style={{ fontSize: 11, color: '#38bdf8', marginLeft: 6, fontFamily: 'monospace' }}>
                        #{tx.reference}
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    backgroundColor: tx.reconciliationStatus === 'RECONCILED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: tx.reconciliationStatus === 'RECONCILED' ? '#34d399' : '#fbbf24',
                    border: `1px solid ${tx.reconciliationStatus === 'RECONCILED' ? '#059669' : '#d97706'}`
                  }}>
                    {tx.reconciliationStatus}
                  </span>
                </div>

                <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500, marginBottom: 8 }}>
                  {tx.description}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #1e293b' }}>
                  <div>
                    {isCredit && (
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#34d399' }}>
                        + {formatCurrency(tx.creditAmount)}
                      </span>
                    )}
                    {isDebit && (
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#f87171' }}>
                        - {formatCurrency(tx.debitAmount)}
                      </span>
                    )}
                    {isBalance && (
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>
                        Opening: {formatCurrency(tx.creditAmount || tx.runningBalance)}
                      </span>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>Running Balance</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                      {formatCurrency(tx.runningBalance)}
                    </div>
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
