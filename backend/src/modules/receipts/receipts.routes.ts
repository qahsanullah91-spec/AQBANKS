import { Router, Response, NextFunction } from 'express';
import { receiptsService } from './receipts.service.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';

const router = Router();

// GET /api/receipts
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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

// GET /api/receipts/:id
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const receipt = await receiptsService.getReceiptById(req.params.id);
    res.json(receipt);
  } catch (err) {
    next(err);
  }
});

// GET /api/receipts/:id/pdf-data
router.get('/:id/pdf-data', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pdfData = await receiptsService.getReceiptPdfData(req.params.id);
    res.json(pdfData);
  } catch (err) {
    next(err);
  }
});

// POST /api/receipts/:id/void
router.post('/:id/void', authenticate, requirePermission('payment:create'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reason } = req.body;
    const voided = await receiptsService.voidReceipt(req.params.id, reason, req.user!.userId, req.ip);
    res.json(voided);
  } catch (err) {
    next(err);
  }
});

export default router;
