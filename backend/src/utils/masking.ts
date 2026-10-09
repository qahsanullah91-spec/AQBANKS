/**
 * Utility to securely mask bank account numbers, cards, or sensitive identifiers.
 * e.g., '101502USD2940472' -> '101502******0472'
 */
export function maskAccountNumber(accNumber?: string | null): string {
  if (!accNumber) return '';
  const str = String(accNumber).trim();
  if (str.length <= 8) {
    return '******' + str.slice(-4);
  }
  const prefix = str.slice(0, 6);
  const suffix = str.slice(-4);
  return `${prefix}******${suffix}`;
}

export function redactSensitiveObject<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = { ...obj } as any;

  const sensitiveKeys = ['password', 'passwordHash', 'token', 'secret', 'accountNumberEncrypted'];
  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.includes(key)) {
      clone[key] = '[REDACTED]';
    } else if (key === 'accountNumber') {
      clone[key] = maskAccountNumber(clone[key]);
    } else if (typeof clone[key] === 'object') {
      clone[key] = redactSensitiveObject(clone[key]);
    }
  }
  return clone;
}
