import { expect, test } from '@playwright/test';
import { join } from 'node:path';

const screens = process.env.SPRINT5_SCREENSHOT_DIR;
const paths = ['/staff/servicii', '/staff/rapoarte'];

test('requires a staff session for both Admin documents', async ({ request }) => {
  for (const path of paths) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(303);
    expect(response.headers().location).toBe('/staff/login');
  }
});

test('opens the Admin pages and exports the filtered report', async ({ browser, baseURL }) => {
  test.skip(!process.env.IOANA_SEED_PASSWORD || !process.env.ANA_SEED_PASSWORD,
    'Requires both local seed passwords and an isolated deployment.');
  for (const [colorScheme, width] of [['light', 1440], ['dark', 1440], ['light', 390], ['dark', 390]] as const) {
    const context = await browser.newContext({ baseURL, colorScheme, viewport: { width, height: 960 } });
    try {
      const page = await context.newPage();
      await page.goto('/staff/login');
      await page.getByLabel('E-mail').fill('ioana@admin.com');
      await page.getByLabel('Parolă').fill(process.env.IOANA_SEED_PASSWORD!);
      await page.getByRole('button', { name: 'Autentifică-te' }).click();
      await page.getByRole('link', { name: 'Servicii', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Gestiunea Serviciilor' })).toBeVisible();
      await expect(page.getByText('Laminare sprâncene', { exact: true })).toBeVisible();
      if (screens) await page.screenshot({ path: join(screens, `DS-adm-services.${colorScheme}${width === 390 ? '.mobile' : ''}.png`), fullPage: true });
      await page.getByRole('link', { name: 'Rapoarte', exact: true }).click();
      await page.getByLabel('Specialistă').selectOption({ label: 'Ana' });
      await expect(page.getByRole('heading', { name: 'Rapoarte Admin' })).toBeVisible();
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export CSV' }).click();
      expect((await download).suggestedFilename()).toMatch(/^raport-beauty-studio-.*\.csv$/);
      await page.emulateMedia({ media: 'print' });
      await expect(page.getByRole('heading', { name: 'Rapoarte Admin' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Export CSV' })).toBeHidden();
      await page.emulateMedia({ media: 'screen' });
      if (screens) await page.screenshot({ path: join(screens, `DS-adm-reports.${colorScheme}${width === 390 ? '.mobile' : ''}.png`), fullPage: true });
      if (width !== 1440 || colorScheme !== 'light') continue;
      await page.getByRole('button', { name: 'Deconectare' }).click();
      await page.getByLabel('E-mail').fill('ana@admin.com');
      await page.getByLabel('Parolă').fill(process.env.ANA_SEED_PASSWORD!);
      await page.getByRole('button', { name: 'Autentifică-te' }).click();
      await expect(page.getByRole('heading', { name: 'Programările mele' })).toBeVisible();
      for (const path of paths) expect((await page.request.get(path, { maxRedirects: 0 })).status()).toBe(403);
    } finally {
      await context.close();
    }
  }
});
