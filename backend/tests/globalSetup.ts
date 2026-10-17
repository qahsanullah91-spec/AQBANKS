import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setup() {
  const devDbPath = path.resolve(__dirname, '../prisma/dev.db');
  const testDbPath = path.resolve(__dirname, '../prisma/test.db');
  if (fs.existsSync(devDbPath)) {
    fs.copyFileSync(devDbPath, testDbPath);
  }
}

export async function teardown() {
  const testDbPath = path.resolve(__dirname, '../prisma/test.db');
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (e) {
      // Ignore if locked by sqlite
    }
  }
}
