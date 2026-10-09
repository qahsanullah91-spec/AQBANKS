import { describe, it, expect } from 'vitest';
import { calculateLedgerRunningBalances, toDecimal, Decimal } from '../src/utils/decimal.js';

describe('Ledger & Financial Correctness Tests', () => {
  it('TC-FIN-01: calculates correct running balance correcting the workbook row-lag issue', () => {
    const openingBalance = '83.36';

    const transactions = [
      {
        id: 'tx-1',
        effectiveDate: '2026-09-30',
        category: 'CREDIT',
        debitAmount: '0.00',
        creditAmount: '78893.36'
      },
      {
        id: 'tx-2',
        effectiveDate: '2026-10-08',
        postedAt: '2026-10-08T08:00:00Z',
        category: 'CREDIT',
        debitAmount: '0.00',
        creditAmount: '74376.25'
      },
      {
        id: 'tx-3',
        effectiveDate: '2026-10-08',
        postedAt: '2026-10-08T09:00:00Z',
        category: 'DEBIT',
        debitAmount: '15200.00',
        creditAmount: '0.00'
      },
      {
        id: 'tx-4',
        effectiveDate: '2026-10-08',
        postedAt: '2026-10-08T10:00:00Z',
        category: 'DEBIT',
        debitAmount: '35000.00',
        creditAmount: '0.00'
      },
      {
        id: 'tx-5',
        effectiveDate: '2026-10-08',
        postedAt: '2026-10-08T11:00:00Z',
        category: 'DEBIT',
        debitAmount: '78893.36',
        creditAmount: '0.00'
      }
    ];

    const results = calculateLedgerRunningBalances(openingBalance, transactions);

    expect(results).toHaveLength(5);

    // Row 1: 83.36 + 78,893.36 = 78,976.72
    expect(results[0].runningBalanceFormatted).toBe('78976.72');

    // Row 2: 78,976.72 + 74,376.25 = 153,352.97
    expect(results[1].runningBalanceFormatted).toBe('153352.97');

    // Row 3: 153,352.97 - 15,200.00 = 138,152.97
    expect(results[2].runningBalanceFormatted).toBe('138152.97');

    // Row 4: 138,152.97 - 35,000.00 = 103,152.97
    expect(results[3].runningBalanceFormatted).toBe('103152.97');

    // Row 5: 103,152.97 - 78,893.36 = 24,259.61
    expect(results[4].runningBalanceFormatted).toBe('24259.61');
  });

  it('TC-FIN-02: maintains deterministic ordering with identical effective dates', () => {
    const transactions = [
      { id: 'b', effectiveDate: '2026-10-08', category: 'DEBIT', debitAmount: 10, creditAmount: 0 },
      { id: 'a', effectiveDate: '2026-10-08', category: 'CREDIT', debitAmount: 0, creditAmount: 100 },
      { id: 'c', effectiveDate: '2026-10-08', category: 'DEBIT', debitAmount: 20, creditAmount: 0 }
    ];

    // Tied on date & postedAt: sorted deterministically by ID ('a', 'b', 'c')
    const results = calculateLedgerRunningBalances(0, transactions);
    expect(results[0].id).toBe('a');
    expect(results[1].id).toBe('b');
    expect(results[2].id).toBe('c');

    expect(results[0].runningBalanceFormatted).toBe('100.00');
    expect(results[1].runningBalanceFormatted).toBe('90.00');
    expect(results[2].runningBalanceFormatted).toBe('70.00');
  });

  it('TC-FIN-03: performs arbitrary-precision decimal arithmetic without floating point drift', () => {
    // In IEEE-754: 0.1 + 0.2 = 0.30000000000000004
    const a = toDecimal('0.1');
    const b = toDecimal('0.2');
    const sum = a.plus(b);

    expect(sum.toString()).toBe('0.3');
    expect(sum.toFixed(2)).toBe('0.30');

    // High precision calculation
    const qty = toDecimal('22128');
    const price = toDecimal('2.60009942');
    const lineTotal = qty.times(price).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    expect(lineTotal.toFixed(2)).toBe('57535.00');
  });
});
