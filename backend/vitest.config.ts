import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    environment: 'node',
    testTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db'
    },
    globalSetup: path.resolve(__dirname, 'tests/globalSetup.ts')
  }
});
