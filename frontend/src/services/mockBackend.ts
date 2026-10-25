// Comprehensive in-browser financial & logistics standalone database engine
// Provides 100% functionality and persistence for cloud and offline deployments

import { User, Customer, Invoice, Receipt, LedgerTransaction, Shipment, BankAccount, RemittanceProfile, DashboardOverview } from '../types';

const STORAGE_KEY = 'aq_standalone_db_v2';

// Optional shared secret for the cloud sync endpoint. Set VITE_SYNC_TOKEN at
// build time (and SYNC_TOKEN on the /api/sync serverless function) to lock the
// online store down; when unset the endpoint accepts anonymous traffic.
const SYNC_TOKEN = (import.meta as any).env?.VITE_SYNC_TOKEN || '';

function syncHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Cache-Control': 'no-cache' };
  if (SYNC_TOKEN) h['X-Sync-Token'] = SYNC_TOKEN;
  return h;
}

const ALL_PERMISSIONS = [
  'user:manage', 'settings:manage', 'invoice:create_draft', 'invoice:issue',
  'invoice:void', 'invoice:view', 'ledger:post_entry', 'ledger:reverse_entry',
  'ledger:view', 'payment:create', 'payment:allocate', 'shipment:manage',
  'shipment:view', 'bank_details:view_masked', 'bank_details:reveal_unmasked',
  'bank_details:manage', 'remittance:manage', 'remittance:set_default',
  'bank_details:export', 'bank_details:view_history', 'import:execute', 'audit:view'
];

interface DBState {
  users: any[];
  customers: Customer[];
  invoices: Invoice[];
  receipts: Receipt[];
  ledger: LedgerTransaction[];
  shipments: Shipment[];
  bankAccounts: BankAccount[];
  remittanceProfiles: RemittanceProfile[];
  payments: any[];
  auditEvents: any[];
  // Per-collection last-write timestamps that drive the cloud merge
  syncMeta?: Record<string, string>;
}

const SYNCED_COLLECTIONS = [
  'invoices', 'receipts', 'ledger', 'customers', 'shipments',
  'bankAccounts', 'remittanceProfiles', 'payments', 'auditEvents'
] as const;

