import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { recordAuditEvent } from '../../middleware/audit.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true }
                }
              }
            }
          }
        }
      }
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
      return;
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
      return;
    }

    const roles = user.userRoles.map(ur => ur.role.name);
    const permissionsSet = new Set<string>();
    user.userRoles.forEach(ur => {
      ur.role.rolePermissions.forEach(rp => permissionsSet.add(rp.permission.code));
    });
    const permissions = Array.from(permissionsSet);

    const payload = {
      userId: user.id,
      email: user.email,
      roles,
      permissions
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await recordAuditEvent({
      actorId: user.id,
      action: 'USER_LOGIN',
      entityType: 'USER',
      entityId: user.id,
      ipAddress: req.ip
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        permissions
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
      return;
    }

    const roles = user.userRoles.map(ur => ur.role.name);
    const permissionsSet = new Set<string>();
    user.userRoles.forEach(ur => {
      ur.role.rolePermissions.forEach(rp => permissionsSet.add(rp.permission.code));
    });

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      permissions: Array.from(permissionsSet)
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/users (Admin only)
router.get('/users', authenticate, requireRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      include: {
        userRoles: {
          include: { role: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(users.map(u => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      isActive: u.isActive,
      roles: u.userRoles.map(r => r.role.name),
      createdAt: u.createdAt
    })));
  } catch (err) {
    next(err);
  }
});

export default router;
