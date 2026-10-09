import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Shipment, Invoice } from '../types';
import {
  Ship,
  Search,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle,
  Truck,
  Anchor,
  X,
  History,
  AlertCircle
} from 'lucide-react';

export const Logistics: React.FC = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusModalShipment, setStatusModalShipment] = useState<Shipment | null>(null);
  const [newStatus, setNewStatus] = useState('IN_TRANSIT');
  const [statusReason, setStatusReason] = useState('');

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
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create shipment');
    }
  };

  const handleUpdateStatus = async () => {
    if (!statusModalShipment) return;
    try {
      await api.updateShipmentStatus(statusModalShipment.id, newStatus, statusReason);
      setStatusModalShipment(null);
      setStatusReason('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Active Freight Logistics & Container Tracking</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Cross-border container movements, carrier manifests (Maersk, MSC), and delivery milestones
          </p>
        </div>
        <button
          onClick={() => {
            setShipmentRef(`SHP-${Math.floor(9000 + Math.random() * 1000)}`);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-950 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Register Shipment
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by shipment ref, container no, B/L, route, or carrier..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
        >
          <option value="">All Tracking Statuses</option>
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
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Shipment Ref</span>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                      <Anchor className="w-4 h-4 text-cyan-400" /> {s.shipmentRef}
                    </h2>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    s.status === 'IN_TRANSIT' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                    s.status === 'AT_ORIGIN_PORT' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                    s.status === 'DELIVERED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    {s.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Route visualization */}
                <div className="my-4 p-3 bg-slate-950 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs font-medium">
                  <div className="text-slate-300">
                    <span className="text-[10px] text-slate-500 block uppercase">Origin</span>
                    {s.origin || 'Kandahar'}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 px-3">
                    <div className="h-[1px] w-8 bg-slate-700" />
                    <Ship className="w-4 h-4 text-cyan-400" />
                    <div className="h-[1px] w-8 bg-slate-700" />
                  </div>
                  <div className="text-right text-slate-300">
                    <span className="text-[10px] text-slate-500 block uppercase">Destination</span>
                    {s.destination || 'Nhava Sheva'}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <div>Container No: <span className="font-mono text-white font-medium">{s.containerNumber || 'N/A'}</span></div>
                  <div>Carrier / Vessel: <span className="text-white font-medium">{s.carrier || 'N/A'}</span></div>
                  <div>Bill of Lading: <span className="font-mono text-white font-medium">{s.billOfLading || 'N/A'}</span></div>
                  <div>ETA: <span className="text-white font-medium">{s.estimatedArrivalDate ? new Date(s.estimatedArrivalDate).toLocaleDateString() : 'N/A'}</span></div>
                </div>

                {/* Linked Invoices */}
                {s.shipmentInvoices && s.shipmentInvoices.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Linked Proforma Invoices:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {s.shipmentInvoices.map((si: any) => (
                        <span key={si.id} className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-emerald-400">
                          {si.invoice?.invoiceNumber} ({si.invoice?.customer?.companyName})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Status Update Button */}
              <div className="mt-5 pt-3 border-t border-slate-800 flex justify-between items-center">
                <span className="text-[11px] text-slate-500">
                  {s.statusHistory && s.statusHistory.length > 0 ? `Updated: ${new Date(s.statusHistory[0].changedAt).toLocaleDateString()}` : ''}
                </span>
                <button
                  onClick={() => {
                    setStatusModalShipment(s);
                    setNewStatus(s.status);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                >
                  Update Status & Timeline
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 text-center py-12 text-slate-500">
            {loading ? 'Loading shipments...' : 'No shipments registered. Click Register Shipment to track freight.'}
          </div>
        )}
      </div>

      {/* CREATE SHIPMENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Ship className="w-5 h-5 text-cyan-400" /> Register Freight Shipment
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateShipment} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Shipment Reference</label>
                  <input
                    type="text"
                    value={shipmentRef}
                    onChange={e => setShipmentRef(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Carrier / Vessel</label>
                  <input
                    type="text"
                    value={carrier}
                    onChange={e => setCarrier(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Container Number</label>
                  <input
                    type="text"
                    value={containerNumber}
                    onChange={e => setContainerNumber(e.target.value)}
                    placeholder="MSKU9023418"
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Bill of Lading (B/L)</label>
                  <input
                    type="text"
                    value={billOfLading}
                    onChange={e => setBillOfLading(e.target.value)}
                    placeholder="BL-1928374"
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Origin Port/City</label>
                  <input
                    type="text"
                    value={origin}
                    onChange={e => setOrigin(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Destination Port/City</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Estimated Arrival (ETA)</label>
                <input
                  type="date"
                  value={estimatedArrivalDate}
                  onChange={e => setEstimatedArrivalDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                >
                  Save Shipment
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
              <button onClick={() => setStatusModalShipment(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Transition To Status</label>
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
                <label className="block text-xs font-medium text-slate-300 mb-1">Reason / Carrier Update Note</label>
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
                          <span className="text-slate-500">{new Date(h.changedAt).toLocaleDateString()}</span>
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
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs"
                >
                  Close
                </button>
                <button
                  onClick={handleUpdateStatus}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
                >
                  Update Milestone
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
