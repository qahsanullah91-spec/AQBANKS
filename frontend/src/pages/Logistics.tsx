import React, { useEffect, useState } from 'react';
import { api, getUserRole } from '../services/api';
import { Shipment, Invoice } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { formatDisplayDate } from '../utils/date';
import {
  Ship,
  Search,
  Plus,
  Anchor,
  X,
  History,
  Package,
  ArrowRight,
  Clock,
  ShieldCheck,
  Printer
} from 'lucide-react';
import { LogisticsPrintModal } from '../components/LogisticsPrintModal';

export const Logistics: React.FC = () => {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const userRole = getUserRole();
  const canMutateLogistics = userRole === 'ADMIN' || userRole === 'LOGISTICS_COORD' || userRole === 'LOGISTICS_COORDINATOR';
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printShipmentId, setPrintShipmentId] = useState<string | null>(null);
  const [statusModalShipment, setStatusModalShipment] = useState<Shipment | null>(null);
  const [newStatus, setNewStatus] = useState('IN_TRANSIT');
  const [statusReason, setStatusReason] = useState('');

  const handleOpenPrintModal = (shipmentId: string | null = null) => {
    setPrintShipmentId(shipmentId);
    setShowPrintModal(true);
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCreateModal) setShowCreateModal(false);
        else if (showPrintModal) setShowPrintModal(false);
        else if (statusModalShipment) setStatusModalShipment(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreateModal, showPrintModal, statusModalShipment]);

  // Create Form State
  const [shipmentRef, setShipmentRef] = useState('');
  const [containerNumber, setContainerNumber] = useState('');
  const [billOfLading, setBillOfLading] = useState('');
  const [origin, setOrigin] = useState('Kandahar');
  const [destination, setDestination] = useState('Nhava Sheva');
  const [carrier, setCarrier] = useState('Maersk Line');
  const [estimatedArrivalDate, setEstimatedArrivalDate] = useState('');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [shpRes, invRes] = await Promise.all([
        api.getShipments({ search, status: statusFilter || undefined }),
        api.getInvoices()
      ]);
      setShipments(shpRes);
      setInvoices(invRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutateLogistics) {
      toast.error('Access Denied: Only Administrator or Logistics Coordinator can create shipments.');
      return;
    }
    try {
      await api.createShipment({
        shipmentRef,
        containerNumber,
        billOfLading,
        origin,
        destination,
        carrier,
        estimatedArrivalDate: estimatedArrivalDate || undefined,
        status: 'BOOKED',
        invoiceIds: selectedInvoiceIds
      });
      setShowCreateModal(false);
      toast.success('Shipment created successfully');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create shipment');
    }
  };

  const handleUpdateStatus = async () => {
    if (!canMutateLogistics) {
      toast.error('Access Denied: Only Administrator or Logistics Coordinator can update shipment status.');
      return;
    }
    if (!statusModalShipment) return;
    try {
      await api.updateShipmentStatus(statusModalShipment.id, newStatus, statusReason);
      setStatusModalShipment(null);
      setStatusReason('');
      toast.success('Shipment tracking status updated');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t('logistics.title')}</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {t('logistics.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={() => handleOpenPrintModal(null)}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-lg border border-slate-700 transition shadow-sm"
            title={t('logistics.printManifest', 'Print Logistics Manifest')}
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            <span>{t('logistics.printManifest', 'Print Logistics Manifest')}</span>
          </button>
          {canMutateLogistics ? (
            <button
              onClick={() => {
                setShipmentRef(`SHP-${Math.floor(9000 + Math.random() * 1000)}`);
                setShowCreateModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-950 transition"
            >
              <Plus className="w-4 h-4" /> {t('logistics.newShipment')}
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Read-Only Logistics View ({userRole})</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className={`w-4 h-4 text-slate-500 absolute top-3 ${isRtl ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            placeholder={t('logistics.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`w-full bg-slate-900 border border-slate-800 rounded-lg py-2.5 min-h-[44px] text-xs text-white focus:outline-none focus:border-emerald-500 ${
              isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
            }`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 min-h-[44px] text-xs text-slate-300 focus:outline-none"
        >
          <option value="">{t('logistics.allStatuses')}</option>
          <option value="BOOKED">Booked</option>
          <option value="AT_ORIGIN_PORT">At Origin Port</option>
          <option value="IN_TRANSIT">In Transit</option>
          <option value="CUSTOMS_CLEARANCE">Customs Clearance</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Shipments Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shipments.length > 0 ? (
          shipments.map(s => (
            <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">{t('logistics.shipmentRef')}</span>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                      <Anchor className="w-4 h-4 text-cyan-400" />
                      <span dir="ltr" className="font-mono">{s.shipmentRef}</span>
                    </h2>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                    s.status === 'IN_TRANSIT' ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/80 shadow-[0_0_12px_rgba(6,182,212,0.35)]' :
                    s.status === 'AT_ORIGIN_PORT' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                    s.status === 'DELIVERED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    {s.status === 'IN_TRANSIT' && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping inline-block" />}
                    {s.status === 'AT_ORIGIN_PORT' && <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />}
                    <span>{s.status.replace('_', ' ')}</span>
                  </span>
                </div>

                {/* Route visualization */}
                <div className="my-4 p-3 bg-slate-950 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs font-medium">
                  <div className="text-slate-300">
                    <span className="text-[10px] text-slate-500 block uppercase">{t('logistics.origin')}</span>
                    {s.origin || 'Kandahar'}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 px-3">
                    <div className="h-[1px] w-8 bg-slate-700" />
                    <Ship className={`w-4 h-4 text-cyan-400 ${isRtl ? 'scale-x-[-1]' : ''}`} />
                    <div className="h-[1px] w-8 bg-slate-700" />
                  </div>
                  <div className="text-right rtl:text-left text-slate-300">
                    <span className="text-[10px] text-slate-500 block uppercase">{t('logistics.destination')}</span>
                    {s.destination || 'Nhava Sheva'}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <div>{t('logistics.containerNo')}: <span dir="ltr" className="font-mono text-white font-medium">{s.containerNumber || 'N/A'}</span></div>
                  <div>{t('logistics.carrier')}: <span className="text-white font-medium">{s.carrier || 'N/A'}</span></div>
                  <div>{t('logistics.billOfLading')}: <span dir="ltr" className="font-mono text-white font-medium">{s.billOfLading || 'N/A'}</span></div>
                  <div>{t('logistics.eta')}: <span dir="ltr" className="text-white font-medium">{s.estimatedArrivalDate ? formatDisplayDate(s.estimatedArrivalDate) : 'N/A'}</span></div>
                </div>

                {/* Linked Invoices */}
                {s.shipmentInvoices && s.shipmentInvoices.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Linked Proforma Invoices:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {s.shipmentInvoices.map((si: any) => (
                        <span key={si.id} className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-emerald-400" dir="ltr">
                          {si.invoice?.invoiceNumber} ({si.invoice?.customer?.companyName})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Status Update & Print Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-800 flex justify-between items-center gap-2 flex-wrap">
                <span className="text-[11px] text-slate-500" dir="ltr">
                  {s.statusHistory && s.statusHistory.length > 0 ? `Updated: ${formatDisplayDate(s.statusHistory[0].changedAt)}` : ''}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenPrintModal(s.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
                    title={t('logistics.printSlip', 'Print Waybill')}
                  >
                    <Printer className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{t('logistics.printSlip', 'Print Waybill')}</span>
                  </button>
                  {canMutateLogistics && (
                    <button
                      onClick={() => {
                        setStatusModalShipment(s);
                        setNewStatus(s.status);
                      }}
                      className="px-3 py-1.5 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                    >
                      Update Status & Timeline
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 text-center py-12 text-slate-500">
            {loading ? t('common.loading') : t('logistics.emptyState')}
          </div>
        )}
      </div>

      {/* Pending Dispatch / Unassigned Cargo Section */}
      {(() => {
        const unassignedInvoices = invoices.filter(inv => {
          if (inv.status === 'VOID') return false;
          return !inv.shipmentInvoices || inv.shipmentInvoices.length === 0;
        });

        if (unassignedInvoices.length === 0) return null;

        const totalCartons = unassignedInvoices.reduce((s, i) => s + (i.lines || []).reduce((ls, l) => ls + (Number(l.cartonCount) || 0), 0), 0);
        const totalNetKg = unassignedInvoices.reduce((s, i) => s + (i.lines || []).reduce((ls, l) => ls + (Number(l.quantity) || 0), 0), 0);
        const totalUnassignedAmount = unassignedInvoices.reduce((s, i) => s + Number(i.totalAmount || 0), 0);

        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                    Pending Container Assignment ({unassignedInvoices.length} Invoices)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Proforma commercial invoices issued and staged for freight booking & container loading.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-amber-300">
                  {totalCartons.toLocaleString()} CTNS • {totalNetKg.toLocaleString()} KG
                </span>
                <span className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-emerald-400 font-bold tabular-nums" dir="ltr">
                  ${totalUnassignedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {unassignedInvoices.map(inv => {
                const line = inv.lines && inv.lines[0];
                return (
                  <div key={inv.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col justify-between hover:border-amber-500/50 transition">
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-white font-mono text-xs" dir="ltr">{inv.invoiceNumber}</span>
                          {inv.sourceInvoiceRef && (
                            <span className="text-[10px] text-amber-400 font-mono block mt-0.5" dir="ltr">
                              Ref: {inv.sourceInvoiceRef}
                            </span>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800">
                          Pending Dispatch
                        </span>
                      </div>
                      <span className="text-xs text-slate-200 font-sans font-medium block mt-2">
                        {inv.customer?.companyName || 'Unknown Customer'}
                      </span>
                      {line && (
                        <div className="mt-2 text-[11px] text-slate-400 font-mono space-y-0.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80" dir="ltr">
                          <div className="text-slate-300 font-sans truncate">{line.description}</div>
                          <div className="text-emerald-400">
                            {line.cartonCount ? `${Number(line.cartonCount).toLocaleString()} CTNS • ` : ''}
                            {Number(line.quantity).toLocaleString()} KG @ ${Number(line.unitPrice).toFixed(4)}/KG
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="font-extrabold text-white font-mono text-xs tabular-nums" dir="ltr">
                        ${Number(inv.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {canMutateLogistics && (
                        <button
                          onClick={() => {
                            setSelectedInvoiceIds([inv.id]);
                            setShipmentRef(`SHP-${Math.floor(9000 + Math.random() * 1000)}`);
                            setShowCreateModal(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-slate-800 hover:bg-emerald-600 hover:text-white text-emerald-400 font-semibold rounded-lg transition border border-slate-700 hover:border-emerald-500 shadow-sm"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Assign Container & B/L</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* CREATE SHIPMENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Ship className="w-5 h-5 text-cyan-600 dark:text-cyan-400" /> {t('logistics.newShipment')}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateShipment} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('logistics.shipmentRef')}</label>
                    <input
                      type="text"
                      value={shipmentRef}
                      onChange={e => setShipmentRef(e.target.value)}
                      required
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('logistics.carrier')}</label>
                    <input
                      type="text"
                      value={carrier}
                      onChange={e => setCarrier(e.target.value)}
                      required
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('logistics.containerNo')}</label>
                    <input
                      type="text"
                      value={containerNumber}
                      onChange={e => setContainerNumber(e.target.value)}
                      placeholder="MSKU9023418"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-cyan-500"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('logistics.billOfLading')}</label>
                    <input
                      type="text"
                      value={billOfLading}
                      onChange={e => setBillOfLading(e.target.value)}
                      placeholder="BL-1928374"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-cyan-500"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('logistics.origin')}</label>
                    <input
                      type="text"
                      value={origin}
                      onChange={e => setOrigin(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('logistics.destination')}</label>
                    <input
                      type="text"
                      value={destination}
                      onChange={e => setDestination(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('logistics.eta')}</label>
                  <input
                    type="date"
                    value={estimatedArrivalDate}
                    onChange={e => setEstimatedArrivalDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Linked Invoices Selection */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Select Invoices to Link with this Shipment</label>
                  <div className="max-h-36 overflow-y-auto bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2 space-y-1.5">
                    {invoices.filter(i => i.status !== 'VOID').map(inv => {
                      const isChecked = selectedInvoiceIds.includes(inv.id);
                      return (
                        <label key={inv.id} className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 p-1.5 rounded-lg cursor-pointer">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedInvoiceIds(prev => [...prev, inv.id]);
                                } else {
                                  setSelectedInvoiceIds(prev => prev.filter(id => id !== inv.id));
                                }
                              }}
                              className="rounded border-slate-300 dark:border-slate-700 text-cyan-600 focus:ring-0"
                            />
                            <span className="font-mono text-slate-900 dark:text-white font-medium" dir="ltr">{inv.invoiceNumber}</span>
                            <span className="text-slate-500 dark:text-slate-400 truncate max-w-[150px]">{inv.customer?.companyName}</span>
                          </div>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold tabular-nums" dir="ltr">
                            ${Number(inv.totalAmount).toLocaleString()}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900/95 z-10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 min-h-[44px] bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md keep-white-text"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPDATE STATUS MODAL & HISTORY */}
      {statusModalShipment && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" /> Milestone Tracking: {statusModalShipment.shipmentRef}
              </h3>
              <button onClick={() => setStatusModalShipment(null)} className="text-slate-400 hover:text-white p-2 min-h-[44px]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t('common.status')}</label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                >
                  <option value="BOOKED">Booked</option>
                  <option value="AT_ORIGIN_PORT">At Origin Port</option>
                  <option value="IN_TRANSIT">In Transit</option>
                  <option value="CUSTOMS_CLEARANCE">Customs Clearance</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t('common.notes')}</label>
                <textarea
                  value={statusReason}
                  onChange={e => setStatusReason(e.target.value)}
                  placeholder="e.g. Cleared customs at Nhava Sheva port, delivered to warehouse..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                />
              </div>

              {/* Status History Timeline */}
              {statusModalShipment.statusHistory && statusModalShipment.statusHistory.length > 0 && (
                <div className="pt-2">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-2">Audit History:</span>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {statusModalShipment.statusHistory.map((h: any) => (
                      <div key={h.id} className="p-2 bg-slate-950 border border-slate-800 rounded text-[11px]">
                        <div className="flex justify-between text-slate-300 font-medium">
                          <span>{h.newStatus}</span>
                          <span dir="ltr" className="text-slate-500">{formatDisplayDate(h.changedAt)}</span>
                        </div>
                        <p className="text-slate-400 text-[10px] mt-0.5">{h.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setStatusModalShipment(null)}
                  className="px-3 py-1.5 min-h-[44px] bg-slate-800 text-slate-300 rounded text-xs"
                >
                  {t('common.close')}
                </button>
                <button
                  onClick={handleUpdateStatus}
                  className="px-4 py-1.5 min-h-[44px] bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
                >
                  {t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOGISTICS PRINT MODAL */}
      <LogisticsPrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        shipments={shipments}
        invoices={invoices}
        initialShipmentId={printShipmentId}
      />
    </div>
  );
};
