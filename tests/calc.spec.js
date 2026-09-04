const { test, expect } = require('@playwright/test');
const { openApp, waitForHydration } = require('./helpers');

test.describe('calc — accountBalance', () => {
  test('returns 0 for unknown account', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => accountBalance('no-such-id', [], []));
    expect(result).toBe(0);
  });

  test('returns opening balance when no transactions exist', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => {
      const accounts = [{ id: 'a1', opening_balance: 50000 }];
      return accountBalance('a1', accounts, []);
    });
    expect(result).toBe(50000);
  });

  test('income increases balance', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => {
      const accounts = [{ id: 'a1', opening_balance: 10000 }];
      const txns = [{ account_id: 'a1', type: 'income', amount: 5000 }];
      return accountBalance('a1', accounts, txns);
    });
    expect(result).toBe(15000);
  });

  test('expense decreases balance', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => {
      const accounts = [{ id: 'a1', opening_balance: 10000 }];
      const txns = [{ account_id: 'a1', type: 'expense', amount: 3000 }];
      return accountBalance('a1', accounts, txns);
    });
    expect(result).toBe(7000);
  });

  test('transfer_in increases, transfer_out decreases', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => {
      const accounts = [
        { id: 'a1', opening_balance: 20000 },
        { id: 'a2', opening_balance: 5000 },
      ];
      const txns = [
        { account_id: 'a1', type: 'transfer_out', amount: 8000 },
        { account_id: 'a2', type: 'transfer_in', amount: 8000 },
      ];
      return {
        a1: accountBalance('a1', accounts, txns),
        a2: accountBalance('a2', accounts, txns),
      };
    });
    expect(result.a1).toBe(12000);
    expect(result.a2).toBe(13000);
  });

  test('balance reflects income, expense and transfers combined', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => {
      const accounts = [{ id: 'a1', opening_balance: 100000 }];
      const txns = [
        { account_id: 'a1', type: 'income', amount: 500000 },
        { account_id: 'a1', type: 'expense', amount: 12000 },
        { account_id: 'a1', type: 'expense', amount: 8000 },
        { account_id: 'a1', type: 'transfer_out', amount: 50000 },
        { account_id: 'a1', type: 'transfer_in', amount: 3000 },
      ];
      return accountBalance('a1', accounts, txns);
    });
    // 100000 + 500000 - 12000 - 8000 - 50000 + 3000 = 533000
    expect(result).toBe(533000);
  });

  test('ignores transactions for other accounts', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => {
      const accounts = [
        { id: 'a1', opening_balance: 10000 },
        { id: 'a2', opening_balance: 5000 },
      ];
      const txns = [
        { account_id: 'a2', type: 'expense', amount: 3000 },
      ];
      return accountBalance('a1', accounts, txns);
    });
    expect(result).toBe(10000);
  });

  test('balance uses amount, not own_share', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => {
      const accounts = [{ id: 'a1', opening_balance: 100000 }];
      const txns = [
        { account_id: 'a1', type: 'expense', amount: 10000, own_share: 3000 },
      ];
      return accountBalance('a1', accounts, txns);
    });
    // Balance uses amount (10000), not own_share (3000)
    expect(result).toBe(90000);
  });

  test('defaults opening_balance to 0 when missing', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => {
      const accounts = [{ id: 'a1' }];
      const txns = [{ account_id: 'a1', type: 'income', amount: 5000 }];
      return accountBalance('a1', accounts, txns);
    });
    expect(result).toBe(5000);
  });
});
