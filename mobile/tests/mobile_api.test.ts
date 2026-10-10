import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mobileRequest, tokenStorage } from '../src/services/api.js';

describe('Mobile API Client & Security Headers', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    await tokenStorage.removeToken();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should store and retrieve authentication token', async () => {
    expect(await tokenStorage.getToken()).toBeNull();
    await tokenStorage.setToken('test-mobile-jwt-token');
    expect(await tokenStorage.getToken()).toBe('test-mobile-jwt-token');
    await tokenStorage.removeToken();
    expect(await tokenStorage.getToken()).toBeNull();
  });

  it('should attach mobile platform headers and auth bearer token', async () => {
    await tokenStorage.setToken('secure-jwt-123');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', data: [1, 2, 3] })
    });
    globalThis.fetch = mockFetch as any;

    const res = await mobileRequest('/test-endpoint');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/test-endpoint');
    expect(opts.headers['X-Client-Platform']).toBe('mobile-native');
    expect(opts.headers['Authorization']).toBe('Bearer secure-jwt-123');
    expect(res).toEqual({ status: 'ok', data: [1, 2, 3] });
  });

  it('should attach X-Idempotency-Key header when specified', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'created' })
    });
    globalThis.fetch = mockFetch as any;

    await mobileRequest('/payments', { method: 'POST' }, 'mob-key-9988');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['X-Idempotency-Key']).toBe('mob-key-9988');
  });

  it('should format API errors with HTTP status and message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ message: 'Insufficient role permissions for bank account reveal' })
    }) as any;

    await expect(mobileRequest('/bank-accounts/acc-1/reveal', { method: 'POST' }))
      .rejects
      .toThrow('Insufficient role permissions for bank account reveal');
  });
});
