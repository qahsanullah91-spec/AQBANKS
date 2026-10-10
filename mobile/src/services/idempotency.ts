/**
 * Mobile Idempotency & Double-Tap Protection Service
 * Prevents duplicated financial submissions caused by network retries or repeated user taps.
 */

const inFlightOperations = new Set<string>();
const completedSubmissions = new Map<string, { timestamp: number; result: any }>();

export function generateIdempotencyKey(operationName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `mob-${operationName}-${timestamp}-${random}`;
}

export async function withIdempotencyGuard<T>(
  idempotencyKey: string,
  operation: () => Promise<T>
): Promise<T> {
  // 1. Guard against concurrent in-flight submissions (e.g. rapid double-tap)
  if (inFlightOperations.has(idempotencyKey)) {
    throw new Error('A submission with this idempotency key is already in progress. Please wait.');
  }

  // 2. Check if this exact operation recently completed (idempotent replay protection)
  const cached = completedSubmissions.get(idempotencyKey);
  if (cached && (Date.now() - cached.timestamp < 30000)) {
    return cached.result as T;
  }

  inFlightOperations.add(idempotencyKey);

  try {
    const result = await operation();
    completedSubmissions.set(idempotencyKey, {
      timestamp: Date.now(),
      result
    });
    return result;
  } finally {
    inFlightOperations.delete(idempotencyKey);
  }
}

export function clearIdempotencyCache(): void {
  inFlightOperations.clear();
  completedSubmissions.clear();
}
