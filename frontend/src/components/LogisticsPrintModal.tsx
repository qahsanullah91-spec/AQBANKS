import React, { useState, useEffect } from 'react';
import { Shipment, Invoice } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatDisplayDate, formatFullDate } from '../utils/date';
import {
  Printer,
  X,
  Download,
  Ship,
  Anchor,
  Package,
  Layers,
  FileCheck,
  Building2,
  Calendar,
  CheckCircle2,
  Navigation,
  Clock,
  ShieldCheck,
  Container
} from 'lucide-react';
import { triggerPrint } from '../utils/print';

interface LogisticsPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipments: Shipment[];
  invoices: Invoice[];
  initialShipmentId?: string | null;
}

export const LogisticsPrintModal: React.FC<LogisticsPrintModalProps> = ({
  isOpen,
  onClose,
  shipments,
  invoices,
  initialShipmentId = null,
}) => {
  const { t, isRtl } = useLanguage();
  const [selectedView, setSelectedView] = useState<string>(initialShipmentId || 'ALL');
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [includePendingCargo, setIncludePendingCargo] = useState(true);
  const [compactMode, setCompactMode] = useState(false);

  // Sync selectedView if initialShipmentId changes when opening
  useEffect(() => {
    setSelectedView(initialShipmentId || 'ALL');
  }, [initialShipmentId, isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const safeShipments = Array.isArray(shipments) ? shipments : [];
  const safeInvoices = Array.isArray(invoices) ? invoices : [];

  const unassignedInvoices = safeInvoices.filter(inv => {
    if (inv.status === 'VOID') return false;
    return !inv.shipmentInvoices || inv.shipmentInvoices.length === 0;
  });

  const selectedShipment = selectedView !== 'ALL'
    ? safeShipments.find(s => s.id === selectedView)
    : null;

  const todayStr = new Date().toISOString().split('T')[0];
  const docRef = selectedShipment
    ? `AQ-WAYBILL-${selectedShipment.shipmentRef}-${todayStr.replace(/-/g, '')}`
    : `AQ-MANIFEST-${todayStr.replace(/-/g, '')}-ALL`;

  // Aggregate metrics across active shipments
  const inTransitCount = safeShipments.filter(s => s.status === 'IN_TRANSIT').length;
  const bookedCount = safeShipments.filter(s => s.status === 'BOOKED').length;
  const customsCount = safeShipments.filter(s => s.status === 'CUSTOMS_CLEARANCE').length;
  const deliveredCount = safeShipments.filter(s => s.status === 'DELIVERED').length;

  // Calculate total goods assigned to shipments
  let assignedCartons = 0;
  let assignedNetKg = 0;
  let assignedValue = 0;
  safeShipments.forEach(s => {
    (s.shipmentInvoices || []).forEach((si: any) => {
      const inv = si.invoice;
      if (inv) {
        assignedValue += Number(inv.totalAmount || 0);
        (inv.lines || []).forEach((l: any) => {
          assignedCartons += Number(l.cartonCount || 0);
          assignedNetKg += Number(l.quantity || 0);
        });
      }
    });
  });

  // Calculate unassigned cargo totals
  const unassignedCartons = unassignedInvoices.reduce((sum, inv) =>
    sum + (inv.lines || []).reduce((ls: number, l: any) => ls + (Number(l.cartonCount) || 0), 0), 0
  );
  const unassignedNetKg = unassignedInvoices.reduce((sum, inv) =>
    sum + (inv.lines || []).reduce((ls: number, l: any) => ls + (Number(l.quantity) || 0), 0), 0
  );
  const unassignedValue = unassignedInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

  const handlePrint = () => {
    const title = selectedShipment
      ? `Cargo-Waybill-${selectedShipment.shipmentRef}`
      : `Freight-Logistics-Manifest-${todayStr}`;
    triggerPrint(title);
  };

  const handleExportCsv = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (selectedShipment) {
      headers = ['Shipment Ref', 'Carrier', 'Container No', 'Bill of Lading', 'Origin', 'Destination', 'ETA', 'Status', 'Linked Invoice', 'Customer', 'Cartons', 'Weight (KG)', 'Invoice Total ($)'];
      const linkedInvs = selectedShipment.shipmentInvoices || [];
      if (linkedInvs.length > 0) {
        linkedInvs.forEach((si: any) => {
          const inv = si.invoice;
          const line = inv?.lines?.[0];
          rows.push([
            selectedShipment.shipmentRef,
            selectedShipment.carrier || 'N/A',
            selectedShipment.containerNumber || 'N/A',
            selectedShipment.billOfLading || 'N/A',
            selectedShipment.origin || 'Kandahar',
            selectedShipment.destination || 'Nhava Sheva',
            selectedShipment.estimatedArrivalDate ? formatDisplayDate(selectedShipment.estimatedArrivalDate) : 'N/A',
            selectedShipment.status,
            inv?.invoiceNumber || 'N/A',
            `"${(inv?.customer?.companyName || '').replace(/"/g, '""')}"`,
            line?.cartonCount || 0,
            line?.quantity || 0,
            Number(inv?.totalAmount || 0).toFixed(2)
          ]);
        });
      } else {
        rows.push([
          selectedShipment.shipmentRef,
          selectedShipment.carrier || 'N/A',
          selectedShipment.containerNumber || 'N/A',
          selectedShipment.billOfLading || 'N/A',
          selectedShipment.origin || 'Kandahar',
          selectedShipment.destination || 'Nhava Sheva',
          selectedShipment.estimatedArrivalDate ? formatDisplayDate(selectedShipment.estimatedArrivalDate) : 'N/A',
          selectedShipment.status,
          'No Linked Invoices',
          '',
          0,
          0,
          '0.00'
        ]);
      }
    } else {
      headers = ['Shipment Ref', 'Status', 'Carrier', 'Container No', 'Bill of Lading (B/L)', 'Origin Port', 'Destination Port', 'ETA', 'Linked Invoices Count', 'Cargo Details'];
      rows = safeShipments.map(s => {
        const invSummary = (s.shipmentInvoices || [])
          .map((si: any) => `${si.invoice?.invoiceNumber} (${si.invoice?.customer?.companyName})`)
          .join('; ');
        return [
          s.shipmentRef,
          s.status,
          s.carrier || 'N/A',
          s.containerNumber || 'N/A',
          s.billOfLading || 'N/A',
          s.origin || 'Kandahar',
          s.destination || 'Nhava Sheva',
          s.estimatedArrivalDate ? formatDisplayDate(s.estimatedArrivalDate) : 'N/A',
          (s.shipmentInvoices || []).length,
          `"${invSummary.replace(/"/g, '""')}"`
        ];
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [
      `Official Freight Logistics Manifest - ${selectedShipment ? selectedShipment.shipmentRef : 'All Containers'}`,
      `Company: Sky Ariana Ltd. / AQ Companies | Logistics Division`,
      `Generated: ${new Date().toISOString()}`,
      '',
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Freight_Logistics_${selectedShipment ? selectedShipment.shipmentRef : 'Manifest'}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="printable-document bg-white text-slate-900 rounded-2xl w-full max-w-4xl my-auto p-4 sm:p-8 shadow-2xl font-sans max-h-[95vh] overflow-y-auto border border-slate-300 print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-full print:rounded-none print:max-h-none print:overflow-visible">

        {/* MODAL CONTROL TOOLBAR (print:hidden) */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 pb-4 mb-5 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-cyan-100 text-cyan-800 rounded-xl shadow-xs">
              <Printer className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>{t('logistics.printPreviewTitle', 'Freight Shipments & Logistics Print Preview')}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                  {selectedView === 'ALL' ? `${safeShipments.length} Active Shipments` : `Container Slip • ${selectedShipment?.shipmentRef}`}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Ocean & Land Cargo Manifest • Verified Waybill Dossier
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            {/* View Selector (Master Manifest vs Specific Container) */}
            <select
              value={selectedView}
              onChange={e => setSelectedView(e.target.value)}
              className="px-2.5 py-1.5 min-h-[34px] bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 transition cursor-pointer"
            >
              <option value="ALL">📦 Master Cargo Manifest (All Shipments)</option>
              {safeShipments.map(s => (
                <option key={s.id} value={s.id}>
                  ⚓ {s.shipmentRef} • {s.carrier} ({s.containerNumber || 'No Container'}) [{s.status}]
                </option>
              ))}
            </select>

            {/* Include Pending Invoices Cargo Toggle (Only for Master Manifest) */}
            {selectedView === 'ALL' && (
              <button
                onClick={() => setIncludePendingCargo(!includePendingCargo)}
                className={`px-2.5 py-1.5 min-h-[34px] text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                  includePendingCargo ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
                title="Toggle staging unassigned cargo list"
              >
                <Package className="w-3.5 h-3.5" />
                <span>Pending Cargo: {includePendingCargo ? 'Included' : 'Hidden'}</span>
              </button>
            )}

            {/* Signatures Toggle */}
            <button
              onClick={() => setIncludeSignatures(!includeSignatures)}
              className={`px-2.5 py-1.5 min-h-[34px] text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                includeSignatures ? 'bg-cyan-50 text-cyan-800 border border-cyan-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
              title="Toggle official customs & dispatch sign-off certification blocks"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Signatures: {includeSignatures ? 'ON' : 'OFF'}</span>
            </button>

            {/* Density Toggle */}
            <button
              onClick={() => setCompactMode(!compactMode)}
              className={`px-2.5 py-1.5 min-h-[34px] text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                compactMode ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
              title="Toggle compact row spacing for single-page presentation"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{compactMode ? 'Compact' : 'Standard'}</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 min-h-[34px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            {/* Print / Save PDF Button */}
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 min-h-[34px] bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t('common.print', 'Print / Save PDF')}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 min-h-[34px] min-w-[34px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE DOCUMENT BODY */}
        <div className={`space-y-4 sm:space-y-5 ${compactMode ? 'text-[11px]' : 'text-xs'}`}>

          {/* 1. OFFICIAL CORPORATE HEADER */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-800 pb-4 gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-14 w-32 sm:w-40 flex items-center justify-start shrink-0">
                <img
                  src="/sky-ariana-logo.png"
                  alt="Sky Ariana Ltd. Official Logo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-tight">
                  SKY ARIANA LTD.
                </h1>
                <p className="text-[11px] text-slate-700 font-bold uppercase tracking-wider mt-0.5">
                  Global Freight Forwarding & Logistics Operations Division
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Kabul Corporate Center, Afghanistan • Registration No: 83729-D • TIN: 9003817291
                </p>
                <p className="text-[10px] text-slate-500">
                  logistics@skyariana.com • Ocean & Intermodal Cargo Services • Port Transit Verified
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right rtl:text-left shrink-0">
              <span className="text-sm sm:text-base font-black tracking-wider uppercase text-cyan-800 block">
                {selectedShipment ? 'OFFICIAL CARGO SHIPPING WAYBILL' : 'FREIGHT SHIPMENTS & LOGISTICS MANIFEST'}
              </span>
              <span className="text-xs font-mono font-bold text-slate-900 block mt-0.5" dir="ltr">
                DOC REF: {docRef}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Issue Date: <strong className="text-slate-800 font-mono">{formatFullDate(todayStr)}</strong>
              </span>
              <span className="text-[10px] text-slate-500 block">
                Authority: <strong className="text-slate-800">Customs Clearance & Transit Authority</strong>
              </span>
            </div>
          </div>

          {/* 2. MODE SPECIFIC PRESENTATION */}
          {selectedShipment ? (
            /* =========================================================================
               MODE A: SINGLE SHIPMENT WAYBILL & CONTAINER DOSSIER
               ========================================================================= */
            <div className="space-y-4">
              {/* Shipment Primary Identification Card */}
              <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
                  <div className="flex items-center gap-2">
                    <Anchor className="w-5 h-5 text-cyan-700" />
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Shipment Reference Number</span>
                      <h2 className="text-lg font-black text-slate-900 font-mono tracking-tight" dir="ltr">
                        {selectedShipment.shipmentRef}
                      </h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-cyan-100 text-cyan-900 border border-cyan-300">
                      Status: {selectedShipment.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Port Transit Route Graphic */}
                <div className="my-3 p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs font-medium">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Origin Port / Inland Depot</span>
                    <span className="text-slate-900 font-bold text-sm">{selectedShipment.origin || 'Kandahar, Afghanistan'}</span>
                  </div>
                  <div className="flex flex-col items-center px-4">
                    <span className="text-[10px] font-mono text-cyan-700 font-semibold mb-0.5">OCEAN & INTERMODAL TRANSIT</span>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <div className="h-[2px] w-12 sm:w-20 bg-cyan-600" />
                      <Ship className="w-5 h-5 text-cyan-700" />
                      <div className="h-[2px] w-12 sm:w-20 bg-cyan-600" />
                    </div>
                  </div>
                  <div className="text-right rtl:text-left">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Destination Port / Consignee</span>
                    <span className="text-slate-900 font-bold text-sm">{selectedShipment.destination || 'Nhava Sheva, India'}</span>
                  </div>
                </div>

                {/* 4-Box Carrier & Container Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase">Ocean / Land Carrier</span>
                    <strong className="text-slate-900 font-semibold block mt-0.5">{selectedShipment.carrier || 'N/A'}</strong>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase">Container Number</span>
                    <strong className="text-slate-900 font-mono font-bold block mt-0.5" dir="ltr">{selectedShipment.containerNumber || 'N/A'}</strong>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase">Bill of Lading (B/L)</span>
                    <strong className="text-cyan-900 font-mono font-bold block mt-0.5" dir="ltr">{selectedShipment.billOfLading || 'N/A'}</strong>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[10px] text-slate-500 block uppercase">Estimated Arrival (ETA)</span>
                    <strong className="text-emerald-800 font-mono font-bold block mt-0.5" dir="ltr">
                      {selectedShipment.estimatedArrivalDate ? formatDisplayDate(selectedShipment.estimatedArrivalDate) : 'Pending Schedule'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Linked Commercial Cargo & Invoices Table */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-cyan-700" />
                    <span>Container Cargo Manifest (Proforma Commercial Invoices)</span>
                  </h3>
                  <span className="text-[11px] font-mono text-slate-600">
                    Linked Items: {(selectedShipment.shipmentInvoices || []).length}
                  </span>
                </div>

                <table className="w-full text-left text-xs border border-slate-300 rounded-lg overflow-hidden">
                  <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Invoice No</th>
                      <th className="py-2.5 px-3">Consignee / Customer</th>
                      <th className="py-2.5 px-3">Cargo Description</th>
                      <th className="py-2.5 px-3 text-right">Cartons</th>
                      <th className="py-2.5 px-3 text-right">Net Weight (KG)</th>
                      <th className="py-2.5 px-3 text-right">Value (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-slate-800">
                    {(selectedShipment.shipmentInvoices && selectedShipment.shipmentInvoices.length > 0) ? (
                      selectedShipment.shipmentInvoices.map((si: any, idx: number) => {
                        const inv = si.invoice;
                        const line = inv?.lines?.[0];
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-cyan-900" dir="ltr">{inv?.invoiceNumber || '—'}</td>
                            <td className="py-2 px-3 font-sans text-slate-800 font-medium">{inv?.customer?.companyName || '—'}</td>
                            <td className="py-2 px-3 font-sans text-slate-700">{line?.description || 'Commercial Produce'}</td>
                            <td className="py-2 px-3 text-right">{line?.cartonCount ? Number(line.cartonCount).toLocaleString() : '—'}</td>
                            <td className="py-2 px-3 text-right">{line?.quantity ? Number(line.quantity).toLocaleString() : '—'}</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-800" dir="ltr">
                              ${Number(inv?.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-500 font-sans">
                          No commercial proforma invoices explicitly linked to this container.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {selectedShipment.shipmentInvoices && selectedShipment.shipmentInvoices.length > 0 && (
                    <tfoot className="bg-slate-100 font-mono font-bold text-slate-900 border-t-2 border-slate-300">
                      <tr>
                        <td colSpan={3} className="py-2 px-3 uppercase font-sans text-[11px]">
                          Total Manifested Container Cargo
                        </td>
                        <td className="py-2 px-3 text-right">
                          {selectedShipment.shipmentInvoices.reduce((sum: number, si: any) => sum + (Number(si.invoice?.lines?.[0]?.cartonCount) || 0), 0).toLocaleString()} CTNS
                        </td>
                        <td className="py-2 px-3 text-right">
                          {selectedShipment.shipmentInvoices.reduce((sum: number, si: any) => sum + (Number(si.invoice?.lines?.[0]?.quantity) || 0), 0).toLocaleString()} KG
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-900 text-sm" dir="ltr">
                          ${selectedShipment.shipmentInvoices.reduce((sum: number, si: any) => sum + (Number(si.invoice?.totalAmount) || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Transit Milestones Audit Trail */}
              {selectedShipment.statusHistory && selectedShipment.statusHistory.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-2">
                    Official Transit Milestones & Customs Inspection Audit
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    {selectedShipment.statusHistory.map((h: any, idx: number) => (
                      <div key={idx} className="p-2 bg-white border border-slate-200 rounded flex justify-between items-start">
                        <div>
                          <strong className="text-slate-900 block font-semibold">{h.newStatus.replace(/_/g, ' ')}</strong>
                          <span className="text-slate-500 text-[10px] block mt-0.5">{h.reason || 'Milestone verified'}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0" dir="ltr">
                          {formatDisplayDate(h.changedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Regulatory & Customs Compliance Notes */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-600 space-y-1">
                <p>
                  <strong>Logistics & Regulatory Declaration:</strong> Goods contained in this container shipment are verified non-hazardous agricultural cargo (Dried Raisins / Edible Produce). Transported under certified international bill of lading guidelines with complete phytosanitary clearance.
                </p>
                <p>
                  <strong>Customs Note:</strong> The container seal is intact and verified at departure. All transit documents and cargo values conform to the attached Commercial Proforma Invoices issued by Sky Ariana Ltd.
                </p>
              </div>
            </div>
          ) : (
            /* =========================================================================
               MODE B: MASTER FREIGHT LOGISTICS MANIFEST (ALL ACTIVE SHIPMENTS)
               ========================================================================= */
            <div className="space-y-4">
              {/* Executive Summary Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Active Fleet</span>
                  <div className="text-lg font-black font-mono text-slate-900 mt-0.5">
                    {safeShipments.length} Containers
                  </div>
                  <span className="text-[10px] text-cyan-700 block mt-0.5 font-medium">
                    {inTransitCount} In Transit • {bookedCount} Booked
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Manifested Volume</span>
                  <div className="text-lg font-black font-mono text-cyan-900 mt-0.5">
                    {assignedCartons.toLocaleString()} CTNS
                  </div>
                  <span className="text-[10px] text-slate-600 block mt-0.5">
                    {assignedNetKg.toLocaleString()} KG Net Weight
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Manifested Cargo Value</span>
                  <div className="text-lg font-black font-mono text-emerald-800 mt-0.5" dir="ltr">
                    ${assignedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-emerald-700 block mt-0.5">
                    Active Commercial Coverage
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Pending Container Booking</span>
                  <div className="text-lg font-black font-mono text-amber-700 mt-0.5">
                    {unassignedInvoices.length} Invoices
                  </div>
                  <span className="text-[10px] text-amber-700 block mt-0.5">
                    {unassignedCartons.toLocaleString()} CTNS • ${unassignedValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              {/* Active Container Shipments Table */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <Ship className="w-4 h-4 text-cyan-700" />
                  <span>Active Container Shipments & Port Transit Ledger</span>
                </h3>

                <table className="w-full text-left text-xs border border-slate-300 rounded-lg overflow-hidden">
                  <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Shipment Ref</th>
                      <th className="py-2.5 px-3">Carrier & Line</th>
                      <th className="py-2.5 px-3">Container No</th>
                      <th className="py-2.5 px-3">Bill of Lading (B/L)</th>
                      <th className="py-2.5 px-3">Route (Origin → Dest)</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">ETA</th>
                      <th className="py-2.5 px-3 text-right">Invoices</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-slate-800">
                    {safeShipments.length > 0 ? (
                      safeShipments.map(s => {
                        const invCount = (s.shipmentInvoices || []).length;
                        return (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-cyan-900" dir="ltr">{s.shipmentRef}</td>
                            <td className="py-2 px-3 font-sans text-slate-800 font-medium">{s.carrier || 'N/A'}</td>
                            <td className="py-2 px-3 font-bold" dir="ltr">{s.containerNumber || 'N/A'}</td>
                            <td className="py-2 px-3 text-cyan-950 font-semibold" dir="ltr">{s.billOfLading || 'N/A'}</td>
                            <td className="py-2 px-3 font-sans text-[11px] text-slate-700">
                              {s.origin || 'Kandahar'} → {s.destination || 'Nhava Sheva'}
                            </td>
                            <td className="py-2 px-3 font-sans">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                s.status === 'IN_TRANSIT' ? 'bg-cyan-100 text-cyan-900 border border-cyan-300' :
                                s.status === 'AT_ORIGIN_PORT' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                s.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                                'bg-slate-100 text-slate-700 border border-slate-300'
                              }`}>
                                {s.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-2 px-3" dir="ltr">
                              {s.estimatedArrivalDate ? formatDisplayDate(s.estimatedArrivalDate) : 'Pending'}
                            </td>
                            <td className="py-2 px-3 text-right font-sans font-bold text-slate-800">
                              {invCount > 0 ? `${invCount} linked` : '—'}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-500 font-sans">
                          No active container freight shipments on file.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {safeShipments.length > 0 && (
                    <tfoot className="bg-slate-100 font-mono font-bold text-slate-900 border-t-2 border-slate-300">
                      <tr>
                        <td colSpan={5} className="py-2 px-3 uppercase font-sans text-[11px]">
                          Active Fleet Summary ({safeShipments.length} Total Containers)
                        </td>
                        <td colSpan={3} className="py-2 px-3 text-right text-cyan-900">
                          {inTransitCount} In Transit • {customsCount} Customs • {deliveredCount} Delivered
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Pending Container Assignment Section (Optional Toggle) */}
              {includePendingCargo && unassignedInvoices.length > 0 && (
                <div className="pt-2">
                  <div className="flex justify-between items-center mb-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-amber-700" />
                      <span>Pending Container Stuffing & Booking ({unassignedInvoices.length} Invoices Staged)</span>
                    </h3>
                    <span className="text-[11px] font-mono font-bold text-amber-900">
                      {unassignedCartons.toLocaleString()} CTNS • ${unassignedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <table className="w-full text-left text-xs border border-amber-300 rounded-lg overflow-hidden">
                    <thead className="bg-amber-950 text-white uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2 px-3">Proforma Invoice</th>
                        <th className="py-2 px-3">Consignee Company</th>
                        <th className="py-2 px-3">Cargo Description</th>
                        <th className="py-2 px-3 text-right">Cartons</th>
                        <th className="py-2 px-3 text-right">Net KG</th>
                        <th className="py-2 px-3 text-right">Total USD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 font-mono text-slate-800 bg-amber-50/30">
                      {unassignedInvoices.map(inv => {
                        const line = inv.lines && inv.lines[0];
                        return (
                          <tr key={inv.id} className="hover:bg-amber-50">
                            <td className="py-1.5 px-3 font-bold text-slate-900" dir="ltr">
                              {inv.invoiceNumber}
                              {inv.sourceInvoiceRef && <span className="text-[10px] text-amber-700 block">Ref: {inv.sourceInvoiceRef}</span>}
                            </td>
                            <td className="py-1.5 px-3 font-sans font-medium text-slate-800">{inv.customer?.companyName || '—'}</td>
                            <td className="py-1.5 px-3 font-sans text-slate-700 truncate max-w-[200px]">{line?.description || 'Commercial Produce'}</td>
                            <td className="py-1.5 px-3 text-right">{line?.cartonCount ? Number(line.cartonCount).toLocaleString() : '—'}</td>
                            <td className="py-1.5 px-3 text-right">{line?.quantity ? Number(line.quantity).toLocaleString() : '—'}</td>
                            <td className="py-1.5 px-3 text-right font-bold text-emerald-800" dir="ltr">
                              ${Number(inv.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 3. AUTHORIZED SIGNATURES & OFFICIAL CORPORATE STAMP */}
          {includeSignatures && (
            <div className="pt-6 border-t-2 border-slate-300 print-avoid-break">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                {/* Logistics Officer */}
                <div>
                  <div className="border-b border-slate-400 w-44 mb-1.5"></div>
                  <span className="text-[11px] font-bold text-slate-900 uppercase block">Director of Logistics & Shipping</span>
                  <span className="text-[10px] text-slate-600 block">Sky Ariana Ltd. Global Forwarding</span>
                  <span className="text-[9px] font-mono text-slate-400 block mt-0.5">Authorization ID: LOG-EXEC-9912</span>
                </div>

                {/* Stamped Seal */}
                <div className="flex justify-center my-2 sm:my-0">
                  <div className="w-24 h-24 rounded-full border-2 border-dashed border-cyan-800 p-1 flex flex-col items-center justify-center text-center rotate-[-6deg] shadow-xs bg-cyan-50/50">
                    <span className="text-[8px] font-black uppercase text-cyan-900 tracking-wider">SKY ARIANA LTD</span>
                    <span className="text-[7px] text-cyan-800 font-bold uppercase mt-0.5">LOGISTICS DIVISION</span>
                    <span className="text-[6px] text-cyan-700 font-mono mt-0.5">PORT DISPATCH VERIFIED</span>
                    <span className="text-[6px] text-slate-500 font-mono mt-0.5">{todayStr}</span>
                  </div>
                </div>

                {/* Port Customs Clearance Inspector */}
                <div className="sm:text-right rtl:sm:text-left">
                  <div className="border-b border-slate-400 w-44 sm:ml-auto rtl:sm:mr-auto rtl:sm:ml-0 mb-1.5"></div>
                  <span className="text-[11px] font-bold text-slate-900 uppercase block">Port & Customs Clearance Liaison</span>
                  <span className="text-[10px] text-slate-600 block">Maritime Cargo Inspection Authority</span>
                  <span className="text-[9px] font-mono text-slate-400 block mt-0.5">Verification Stamp: CUSTOMS-OK-2026</span>
                </div>
              </div>
            </div>
          )}

          {/* 4. FOOTER AUDIT METADATA */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 gap-1 font-mono">
            <span>Official Commercial Logistics Record • Sky Ariana Ltd • ISO 9001:2015 Compliant</span>
            <span>Generated on {new Date().toUTCString()} • Deterministic Verification #AQ-FRT-9921</span>
          </div>

        </div>

        {/* BOTTOM MODAL ACTION BAR (print:hidden) */}
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200 print:hidden">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs rounded-lg shadow-lg shadow-cyan-950/20 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t('common.print', 'Print / Save PDF')}</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 min-h-[44px] bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-lg transition cursor-pointer"
          >
            {t('common.close', 'Close')}
          </button>
        </div>

      </div>
    </div>
  );
};
