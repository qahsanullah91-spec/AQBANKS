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
  country?: string;
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
  totalAmount: number | string;
  status: 'DRAFT' | 'ISSUED' | 'VOID';
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  paymentTerms: string;
  lines?: any[];
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
  status: 'BOOKED' | 'AT_ORIGIN_PORT' | 'IN_TRANSIT' | 'CUSTOMS_CLEARANCE' | 'DELIVERED' | 'CANCELLED';
  statusHistory?: any[];
}

export interface LedgerTransaction {
  id: string;
  effectiveDate: string;
  reference?: string;
  description: string;
  category: 'BALANCE' | 'CREDIT' | 'DEBIT';
  debitAmount: number | string;
  creditAmount: number | string;
  runningBalance: number | string;
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
}

export interface DashboardMetrics {
  availableBalance: string;
  totalCredits: string;
  totalDebits: string;
  totalInvoiced: string;
  pendingReceivables: string;
  activeShipmentsCount: number;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  paymentId?: string;
  ledgerTransactionId?: string;
  invoiceId?: string;
  shipmentId?: string;
  userId?: string;
  receivedFrom: string;
  customerName?: string;
  amount: number | string;
  amountInWords: string;
  currency: string;
  paymentMethod: string;
  referenceNumber?: string;
  bankAccountMasked?: string;
  purpose?: string;
  notes?: string;
  issuedAt: string;
  status: 'ISSUED' | 'VOID';
  voidReason?: string;
  voidedAt?: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}
