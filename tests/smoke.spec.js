const { test, expect } = require('@playwright/test');
const { openApp, activeScreen } = require('./helpers');

test.describe('scaffold', () => {
  test('a signed-in boot lands on home with one active screen', async ({ page }) => {
    await openApp(page);
    expect(await activeScreen(page)).toBe('home-screen');
    expect(await page.locator('.screen.active').count()).toBe(1);
  });

  test('a signed-out boot lands on the auth screen', async ({ page }) => {
    await openApp(page, { signedIn: false });
    expect(await activeScreen(page)).toBe('auth-screen');
    await expect(page.locator('#app-title')).toHaveText('Budget Coach');
  });

  test('config constants are reachable from the page', async ({ page }) => {
    await openApp(page);
    expect(await page.evaluate(() => LS_PREFIX)).toBe('bcv2_');
    expect(await page.evaluate(() => CURRENCY.symbol)).toBe('RM');
    expect(await page.evaluate(() => Object.keys(ACCOUNT_TYPES))).toEqual([
      'cash', 'bank', 'ewallet', 'credit_card', 'loan_hp',
    ]);
  });

  test('credit card is spending-backed but the loan is not', async ({ page }) => {
    await openApp(page);
    expect(await page.evaluate(() => ACCOUNT_TYPES.credit_card.spendingBacked)).toBe(true);
    expect(await page.evaluate(() => ACCOUNT_TYPES.loan_hp.spendingBacked)).toBe(false);
  });

  test('localStorage seeding is namespaced', async ({ page }) => {
    await openApp(page, { storage: { smoke: { ok: true } } });
    const raw = await page.evaluate(() => localStorage.getItem('bcv2_smoke'));
    expect(JSON.parse(raw)).toEqual({ ok: true });
  });

  test('supabase calls are stubbed, never live', async ({ page }) => {
    await openApp(page, { tables: { accounts: [{ id: 'a1', name: 'Bank' }] } });
    const rows = await page.evaluate(async () => {
      const res = await fetch(SUPABASE_URL + '/rest/v1/accounts');
      return res.json();
    });
    expect(rows).toEqual([{ id: 'a1', name: 'Bank' }]);
  });
});
