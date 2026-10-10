/**
 * Receipts Utilities: Sequence Number Generator and Amount in Words
 */

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const TEENS = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

function convertGroup(n: number): string {
  let str = '';
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;

  if (hundreds > 0) {
    str += ONES[hundreds] + ' Hundred';
    if (remainder > 0) str += ' ';
  }

  if (remainder >= 10 && remainder < 20) {
    str += TEENS[remainder - 10];
  } else {
    const tens = Math.floor(remainder / 10);
    const ones = remainder % 10;
    if (tens > 0) {
      str += TENS[tens];
      if (ones > 0) str += '-';
    }
    if (ones > 0) {
      str += ONES[ones];
    }
  }

  return str;
}

export function numberToWords(amount: number | string, currency: string = 'USD'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num === 0) return 'Zero ' + (currency === 'USD' ? 'US Dollars and Zero Cents' : currency);

  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const integerPart = Math.floor(absNum);
  const cents = Math.round((absNum - integerPart) * 100);

  if (integerPart === 0) {
    const centsText = convertGroup(cents);
    return (isNegative ? 'Minus ' : '') + `Zero US Dollars and ${centsText || 'Zero'} Cents`;
  }

  let words = '';
  let current = integerPart;
  let scaleIdx = 0;

  while (current > 0) {
    const group = current % 1000;
    if (group > 0) {
      const groupWords = convertGroup(group);
      const scale = SCALES[scaleIdx];
      words = groupWords + (scale ? ' ' + scale : '') + (words ? ' ' + words : '');
    }
    current = Math.floor(current / 1000);
    scaleIdx++;
  }

  const centsWords = cents > 0 ? convertGroup(cents) : 'Zero';
  const currencyLabel = currency === 'USD' ? 'US Dollars' : currency;

  return (isNegative ? 'Minus ' : '') + `${words} ${currencyLabel} and ${centsWords} Cents`;
}

export async function generateNextReceiptNumber(tx: any): Promise<string> {
  const year = new Date().getFullYear();
  // Count existing receipts for the current year
  const count = await tx.receipt.count();
  const sequence = String(count + 1).padStart(4, '0');
  let candidate = `RCP-${year}-${sequence}`;

  // Collision safety check
  let exists = await tx.receipt.findUnique({ where: { receiptNumber: candidate } });
  let offset = 1;
  while (exists) {
    const altSequence = String(count + 1 + offset).padStart(4, '0');
    candidate = `RCP-${year}-${altSequence}`;
    exists = await tx.receipt.findUnique({ where: { receiptNumber: candidate } });
    offset++;
  }

  return candidate;
}
