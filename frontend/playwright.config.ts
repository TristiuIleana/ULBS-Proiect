import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  testDir: './test',
  outputDir: join(tmpdir(), 'beauty-studio-playwright'),
  use: {
    baseURL: process.env.BOOKING_E2E_ORIGIN || 'http://localhost:17173',
    channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL,
  },
});
