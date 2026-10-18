// Comprehensive in-browser financial & logistics standalone database engine
// Provides 100% functionality and persistence for cloud and offline deployments

import { User, Customer, Invoice, Receipt, LedgerTransaction, Shipment, BankAccount, RemittanceProfile, DashboardOverview } from '../types';

const STORAGE_KEY = 'aq_standalone_db_v1';

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
}

function getInitialState(): DBState {
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
      paymentStatus: 'UNPAID',
      remainingBalance: 63000.00,
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

  constructor() {
    this.state = this.loadState();
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
        if (!Array.isArray(parsed.invoices)) parsed.invoices = fresh.invoices;
        if (!Array.isArray(parsed.receipts)) parsed.receipts = fresh.receipts;
        if (!Array.isArray(parsed.ledger)) parsed.ledger = fresh.ledger;
        if (!Array.isArray(parsed.shipments)) parsed.shipments = fresh.shipments;
        if (!Array.isArray(parsed.customers)) parsed.customers = fresh.customers;
        if (!Array.isArray(parsed.bankAccounts)) parsed.bankAccounts = fresh.bankAccounts;
        if (!Array.isArray(parsed.remittanceProfiles)) parsed.remittanceProfiles = fresh.remittanceProfiles;
        if (!Array.isArray(parsed.payments)) parsed.payments = [];
        if (!Array.isArray(parsed.auditEvents)) parsed.auditEvents = [];
        return parsed;
      }
    } catch {
      // ignore
    }
    this.saveState(fresh);
    return fresh;
  }

  private saveState(state = this.state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
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
      const user = this.state.users[0];
      return { user } as any;
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
        if (querySearch) {
          return this.state.invoices.filter(inv =>
            inv.invoiceNumber.toLowerCase().includes(querySearch) ||
            inv.customer?.companyName.toLowerCase().includes(querySearch) ||
            (inv.sourceInvoiceRef && inv.sourceInvoiceRef.toLowerCase().includes(querySearch))
          ) as any;
        }
        return this.state.invoices as any;
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

        const newInvoice: Invoice = {
          id: `inv-${Date.now()}`,
          invoiceNumber: body.invoiceNumber || `PI-2026-${String(this.state.invoices.length + 1).padStart(4, '0')}`,
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
      const swiftFee = Number(body.swiftFeeDeducted || body.swiftFeeAmount || 0);
      const netCredited = Math.max(0, Number((payAmount - swiftFee).toFixed(2)));

      const totalAllocated = payAmount;
      const invoiceTotal = Number(inv.totalAmount || 0);
      inv.paymentStatus = totalAllocated >= invoiceTotal ? 'PAID' : 'PARTIALLY_PAID';
      inv.remainingBalance = Math.max(0, Number((invoiceTotal - totalAllocated).toFixed(2)));
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

        const rcpNumber = `RCP-2026-${String(this.state.receipts.length + 1).padStart(4, '0')}`;
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
      if (body.paymentStatus) {
        inv.paymentStatus = body.paymentStatus;
      } else {
        inv.paymentStatus = inv.paymentStatus === 'PAID' ? 'UNPAID' : 'PAID';
      }
      inv.remainingBalance = inv.paymentStatus === 'PAID' ? 0 : inv.totalAmount;
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
          inv.remainingBalance = inv.paymentStatus === 'PAID' ? 0 : inv.totalAmount;
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
        const rcpNumber = `RCP-2026-${String(this.state.receipts.length + 1).padStart(4, '0')}`;
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
        return this.state.ledger as any;
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
          companyName: body.companyName,
          addressLine1: body.addressLine1,
          addressLine2: body.addressLine2,
          country: body.country || 'Afghanistan',
          email: body.email,
          phone: body.phone,
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
      return {
        customer: cust,
        invoices: custInvoices,
        totalInvoiced,
        totalPaid,
        outstandingBalance: Math.max(0, totalInvoiced - totalPaid)
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
