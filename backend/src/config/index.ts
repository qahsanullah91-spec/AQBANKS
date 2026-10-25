import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_for_dev_mode_only';
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_for_dev';

if (isProduction && (jwtSecret.startsWith('fallback_') || jwtRefreshSecret.startsWith('fallback_'))) {
  throw new Error(
    'Refusing to start in production with development JWT secrets. ' +
    'Set JWT_SECRET and JWT_REFRESH_SECRET environment variables.'
  );
}

// Comma-separated list of allowed browser origins, e.g. "http://localhost:5174,https://app.example.com"
// Defaults to the built frontend port. '*' allows any origin (development default).
const corsOriginRaw = process.env.CORS_ORIGIN || '*';
const corsOrigins = corsOriginRaw
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv,
  isProduction,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtRefreshSecret,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  corsOrigins,
  storageLocalDir: path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR || './storage_data'),
  sourceWorkbookPath: path.resolve(process.cwd(), '../AQ_Companies_System_v10_Logistics.xlsx'),
  expectedWorkbookHash: 'BC25181951738F3A3E668DC5D3564747447DE549A6CB85F59D28313EA05464EA'
};
