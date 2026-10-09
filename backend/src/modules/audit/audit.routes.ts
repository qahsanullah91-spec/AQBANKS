import { Router, Response, NextFunction } from 'express';
import { prisma } from '../../prisma.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';

const router = Router();

// GET /api/audit
router.get('/', authenticate, requirePermission('audit:view'), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { action, entityType, limit = '50', page = '1' } = req.query;
    const take = parseInt(String(limit), 10);
    const skip = (parseInt(String(page), 10) - 1) * take;

    const where: any = {};
    if (action) where.action = String(action);
    if (entityType) where.entityType = String(entityType);

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        include: {
          actor: {
            select: { id: true, email: true, firstName: true, lastName: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip
      }),
      prisma.auditEvent.count({ where })
    ]);

    res.json({
      total,
      page: parseInt(String(page), 10),
      totalPages: Math.ceil(total / take),
      events
    });
  } catch (err) {
    next(err);
  }
});

export default router;
