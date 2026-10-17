/**
 * Converts numeric currency amount to English words for commercial trade invoices.
 * Example: 57533.00 -> "FIFTY-SEVEN THOUSAND FIVE HUNDRED THIRTY-THREE AND 00/100 US DOLLARS ONLY"
 */

const ONES = [
  '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
  'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'
];

const TENS = [
  '', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'
];

function convertGroup(num: number): string {
  let result = '';
  const hundreds = Math.floor(num / 100);
  const remainder = num % 100;

  if (hundreds > 0) {
    result += ONES[hundreds] + ' HUNDRED';
    if (remainder > 0) {
      result += ' ';
    }
  }

  if (remainder > 0) {
    if (remainder < 20) {
      result += ONES[remainder];
    } else {
      const ten = Math.floor(remainder / 10);
      const one = remainder % 10;
      result += TENS[ten];
      if (one > 0) {
        result += '-' + ONES[one];
      }
    }
  }

  return result;
}

export function formatAmountInWords(amount: number | string, currency: string = 'USD'): string {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]+/g, '')) : amount;
  if (isNaN(numericAmount) || numericAmount < 0) {
    return '';
  }

  const integerPart = Math.floor(numericAmount);
  const centsPart = Math.round((numericAmount - integerPart) * 100);

  if (integerPart === 0 && centsPart === 0) {
    return `ZERO ${currency === 'USD' ? 'US DOLLARS' : currency} ONLY`;
  }

  const billions = Math.floor(integerPart / 1000000000);
  const millions = Math.floor((integerPart % 1000000000) / 1000000);
  const thousands = Math.floor((integerPart % 1000000) / 1000);
  const remainder = integerPart % 1000;

  const parts: string[] = [];

  if (billions > 0) {
    parts.push(convertGroup(billions) + ' BILLION');
  }
  if (millions > 0) {
    parts.push(convertGroup(millions) + ' MILLION');
  }
  if (thousands > 0) {
    parts.push(convertGroup(thousands) + ' THOUSAND');
  }
  if (remainder > 0) {
    parts.push(convertGroup(remainder));
  }

  const words = parts.join(' ');
  const centsFormatted = String(centsPart).padStart(2, '0');
  const currencyName = currency === 'USD' ? 'US DOLLARS' : currency;

  return `SAY ${currencyName}: ${words} AND ${centsFormatted}/100 ONLY`;
}
