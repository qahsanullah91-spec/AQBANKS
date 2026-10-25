import React, { useEffect, useState } from 'react';
import { api, getUserRole } from '../services/api';
import { Invoice, Customer, InvoiceLine, RemittanceProfile } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useAutoSave } from '../utils/useAutoSave';
import { AutoSaveIndicator, DraftRecoveryBanner } from '../components/AutoSaveIndicator';
import { SearchableSelect } from '../components/SearchableSelect';
import {
  FileText,
  Plus,
  Printer,
  Ban,
  CheckCircle,
  Search,
  AlertTriangle,
  X,
  RotateCcw,
  Check,
  Building2,
  Globe,
  Eye,
  ShieldCheck,
  Clock,
  DollarSign,
  Edit,
  Trash2,
  Banknote,
  RefreshCw,
  Copy,
  UserPlus
} from 'lucide-react';
import { formatDisplayDate, formatDateForInput } from '../utils/date';
import { formatAmountInWords } from '../utils/numberToWords';
import { triggerPrint } from '../utils/print';

export const Invoices: React.FC = () => {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const userRole = getUserRole();
  const canMutateInvoices = userRole === 'ADMIN' || userRole === 'FINANCE_MGR' || userRole === 'FINANCE_MANAGER';
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [remittanceProfiles, setRemittanceProfiles] = useState<RemittanceProfile[]>([]);
  const [bankBalance, setBankBalance] = useState<number | string>('24259.61');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [copiedWire, setCopiedWire] = useState(false);

  // Add Customer Modal State
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [addCustomerTarget, setAddCustomerTarget] = useState<'create' | 'edit'>('create');
  const [newCustName, setNewCustName] = useState('');
  const [newCustCountry, setNewCustCountry] = useState('');
  const [newCustAddress1, setNewCustAddress1] = useState('');
  const [newCustAddress2, setNewCustAddress2] = useState('');
  const [newCustContact, setNewCustContact] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustSubmitting, setNewCustSubmitting] = useState(false);
  const [newCustError, setNewCustError] = useState<string | null>(null);

  const resetNewCustomerForm = () => {
    setNewCustName('');
    setNewCustCountry('');
    setNewCustAddress1('');
    setNewCustAddress2('');
    setNewCustContact('');
    setNewCustEmail('');
    setNewCustPhone('');
    setNewCustError(null);
    setNewCustSubmitting(false);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      setNewCustError('Company / Buyer Name is required');
      return;
    }
    try {
      setNewCustSubmitting(true);
      setNewCustError(null);
      const payload = {
        companyName: newCustName.trim(),
        country: newCustCountry.trim() || undefined,
        addressLine1: newCustAddress1.trim() || undefined,
        addressLine2: newCustAddress2.trim() || undefined,
        contactPerson: newCustContact.trim() || undefined,
        email: newCustEmail.trim() || undefined,
        phone: newCustPhone.trim() || undefined,
        isCustomer: true,
        isVendor: false
      };
      const createdCust = await api.createCustomer(payload);

      // Add to customers state list
      setCustomers(prev => {
        const filtered = prev.filter(c => c.id !== createdCust.id);
        return [...filtered, createdCust].sort((a, b) => a.companyName.localeCompare(b.companyName));
      });

      // Auto-select in active modal
      if (addCustomerTarget === 'create') {
        setCustomerId(createdCust.id);
      } else {
        setEditCustomerId(createdCust.id);
      }

      toast.success(t('invoices.clientCreatedSuccess', `Client "${createdCust.companyName}" successfully registered and assigned!`));
      resetNewCustomerForm();
      setShowAddCustomerModal(false);
    } catch (err: any) {
      setNewCustError(err.message || 'Failed to register client');
      toast.error(err.message || 'Failed to register client');
    } finally {
      setNewCustSubmitting(false);
    }
  };

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<any | null>(null);
  const [voidInvoiceId, setVoidInvoiceId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Edit Invoice Modal State
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editSourceRef, setEditSourceRef] = useState('');
  const [editIssueDate, setEditIssueDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPaymentTerms, setEditPaymentTerms] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<any>('UNPAID');
  const [editLines, setEditLines] = useState<any[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Record Payment Modal State
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [swiftFeeDeducted, setSwiftFeeDeducted] = useState<string>('0');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bankReference, setBankReference] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [autoCreateReceiptLedger, setAutoCreateReceiptLedger] = useState<boolean>(true);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Delete Invoice Modal State
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);

  // New Invoice Form State
  const [customerId, setCustomerId] = useState('');
  const [remittanceProfileId, setRemittanceProfileId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState('100% Advance Payment');
  const [lines, setLines] = useState<InvoiceLine[]>([
    {
      lineNumber: 1,
      description: 'Black Raisins (Best) - 1,385 CTNS',
      cartonCount: 1385,
      packagingKgPerCarton: 16,
      quantity: 22160,
      unitOfMeasure: 'KG',
      unitPrice: 3.58,
      lineTotal: 79332.80
    }
  ]);

  // Close open modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAddCustomerModal) {
          setShowAddCustomerModal(false);
          resetNewCustomerForm();
        }
        else if (previewInvoice) setPreviewInvoice(null);
        else if (showCreateModal) setShowCreateModal(false);
        else if (editingInvoice) setEditingInvoice(null);
        else if (paymentModalInvoice) setPaymentModalInvoice(null);
        else if (voidInvoiceId) setVoidInvoiceId(null);
        else if (deleteInvoiceId) setDeleteInvoiceId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddCustomerModal, previewInvoice, showCreateModal, editingInvoice, paymentModalInvoice, voidInvoiceId, deleteInvoiceId]);

  // Create Invoice Auto-Save
  const createDraftData = {
    customerId,
    remittanceProfileId,
    issueDate,
    paymentTerms,
    lines
  };

  const createAutoSave = useAutoSave(
    'aq_draft_invoice_new',
    createDraftData,
    800,
    showCreateModal
  );

  const handleRestoreCreateDraft = () => {
    const draft = createAutoSave.getSavedDraft();
    if (draft) {
      if (draft.customerId) setCustomerId(draft.customerId);
      if (draft.remittanceProfileId) setRemittanceProfileId(draft.remittanceProfileId);
      if (draft.issueDate) setIssueDate(draft.issueDate);
      if (draft.paymentTerms) setPaymentTerms(draft.paymentTerms);
      if (draft.lines && draft.lines.length > 0) setLines(draft.lines);
      toast.info('Restored unsaved invoice draft');
    }
  };

  const handleDiscardCreateDraft = () => {
    createAutoSave.discardDraft();
    setLines([
      {
        lineNumber: 1,
        description: 'Black Raisins (Best) - 1,385 CTNS',
        cartonCount: 1385,
        packagingKgPerCarton: 16,
        quantity: 22160,
        unitOfMeasure: 'KG',
        unitPrice: 3.58,
        lineTotal: 79332.80
      }
    ]);
    toast.info('Invoice draft discarded');
  };

  // Edit Invoice Auto-Save
  const editDraftData = {
    editCustomerId,
    editSourceRef,
    editIssueDate,
    editDueDate,
    editPaymentTerms,
    editPaymentStatus,
    editLines
  };

  const editAutoSave = useAutoSave(
    editingInvoice ? `aq_draft_invoice_edit_${editingInvoice.id}` : 'aq_draft_invoice_edit_temp',
    editDraftData,
    800,
    Boolean(editingInvoice)
  );

  const handleRestoreEditDraft = () => {
    const draft = editAutoSave.getSavedDraft();
    if (draft) {
      if (draft.editCustomerId) setEditCustomerId(draft.editCustomerId);
      if (draft.editSourceRef !== undefined) setEditSourceRef(draft.editSourceRef);
      if (draft.editIssueDate) setEditIssueDate(draft.editIssueDate);
      if (draft.editDueDate !== undefined) setEditDueDate(draft.editDueDate);
      if (draft.editPaymentTerms) setEditPaymentTerms(draft.editPaymentTerms);
      if (draft.editPaymentStatus) setEditPaymentStatus(draft.editPaymentStatus);
      if (draft.editLines && draft.editLines.length > 0) setEditLines(draft.editLines);
      toast.info('Restored unsaved invoice edits');
    }
  };

  // Payment Auto-Save
  const paymentDraftData = {
    paymentAmount,
    swiftFeeDeducted,
    paymentDate,
    bankReference,
    paymentNotes,
    autoCreateReceiptLedger
  };

  const paymentAutoSave = useAutoSave(
    paymentModalInvoice ? `aq_draft_payment_${paymentModalInvoice.id}` : 'aq_draft_payment_temp',
    paymentDraftData,
    800,
    Boolean(paymentModalInvoice)
  );

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [invRes, custRes, profRes, ovRes] = await Promise.all([
        api.getInvoices({ search, status: statusFilter || undefined }),
        api.getCustomers(),
        api.getRemittanceProfiles(),
        api.getDashboardOverview().catch(() => null)
      ]);
      setInvoices(invRes);
      setCustomers(custRes);
      setRemittanceProfiles(profRes);
      if (ovRes?.metrics?.availableBalance) {
        setBankBalance(ovRes.metrics.availableBalance);
      }
      if (custRes.length > 0 && !customerId) {
        setCustomerId(custRes[0].id);
      }
      if (profRes.length > 0 && !remittanceProfileId) {
        const def = profRes.find((p: any) => p.isDefault && p.isActive) || profRes.find((p: any) => p.isActive) || profRes[0];
        if (def) setRemittanceProfileId(def.id);
      }
    } catch (err: any) {
      console.error('Failed to load invoices:', err);
      setError(err.message || 'Failed to load proforma invoices from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
  };

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        lineNumber: lines.length + 1,
        description: 'Black Raisins - New Batch',
        cartonCount: 2295,
        packagingKgPerCarton: 10,
        quantity: 22950,
        unitOfMeasure: 'KG',
        unitPrice: 3.25,
        lineTotal: 74587.50
      }
    ]);
  };

  const handleUpdateLine = (index: number, field: string, value: any) => {
    const updated = [...lines];
    (updated[index] as any)[field] = value;

    if (field === 'cartonCount' || field === 'packagingKgPerCarton') {
      const c = Number(updated[index].cartonCount) || 0;
      const pkg = Number(updated[index].packagingKgPerCarton) || 0;
      if (c > 0 && pkg > 0) {
        updated[index].quantity = c * pkg;
      }
    }

    const qty = Number(updated[index].quantity) || 0;
    const price = Number(updated[index].unitPrice) || 0;
    updated[index].lineTotal = Number((qty * price).toFixed(2));
    setLines(updated);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const calculateFormTotal = () => {
    return (lines || []).reduce((sum, l) => sum + (Number(l.lineTotal) || 0), 0);
  };

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutateInvoices) {
      toast.error('Access Denied: You do not have permissions to create proforma invoices.');
      return;
    }
    setCreateError(null);

    if (!customerId) {
      setCreateError(t('invoices.validationError', 'Please select a buyer / consignee company.'));
      return;
    }

    const invalidLine = lines.find(l => !l.description.trim() || Number(l.quantity) <= 0 || Number(l.unitPrice) <= 0);
    if (invalidLine) {
      setCreateError(t('invoices.validationError', 'All line items must have a description, positive quantity, and positive price.'));
      return;
    }

    try {
      const created = await api.createInvoice({
        customerId,
        remittanceProfileId: remittanceProfileId || undefined,
        issueDate,
        paymentTerms,
        lines: lines.map(l => ({
          description: l.description,
          cartonCount: l.cartonCount ? Number(l.cartonCount) : undefined,
          packagingKgPerCarton: l.packagingKgPerCarton ? Number(l.packagingKgPerCarton) : undefined,
          quantity: Number(l.quantity),
          unitOfMeasure: l.unitOfMeasure,
          unitPrice: Number(l.unitPrice)
        }))
      });

      // Clear draft on successful save
      createAutoSave.clearDraft();

      // Immediately prepend new invoice to list
      setInvoices(prev => [created, ...prev.filter(i => i.id !== created.id)]);
      setShowCreateModal(false);
      toast.success(t('invoices.createSuccess', 'Proforma invoice created successfully!'));

      // Reload fresh data from backend
      loadData();
    } catch (err: any) {
      console.error('Create invoice error:', err);
      setCreateError(err.message || 'Failed to create invoice');
      toast.error(err.message || 'Failed to create invoice');
    }
  };

  const handleIssue = async (id: string) => {
    if (!canMutateInvoices) {
      toast.error('Access Denied: Only Administrator or Finance Manager can issue proforma invoices.');
      return;
    }
    if (!confirm(t('invoices.issueConfirm', 'Issuing this invoice will freeze line items and banking details permanently. Proceed?'))) return;
    try {
      await api.issueInvoice(id);
      toast.success('Invoice issued successfully');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to issue invoice');
    }
  };

  const handleVoid = async () => {
    if (!canMutateInvoices) {
      toast.error('Access Denied: Only Administrator or Finance Manager can void proforma invoices.');
      return;
    }
    if (!voidInvoiceId || !voidReason) return;
    try {
      await api.voidInvoice(voidInvoiceId, voidReason);
      setVoidInvoiceId(null);
      setVoidReason('');
      toast.success('Invoice voided successfully');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to void invoice');
    }
  };

  const handleOpenRecordPayment = (inv: Invoice) => {
    setPaymentModalInvoice(inv);
    const total = Number(inv.totalAmount) || 0;
    const remaining = Math.max(0, Number(inv.remainingBalance ?? total) || 0);
    // Prefill with the outstanding balance, not the full invoice total
    setPaymentAmount(remaining > 0 ? remaining.toFixed(2) : '0.00');
    setSwiftFeeDeducted('0');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setBankReference(`AUB-${inv.invoiceNumber}`);
    setPaymentNotes(`Advance settlement for ${inv.invoiceNumber}`);
    setAutoCreateReceiptLedger(true);
    setPaymentError(null);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalInvoice) return;
    const numAmt = parseFloat(paymentAmount);
    if (isNaN(numAmt) || numAmt <= 0) {
      setPaymentError('Please enter a valid positive payment amount');
      return;
    }
    const numFee = parseFloat(swiftFeeDeducted) || 0;
    if (numFee < 0) {
      setPaymentError('SWIFT fee cannot be negative');
      return;
    }
    if (numFee >= numAmt) {
      setPaymentError('SWIFT fee cannot be greater than or equal to the payment amount');
      return;
    }
    const remainingDue = Math.max(0, Number(paymentModalInvoice.remainingBalance ?? paymentModalInvoice.totalAmount) || 0);
    if (numAmt > remainingDue + 0.005) {
      setPaymentError(`Payment of $${numAmt.toFixed(2)} exceeds the outstanding balance of $${remainingDue.toFixed(2)}. Record the exact amount received.`);
      return;
    }
    try {
      setPaymentSubmitting(true);
      await api.recordInvoicePayment(paymentModalInvoice.id, {
        amount: numAmt,
        swiftFeeDeducted: numFee,
        paymentDate,
        bankReference: bankReference || undefined,
        notes: paymentNotes || undefined,
        createReceiptAndLedger: autoCreateReceiptLedger
      });
      paymentAutoSave.clearDraft();
      setPaymentModalInvoice(null);
      toast.success(`Payment recorded successfully for invoice ${paymentModalInvoice.invoiceNumber}`);
      loadData();
    } catch (err: any) {
      setPaymentError(err.message || 'Failed to record payment');
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleTogglePayment = async (inv: Invoice) => {
    if (!canMutateInvoices) return;
    try {
      await api.toggleInvoicePayment(inv.id);
      toast.success(`Payment status toggled for ${inv.invoiceNumber}`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle payment status');
    }
  };

  const handleOpenEdit = (inv: Invoice) => {
    setEditingInvoice(inv);
    setEditCustomerId(inv.customerId);
    setEditSourceRef(inv.sourceInvoiceRef || '');
    setEditIssueDate(formatDateForInput(inv.issueDate));
    setEditDueDate(inv.dueDate ? formatDateForInput(inv.dueDate) : '');
    setEditPaymentTerms(inv.paymentTerms || '100% Advance Payment');
    setEditPaymentStatus(inv.paymentStatus || 'UNPAID');
    setEditLines(inv.lines && inv.lines.length > 0 ? inv.lines.map(l => ({
      lineNumber: l.lineNumber,
      description: l.description,
      cartonCount: l.cartonCount || undefined,
      packagingKgPerCarton: l.packagingKgPerCarton || undefined,
      quantity: Number(l.quantity),
      unitOfMeasure: l.unitOfMeasure || 'KG',
      unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal)
    })) : [
      {
        lineNumber: 1,
        description: 'Commercial Cargo',
        quantity: 1000,
        unitOfMeasure: 'KG',
        unitPrice: 2.50,
        lineTotal: 2500
      }
    ]);
    setEditError(null);
  };

  const handleUpdateEditLine = (index: number, field: string, value: any) => {
    const updated = [...editLines];
    updated[index][field] = value;
    if (field === 'cartonCount' || field === 'packagingKgPerCarton') {
      const c = Number(updated[index].cartonCount) || 0;
      const pkg = Number(updated[index].packagingKgPerCarton) || 0;
      if (c > 0 && pkg > 0) {
        updated[index].quantity = c * pkg;
      }
    }
    const qty = Number(updated[index].quantity) || 0;
    const price = Number(updated[index].unitPrice) || 0;
    updated[index].lineTotal = Number((qty * price).toFixed(2));
    setEditLines(updated);
  };

  const handleAddEditLine = () => {
    setEditLines([
      ...editLines,
      {
        lineNumber: editLines.length + 1,
        description: 'Additional Cargo Item',
        quantity: 1000,
        unitOfMeasure: 'KG',
        unitPrice: 2.50,
        lineTotal: 2500
      }
    ]);
  };

  const handleRemoveEditLine = (index: number) => {
    if (editLines.length <= 1) return;
    setEditLines(editLines.filter((_, i) => i !== index));
  };

  const calculateEditFormTotal = () => {
    return (editLines || []).reduce((sum, l) => sum + (Number(l.lineTotal) || 0), 0);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;
    if (!editCustomerId) {
      setEditError('Please select a customer');
      return;
    }
    const invalidLine = editLines.find(l => !l.description.trim() || Number(l.quantity) <= 0 || Number(l.unitPrice) <= 0);
    if (invalidLine) {
      setEditError('All line items must have a valid description, positive quantity, and unit price.');
      return;
    }
    try {
      setEditSubmitting(true);
      await api.updateInvoice(editingInvoice.id, {
        customerId: editCustomerId,
        sourceInvoiceRef: editSourceRef || undefined,
        issueDate: editIssueDate,
        dueDate: editDueDate || undefined,
        paymentTerms: editPaymentTerms,
        paymentStatus: editPaymentStatus,
        lines: editLines.map(l => ({
          description: l.description,
          cartonCount: l.cartonCount ? Number(l.cartonCount) : undefined,
          packagingKgPerCarton: l.packagingKgPerCarton ? Number(l.packagingKgPerCarton) : undefined,
          quantity: Number(l.quantity),
          unitOfMeasure: l.unitOfMeasure,
          unitPrice: Number(l.unitPrice)
        }))
      });
      editAutoSave.clearDraft();
      setEditingInvoice(null);
      toast.success(`Invoice ${editingInvoice.invoiceNumber} updated successfully!`);
      loadData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update invoice');
      toast.error(err.message || 'Failed to update invoice');
    } finally {
      setEditSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteInvoiceId) return;
    try {
      setDeleting(true);
      await api.deleteInvoice(deleteInvoiceId.id);
      setDeleteInvoiceId(null);
      toast.success(`Invoice ${deleteInvoiceId.invoiceNumber} deleted successfully.`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete invoice');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenPrintPreview = async (id: string) => {
    try {
      const data = await api.getInvoicePdfData(id);
      setPreviewInvoice(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load invoice layout');
    }
  };

  const handleCopyWireDetails = (inv: any) => {
    if (!inv) return;
    const text = `
==================================================
SKY ARIANA LTD - OFFICIAL USD WIRE INSTRUCTIONS
Proforma Invoice: ${inv.invoiceNumber}
Date: ${inv.issueDate}
Consignee: ${inv.customer?.companyName || ''}
Total Amount: ${inv.grandTotal}
==================================================

1. BENEFICIARY DETAILS (Field 59A & 57A):
• Beneficiary Name: SKY ARIANA LTD (Field 59A)
• Account Number: 101502USD2940472
• Beneficiary Bank: AFGHAN UNITED BANK
• Bank Address: AUB Building, Zarghona Maidan, Shahr-e-Now, Kabul
• SWIFT / BIC: AFGUAFKAXXX (Field 57A)

2. CORRESPONDENT & INTERMEDIARY ROUTING (Field 56A & 54A):
• Correspondent Bank: AL SALAM BANK BAHRAIN
• Correspondent SWIFT: ALSABHBMXXX (Field 56A)
• AUB A/C with Al Salam: BH61ALSA00500951200102
• Intermediary Bank: JPMorgan Chase Bank, New York (Field 54A)
• Intermediary SWIFT: CHASUS33
• Intermediary A/C: 400758954 | Sanabis, Bahrain

CRITICAL SWIFT MT103 MANDATORY ROUTING:
For all USD remittances, the remitting bank MUST specify AL SALAM BANK BAHRAIN (SWIFT: ALSABHBMXXX, A/C: 400758954) in Field 56A and JPMorgan Chase (CHASUS33) in Field 54A. Beneficiary account in Field 59A.
Local Clearing: DA AFGHANISTAN BANK (DAB) • SWIFT: AFGBAFKA • A/C: 3000205027231
==================================================
`.trim();

    navigator.clipboard.writeText(text);
    setCopiedWire(true);
    toast.success('SWIFT Wire & Bank Instructions copied to clipboard!');
    setTimeout(() => setCopiedWire(false), 2500);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{t('invoices.title')}</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            {t('invoices.subtitle')}
          </p>
        </div>
        {canMutateInvoices ? (
          <button
            onClick={() => {
              setCreateError(null);
              setShowCreateModal(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-950 transition w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" /> {t('invoices.createInvoice')}
          </button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Read-Only Commercial Mode ({userRole})</span>
          </div>
        )}
      </div>

      {/* 3-Card Summary KPI Strip */}
      {(() => {
        const issuedInvoices = (invoices || []).filter(i => i.status !== 'VOID');
        const totalInvoiced = issuedInvoices.reduce((sum, i) => sum + Number(i.totalAmount || 0), 0);
        const paidInvoices = issuedInvoices.filter(i => i.paymentStatus === 'PAID');
        const totalPaid = paidInvoices.reduce((sum, i) => sum + Number(i.totalAmount || 0), 0);
        const unpaidInvoices = issuedInvoices.filter(i => i.paymentStatus !== 'PAID' && i.paymentStatus !== 'CANCELED');
        const totalUnpaid = unpaidInvoices.reduce((sum, i) => sum + Number(i.totalAmount || 0), 0);

        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Card 1: Total Invoiced (All Time) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md flex items-center justify-between">
              <div>
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Total Invoiced (All Time)
                </span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums mt-1" dir="ltr">
                  ${totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold block mt-0.5">
                  {issuedInvoices.length} Invoices
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            {/* Card 2: Total Collected (Paid) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md flex items-center justify-between">
              <div>
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Total Collected (Paid)
                </span>
                <div className="text-xl sm:text-2xl font-black text-blue-700 dark:text-blue-400 font-mono tabular-nums mt-1" dir="ltr">
                  ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[11px] text-blue-700 dark:text-blue-300 font-semibold block mt-0.5">
                  {paidInvoices.length} Invoices
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/80 border border-blue-300 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>

            {/* Card 3: Pending Receivables (Unpaid) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md flex items-center justify-between">
              <div>
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Pending Receivables (Unpaid)
                </span>
                <div className="text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-400 font-mono tabular-nums mt-1" dir="ltr">
                  ${totalUnpaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold block mt-0.5">
                  {unpaidInvoices.length} Invoices
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Global Success Notification */}
      {successMessage && (
        <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-200 px-4 py-3 rounded-lg text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="p-1 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error Alert Banner with Retry Button */}
      {error && (
        <div className="bg-rose-950/80 border border-rose-700 text-rose-200 px-4 py-3 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadData}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-800 hover:bg-rose-700 text-white rounded text-xs font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> {t('common.retry', 'Retry')}
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className={`w-4 h-4 text-slate-500 absolute top-3.5 ${isRtl ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            placeholder={t('invoices.searchPlaceholder')}
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
          <option value="">{t('invoices.allStatuses')}</option>
          <option value="DRAFT">{t('invoices.draftOnly')}</option>
          <option value="ISSUED">{t('invoices.issuedOnly')}</option>
          <option value="VOID">{t('invoices.voidOnly')}</option>
        </select>
        {(search || statusFilter) && (
          <button
            onClick={handleClearFilters}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
          >
            <X className="w-3.5 h-3.5" /> {t('common.clearFilters', 'Clear Filters')}
          </button>
        )}
      </div>

      {/* MOBILE CARD VIEW (< 640px) */}
      <div className="block sm:hidden space-y-3">
        {loading ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            {t('invoices.loading')}
          </div>
        ) : invoices.length > 0 ? (
          invoices.map(inv => {
            const firstLine = inv.lines && inv.lines[0];
            const shp = inv.shipmentInvoices?.[0]?.shipment;

            return (
              <div key={inv.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-sm">
                      <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span dir="ltr" className="font-mono">{inv.invoiceNumber}</span>
                    </div>
                    {inv.sourceInvoiceRef && (
                      <span dir="ltr" className="text-[11px] text-amber-800 dark:text-amber-300 font-mono font-semibold block mt-0.5">
                        Ref: {inv.sourceInvoiceRef}
                      </span>
                    )}
                    <span dir="ltr" className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 font-mono">
                      {formatDisplayDate(inv.issueDate)}
                    </span>
                  </div>
                  <div className="text-right rtl:text-left">
                    <span dir="ltr" className="font-mono font-extrabold text-emerald-700 dark:text-emerald-400 text-sm block tabular-nums">
                      ${Number(inv.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {(() => {
                      const total = Number(inv.totalAmount) || 0;
                      const rem = Math.max(0, Number(inv.remainingBalance ?? total) || 0);
                      if (inv.status !== 'VOID' && rem > 0 && rem < total - 0.005) {
                        return (
                          <span dir="ltr" className="block text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                            Due: ${rem.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        );
                      }
                      return null;
                    })()}
                    <div className="flex gap-1 justify-end rtl:justify-start mt-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        inv.status === 'ISSUED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' :
                        inv.status === 'VOID' ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' :
                        'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      }`}>
                        {t(`status.${inv.status.toLowerCase()}`, inv.status)}
                      </span>
                      <button
                        onClick={() => handleTogglePayment(inv)}
                        title="Toggle Payment Status"
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          inv.paymentStatus === 'PAID' ? 'bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' :
                          inv.paymentStatus === 'PARTIALLY_PAID' ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' :
                          inv.paymentStatus === 'OVERDUE' ? 'bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800' :
                          inv.paymentStatus === 'CANCELED' ? 'bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' :
                          'bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}
                      >
                        {t(`status.${inv.paymentStatus.toLowerCase().replace('_', '')}`, inv.paymentStatus)}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-700 dark:text-slate-300 border-t border-slate-200 dark:border-slate-800/80 pt-2 font-medium">
                  {inv.customer?.companyName || 'Unknown Customer'}
                  {inv.customer?.country && <span className="text-slate-500 text-[11px] ml-2 font-normal">({inv.customer.country})</span>}
                </div>

                {firstLine && (
                  <div className="text-[11px] bg-slate-50 dark:bg-slate-950/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-0.5">
                    <span className="text-slate-900 dark:text-slate-200 font-semibold block">{firstLine.description}</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-medium block" dir="ltr">
                      {firstLine.cartonCount ? `${Number(firstLine.cartonCount).toLocaleString()} CTNS • ` : ''}
                      {Number(firstLine.quantity).toLocaleString()} KG @ ${Number(firstLine.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/KG
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-500 dark:text-slate-400">Logistics:</span>
                  {shp ? (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      shp.status === 'IN_TRANSIT' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' :
                      shp.status === 'AT_ORIGIN_PORT' ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' :
                      'bg-cyan-100 text-cyan-800 border border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800'
                    }`}>
                      {shp.shipmentRef} ({shp.status.replace(/_/g, ' ')})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800/90 dark:text-amber-300/80 dark:border-slate-700">
                      Pending Dispatch / Unassigned
                    </span>
                  )}
                </div>

                {/* Mobile Touch Action Buttons (Min 44px target) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                  <button
                    onClick={() => {
                      if (!canMutateInvoices) {
                        toast.error('Access Denied: Only Administrator or Finance Manager can record payments.');
                        return;
                      }
                      handleOpenRecordPayment(inv);
                    }}
                    className="flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:border-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-lg transition"
                  >
                    <Banknote className="w-4 h-4" /> Pay
                  </button>
                  <button
                    onClick={() => {
                      if (!canMutateInvoices) {
                        toast.error('Access Denied: Only Administrator or Finance Manager can edit invoices.');
                        return;
                      }
                      handleOpenEdit(inv);
                    }}
                    className="flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] bg-sky-50 hover:bg-sky-100 border border-sky-300 text-sky-700 dark:bg-sky-950 dark:hover:bg-sky-900 dark:border-sky-800 dark:text-sky-300 text-xs font-semibold rounded-lg transition"
                  >
                    <Edit className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => handleOpenPrintPreview(inv.id)}
                    className="flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition"
                  >
                    <Printer className="w-4 h-4 text-slate-500 dark:text-slate-400" /> Print
                  </button>
                  <button
                    onClick={() => {
                      if (!canMutateInvoices) {
                        toast.error('Access Denied: Only Administrator or Finance Manager can void or delete invoices.');
                        return;
                      }
                      setDeleteInvoiceId(inv);
                    }}
                    className="flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 dark:bg-rose-950 dark:hover:bg-rose-900 dark:border-rose-800 dark:text-rose-300 text-xs font-semibold rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs bg-slate-900 border border-slate-800 rounded-xl p-6">
            {t('invoices.emptyState')}
          </div>
        )}
      </div>

      {/* DESKTOP TABLE VIEW (>= 640px) */}
      <div className="hidden sm:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className={`py-3 px-3.5 ${isRtl ? 'text-right' : 'text-left'}`}>{t('invoices.invoiceNo')}</th>
                <th className={`py-3 px-2.5 ${isRtl ? 'text-right' : 'text-left'}`}>{t('invoices.sourceRef')}</th>
                <th className={`py-3 px-2.5 ${isRtl ? 'text-right' : 'text-left'}`}>{t('invoices.issueDate')}</th>
                <th className={`py-3 px-3.5 ${isRtl ? 'text-right' : 'text-left'}`}>{t('invoices.buyerConsignee')}</th>
                <th className={`py-3 px-3.5 ${isRtl ? 'text-right' : 'text-left'}`}>Item & Weight</th>
                <th className={`py-3 px-3.5 ${isRtl ? 'text-right' : 'text-left'}`}>Logistics / Freight</th>
                <th className={`py-3 px-2.5 ${isRtl ? 'text-right' : 'text-left'}`}>{t('invoices.lifecycle')}</th>
                <th className={`py-3 px-2.5 ${isRtl ? 'text-right' : 'text-left'}`}>{t('invoices.paymentStatus')}</th>
                <th className={`py-3 px-3.5 ${isRtl ? 'text-left' : 'text-right'}`}>{t('invoices.totalUsd')}</th>
                <th className="py-3 px-3 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-400 font-sans">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    {t('invoices.loading')}
                  </td>
                </tr>
              ) : invoices.length > 0 ? (
                invoices.map(inv => {
                  const firstLine = inv.lines && inv.lines[0];
                  const shp = inv.shipmentInvoices?.[0]?.shipment;

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-emerald-50/50 dark:hover:bg-slate-800/50 hover:border-l-4 hover:border-l-emerald-600 dark:hover:border-l-emerald-500 border-l-4 border-l-transparent transition"
                    >
                      <td className={`py-3 px-3.5 font-bold text-slate-900 dark:text-white flex items-center gap-1.5 ${isRtl ? 'text-right' : 'text-left'}`}>
                        <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span dir="ltr">{inv.invoiceNumber}</span>
                      </td>
                      <td className="py-3 px-2.5 text-amber-800 dark:text-amber-300 font-semibold" dir="ltr">
                        {inv.sourceInvoiceRef || '-'}
                      </td>
                      <td className="py-3 px-2.5 text-slate-600 dark:text-slate-400" dir="ltr">
                        {formatDisplayDate(inv.issueDate)}
                      </td>
                      <td className={`py-3 px-3.5 font-sans ${isRtl ? 'text-right' : 'text-left'}`}>
                        <div className="font-semibold text-slate-900 dark:text-slate-200">
                          {inv.customer?.companyName || 'Unknown Customer'}
                        </div>
                        {inv.customer?.country && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-sans">
                            {inv.customer.country}
                          </div>
                        )}
                      </td>
                      <td className={`py-3 px-3.5 ${isRtl ? 'text-right' : 'text-left'}`}>
                        {firstLine ? (
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-slate-100 font-sans block truncate max-w-[210px]" title={firstLine.description}>
                              {firstLine.description}
                            </span>
                            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono block mt-0.5 font-medium" dir="ltr">
                              {firstLine.cartonCount ? `${Number(firstLine.cartonCount).toLocaleString()} CTNS • ` : ''}
                              {Number(firstLine.quantity).toLocaleString()} KG @ ${Number(firstLine.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/KG
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-sans">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 font-sans">
                        {shp ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
                            shp.status === 'IN_TRANSIT' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' :
                            shp.status === 'AT_ORIGIN_PORT' ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' :
                            'bg-cyan-100 text-cyan-800 border border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800'
                          }`}>
                            {shp.shipmentRef} ({shp.status.replace(/_/g, ' ')})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800/90 dark:text-amber-300/80 dark:border-slate-700 whitespace-nowrap">
                            Pending Dispatch / Unassigned
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                          inv.status === 'ISSUED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' :
                          inv.status === 'VOID' ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' :
                          'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                        }`}>
                          {t(`status.${inv.status.toLowerCase()}`, inv.status)}
                        </span>
                      </td>
                      <td className="py-3 px-2.5">
                        <button
                          onClick={() => handleTogglePayment(inv)}
                          title="Click to toggle Paid / Unpaid"
                          className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold transition hover:opacity-80 ${
                            inv.paymentStatus === 'PAID' ? 'bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' :
                            inv.paymentStatus === 'PARTIALLY_PAID' ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' :
                            inv.paymentStatus === 'OVERDUE' ? 'bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800' :
                            inv.paymentStatus === 'CANCELED' ? 'bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' :
                            'bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                          }`}
                        >
                          {t(`status.${inv.paymentStatus.toLowerCase().replace('_', '')}`, inv.paymentStatus)}
                        </button>
                      </td>
                      <td className={`py-3 px-3.5 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                        <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                          ${Number(inv.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {(() => {
                          const total = Number(inv.totalAmount) || 0;
                          const rem = Math.max(0, Number(inv.remainingBalance ?? total) || 0);
                          const rows: JSX.Element[] = [];
                          if (inv.status !== 'VOID' && rem > 0 && rem < total - 0.005) {
                            rows.push(
                              <span key="due" className="block text-[10px] text-amber-700 dark:text-amber-400 font-sans font-semibold mt-0.5">
                                Due: ${rem.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            );
                          }
                          if (inv.status === 'ISSUED' && rem > 0) {
                            const days = Math.floor((Date.now() - new Date(inv.issueDate).getTime()) / 86400000);
                            if (days >= 30) {
                              rows.push(
                                <span key="aging" className={`inline-block mt-0.5 px-1.5 py-0 rounded text-[9px] font-sans font-bold border ${
                                  days >= 60
                                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                }`}>
                                  {days}d Outstanding
                                </span>
                              );
                            }
                          }
                          return rows;
                        })()}
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* 1. 💵 Mark as Paid / Record Payment */}
                          <button
                            onClick={() => {
                              if (!canMutateInvoices) {
                                toast.error('Access Denied: Only Administrator or Finance Manager can record payments.');
                                return;
                              }
                              handleOpenRecordPayment(inv);
                            }}
                            title="💵 Record Payment / Mark as Paid"
                            className="p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border border-emerald-200/80 rounded transition dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-950/70 dark:border-transparent dark:hover:border-emerald-800"
                          >
                            <Banknote className="w-4 h-4" />
                          </button>

                          {/* 2. ✏️ Edit Invoice */}
                          <button
                            onClick={() => {
                              if (!canMutateInvoices) {
                                toast.error('Access Denied: Only Administrator or Finance Manager can edit invoices.');
                                return;
                              }
                              handleOpenEdit(inv);
                            }}
                            title="✏️ Edit Invoice"
                            className="p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center text-sky-600 hover:text-sky-700 hover:bg-sky-50 border border-sky-200/80 rounded transition dark:text-sky-400 dark:hover:text-sky-300 dark:hover:bg-sky-950/70 dark:border-transparent dark:hover:border-sky-800"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* 3. 🖨️ Print / PDF Preview */}
                          <button
                            onClick={() => handleOpenPrintPreview(inv.id)}
                            title="🖨️ Print / PDF Preview"
                            className="p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded transition dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/80 dark:border-transparent dark:hover:border-slate-700"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* 4. 🗑️ Void / Delete */}
                          <button
                            onClick={() => {
                              if (!canMutateInvoices) {
                                toast.error('Access Denied: Only Administrator or Finance Manager can void or delete invoices.');
                                return;
                              }
                              setDeleteInvoiceId(inv);
                            }}
                            title="🗑️ Void / Delete Invoice"
                            className="p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200/80 rounded transition dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-950/70 dark:border-transparent dark:hover:border-rose-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-400 font-sans">
                    {t('invoices.emptyState')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE INVOICE MODAL (Non-clipping, Mobile & Desktop Optimized) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* STICKY HEADER */}
            <div className="flex justify-between items-center px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-500 dark:text-emerald-400" /> {t('invoices.createModalTitle')}
                </h2>
                <AutoSaveIndicator status={createAutoSave.status} lastSaved={createAutoSave.lastSaved} />
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                aria-label={t('common.close')}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* FORM CONTAINER */}
            <form onSubmit={handleCreateDraft} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* SCROLLABLE BODY */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4">
                {createAutoSave.hasDraft && (
                  <DraftRecoveryBanner
                    timestamp={createAutoSave.draftTimestamp}
                    onRestore={handleRestoreCreateDraft}
                    onDiscard={handleDiscardCreateDraft}
                    className="mb-2"
                  />
                )}

                {createError && (
                  <div className="mb-2 bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 p-3 rounded-lg text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {t('invoices.customerLabel')} <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAddCustomerTarget('create');
                          setNewCustError(null);
                          setShowAddCustomerModal(true);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:underline transition"
                        title="Add a new customer / buyer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('invoices.addNewCustomer')}</span>
                      </button>
                    </div>
                    <SearchableSelect
                      value={customerId}
                      onChange={val => setCustomerId(val)}
                      placeholder={`-- ${t('invoices.selectCustomer')} --`}
                      searchPlaceholder="Search clients / consignees…"
                      emptyMessage="No clients found"
                      options={customers.map(c => ({
                        value: c.id,
                        label: `${c.companyName}${c.country ? ` (${c.country})` : ''}`,
                        description: [c.addressLine1, c.addressLine2].filter(Boolean).join(', ') || undefined
                      }))}
                      actionItem={{ label: t('invoices.addNewCustomerOption'), onSelect: () => {
                        setAddCustomerTarget('create');
                        setNewCustError(null);
                        setShowAddCustomerModal(true);
                      } }}
                    />

                    {/* Quick Selected Customer Detail Card */}
                    {(() => {
                      const selCust = customers.find(c => c.id === customerId);
                      if (!selCust) return null;
                      return (
                        <div className="mt-1.5 p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-2 animate-in fade-in duration-150">
                          <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1 leading-snug">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{selCust.companyName}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {[selCust.addressLine1, selCust.addressLine2, selCust.country].filter(Boolean).join(', ') || 'No address specified'}
                            </div>
                            {selCust.contactPerson && (
                              <div className="text-[10px] text-emerald-700 dark:text-emerald-300 truncate">
                                Attn: {selCust.contactPerson} {selCust.phone ? `• ${selCust.phone}` : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('invoices.issueDate')}</label>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={e => setIssueDate(e.target.value)}
                      required
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('invoices.paymentTerms')}</label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Payment Instructions / Remittance Profile Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('invoices.paymentInstructions')}
                  </label>
                  <SearchableSelect
                    value={remittanceProfileId}
                    onChange={val => setRemittanceProfileId(val)}
                    placeholder="-- Select payment instructions --"
                    searchPlaceholder="Search remittance profiles…"
                    options={remittanceProfiles.map(p => ({
                      value: p.id,
                      label: `${p.name}${p.isDefault ? ' ★ Default' : ''}`,
                      description: p.profileType === 'LOCAL' ? 'Local Wire - Da Afghanistan Bank' : 'International Wire - Al Salam / JPMorgan'
                    }))}
                  />

                  {/* Dynamic Remittance Preview in Modal - High Contrast Bank Instructions */}
                  {(() => {
                    const activeP = remittanceProfiles.find(p => p.id === remittanceProfileId);
                    const isIntl = !activeP || activeP.profileType === 'INTERNATIONAL';

                    return (
                      <div className="mt-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 text-xs space-y-3 shadow-inner">
                        {/* Section Title */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 gap-1">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="font-bold uppercase tracking-wider text-slate-900 dark:text-white text-xs">
                              {t('invoices.bankInstructionsTitle', 'BANK / PAYMENT INSTRUCTIONS - USD')}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 self-start sm:self-auto">
                            {isIntl ? 'International USD Payment Routing' : 'Local USD Inward Remittance'}
                          </span>
                        </div>

                        {/* 2-Column Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* BENEFICIARY / BANK */}
                          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 text-[11px] shadow-sm">
                            <div className="font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-1 flex justify-between items-center">
                              <span>{t('invoices.beneficiaryBankSection', 'BENEFICIARY / BANK')}</span>
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold">USD</span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">{t('invoices.beneficiaryNameLabel', 'Beneficiary Name')}: </span>
                              <strong className="text-slate-900 dark:text-white font-bold">SKY ARIANA LTD</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">{t('invoices.accountNoLabel', 'Account No.')}: </span>
                              <span dir="ltr" className="font-mono font-extrabold text-emerald-700 dark:text-emerald-400 text-xs bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">101502USD2940472</span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">{t('invoices.bankLabel', 'Bank')}: </span>
                              <span className="text-slate-900 dark:text-slate-200 font-semibold">AFGHAN UNITED BANK</span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">{t('invoices.bankAddressLabel', 'Bank Address')}: </span>
                              <span className="text-slate-700 dark:text-slate-300">AUB Building, Zarghona Maidan, Shahr-e-Now, Kabul</span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">{t('invoices.swiftLabel', 'SWIFT')}: </span>
                              <span dir="ltr" className="font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">AFGUAFKAXXX</span>
                            </div>
                            <div className="pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] font-mono text-slate-500 dark:text-slate-400" dir="ltr">
                              MT103: Beneficiary account in field 59A; AFGUAFKAXXX in field 57A.
                            </div>
                          </div>

                          {/* INTERNATIONAL USD PAYMENT ROUTING */}
                          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 text-[11px] shadow-sm">
                            <div className="font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 border-b border-slate-100 dark:border-slate-800 pb-1 flex justify-between items-center">
                              <span>{t('invoices.intlRoutingSection', 'INTERNATIONAL USD PAYMENT ROUTING')}</span>
                              <span className="text-[10px] font-mono text-cyan-700 dark:text-cyan-300 font-bold">SWIFT MT103</span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">{t('invoices.correspondentBankLabel', 'Correspondent Bank')}: </span>
                              <strong className="text-slate-900 dark:text-white font-bold">AL SALAM BANK BAHRAIN</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">SWIFT: </span>
                              <span dir="ltr" className="font-mono font-bold text-sky-700 dark:text-cyan-300 text-xs bg-sky-50 dark:bg-cyan-950/60 px-1.5 py-0.5 rounded border border-sky-200 dark:border-cyan-800">ALSABHBMXXX</span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">{t('invoices.aubAcWithCorrespondentLabel', 'AUB A/C with Al Salam')}: </span>
                              <span dir="ltr" className="font-mono font-semibold text-slate-800 dark:text-slate-200">BH61ALSA00500951200102</span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">{t('invoices.intermediaryAcLabel', 'Intermediary A/C')}: </span>
                              <span dir="ltr" className="font-mono font-semibold text-slate-800 dark:text-slate-200">400758954</span>
                              <span className="text-slate-400 mx-1">|</span>
                              <span className="text-slate-600 dark:text-slate-300">Sanabis, Bahrain</span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">{t('invoices.intermediaryBankLabel', 'Intermediary Bank')}: </span>
                              <span className="text-amber-800 dark:text-amber-300 font-bold">JPMorgan Chase Bank, New York</span>
                              <span className="text-slate-400 mx-1">|</span>
                              <span className="text-slate-500 dark:text-slate-400">SWIFT: </span>
                              <span dir="ltr" className="font-mono font-bold text-amber-700 dark:text-amber-300">CHASUS33</span>
                            </div>
                            <div className="pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] font-mono text-slate-500 dark:text-slate-400" dir="ltr">
                              MT103: ALSABHBM in field 56A; intermediary bank mandatory in field 54A.
                            </div>
                          </div>
                        </div>

                        {/* LOCAL USD CORRESPONDENT STRIP */}
                        <div className="p-2.5 bg-slate-100/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-slate-800 dark:text-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div>
                            <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] mr-2">
                              {t('invoices.localCorrespondentSection', 'LOCAL USD CORRESPONDENT')}:
                            </span>
                            <span className="text-slate-900 dark:text-white font-bold">DA AFGHANISTAN BANK (DAB)</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[11px] flex-wrap text-slate-700 dark:text-slate-300" dir="ltr">
                            <span>SWIFT: <strong className="text-slate-950 dark:text-white">AFGBAFKA</strong></span>
                            <span className="text-slate-400">•</span>
                            <span>A/C: <strong className="text-slate-950 dark:text-white">3000205027231</strong></span>
                            <span className="text-slate-400">•</span>
                            <span>Ibni-sina Watt, Kabul</span>
                          </div>
                        </div>

                        {/* IMPORTANT USD PAYMENT NOTE */}
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-xl text-amber-950 dark:text-amber-200 space-y-1.5 shadow-sm">
                          <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 text-xs uppercase tracking-wide">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>{t('invoices.importantPaymentNoteTitle', 'IMPORTANT USD PAYMENT NOTE')}</span>
                          </div>
                          <p className="text-[11px] text-amber-900 dark:text-amber-200/90 leading-relaxed font-sans">
                            NOTE: For all USD payments, it is mandatory to include the following correspondent bank details in the payment instructions:
                          </p>
                          <div className="text-[11px] font-mono space-y-0.5 text-amber-950 dark:text-amber-100 bg-white dark:bg-amber-950/60 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/50 shadow-xs" dir="ltr">
                            <div>CORRESPONDENT BANK: <strong>AL SALAM BANK BAHRAIN</strong></div>
                            <div>SWIFT CODE: <strong>ALSABHBMXXX</strong></div>
                            <div>A/C NO. WITH INTERMEDIARY BANK: <strong>400758954</strong></div>
                            <div>LOCATION: <strong>SANABIS, BAHRAIN</strong></div>
                            <div className="text-amber-800 dark:text-amber-300 font-bold pt-1 border-t border-amber-200 dark:border-amber-800/50">
                              Please mention “ALSABHBM” in Field 56A of the MT103.
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Line Items Editor */}
                <div className="pt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">{t('invoices.lineItemsTitle')}</span>
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline min-h-[44px] px-2"
                    >
                      <Plus className="w-3.5 h-3.5" /> {t('invoices.addLine')}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {lines.map((line, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          <div className="sm:col-span-4">
                            <label className="text-[10px] text-slate-600 dark:text-slate-400 font-medium block mb-0.5">{t('invoices.itemDesc')}</label>
                            <input
                              type="text"
                              value={line.description}
                              onChange={e => handleUpdateLine(idx, 'description', e.target.value)}
                              required
                              placeholder="e.g., Black Raisins - 2,300 CTNS"
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-white"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-slate-600 dark:text-slate-400 font-medium block mb-0.5">Cartons (CTNS)</label>
                            <input
                              type="number"
                              min="1"
                              value={line.cartonCount || ''}
                              onChange={e => handleUpdateLine(idx, 'cartonCount', e.target.value)}
                              placeholder="2300"
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-white font-mono"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-slate-600 dark:text-slate-400 font-medium block mb-0.5">KG / Carton</label>
                            <input
                              type="number"
                              step="any"
                              value={line.packagingKgPerCarton || ''}
                              onChange={e => handleUpdateLine(idx, 'packagingKgPerCarton', e.target.value)}
                              placeholder="10"
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-white font-mono"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-slate-600 dark:text-slate-400 font-medium block mb-0.5">{t('invoices.netWeight')} (KG)</label>
                            <input
                              type="number"
                              step="any"
                              value={line.quantity}
                              onChange={e => handleUpdateLine(idx, 'quantity', e.target.value)}
                              required
                              placeholder="23000"
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-white font-mono"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-slate-600 dark:text-slate-400 font-medium block mb-0.5">{t('invoices.unitPrice')} ($/KG)</label>
                            <input
                              type="number"
                              step="0.0001"
                              value={line.unitPrice}
                              onChange={e => handleUpdateLine(idx, 'unitPrice', e.target.value)}
                              required
                              placeholder="3.2500"
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-white font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-800/60">
                          <div className="text-xs">
                            <span className="text-slate-500 text-[10px] uppercase font-semibold mr-1">{t('invoices.lineTotal')}:</span>
                            <span dir="ltr" className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                              ${Number(line.lineTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          {lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              aria-label={t('common.delete')}
                              className="text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-1 flex items-center gap-1 text-[11px]"
                            >
                              <X className="w-3.5 h-3.5" /> Remove Line
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center text-xs sm:text-sm">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{t('invoices.grandTotal')}</span>
                    <span dir="ltr" className="font-mono font-extrabold text-base sm:text-lg text-emerald-700 dark:text-emerald-400">
                      ${calculateFormTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* STICKY FOOTER */}
              <div className="flex justify-end gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900/95 z-10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 min-h-[44px] bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow-md transition keep-white-text"
                >
                  {t('invoices.createDraftButton')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE / PREVIEW INVOICE MODAL (Executive Trade Proforma Invoice) */}
      {previewInvoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-start p-2 sm:p-4 z-50 overflow-y-auto">
          {/* STICKY TOP CONTROL TOOLBAR (print:hidden) */}
          <div className="w-full max-w-4xl flex items-center justify-between gap-3 mb-3 px-4 py-2.5 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl text-white shadow-2xl sticky top-2 z-10 print:hidden">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg shrink-0">
                <FileText className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="truncate">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Proforma Invoice</span>
                <span className="mx-2 text-slate-600">|</span>
                <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm">{previewInvoice.invoiceNumber}</span>
                {previewInvoice.customer?.companyName && (
                  <span className="text-xs text-slate-300 ml-2 hidden md:inline truncate">• {previewInvoice.customer.companyName}</span>
                )}
              </div>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 uppercase">
                {previewInvoice.status || 'ISSUED'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Copy Wire Instructions Button */}
              <button
                onClick={() => handleCopyWireDetails(previewInvoice)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                title="Copy formatted SWIFT wire routing instructions to clipboard"
              >
                {copiedWire ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span className="hidden sm:inline">{copiedWire ? 'Copied Wire Info' : 'Copy Wire Details'}</span>
              </button>

              {/* Print / Save PDF Button */}
              <button
                onClick={() => triggerPrint(`Proforma-Invoice-${previewInvoice.invoiceNumber}`)}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-950/40 transition"
                title="Print Document or Save as PDF (Ctrl+P)"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / PDF</span>
              </button>

              {/* Close Button */}
              <button
                onClick={() => setPreviewInvoice(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                title="Close Preview (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* THE PRINTABLE INVOICE SHEET (Calibrated to 100% single A4 / Letter page) */}
          <div className="printable-document bg-white text-slate-900 rounded-xl w-full max-w-4xl p-5 sm:p-7 shadow-2xl font-sans border border-slate-200 my-auto print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-full print:rounded-none print:max-h-none print:overflow-visible">
            
            {/* 1. CORPORATE LETTERHEAD HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-3 border-b-2 border-slate-900 print:pb-2">
              <div className="flex items-center gap-3.5">
                <div className="h-[84px] w-auto flex items-center justify-start shrink-0">
                  <img
                    src="/sky-ariana-logo.png"
                    alt="Sky Ariana Ltd. Official Logo"
                    className="h-20 w-auto object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-none uppercase">
                    {previewInvoice.company?.legalName || 'SKY ARIANA LTD.'}
                  </h1>
                  <p className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider mt-1">
                    Corporate Commercial Settlement & International Commodity Trade
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                    Zarghona Maidan, Shahr-e-Now, Kabul, Afghanistan • info@skyariana.com • www.skyariana.com
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0 rtl:sm:text-left">
                <span className="text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-wider block leading-none">
                  PROFORMA INVOICE
                </span>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-950 text-white rounded font-mono font-bold text-xs mt-1.5" dir="ltr">
                  <span className="text-slate-400 text-[10px]">PI NO:</span>
                  <span className="text-emerald-400">{previewInvoice.invoiceNumber}</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-700 font-mono space-y-0.5" dir="ltr">
                  <div>Date: <strong className="text-slate-950">{previewInvoice.issueDate}</strong></div>
                  {previewInvoice.sourceInvoiceRef && (
                    <div className="text-slate-500 text-[10px]">Workbook Ref: {previewInvoice.sourceInvoiceRef}</div>
                  )}
                  <div className="text-[10px] text-slate-600">Validity: 30 Days</div>
                </div>
              </div>
            </div>

            {/* 2. PARTIES & COMMERCIAL SETTLEMENT TERMS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3 text-xs print:my-2">
              {/* Buyer / Consignee */}
              <div className="bg-slate-50/90 p-3 rounded-lg border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    BILL TO / CONSIGNEE:
                  </div>
                  <h2 className="font-bold text-slate-950 text-sm">
                    {previewInvoice.customer?.companyName || 'Unknown Customer'}
                  </h2>
                  <p className="text-slate-700 mt-0.5 text-xs leading-relaxed">
                    {previewInvoice.customer?.addressLine1}
                    {previewInvoice.customer?.addressLine2 && `, ${previewInvoice.customer.addressLine2}`}
                  </p>
                </div>
                <div className="mt-2 pt-1.5 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Destination Country:</span>
                  <span className="font-bold text-slate-900 uppercase">{previewInvoice.customer?.country || 'International'}</span>
                </div>
              </div>

              {/* Commercial Settlement & Delivery Terms */}
              <div className="bg-slate-50/90 p-3 rounded-lg border border-slate-200 text-xs flex flex-col justify-between space-y-1">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    COMMERCIAL SETTLEMENT & TERMS:
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                    <div className="text-slate-500">Payment Terms:</div>
                    <div className="font-bold text-slate-900 text-right">{previewInvoice.paymentTerms || '100% Advance Payment'}</div>

                    <div className="text-slate-500">Price Terms (Incoterm):</div>
                    <div className="font-bold text-slate-900 text-right">C&F (Cost & Freight)</div>

                    <div className="text-slate-500">Settlement Currency:</div>
                    <div className="font-bold text-emerald-800 text-right font-mono">USD ($)</div>

                    <div className="text-slate-500">Document Status:</div>
                    <div className="font-bold text-emerald-700 text-right uppercase">{previewInvoice.status || 'ISSUED'}</div>
                  </div>
                </div>
                <div className="pt-1.5 border-t border-slate-200/80 flex items-center justify-between text-[10.5px]">
                  <span className="text-slate-500 font-medium">Payment Protocol:</span>
                  <span className="font-mono font-semibold text-slate-800">SWIFT MT103 Wire Transfer</span>
                </div>
              </div>
            </div>

            {/* 3. LINE ITEMS SPECIFICATION TABLE */}
            <div className="my-3 overflow-x-auto print:my-2">
              <table className="w-full text-left rtl:text-right text-xs border border-slate-300 rounded overflow-hidden">
                <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="py-2 px-2.5 w-8 text-center border-b border-slate-800">#</th>
                    <th className="py-2 px-3 border-b border-slate-800">Item Description & Commodity Specifications</th>
                    <th className="py-2 px-2.5 border-b border-slate-800 text-right rtl:text-left">Packing</th>
                    <th className="py-2 px-2.5 border-b border-slate-800 text-right rtl:text-left">Net Wt (KG)</th>
                    <th className="py-2 px-2.5 border-b border-slate-800 text-right rtl:text-left">C&F Unit Price</th>
                    <th className="py-2 px-3 border-b border-slate-800 text-right rtl:text-left">Total Amount (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-sans">
                  {previewInvoice.lines.map((l: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2 px-2.5 text-center text-slate-400 font-mono text-[11px]">{i + 1}</td>
                      <td className="py-2 px-3 text-slate-900 font-semibold">{l.description}</td>
                      <td className="py-2 px-2.5 text-right rtl:text-left font-mono text-slate-700 text-[11px]" dir="ltr">
                        {l.cartonDisplay || (l.cartonCount ? `${Number(l.cartonCount).toLocaleString()} CTNS` : '-')}
                      </td>
                      <td className="py-2 px-2.5 text-right rtl:text-left font-mono text-slate-700 text-[11px]" dir="ltr">
                        {l.quantity}
                      </td>
                      <td className="py-2 px-2.5 text-right rtl:text-left font-mono text-slate-700 text-[11px]" dir="ltr">
                        {l.unitPrice}
                      </td>
                      <td className="py-2 px-3 text-right rtl:text-left font-mono font-bold text-slate-950 text-xs" dir="ltr">
                        {l.lineTotal}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals & Grand Total Summary Row */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-2 pt-2 border-t-2 border-slate-900 print:mt-1.5 print:pt-1.5">
                <div className="text-[11px] text-slate-600 font-mono flex items-center gap-3">
                  {(() => {
                    const totalCartons = (previewInvoice.lines || []).reduce((sum: number, l: any) => sum + (Number(l.cartonCount) || 0), 0);
                    return totalCartons > 0 ? (
                      <span>Total Packing: <strong className="text-slate-900">{totalCartons.toLocaleString()} CTNS</strong></span>
                    ) : null;
                  })()}
                </div>

                <div className="text-right rtl:text-left flex items-center gap-3">
                  <span className="text-xs uppercase text-slate-600 font-extrabold tracking-wider">GRAND TOTAL (USD):</span>
                  <span dir="ltr" className="text-base sm:text-lg font-black font-mono text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-300">
                    {previewInvoice.grandTotal}
                  </span>
                </div>
              </div>

              {/* Commercial Legal Amount in Words */}
              <div className="mt-2 px-3 py-1.5 bg-slate-100 rounded border border-slate-200 text-[10.5px] font-bold text-slate-900 flex items-center gap-2 print:mt-1.5 print:py-1" dir="ltr">
                <span className="text-slate-500 uppercase shrink-0 text-[10px]">AMOUNT IN WORDS:</span>
                <span className="font-mono text-slate-950 tracking-tight">
                  {formatAmountInWords(previewInvoice.grandTotal)}
                </span>
              </div>
            </div>

            {/* 4. UNIFIED SWIFT MT103 BANKING & REMITTANCE INSTRUCTIONS */}
            <div className="bg-slate-50/90 p-3 rounded-lg border border-slate-300 text-xs mt-3 text-slate-800 space-y-2 print-avoid-break print:mt-2 print:p-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-1.5 border-b border-slate-300 gap-1">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <h3 className="font-black uppercase tracking-wider text-slate-950 text-xs">
                    BANK / PAYMENT INSTRUCTIONS (USD WIRE REMITTANCE)
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-200 text-slate-800 border border-slate-300">
                    SWIFT MT103 ROUTING
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    OFFICIAL SNAPSHOT
                  </span>
                </div>
              </div>

              {/* Two Column Banking Routing Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* BENEFICIARY BANK (Field 59A & 57A) */}
                <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1 text-[11px] print:p-2">
                  <div className="font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 text-[10.5px] flex justify-between items-center">
                    <span>BENEFICIARY ACCOUNT (FIELD 59A & 57A)</span>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold">USD</span>
                  </div>
                  <div>Beneficiary Name: <strong className="text-slate-950">SKY ARIANA LTD</strong> <span className="text-slate-400 font-mono text-[10px]">(Field 59A)</span></div>
                  <div>Account No.: <span dir="ltr" className="font-mono font-bold text-slate-950 text-xs bg-slate-50 px-1 py-0.5 rounded border border-slate-200">101502USD2940472</span></div>
                  <div>Beneficiary Bank: <strong className="text-slate-900">AFGHAN UNITED BANK</strong></div>
                  <div className="text-slate-600">Bank Address: AUB Building, Zarghona Maidan, Shahr-e-Now, Kabul</div>
                  <div>SWIFT / BIC: <span dir="ltr" className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">AFGUAFKAXXX</span> <span className="text-slate-400 font-mono text-[10px]">(Field 57A)</span></div>
                </div>

                {/* CORRESPONDENT & INTERMEDIARY ROUTING (Field 56A & 54A) */}
                <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1 text-[11px] print:p-2">
                  <div className="font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 text-[10.5px] flex justify-between items-center">
                    <span>CORRESPONDENT ROUTING (FIELD 56A & 54A)</span>
                    <span className="text-[10px] font-mono text-slate-500">MT103</span>
                  </div>
                  <div>Correspondent Bank: <strong className="text-slate-950">AL SALAM BANK BAHRAIN</strong> <span className="text-slate-400 font-mono text-[10px]">(Field 56A)</span></div>
                  <div>SWIFT Code: <span dir="ltr" className="font-mono font-bold text-slate-950">ALSABHBMXXX</span></div>
                  <div>AUB A/C with Al Salam: <span dir="ltr" className="font-mono font-semibold text-slate-900">BH61ALSA00500951200102</span></div>
                  <div>Intermediary Bank: <strong className="text-slate-900">JPMorgan Chase Bank, New York</strong> <span className="text-slate-400 font-mono text-[10px]">(Field 54A)</span></div>
                  <div>Intermediary SWIFT: <span dir="ltr" className="font-mono font-bold">CHASUS33</span> <span className="text-slate-400">|</span> A/C: <span dir="ltr" className="font-mono font-bold">400758954</span></div>
                </div>
              </div>

              {/* Integrated Mandatory Routing Notice */}
              <div className="p-2 bg-amber-50/90 rounded border border-amber-300 text-amber-950 text-[10px] flex items-start gap-1.5 print:p-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <div className="leading-tight">
                  <strong>MANDATORY SWIFT MT103 ROUTING:</strong>
                  <span> For all USD payments, remitting bank MUST enter <strong>AL SALAM BANK BAHRAIN (SWIFT: ALSABHBMXXX)</strong> in <strong>Field 56A</strong>, and <strong>JPMorgan Chase Bank, New York (CHASUS33)</strong> in <strong>Field 54A</strong>. Beneficiary account <strong>101502USD2940472</strong> in <strong>Field 59A</strong>.</span>
                  <span className="block mt-0.5 text-slate-600 font-mono text-[9.5px]">Local Clearing: DA AFGHANISTAN BANK (DAB) • SWIFT: AFGBAFKA • A/C: 3000205027231 • Kabul</span>
                </div>
              </div>
            </div>

            {/* 5. COMMERCIAL SIGNATURES & OFFICIAL STAMP */}
            <div className="grid grid-cols-2 gap-4 mt-3 pt-2 border-t border-slate-300 text-xs print-avoid-break print:mt-2 print:pt-1.5">
              {/* Left: Consignee Confirmation */}
              <div className="border border-slate-200 rounded p-2.5 bg-slate-50/50 flex flex-col justify-between print:p-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    CONFIRMED & ACCEPTED BY BUYER:
                  </div>
                  <div className="text-slate-900 font-bold text-xs mt-0.5">
                    {previewInvoice.customer?.companyName || 'Consignee Company'}
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t border-dashed border-slate-300 text-[10px] text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Authorized Signatory & Stamp</span>
                    <span>Date: _______________</span>
                  </div>
                </div>
              </div>

              {/* Right: Seller Authorized Signatory */}
              <div className="border border-slate-200 rounded p-2.5 bg-slate-50/50 flex flex-col justify-between relative overflow-hidden print:p-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    FOR AND ON BEHALF OF SELLER:
                  </div>
                  <div className="text-slate-950 font-black text-xs mt-0.5">
                    SKY ARIANA LTD.
                  </div>
                </div>

                <div className="my-1">
                  <div className="text-[10px] text-slate-600 space-y-0.5">
                    <div>Commercial Settlement Division</div>
                    <div className="font-mono text-[9px] text-emerald-800 font-bold">AUTHENTICATED DIGITAL DRAFT</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-dashed border-slate-300 text-[10px] text-slate-500 flex justify-between">
                  <span>Authorized Commercial Signature</span>
                  <span className="font-mono">Date: {previewInvoice.issueDate}</span>
                </div>
              </div>
            </div>

            {/* 6. DOCUMENT FOOTER */}
            <div className="mt-2.5 pt-1.5 border-t border-slate-200 text-[9px] text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-1 text-center sm:text-left print-avoid-break print:mt-1.5 print:pt-1">
              <div>
                This is a computer-generated commercial proforma invoice valid for international banking settlement and customs processing.
              </div>
              <div className="font-mono text-slate-400">
                Page 1 of 1 • Sky Ariana Ltd.
              </div>
            </div>

            {/* 7. BOTTOM ACTION BUTTONS (print:hidden) */}
            <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-200 print:hidden">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerPrint(`Proforma-Invoice-${previewInvoice.invoiceNumber}`)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>{t('common.print', 'Print / Save PDF')}</span>
                </button>
                <button
                  onClick={() => handleCopyWireDetails(previewInvoice)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg border border-slate-300 transition"
                >
                  {copiedWire ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                  <span>{copiedWire ? 'Copied to Clipboard' : 'Copy Bank Instructions'}</span>
                </button>
              </div>
              <button
                onClick={() => setPreviewInvoice(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-lg transition"
              >
                {t('common.close', 'Close Preview')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOID INVOICE MODAL */}
      {voidInvoiceId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5 text-rose-400" /> {t('invoices.void')}
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              Voiding an invoice cancels outstanding receivables. A mandatory audit reason is required.
            </p>
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-300 mb-1">{t('invoices.voidPrompt')}</label>
              <textarea
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="e.g., Order cancelled by consignee, revised terms..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setVoidInvoiceId(null)}
                className="px-3 py-2 min-h-[44px] bg-slate-800 text-slate-300 rounded text-xs"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleVoid}
                disabled={!voidReason.trim()}
                className="px-4 py-2 min-h-[44px] bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold disabled:opacity-50"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {paymentModalInvoice && (() => {
        const invTotal = Number(paymentModalInvoice.totalAmount) || 0;
        const paidSoFar = Math.min(
          invTotal,
          Math.max(0, Number(paymentModalInvoice.paidAmount ?? (invTotal - Number(paymentModalInvoice.remainingBalance ?? invTotal))) || 0)
        );
        const balanceDue = Math.max(0, Number((invTotal - paidSoFar).toFixed(2)));
        const grossAmt = Number(paymentAmount) || 0;
        const feeAmt = Number(swiftFeeDeducted) || 0;

        return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                  <Banknote className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white leading-snug">
                    {t('invoices.paymentModalTitle', 'Record Invoice Payment & Auto-Receipt')}
                  </h3>
                  <span className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tracking-wider whitespace-nowrap">
                    AFGHAN UNITED BANK • USD
                  </span>
                </div>
              </div>
              <button
                onClick={() => setPaymentModalInvoice(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 shrink-0 transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Invoice:</span>
                <span className="font-bold text-white font-mono">{paymentModalInvoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="font-semibold text-slate-200">{paymentModalInvoice.customer?.companyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Invoice Amount:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  ${invTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {paidSoFar > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Already Paid:</span>
                  <span className="font-semibold text-blue-400 font-mono">
                    ${paidSoFar.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-800/80 pt-1">
                <span className="text-slate-400 font-medium">Balance Due:</span>
                <span className={`font-bold font-mono ${balanceDue > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  ${balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Live Financial Settlement Breakdown */}
            {grossAmt > 0 && (
              <div className="bg-slate-950/90 p-3.5 rounded-xl border border-emerald-900/40 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-400 font-medium pb-1.5 border-b border-slate-800/80">
                  <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                    Settlement & Wire Deposit Breakdown
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                    grossAmt + 0.005 >= balanceDue
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {grossAmt + 0.005 >= balanceDue ? 'FULL SETTLEMENT (PAID)' : 'PARTIAL SETTLEMENT'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Gross Settlement:</span>
                      <span className="font-mono font-semibold text-slate-200">
                        ${grossAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">SWIFT Fee Deducted:</span>
                      <span className={`font-mono font-semibold ${feeAmt > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                        {feeAmt > 0 ? '-' : ''}${feeAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Net Wire Credited:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        ${Math.max(0, grossAmt - feeAmt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Remaining Balance:</span>
                      <span className={`font-mono font-semibold ${
                        Math.max(0, balanceDue - grossAmt) <= 0.005 ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        ${Math.max(0, balanceDue - grossAmt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {paymentError && (
              <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs">
                {paymentError}
              </div>
            )}

            <form onSubmit={handleSubmitPayment} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Payment Amount Received ($ USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">{t('invoices.swiftFeeDeducted', 'SWIFT Fee Deducted ($)')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={swiftFeeDeducted}
                    onChange={e => setSwiftFeeDeducted(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">{t('invoices.bankReference', 'Bank Transaction / Wire Ref')}</label>
                  <input
                    type="text"
                    value={bankReference}
                    onChange={e => setBankReference(e.target.value)}
                    placeholder="e.g. AUB-WIRE-98234"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Notes / Remittance Description</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  placeholder="Optional memo..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCreateReceiptLedger}
                  onChange={e => setAutoCreateReceiptLedger(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-emerald-300 text-xs font-medium">
                  {t('invoices.autoCreateReceiptLedger', 'Automatically create Deposit Receipt & Account Statement Credit')}
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPaymentModalInvoice(null)}
                  className="px-4 py-2.5 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={paymentSubmitting || !(Number(paymentAmount) > 0)}
                  className="flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-950 transition disabled:opacity-50"
                >
                  {paymentSubmitting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}

      {/* EDIT INVOICE MODAL (Non-clipping, Mobile & Desktop Optimized) */}
      {editingInvoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* STICKY HEADER */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Edit className="w-5 h-5 text-sky-500 dark:text-sky-400" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {t('invoices.editInvoice', 'Edit Invoice')} • <span className="font-mono text-emerald-600 dark:text-emerald-400">{editingInvoice.invoiceNumber}</span>
                  </h3>
                </div>
                <AutoSaveIndicator status={editAutoSave.status} lastSaved={editAutoSave.lastSaved} />
              </div>
              <button
                onClick={() => setEditingInvoice(null)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* FORM CONTAINER */}
            <form onSubmit={handleSaveEdit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* SCROLLABLE BODY */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 text-xs">
                {editAutoSave.hasDraft && (
                  <DraftRecoveryBanner
                    timestamp={editAutoSave.draftTimestamp}
                    onRestore={handleRestoreEditDraft}
                    onDiscard={() => editAutoSave.discardDraft()}
                    className="mb-2"
                  />
                )}

                {editError && (
                  <div className="mb-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs">
                    {editError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold text-xs">
                        {t('invoices.customerLabel')} *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAddCustomerTarget('edit');
                          setNewCustError(null);
                          setShowAddCustomerModal(true);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:underline transition"
                        title="Add a new customer / buyer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('invoices.addNewCustomer')}</span>
                      </button>
                    </div>
                    <SearchableSelect
                      value={editCustomerId}
                      onChange={val => setEditCustomerId(val)}
                      placeholder={`-- ${t('invoices.selectCustomer')} --`}
                      searchPlaceholder="Search clients / consignees…"
                      emptyMessage="No clients found"
                      options={customers.map(c => ({
                        value: c.id,
                        label: `${c.companyName}${c.country ? ` (${c.country})` : ''}`,
                        description: [c.addressLine1, c.addressLine2].filter(Boolean).join(', ') || undefined
                      }))}
                      actionItem={{ label: t('invoices.addNewCustomerOption'), onSelect: () => {
                        setAddCustomerTarget('edit');
                        setNewCustError(null);
                        setShowAddCustomerModal(true);
                      } }}
                    />

                    {/* Quick Selected Customer Detail Card for Edit Modal */}
                    {(() => {
                      const selCust = customers.find(c => c.id === editCustomerId);
                      if (!selCust) return null;
                      return (
                        <div className="mt-1.5 p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-2 animate-in fade-in duration-150">
                          <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1 leading-snug">
                            <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{selCust.companyName}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {[selCust.addressLine1, selCust.addressLine2, selCust.country].filter(Boolean).join(', ') || 'No address specified'}
                            </div>
                            {selCust.contactPerson && (
                              <div className="text-[10px] text-emerald-700 dark:text-emerald-300 truncate">
                                Attn: {selCust.contactPerson} {selCust.phone ? `• ${selCust.phone}` : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Source Invoice Ref</label>
                    <input
                      type="text"
                      value={editSourceRef}
                      onChange={e => setEditSourceRef(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Issue Date *</label>
                    <input
                      type="date"
                      required
                      value={editIssueDate}
                      onChange={e => setEditIssueDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Due Date</label>
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={e => setEditDueDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Payment Terms</label>
                    <input
                      type="text"
                      value={editPaymentTerms}
                      onChange={e => setEditPaymentTerms(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Payment Status *</label>
                    <select
                      value={editPaymentStatus}
                      onChange={e => setEditPaymentStatus(e.target.value as any)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white font-semibold"
                    >
                      <option value="UNPAID">UNPAID</option>
                      <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
                      <option value="PAID">PAID</option>
                      <option value="OVERDUE">OVERDUE</option>
                      <option value="CANCELED">CANCELED</option>
                    </select>
                  </div>
                </div>

                {/* Line Items */}
                <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800 dark:text-white uppercase text-[11px] tracking-wider">Line Items & Cargo Specifications</span>
                    <button
                      type="button"
                      onClick={handleAddEditLine}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Line
                    </button>
                  </div>

                  <div className="space-y-2">
                    {editLines.map((line, idx) => (
                      <div key={idx} className="bg-slate-50 dark:bg-slate-950/90 p-3 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <div className="sm:col-span-5">
                          <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-0.5">Description</label>
                          <input
                            type="text"
                            required
                            value={line.description}
                            onChange={e => handleUpdateEditLine(idx, 'description', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded p-1.5 text-slate-900 dark:text-white text-xs"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-0.5">Cartons</label>
                          <input
                            type="number"
                            value={line.cartonCount || ''}
                            onChange={e => handleUpdateEditLine(idx, 'cartonCount', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded p-1.5 text-slate-900 dark:text-white text-xs font-mono"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-0.5">Net Weight (KG) *</label>
                          <input
                            type="number"
                            required
                            value={line.quantity}
                            onChange={e => handleUpdateEditLine(idx, 'quantity', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded p-1.5 text-slate-900 dark:text-white text-xs font-mono"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block mb-0.5">Rate ($/KG) *</label>
                          <input
                            type="number"
                            step="0.0001"
                            required
                            value={line.unitPrice}
                            onChange={e => handleUpdateEditLine(idx, 'unitPrice', e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded p-1.5 text-slate-900 dark:text-white text-xs font-mono"
                          />
                        </div>
                        <div className="sm:col-span-1 flex items-center justify-center pt-3 sm:pt-0">
                          {editLines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveEditLine(idx)}
                              className="p-1.5 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 rounded hover:bg-slate-200 dark:hover:bg-slate-900"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono">
                    <span className="text-slate-600 dark:text-slate-400">Total Calculated:</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                      ${calculateEditFormTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </span>
                  </div>
                </div>
              </div>

              {/* STICKY FOOTER */}
              <div className="flex justify-end gap-2 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900/95 z-10">
                <button
                  type="button"
                  onClick={() => setEditingInvoice(null)}
                  className="px-4 py-2.5 min-h-[44px] bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-md transition disabled:opacity-50 keep-white-text"
                >
                  {editSubmitting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE INVOICE CONFIRMATION MODAL */}
      {deleteInvoiceId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Proforma Invoice</h3>
                <span className="text-xs font-mono text-rose-400 font-semibold">{deleteInvoiceId.invoiceNumber}</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete this commercial proforma invoice? This action removes associated line items and allocations.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteInvoiceId(null)}
                className="px-4 py-2 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-5 py-2 min-h-[44px] bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-rose-950 transition disabled:opacity-50"
              >
                {deleting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* REGISTER NEW CLIENT MODAL (High-Z index overlay, nested safety) */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-[70] animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    {t('invoices.addCustomerModalTitle')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {t('invoices.addCustomerModalSubtitle')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddCustomerModal(false);
                  resetNewCustomerForm();
                }}
                className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateCustomer} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs">
                {newCustError && (
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{newCustError}</span>
                  </div>
                )}

                {/* Company Name */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('invoices.companyName')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newCustName}
                    onChange={e => setNewCustName(e.target.value)}
                    placeholder={t('invoices.companyNamePlaceholder')}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Country */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('invoices.country')}
                  </label>
                  <input
                    type="text"
                    value={newCustCountry}
                    onChange={e => setNewCustCountry(e.target.value)}
                    placeholder={t('invoices.countryPlaceholder')}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 mb-1.5"
                  />
                  {/* Quick Country Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-medium">Quick Pick:</span>
                    {['India', 'United Arab Emirates', 'Afghanistan', 'Uzbekistan', 'Tajikistan', 'Turkey', 'China', 'Pakistan'].map(ctry => (
                      <button
                        key={ctry}
                        type="button"
                        onClick={() => setNewCustCountry(ctry)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                          newCustCountry === ctry
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {ctry}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Addresses */}
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('invoices.addressLine1')}
                    </label>
                    <input
                      type="text"
                      value={newCustAddress1}
                      onChange={e => setNewCustAddress1(e.target.value)}
                      placeholder="e.g., Plot 108, Phase 2, GIDC Estate / Industrial Area"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('invoices.addressLine2')}
                    </label>
                    <input
                      type="text"
                      value={newCustAddress2}
                      onChange={e => setNewCustAddress2(e.target.value)}
                      placeholder="e.g., Ahmedabad, Gujarat - 382445"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Contact Person & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('invoices.contactPerson')}
                    </label>
                    <input
                      type="text"
                      value={newCustContact}
                      onChange={e => setNewCustContact(e.target.value)}
                      placeholder={t('invoices.contactPersonPlaceholder')}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t('invoices.clientPhone')}
                    </label>
                    <input
                      type="text"
                      value={newCustPhone}
                      onChange={e => setNewCustPhone(e.target.value)}
                      placeholder={t('invoices.clientPhonePlaceholder')}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('invoices.clientEmail')}
                  </label>
                  <input
                    type="email"
                    value={newCustEmail}
                    onChange={e => setNewCustEmail(e.target.value)}
                    placeholder={t('invoices.clientEmailPlaceholder')}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCustomerModal(false);
                    resetNewCustomerForm();
                  }}
                  className="px-4 py-2.5 min-h-[40px] bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={newCustSubmitting || !newCustName.trim()}
                  className="px-4 py-2.5 min-h-[40px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition"
                >
                  {newCustSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{t('invoices.savingClient')}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{t('invoices.saveAndSelectClient')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
