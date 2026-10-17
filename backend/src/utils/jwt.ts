import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface TwoFactorPayload {
  userId: string;
  email: string;
  purpose: '2FA';
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as any
  });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpiresIn as any
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtRefreshSecret) as TokenPayload;
}

export function signTwoFactorToken(payload: TwoFactorPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: '5m'
  });
}

export function verifyTwoFactorToken(token: string): TwoFactorPayload {
  return jwt.verify(token, config.jwtSecret) as TwoFactorPayload;
}
