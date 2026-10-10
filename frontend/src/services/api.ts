const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('aq_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('aq_token', token);
}

export function removeAuthToken() {
  localStorage.removeItem('aq_token');
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    (headers as any)['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    let errBody: any;
    try {
      errBody = await res.json();
    } catch {
      errBody = { message: res.statusText };
    }
    const err = new Error(errBody.message || 'API request failed');
    (err as any).status = res.status;
    (err as any).details = errBody;
    throw err;
  }

  return res.json();
}

export function buildQueryString(params: Record<string, any> = {}): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && value !== 'undefined' && value !== 'null') {
      sp.append(key, String(value));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  // Auth
  login: (credentials: { email: string; password: string }) =>
    apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => apiRequest('/auth/me'),
  getUsers: () => apiRequest('/auth/users'),

  // Dashboard
  getDashboardOverview: () => apiRequest('/dashboard/overview'),

  // Customers
  getCustomers: (search?: string) => apiRequest(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getCustomer: (id: string) => apiRequest(`/customers/${id}`),
  createCustomer: (data: any) => apiRequest('/customers', { method: 'POST', body: JSON.stringify(data) }),

  // Invoices
  getInvoices: (params: any = {}) => {
    return apiRequest(`/invoices${buildQueryString(params)}`);
  },
  getInvoice: (id: string) => apiRequest(`/invoices/${id}`),
  createInvoice: (data: any) => apiRequest('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  updateInvoice: (id: string, data: any) => apiRequest(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  issueInvoice: (id: string) => apiRequest(`/invoices/${id}/issue`, { method: 'POST' }),
  voidInvoice: (id: string, reason: string) => apiRequest(`/invoices/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getInvoicePdfData: (id: string) => apiRequest(`/invoices/${id}/pdf-data`),

  // Shipments
  getShipments: (params: any = {}) => {
    return apiRequest(`/shipments${buildQueryString(params)}`);
  },
  getShipment: (id: string) => apiRequest(`/shipments/${id}`),
  createShipment: (data: any) => apiRequest('/shipments', { method: 'POST', body: JSON.stringify(data) }),
  updateShipmentStatus: (id: string, newStatus: string, reason?: string) =>
    apiRequest(`/shipments/${id}/status`, { method: 'POST', body: JSON.stringify({ newStatus, reason }) }),

  // Ledger
  getLedger: (params: any = {}) => {
    return apiRequest(`/ledger${buildQueryString(params)}`);
  },
  postLedgerEntry: (data: any) => apiRequest('/ledger', { method: 'POST', body: JSON.stringify(data) }),
  reverseLedgerEntry: (id: string, reason: string) =>
    apiRequest(`/ledger/${id}/reverse`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Payments
  getPayments: (params: any = {}) => {
    return apiRequest(`/payments${buildQueryString(params)}`);
  },
  createPayment: (data: any) => apiRequest('/payments', { method: 'POST', body: JSON.stringify(data) }),

  // Bank details
  getBankAccounts: () => apiRequest('/bank-accounts'),
  revealBankAccount: (id: string, reason: string) =>
    apiRequest(`/bank-accounts/${id}/reveal`, { method: 'POST', body: JSON.stringify({ reason }) }),
  updateBankAccount: (id: string, data: any) =>
    apiRequest(`/bank-accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Reconciliation
  getReconciliationSuggestions: () => apiRequest('/reconciliation/suggestions'),
  confirmReconciliation: (data: any) => apiRequest('/reconciliation/confirm', { method: 'POST', body: JSON.stringify(data) }),

  // Import Center
  dryRunImport: () => apiRequest('/import/dry-run', { method: 'POST' }),
  commitImport: () => apiRequest('/import/commit', { method: 'POST' }),
  getImportHistory: () => apiRequest('/import/history'),

  // Reports
  getReceivablesAging: () => apiRequest('/reports/receivables-aging'),
  getCustomerStatement: (customerId: string) => apiRequest(`/reports/customer-statement/${customerId}`),

  // Audit
  getAuditEvents: (params: any = {}) => {
    return apiRequest(`/audit${buildQueryString(params)}`);
  }
};
