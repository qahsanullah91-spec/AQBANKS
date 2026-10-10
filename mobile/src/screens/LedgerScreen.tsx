import React, { useEffect, useState } from 'react';
import { mobileApi } from '../services/api.js';
import { LedgerTransaction, User } from '../types/index.js';
import { useTheme } from '../theme/ThemeContext.js';

interface LedgerScreenProps {
  user: User;
}

export const LedgerScreen: React.FC<LedgerScreenProps> = () => {
  const { theme, colors } = useTheme();
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
    <div style={{ padding: 16, color: colors.text, backgroundColor: colors.bg, minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>Financial Ledger</span>
          <h2 style={{ margin: 0, fontSize: 18, color: colors.text, fontWeight: 800 }}>Account Statement</h2>
        </div>
        <button
          onClick={fetchLedger}
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

      {error && (
        <div style={{ padding: 12, backgroundColor: colors.dangerBg, border: `1px solid ${colors.danger}`, borderRadius: 8, color: colors.danger, fontSize: 13, marginBottom: 12, fontWeight: 600 }}>
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
              backgroundColor: filter === cat ? colors.primary : colors.card,
              border: `1px solid ${filter === cat ? colors.primary : colors.cardBorder}`,
              borderRadius: 6,
              color: filter === cat ? '#ffffff' : colors.textMuted,
              fontSize: 12,
              fontWeight: 700,
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
            backgroundColor: colors.inputBg,
            border: `1px solid ${colors.inputBorder}`,
            color: colors.text,
            fontSize: 13,
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Ledger Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted }}>Loading account statement...</div>
      ) : filteredTransactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: colors.textMuted, backgroundColor: colors.card, border: `1px solid ${colors.cardBorder}`, borderRadius: 10 }}>
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
                      {tx.effectiveDate ? new Date(tx.effectiveDate).toLocaleDateString() : 'N/A'}
                    </span>
                    {tx.reference && (
                      <span style={{ fontSize: 11, color: colors.primary, marginLeft: 6, fontFamily: 'monospace', fontWeight: 600 }}>
                        #{tx.reference}
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    backgroundColor: tx.reconciliationStatus === 'RECONCILED' ? colors.accentBg : colors.warningBg,
                    color: tx.reconciliationStatus === 'RECONCILED' ? colors.accent : colors.warning,
                    border: `1px solid ${tx.reconciliationStatus === 'RECONCILED' ? colors.accent : colors.warning}`
                  }}>
                    {tx.reconciliationStatus}
                  </span>
                </div>

                <div style={{ fontSize: 13, color: colors.text, fontWeight: 600, marginBottom: 8 }}>
                  {tx.description}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: `1px solid ${colors.divider}` }}>
                  <div>
                    {isCredit && (
                      <span style={{ fontSize: 14, fontWeight: 800, color: colors.accent }}>
                        + {formatCurrency(tx.creditAmount)}
                      </span>
                    )}
                    {isDebit && (
                      <span style={{ fontSize: 14, fontWeight: 800, color: colors.danger }}>
                        - {formatCurrency(tx.debitAmount)}
                      </span>
                    )}
                    {isBalance && (
                      <span style={{ fontSize: 14, fontWeight: 800, color: colors.textMuted }}>
                        Opening: {formatCurrency(tx.creditAmount || tx.runningBalance)}
                      </span>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase' }}>Running Balance</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: colors.text }}>
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
