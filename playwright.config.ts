import { defineConfig } from '@playwright/test';
import path from 'node:path';

const PORT = Number(process.env.PLAYWRIGHT_WEB_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;
const testDbPath = path.resolve(
  process.cwd(),
  'test-results',
  `playwright-e2e-${Date.now()}.db`
);

process.env.DATA_DB_PATH = testDbPath;

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    extraHTTPHeaders: {
      'Content-Type': 'application/json'
    },
    timezoneId: 'Asia/Singapore',
    contextOptions: {
      permissions: ['notifications']
    },
    launchOptions: {
      args: ['--enable-automation', '--ignore-certificate-errors']
    }
  },
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATA_DB_PATH: testDbPath,
      PORT: String(PORT),
      NODE_ENV: 'production',
      TZ: 'Asia/Singapore'
    }
  }
});
