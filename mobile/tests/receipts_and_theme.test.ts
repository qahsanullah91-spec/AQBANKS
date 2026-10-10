import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mobileRequest, tokenStorage, mobileApi } from '../src/services/api.js';
import { lightColors, darkColors } from '../src/theme/colors.js';

describe('Mobile Receipts & Theme Invariants', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    await tokenStorage.removeToken();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Theme Configuration Invariant', () => {
    it('must have Light theme as the default color palette', () => {
      // Invariant: Light theme is mandatory default across all platforms
      expect(lightColors.bg).toBe('#f8fafc');
      expect(lightColors.card).toBe('#ffffff');
      expect(lightColors.text).toBe('#0f172a');
      expect(lightColors.cardBorder).toBe('#e2e8f0');
    });

    it('must provide a high-contrast Dark theme palette', () => {
      expect(darkColors.bg).toBe('#020617');
      expect(darkColors.card).toBe('#0f172a');
      expect(darkColors.text).toBe('#ffffff');
      expect(darkColors.cardBorder).toBe('#1e293b');
    });
  });

  describe('Mobile Receipts API Operations', () => {
    it('should query receipts list with proper headers', async () => {
      await tokenStorage.setToken('mob-receipt-token-123');

      const mockReceipts = [
        {
          id: 'rcp-uuid-1',
          receiptNumber: 'RCP-2026-0001',
          receivedFrom: 'Global Trade Logistics',
          amount: 5000,
          amountInWords: 'US DOLLARS FIVE THOUSAND AND 00/100 ONLY',
          currency: 'USD',
          bankAccountMasked: '101502******0472',
          status: 'ISSUED'
        }
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockReceipts })
      });
      globalThis.fetch = mockFetch as any;

      const res = await mobileApi.getReceipts({ search: 'RCP-2026' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/receipts?search=RCP-2026');
      expect(opts.headers['X-Client-Platform']).toBe('mobile-native');
      expect(opts.headers['Authorization']).toBe('Bearer mob-receipt-token-123');
      expect(res.data).toEqual(mockReceipts);
    });

    it('should fetch single receipt by id', async () => {
      await tokenStorage.setToken('mob-receipt-token-123');

      const mockReceipt = {
        id: 'rcp-uuid-99',
        receiptNumber: 'RCP-2026-0099',
        amount: 1250.50,
        amountInWords: 'US DOLLARS ONE THOUSAND TWO HUNDRED FIFTY AND 50/100 ONLY',
        status: 'ISSUED'
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockReceipt })
      });
      globalThis.fetch = mockFetch as any;

      const res = await mobileApi.getReceipt('rcp-uuid-99');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/receipts/rcp-uuid-99');
      expect(res.data.receiptNumber).toBe('RCP-2026-0099');
    });

    it('should fetch receipt PDF data structure', async () => {
      await tokenStorage.setToken('mob-receipt-token-123');

      const mockPdfData = {
        receiptNumber: 'RCP-2026-0042',
        title: 'OFFICIAL ELECTRONIC RECEIPT',
        company: { name: 'AQ COMPANIES FZE', taxId: 'AE-1002938475' },
        receipt: {
          receivedFrom: 'Apex Freight Ltd',
          amount: 25000,
          amountInWords: 'US DOLLARS TWENTY-FIVE THOUSAND AND 00/100 ONLY',
          bankAccountMasked: '101502******0472'
        }
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockPdfData })
      });
      globalThis.fetch = mockFetch as any;

      const res = await mobileApi.getReceiptPdfData('rcp-uuid-42');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/receipts/rcp-uuid-42/pdf-data');
      expect(res.data.company.name).toBe('AQ COMPANIES FZE');
      expect(res.data.receipt.bankAccountMasked).toBe('101502******0472');
    });

    it('should submit audited void request with idempotency key', async () => {
      await tokenStorage.setToken('mob-receipt-token-admin');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'rcp-uuid-1',
            receiptNumber: 'RCP-2026-0001',
            status: 'VOID',
            voidReason: 'Incorrect customer reference provided by remitter'
          }
        })
      });
      globalThis.fetch = mockFetch as any;

      const res = await mobileApi.voidReceipt('rcp-uuid-1', 'Incorrect customer reference provided by remitter');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/receipts/rcp-uuid-1/void');
      expect(opts.method).toBe('POST');
      expect(opts.headers['X-Idempotency-Key']).toBeDefined();
      expect(opts.headers['X-Idempotency-Key']).toContain('void-receipt-rcp-uuid-1');
      expect(JSON.parse(opts.body).reason).toBe('Incorrect customer reference provided by remitter');
      expect(res.data.status).toBe('VOID');
    });
  });
});
