import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Customer } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatDisplayDate } from '../utils/date';
import {
  BarChart3,
  Calendar,
  DollarSign,
  Download,
  FileText,
  User,
  Clock,
  RefreshCw
} from 'lucide-react';

export const Reports: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [agingData, setAgingData] = useState<any | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [statementData, setStatementData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAging = async () => {
    try {
      setLoading(true);
      const [agingRes, custRes] = await Promise.all([
        api.getReceivablesAging(),
        api.getCustomers()
      ]);
      setAgingData(agingRes);
      setCustomers(custRes);
      if (custRes.length > 0) {
        setSelectedCustomerId(custRes[0].id);
        fetchStatement(custRes[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatement = async (cId: string) => {
    try {
      const res = await api.getCustomerStatement(cId);
      setStatementData(res);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAging();
  }, []);

  const handleCustomerChange = (cId: string) => {
    setSelectedCustomerId(cId);
    fetchStatement(cId);
  };

  const formatCurrency = (val: number | string | undefined | null) => {
    if (val === undefined || val === null || val === '') return '$0.00';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('reports.heading')}</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {t('reports.headingSubtitle')}
        </p>
      </div>

      {/* Receivables Aging Analysis Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" /> {t('reports.agingSchedule')}
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {t('reports.totalOutstandingLabel')}{' '}
            <strong className="text-amber-400 font-bold tabular-nums" dir="ltr">
              {formatCurrency(agingData?.summary?.totalOutstanding)}
            </strong>
          </span>
        </div>

        {/* Aging Buckets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">{t('reports.current')}</span>
            <div className="text-base font-extrabold font-mono tabular-nums text-emerald-400 mt-1" dir="ltr">
              {formatCurrency(agingData?.summary?.current_0_30)}
            </div>
            <span className="text-[10px] text-slate-500 font-sans block mt-0.5">0–30 Days</span>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">{t('reports.thirtyDays')}</span>
            <div className="text-base font-extrabold font-mono tabular-nums text-blue-400 mt-1" dir="ltr">
              {formatCurrency(agingData?.summary?.aging_31_60)}
            </div>
            <span className="text-[10px] text-slate-500 font-sans block mt-0.5">31–60 Days</span>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">{t('reports.sixtyDays')}</span>
            <div className="text-base font-extrabold font-mono tabular-nums text-amber-400 mt-1" dir="ltr">
              {formatCurrency(agingData?.summary?.aging_61_90)}
            </div>
            <span className="text-[10px] text-slate-500 font-sans block mt-0.5">61–90 Days</span>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">{t('reports.ninetyPlus')}</span>
            <div className="text-base font-extrabold font-mono tabular-nums text-rose-400 mt-1" dir="ltr">
              {formatCurrency(agingData?.summary?.aging_over_90)}
            </div>
            <span className="text-[10px] text-slate-500 font-sans block mt-0.5">&gt; 90 Days</span>
          </div>
        </div>

        {/* Aging Invoices Table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-xs text-slate-300 font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-sans">
              <tr>
                <th className={`py-2.5 px-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('invoices.invoiceNo')}</th>
                <th className={`py-2.5 px-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('invoices.buyerConsignee')}</th>
                <th className={`py-2.5 px-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('invoices.issueDate')}</th>
                <th className={`py-2.5 px-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('reports.daysOld')}</th>
                <th className="py-2.5 px-3 text-right">{t('reports.invoiceTotal')}</th>
                <th className="py-2.5 px-3 text-right">{t('reports.outstanding')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {agingData?.details && agingData.details.length > 0 ? (
                agingData.details.map((d: any) => (
                  <tr key={d.invoiceId} className="hover:bg-emerald-50/50 dark:hover:bg-slate-800/60 hover:border-l-4 hover:border-l-emerald-600 dark:hover:border-l-emerald-500 border-l-4 border-l-transparent transition">
                    <td className="py-2.5 px-3 font-semibold text-white" dir="ltr">{d.invoiceNumber}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-200">{d.customerName}</td>
                    <td className="py-2.5 px-3 text-slate-400" dir="ltr">{formatDisplayDate(d.issueDate)}</td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                        {d.daysOld} {t('reports.daysOld')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300 tabular-nums" dir="ltr">
                      {formatCurrency(d.totalAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-400 tabular-nums" dir="ltr">
                      {formatCurrency(d.outstandingAmount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-slate-500 font-sans">
                    {t('reports.noOverdue')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Account Statement Generator */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <User className="w-4 h-4 text-blue-400" /> {t('reports.generatorTitle')}
          </h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">{t('reports.selectConsignee')}</label>
            <select
              value={selectedCustomerId}
              onChange={e => handleCustomerChange(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white"
            >
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
          </div>
        </div>

        {statementData && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono">
              <div>
                <span className="text-slate-400 font-sans block text-[10px] uppercase">{t('reports.allTimeInvoiced')}</span>
                <span className="text-base font-bold text-white tabular-nums" dir="ltr">
                  {formatCurrency(statementData.summary.totalInvoiced)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-sans block text-[10px] uppercase">{t('reports.paymentsReceived')}</span>
                <span className="text-base font-bold text-emerald-400 tabular-nums" dir="ltr">
                  {formatCurrency(statementData.summary.totalPaymentsReceived)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-sans block text-[10px] uppercase">{t('reports.netOutstanding')}</span>
                <span className="text-base font-extrabold text-amber-400 tabular-nums" dir="ltr">
                  {formatCurrency(statementData.summary.outstandingBalance)}
                </span>
              </div>
            </div>

            {/* Invoices List */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">{t('reports.issuedInvoices')}</span>
              <div className="space-y-2">
                {statementData.invoices.map((inv: any) => (
                  <div key={inv.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center text-xs hover:bg-slate-900 transition">
                    <div>
                      <span className="font-semibold text-white" dir="ltr">{inv.invoiceNumber}</span>
                      <span className="text-slate-500 mx-2 font-mono" dir="ltr">{formatDisplayDate(inv.issueDate)}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-slate-300 tabular-nums" dir="ltr">{formatCurrency(inv.totalAmount)}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                        inv.paymentStatus === 'PAID' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {t(`status.${inv.paymentStatus === 'PAID' ? 'paid' : inv.paymentStatus === 'PARTIALLY_PAID' ? 'partiallyPaid' : 'unpaid'}` as any)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

