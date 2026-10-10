import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { BankAccount } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  ShieldCheck,
  Eye,
  Lock,
  Building2,
  X,
  CheckCircle
} from 'lucide-react';

export const BankRouting: React.FC = () => {
  const { t, isRtl } = useLanguage();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Reveal Modal
  const [revealModalAccountId, setRevealModalAccountId] = useState<string | null>(null);
  const [revealReason, setRevealReason] = useState('');
  const [revealedData, setRevealedData] = useState<any | null>(null);
  const [revealing, setRevealing] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getBankAccounts();
      setAccounts(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReveal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revealModalAccountId || !revealReason.trim()) return;
    try {
      setRevealing(true);
      const res = await api.revealBankAccount(revealModalAccountId, revealReason);
      setRevealedData(res);
    } catch (err: any) {
      alert(err.message || 'Access denied or reveal failed');
    } finally {
      setRevealing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('banking.title')}</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {t('banking.subtitle')}
        </p>
      </div>

      {/* Security Governance Notice */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-start gap-3 text-xs">
        <div className="p-2 rounded bg-amber-950 text-amber-400 border border-amber-800 shrink-0">
          <Lock className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Confidential Corporate Banking Protocol</h3>
          <p className="text-slate-400 mt-0.5">
            {t('banking.securityNotice')}
          </p>
        </div>
      </div>

      {/* Bank Account Cards */}
      <div className="space-y-4">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">{acc.bankName}</h2>
                  <span className="text-xs text-slate-400">{t('banking.beneficiaryName')}: <strong className="text-slate-200">{acc.beneficiaryName}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Primary USD Wire
                </span>
                <button
                  onClick={() => {
                    setRevealModalAccountId(acc.id);
                    setRevealedData(null);
                    setRevealReason('');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" /> {t('banking.revealAccount')}
                </button>
              </div>
            </div>

            {/* Account Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 text-xs">
              <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-lg space-y-2">
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">Direct Bank Info</span>
                <div>
                  <span className="text-slate-400 block">{t('banking.accountNumber')}:</span>
                  <div className="font-mono text-base font-bold text-emerald-400 mt-0.5" dir="ltr">
                    {acc.accountNumberMasked}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block">{t('banking.swiftCode')}:</span>
                  <div className="font-mono text-sm font-semibold text-white mt-0.5" dir="ltr">
                    {acc.swiftCode}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-lg space-y-2">
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">Correspondent Routing (For International SWIFT)</span>
                <div>
                  <span className="text-slate-400 block">{t('banking.correspondentBank')}:</span>
                  <div className="text-sm font-semibold text-white mt-0.5">
                    {acc.correspondentBank || 'DA AFGHANISTAN BANK'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block">Correspondent SWIFT:</span>
                  <div className="font-mono text-sm font-semibold text-white mt-0.5" dir="ltr">
                    {acc.correspondentSwift || 'AFGBAFKA'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* REVEAL AUDIT MODAL */}
      {revealModalAccountId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2 text-amber-400">
                <ShieldCheck className="w-5 h-5 text-amber-400" /> {t('banking.revealAccount')}
              </h3>
              <button onClick={() => setRevealModalAccountId(null)} className="text-slate-400 hover:text-white p-2 min-h-[44px]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!revealedData ? (
              <form onSubmit={handleReveal} className="mt-4 space-y-3">
                <p className="text-xs text-slate-400">
                  This action reveals the complete bank account identifier. This disclosure is <strong className="text-white">logged with your user identity, IP address, and timestamp</strong>.
                </p>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t('banking.reasonPrompt')}</label>
                  <textarea
                    value={revealReason}
                    onChange={e => setRevealReason(e.target.value)}
                    required
                    placeholder="e.g. Verifying SWIFT routing instructions for overseas wire..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRevealModalAccountId(null)}
                    className="px-3 py-1.5 min-h-[44px] bg-slate-800 text-slate-300 rounded text-xs"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={revealing || !revealReason.trim()}
                    className="px-4 py-1.5 min-h-[44px] bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-xs disabled:opacity-50"
                  >
                    {revealing ? t('common.loading') : t('banking.revealAccount')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Authorized access granted and logged in compliance register.</span>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-center">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">{t('banking.accountNumber')}:</span>
                  <div className="font-mono text-xl font-extrabold text-white mt-1 tracking-wider selection:bg-emerald-600" dir="ltr">
                    {revealedData.accountNumberUnmasked}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setRevealModalAccountId(null);
                      setRevealedData(null);
                    }}
                    className="px-4 py-1.5 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold"
                  >
                    {t('common.close')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
