import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { prisma } from './prisma.js';
import { errorHandler } from './middleware/errorHandler.js';

// Import domain routes
import authRoutes from './modules/auth/auth.routes.js';
import customerRoutes from './modules/customers/customers.routes.js';
import invoiceRoutes from './modules/invoices/invoices.routes.js';
import shipmentRoutes from './modules/shipments/shipments.routes.js';
import ledgerRoutes from './modules/ledger/ledger.routes.js';
import paymentRoutes from './modules/payments/payments.routes.js';
import bankingRoutes from './modules/banking/banking.routes.js';
import reconciliationRoutes from './modules/reconciliation/reconciliation.routes.js';
import importRoutes from './modules/import/import.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import reportRoutes from './modules/reports/reports.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import receiptRoutes from './modules/receipts/receipts.routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

  // API modules
  app.use('/api/auth', authRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/shipments', shipmentRoutes);
  app.use('/api/ledger', ledgerRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/bank-accounts', bankingRoutes);
  app.use('/api/reconciliation', reconciliationRoutes);
  app.use('/api/import', importRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/receipts', receiptRoutes);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
