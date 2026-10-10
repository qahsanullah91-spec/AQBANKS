import { config } from '../config.js';
import { generateIdempotencyKey, withIdempotencyGuard } from './idempotency.js';

let authToken: string | null = null;

export const tokenStorage = {
  getToken: async () => authToken,
  setToken: async (token: string) => { authToken = token; },
  removeToken: async () => { authToken = null; }
};

export async function mobileRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  idempotencyKey?: string
): Promise<T> {
  const token = await tokenStorage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'mobile-native',
    'X-Client-Version': config.version,
    ...(options.headers as any || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (idempotencyKey) {
    headers['X-Idempotency-Key'] = idempotencyKey;
  }

  const execute = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`${config.apiUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errBody: any;
        try {
          errBody = await res.json();
        } catch {
          errBody = { message: res.statusText };
        }
        const err = new Error(errBody.message || 'Mobile request failed');
        (err as any).status = res.status;
        (err as any).details = errBody;
        throw err;
      }

      return res.json();
    } catch (networkErr: any) {
      if (networkErr.name === 'AbortError') {
        throw new Error('Connection timed out. Please check your internet connection.');
      }
      if (networkErr.message?.includes('fetch') || networkErr.message?.includes('network')) {
        throw new Error('Network unavailable. Central backend is currently unreachable.');
      }
      throw networkErr;
    }
  };

  if (idempotencyKey) {
    return withIdempotencyGuard(idempotencyKey, execute);
  }

  return execute();
}

export const mobileApi = {
  // Auth
  login: async (credentials: { email: string; password: string }) => {
    const res = await mobileRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    if (res.accessToken) {
      await tokenStorage.setToken(res.accessToken);
    }
    return res;
  },
  getMe: () => mobileRequest('/auth/me'),

  // Dashboard
  getDashboardOverview: () => mobileRequest('/dashboard/overview'),

  // Invoices
  getInvoices: (params: any = {}) => {
    const qs = new URLSearchParams(params).toString();
    return mobileRequest(`/invoices${qs ? `?${qs}` : ''}`);
  },
  getInvoice: (id: string) => mobileRequest(`/invoices/${id}`),
  getInvoicePdfData: (id: string) => mobileRequest(`/invoices/${id}/pdf-data`),
  issueInvoice: (id: string) => {
    const key = generateIdempotencyKey(`issue-${id}`);
    return mobileRequest(`/invoices/${id}/issue`, { method: 'POST' }, key);
  },

  // Shipments
  getShipments: (params: any = {}) => {
    const qs = new URLSearchParams(params).toString();
    return mobileRequest(`/shipments${qs ? `?${qs}` : ''}`);
  },
  updateShipmentStatus: (id: string, newStatus: string, reason?: string) => {
    const key = generateIdempotencyKey(`status-${id}`);
    return mobileRequest(`/shipments/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ newStatus, reason })
    }, key);
  },

  // Ledger
  getLedger: (params: any = {}) => {
    const qs = new URLSearchParams(params).toString();
    return mobileRequest(`/ledger${qs ? `?${qs}` : ''}`);
  },

  // Payments (Protected against double-tap)
  createPayment: (data: any) => {
    const key = generateIdempotencyKey('create-payment');
    return mobileRequest('/payments', {
      method: 'POST',
      body: JSON.stringify(data)
    }, key);
  },

  // Banking (Audited)
  getBankAccounts: () => mobileRequest('/bank-accounts'),
  revealBankAccount: (id: string, reason: string) => {
    const key = generateIdempotencyKey(`reveal-${id}`);
    return mobileRequest(`/bank-accounts/${id}/reveal`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }, key);
  }
};
