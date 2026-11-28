import { expect, test } from '@playwright/test';

test('selects the account type and submits only the corresponding form', async ({ page }) => {
  await page.route('**/api/client/account', route => route.fulfill({ status: 401, json: {} }));
  await page.route('**/api/client/register', route => route.fulfill({ json: {} }));
  await page.route('**/api/client/login', route => route.fulfill({
    status: 401, json: { message: 'Datele de acces client sunt incorecte.' },
  }));
  await page.route('**/api/staff/login', route => route.fulfill({
    status: 401, json: { message: 'Datele de acces personal sunt incorecte.' },
  }));

  await page.goto('/cont');
  const client = page.getByRole('tab', { name: 'Acces client' });
  const staff = page.getByRole('tab', { name: 'Acces personal' });
  const login = page.getByRole('tab', { name: 'Autentificare' });
  const register = page.getByRole('tab', { name: 'Creează cont nou' });
  await expect(client).toHaveAttribute('aria-selected', 'true');
  await expect(login).toHaveAttribute('aria-selected', 'true');

  await register.click();
  await page.getByLabel('Prenume', { exact: true }).fill('Test');
  await page.getByLabel('Nume', { exact: true }).fill('Client');
  await page.getByLabel('Telefon', { exact: true }).fill('0700000000');
  await page.getByLabel('E-mail', { exact: true }).fill('client@example.test');
  await page.getByLabel('Parolă').fill('parola-de-test');
  const registration = page.waitForRequest('**/api/client/register');
  await page.getByRole('button', { name: 'Creează cont', exact: true }).click();
  expect((await registration).method()).toBe('POST');
  await expect(page.getByRole('status')).toContainText('Ți-am trimis un e-mail');

  await client.press('ArrowRight');
  await expect(staff).toBeFocused();
  await expect(staff).toHaveAttribute('aria-selected', 'true');
  await expect(login).toHaveCount(0);
  await expect(register).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByLabel('Parolă')).toHaveValue('');
  await page.getByLabel('E-mail').fill('staff@example.test');
  await page.getByLabel('Parolă').fill('parola-de-test');
  const staffLogin = page.waitForRequest('**/api/staff/login');
  await page.getByRole('button', { name: 'Autentifică-te' }).click();
  expect((await staffLogin).method()).toBe('POST');
  await expect(page.getByRole('alert')).toHaveText('Datele de acces personal sunt incorecte.');

  await staff.press('Home');
  await expect(client).toBeFocused();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await login.click();
  await expect(page.getByLabel('Parolă')).toHaveValue('');
  await page.getByLabel('E-mail').fill('client@example.test');
  await page.getByLabel('Parolă').fill('parola-de-test');
  const clientLogin = page.waitForRequest('**/api/client/login');
  await page.getByRole('button', { name: 'Intră în cont' }).click();
  expect((await clientLogin).method()).toBe('POST');
  await expect(page.getByRole('alert')).toHaveText('Datele de acces client sunt incorecte.');
});
