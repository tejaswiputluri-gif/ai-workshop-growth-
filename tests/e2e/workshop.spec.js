import { expect, test } from '@playwright/test';

async function completeRegistration(page, values) {
  await page.getByLabel('Full name').fill(values.name);
  await page.getByLabel('Email address').fill(values.email);
  await page.getByLabel('WhatsApp number').fill('9876543210');
  await page.getByLabel('College').fill('Example Engineering College');
  await page.getByLabel('Branch').selectOption('CSE (AI/ML)');
  await page.getByLabel('Graduation year').selectOption('2027');
  if (values.referral) await page.getByLabel('Referral code (optional)').fill(values.referral);
  await page.getByLabel(/I consent to being contacted/).check();
  await page.getByRole('button', { name: 'Register for free' }).click();
  await expect(page.getByText('REGISTRATION CONFIRMED')).toBeVisible();
}

test('student can register, share a referral link, and receive correct attribution', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Build Your First/ })).toBeVisible();
  await expect(page.getByLabel('Graduation year')).toHaveValue('2027');
  await expect(page.getByText('Date and time to be announced.')).toBeVisible();
  await completeRegistration(page, { name: 'Playwright Student', email: `playwright-${Date.now()}@example.test` });
  const code = await page.locator('.code-pill').textContent();
  expect(code).toMatch(/^[A-Z]{1,4}\d{6}$/);
  await expect(page.locator('.ref-progress')).toContainText('0/3 referrals');
  await expect(page.locator('.success-panel input[readonly]')).toHaveValue(new RegExp(`ref=${code}`));

  const secondPage = await page.context().newPage();
  await secondPage.goto(`/?ref=${code}&utm_source=ambassadors&utm_medium=student-group&utm_campaign=challenge`);
  await completeRegistration(secondPage, {
    name: 'Referred Student',
    email: `referred-${Date.now()}@example.test`,
    referral: code,
  });
  await expect(secondPage.locator('.ref-progress')).toContainText('0/3 referrals');
  await expect(page.locator('.ref-progress')).toContainText('1/3 referrals', { timeout: 15000 });
  const referralCount = await secondPage.evaluate(value =>
    fetch(`/api/me/${encodeURIComponent(value)}`).then(response => response.json()), code);
  expect(referralCount.referrals).toBe(1);
  const attribution = await secondPage.evaluate(() =>
    fetch('/api/admin/data', { headers: { 'X-Admin-Token': 'playwright-test-admin-token' } })
      .then(response => response.json()));
  expect(attribution.by_utm_source).toEqual({ ambassadors: 1 });
  expect(attribution.by_utm_medium).toEqual({ 'student-group': 1 });
  expect(attribution.by_utm_campaign).toEqual({ challenge: 1 });
});

test('public view exposes aggregates only; private dashboard requires its token', async ({ page }) => {
  await page.goto('/');
  const stats = await page.evaluate(() => fetch('/api/stats').then(response => response.json()));
  expect(stats.total).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(stats)).not.toContain('@example.test');
  const unauthenticated = await page.request.get('http://127.0.0.1:8000/api/admin/data');
  expect(unauthenticated.status()).toBe(401);

  await page.goto('/admin');
  await page.getByLabel('Admin token').fill('playwright-test-admin-token');
  await page.getByRole('button', { name: 'Load dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Growth dashboard.' })).toBeVisible();
  await expect(page.locator('.record-count')).toBeVisible();
});

test('registration page fits a 375px mobile viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Register for free' })).toBeVisible();
  await expect(page.getByText(/Free demo storage is temporary/)).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test('public navigation connects the agenda, registration, referral dashboard, and leaderboard pages', async ({ page }) => {
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(navigation.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');

  await navigation.getByRole('link', { name: 'Workshop Agenda' }).click();
  await expect(page).toHaveURL(/\/agenda$/);
  await expect(page.getByRole('heading', { name: /Workshop agenda/ })).toBeVisible();
  await expect(page.getByText('00–05')).toBeVisible();

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Register' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: /Register for free/ })).toBeVisible();
  await completeRegistration(page, { name: 'Dashboard Student', email: `dashboard-${Date.now()}@example.test` });
  await page.getByRole('link', { name: /Open your referral dashboard/ }).click();
  await expect(page).toHaveURL(/\/referrals$/);
  await expect(page.getByRole('heading', { name: /Referral dashboard/ })).toBeVisible();
  await expect(page.locator('.referral-total')).toHaveText('0');
  await expect(page.locator('#personal-referral-link')).toHaveValue(/ref=/);

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Leaderboard' }).click();
  await expect(page).toHaveURL(/\/leaderboard$/);
  await expect(page.getByRole('heading', { name: /Referral leaderboard/ })).toBeVisible();
  await expect(page.getByText(/colleges are not included in the public data/)).toBeVisible();
});
