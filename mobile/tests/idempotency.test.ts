import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateIdempotencyKey, withIdempotencyGuard, clearIdempotencyCache } from '../src/services/idempotency.js';

describe('Mobile Idempotency & Double-Tap Protection Service', () => {
  beforeEach(() => {
    clearIdempotencyCache();
  });

  it('should generate unique idempotency keys prefixed with operation name', () => {
    const key1 = generateIdempotencyKey('payment');
    const key2 = generateIdempotencyKey('payment');

    expect(key1).toMatch(/^mob-payment-\d+-[a-z0-9]+$/);
    expect(key2).toMatch(/^mob-payment-\d+-[a-z0-9]+$/);
    expect(key1).not.toBe(key2);
  });

  it('should execute operation and return result on first call', async () => {
    const op = vi.fn().mockResolvedValue({ status: 'SUCCESS', id: '123' });
    const key = 'test-key-1';

    const result = await withIdempotencyGuard(key, op);

    expect(op).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 'SUCCESS', id: '123' });
  });

  it('should return cached result without re-executing operation on rapid double tap', async () => {
    const op = vi.fn().mockResolvedValue({ status: 'SUCCESS', id: 'tx-999' });
    const key = 'test-key-double-tap';

    const result1 = await withIdempotencyGuard(key, op);
    const result2 = await withIdempotencyGuard(key, op);

    expect(op).toHaveBeenCalledTimes(1); // Crucial: executed only ONCE!
    expect(result1).toEqual(result2);
  });

  it('should block concurrent in-flight submissions with the same key', async () => {
    const key = 'test-concurrent-key';
    let finishFirst: () => void;
    const slowOp = () => new Promise(resolve => {
      finishFirst = () => resolve({ done: true });
    });

    const promise1 = withIdempotencyGuard(key, slowOp);

    // Immediate second tap while first is still pending
    await expect(withIdempotencyGuard(key, () => Promise.resolve({ done: false })))
      .rejects
      .toThrow('already in progress');

    finishFirst!();
    await promise1;
  });

  it('should allow clean retry if idempotency cache is cleared', async () => {
    const op = vi.fn().mockResolvedValue({ status: 'FIRST' });
    const key = 'test-retry-key';

    await withIdempotencyGuard(key, op);
    clearIdempotencyCache();

    op.mockResolvedValue({ status: 'SECOND' });
    const result2 = await withIdempotencyGuard(key, op);

    expect(op).toHaveBeenCalledTimes(2);
    expect(result2).toEqual({ status: 'SECOND' });
  });
});
