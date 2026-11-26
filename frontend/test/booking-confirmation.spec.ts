import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const notice = 'Programarea NU este confirmată încă — te rugăm să accesezi linkul de confirmare trimis pe email';
const mailpit = process.env.MAILPIT_API_URL || 'http://localhost:18025';

async function messagesFor(request: APIRequestContext, email: string) {
  const search = new URL('/api/v1/search', mailpit);
  search.searchParams.set('query', `to:${email}`);
  const response = await request.get(search.href);
  expect(response.ok()).toBe(true);
  return ((await response.json()).messages ?? []) as { ID: string }[];
}

async function capture(page: Page, screen: string) {
  if (process.env.UPDATE_BOOKING_SCREENSHOTS !== '1') return;
  const previous = page.viewportSize();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: resolve('../docs/design/screens', `${screen}.light.png`), fullPage: true });
  await page.getByRole('button', { name: /Mod întunecat/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve('../docs/design/screens', `${screen}.dark.png`), fullPage: true });
  await page.getByRole('button', { name: /Mod luminos/ }).click();
  if (previous) await page.setViewportSize(previous);
}

test('reserves immediately across sessions and confirms through the link delivered by email', async ({ page, browser, request, baseURL }) => {
  const otherContext = await browser.newContext({ baseURL });
  let managementToken: string | undefined;
  try {
    const other = await otherContext.newPage();
    const email = `${randomUUID()}@example.test`;
    async function openFutureBooking(view: Page) {
      const subscribed = view.waitForResponse(response => response.url().includes('/api/availability/changes?') && response.ok());
      await view.goto('/');
      await subscribed;
      await view.getByRole('button', { name: 'Zilele următoare' }).click();
      const available = view.getByRole('group', { name: 'Ziua programării' })
        .getByRole('button', { name: /\bDisponibil\b/ }).first();
      await available.click();
    }
    await Promise.all([openFutureBooking(page), openFutureBooking(other)]);
    const firstFree = page.locator('.slot-option').filter({ has: page.locator('input:enabled') }).first();
    const time = (await firstFree.innerText()).trim();
    const otherSlot = other.getByRole('radio', { name: time, exact: true });
    await expect(otherSlot).toBeEnabled();
    await firstFree.click();
    await page.getByLabel('Prenume', { exact: true }).fill('Test');
    await page.getByLabel('Nume', { exact: true }).fill('Vizitatoare');
    await page.getByLabel('Telefon', { exact: true }).fill('0700000000');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    const created = page.waitForResponse(response => new URL(response.url()).pathname === '/api/bookings'
      && response.request().method() === 'POST');
    await page.getByRole('button', { name: /Rezervă intervalul/ }).click();
    const response = await created;
    const booking = await response.json();
    expect(response.status()).toBe(201);
    expect(booking.status).toBe('PENDING_CONFIRMATION');
    await expect.poll(async () => (await messagesFor(request, email)).length).toBe(1);
    const [initialMail] = await messagesFor(request, email);
    const mail = await request.get(new URL(`/api/v1/message/${initialMail.ID}`, mailpit).href);
    const { Text } = await mail.json() as { Text: string };
    const managementLink = Text.match(/https?:\/\/\S+\/programare\?token=[\w-]+/)?.[0];
    expect(managementLink).toBeDefined();
    managementToken = new URL(managementLink!).searchParams.get('token') ?? undefined;
    await expect(page.getByText(notice)).toBeVisible();
    await expect(otherSlot).toBeDisabled();
    await capture(page, 'DS-pub-booking');
    await page.getByRole('button', { name: 'Retrimite e-mailul de confirmare' }).click();
    await expect(page.getByText('Am retrimis e-mailul de confirmare.')).toBeVisible();
    await expect.poll(async () => (await messagesFor(request, email)).length).toBe(2);

    await page.goto(managementLink!);
    await expect(page.getByText(notice)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retrimite e-mailul de confirmare' })).toBeEnabled();
    await capture(page, 'DS-pub-manage');

    const [message] = await messagesFor(request, email);
    const resentMail = await request.get(new URL(`/api/v1/message/${message.ID}`, mailpit).href);
    const resent = await resentMail.json() as { Text: string };
    const confirmationLink = resent.Text.match(/https?:\/\/\S+\/confirmare#token=[\w-]+/)?.[0];
    expect(confirmationLink).toBeDefined();
    const preview = await request.get(confirmationLink!);
    expect(preview.ok()).toBe(true);
    await page.reload();
    await expect(page.getByText(notice)).toBeVisible();
    await page.goto(confirmationLink!);
    await expect(page.getByText('Programare confirmată', { exact: true })).toBeVisible();
    await expect(page.getByText(notice)).toHaveCount(0);
    await expect(otherSlot).toBeDisabled();
    await capture(page, 'DS-pub-confirmation');
  } finally {
    await otherContext.close();
    if (managementToken) {
      const cancelled = await request.post('/api/appointments/by-token/cancel', { data: { token: managementToken } });
      expect(cancelled.ok()).toBe(true);
    }
  }
});
