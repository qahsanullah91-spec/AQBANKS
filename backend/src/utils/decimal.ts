import Decimal from 'decimal.js';

// Configure standard financial precision
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -7,
  toExpPos: 21
});

export { Decimal };

export function toDecimal(val: unknown): Decimal {
  if (val === null || val === undefined || val === '') {
    return new Decimal(0);
  }
  if (val instanceof Decimal) {
    return val;
  }
  // Remove currency signs or commas if string
  if (typeof val === 'string') {
    const cleaned = val.replace(/[\$,]/g, '').trim();
    if (!cleaned || isNaN(Number(cleaned))) return new Decimal(0);
    return new Decimal(cleaned);
  }
  return new Decimal(Number(val));
}

export function toMoneyString(val: unknown, decimalPlaces = 2): string {
  return toDecimal(val).toFixed(decimalPlaces);
}

export function toMoneyNumber(val: unknown, decimalPlaces = 2): number {
  return parseFloat(toDecimal(val).toFixed(decimalPlaces));
}

export interface LedgerTxCalculationInput {
  id: string;
  effectiveDate: Date | string;
  postedAt?: Date | string;
  category: string;
  debitAmount: unknown;
  creditAmount: unknown;
}

export interface LedgerTxCalculationOutput extends LedgerTxCalculationInput {
  debit: Decimal;
  credit: Decimal;
  runningBalance: Decimal;
  runningBalanceFormatted: string;
}

/**
 * Calculates running balances deterministically:
 * Balance_n = OpeningBalance + CumulativeCredits - CumulativeDebits
 * Deterministic order: effectiveDate ASC, postedAt ASC, id ASC
 */
export function calculateLedgerRunningBalances(
  openingBalance: unknown,
  transactions: LedgerTxCalculationInput[]
): LedgerTxCalculationOutput[] {
  // Sort deterministically
  const sorted = [...transactions].sort((a, b) => {
    const dateA = new Date(a.effectiveDate).getTime();
    const dateB = new Date(b.effectiveDate).getTime();
    if (dateA !== dateB) return dateA - dateB;

    const postedA = a.postedAt ? new Date(a.postedAt).getTime() : 0;
    const postedB = b.postedAt ? new Date(b.postedAt).getTime() : 0;
    if (postedA !== postedB) return postedA - postedB;

    return a.id.localeCompare(b.id);
  });

  let currentBalance = toDecimal(openingBalance);

  return sorted.map(tx => {
    const debit = toDecimal(tx.debitAmount);
    const credit = toDecimal(tx.creditAmount);

    currentBalance = currentBalance.plus(credit).minus(debit);

    return {
      ...tx,
      debit,
      credit,
      runningBalance: currentBalance,
      runningBalanceFormatted: currentBalance.toFixed(2)
    };
  });
}

/**
 * Server-side calculation of invoice line totals and invoice grand total
 */
export interface InvoiceLineInput {
  description: string;
  quantity: unknown; // Net weight KG
  unitPrice: unknown; // C&F Price USD
  unitOfMeasure?: string;
}

export function calculateInvoiceTotals(lines: InvoiceLineInput[]) {
  let subtotal = new Decimal(0);

  const calculatedLines = lines.map((line, idx) => {
    const qty = toDecimal(line.quantity);
    const price = toDecimal(line.unitPrice);
    const total = qty.times(price).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    subtotal = subtotal.plus(total);

    return {
      lineNumber: idx + 1,
      description: line.description,
      quantity: qty,
      quantityFormatted: qty.toFixed(2),
      unitOfMeasure: line.unitOfMeasure || 'KG',
      unitPrice: price,
      unitPriceFormatted: price.toFixed(4),
      lineTotal: total,
      lineTotalFormatted: total.toFixed(2)
    };
  });

  const taxAmount = new Decimal(0); // Zero tax for export by default
  const grandTotal = subtotal.plus(taxAmount);

  return {
    lines: calculatedLines,
    subtotal,
    subtotalFormatted: subtotal.toFixed(2),
    taxAmount,
    taxAmountFormatted: taxAmount.toFixed(2),
    grandTotal,
    grandTotalFormatted: grandTotal.toFixed(2)
  };
}