export function getInitialState(): DBState {
  const initialCustomers: Customer[] = [
    {
      id: 'cust-001',
      companyName: 'G.T JAYANTI AGROCHEM INDIA PVT LTD',
      addressLine1: 'Shop No 14, APMC Market-1, Phase II, Turbhe',
      addressLine2: 'Navi Mumbai, Maharashtra 400705',
      country: 'India',
      email: 'jayanti@gtagrochem.com',
      isCustomer: true,
      isVendor: false
    },
    {
      id: 'cust-002',
      companyName: 'G.T INDIA PVT LTD',
      addressLine1: '4012, 4th Floor, Naya Bazar, Khari Baoli',
      addressLine2: 'Delhi 110006',
      country: 'India',
      email: 'imports@gtindia.com',
      isCustomer: true,
      isVendor: false
    },
    {
      id: 'cust-003',
      companyName: 'MANIK TRADERS',
      addressLine1: 'Plot 88, Grain Merchant Enclave, Lawrence Road',
      addressLine2: 'Delhi 110035',
      country: 'India',
      email: 'maniktraders@gmail.com',
      isCustomer: true,
      isVendor: false
    },
    {
      id: 'cust-004',
      companyName: 'SPDC BITES LLP',
      addressLine1: 'Plot No. 12, Food Processing Park, Rai Industrial Area',
      addressLine2: 'Sonipat, Haryana 131029',
      country: 'India',
      email: 'contact@spdcbites.com',
      isCustomer: true,
      isVendor: false
    }
  ];

  const initialBankAccounts: BankAccount[] = [
    {
      id: 'bank-001',
      bankName: 'Afghan United Bank (AUB)',
      beneficiaryName: 'Sky Ariana LTD',
      accountNumberMasked: '101502******0472',
      cifNumberMasked: '******4739',
      accountType: 'AWDCCA',
      accountStatus: 'Active',
      openingDate: '2026-09-13T00:00:00.000Z',
      branchName: 'AUB Building Zarghona Maidan, Shahr-e-Now, Kabul',
      swiftCode: 'AFGUAFKAXXX',
      correspondentBank: 'AL SALAM BANK BAHRAIN',
      correspondentSwift: 'ALSABHBMXXX',
      currency: 'USD',
      isPrimary: true
    }
  ];

  const initialRemittanceProfiles: RemittanceProfile[] = [
    {
      id: 'remit-intl',
      bankAccountId: 'bank-001',
      profileType: 'INTERNATIONAL',
      name: 'International USD Inward Remittance (Al Salam / JPMorgan)',
      beneficiaryName: 'SKY ARIANA LTD',
      beneficiaryAccount: '101502USD2940472',
      beneficiaryBank: 'AFGHAN UNITED BANK',
      beneficiaryBankAddress: 'AUB Building, Zarghona Maidan, Shahr-e-Now, Kabul',
      beneficiarySwift: 'AFGUAFKAXXX',
      swiftField57A: 'AFGUAFKAXXX',
      swiftField59A: '101502USD2940472 (Beneficiary account in field 59A; AFGUAFKAXXX in field 57A.)',
      aubAccountWithCorrespondent: 'BH61ALSA00500951200102',
      correspondentBank: 'AL SALAM BANK BAHRAIN',
      correspondentSwift: 'ALSABHBMXXX',
      correspondentAccount: '400758954',
      correspondentLocation: 'Sanabis, Bahrain',
      swiftField56A: 'ALSABHBM',
      intermediaryBank: 'JPMorgan Chase Bank, New York',
      intermediarySwift: 'CHASUS33',
      swiftField54A: 'Intermediary bank mandatory in field 54A',
      mt103VerificationFlag: true,
      verificationNotes: 'IMPORTANT: Intermediary bank mandatory in field 54A.',
      isDefault: true,
      isActive: true
    },
    {
      id: 'remit-local',
      bankAccountId: 'bank-001',
      profileType: 'LOCAL',
      name: 'Local USD Inward Remittance (DAB Clearing)',
      beneficiaryName: 'SKY ARIANA LTD',
      beneficiaryAccount: '101502USD2940472',
      beneficiaryBank: 'AFGHAN UNITED BANK',
      beneficiaryBankAddress: 'AUB Building, Zarghona Maidan, Shahr-e-Now, Kabul',
      beneficiarySwift: 'AFGUAFKAXXX',
      correspondentBank: '(DAB) DA AFGHANISTAN BANK',
      correspondentSwift: 'AFGBAFKA',
      correspondentAccount: '3000205027231',
      correspondentLocation: 'Ibni-sina Watt, Kabul',
      isDefault: false,
      isActive: true,
      verificationNotes: 'Approved for local domestic clearing in Afghanistan.'
    }
  ];

  const initialInvoices: Invoice[] = [
    {
      id: 'inv-001',
      invoiceNumber: 'PI-2026-0001',
      sourceInvoiceRef: '001',
      customerId: 'cust-001',
      customer: initialCustomers[0],
      issueDate: '2026-09-05T00:00:00.000Z',
      dueDate: '2026-09-12T00:00:00.000Z',
      currency: 'USD',
      paymentTerms: '100% Advance Payment',
      subtotal: 79332.80,
      taxAmount: 0,
      totalAmount: 79332.80,
      status: 'ISSUED',
      paymentStatus: 'PAID',
      remainingBalance: 0,
      lines: [
        {
          id: 'line-001',
          lineNumber: 1,
          description: 'Black Raisins (Best) - 1,385 CTNS',
          cartonCount: 1385,
          packagingKgPerCarton: 16.0,
          quantity: 22160,
          unitOfMeasure: 'KG',
          unitPrice: 3.58,
          lineTotal: 79332.80
        }
      ]
    },
    {
      id: 'inv-002',
      invoiceNumber: 'PI-2026-0002',
      sourceInvoiceRef: '001',
      customerId: 'cust-002',
      customer: initialCustomers[1],
      issueDate: '2026-09-23T00:00:00.000Z',
      dueDate: '2026-09-30T00:00:00.000Z',
      currency: 'USD',
      paymentTerms: '100% Advance Payment',
      subtotal: 74750.00,
      taxAmount: 0,
      totalAmount: 74750.00,
      status: 'ISSUED',
      paymentStatus: 'PAID',
      remainingBalance: 0,
      lines: [
        {
          id: 'line-002',
          lineNumber: 1,
          description: 'Black Raisins - 2,300 CTNS',
          cartonCount: 2300,
          packagingKgPerCarton: 10.0,
          quantity: 23000,
          unitOfMeasure: 'KG',
          unitPrice: 3.25,
          lineTotal: 74750.00
        }
      ]
    },
    {
      id: 'inv-003',
      invoiceNumber: 'PI-2026-0003',
      sourceInvoiceRef: '002',
      customerId: 'cust-002',
      customer: initialCustomers[1],
      issueDate: '2026-09-23T00:00:00.000Z',
      dueDate: '2026-09-30T00:00:00.000Z',
      currency: 'USD',
      paymentTerms: '100% Advance Payment',
      subtotal: 74587.50,
      taxAmount: 0,
      totalAmount: 74587.50,
      status: 'ISSUED',
      paymentStatus: 'UNPAID',
      remainingBalance: 74587.50,
      lines: [
        {
          id: 'line-003',
          lineNumber: 1,
          description: 'Black Raisins - 2,295 CTNS',
          cartonCount: 2295,
          packagingKgPerCarton: 10.0,
          quantity: 22950,
          unitOfMeasure: 'KG',
          unitPrice: 3.25,
          lineTotal: 74587.50
        }
      ]
    },
    {
      id: 'inv-004',
      invoiceNumber: 'PI-2026-0004',
      sourceInvoiceRef: '002',
      customerId: 'cust-001',
      customer: initialCustomers[0],
      issueDate: '2026-09-23T00:00:00.000Z',
      dueDate: '2026-09-30T00:00:00.000Z',
      currency: 'USD',
      paymentTerms: '100% Advance Payment',
      subtotal: 63000.00,
      taxAmount: 0,
      totalAmount: 63000.00,
      status: 'ISSUED',
      paymentStatus: 'PAID',
      remainingBalance: 0,
      lines: [
        {
          id: 'line-004',
          lineNumber: 1,
          description: 'Black Raisins - 2,250 CTNS',
          cartonCount: 2250,
          packagingKgPerCarton: 10.0,
          quantity: 22500,
          unitOfMeasure: 'KG',
          unitPrice: 2.80,
          lineTotal: 63000.00
        }
      ]
    },
    {
      id: 'inv-005',
      invoiceNumber: 'PI-2026-0005',
      sourceInvoiceRef: '001',
      customerId: 'cust-003',
      customer: initialCustomers[2],
      issueDate: '2026-09-28T00:00:00.000Z',
      dueDate: '2026-10-05T00:00:00.000Z',
      currency: 'USD',
      paymentTerms: '100% Advance Payment',
      subtotal: 57533.00,
      taxAmount: 0,
      totalAmount: 57533.00,
      status: 'ISSUED',
      paymentStatus: 'UNPAID',
      remainingBalance: 57533.00,
      lines: [
        {
          id: 'line-005',
          lineNumber: 1,
          description: 'Black Raisins - 1,383 CTNS',
          cartonCount: 1383,
          packagingKgPerCarton: 16.0,
          quantity: 22128,
          unitOfMeasure: 'KG',
          unitPrice: 2.60009942,
          lineTotal: 57533.00
        }
      ]
    },
    {
      id: 'inv-006',
      invoiceNumber: 'PI-2026-0006',
      sourceInvoiceRef: '002',
      customerId: 'cust-003',
      customer: initialCustomers[2],
      issueDate: '2026-09-28T00:00:00.000Z',
      dueDate: '2026-10-05T00:00:00.000Z',
      currency: 'USD',
      paymentTerms: '100% Advance Payment',
      subtotal: 62003.00,
      taxAmount: 0,
      totalAmount: 62003.00,
      status: 'ISSUED',
      paymentStatus: 'UNPAID',
      remainingBalance: 62003.00,
      lines: [
        {
          id: 'line-006',
          lineNumber: 1,
          description: 'Black Raisins - 1,384 CTNS',
          cartonCount: 1384,
          packagingKgPerCarton: 16.0,
          quantity: 22144,
          unitOfMeasure: 'KG',
          unitPrice: 2.80,
          lineTotal: 62003.00
        }
      ]
    },
    {
      id: 'inv-007',
      invoiceNumber: 'PI-2026-0007',
      sourceInvoiceRef: '003',
      customerId: 'cust-003',
      customer: initialCustomers[2],
      issueDate: '2026-09-28T00:00:00.000Z',
      dueDate: '2026-10-05T00:00:00.000Z',
      currency: 'USD',
      paymentTerms: '100% Advance Payment',
      subtotal: 72020.00,
      taxAmount: 0,
      totalAmount: 72020.00,
      status: 'ISSUED',
      paymentStatus: 'UNPAID',
      remainingBalance: 72020.00,
      lines: [
        {
          id: 'line-007',
          lineNumber: 1,
          description: 'Black Raisins - 1,385 CTNS',
          cartonCount: 1385,
          packagingKgPerCarton: 16.0,
          quantity: 22160,
          unitOfMeasure: 'KG',
          unitPrice: 3.25,
          lineTotal: 72020.00
        }
      ]
    },
    {
      id: 'inv-008',
      invoiceNumber: 'PI-2026-0008',
      sourceInvoiceRef: '001',
      customerId: 'cust-004',
      customer: initialCustomers[3],
      issueDate: '2026-09-28T00:00:00.000Z',
      dueDate: '2026-10-05T00:00:00.000Z',
      currency: 'USD',
      paymentTerms: '100% Advance Payment',
      subtotal: 71864.00,
      taxAmount: 0,
      totalAmount: 71864.00,
      status: 'ISSUED',
      paymentStatus: 'UNPAID',
      remainingBalance: 71864.00,
      lines: [
        {
          id: 'line-008',
          lineNumber: 1,
          description: 'Black Raisins - 1,382 CTNS',
          cartonCount: 1382,
          packagingKgPerCarton: 16.0,
          quantity: 22122,
          unitOfMeasure: 'KG',
          unitPrice: 3.24853087,
          lineTotal: 71864.00
        }
      ]
    }
  ];

  const initialReceipts: Receipt[] = [
    {
      id: 'rcp-001',
      receiptNumber: 'RCP-2026-0001',
      paymentId: 'pay-001',
      payerName: 'G.T JAYANTI AGROCHEM INDIA PVT LTD',
      amount: 78893.36,
      grossAmount: 79332.80,
      swiftFeeAmount: 439.44,
      currency: 'USD',
      status: 'ISSUED',
      receivingAccountName: 'Afghan United Bank (AUB)',
      receivingAccountMasked: '101502******0472',
      issueDate: '2026-09-30T00:00:00.000Z',
      purpose: 'Export Settlement for PI-2026-0001 (Black Raisins)',
      referenceNumber: '0464AIR261771143',
      createdAt: '2026-09-30T00:00:00.000Z'
    },
    {
      id: 'rcp-002',
      receiptNumber: 'RCP-2026-0002',
      paymentId: 'pay-002',
      payerName: 'GT INDIA PVT LTD',
      amount: 74376.25,
      grossAmount: 74750.00,
      swiftFeeAmount: 373.75,
      currency: 'USD',
      status: 'ISSUED',
      receivingAccountName: 'Afghan United Bank (AUB)',
      receivingAccountMasked: '101502******0472',
      issueDate: '2026-10-08T00:00:00.000Z',
      purpose: 'Export Settlement for PI-2026-0002 (Black Raisins)',
      referenceNumber: '8483AIR261778937',
      createdAt: '2026-10-08T00:00:00.000Z'
    },
    {
      id: 'rcp-003',
      receiptNumber: 'RCP-2026-0003',
      paymentId: 'pay-003',
      payerName: 'G.T JAYANTI AGROCHEM INDIA PVT LTD',
      amount: 62685.00,
      grossAmount: 63000.00,
      swiftFeeAmount: 315.00,
      currency: 'USD',
      status: 'ISSUED',
      receivingAccountName: 'Afghan United Bank (AUB)',
      receivingAccountMasked: '101502******0472',
      issueDate: '2026-10-12T00:00:00.000Z',
      purpose: 'Export Settlement for PI-2026-0004 (Black Raisins - 2,250 CTNS)',
      referenceNumber: '0922AIR261783419',
      createdAt: '2026-10-12T00:00:00.000Z'
    }
  ];

  const initialLedger: LedgerTransaction[] = [
    {
      id: 'tx-001',
      effectiveDate: '2026-09-01T00:00:00.000Z',
      postedAt: '2026-09-01T00:00:00.000Z',
      reference: 'OP-BAL-001',
      description: 'Starting Balance Prior to Transfers',
      category: 'BALANCE',
      debitAmount: 0,
      creditAmount: 83.36,
      runningBalance: 83.36,
      currency: 'USD',
      reconciliationStatus: 'RECONCILED'
    },
    {
      id: 'tx-002',
      effectiveDate: '2026-09-30T00:00:00.000Z',
      postedAt: '2026-09-30T00:00:00.000Z',
      reference: '0464AIR261771143',
      description: 'Inward Transfer: G.T JAYANTI AGROCHEM (INV 001)',
      category: 'CREDIT',
      debitAmount: 0,
      creditAmount: 78893.36,
      runningBalance: 78976.72,
      currency: 'USD',
      reconciliationStatus: 'RECONCILED'
    },
    {
      id: 'tx-003',
      effectiveDate: '2026-10-08T00:00:00.000Z',
      postedAt: '2026-10-08T00:00:00.000Z',
      reference: '8483AIR261778937',
      description: 'Inward Transfer: GT INDIA PVT LTD',
      category: 'CREDIT',
      debitAmount: 0,
      creditAmount: 74376.25,
      runningBalance: 153352.97,
      currency: 'USD',
      reconciliationStatus: 'RECONCILED'
    },
    {
      id: 'tx-004',
      effectiveDate: '2026-10-08T00:00:00.000Z',
      postedAt: '2026-10-08T00:00:00.000Z',
      reference: 'PAY-NOORI',
      description: 'Payment to Hayatullah Noori',
      category: 'DEBIT',
      debitAmount: 15200.00,
      creditAmount: 0,
      runningBalance: 138152.97,
      currency: 'USD',
      reconciliationStatus: 'RECONCILED'
    },
    {
      id: 'tx-005',
      effectiveDate: '2026-10-08T00:00:00.000Z',
      postedAt: '2026-10-08T00:00:00.000Z',
      reference: 'AD 5708262',
      description: 'Payment to Sodiqjon Aminov (Tashkent)',
      category: 'DEBIT',
      debitAmount: 35000.00,
      creditAmount: 0,
      runningBalance: 103152.97,
      currency: 'USD',
      reconciliationStatus: 'RECONCILED'
    },
    {
      id: 'tx-006',
      effectiveDate: '2026-10-08T00:00:00.000Z',
      postedAt: '2026-10-08T00:00:00.000Z',
      reference: 'PAY-NAJEB',
      description: 'Payment to NAJEB AMIN LTD',
      category: 'DEBIT',
      debitAmount: 78893.36,
      creditAmount: 0,
      runningBalance: 24259.61,
      currency: 'USD',
      reconciliationStatus: 'RECONCILED'
    },
    {
      id: 'tx-007',
      effectiveDate: '2026-10-12T00:00:00.000Z',
      postedAt: '2026-10-12T00:00:00.000Z',
      reference: '0922AIR261783419',
      description: 'Inward Transfer: G.T JAYANTI AGROCHEM (INV 004)',
      category: 'CREDIT',
      debitAmount: 0,
      creditAmount: 62685.00,
      runningBalance: 86944.61,
      currency: 'USD',
      reconciliationStatus: 'RECONCILED'
    }
  ];

  const initialShipments: Shipment[] = [
    {
      id: 'shp-001',
      shipmentRef: 'SHP-9001',
      containerNumber: 'MSKU9023418',
      billOfLading: 'BL-1928374',
      origin: 'Kandahar',
      destination: 'Nhava Sheva',
      carrier: 'Maersk Line',
      shipmentDate: '2026-10-10T00:00:00.000Z',
      estimatedArrivalDate: '2026-10-22T00:00:00.000Z',
      status: 'IN_TRANSIT',
      notes: 'Kandahar -> Nhava Sheva via Maersk Line. Proforma Ref: 001'
    },
    {
      id: 'shp-002',
      shipmentRef: 'SHP-9002',
      containerNumber: 'TGHU8172635',
      billOfLading: 'BL-1928375',
      origin: 'Dogharoun',
      destination: 'Mundra',
      carrier: 'CMA CGM',
      shipmentDate: '2026-10-12T00:00:00.000Z',
      estimatedArrivalDate: '2026-10-25T00:00:00.000Z',
      status: 'BOOKED',
      notes: 'Dogharoun -> Mundra via CMA CGM. Proforma Ref: 002'
    }
  ];

  const initialUsers = [
    {
      id: 'usr-001',
      email: 'ahsanullah@aqcompanies.com',
      password: 'Qur78Ahs@@',
      firstName: 'Ahsanullah',
      lastName: 'Qureshi',
      roles: ['ADMIN'],
      permissions: ALL_PERMISSIONS,
      isActive: true
    },
    {
      id: 'usr-002',
      email: 'danish@aqcompanies.com',
      password: 'Danish123@789',
      firstName: 'Danish',
      lastName: 'Qureshi',
      roles: ['ADMIN'],
      permissions: ALL_PERMISSIONS,
      isActive: true
    },
    {
      id: 'usr-003',
      email: 'admin@aqcompanies.com',
      password: 'AQCompanies@2026',
      firstName: 'System',
      lastName: 'Administrator',
      roles: ['ADMIN'],
      permissions: ALL_PERMISSIONS,
      isActive: true
    },
    {
      id: 'usr-004',
      email: 'finance@aqcompanies.com',
      password: 'AQCompanies@2026',
      firstName: 'Ahmad',
      lastName: 'Finance',
      roles: ['FINANCE_MANAGER'],
      permissions: ALL_PERMISSIONS.slice(2, 18),
      isActive: true
    },
    {
      id: 'usr-005',
      email: 'logistics@aqcompanies.com',
      password: 'AQCompanies@2026',
      firstName: 'Tariq',
      lastName: 'Logistics',
      roles: ['LOGISTICS_COORDINATOR'],
      permissions: ['shipment:manage', 'shipment:view', 'invoice:view'],
      isActive: true
    },
    {
      id: 'usr-006',
      email: 'auditor@aqcompanies.com',
      password: 'AQCompanies@2026',
      firstName: 'Sarah',
      lastName: 'Auditor',
      roles: ['AUDITOR'],
      permissions: ['invoice:view', 'ledger:view', 'shipment:view', 'bank_details:view_masked', 'bank_details:view_history', 'bank_details:export', 'audit:view'],
      isActive: true
    },
    {
      id: 'usr-007',
      email: 'viewer@aqcompanies.com',
      password: 'AQCompanies@2026',
      firstName: 'Guest',
      lastName: 'Viewer',
      roles: ['VIEWER'],
      permissions: ['invoice:view', 'shipment:view', 'ledger:view', 'bank_details:view_masked'],
      isActive: true
    }
  ];

  return {
    users: initialUsers,
    customers: initialCustomers,
    invoices: initialInvoices,
    receipts: initialReceipts,
    ledger: initialLedger,
    shipments: initialShipments,
    bankAccounts: initialBankAccounts,
    remittanceProfiles: initialRemittanceProfiles,
    payments: [],
    auditEvents: [
      {
        id: 'aud-001',
        action: 'SYSTEM_INITIALIZED',
        entityType: 'SYSTEM',
        entityId: 'ROOT',
        actorEmail: 'system@aqcompanies.com',
        timestamp: new Date().toISOString(),
        details: { message: 'AQ Companies Financial & Logistics Core initialized' }
      }
    ]
  };
}

