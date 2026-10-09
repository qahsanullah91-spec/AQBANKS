export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
}

export interface Customer {
  id: string;
  companyName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  country?: string;
  isCustomer: boolean;
  isVendor: boolean;
}

export interface InvoiceLine {
  id?: string;
  lineNumber: number;
  description: string;
  quantity: number | string;
  unitOfMeasure: string;
  unitPrice: number | string;
  lineTotal: number | string;
}

export interface Invoice {
  id: string;
  customerId: string;
  customer?: Customer;
  invoiceNumber: string;
  sourceInvoiceRef?: string;
  issueDate: string;
  dueDate?: string;
  currency: string;
  subtotal: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  status: 'DRAFT' | 'ISSUED' | 'VOID';
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  paymentTerms: string;
  bankAccountId?: string;
  lines?: InvoiceLine[];
  snapshots?: any[];
  paymentAllocations?: any[];
}

export interface Shipment {
  id: string;
  shipmentRef: string;
  containerNumber?: string;
  billOfLading?: string;
  origin?: string;
  destination?: string;
  carrier?: string;
  shipmentDate?: string;
  estimatedArrivalDate?: string;
  actualArrivalDate?: string;
  status: 'BOOKED' | 'AT_ORIGIN_PORT' | 'IN_TRANSIT' | 'CUSTOMS_CLEARANCE' | 'DELIVERED' | 'CANCELLED';
  notes?: string;
  statusHistory?: any[];
  shipmentInvoices?: any[];
}

export interface LedgerTransaction {
  id: string;
  effectiveDate: string;
  postedAt?: string;
  reference?: string;
  description: string;
  category: 'BALANCE' | 'CREDIT' | 'DEBIT';
  debitAmount: number | string;
  creditAmount: number | string;
  runningBalance: number | string;
  currency: string;
  reconciliationStatus: 'UNRECONCILED' | 'RECONCILED' | 'DISCREPANCY';
  isReversal?: boolean;
}

export interface BankAccount {
  id: string;
  bankName: string;
  beneficiaryName: string;
  accountNumberMasked: string;
  swiftCode: string;
  correspondentBank?: string;
  correspondentSwift?: string;
  currency: string;
  isPrimary: boolean;
  versionCount?: number;
}

export interface Payment {
  id: string;
  customerId: string;
  customer?: Customer;
  paymentDate: string;
  reference?: string;
  paymentMethod: string;
  totalAmount: number | string;
  allocatedAmount: number | string;
  unallocatedAmount: number | string;
  currency: string;
  notes?: string;
  allocations?: any[];
}

export interface DashboardOverview {
  metrics: {
    availableBalance: string;
    totalCredits: string;
    totalDebits: string;
    totalInvoiced: string;
    pendingReceivables: string;
    activeShipmentsCount: number;
    totalInvoicesCount: number;
    unreconciledTxCount: number;
  };
  cashFlow: {
    totalIncoming: string;
    totalOutgoing: string;
    netOperatingCashFlow: string;
  };
  latestTransactions: any[];
  recentShipments: any[];
}
