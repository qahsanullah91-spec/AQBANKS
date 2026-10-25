import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { receiptsService } from './receipts.service.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requirePermission, requireRole } from '../../middleware/rbac.js';

const router = Router();

const updateReceiptSchema = z.object({
  payerName: z.string().min(1, 'Payer name is required').optional(),
  purpose: z.string().min(1, 'Payment purpose is required').optional(),
  referenceNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  issueDate: z.string().optional(),
  grossAmount: z.number().positive('Gross amount must be greater than zero').optional(),
  swiftFeeAmount: z.number().min(0).optional()
}).refine(
  data => data.grossAmount === undefined || data.swiftFeeAmount === undefined || data.swiftFeeAmount < data.grossAmount,
  { message: 'SWIFT fee must be less than the gross amount' }
);

// GET /api/receipts (Finance, Auditor, Admin)
router.get('/', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR', 'AUDITOR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, status, startDate, endDate } = req.query;
    const receipts = await receiptsService.getReceipts({
      search: search ? String(search) : undefined,
      status: status ? String(status) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined
    });
    res.json(receipts);
  } catch (err) {
    next(err);
  }
});

// GET /api/receipts/:id (Finance, Auditor, Admin)
router.get('/:id', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR', 'AUDITOR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const receipt = await receiptsService.getReceiptById(req.params.id);
    res.json(receipt);
  } catch (err) {
    next(err);
  }
});

// GET /api/receipts/:id/pdf-data (Finance, Auditor, Admin)
router.get('/:id/pdf-data', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR', 'AUDITOR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pdfData = await receiptsService.getReceiptPdfData(req.params.id);
    res.json(pdfData);
  } catch (err) {
    next(err);
  }
});

// POST /api/receipts/:id/void (Administrator & Finance Manager with mandatory reason)
router.post('/:id/void', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reason } = req.body;
    const voided = await receiptsService.voidReceipt(req.params.id, reason, req.user!.userId, req.ip);
    res.json(voided);
  } catch (err) {
    next(err);
  }
});

// PUT /api/receipts/:id (Administrator & Finance Manager)
// Updates receipt details; financial changes propagate to the linked ledger
// transaction and payment allocations, then running balances are recalculated.
router.put('/:id', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = updateReceiptSchema.parse(req.body);
    const updated = await receiptsService.updateReceipt(req.params.id, data, req.user!.userId, req.ip);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/receipts/:id (Administrator & Finance Manager)
// Permanently removes the receipt and unwinds its linked payment allocation and
// bank ledger credit, restoring the books to the pre-payment state.
router.delete('/:id', authenticate, requireRole(['ADMIN', 'FINANCE_MANAGER', 'FINANCE_MGR']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await receiptsService.deleteReceipt(req.params.id, req.user!.userId, req.ip);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
