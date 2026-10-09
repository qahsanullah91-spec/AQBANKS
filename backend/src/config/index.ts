import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret_for_dev_mode_only',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_for_dev',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  storageLocalDir: path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR || './storage_data'),
  sourceWorkbookPath: path.resolve(process.cwd(), '../AQ_Companies_System_v10_Logistics.xlsx'),
  expectedWorkbookHash: 'BC25181951738F3A3E668DC5D3564747447DE549A6CB85F59D28313EA05464EA'
};
