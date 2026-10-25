import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from './prisma.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimit } from './utils/rateLimit.js';
import { config } from './config/index.js';

// Import domain routes
import authRoutes from './modules/auth/auth.routes.js';
import customerRoutes from './modules/customers/customers.routes.js';
import invoiceRoutes from './modules/invoices/invoices.routes.js';
import shipmentRoutes from './modules/shipments/shipments.routes.js';
import ledgerRoutes from './modules/ledger/ledger.routes.js';
import paymentRoutes from './modules/payments/payments.routes.js';
import bankingRoutes from './modules/banking/banking.routes.js';
import remittanceRoutes from './modules/banking/remittance.routes.js';
import reconciliationRoutes from './modules/reconciliation/reconciliation.routes.js';
import importRoutes from './modules/import/import.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import reportRoutes from './modules/reports/reports.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import receiptRoutes from './modules/receipts/receipts.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: config.corsOrigins.includes('*') ? '*' : (origin, callback) => {
      // Allow non-browser requests (curl, same-origin) with no origin header
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Origin not allowed by CORS policy'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Abuse protection: general per-IP budget, plus a much tighter budget on the
  // credential endpoint on top of the per-account lockout in the auth module.
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    message: 'Too many API requests from this address. Please retry in a moment.'
  });
  const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: 'Too many login attempts from this address. Please retry in a moment.',
    errorCode: 'LOGIN_RATE_LIMITED'
  });

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  // Health check endpoint
  app.get('/api/health', async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: 'pass',
        timestamp: new Date().toISOString(),
        service: 'AQ Companies Logistics & Financial Management API',
        uptime: process.uptime()
      });
    } catch (err: any) {
      res.status(503).json({
        status: 'fail',
        message: 'Database connection failed',
        error: err.message
      });
    }
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth/login', loginLimiter);

  // API modules
  app.use('/api/auth', authRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/shipments', shipmentRoutes);
  app.use('/api/ledger', ledgerRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/bank-accounts', bankingRoutes);
  app.use('/api/remittance-profiles', remittanceRoutes);
  app.use('/api/reconciliation', reconciliationRoutes);
  app.use('/api/import', importRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/receipts', receiptRoutes);
  app.use('/api/admin', adminRoutes);

  // Unknown API routes must return JSON 404, not the SPA HTML shell
  app.use('/api', (req, res) => {
    res.status(404).json({
      error: 'ROUTE_NOT_FOUND',
      message: `No API route matches ${req.method} ${req.originalUrl}`
    });
  });

  // Serve the built frontend (repo-root/frontend/dist) when present, so the app
  // is reachable at http://localhost:4000/ without a separate web server.
  // Resolved from cwd to stay compatible with both CJS build output and tsx ESM.
  const frontendDist = [
    path.resolve(process.cwd(), '../frontend/dist'),
    path.resolve(process.cwd(), 'frontend/dist')
  ].find(dir => fs.existsSync(path.join(dir, 'index.html')));
  if (frontendDist) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
