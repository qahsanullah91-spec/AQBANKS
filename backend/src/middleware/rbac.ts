import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    const hasRole = req.user.roles.some(r => allowedRoles.includes(r) || r === 'ADMIN');
    if (!hasRole) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: `Forbidden: requires one of roles [${allowedRoles.join(', ')}]`
      });
      return;
    }
    next();
  };
}

export function requirePermission(permissionCode: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'User not authenticated' });
      return;
    }

    if (req.user.roles.includes('ADMIN')) {
      return next();
    }

    if (!req.user.permissions.includes(permissionCode)) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: `Access denied: missing required permission '${permissionCode}'`
      });
      return;
    }
    next();
  };
}
