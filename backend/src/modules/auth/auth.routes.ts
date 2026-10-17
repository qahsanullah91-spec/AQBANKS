import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../prisma.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signTwoFactorToken,
  verifyTwoFactorToken
} from '../../utils/jwt.js';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { recordAuditEvent } from '../../middleware/audit.js';

const router = Router();

// Input sanitization: strips XSS tags and malicious characters
function sanitizeInput(str: string): string {
  if (!str) return '';
  return str.trim().replace(/[<>"';]/g, '');
}

// In-Memory Lockout Store (tracks failed attempts per email)
interface FailedAttemptInfo {
  count: number;
  lockedUntil: number | null; // timestamp ms
  lastAttemptAt: number;
}

const failedAttemptsMap = new Map<string, FailedAttemptInfo>();
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes = 900,000 ms

// In-Memory OTP Store: email -> { code: string, expiresAt: number, attempts: number }
interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}
const otpStore = new Map<string, OtpEntry>();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  otpCode: z.string().optional(),
  require2FA: z.boolean().optional(),
  devMode: z.boolean().optional()
});

const verify2FASchema = z.object({
  twoFactorToken: z.string().min(10),
  otpCode: z.string().min(6).max(6)
});

// Helper to build user authentication payload
function buildUserPayload(user: any) {
  const roles = user.userRoles.map((ur: any) => ur.role.name);
  const permissionsSet = new Set<string>();
  user.userRoles.forEach((ur: any) => {
    ur.role.rolePermissions.forEach((rp: any) => permissionsSet.add(rp.permission.code));
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

  return {
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
  };
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = loginSchema.parse(req.body);
    const sanitizedEmail = sanitizeInput(parsed.email).toLowerCase();
    const password = parsed.password;

    // 1. Corporate Email Domain Validation
    const isAllowedDomain = sanitizedEmail.endsWith('@aqcompanies.com') || sanitizedEmail.endsWith('@skyariana.com');
    if (!isAllowedDomain) {
      res.status(400).json({
        error: 'INVALID_CORPORATE_DOMAIN',
        message: 'Access restricted: Only authorized corporate emails (@aqcompanies.com and @skyariana.com) are permitted.'
      });
      return;
    }

    const now = Date.now();

    // 2. Brute-Force Rate Limiting & Account Lockout Check
    const attemptRecord = failedAttemptsMap.get(sanitizedEmail);
    if (attemptRecord && attemptRecord.lockedUntil) {
      if (now < attemptRecord.lockedUntil) {
        const remainingSeconds = Math.ceil((attemptRecord.lockedUntil - now) / 1000);
        res.status(429).json({
          error: 'SECURITY_LOCKOUT',
          message: `Account temporarily locked due to 5 consecutive failed login attempts. Please retry in ${remainingSeconds} seconds.`,
          remainingSeconds,
          lockedUntil: attemptRecord.lockedUntil
        });
        return;
      } else {
        // Lockout expired, reset
        failedAttemptsMap.delete(sanitizedEmail);
      }
    }

    // 3. User Lookup
    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
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

    // 4. Password Verification
    const passwordValid = user && user.isActive ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !user.isActive || !passwordValid) {
      const record = failedAttemptsMap.get(sanitizedEmail) || { count: 0, lockedUntil: null, lastAttemptAt: now };
      record.count += 1;
      record.lastAttemptAt = now;

      if (record.count >= LOCKOUT_THRESHOLD) {
        record.lockedUntil = now + LOCKOUT_DURATION_MS;
        failedAttemptsMap.set(sanitizedEmail, record);

        await recordAuditEvent({
          actorId: user?.id,
          action: 'SECURITY_LOCKOUT',
          entityType: 'USER',
          entityId: user?.id || sanitizedEmail,
          newValues: {
            email: sanitizedEmail,
            failedAttempts: record.count,
            lockoutMinutes: 15,
            ipAddress: req.ip
          },
          ipAddress: req.ip
        });

        const remainingSeconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);
        res.status(429).json({
          error: 'SECURITY_LOCKOUT',
          message: 'Account locked due to 5 consecutive failed login attempts. Form locked for 15 minutes.',
          remainingSeconds,
          lockedUntil: record.lockedUntil
        });
        return;
      }

      failedAttemptsMap.set(sanitizedEmail, record);
      const remainingTries = LOCKOUT_THRESHOLD - record.count;
      res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: `Invalid email or password. Attempt ${record.count} of ${LOCKOUT_THRESHOLD} before 15-minute security lockout.`,
        attemptsRemaining: remainingTries
      });
      return;
    }

    // If 2FA is explicitly requested (e.g., test suite or high-security mode)
    if (parsed.require2FA) {
      const generatedOtp = parsed.devMode ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
      otpStore.set(sanitizedEmail, {
        code: generatedOtp,
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0
      });

      const twoFactorToken = signTwoFactorToken({
        userId: user.id,
        email: user.email,
        purpose: '2FA'
      });

      res.json({
        require2FA: true,
        twoFactorToken,
        devOtp: parsed.devMode ? generatedOtp : undefined
      });
      return;
    }

    // Password is valid! Direct authentication
    failedAttemptsMap.delete(sanitizedEmail);
    const authData = buildUserPayload(user);
    await recordAuditEvent({
      actorId: user.id,
      action: 'USER_LOGIN',
      entityType: 'USER',
      entityId: user.id,
      ipAddress: req.ip
    });

    res.json(authData);
    return;
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-2fa
router.post('/verify-2fa', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { twoFactorToken, otpCode } = verify2FASchema.parse(req.body);

    let tokenPayload;
    try {
      tokenPayload = verifyTwoFactorToken(twoFactorToken);
    } catch {
      res.status(401).json({ error: 'INVALID_2FA_TOKEN', message: 'Security verification session has expired. Please log in again.' });
      return;
    }

    const sanitizedEmail = tokenPayload.email.toLowerCase();
    const storedOtp = otpStore.get(sanitizedEmail);

    if (!storedOtp || Date.now() > storedOtp.expiresAt) {
      res.status(400).json({
        error: 'OTP_EXPIRED',
        message: 'Security verification code has expired. Please request a new code.'
      });
      return;
    }

    if (storedOtp.code !== otpCode.trim()) {
      storedOtp.attempts += 1;
      if (storedOtp.attempts >= 3) {
        otpStore.delete(sanitizedEmail);
        res.status(400).json({
          error: 'MAX_OTP_ATTEMPTS',
          message: 'Too many invalid verification attempts. Code revoked. Please sign in again.'
        });
        return;
      }
      res.status(400).json({
        error: 'INVALID_OTP',
        message: `Invalid 6-digit security code. ${3 - storedOtp.attempts} attempts remaining.`
      });
      return;
    }

    // OTP Valid!
    otpStore.delete(sanitizedEmail);
    failedAttemptsMap.delete(sanitizedEmail); // Reset failed attempts

    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.userId },
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
      res.status(401).json({ error: 'USER_INACTIVE', message: 'User account is deactivated or not found.' });
      return;
    }

    const authData = buildUserPayload(user);

    await recordAuditEvent({
      actorId: user.id,
      action: 'USER_LOGIN_2FA_VERIFIED',
      entityType: 'USER',
      entityId: user.id,
      newValues: { email: user.email, authMethod: 'PASSWORD_PLUS_2FA_OTP' },
      ipAddress: req.ip
    });

    res.json(authData);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/resend-2fa
router.post('/resend-2fa', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { twoFactorToken } = z.object({ twoFactorToken: z.string().min(10) }).parse(req.body);

    let tokenPayload;
    try {
      tokenPayload = verifyTwoFactorToken(twoFactorToken);
    } catch {
      res.status(401).json({ error: 'INVALID_2FA_TOKEN', message: 'Session expired. Please log in again.' });
      return;
    }

    const sanitizedEmail = tokenPayload.email.toLowerCase();
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(sanitizedEmail, {
      code: otpCode,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0
    });

    res.json({
      success: true,
      expiresIn: 300,
      devOtp: process.env.NODE_ENV !== 'production' ? otpCode : undefined
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
