import { describe, it, expect } from 'vitest';
import { calculateInvoiceTotals } from '../src/utils/decimal.js';

describe('Invoice Calculations & Invariants Tests', () => {
  it('TC-INV-01: calculates line totals as weight * unitPrice and grand totals server-side', () => {
    const lines = [
      {
        description: 'Black Raisins (Best) - 1,385 CTNS',
        quantity: 22160,
        unitPrice: 3.58,
        unitOfMeasure: 'KG'
      },
      {
        description: 'Green Raisins - 500 CTNS',
        quantity: 10000,
        unitPrice: 2.50,
        unitOfMeasure: 'KG'
      }
    ];

    const result = calculateInvoiceTotals(lines);

    // Line 1: 22,160 * 3.58 = 79,332.80
    expect(result.lines[0].lineTotalFormatted).toBe('79332.80');
    // Line 2: 10,000 * 2.50 = 25,000.00
    expect(result.lines[1].lineTotalFormatted).toBe('25000.00');

    // Grand total: 79,332.80 + 25,000.00 = 104,332.80
    expect(result.grandTotalFormatted).toBe('104332.80');
    expect(result.subtotalFormatted).toBe('104332.80');
    expect(result.taxAmountFormatted).toBe('0.00');
  });

  it('TC-INV-02: rounds fractional currency cents using standard half-up rounding', () => {
    const lines = [
      {
        description: 'Test Item',
        quantity: '10.555',
        unitPrice: '1.2345'
      }
    ];

    // 10.555 * 1.2345 = 13.0301975 -> 13.03
    const result = calculateInvoiceTotals(lines);
    expect(result.grandTotalFormatted).toBe('13.03');
  });
});
