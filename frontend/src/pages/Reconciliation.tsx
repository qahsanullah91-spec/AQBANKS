import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Search,
  ShieldCheck,
  Percent,
  DollarSign
} from 'lucide-react';

export const Reconciliation: React.FC = () => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      const res = await api.getReconciliationSuggestions();
      setSuggestions(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, []);

  const handleConfirmMatch = async (txId: string, invoiceId: string, amount: number) => {
    try {
      setConfirmingId(txId);
      await api.confirmReconciliation({
        ledgerTransactionId: txId,
        invoiceId,
        allocationAmount: amount,
        notes: 'Confirmed via reconciliation review interface'
      });
      loadSuggestions();
    } catch (err: any) {
      alert(err.message || 'Failed to reconcile match');
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Statement & Invoice Reconciliation</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Automated candidate matching between unreconciled bank credits and proforma invoices with fee tolerance
          </p>
        </div>
        <button
          onClick={loadSuggestions}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Re-scan Matches
        </button>
      </div>

      {/* Reconciliation Guidelines Box */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-2">
        <h3 className="font-semibold text-slate-200 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Non-Negotiable Human-in-the-Loop Principle
        </h3>
        <p className="text-slate-400">
          The system will <strong className="text-white">never automatically bind</strong> financial records without human verification.
          Intermediary bank deductions (such as the ~$439.44 wire deduction on G.T Jayanti Inv 001) are highlighted for review before invoice closure.
        </p>
      </div>

      {/* Suggested Matches Cards */}
      <div className="space-y-4">
        {suggestions.length > 0 ? (
          suggestions.map((item, idx) => {
            const tx = item.ledgerTransaction;
            const match = item.bestMatch;
            return (
              <div key={tx.id || idx} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                  {/* Left: Statement Transaction */}
                  <div className="flex-1">
                    <span className="text-[10px] text-emerald-400 font-mono uppercase font-semibold">
                      Bank Statement Credit • {new Date(tx.effectiveDate).toLocaleDateString()}
                    </span>
                    <h2 className="text-sm font-bold text-white mt-0.5">{tx.description}</h2>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-3 font-mono">
                      <span>Ref: <strong className="text-slate-200">{tx.reference || 'N/A'}</strong></span>
                      <span>Received: <strong className="text-emerald-400 font-bold">${tx.creditAmount}</strong></span>
                    </div>
                  </div>

                  {/* Middle: Confidence pill */}
                  {match && (
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Match Confidence</span>
                      <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold text-xs">
                        <Percent className="w-3.5 h-3.5" /> {match.score}% Score
                      </div>
                    </div>
                  )}
                </div>

                {/* Match Details */}
                {match ? (
                  <div className="mt-4 pt-2 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-8 space-y-2">
                      <div className="text-xs text-slate-300 font-medium">
                        Candidate Invoice: <strong className="text-white">{match.invoice.invoiceNumber}</strong>
                        {match.invoice.sourceInvoiceRef && (
                          <span className="text-amber-400 ml-2 font-mono">(Source Ref: {match.invoice.sourceInvoiceRef})</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        Consignee: <strong className="text-slate-200">{match.invoice.customerName}</strong>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        Invoice Total: <strong className="text-white">${match.invoice.totalAmount}</strong> • Received: <strong className="text-emerald-400">${tx.creditAmount}</strong>
                        {Number(match.variance) !== 0 && (
                          <span className="ml-2 text-amber-400">
                            (Variance: ${match.variance} - Possible Intermediary Fee)
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {match.reasons.map((r: string, rIdx: number) => (
                          <span key={rIdx} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300">
                            ✓ {r}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="md:col-span-4 flex justify-end">
                      <button
                        onClick={() => handleConfirmMatch(tx.id, match.invoice.id, Number(tx.creditAmount))}
                        disabled={confirmingId === tx.id}
                        className="w-full md:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-950 transition flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {confirmingId === tx.id ? 'Reconciling...' : 'Confirm Match & Allocate'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-500 italic">
                    No clear candidate invoice match detected automatically. Manual allocation can be performed via Payments screen.
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
            {loading ? (
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-400" />
            ) : (
              <div>
                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-white">All Statement Credits Reconciled</h3>
                <p className="text-xs text-slate-500 mt-1">No unreconciled commercial credits require attention.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
