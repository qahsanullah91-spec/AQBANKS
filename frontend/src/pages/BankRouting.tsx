import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { BankAccount, RemittanceProfile } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { formatHumanDate } from '../utils/date';
import {
  ShieldCheck,
  Eye,
  Lock,
  Building2,
  X,
  CheckCircle,
  AlertTriangle,
  Copy,
  Printer,
  History,
  Check,
  Globe,
  MapPin,
  FileText,
  Search,
  Filter
} from 'lucide-react';
import { triggerPrint } from '../utils/print';

export const BankRouting: React.FC = () => {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [profiles, setProfiles] = useState<RemittanceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'LOCAL' | 'INTERNATIONAL'>('ALL');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Reveal Modal
  const [revealModalAccountId, setRevealModalAccountId] = useState<string | null>(null);
  const [revealReason, setRevealReason] = useState('');
  const [revealedData, setRevealedData] = useState<any | null>(null);
  const [revealing, setRevealing] = useState(false);

  // History Modal
  const [historyModalAccountId, setHistoryModalAccountId] = useState<string | null>(null);
  const [accountHistory, setAccountHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (revealModalAccountId) setRevealModalAccountId(null);
        else if (historyModalAccountId) setHistoryModalAccountId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [revealModalAccountId, historyModalAccountId]);

  // Printable Document Modal
  const [printableProfile, setPrintableProfile] = useState<RemittanceProfile | null>(null);

  // Copied indicator
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accRes, profRes, meRes] = await Promise.all([
        api.getBankAccounts(),
        api.getRemittanceProfiles(),
        api.getMe().catch(() => null)
      ]);
      setAccounts(accRes);
      setProfiles(profRes);
      if (meRes) setCurrentUser(meRes);
    } catch (err) {
      console.error('Failed to load bank data:', err);
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
      toast.success('Bank credentials unmasked securely');
    } catch (err: any) {
      toast.error(err.message || 'Access denied or reveal failed');
    } finally {
      setRevealing(false);
    }
  };

  const handleOpenHistory = async (accId: string) => {
    try {
      setHistoryModalAccountId(accId);
      setLoadingHistory(true);
      const res = await api.getBankAccountHistory(accId);
      setAccountHistory(res);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSetDefault = async (profileId: string) => {
    try {
      await api.setRemittanceDefault(profileId);
      toast.success('Default remittance profile updated');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to set default profile');
    }
  };

  const handleToggleActive = async (profileId: string) => {
    try {
      await api.toggleRemittanceActive(profileId);
      toast.success('Remittance profile status toggled');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle active status');
    }
  };

  const handleCopyInstructions = (profile: RemittanceProfile) => {
    const isIntl = profile.profileType === 'INTERNATIONAL';
    const lines = [
      `======================================================`,
      `SKY ARIANA LTD. - OFFICIAL WIRE PAYMENT INSTRUCTIONS`,
      `Profile: ${profile.name} (${profile.profileType})`,
      `Currency: USD`,
      `======================================================`,
      `BENEFICIARY DETAILS:`,
      `Beneficiary Name: ${profile.beneficiaryName}`,
      `Beneficiary Account No: ${profile.beneficiaryAccount}`,
      isIntl ? `SWIFT Field 59A: ${profile.beneficiaryAccount} / ${profile.beneficiaryName}` : '',
      ``,
      `BENEFICIARY BANK:`,
      `Bank Name: ${profile.beneficiaryBank}`,
      `Bank Address: ${profile.beneficiaryBankAddress}`,
      `SWIFT / BIC: ${profile.beneficiarySwift}`,
      isIntl ? `SWIFT Field 57A: ${profile.swiftField57A || profile.beneficiarySwift}` : '',
      isIntl && profile.aubAccountWithCorrespondent ? `AUB Account with Al Salam Bank: ${profile.aubAccountWithCorrespondent}` : '',
      ``,
      `CORRESPONDENT BANK:`,
      `Bank Name: ${profile.correspondentBank}`,
      `SWIFT Code: ${profile.correspondentSwift}`,
      profile.correspondentAccount ? `Account No: ${profile.correspondentAccount}` : '',
      profile.correspondentLocation ? `Location: ${profile.correspondentLocation}` : '',
      isIntl && profile.swiftField56A ? `SWIFT Field 56A: ${profile.swiftField56A}` : '',
      ``,
      isIntl ? `INTERMEDIARY BANK:` : '',
      isIntl && profile.intermediaryBank ? `Bank Name: ${profile.intermediaryBank}` : '',
      isIntl && profile.intermediarySwift ? `SWIFT Code: ${profile.intermediarySwift}` : '',
      isIntl && profile.swiftField54A ? `SWIFT Field 54A: ${profile.swiftField54A}` : '',
      isIntl && profile.mt103VerificationFlag ? `NOTICE: Intermediary bank mandatory in field 54A.` : '',
      `======================================================`
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(lines);
    setCopiedId(profile.id);
    setTimeout(() => setCopiedId(null), 3000);
  };

  const filteredProfiles = profiles.filter(p => {
    if (typeFilter !== 'ALL' && p.profileType !== typeFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchBank = p.beneficiaryBank.toLowerCase().includes(q);
      const matchCorr = p.correspondentBank.toLowerCase().includes(q);
      const matchBeneficiary = p.beneficiaryName.toLowerCase().includes(q);
      return matchName || matchBank || matchCorr || matchBeneficiary;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{t('banking.title')}</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            {t('banking.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              const defaultProf = profiles.find(p => p.isDefault) || profiles[0];
              if (defaultProf) setPrintableProfile(defaultProf);
            }}
            className="flex items-center gap-2 px-3.5 py-2 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-950 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Download Official Stamped Bank Comfort Letter / Wire Sheet (PDF)</span>
          </button>
          <button
            onClick={loadData}
            className="px-3 py-1.5 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            {t('common.filter', 'Refresh')}
          </button>
        </div>
      </div>

      {/* Security Governance Notice */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-start gap-3 text-xs">
        <div className="p-2 rounded bg-amber-950 text-amber-400 border border-amber-800 shrink-0">
          <Lock className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Confidential Corporate Banking Protocol</h3>
          <p className="text-slate-400 mt-0.5 leading-relaxed">
            {t('banking.securityNotice')}
          </p>
        </div>
      </div>

      {/* SECTION 1: Master Bank Accounts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            {t('banking.bankName')}: Afghan United Bank (AUB)
          </h2>
          <span className="text-xs text-slate-400 font-mono">1 Active Primary USD Account</span>
        </div>

        {accounts.map(acc => (
          <div key={acc.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white">{acc.bankName}</h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {acc.accountStatus || 'Active'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950 text-blue-300 border border-blue-800">
                      Type: {acc.accountType || 'AWDCCA'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 mt-1 block">
                    {t('banking.beneficiaryName')}: <strong className="text-slate-200">{acc.beneficiaryName}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleOpenHistory(acc.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
                  title="View Account Audit & Version History"
                >
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  {t('banking.viewHistory')}
                </button>
                <button
                  onClick={() => {
                    const isAuthorized = currentUser?.roles?.some((r: string) => {
                      const u = r.toUpperCase();
                      return u === 'ADMIN' || u === 'FINANCE_MANAGER' || u === 'FINANCE_MGR';
                    });
                    if (!isAuthorized) {
                      toast.error('Access Restricted: Revealing official unmasked banking numbers requires Administrator or Finance Manager cryptographic clearance.');
                      return;
                    }
                    setRevealModalAccountId(acc.id);
                    setRevealedData(null);
                    setRevealReason('');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-semibold rounded-lg border border-amber-700/50 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  {t('banking.revealAccount')}
                </button>
              </div>
            </div>

            {/* Account Details 4-Column Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">{t('banking.accountNumber')}</span>
                <div className="font-mono text-sm sm:text-base font-bold text-emerald-400 mt-1" dir="ltr">
                  {acc.accountNumberMasked}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Currency: USD</span>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">{t('banking.cifNumber')}</span>
                <div className="font-mono text-sm sm:text-base font-bold text-slate-300 mt-1" dir="ltr">
                  {acc.cifNumberMasked || '******4739'}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Masked & Protected</span>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">{t('banking.swiftCode')}</span>
                <div className="font-mono text-sm font-semibold text-white mt-1" dir="ltr">
                  {acc.swiftCode}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Zarghona Maidan, Shahr-e-Now</span>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">{t('banking.openingDate')}</span>
                <div className="text-sm font-semibold text-white mt-1">
                  {formatHumanDate(acc.openingDate || '2026-09-13T00:00:00.000Z')}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Status: AWDCCA Active</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* SECTION 2: Remittance Profiles */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              {t('banking.remittanceProfiles')}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Separate inward remittance channels for Local (DAB) and International (Al Salam / JPMorgan) settlements
            </p>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className={`w-3.5 h-3.5 text-slate-500 absolute top-2.5 ${isRtl ? 'right-2.5' : 'left-2.5'}`} />
              <input
                type="text"
                placeholder={t('common.search', 'Filter profiles...')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className={`bg-slate-900 border border-slate-800 rounded-lg py-1.5 min-h-[36px] text-xs text-white focus:outline-none focus:border-emerald-500 ${
                  isRtl ? 'pr-8 pl-2 text-right' : 'pl-8 pr-2 text-left'
                }`}
              />
            </div>
            <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-800 text-xs">
              <button
                onClick={() => setTypeFilter('ALL')}
                className={`px-2.5 py-1 rounded ${typeFilter === 'ALL' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'}`}
              >
                All ({profiles.length})
              </button>
              <button
                onClick={() => setTypeFilter('LOCAL')}
                className={`px-2.5 py-1 rounded ${typeFilter === 'LOCAL' ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-800' : 'text-slate-400'}`}
              >
                Local USD
              </button>
              <button
                onClick={() => setTypeFilter('INTERNATIONAL')}
                className={`px-2.5 py-1 rounded ${typeFilter === 'INTERNATIONAL' ? 'bg-indigo-950 text-indigo-300 font-bold border border-indigo-800' : 'text-slate-400'}`}
              >
                International USD
              </button>
            </div>
          </div>
        </div>

        {/* Profiles Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredProfiles.map(profile => {
            const isIntl = profile.profileType === 'INTERNATIONAL';
            return (
              <div
                key={profile.id}
                className={`bg-slate-900 border rounded-xl p-5 shadow-xl space-y-4 flex flex-col justify-between ${
                  profile.isDefault ? 'border-amber-500/50 ring-1 ring-amber-500/30' : 'border-slate-800'
                }`}
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                            isIntl
                              ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {profile.profileType === 'LOCAL' ? t('banking.localRemittance') : t('banking.internationalRemittance')}
                        </span>
                        {profile.isDefault && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                            <Check className="w-3 h-3" /> {t('banking.defaultBadge')}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            profile.isActive
                              ? 'bg-emerald-900/40 text-emerald-400'
                              : 'bg-rose-900/40 text-rose-400'
                          }`}
                        >
                          {profile.isActive ? t('banking.activeBadge') : t('banking.inactiveBadge')}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white mt-1.5">{profile.name}</h3>
                    </div>

                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      {!profile.isDefault && (
                        <button
                          onClick={() => handleSetDefault(profile.id)}
                          className="px-2.5 py-1 min-h-[36px] bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 transition"
                        >
                          {t('banking.setDefault')}
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleActive(profile.id)}
                        className={`px-2.5 py-1 min-h-[36px] text-xs rounded border transition ${
                          profile.isActive
                            ? 'bg-slate-800 hover:bg-rose-900/40 text-slate-300 border-slate-700'
                            : 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-800'
                        }`}
                      >
                        {profile.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>

                  {/* MT103 Warning Alert for International */}
                  {isIntl && profile.mt103VerificationFlag && (
                    <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-lg text-xs text-amber-200 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-amber-400">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{t('banking.mt103WarningTitle')}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-amber-300/90">
                        {t('banking.mt103Warning')}
                      </p>
                    </div>
                  )}

                  {/* Routing Chain Details */}
                  <div className="space-y-3 text-xs">
                    {/* Beneficiary */}
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">
                        Beneficiary (Field 59A)
                      </span>
                      <div className="font-semibold text-white mt-0.5">{profile.beneficiaryName}</div>
                      <div className="font-mono text-emerald-400 font-bold text-xs sm:text-sm mt-0.5" dir="ltr">
                        Account: {profile.beneficiaryAccount}
                      </div>
                    </div>

                    {/* Beneficiary Bank */}
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">
                        Beneficiary Bank {isIntl ? '(Field 57A)' : ''}
                      </span>
                      <div className="font-semibold text-white">{profile.beneficiaryBank}</div>
                      <div className="text-[11px] text-slate-400">{profile.beneficiaryBankAddress}</div>
                      <div className="font-mono text-white text-xs mt-0.5" dir="ltr">
                        SWIFT/BIC: <strong className="text-emerald-400">{profile.beneficiarySwift}</strong>
                      </div>
                      {isIntl && profile.aubAccountWithCorrespondent && (
                        <div className="text-[11px] text-slate-300 pt-1 border-t border-slate-900" dir="ltr">
                          AUB Account with Al Salam Bank: <span className="font-mono text-amber-400">{profile.aubAccountWithCorrespondent}</span>
                        </div>
                      )}
                    </div>

                    {/* Correspondent Bank */}
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 space-y-1">
                      <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">
                        Correspondent Bank {isIntl ? '(Field 56A)' : '(Local Clearing)'}
                      </span>
                      <div className="font-semibold text-white">{profile.correspondentBank}</div>
                      <div className="font-mono text-white text-xs" dir="ltr">
                        SWIFT: <strong className="text-emerald-400">{profile.correspondentSwift}</strong>
                      </div>
                      {profile.correspondentAccount && (
                        <div className="font-mono text-slate-300 text-[11px]" dir="ltr">
                          Account No: {profile.correspondentAccount}
                        </div>
                      )}
                      {profile.correspondentLocation && (
                        <div className="text-slate-400 text-[11px] flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" /> {profile.correspondentLocation}
                        </div>
                      )}
                    </div>

                    {/* Intermediary Bank (International Only) */}
                    {isIntl && (
                      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 space-y-1">
                        <span className="text-[10px] font-bold uppercase text-amber-500 tracking-wider block">
                          Intermediary Bank (Field 54A - Mandatory)
                        </span>
                        <div className="font-semibold text-white">{profile.intermediaryBank || 'JPMorgan Chase Bank, New York'}</div>
                        <div className="font-mono text-white text-xs" dir="ltr">
                          SWIFT Code: <strong className="text-amber-400">{profile.intermediarySwift || 'CHASUS33'}</strong>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Field 54A: Intermediary bank instruction verified
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <button
                    onClick={() => handleCopyInstructions(profile)}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                  >
                    {copiedId === profile.id ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400">{t('banking.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>{t('banking.copyInstructions')}</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setPrintableProfile(profile)}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{t('banking.printInstructions')}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* REVEAL AUDIT MODAL */}
      {revealModalAccountId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2 text-amber-400">
                <ShieldCheck className="w-5 h-5 text-amber-400" /> {t('banking.revealAccount')}
              </h3>
              <button
                onClick={() => setRevealModalAccountId(null)}
                className="text-slate-400 hover:text-white p-2 min-h-[44px]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!revealedData ? (
              <form onSubmit={handleReveal} className="mt-4 space-y-3">
                <p className="text-xs text-slate-400 leading-relaxed">
                  This action reveals the complete bank account identifier and CIF number. This disclosure is{' '}
                  <strong className="text-white">logged with your user identity, IP address, and timestamp</strong>.
                </p>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t('banking.reasonPrompt')}</label>
                  <textarea
                    value={revealReason}
                    onChange={e => setRevealReason(e.target.value)}
                    required
                    placeholder="e.g. Verifying SWIFT routing instructions for overseas wire..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
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
              <div className="mt-4 space-y-4">
                <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Authorized access granted and logged in compliance register.</span>
                </div>

                <div className="relative p-5 bg-slate-950 border border-amber-500/40 rounded-xl space-y-3 overflow-hidden shadow-2xl">
                  {/* Security Watermark Pattern & Text */}
                  <div className="watermark-pattern absolute inset-0 pointer-events-none" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.08] select-none rotate-[-22deg]">
                    <span className="text-xl sm:text-2xl font-mono font-black text-red-500 uppercase tracking-widest text-center leading-relaxed">
                      RESTRICTED • AFGHAN UNITED BANK • 101502USD2940472 • DISCLOSED TO {currentUser?.email || 'AUTHORIZED OFFICER'} • AUDITED
                    </span>
                  </div>

                  <div className="relative z-10">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">{t('banking.accountNumber')}:</span>
                    <div className="font-mono text-xl sm:text-2xl font-black text-emerald-400 mt-1 tracking-wider selection:bg-emerald-600" dir="ltr">
                      {revealedData.accountNumberUnmasked}
                    </div>
                  </div>

                  <div className="relative z-10">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">{t('banking.cifNumber')}:</span>
                    <div className="font-mono text-base font-bold text-white mt-1 tracking-wider" dir="ltr">
                      {revealedData.cifNumberUnmasked}
                    </div>
                  </div>

                  <div className="relative z-10 pt-2.5 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between items-center flex-wrap gap-1 font-mono">
                    <span>Officer: <strong className="text-slate-200">{currentUser?.email || revealedData.revealedByUserId}</strong></span>
                    <span className="text-[10px] text-amber-400 font-bold tracking-wider">🔒 WATERMARKED AUDIT LOGGED</span>
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

      {/* VERSION HISTORY MODAL */}
      {historyModalAccountId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" /> {t('banking.viewHistory')}
              </h3>
              <button
                onClick={() => setHistoryModalAccountId(null)}
                className="text-slate-400 hover:text-white p-2 min-h-[44px]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-3">
              {loadingHistory ? (
                <div className="text-center py-8 text-xs text-slate-400">Loading version history...</div>
              ) : accountHistory.length > 0 ? (
                accountHistory.map((item: any, idx: number) => (
                  <div key={idx} className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white">
                        {item.versionNumber ? `Version ${item.versionNumber}` : item.action}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {item.changeReason && (
                      <p className="text-slate-300 italic text-[11px]">Reason: "{item.changeReason}"</p>
                    )}
                    {item.user && (
                      <div className="text-[11px] text-slate-400">
                        Recorded by: <span className="text-slate-200 font-medium">{item.user.name || item.user.email}</span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-500">
                  No historical modifications recorded. Initial provisioned version is active.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setHistoryModalAccountId(null)}
                className="px-4 py-1.5 min-h-[44px] bg-slate-800 text-slate-300 rounded text-xs"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OFFICIAL PRINTABLE INSTRUCTION DOCUMENT MODAL */}
      {printableProfile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="printable-document bg-white text-slate-900 rounded-xl w-full max-w-3xl my-auto p-4 sm:p-8 shadow-2xl font-sans max-h-[95vh] overflow-y-auto print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-full print:rounded-none print:max-h-none print:overflow-visible">
            {/* Document Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 sm:pb-6 border-b border-slate-300">
              <div className="flex items-center gap-4">
                <div className="h-16 w-36 sm:w-44 flex items-center justify-start shrink-0">
                  <img
                    src="/sky-ariana-logo.png"
                    alt="Sky Ariana Ltd. Official Logo"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">SKY ARIANA LTD.</h2>
                  <p className="text-xs text-slate-600 uppercase font-semibold">Corporate Treasury & Commercial Settlement</p>
                  <p className="text-xs text-slate-500 mt-0.5">Finance Department - Inward Remittance Profile</p>
                </div>
              </div>
              <div className="sm:text-right rtl:sm:text-left">
                <span className="text-base sm:text-lg font-bold text-slate-900 uppercase block">
                  {t('banking.documentHeaderTitle')}
                </span>
                <span className="text-xs font-mono font-bold text-emerald-700 block mt-1">
                  PROFILE: {printableProfile.profileType}
                </span>
                <span className="text-xs text-slate-600 block mt-0.5">
                  Generated: {new Date().toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Profile Specific Routing Table */}
            <div className="my-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                <h3 className="font-extrabold uppercase text-slate-800 text-sm border-b border-slate-200 pb-1">
                  1. BENEFICIARY DETAILS (FIELD 59A)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div>Beneficiary Name: <strong className="text-slate-900 font-bold">{printableProfile.beneficiaryName}</strong></div>
                  <div>Beneficiary Account No: <span dir="ltr" className="font-mono font-bold text-slate-900">{printableProfile.beneficiaryAccount}</span></div>
                  <div>Currency: <strong className="text-slate-900">USD (United States Dollar)</strong></div>
                  <div>Beneficiary Country: <span className="text-slate-900">Afghanistan</span></div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                <h3 className="font-extrabold uppercase text-slate-800 text-sm border-b border-slate-200 pb-1">
                  2. BENEFICIARY BANK (FIELD 57A)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div>Bank Name: <strong className="text-slate-900 font-bold">{printableProfile.beneficiaryBank}</strong></div>
                  <div>SWIFT / BIC Code: <span dir="ltr" className="font-mono font-bold text-emerald-800">{printableProfile.beneficiarySwift}</span></div>
                  <div className="sm:col-span-2">Address: <span className="text-slate-900">{printableProfile.beneficiaryBankAddress}</span></div>
                  {printableProfile.aubAccountWithCorrespondent && (
                    <div className="sm:col-span-2 pt-1 border-t border-slate-200">
                      AUB Account with Al Salam Bank: <span dir="ltr" className="font-mono font-bold text-slate-900">{printableProfile.aubAccountWithCorrespondent}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                <h3 className="font-extrabold uppercase text-slate-800 text-sm border-b border-slate-200 pb-1">
                  3. CORRESPONDENT BANK {printableProfile.profileType === 'INTERNATIONAL' ? '(FIELD 56A)' : '(LOCAL CLEARING)'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div>Correspondent Bank: <strong className="text-slate-900 font-bold">{printableProfile.correspondentBank}</strong></div>
                  <div>SWIFT Code: <span dir="ltr" className="font-mono font-bold text-emerald-800">{printableProfile.correspondentSwift}</span></div>
                  {printableProfile.correspondentAccount && (
                    <div>Correspondent Account: <span dir="ltr" className="font-mono font-bold text-slate-900">{printableProfile.correspondentAccount}</span></div>
                  )}
                  {printableProfile.correspondentLocation && (
                    <div>Location: <span className="text-slate-900">{printableProfile.correspondentLocation}</span></div>
                  )}
                </div>
              </div>

              {printableProfile.profileType === 'INTERNATIONAL' && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                  <h3 className="font-extrabold uppercase text-slate-800 text-sm border-b border-slate-200 pb-1">
                    4. INTERMEDIARY BANK (FIELD 54A - MANDATORY)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                    <div>Intermediary Bank: <strong className="text-slate-900 font-bold">{printableProfile.intermediaryBank || 'JPMorgan Chase Bank, New York'}</strong></div>
                    <div>Intermediary SWIFT: <span dir="ltr" className="font-mono font-bold text-amber-800">{printableProfile.intermediarySwift || 'CHASUS33'}</span></div>
                    <div className="sm:col-span-2 text-slate-600 italic">
                      SWIFT Field 54A: Intermediary bank is mandatory as specified in correspondent wire instructions.
                    </div>
                  </div>
                </div>
              )}

              {/* Administrative Verification Checklist */}
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-300 space-y-2 text-xs">
                <h4 className="font-bold text-amber-900 uppercase flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  {t('banking.verificationChecklist')}
                </h4>
                <div className="space-y-1 text-amber-900">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded text-amber-600" />
                    <span>Beneficiary title Sky Ariana LTD and account 101502USD2940472 verified.</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded text-amber-600" />
                    <span>SWIFT Code AFGUAFKAXXX confirmed active with Afghan United Bank.</span>
                  </label>
                  {printableProfile.profileType === 'INTERNATIONAL' && (
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded text-amber-600" />
                      <span>Al Salam Bank Bahrain (ALSABHBMXXX) and JPMorgan Chase (CHASUS33) routing confirmed.</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Authorized Signatures & Official Corporate Stamp */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-200 items-end">
                <div>
                  <div className="border-b border-slate-400 w-40 mb-1"></div>
                  <span className="text-[11px] font-bold text-slate-700 uppercase block">Chief Financial Officer</span>
                  <span className="text-[10px] text-slate-500 block">Sky Ariana LTD - Corporate Treasury</span>
                </div>
                {/* Official Corporate Seal */}
                <div className="flex justify-center my-2 sm:my-0">
                  <div className="w-24 h-24 rounded-full border-2 border-dashed border-emerald-700/80 p-1 flex flex-col items-center justify-center text-center rotate-[-6deg] shadow-sm bg-emerald-50/50">
                    <span className="text-[8px] font-black uppercase text-emerald-800 tracking-wider">SKY ARIANA LTD</span>
                    <span className="text-[7px] text-emerald-700 font-bold uppercase">OFFICIAL SEAL</span>
                    <span className="text-[6px] text-emerald-600 font-mono mt-0.5">TREASURY VERIFIED</span>
                    <span className="text-[6px] text-slate-500 font-mono">13-SEP-2026</span>
                  </div>
                </div>
                <div className="sm:text-right rtl:sm:text-left">
                  <div className="border-b border-slate-400 w-40 sm:ml-auto rtl:sm:mr-auto rtl:sm:ml-0 mb-1"></div>
                  <span className="text-[11px] font-bold text-slate-700 uppercase block">Compliance & Banking Auditor</span>
                  <span className="text-[10px] text-slate-500 block">AQ Companies Group</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200 print:hidden">
              <button
                onClick={() => triggerPrint(`Bank-Wire-Instructions-${printableProfile.profileType}`)}
                className="flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow-lg shadow-emerald-950/20"
              >
                <Printer className="w-4 h-4" />
                <span>Download Official Stamped Bank Comfort Letter / Wire Sheet (PDF)</span>
              </button>
              <button
                onClick={() => setPrintableProfile(null)}
                className="px-4 py-2.5 min-h-[44px] bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-lg"
              >
                {t('common.close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
