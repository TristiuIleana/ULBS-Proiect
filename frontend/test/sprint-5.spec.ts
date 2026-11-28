import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

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
  test.setTimeout(90_000);
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
      const csv = await download;
      expect(csv.suggestedFilename()).toMatch(/^raport-beauty-studio-.*\.csv$/);
      expect(await readFile((await csv.path())!, 'utf8')).toContain('"Specialistă";"Ana"');
      await page.emulateMedia({ media: 'print' });
      await expect(page.getByRole('heading', { name: 'Rapoarte Admin' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Export CSV' })).toBeHidden();
      if (width === 1440 && colorScheme === 'light') {
        expect((await page.pdf()).toString('ascii', 0, 4)).toBe('%PDF');
      }
      await page.emulateMedia({ media: 'screen' });
      if (screens) {
        await page.getByLabel('Specialistă').selectOption('');
        await expect(page.getByRole('row', { name: /^Ioana/ })).toBeVisible();
        await page.screenshot({ path: join(screens, `DS-adm-reports.${colorScheme}${width === 390 ? '.mobile' : ''}.png`), fullPage: true });
      }
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

test('manages a service and converts its Waitlist offer from reception', async ({ browser, baseURL }) => {
  test.skip(!process.env.IOANA_SEED_PASSWORD, 'Requires the local Admin seed account and an isolated deployment.');
  test.setTimeout(90_000);
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bucharest' })
    .format(new Date(Date.now() + 15 * 86_400_000));
  const origin = { Origin: baseURL! };
  const name = `Serviciu Waitlist ${randomUUID().slice(0, 8)}`;
  const context = await browser.newContext({ baseURL, colorScheme: 'light', viewport: { width: 1440, height: 960 } });
  try {
    const page = await context.newPage();
    await page.goto('/staff/login');
    await page.getByLabel('E-mail').fill('ioana@admin.com');
    await page.getByLabel('Parolă').fill(process.env.IOANA_SEED_PASSWORD!);
    await page.getByRole('button', { name: 'Autentifică-te' }).click();
    await page.getByRole('link', { name: 'Servicii', exact: true }).click();
    await page.getByRole('button', { name: 'Adaugă serviciu', exact: true }).click();
    const editor = page.getByRole('dialog');
    await editor.getByLabel('Nume', { exact: true }).fill(name);
    await editor.getByLabel('Categorie').selectOption('MAKEUP');
    await editor.getByLabel('Preț (RON)').fill('99.50');
    await editor.getByLabel('Durată totală (minute)').fill('600');
    await expect(editor.getByRole('button', { name: 'Salvează serviciul' })).toBeDisabled();
    await editor.getByLabel('Minute', { exact: true }).fill('600');
    await editor.getByRole('button', { name: 'Salvează serviciul' }).click();
    const serviceCard = page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
    await expect(serviceCard).toBeVisible();
    await serviceCard.getByRole('button', { name: 'Dezactivează' }).click();
    await expect(serviceCard.getByText('Inactiv', { exact: true })).toBeVisible();
    expect((await (await page.request.get('/api/services')).json()).services).not.toContainEqual(expect.objectContaining({ name }));
    await serviceCard.getByRole('button', { name: 'Activează' }).click();
    await expect(serviceCard.getByText('Activ', { exact: true })).toBeVisible();
    const catalog = await (await page.request.get('/api/services')).json();
    const serviceId = catalog.services.find((service: { name: string }) => service.name === name).id;
    const specialistId = catalog.specialists.find((person: { category: string }) => person.category === 'MAKEUP').id;
    const query = { serviceId, specialistId, date };
    const availability = await page.request.get('/api/availability', { params: query });
    const { slots: [slot] } = await availability.json();
    const contact = { firstName: 'Clientă', lastName: 'Waitlist', phone: '0700000000',
      email: `${randomUUID()}@example.test` };
    const appointment = await page.request.post('/api/staff/reception/appointments', {
      headers: origin, data: { serviceId, specialistId, slotUtcMs: slot.utcMs, ...contact },
    });
    expect(appointment.status()).toBe(201);
    await page.goto('/');
    await page.getByRole('button', { name: /Make-up Machiaje/ }).click();
    await page.getByRole('radio', { name: new RegExp(name) }).check();
    await page.getByRole('button', { name: 'Zilele următoare' }).click();
    await page.getByRole('button', { name: 'Zilele următoare' }).click();
    const dayLabel = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', day: 'numeric', month: 'short' })
      .format(new Date(`${date}T12:00:00Z`));
    await page.getByRole('button', { name: new RegExp(dayLabel + '.*Complet Ocupat') }).click();
    const signup = page.getByRole('region', { name: 'Intră pe lista de așteptare' });
    if (screens) {
      for (const [theme, width] of [['light', 1440], ['light', 390], ['dark', 1440], ['dark', 390]] as const) {
        await page.setViewportSize({ width, height: 960 });
        await page.evaluate(value => {
          if (document.documentElement.dataset.theme !== value) document.querySelector<HTMLButtonElement>('.public-toolbar button')?.click();
        }, theme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await signup.screenshot({ path: join(screens, `DS-pub-waitlist.${theme}${width === 390 ? '.mobile' : ''}.png`) });
      }
      await page.setViewportSize({ width: 1440, height: 960 });
    }
    await signup.getByLabel('Prenume').fill(contact.firstName);
    await signup.getByLabel('Nume', { exact: true }).fill(contact.lastName);
    await signup.getByLabel('Telefon').fill(contact.phone);
    await signup.getByLabel('E-mail').fill(contact.email);
    const enrolled = page.waitForResponse(response => response.url().endsWith('/api/waitlist') && response.request().method() === 'POST');
    await signup.getByRole('button', { name: /Înscrie-mă pe lista de așteptare/ }).click();
    expect((await enrolled).status()).toBe(201);
    await expect(signup.getByText(/Te-ai înscris cu succes/)).toBeVisible();
    expect((await page.request.patch(`/api/staff/services/${serviceId}`, {
      headers: origin, data: { isActive: false },
    })).status()).toBe(409);
    const { id } = await appointment.json();
    expect((await page.request.post(`/api/staff/reception/appointments/${id}/cancel`, { headers: origin })).status()).toBe(200);

    await page.goto('/staff/receptie');
    await page.getByLabel('Data calendarului').fill(date);
    await page.getByRole('button', { name: 'Waitlist' }).click();
    const queue = page.getByRole('dialog');
    await expect(queue.getByRole('button', { name: 'Creează programare' })).toBeVisible();
    if (screens) {
      for (const [theme, width] of [['light', 1440], ['light', 390], ['dark', 1440], ['dark', 390]] as const) {
        await page.setViewportSize({ width, height: 960 });
        await page.evaluate(value => {
          if (document.documentElement.dataset.theme !== value) {
            document.querySelector<HTMLButtonElement>('.staff-toolbar button')?.click();
          }
        }, theme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await page.screenshot({ path: join(screens, `DS-adm-waitlist.${theme}${width === 390 ? '.mobile' : ''}.png`) });
      }
    }
    const conversion = page.waitForResponse(response => response.url().endsWith('/convert') && response.request().method() === 'POST');
    await queue.getByRole('button', { name: 'Creează programare' }).click();
    const converted = await conversion;
    expect(converted.status()).toBe(201);
    await expect(queue.getByText('Programarea a fost confirmată.')).toBeVisible();
    await expect(queue.getByText(/Revendicată/)).toBeVisible();
    await queue.getByRole('button', { name: 'Închide' }).click();
    await expect(page.getByRole('region', { name: 'Agenda Ana' }).getByText('Confirmată', { exact: true })).toBeVisible();
    if (screens) {
      for (const theme of ['light', 'dark']) {
        await page.setViewportSize({ width: 1440, height: 960 });
        if (await page.locator('html').getAttribute('data-theme') !== theme) {
          await page.locator('.staff-toolbar button').click();
        }
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await page.screenshot({ path: join(screens, `DS-adm-calendar.${theme}.png`) });
      }
    }
    const { id: convertedId } = await converted.json();
    await page.request.post(`/api/staff/reception/appointments/${convertedId}/cancel`, { headers: origin });
    await page.request.patch(`/api/staff/services/${serviceId}`, { headers: origin, data: { isActive: false } });
  } finally {
    await context.close();
  }
});
