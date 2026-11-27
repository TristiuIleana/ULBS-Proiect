import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

const ioanaPassword = process.env.IOANA_SEED_PASSWORD;
const anaPassword = process.env.ANA_SEED_PASSWORD;
const screenshots = process.env.STAFF_SCREENSHOT_DIR;

test('protects a direct request for an internal document', async ({ request }) => {
  const response = await request.get('/staff/receptie', { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe('/staff/login');
});

test('Ioana can create a visit at reception and Ana sees only her own calendar', async ({ browser, baseURL }) => {
  test.skip(!ioanaPassword || !anaPassword, 'Requires both local seed passwords and an isolated deployment.');
  test.setTimeout(60_000);
  const lastName = `Test recepție cu nume lung ${randomUUID().slice(0, 8)}`;
  const clientName = `Clientă ${lastName}`;
  for (const theme of ['light', 'dark'] as const) {
    const context = await browser.newContext({ baseURL, colorScheme: theme, viewport: { width: 1440, height: 960 } });
    const page = await context.newPage();
    try {
      await page.goto('/staff/login');
      await expect(page.getByRole('heading', { name: 'Autentificare personal' })).toBeVisible();
      if (screenshots) await page.screenshot({ path: join(screenshots, `DS-adm-login.${theme}.png`) });
      await page.getByLabel('E-mail').fill('ioana@admin.com');
      await page.getByLabel('Parolă').fill(ioanaPassword!);
      await page.getByRole('button', { name: 'Autentifică-te' }).click();
      await expect(page.getByRole('heading', { name: 'Calendar Recepție' })).toBeVisible();
      const anaLane = page.getByRole('region', { name: 'Agenda Ana' });
      await expect(anaLane).toBeVisible();
      await expect(page.getByRole('region', { name: 'Agenda Ioana' })).toBeVisible();
      if (theme === 'light') {
        await page.getByRole('button', { name: 'Programare nouă' }).click();
        const form = page.getByRole('dialog');
        await form.getByLabel('Specialistă').selectOption({ label: 'Ana' });
        await form.getByLabel('Serviciu').selectOption({ label: 'Make-up ocazie (fără gene)' });
        const tomorrow = new Date(Date.now() + 86_400_000);
        const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bucharest' }).format(tomorrow);
        await form.getByLabel('Data programării').fill(day);
        const slot = form.getByLabel('Ora programării');
        await expect(slot).toBeEnabled();
        await slot.selectOption({ index: 1 });
        await form.getByLabel('Prenume').fill('Clientă');
        await form.getByLabel('Nume', { exact: true }).fill(lastName);
        await form.getByLabel('Telefon').fill('0700000000');
        await form.getByRole('button', { name: 'Salvează programarea' }).click();
        await expect(page.getByText('Programarea a fost confirmată.')).toBeVisible();
      }
      await page.getByRole('button', { name: 'Perioada următoare' }).click();
      await expect(anaLane.getByText(clientName)).toBeVisible();
      if (screenshots) await page.screenshot({ path: join(screenshots, `DS-adm-calendar.${theme}.png`) });
      await page.getByRole('button', { name: 'Waitlist' }).click();
      await expect(page.getByText('Nu există cereri Waitlist pentru perioada selectată.')).toBeVisible();
      if (screenshots) await page.screenshot({ path: join(screenshots, `DS-adm-waitlist.${theme}.png`) });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Deconectare' }).click();
      await expect(page).toHaveURL(/\/staff\/login$/);
      await page.getByLabel('E-mail').fill('ana@admin.com');
      await page.getByLabel('Parolă').fill(anaPassword!);
      await page.getByRole('button', { name: 'Autentifică-te' }).click();
      await expect(page.getByRole('heading', { name: 'Programările mele' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Recepție' })).toHaveCount(0);
      const reception = await page.request.get('/staff/receptie', { maxRedirects: 0 });
      expect(reception.status()).toBe(403);
      await page.getByRole('button', { name: 'Perioada următoare' }).click();
      await expect(anaLane.getByText(clientName)).toBeVisible();
      await expect(page.getByRole('region', { name: 'Agenda Ioana' })).toHaveCount(0);
      if (screenshots) await page.screenshot({ path: join(screenshots, `DS-emp-calendar.${theme}.png`) });
      const download = page.waitForEvent('download');
      await page.getByRole('link', { name: 'Descarcă .ics' }).click();
      expect((await download).suggestedFilename()).toMatch(/\.ics$/);
      await page.getByRole('button', { name: 'Săptămână' }).click();
      await expect(anaLane.getByText(clientName)).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByRole('heading', { name: 'Programările mele' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    } finally {
      await context.close();
    }
  }
});
