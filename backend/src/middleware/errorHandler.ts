import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) {
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Request payload validation failed',
      details: err.errors
    });
    return;
  }

  // Malformed JSON body from express.json()
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: 'INVALID_JSON',
      message: 'Request body is not valid JSON'
    });
    return;
  }

  // Prisma known errors mapped to precise HTTP semantics
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const target = Array.isArray(err.meta?.target) ? (err.meta.target as string[]).join(', ') : undefined;
        res.status(409).json({
          error: 'DUPLICATE_RECORD',
          message: target
            ? `A record with the same ${target} already exists.`
            : 'A record with the same unique value already exists.',
          target
        });
        return;
      }
      case 'P2025':
        res.status(404).json({
          error: 'NOT_FOUND',
          message: 'The requested record does not exist.'
        });
        return;
      case 'P2003':
        res.status(400).json({
          error: 'FOREIGN_KEY_CONSTRAINT',
          message: 'Operation references a record that does not exist.'
        });
        return;
      default:
        console.error(`[ERROR] Prisma ${err.code} ${req.method} ${req.url}:`, err.message);
        res.status(500).json({
          error: 'DATABASE_ERROR',
          message: 'A database error occurred while processing the request.'
        });
        return;
    }
  }

  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    console.error(`[ERROR] Prisma connection ${req.method} ${req.url}:`, err.message);
    res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database is unreachable. Please retry shortly.'
    });
    return;
  }

  const statusCode = Number(err.status || err.statusCode) || 500;

  if (statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.url}:`, err);
    res.status(statusCode).json({
      error: err.code || 'SERVER_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : (err.message || 'Internal server error')
    });
    return;
  }

  // Client errors (4xx): the message is safe and useful to surface
  res.status(statusCode).json({
    error: err.code || 'REQUEST_ERROR',
    message: err.message || 'Request failed'
  });
}