class MockBackendEngine {
  private state: DBState;
  private syncInProgress = false;
  private lastSyncedVersion = 0;
  private pendingPushTimer: any = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private pushInFlight = false;
  private pushQueued = false;
  private pushRetryAttempt = 0;
  private pushRetryTimer: any = null;

  constructor() {
    this.state = this.loadState();
    this.initCloudSync();
  }

  private initCloudSync(): void {
    if (typeof window === 'undefined') return;

    try {
      const v = localStorage.getItem('aq_cloud_version');
      if (v) this.lastSyncedVersion = parseInt(v, 10) || 0;
    } catch {}

    // 1. Cross-tab instant communication via BroadcastChannel
    if ('BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('aq_portal_sync_channel');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'AQ_STATE_UPDATE' && event.data.state) {
            this.state = event.data.state;
            if (event.data.version) {
              this.lastSyncedVersion = event.data.version;
            }
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
              localStorage.setItem('aq_cloud_version', String(this.lastSyncedVersion));
            } catch {}
            window.dispatchEvent(new CustomEvent('aq:data-mutated'));
            window.dispatchEvent(new CustomEvent('aq:cloud-sync-status', {
              detail: { status: 'synced', version: this.lastSyncedVersion, source: 'tab' }
            }));
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel not initialized:', e);
      }
    }

    // 2. Immediate background sync on app load
    setTimeout(() => {
      this.syncWithCloud(true);
    }, 50);

    // 3. Sync on window / tab focus
    window.addEventListener('focus', () => {
      this.syncWithCloud();
    });

    // 4. Sync on tab visibility change (switching apps or tabs)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.syncWithCloud();
      }
    });

    // 5. Sync when internet connectivity is restored
    window.addEventListener('online', () => {
      this.syncWithCloud(true);
    });

    // 6. Keepalive flush on page unload
    window.addEventListener('beforeunload', () => {
      if (this.pendingPushTimer) {
        clearTimeout(this.pendingPushTimer);
        try {
          fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...syncHeaders() },
            body: JSON.stringify({ state: this.state }),
            keepalive: true
          });
        } catch {}
      }
    });

    // 7. Frequent background sync poll (every 8 seconds)
    setInterval(() => {
      this.syncWithCloud();
    }, 8000);

    // 8. Manual on-demand sync request
    window.addEventListener('aq:request-cloud-sync', () => {
      this.syncWithCloud(true);
    });
  }

  public async syncWithCloud(force = false): Promise<void> {
    if (this.syncInProgress || typeof window === 'undefined') return;
    this.syncInProgress = true;
    try {
      const qs = this.lastSyncedVersion > 0 ? `?sinceVersion=${this.lastSyncedVersion}` : '';
      const res = await fetch(`/api/sync${qs}`, { headers: syncHeaders() });
      if (!res.ok) {
        window.dispatchEvent(new CustomEvent('aq:cloud-sync-status', {
          detail: { status: 'error', error: `Cloud responded ${res.status}` }
        }));
        return;
      }
      const body = await res.json();
      if (!body.success) return;

      // Delta poll: cloud version already matches local, nothing to do.
      if (body.unchanged) {
        window.dispatchEvent(new CustomEvent('aq:cloud-sync-status', {
          detail: { status: 'synced', version: Number(body.version || this.lastSyncedVersion), source: 'cloud' }
        }));
        return;
      }

      if (body.exists && body.data) {
        const cloudVersion = Number(body.version || 0);
        if (cloudVersion > this.lastSyncedVersion || force) {
          const fresh = getInitialState();
          const parsed = body.data;

          if (!Array.isArray(parsed.invoices)) parsed.invoices = fresh.invoices;
          if (!Array.isArray(parsed.receipts)) parsed.receipts = fresh.receipts;
          if (!Array.isArray(parsed.ledger)) parsed.ledger = fresh.ledger;
          if (!Array.isArray(parsed.customers)) parsed.customers = fresh.customers;
          if (!Array.isArray(parsed.shipments)) parsed.shipments = fresh.shipments;
          if (!Array.isArray(parsed.bankAccounts)) parsed.bankAccounts = fresh.bankAccounts;
          if (!Array.isArray(parsed.remittanceProfiles)) parsed.remittanceProfiles = fresh.remittanceProfiles;
          if (!Array.isArray(parsed.payments)) parsed.payments = [];
          if (!Array.isArray(parsed.auditEvents)) parsed.auditEvents = [];

          // Preserve users with credentials
          for (const u of fresh.users) {
            const idx = parsed.users?.findIndex((x: any) => x.email.toLowerCase() === u.email.toLowerCase()) ?? -1;
            if (idx >= 0) {
              parsed.users[idx] = { ...parsed.users[idx], password: u.password, roles: u.roles, permissions: u.permissions, isActive: true };
            } else if (Array.isArray(parsed.users)) {
              parsed.users.push(u);
            }
          }

          // Collection-level guard: never clobber a locally newer collection
          // with a stale cloud copy (e.g. focus sync racing an in-flight push).
          const cloudMeta = parsed.syncMeta || {};
          const localMeta = this.state?.syncMeta || {};
          const stamp = (m: any, k: string) => Date.parse(m?.[k]) || 0;
          const finalMeta: Record<string, string> = {};
          for (const key of SYNCED_COLLECTIONS) {
            if (Array.isArray(this.state?.[key as keyof DBState]) && stamp(localMeta, key) > stamp(cloudMeta, key)) {
              (parsed as any)[key] = this.state[key as keyof DBState];
              finalMeta[key] = localMeta[key];
            } else {
              finalMeta[key] = cloudMeta[key] || localMeta[key] || new Date().toISOString();
            }
          }
          parsed.syncMeta = finalMeta;

          this.state = parsed;
          this.lastSyncedVersion = cloudVersion;

          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
            localStorage.setItem('aq_cloud_version', String(cloudVersion));
          } catch {}

          // Notify other open tabs
          if (this.broadcastChannel) {
            try {
              this.broadcastChannel.postMessage({
                type: 'AQ_STATE_UPDATE',
                version: this.lastSyncedVersion,
                state: this.state
              });
            } catch {}
          }

          window.dispatchEvent(new CustomEvent('aq:data-mutated'));
          window.dispatchEvent(new CustomEvent('aq:cloud-sync-status', {
            detail: { status: 'synced', version: cloudVersion, source: 'cloud' }
          }));
        }
      } else {
        await this.pushToCloud(this.state);
      }
    } catch (err) {
      console.warn('[AQ Cloud Sync] Background sync error:', err);
      window.dispatchEvent(new CustomEvent('aq:cloud-sync-status', {
        detail: { status: 'offline', error: String(err) }
      }));
    } finally {
      this.syncInProgress = false;
    }
  }

  public async pushToCloud(state = this.state): Promise<void> {
    if (typeof window === 'undefined') return;
    // Coalesce overlapping pushes (saveState debounce + direct calls) into one
    if (this.pushInFlight) {
      this.pushQueued = true;
      return;
    }
    this.pushInFlight = true;
    try {
      window.dispatchEvent(new CustomEvent('aq:cloud-sync-status', {
        detail: { status: 'saving' }
      }));

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...syncHeaders() },
        body: JSON.stringify({ state })
      });

      if (res.ok) {
        const body = await res.json();
        if (body.version) {
          this.lastSyncedVersion = Number(body.version);
          if (body.data) {
            // Keep any locally newer collections (written while the POST was in flight)
            const merged = body.data;
            const localMeta = state?.syncMeta || {};
            const cloudMeta = merged?.syncMeta || {};
            const stamp = (m: any, k: string) => Date.parse(m?.[k]) || 0;
            for (const key of SYNCED_COLLECTIONS) {
              if (stamp(localMeta, key) > stamp(cloudMeta, key) && Array.isArray((state as any)[key])) {
                (merged as any)[key] = (state as any)[key];
              }
            }
            this.state = merged;
          }
          this.pushRetryAttempt = 0;
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
            localStorage.setItem('aq_cloud_version', String(this.lastSyncedVersion));
          } catch {}

          // Broadcast to any other open tabs immediately
          if (this.broadcastChannel) {
            try {
              this.broadcastChannel.postMessage({
                type: 'AQ_STATE_UPDATE',
                version: this.lastSyncedVersion,
                state: this.state
              });
            } catch {}
          }

          window.dispatchEvent(new CustomEvent('aq:data-mutated'));
          window.dispatchEvent(new CustomEvent('aq:cloud-sync-status', {
            detail: { status: 'synced', version: this.lastSyncedVersion, source: 'local' }
          }));
        }
      } else {
        throw new Error(`Cloud save failed (${res.status})`);
      }
    } catch (err) {
      console.warn('[AQ Cloud Sync] Failed to push to cloud:', err);
      window.dispatchEvent(new CustomEvent('aq:cloud-sync-status', {
        detail: { status: 'error', error: String(err) }
      }));
      // Retry with backoff so a transient failure never leaves data stranded
      // locally until the next mutation.
      if (this.pushRetryAttempt < 5) {
        const delay = Math.min(30000, 2000 * Math.pow(2, this.pushRetryAttempt));
        this.pushRetryAttempt += 1;
        if (this.pushRetryTimer) clearTimeout(this.pushRetryTimer);
        this.pushRetryTimer = setTimeout(() => {
          this.pushInFlight = false;
          this.pushQueued = false;
          this.pushToCloud(this.state);
        }, delay);
      }
      return;
    } finally {
      this.pushInFlight = false;
    }
    if (this.pushQueued) {
      this.pushQueued = false;
      this.pushToCloud(this.state);
    }
  }

  private loadState(): DBState {
    const fresh = getInitialState();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure requested users always exist with their credentials even if cached
        for (const u of fresh.users) {
          const idx = parsed.users.findIndex((x: any) => x.email.toLowerCase() === u.email.toLowerCase());
          if (idx >= 0) {
            parsed.users[idx] = { ...parsed.users[idx], password: u.password, roles: u.roles, permissions: u.permissions, isActive: true };
          } else {
            parsed.users.push(u);
          }
        }
        if (!Array.isArray(parsed.invoices)) {
          parsed.invoices = fresh.invoices;
        } else {
          // Ensure PI-2026-0004 ($63,000) is marked PAID with $0 remaining balance
          const pi4 = parsed.invoices.find((i: any) => i.invoiceNumber === 'PI-2026-0004' || i.id === 'inv-004');
          if (pi4) {
            pi4.paymentStatus = 'PAID';
            pi4.remainingBalance = 0;
            pi4.status = 'ISSUED';
          }
        }

        if (!Array.isArray(parsed.receipts)) {
          parsed.receipts = fresh.receipts;
        } else {
          for (const fr of fresh.receipts) {
            if (!parsed.receipts.some((r: any) => r.receiptNumber === fr.receiptNumber || r.id === fr.id)) {
              parsed.receipts.push(fr);
            }
          }
        }

        if (!Array.isArray(parsed.ledger)) {
          parsed.ledger = fresh.ledger;
        } else {
          for (const ft of fresh.ledger) {
            if (!parsed.ledger.some((t: any) => t.id === ft.id || (t.reference && t.reference === ft.reference))) {
              parsed.ledger.push(ft);
            }
          }
        }

        if (!Array.isArray(parsed.shipments)) parsed.shipments = fresh.shipments;
        if (!Array.isArray(parsed.customers)) parsed.customers = fresh.customers;
        if (!Array.isArray(parsed.bankAccounts)) parsed.bankAccounts = fresh.bankAccounts;
        if (!Array.isArray(parsed.remittanceProfiles)) parsed.remittanceProfiles = fresh.remittanceProfiles;
        if (!Array.isArray(parsed.payments)) parsed.payments = [];
        if (!Array.isArray(parsed.auditEvents)) parsed.auditEvents = [];
        this.saveState(parsed);
        return parsed;
      }
    } catch {
      // ignore
    }
    this.saveState(fresh);
    return fresh;
  }

  public saveState(state = this.state, immediate = false) {
    // Stamp every synced collection so the cloud can merge per collection and
    // deletions propagate instead of resurrecting.
    const stamp = new Date().toISOString();
    const meta = { ...(state.syncMeta || {}) };
    for (const key of SYNCED_COLLECTIONS) {
      meta[key] = stamp;
    }
    state.syncMeta = meta;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'AQ_STATE_UPDATE',
          version: this.lastSyncedVersion,
          state: this.state
        });
      } catch {}
    }

    if (typeof window !== 'undefined') {
      if (this.pendingPushTimer) {
        clearTimeout(this.pendingPushTimer);
      }
      if (immediate) {
        this.pushToCloud(state);
      } else {
        this.pendingPushTimer = setTimeout(() => {
          this.pushToCloud(state);
        }, 400);
      }
    }
  }

  public recalculateLedgerBalances() {
    let balance = 0;
    for (const tx of this.state.ledger) {
      const credit = Number(tx.creditAmount || 0);
      const debit = Number(tx.debitAmount || 0);
      balance = balance + credit - debit;
      tx.runningBalance = Number(balance.toFixed(2));
    }
  }

  public resetBaseline() {
    this.state = getInitialState();
    this.saveState();
    return { success: true, message: 'Database reset to verified baseline.' };
  }

  public async handleRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const method = (options.method || 'GET').toUpperCase();
    const url = new URL(`http://local${endpoint}`);
    const pathname = url.pathname;
    const body = options.body ? JSON.parse(options.body as string) : {};

    // 1. Auth Login & 2FA
    if (pathname === '/auth/login' && method === 'POST') {
      const email = (body.email || '').trim().toLowerCase();
      const password = (body.password || '').trim();

      const user = this.state.users.find(u => u.email.toLowerCase() === email);
      if (!user) {
        const err = new Error('Invalid corporate credentials');
        (err as any).status = 401;
        throw err;
      }

      if (user.password !== password) {
        const err = new Error('Invalid corporate credentials');
        (err as any).status = 401;
        throw err;
      }

      const userObj: User = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        permissions: user.permissions
      };

      const token = `mock-jwt-${btoa(JSON.stringify(userObj))}-${Date.now()}`;
      return {
        accessToken: token,
        token,
        user: userObj
      } as any;
    }

    if (pathname === '/auth/verify-2fa' && method === 'POST') {
      const user = this.state.users[0];
      const userObj: User = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        permissions: user.permissions
      };
      const token = `mock-jwt-${btoa(JSON.stringify(userObj))}-${Date.now()}`;
      return {
        accessToken: token,
        token,
        user: userObj
      } as any;
    }

    if (pathname === '/auth/resend-2fa' && method === 'POST') {
      return { success: true, message: 'New 2FA security code dispatched.' } as any;
    }

    if (pathname === '/auth/me') {
      const authHeader = (options.headers as any)?.Authorization || (options.headers as any)?.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      let user = this.state.users[0];
      if (token && token.startsWith('demo-jwt-token-')) {
        const email = token.replace('demo-jwt-token-', '').toLowerCase();
        const found = this.state.users.find(u => u.email.toLowerCase() === email);
        if (found) user = found;
      }
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: Array.isArray(user.roles) ? user.roles : ['ADMIN'],
        permissions: Array.isArray(user.permissions) ? user.permissions : []
      } as any;
    }

    if (pathname === '/auth/users') {
      return this.state.users.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        roles: u.roles,
        permissions: u.permissions,
        isActive: u.isActive
      })) as any;
    }

    // Resolve the acting user from the mock JWT so password changes hit the right record
    const authUser = (): any => {
      const authHeader = (options.headers as any)?.Authorization || (options.headers as any)?.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (token.startsWith('mock-jwt-')) {
        try {
          const payload = JSON.parse(atob(token.replace('mock-jwt-', '').split('-').slice(0, -1).join('-')));
          return this.state.users.find((u: any) => u.email.toLowerCase() === String(payload.email || '').toLowerCase());
        } catch {}
      }
      if (token.startsWith('demo-jwt-token-')) {
        return this.state.users.find((u: any) => u.email.toLowerCase() === token.replace('demo-jwt-token-', '').toLowerCase());
      }
      return this.state.users[0];
    };

    if (pathname === '/auth/change-password' && method === 'POST') {
      const user = authUser();
      if (!user) {
        const err = new Error('Session not recognized. Please sign in again.');
        (err as any).status = 401;
        throw err;
      }
      if ((body.currentPassword || '') !== user.password) {
        const err = new Error('Current password is incorrect.');
        (err as any).status = 400;
        throw err;
      }
      user.password = body.newPassword;
      this.saveState();
      return { success: true, message: 'Password updated successfully.' } as any;
    }

    if (pathname === '/auth/users' && method === 'POST') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email || !body.firstName) {
        const err = new Error('First name and email are required.');
        (err as any).status = 400;
        throw err;
      }
      if (this.state.users.some((u: any) => u.email.toLowerCase() === email)) {
        const err = new Error('A user with this email already exists.');
        (err as any).status = 400;
        throw err;
      }
      const newUser = {
        id: `usr-${Date.now().toString(36)}`,
        email,
        password: body.password || 'Welcome@2026',
        firstName: body.firstName,
        lastName: body.lastName || '',
        roles: Array.isArray(body.roles) && body.roles.length ? body.roles : ['OPERATOR'],
        permissions: Array.isArray(body.permissions) ? body.permissions : [],
        isActive: body.isActive !== false
      };
      this.state.users.push(newUser);
      this.saveState();
      const { password, ...safe } = newUser;
      return safe as any;
    }

    const userRouteMatch = pathname.match(/^\/auth\/users\/([^/]+)$/);
    if (userRouteMatch) {
      const targetId = decodeURIComponent(userRouteMatch[1]);
      const idx = this.state.users.findIndex((u: any) => u.id === targetId);
      if (idx === -1) {
        const err = new Error('User not found.');
        (err as any).status = 404;
        throw err;
      }

      if (method === 'PUT') {
        const target = this.state.users[idx];
        if (body.firstName !== undefined) target.firstName = body.firstName;
        if (body.lastName !== undefined) target.lastName = body.lastName;
        if (body.email !== undefined) target.email = String(body.email).trim().toLowerCase();
        if (Array.isArray(body.roles) && body.roles.length) target.roles = body.roles;
        if (Array.isArray(body.permissions)) target.permissions = body.permissions;
        if (body.isActive !== undefined) target.isActive = Boolean(body.isActive);
        if (body.password) target.password = body.password;
        this.saveState();
        const { password, ...safe } = target;
        return safe as any;
      }

      if (method === 'DELETE') {
        if (this.state.users.length <= 1) {
          const err = new Error('At least one active user must remain.');
          (err as any).status = 400;
          throw err;
        }
        const target = this.state.users[idx];
        if (target.roles?.includes('ADMIN') && this.state.users.filter((u: any) => u.roles?.includes('ADMIN')).length <= 1) {
          const err = new Error('Cannot delete the last administrator account.');
          (err as any).status = 400;
          throw err;
        }
        this.state.users.splice(idx, 1);
        this.saveState();
        return { success: true } as any;
      }
    }

    // 2. Dashboard Overview
    if (pathname === '/dashboard/overview') {
      const totalInvoiced = this.state.invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
      const paidInvoices = this.state.invoices.filter(i => i.paymentStatus === 'PAID');
      const totalCollected = paidInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
      const pendingReceivables = Math.max(0, totalInvoiced - totalCollected);

      const totalCredits = this.state.ledger.reduce((sum, tx) => sum + Number(tx.creditAmount || 0), 0);
      const totalDebits = this.state.ledger.reduce((sum, tx) => sum + Number(tx.debitAmount || 0), 0);
      const latestRunning = this.state.ledger.length > 0
        ? Number(this.state.ledger[this.state.ledger.length - 1].runningBalance)
        : 24259.61;

      const totalSwiftFees = this.state.receipts.reduce((sum, r) => sum + Number(r.swiftFeeAmount || 0), 0);
      const totalWeightKg = this.state.invoices.reduce((sum, inv) => {
        const w = (inv.lines || []).reduce((lsum, l) => lsum + Number(l.quantity || 0), 0);
        return sum + w;
      }, 0);

      const overview: DashboardOverview = {
        metrics: {
          availableBalance: latestRunning.toFixed(2),
          totalCredits: totalCredits.toFixed(2),
          totalDebits: totalDebits.toFixed(2),
          totalInvoiced: totalInvoiced.toFixed(2),
          totalWeightKg: totalWeightKg.toLocaleString(),
          totalSwiftFees: totalSwiftFees.toFixed(2),
          pendingReceivables: pendingReceivables.toFixed(2),
          unpaidInvoicesCount: this.state.invoices.filter(i => i.paymentStatus !== 'PAID').length,
          activeShipmentsCount: this.state.shipments.filter(s => s.status !== 'DELIVERED').length,
          totalInvoicesCount: this.state.invoices.length,
          unreconciledTxCount: this.state.ledger.filter(tx => tx.reconciliationStatus !== 'RECONCILED').length,
          totalReceiptsCount: this.state.receipts.filter(r => r.status === 'ISSUED' || r.status === 'VALID').length
        },
        cashFlow: {
          totalIncoming: totalCredits.toFixed(2),
          totalOutgoing: totalDebits.toFixed(2),
          netOperatingCashFlow: (totalCredits - totalDebits).toFixed(2),
          pendingReceivables: pendingReceivables.toFixed(2),
          totalSwiftFees: totalSwiftFees.toFixed(2)
        },
        latestTransactions: this.state.ledger.slice(-5).reverse(),
        recentShipments: this.state.shipments
      };

      return overview as any;
    }

    // 3. Proforma Invoices
    if (pathname === '/invoices') {
      if (method === 'GET') {
        const querySearch = url.searchParams.get('search')?.toLowerCase();
        const statusFilter = url.searchParams.get('status');
        const invoiceSeq = (i: Invoice) => {
          const m = /(\d+)\s*$/.exec(String(i.invoiceNumber || ''));
          return m ? parseInt(m[1], 10) : 0;
        };
        const sortInvoices = (list: Invoice[]) =>
          [...list].sort((a, b) => {
            const dateDiff = new Date(b.issueDate || 0).getTime() - new Date(a.issueDate || 0).getTime();
            if (dateDiff !== 0) return dateDiff;
            return invoiceSeq(b) - invoiceSeq(a);
          });
        let result = this.state.invoices;
        if (statusFilter) {
          result = result.filter(inv => inv.status === statusFilter);
        }
        if (querySearch) {
          result = result.filter(inv =>
            inv.invoiceNumber.toLowerCase().includes(querySearch) ||
            inv.customer?.companyName.toLowerCase().includes(querySearch) ||
            (inv.sourceInvoiceRef && inv.sourceInvoiceRef.toLowerCase().includes(querySearch))
          );
        }
        return sortInvoices(result) as any;
      }
      if (method === 'POST') {
        const lines = (body.lines || []).map((l: any, idx: number) => {
          const qty = Number(l.quantity) || 0;
          const price = Number(l.unitPrice) || 0;
          return {
            id: `line-${Date.now()}-${idx}`,
            lineNumber: idx + 1,
            description: l.description,
            cartonCount: l.cartonCount ? Number(l.cartonCount) : undefined,
            packagingKgPerCarton: l.packagingKgPerCarton ? Number(l.packagingKgPerCarton) : undefined,
            quantity: qty,
            unitOfMeasure: l.unitOfMeasure || 'KG',
            unitPrice: price,
            lineTotal: Number((qty * price).toFixed(2))
          };
        });
        const calculatedTotal = lines.reduce((sum: number, l: any) => sum + l.lineTotal, 0);
        const finalTotal = calculatedTotal > 0 ? calculatedTotal : (Number(body.totalAmount) || 0);

        // Derive the next PI number from the highest existing sequence rather
        // than the array length so deletions never cause number collisions.
        const maxSeq = this.state.invoices.reduce((max, i) => {
          const m = /(\d+)\s*$/.exec(String(i.invoiceNumber || ''));
          return m ? Math.max(max, parseInt(m[1], 10)) : max;
        }, 0);
        const nextSeq = maxSeq + 1;

        const newInvoice: Invoice = {
          id: `inv-${Date.now()}`,
          invoiceNumber: body.invoiceNumber || `PI-${new Date().getFullYear()}-${String(nextSeq).padStart(4, '0')}`,
          sourceInvoiceRef: body.sourceInvoiceRef || '',
          customerId: body.customerId,
          customer: this.state.customers.find(c => c.id === body.customerId),
          issueDate: body.issueDate || new Date().toISOString(),
          dueDate: body.dueDate,
          currency: body.currency || 'USD',
          paymentTerms: body.paymentTerms || '100% Advance Payment',
          subtotal: Number(finalTotal.toFixed(2)),
          taxAmount: 0,
          totalAmount: Number(finalTotal.toFixed(2)),
          status: 'ISSUED',
          paymentStatus: 'UNPAID',
          paidAmount: 0,
          remainingBalance: Number(finalTotal.toFixed(2)),
          lines
        };
        this.state.invoices.unshift(newInvoice);
        this.saveState();
        return newInvoice as any;
      }
    }

    // 3a. Record Payment on Proforma Invoice with SWIFT Fee Deduction
    const recordPaymentMatch = pathname.match(/^\/invoices\/([^/]+)\/record-payment$/);
    if (recordPaymentMatch && method === 'POST') {
      const id = recordPaymentMatch[1];
      const inv = this.state.invoices.find(i => i.id === id || i.invoiceNumber === id);
      if (!inv) throw new Error('Invoice not found');

      const payAmount = Number(body.amount || body.paymentAmount || inv.totalAmount || 0);
      if (!(payAmount > 0)) throw new Error('Payment amount must be greater than zero');
      const swiftFee = Number(body.swiftFeeDeducted || body.swiftFeeAmount || 0);
      if (swiftFee < 0 || swiftFee >= payAmount) throw new Error('SWIFT fee must be between 0 and the payment amount');
      const netCredited = Math.max(0, Number((payAmount - swiftFee).toFixed(2)));

      // Cumulative allocation: account for payments already recorded so a
      // partial payment followed by the balance correctly settles the invoice.
      const invoiceTotal = Number(inv.totalAmount || 0);
      const previouslyPaid = Math.min(
        invoiceTotal,
        Math.max(0, Number((inv.paidAmount ?? (invoiceTotal - Number(inv.remainingBalance ?? invoiceTotal))) || 0))
      );
      const remainingBefore = Math.max(0, Number((invoiceTotal - previouslyPaid).toFixed(2)));
      if (payAmount > remainingBefore + 0.005) {
        throw new Error(`Payment of $${payAmount.toFixed(2)} exceeds the outstanding balance of $${remainingBefore.toFixed(2)}`);
      }
      const totalAllocated = Number((previouslyPaid + payAmount).toFixed(2));
      inv.paymentStatus = totalAllocated >= invoiceTotal - 0.005 ? 'PAID' : 'PARTIALLY_PAID';
      inv.paidAmount = Math.min(invoiceTotal, totalAllocated);
      inv.remainingBalance = Number(Math.max(0, invoiceTotal - totalAllocated).toFixed(2));
      inv.status = 'ISSUED';

      let createdReceipt: Receipt | null = null;
      let createdLedger: LedgerTransaction | null = null;
      let createdPayment: any = null;

      if (body.createReceiptAndLedger !== false) {
        const paymentId = `pay-${Date.now()}`;
        createdPayment = {
          id: paymentId,
          customerId: inv.customerId,
          customer: inv.customer,
          paymentDate: body.paymentDate || new Date().toISOString(),
          reference: body.bankReference || `AUB-WIRE-${inv.invoiceNumber}`,
          paymentMethod: 'WIRE_TRANSFER',
          totalAmount: payAmount,
          allocatedAmount: payAmount,
          unallocatedAmount: 0,
          currency: 'USD',
          notes: body.notes || `Payment for invoice ${inv.invoiceNumber}`
        };
        this.state.payments.unshift(createdPayment);

        const rcpNumber = `RCP-${new Date().getFullYear()}-${String(this.state.receipts.reduce((mx, r) => { const m = /(\d+)\s*$/.exec(String(r.receiptNumber || '')); return m ? Math.max(mx, parseInt(m[1], 10)) : mx; }, 0) + 1).padStart(4, '0')}`;
        createdReceipt = {
          id: `rcp-${Date.now()}`,
          receiptNumber: rcpNumber,
          paymentId,
          payerName: inv.customer?.companyName || 'Consignee',
          receivingAccountName: 'Afghan United Bank (AUB)',
          receivingAccountMasked: '101502******0472',
          amount: netCredited,
          grossAmount: payAmount,
          swiftFeeAmount: swiftFee,
          currency: 'USD',
          paymentMethod: 'WIRE_TRANSFER',
          bankReference: body.bankReference || `AUB-${inv.invoiceNumber}`,
          status: 'ISSUED',
          issueDate: body.paymentDate || new Date().toISOString(),
          purpose: `Settlement for ${inv.invoiceNumber} (${inv.customer?.companyName || ''})`,
          notes: body.notes || (swiftFee > 0 ? `Wire payment for ${inv.invoiceNumber} with $${swiftFee.toFixed(2)} SWIFT fee deducted` : `Wire payment for ${inv.invoiceNumber}`),
          createdAt: body.paymentDate || new Date().toISOString()
        };
        if (createdReceipt) {
          this.state.receipts.unshift(createdReceipt);
        }

        createdLedger = {
          id: `tx-${Date.now()}`,
          effectiveDate: body.paymentDate || new Date().toISOString(),
          postedAt: new Date().toISOString(),
          reference: body.bankReference || `AUB-${inv.invoiceNumber}`,
          description: `Payment received for ${inv.invoiceNumber} - ${inv.customer?.companyName || ''}`,
          category: 'CREDIT',
          debitAmount: 0,
          creditAmount: netCredited,
          runningBalance: 0,
          currency: 'USD',
          reconciliationStatus: 'RECONCILED',
          notes: swiftFee > 0 ? `Gross payment: $${payAmount.toFixed(2)} less SWIFT fee: $${swiftFee.toFixed(2)}` : null
        };
        this.state.ledger.push(createdLedger);
        this.recalculateLedgerBalances();
      }

      this.state.auditEvents.unshift({
        id: `aud-${Date.now()}`,
        action: 'INVOICE_PAYMENT_RECORDED',
        entityType: 'INVOICE',
        entityId: inv.id,
        actorEmail: 'admin@aqcompanies.com',
        timestamp: new Date().toISOString(),
        details: {
          invoiceNumber: inv.invoiceNumber,
          amount: payAmount,
          swiftFeeDeducted: swiftFee,
          netCredited,
          receiptNumber: createdReceipt?.receiptNumber
        }
      });

      this.saveState();
      return {
        success: true,
        invoice: inv,
        receipt: createdReceipt,
        ledger: createdLedger,
        payment: createdPayment
      } as any;
    }

    // 3b. Toggle Invoice Payment Status
    const togglePaymentMatch = pathname.match(/^\/invoices\/([^/]+)\/toggle-payment$/);
    if (togglePaymentMatch && method === 'PATCH') {
      const id = togglePaymentMatch[1];
      const inv = this.state.invoices.find(i => i.id === id || i.invoiceNumber === id);
      if (!inv) throw new Error('Invoice not found');
      const invoiceTotal = Number(inv.totalAmount || 0);
      if (body.paymentStatus) {
        inv.paymentStatus = body.paymentStatus;
      } else {
        inv.paymentStatus = inv.paymentStatus === 'PAID' ? 'UNPAID' : 'PAID';
      }
      if (inv.paymentStatus === 'PAID') {
        inv.paidAmount = invoiceTotal;
        inv.remainingBalance = 0;
      } else if (inv.paymentStatus === 'UNPAID') {
        inv.paidAmount = 0;
        inv.remainingBalance = invoiceTotal;
      } else if (inv.paymentStatus === 'PARTIALLY_PAID') {
        // Keep any previously recorded partial allocation
        inv.paidAmount = Math.min(invoiceTotal, Math.max(0, Number(inv.paidAmount || 0)));
        inv.remainingBalance = Number(Math.max(0, invoiceTotal - Number(inv.paidAmount)).toFixed(2));
      }
      this.saveState();
      return { success: true, invoice: inv } as any;
    }

    // 3c. PDF Document Snapshot Data
    const pdfDataMatch = pathname.match(/^\/invoices\/([^/]+)\/pdf-data$/);
    if (pdfDataMatch && method === 'GET') {
      const id = pdfDataMatch[1];
      const inv = this.state.invoices.find(i => i.id === id || i.invoiceNumber === id);
      if (!inv) throw new Error('Invoice not found');
      return {
        ...inv,
        grandTotal: `$${Number(inv.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        customer: inv.customer || this.state.customers.find(c => c.id === inv.customerId),
        lines: (inv.lines || []).map(l => ({
          ...l,
          lineTotal: `$${Number(l.lineTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          unitPrice: `$${Number(l.unitPrice).toFixed(4)}`,
          cartonDisplay: l.cartonCount ? `${Number(l.cartonCount).toLocaleString()} CTNS` : undefined
        })),
        bankDetails: {
          beneficiaryName: 'SKY ARIANA LTD',
          accountNumber: '101502USD2940472',
          bankName: 'AFGHAN UNITED BANK',
          swiftBic: 'AFGUAFKAXXX',
          bankAddress: 'AUB Building, Zarghona Maidan, Shahr-e-Now, Kabul',
          correspondentBank: 'AL SALAM BANK BAHRAIN',
          correspondentSwift: 'ALSABHBMXXX',
          aubAccountWithCorrespondent: 'BH61ALSA00500951200102',
          intermediaryBank: 'JPMorgan Chase Bank, New York',
          intermediarySwift: 'CHASUS33',
          intermediaryAccount: '400758954'
        }
      } as any;
    }

    // 3d. Single Invoice Actions (GET, PUT, DELETE)
    const invMatch = pathname.match(/^\/invoices\/([^/]+)$/);
    if (invMatch) {
      const id = invMatch[1];
      const inv = this.state.invoices.find(i => i.id === id || i.invoiceNumber === id);
      if (method === 'GET') {
        if (!inv) throw new Error('Invoice not found');
        return inv as any;
      }
      if (method === 'PUT') {
        if (!inv) throw new Error('Invoice not found');
        if (body.customerId) {
          inv.customerId = body.customerId;
          inv.customer = this.state.customers.find(c => c.id === body.customerId) || inv.customer;
        }
        if (body.sourceInvoiceRef !== undefined) inv.sourceInvoiceRef = body.sourceInvoiceRef;
        if (body.issueDate) inv.issueDate = body.issueDate;
        if (body.dueDate !== undefined) inv.dueDate = body.dueDate;
        if (body.paymentTerms) inv.paymentTerms = body.paymentTerms;
        if (body.paymentStatus) inv.paymentStatus = body.paymentStatus;
        if (body.lines && Array.isArray(body.lines)) {
          inv.lines = body.lines.map((l: any, idx: number) => {
            const qty = Number(l.quantity) || 0;
            const price = Number(l.unitPrice) || 0;
            return {
              id: l.id || `line-${Date.now()}-${idx}`,
              lineNumber: idx + 1,
              description: l.description || 'Cargo',
              cartonCount: l.cartonCount ? Number(l.cartonCount) : undefined,
              packagingKgPerCarton: l.packagingKgPerCarton ? Number(l.packagingKgPerCarton) : undefined,
              quantity: qty,
              unitOfMeasure: l.unitOfMeasure || 'KG',
              unitPrice: price,
              lineTotal: Number((qty * price).toFixed(2))
            };
          });
          const grandTotal = (inv.lines || []).reduce((sum, l) => sum + Number(l.lineTotal || 0), 0);
          inv.subtotal = Number(grandTotal.toFixed(2));
          inv.totalAmount = Number(grandTotal.toFixed(2));
          // Preserve any recorded partial allocation when the total changes
          const paidSoFar = inv.paymentStatus === 'PAID'
            ? inv.totalAmount
            : Math.min(inv.totalAmount, Math.max(0, Number(inv.paidAmount || 0)));
          inv.paidAmount = paidSoFar;
          inv.remainingBalance = Number(Math.max(0, inv.totalAmount - paidSoFar).toFixed(2));
        }
        this.saveState();
        return inv as any;
      }
      if (method === 'DELETE') {
        this.state.invoices = this.state.invoices.filter(i => i.id !== id && i.invoiceNumber !== id);
        this.saveState();
        return { success: true } as any;
      }
    }

    if (pathname.includes('/void') && method === 'POST') {
      const id = pathname.split('/')[2];
      const inv = this.state.invoices.find(i => i.id === id);
      if (inv) {
        inv.status = 'VOID';
        this.saveState();
      }
      return { success: true, invoice: inv } as any;
    }

    if (pathname.includes('/issue') && method === 'POST') {
      const id = pathname.split('/')[2];
      const inv = this.state.invoices.find(i => i.id === id);
      if (inv) {
        inv.status = 'ISSUED';
        this.saveState();
      }
      return { success: true, invoice: inv } as any;
    }

    // 4. Receipts
    if (pathname === '/receipts' && method === 'GET') {
      return this.state.receipts as any;
    }

    const rcpVoidMatch = pathname.match(/^\/receipts\/([^/]+)\/void$/);
    if (rcpVoidMatch && method === 'POST') {
      const id = rcpVoidMatch[1];
      const rcp = this.state.receipts.find(r => r.id === id || r.receiptNumber === id);
      if (rcp) {
        rcp.status = 'VOIDED';
        rcp.voidReason = body.voidReason || 'Voided by Compliance Officer';
        rcp.voidedAt = new Date().toISOString();
        this.saveState();
      }
      return { success: true, receipt: rcp } as any;
    }

    const rcpMatch = pathname.match(/^\/receipts\/([^/]+)$/);
    if (rcpMatch && method === 'GET') {
      const rcp = this.state.receipts.find(r => r.id === rcpMatch[1] || r.receiptNumber === rcpMatch[1]);
      if (!rcp) throw new Error('Receipt not found');
      return rcp as any;
    }

    // 5. Ledger
    if (pathname === '/ledger/cash-in' && method === 'POST') {
      const amt = Number(body.amount) || 0;
      const fee = Number(body.swiftFee) || 0;
      const net = Math.max(0, Number((amt - fee).toFixed(2)));
      const effectiveDate = body.effectiveDate || new Date().toISOString();

      const newEntry: LedgerTransaction = {
        id: `tx-${Date.now()}`,
        effectiveDate,
        postedAt: new Date().toISOString(),
        reference: body.reference || '',
        description: body.description || (body.payer ? `Inward Wire from ${body.payer}` : 'Inward Transfer'),
        category: 'CREDIT',
        debitAmount: 0,
        creditAmount: net,
        runningBalance: 0,
        currency: 'USD',
        reconciliationStatus: 'RECONCILED',
        notes: body.notes || (fee > 0 ? `Gross $${amt.toFixed(2)} less SWIFT fee $${fee.toFixed(2)}` : undefined)
      };
      this.state.ledger.push(newEntry);
      this.recalculateLedgerBalances();

      let createdReceipt: Receipt | null = null;
      if (body.createReceipt) {
        const rcpNumber = `RCP-${new Date().getFullYear()}-${String(this.state.receipts.reduce((mx, r) => { const m = /(\d+)\s*$/.exec(String(r.receiptNumber || '')); return m ? Math.max(mx, parseInt(m[1], 10)) : mx; }, 0) + 1).padStart(4, '0')}`;
        createdReceipt = {
          id: `rcp-${Date.now()}`,
          receiptNumber: rcpNumber,
          paymentId: `pay-${Date.now()}`,
          payerName: body.payer || 'Consignee',
          receivingAccountName: 'Afghan United Bank (AUB)',
          receivingAccountMasked: '101502******0472',
          amount: net,
          grossAmount: amt,
          swiftFeeAmount: fee,
          currency: 'USD',
          paymentMethod: 'WIRE_TRANSFER',
          bankReference: body.reference,
          status: 'ISSUED',
          issueDate: effectiveDate,
          purpose: body.notes || (body.payer ? `Inward Remittance from ${body.payer}` : 'Treasury Inward Credit'),
          notes: body.notes,
          createdAt: effectiveDate
        };
        if (createdReceipt) {
          this.state.receipts.unshift(createdReceipt);
        }
      }

      if (body.invoiceId) {
        const inv = this.state.invoices.find(i => i.id === body.invoiceId);
        if (inv) {
          inv.paymentStatus = 'PAID';
          inv.remainingBalance = 0;
        }
      }

      this.saveState();
      return { success: true, entry: newEntry, receipt: createdReceipt } as any;
    }

    if (pathname === '/ledger/cash-out' && method === 'POST') {
      const debit = Number(body.amount) || 0;
      const newEntry: LedgerTransaction = {
        id: `tx-${Date.now()}`,
        effectiveDate: body.effectiveDate || new Date().toISOString(),
        postedAt: new Date().toISOString(),
        reference: body.reference || '',
        description: body.description || (body.payee ? `Disbursement to ${body.payee}` : 'Outflow Disbursement'),
        category: 'DEBIT',
        debitAmount: debit,
        creditAmount: 0,
        runningBalance: 0,
        currency: 'USD',
        reconciliationStatus: 'RECONCILED',
        notes: body.notes
      };
      this.state.ledger.push(newEntry);
      this.recalculateLedgerBalances();
      this.saveState();
      return newEntry as any;
    }

    const txReverseMatch = pathname.match(/^\/ledger\/([^/]+)\/reverse$/);
    if (txReverseMatch && method === 'POST') {
      const id = txReverseMatch[1];
      const target = this.state.ledger.find(t => t.id === id);
      if (!target) throw new Error('Target transaction not found');

      const isCredit = Number(target.creditAmount || 0) > 0;
      const reverseEntry: LedgerTransaction = {
        id: `tx-rev-${Date.now()}`,
        effectiveDate: new Date().toISOString(),
        postedAt: new Date().toISOString(),
        reference: `REV-${target.reference || id}`,
        description: `REVERSAL: ${target.description} (Reason: ${body.reason || 'Correction'})`,
        category: isCredit ? 'DEBIT' : 'CREDIT',
        debitAmount: isCredit ? Number(target.creditAmount) : 0,
        creditAmount: isCredit ? 0 : Number(target.debitAmount),
        runningBalance: 0,
        currency: 'USD',
        reconciliationStatus: 'RECONCILED',
        notes: body.reason
      };
      this.state.ledger.push(reverseEntry);
      this.recalculateLedgerBalances();
      this.saveState();
      return { success: true, reversalEntry: reverseEntry } as any;
    }

    const txMatch = pathname.match(/^\/ledger\/([^/]+)$/);
    if (txMatch) {
      const id = txMatch[1];
      const entry = this.state.ledger.find(t => t.id === id);
      if (method === 'PUT') {
        if (!entry) throw new Error('Ledger transaction not found');
        if (body.effectiveDate) entry.effectiveDate = body.effectiveDate;
        if (body.reference !== undefined) entry.reference = body.reference;
        if (body.description) entry.description = body.description;
        if (body.debitAmount !== undefined) entry.debitAmount = Number(body.debitAmount) || 0;
        if (body.creditAmount !== undefined) entry.creditAmount = Number(body.creditAmount) || 0;
        if (body.notes !== undefined) entry.notes = body.notes;
        this.recalculateLedgerBalances();
        this.saveState();
        return entry as any;
      }
      if (method === 'DELETE') {
        this.state.ledger = this.state.ledger.filter(t => t.id !== id);
        this.recalculateLedgerBalances();
        this.saveState();
        return { success: true } as any;
      }
    }

    if (pathname === '/ledger') {
      if (method === 'GET') {
        let filtered = [...this.state.ledger];
        const category = url.searchParams.get('category');
        const search = url.searchParams.get('search');
        if (category && category !== 'ALL') {
          filtered = filtered.filter(t => t.category === category);
        }
        if (search) {
          const s = search.toLowerCase();
          filtered = filtered.filter(t =>
            (t.description && t.description.toLowerCase().includes(s)) ||
            (t.reference && t.reference.toLowerCase().includes(s))
          );
        }
        const lastTx = this.state.ledger.length > 0 ? this.state.ledger[this.state.ledger.length - 1] : null;
        const currentEndingBalance = lastTx ? Number(lastTx.runningBalance).toFixed(2) : '86944.61';
        return {
          openingBalance: '83.36',
          currentEndingBalance,
          totalCount: filtered.length,
          transactions: filtered
        } as any;
      }
      if (method === 'POST') {
        const debit = Number(body.debitAmount || 0);
        const credit = Number(body.creditAmount || 0);

        const newEntry: LedgerTransaction = {
          id: `tx-${Date.now()}`,
          effectiveDate: body.effectiveDate || new Date().toISOString(),
          postedAt: new Date().toISOString(),
          reference: body.reference || '',
          description: body.description || '',
          category: body.category || (debit > 0 ? 'DEBIT' : 'CREDIT'),
          debitAmount: debit,
          creditAmount: credit,
          runningBalance: 0,
          currency: 'USD',
          reconciliationStatus: 'RECONCILED'
        };
        this.state.ledger.push(newEntry);
        this.recalculateLedgerBalances();
        this.saveState();
        return newEntry as any;
      }
    }

    // 6. Payments
    if (pathname === '/payments') {
      if (method === 'GET') {
        return this.state.payments as any;
      }
      if (method === 'POST') {
        const paymentId = `pay-${Date.now()}`;
        const totalAmt = Number(body.totalAmount) || 0;
        const newPayment = {
          id: paymentId,
          customerId: body.customerId,
          customer: this.state.customers.find(c => c.id === body.customerId),
          paymentDate: body.paymentDate || new Date().toISOString(),
          reference: body.reference || `WIRE-${Math.floor(100000 + Math.random() * 900000)}`,
          paymentMethod: 'WIRE_TRANSFER',
          totalAmount: totalAmt,
          allocatedAmount: totalAmt,
          unallocatedAmount: 0,
          currency: 'USD',
          allocations: body.allocations || []
        };
        this.state.payments.unshift(newPayment);

        if (Array.isArray(body.allocations)) {
          for (const alloc of body.allocations) {
            const inv = this.state.invoices.find(i => i.id === alloc.invoiceId);
            if (inv) {
              const allocAmt = Number(alloc.amount) || 0;
              const rem = Math.max(0, Number(inv.remainingBalance || inv.totalAmount) - allocAmt);
              inv.remainingBalance = rem;
              if (rem === 0) inv.paymentStatus = 'PAID';
            }
          }
        }

        this.saveState();
        return newPayment as any;
      }
    }

    // 7. Customers
    if (pathname === '/customers') {
      if (method === 'GET') {
        return this.state.customers as any;
      }
      if (method === 'POST') {
        const newCust: Customer = {
          id: `cust-${Date.now()}`,
          companyName: (body.companyName || '').trim(),
          contactPerson: (body.contactPerson || '').trim(),
          addressLine1: (body.addressLine1 || '').trim(),
          addressLine2: (body.addressLine2 || '').trim(),
          country: (body.country || '').trim() || 'Global',
          email: (body.email || '').trim(),
          phone: (body.phone || '').trim(),
          isCustomer: true,
          isVendor: body.isVendor || false
        };
        this.state.customers.push(newCust);
        this.saveState();
        return newCust as any;
      }
    }

    const custMatch = pathname.match(/^\/customers\/([^/]+)$/);
    if (custMatch && method === 'GET') {
      const cust = this.state.customers.find(c => c.id === custMatch[1]);
      if (!cust) throw new Error('Customer not found');
      return cust as any;
    }

    // 8. Shipments
    if (pathname === '/shipments') {
      if (method === 'GET') return this.state.shipments as any;
      if (method === 'POST') {
        const newShp: Shipment = {
          id: `shp-${Date.now()}`,
          shipmentRef: body.shipmentRef || `SHP-${Date.now()}`,
          containerNumber: body.containerNumber,
          billOfLading: body.billOfLading,
          origin: body.origin,
          destination: body.destination,
          carrier: body.carrier,
          status: 'BOOKED',
          notes: body.notes
        };
        this.state.shipments.push(newShp);
        this.saveState();
        return newShp as any;
      }
    }

    const shpStatusMatch = pathname.match(/^\/shipments\/([^/]+)\/status$/);
    if (shpStatusMatch && method === 'POST') {
      const id = shpStatusMatch[1];
      const shp = this.state.shipments.find(s => s.id === id);
      if (shp) {
        shp.status = body.newStatus;
        if (body.reason) shp.notes = (shp.notes ? `${shp.notes} | ` : '') + body.reason;
        this.saveState();
      }
      return { success: true, shipment: shp } as any;
    }

    // 9. Bank Accounts & Remittance
    if (pathname === '/bank-accounts') {
      return this.state.bankAccounts as any;
    }

    if (pathname.includes('/reveal') && method === 'POST') {
      return { unmaskedNumber: '101502USD2940472', bankName: 'Afghan United Bank (AUB)' } as any;
    }

    if (pathname.includes('/bank-accounts/') && pathname.endsWith('/history') && method === 'GET') {
      return [
        {
          versionNumber: 1,
          action: 'INITIAL_PROVISION',
          createdAt: new Date().toISOString(),
          changeReason: 'Initial setup of Afghan United Bank settlement account',
          user: { name: 'Ahsanullah Qureshi', email: 'ahsanullah@aqcompanies.com' }
        }
      ] as any;
    }

    const bankAccMatch = pathname.match(/^\/bank-accounts\/([^/]+)$/);
    if (bankAccMatch && method === 'PUT') {
      const id = bankAccMatch[1];
      const acc = this.state.bankAccounts.find(b => b.id === id);
      if (acc) {
        Object.assign(acc, body);
        this.saveState();
      }
      return acc as any;
    }

    if (pathname === '/remittance-profiles') {
      if (method === 'GET') return this.state.remittanceProfiles as any;
      if (method === 'POST') {
        const newProf = {
          id: `rp-${Date.now()}`,
          name: body.name || 'Remittance Profile',
          profileType: body.profileType || 'INTERNATIONAL',
          currency: 'USD',
          isDefault: body.isDefault || false,
          isActive: true,
          ...body
        };
        this.state.remittanceProfiles.push(newProf);
        this.saveState();
        return newProf as any;
      }
    }

    // 10. Reports
    if (pathname.startsWith('/reports/customer-statement/')) {
      const custId = pathname.replace('/reports/customer-statement/', '');
      const cust = this.state.customers.find(c => c.id === custId) || this.state.customers[0];
      const custInvoices = this.state.invoices.filter(i => i.customerId === cust?.id);
      const totalInvoiced = custInvoices.reduce((s, i) => s + Number(i.totalAmount || 0), 0);
      const totalPaid = custInvoices.filter(i => i.paymentStatus === 'PAID').reduce((s, i) => s + Number(i.totalAmount || 0), 0);
      const outstandingBalance = Math.max(0, totalInvoiced - totalPaid);
      return {
        customer: cust,
        invoices: custInvoices,
        payments: [],
        summary: {
          totalInvoiced: totalInvoiced.toFixed(2),
          totalPaymentsReceived: totalPaid.toFixed(2),
          outstandingBalance: outstandingBalance.toFixed(2)
        },
        totalInvoiced,
        totalPaid,
        outstandingBalance
      } as any;
    }

    if (pathname === '/reports/receivables-aging') {
      const unpaid = this.state.invoices.filter(i => i.paymentStatus !== 'PAID');
      const total = unpaid.reduce((s, i) => s + Number(i.remainingBalance || i.totalAmount || 0), 0);
      return {
        current: Number((total * 0.4).toFixed(2)),
        days30: Number((total * 0.35).toFixed(2)),
        days60: Number((total * 0.15).toFixed(2)),
        days90Plus: Number((total * 0.10).toFixed(2)),
        totalReceivables: Number(total.toFixed(2)),
        invoices: unpaid
      } as any;
    }

    // 11. Admin & Audit
    if (pathname === '/audit') {
      return { events: this.state.auditEvents, total: this.state.auditEvents.length } as any;
    }

    if (pathname === '/admin/reset-baseline' && method === 'POST') {
      return this.resetBaseline() as any;
    }

    if (pathname === '/admin/backup/export') {
      return {
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: this.state
      } as any;
    }

    // Default fallback: return empty array or success object
    return [] as any;
  }
}

export const mockBackend = new MockBackendEngine();
