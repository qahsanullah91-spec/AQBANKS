import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Customer } from '../types';
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

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight">Financial & Commercial Reports</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Receivables aging analysis, customer account statements, and freight settlement audits
        </p>
      </div>

      {/* Receivables Aging Analysis Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" /> Accounts Receivable Aging Analysis
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            Total Outstanding: <strong className="text-amber-400 font-bold">${agingData?.summary?.totalOutstanding || '0.00'}</strong>
          </span>
        </div>

        {/* Aging Buckets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">0 - 30 Days (Current)</span>
            <div className="text-base font-extrabold font-mono text-emerald-400 mt-1">
              ${agingData?.summary?.current_0_30 || '0.00'}
            </div>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">31 - 60 Days</span>
            <div className="text-base font-extrabold font-mono text-blue-400 mt-1">
              ${agingData?.summary?.aging_31_60 || '0.00'}
            </div>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">61 - 90 Days</span>
            <div className="text-base font-extrabold font-mono text-amber-400 mt-1">
              ${agingData?.summary?.aging_61_90 || '0.00'}
            </div>
          </div>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Over 90 Days</span>
            <div className="text-base font-extrabold font-mono text-rose-400 mt-1">
              ${agingData?.summary?.aging_over_90 || '0.00'}
            </div>
          </div>
        </div>

        {/* Aging Invoices Table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-xs text-slate-300 font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-sans">
              <tr>
                <th className="py-2.5 px-3">Invoice No</th>
                <th className="py-2.5 px-3">Buyer / Consignee</th>
                <th className="py-2.5 px-3">Issue Date</th>
                <th className="py-2.5 px-3">Days Aging</th>
                <th className="py-2.5 px-3 text-right">Invoice Total</th>
                <th className="py-2.5 px-3 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {agingData?.details && agingData.details.length > 0 ? (
                agingData.details.map((d: any) => (
                  <tr key={d.invoiceId} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-white">{d.invoiceNumber}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-200">{d.customerName}</td>
                    <td className="py-2.5 px-3 text-slate-400">{new Date(d.issueDate).toLocaleDateString()}</td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                        {d.daysOld} days
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">${d.totalAmount}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-400">${d.outstandingAmount}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-4 text-slate-500 font-sans">
                    No outstanding overdue invoices.
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
            <User className="w-4 h-4 text-blue-400" /> Customer Account Statement Generator
          </h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Select Consignee:</label>
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
                <span className="text-slate-400 font-sans block text-[10px] uppercase">All-Time Invoiced</span>
                <span className="text-base font-bold text-white">${statementData.summary.totalInvoiced}</span>
              </div>
              <div>
                <span className="text-slate-400 font-sans block text-[10px] uppercase">Payments Received</span>
                <span className="text-base font-bold text-emerald-400">${statementData.summary.totalPaymentsReceived}</span>
              </div>
              <div>
                <span className="text-slate-400 font-sans block text-[10px] uppercase">Net Outstanding Balance</span>
                <span className="text-base font-extrabold text-amber-400">${statementData.summary.outstandingBalance}</span>
              </div>
            </div>

            {/* Invoices List */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Issued Invoices</span>
              <div className="space-y-2">
                {statementData.invoices.map((inv: any) => (
                  <div key={inv.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center text-xs">
                    <div>
                      <span className="font-semibold text-white">{inv.invoiceNumber}</span>
                      <span className="text-slate-500 ml-2 font-mono">{new Date(inv.issueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-slate-300">${Number(inv.totalAmount).toLocaleString()}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                        inv.paymentStatus === 'PAID' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {inv.paymentStatus}
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
