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
  cartonCount?: number | null;
  packagingKgPerCarton?: number | string | null;
  quantity: number | string;
  unitOfMeasure: string;
  unitPrice: number | string;
  lineTotal: number | string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  paymentId?: string;
  ledgerTransactionId?: string;
  issueDate?: string;
  payerName?: string;
  amount: number | string;
  grossAmount?: number | string | null;
  swiftFeeAmount?: number | string | null;
  currency: string;
  status: 'VALID' | 'VOIDED' | 'ISSUED';
  receivingAccountMasked?: string;
  receivingAccountName?: string;
  paymentMethod?: string;
  bankReference?: string;
  referenceNumber?: string;
  purpose?: string;
  amountInWords?: string;
  notes?: string | null;
  createdAt: string;
  voidedAt?: string | null;
  voidReason?: string | null;
  issuedBy?: any;
  payment?: Payment;
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
  remainingBalance?: number | string;
  lines?: InvoiceLine[];
  snapshots?: any[];
  paymentAllocations?: any[];
  shipmentInvoices?: any[];
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
  notes?: string | null;
}

export interface RemittanceProfile {
  id: string;
  bankAccountId: string;
  bankAccount?: BankAccount;
  profileType: 'LOCAL' | 'INTERNATIONAL';
  name: string;
  beneficiaryName: string;
  beneficiaryAccount: string;
  beneficiaryBank: string;
  beneficiaryBankAddress: string;
  beneficiarySwift: string;
  swiftField57A?: string | null;
  swiftField59A?: string | null;
  aubAccountWithCorrespondent?: string | null;
  correspondentBank: string;
  correspondentSwift: string;
  correspondentAccount?: string | null;
  correspondentLocation?: string | null;
  swiftField56A?: string | null;
  intermediaryBank?: string | null;
  intermediarySwift?: string | null;
  swiftField54A?: string | null;
  mt103VerificationFlag?: boolean;
  verificationNotes?: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  beneficiaryName: string;
  accountNumberMasked: string;
  cifNumberMasked?: string;
  accountType?: string;
  accountStatus?: string;
  openingDate?: string;
  branchName?: string;
  swiftCode: string;
  correspondentBank?: string;
  correspondentSwift?: string;
  currency: string;
  isPrimary: boolean;
  remittanceProfiles?: RemittanceProfile[];
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
    totalWeightKg?: string;
    totalSwiftFees?: string;
    pendingReceivables: string;
    unpaidInvoicesCount?: number;
    activeShipmentsCount: number;
    totalInvoicesCount: number;
    unreconciledTxCount: number;
    totalReceiptsCount?: number;
  };
  cashFlow: {
    totalIncoming: string;
    totalOutgoing: string;
    netOperatingCashFlow: string;
    pendingReceivables?: string;
    totalSwiftFees?: string;
  };
  latestTransactions: any[];
  recentShipments: any[];
}
