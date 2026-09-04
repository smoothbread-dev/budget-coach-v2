const { test, expect } = require('@playwright/test');
const { openApp, activeScreen, readJson, signIn } = require('./helpers');

test.describe('sign in', () => {
  test('a stored session skips the sign-in wall', async ({ page }) => {
    await openApp(page);
    expect(await activeScreen(page)).toBe('home-screen');
    expect(await page.evaluate(() => Auth.isSignedIn())).toBe(true);
    await expect(page.locator('#home-email')).toHaveText('test@example.com');
  });

  test('no session lands on the auth screen', async ({ page }) => {
    await openApp(page, { signedIn: false });
    expect(await activeScreen(page)).toBe('auth-screen');
    expect(await page.evaluate(() => Auth.isSignedIn())).toBe(false);
  });

  test('signing in stores the session and moves to home', async ({ page }) => {
    await openApp(page, { signedIn: false });
    await page.fill('#auth-email', 'test@example.com');
    await page.fill('#auth-password', 'hunter2hunter2');
    await page.click('#auth-submit');

    await expect(page.locator('#home-screen')).toHaveClass(/active/);
    const session = await readJson(page, 'session');
    expect(session.access_token).toBe('test-access-token');
  });

  test('bad credentials show an error and stay put', async ({ page }) => {
    await openApp(page, { signedIn: false, failAuth: true });
    await page.fill('#auth-email', 'test@example.com');
    await page.fill('#auth-password', 'wrong');
    await page.click('#auth-submit');

    await expect(page.locator('#auth-error')).toBeVisible();
    await expect(page.locator('#auth-error')).toContainText('Invalid login credentials');
    expect(await activeScreen(page)).toBe('auth-screen');
    expect(await readJson(page, 'session')).toBeNull();
  });

  test('missing fields are caught before any request', async ({ page }) => {
    await openApp(page, { signedIn: false });
    let requests = 0;
    page.on('request', (r) => {
      if (r.url().includes('/auth/v1/token')) requests += 1;
    });
    await page.click('#auth-submit');
    await expect(page.locator('#auth-error')).toContainText('Email is required.');
    expect(requests).toBe(0);
  });
});

test.describe('unconfigured build', () => {
  test('explains itself instead of leaking a fetch error', async ({ page }) => {
    await openApp(page, { signedIn: false });
    await page.evaluate(() => {
      SUPABASE_URL = 'SUPABASE_URL_PLACEHOLDER';
      SUPABASE_KEY = 'SUPABASE_KEY_PLACEHOLDER';
    });

    let requests = 0;
    page.on('request', (r) => {
      if (r.url().includes('/auth/v1/')) requests += 1;
    });

    await page.fill('#auth-email', 'someone@example.com');
    await page.fill('#auth-password', 'hunter2hunter2');
    await page.click('#auth-submit');

    await expect(page.locator('#auth-error')).toContainText('no Supabase project attached');
    await expect(page.locator('#auth-error')).not.toContainText('Failed to fetch');
    expect(requests).toBe(0);
  });

  test('a configured build shows no setup notice', async ({ page }) => {
    await openApp(page, { signedIn: false });
    await expect(page.locator('#config-notice')).toBeHidden();
    expect(await page.evaluate(() => isSupabaseConfigured())).toBe(true);
  });
});

test.describe('sign up', () => {
  test('toggling swaps the form between modes', async ({ page }) => {
    await openApp(page, { signedIn: false });
    await expect(page.locator('#auth-submit')).toHaveText('Sign in');
    await page.click('#auth-toggle');
    await expect(page.locator('#auth-submit')).toHaveText('Create account');
    await expect(page.locator('#auth-title')).toHaveText('Create your account');
    await page.click('#auth-toggle');
    await expect(page.locator('#auth-submit')).toHaveText('Sign in');
  });
});

test.describe('sign out', () => {
  test('asks first, then clears the session and local data', async ({ page }) => {
    await openApp(page, { cache: { accounts: [{ id: 'a1', name: 'Bank' }] } });
    await page.click('#sign-out');
    await page.locator('.modal button', { hasText: 'Sign out' }).click();

    await expect(page.locator('#auth-screen')).toHaveClass(/active/);
    expect(await readJson(page, 'session')).toBeNull();
    expect(await page.evaluate(() => Store.all('accounts').length)).toBe(0);
    expect(await readJson(page, 'cache')).toBeNull();
  });

  test('cancelling keeps you signed in', async ({ page }) => {
    await openApp(page);
    await page.click('#sign-out');
    await page.locator('.modal button', { hasText: 'Cancel' }).click();

    expect(await activeScreen(page)).toBe('home-screen');
    expect(await page.evaluate(() => Auth.isSignedIn())).toBe(true);
  });
});

test.describe('session', () => {
  test('exposes the user id used to scope every row', async ({ page }) => {
    await openApp(page);
    expect(await page.evaluate(() => Auth.userId())).toBe('test-user-0000-0000-0000-000000000000');
  });

  test('a corrupt session is treated as signed out', async ({ page }) => {
    await openApp(page, { storage: { session: 'garbage{{' } });
    expect(await page.evaluate(() => Auth.isSignedIn())).toBe(false);
    expect(await activeScreen(page)).toBe('auth-screen');
  });

  test('password reset requests do not throw', async ({ page }) => {
    await openApp(page, { signedIn: false });
    await page.fill('#auth-email', 'test@example.com');
    await page.click('#auth-reset');
    await expect(page.locator('.toast')).toHaveText('Password reset email sent');
  });

  test('reset without an email asks for one', async ({ page }) => {
    await openApp(page, { signedIn: false });
    await page.click('#auth-reset');
    await expect(page.locator('#auth-error')).toContainText('Enter your email first.');
  });

  test('programmatic sign in works for later specs', async ({ page }) => {
    await openApp(page, { signedIn: false });
    await signIn(page);
    expect(await page.evaluate(() => Auth.isSignedIn())).toBe(true);
  });
});
