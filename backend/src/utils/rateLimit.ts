import { Request, Response, NextFunction } from 'express';

interface HitRecord {
  hits: number[];
}

/**
 * Lightweight in-memory sliding-window rate limiter. Suitable for the
 * single-instance local/desktop deployment of this API. Keys by client IP
 * and tolerates multi-user load without external dependencies.
 */
export function rateLimit(options: {
  windowMs: number;
  max: number;
  message?: string;
  errorCode?: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}) {
  const { windowMs, max, message = 'Too many requests, please slow down.', errorCode = 'RATE_LIMITED' } = options;
  const store = new Map<string, HitRecord>();

  // Periodic cleanup so the map cannot grow unbounded with rotating IPs
  const cleaner = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, record] of store) {
      record.hits = record.hits.filter(t => t > cutoff);
      if (record.hits.length === 0) store.delete(key);
    }
  }, Math.max(windowMs, 60_000));
  if (typeof cleaner.unref === 'function') cleaner.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (options.skip?.(req)) {
      next();
      return;
    }

    const key = options.keyGenerator ? options.keyGenerator(req) : (req.ip || 'unknown');
    const now = Date.now();
    const cutoff = now - windowMs;

    let record = store.get(key);
    if (!record) {
      record = { hits: [] };
      store.set(key, record);
    }
    record.hits = record.hits.filter(t => t > cutoff);

    if (record.hits.length >= max) {
      const oldest = record.hits[0];
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      res.setHeader('Retry-After', retryAfterSec);
      res.status(429).json({
        error: errorCode,
        message,
        retryAfterSeconds: retryAfterSec
      });
      return;
    }

    record.hits.push(now);
    next();
  };
}
