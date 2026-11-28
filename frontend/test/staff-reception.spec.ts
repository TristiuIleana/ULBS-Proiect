import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
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

test('closes confirmed visits from Reception and Agenda and counts both outcomes in Reports', async ({ browser, baseURL }) => {
  const databaseUrl = process.env.BOOKING_E2E_DATABASE_URL;
  test.skip(!ioanaPassword || !anaPassword || !databaseUrl, 'Requires the seed accounts and isolated PostgreSQL.');
  test.setTimeout(60_000);
  const database = new URL(databaseUrl!);
  const psql = (sql: string) => execFileSync('psql', ['-XAt', '-v', 'ON_ERROR_STOP=1'], {
    env: { ...process.env, PGHOST: database.hostname, PGPORT: database.port || '5432',
      PGDATABASE: decodeURIComponent(database.pathname.slice(1)), PGUSER: decodeURIComponent(database.username),
      PGPASSWORD: decodeURIComponent(database.password) },
    input: sql, encoding: 'utf8',
  }).trim();
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const names = ids.map(id => `Vizita test ${id.slice(0, 8)}`);
  const offsets = ['-3 hours', '-2 hours', '2 hours'];
  const admin = await browser.newContext({ baseURL, colorScheme: 'light' });
  const employee = await browser.newContext({ baseURL, colorScheme: 'light' });
  try {
    const dates = psql(`
      WITH visits AS (
        INSERT INTO appointments (id, specialist_id, service_id, start_time, end_time, total_price_ron,
          guest_first_name, guest_last_name, guest_phone, status)
        SELECT cases.id::uuid, users.id, '00000000-0000-0000-0000-000000000004',
          now() + offset_time::interval, now() + offset_time::interval + interval '1 hour', 150,
          'Clienta', title, '0700000000', 'CONFIRMED'
        FROM (VALUES ${ids.map((id, i) => `('${id}', '${names[i]}', '${offsets[i]}')`).join(', ')}) AS cases(id, title, offset_time)
        CROSS JOIN users WHERE users.role = 'SPECIALIST' AND users.specialist_category = 'MAKEUP'
        RETURNING guest_last_name, start_time
      )
      SELECT string_agg(guest_last_name || '|' || to_char(start_time AT TIME ZONE 'Europe/Bucharest', 'YYYY-MM-DD'), E'\\n')
      FROM visits;
    `).split('\n');
    const dateFor = (name: string) => dates.find(row => row.startsWith(`${name}|`))!.split('|')[1];
    const adminPage = await admin.newPage();
    const employeePage = await employee.newPage();
    const assignments = [
      { page: adminPage, email: 'ioana@admin.com', password: ioanaPassword!, route: '/staff/receptie',
        screen: 'DS-adm-calendar', index: 0, action: 'Marchează finalizată', status: 'Finalizată' },
      { page: employeePage, email: 'ana@admin.com', password: anaPassword!, route: '/staff/agenda',
        screen: 'DS-emp-calendar', index: 1, action: 'Neprezentare', status: 'Neprezentare' },
    ];
    for (const { page, email, password, route } of assignments) {
      await page.goto('/staff/login');
      await page.getByLabel('E-mail').fill(email);
      await page.getByLabel('Parolă').fill(password);
      await page.getByRole('button', { name: 'Autentifică-te' }).click();
      await expect(page).toHaveURL(new RegExp(route + '$'));
    }
    async function counts() {
      const response = await adminPage.request.get('/api/staff/reports?period=quarter');
      expect(response.ok()).toBe(true);
      return (await response.json()).kpis as { completed: number; noShows: number };
    }
    const before = await counts();
    const future = employeePage.getByRole('button').filter({ hasText: names[2] });
    await employeePage.getByLabel('Data calendarului').fill(dateFor(names[2]));
    await future.click();
    const futureDialog = employeePage.getByRole('dialog');
    await expect(futureDialog.getByRole('button', { name: 'Marchează finalizată' })).toBeDisabled();
    await expect(futureDialog.getByRole('button', { name: 'Neprezentare' })).toBeDisabled();
    await futureDialog.getByRole('button', { name: 'Închide' }).click();

    for (const { page, screen, index, action, status } of assignments) {
      await page.getByLabel('Data calendarului').fill(dateFor(names[index]));
      const visit = page.getByRole('button').filter({ hasText: names[index] });
      await visit.click();
      const dialog = page.getByRole('dialog', { name: 'Detalii programare' });
      await expect(dialog.getByRole('button', { name: 'Marchează finalizată' })).toBeEnabled();
      await expect(dialog.getByRole('button', { name: 'Neprezentare' })).toBeEnabled();
      const attendanceScreens = process.env.ATTENDANCE_SCREENSHOT_DIR;
      if (attendanceScreens) {
        for (const [theme, width] of [['light', 1440], ['light', 390], ['dark', 1440], ['dark', 390]] as const) {
          await page.setViewportSize({ width, height: 960 });
          await page.emulateMedia({ colorScheme: theme });
          await page.evaluate(value => {
            if (document.documentElement.dataset.theme !== value) document.querySelector<HTMLButtonElement>('.staff-toolbar button')?.click();
          }, theme);
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await page.screenshot({ path: join(attendanceScreens, `${screen}.${theme}${width === 390 ? '.mobile' : ''}.png`) });
        }
      }
      await dialog.getByRole('button', { name: action, exact: true }).click();
      await expect(visit.getByText(status, { exact: true })).toBeVisible();
    }
    const after = await counts();
    expect(after.completed).toBe(before.completed + 1);
    expect(after.noShows).toBe(before.noShows + 1);
    const commonAction = `/api/staff/appointments/${ids[0]}/complete`;
    const adminReplay = await adminPage.request.post(commonAction, { headers: { Origin: baseURL! } });
    expect(adminReplay.status()).toBe(200);
    expect((await adminReplay.json()).status).toBe('COMPLETED');
  } finally {
    await Promise.all([admin.close(), employee.close()]);
    psql(`DELETE FROM appointments WHERE id IN (${ids.map(id => `'${id}'`).join(', ')});`);
  }
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
        await form.getByLabel(/^Serviciu/).selectOption({ label: 'Make-up ocazie (fără gene)' });
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
