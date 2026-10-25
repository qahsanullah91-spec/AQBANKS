export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
}

export interface SystemUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  isActive: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
}

export type LockUnlockMethod = 'pin' | 'password' | 'biometric';

export interface LockSettings {
  enabled: boolean;
  inactivityMinutes: number;
  pinEnabled: boolean;
  passwordEnabled: boolean;
  biometricEnabled: boolean;
  pinHash: string | null;
  masterPasswordHash: string | null;
  biometricCredentialId: string | null;
}

export interface ChangelogEntry {
  version: string;
  releaseDate: string;
  type: 'feature' | 'fix' | 'security' | 'release';
  title: string;
  items: string[];
}

export interface UpdateManifest {
  version: string;
  buildNumber?: number;
  releaseDate?: string;
  channel?: 'stable' | 'beta';
  minimumRequired?: boolean;
  restartRequired?: boolean;
  notes?: string;
  downloadUrl?: string;
  changelog?: ChangelogEntry[];
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
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELED';
  paymentTerms: string;
  bankAccountId?: string;
  remainingBalance?: number | string;
  paidAmount?: number | string;
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
  expenseCategory?: string;
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

export interface ExpenseCategorySummary {
  label: string;
  amount: number;
  count: number;
  transactions?: any[];
}

export interface ProfitLossReport {
  period: {
    startDate: string | null;
    endDate: string | null;
  };
  revenue: {
    billedRevenue: number;
    cashCollected: number;
    invoiceCount: number;
    invoices: Array<{
      id: string;
      invoiceNumber: string;
      customerName: string;
      date: string;
      totalAmount: number;
      status: string;
    }>;
  };
  directTradeCosts: number;
  grossProfit: number;
  grossMarginPercent: number;
  expensesByCategory: Record<string, ExpenseCategorySummary>;
  totalExpenses: number;
  netOperatingIncome: number;
  netMarginPercent: number;
}

export interface BalanceSheetReport {
  asOfDate: string;
  assets: {
    cashAndEquivalents: number;
    bankAccountName: string;
    accountNumberMasked: string;
    accountsReceivable: number;
    openInvoiceCount: number;
    totalAssets: number;
    openInvoices: Array<{
      id: string;
      invoiceNumber: string;
      customerName: string;
      issueDate: string;
      totalAmount: number;
      paidAsOf: number;
      outstanding: number;
    }>;
  };
  liabilities: {
    unallocatedCustomerAdvances: number;
    totalLiabilities: number;
  };
  equity: {
    openingCapital: number;
    retainedEarnings: number;
    totalEquity: number;
  };
  audit: {
    isBalanced: boolean;
    discrepancy: number;
  };
}

export interface CashFlowReport {
  period: {
    startDate: string | null;
    endDate: string | null;
  };
  cashFlows: {
    operatingActivities: {
      customerReceipts: number;
      vendorDisbursements: number;
      disbursementsByCategory: Record<string, number>;
      swiftFeesTracked: number;
      netCashFromOperations: number;
    };
  };
  cashSummary: {
    beginningCash: number;
    netChangeInCash: number;
    endingCash: number;
  };
}

export interface CustomerStatementEntry {
  id: string;
  date: string;
  type: 'INVOICE' | 'PAYMENT';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  swiftFee: number;
  runningBalance: number;
  status?: string;
  paymentMethod?: string;
}

export interface CustomerStatementReport {
  customer: {
    id: string;
    companyName: string;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    country?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
  };
  period: {
    startDate: string | null;
    endDate: string | null;
    isCustom: boolean;
  };
  summary: {
    openingBalance: number;
    totalInvoiced: number;
    totalPaymentsReceived: number;
    netPeriodChange: number;
    closingBalance: number;
    allTimeInvoiced: number;
    allTimePaid: number;
    allTimeOutstanding: number;
  };
  entries: CustomerStatementEntry[];
  invoices?: any[];
  payments?: any[];
}

