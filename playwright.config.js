import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

const database = path.join(os.tmpdir(), `nxtwave-growth-playwright-${randomUUID()}.sqlite3`);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1365, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000',
      url: 'http://127.0.0.1:8000/api/health',
      env: {
        ADMIN_TOKEN: 'playwright-test-admin-token',
        DATABASE_PATH: database,
        STORAGE_MODE: 'ephemeral',
        FRONTEND_ORIGIN: 'http://127.0.0.1:5173',
      },
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: 'npm run dev',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
