const { test, expect } = require('@playwright/test');
const { openApp, readJson, waitForHydration } = require('./helpers');

test.describe('Accounts', () => {
  test('seeded accounts appear on first run', async ({ page }) => {
    await openApp(page);
    await waitForHydration(page);

    const accounts = await page.evaluate(() => Store.all('accounts'));
    expect(accounts).toHaveLength(3);

    const names = accounts.map((a) => a.name).sort();
    expect(names).toEqual(['Bank', 'Cash', 'E-Wallet']);
  });

  test('seeded accounts are not duplicated on second boot', async ({ page }) => {
    await openApp(page);
    await waitForHydration(page);

    const first = await page.evaluate(() => Store.all('accounts'));
    expect(first).toHaveLength(3);

    // Simulate second boot by reloading
    await page.reload();
    await expect(page.locator('body[data-booted="1"]')).toBeAttached();

    const second = await page.evaluate(() => Store.all('accounts'));
    expect(second).toHaveLength(3);
  });

  test('seeded accounts have correct types', async ({ page }) => {
    await openApp(page);
    const accounts = await page.evaluate(() => Store.all('accounts'));
    const byName = {};
    accounts.forEach((a) => { byName[a.name] = a; });

    expect(byName['Cash'].type).toBe('cash');
    expect(byName['Bank'].type).toBe('bank');
    expect(byName['E-Wallet'].type).toBe('ewallet');
  });

  test('create a new account', async ({ page }) => {
    await openApp(page);
    await page.click('[data-screen="accounts-screen"]');
    await expect(page.locator('#accounts-screen.active')).toBeAttached();

    await page.click('#accounts-add');
    await expect(page.locator('.modal')).toBeVisible();

    await page.fill('#new-account-name', 'Savings');
    await page.selectOption('#new-account-type', 'bank');
    await page.fill('#new-account-balance', '1000.00');

    await page.click('.modal-actions >> text=Create');
    await expect(page.locator('.modal')).not.toBeVisible();

    const accounts = await page.evaluate(() => Store.all('accounts'));
    const savings = accounts.find((a) => a.name === 'Savings');
    expect(savings).toBeTruthy();
    expect(savings.type).toBe('bank');
    expect(savings.opening_balance).toBe(100000);
    expect(savings.archived).toBe(false);
  });

  test('rename an account', async ({ page }) => {
    await openApp(page);
    await page.click('[data-screen="accounts-screen"]');

    const renameBtn = page.locator('button[aria-label^="Rename Cash"]');
    await renameBtn.click();
    await expect(page.locator('.modal')).toBeVisible();

    const nameInput = page.locator('.modal input[type="text"]');
    await nameInput.fill('Petty Cash');
    await page.click('.modal-actions >> text=Save');
    await expect(page.locator('.modal')).not.toBeVisible();

    const accounts = await page.evaluate(() => Store.all('accounts'));
    const renamed = accounts.find((a) => a.name === 'Petty Cash');
    expect(renamed).toBeTruthy();
    expect(accounts.find((a) => a.name === 'Cash')).toBeFalsy();
  });

  test('archive an account — hidden from list, transactions survive', async ({ page }) => {
    await openApp(page);

    // Add a transaction to the Cash account first
    const cashId = await page.evaluate(() => {
      const cash = Store.all('accounts').find((a) => a.name === 'Cash');
      Store.upsert('transactions', {
        account_id: cash.id,
        type: 'expense',
        amount: 500,
        own_share: 500,
        category_id: 'cat1',
        date: '2025-01-15',
      });
      return cash.id;
    });

    await page.click('[data-screen="accounts-screen"]');
    const archiveBtn = page.locator('button[aria-label^="Archive Cash"]');
    await archiveBtn.click();
    await expect(page.locator('.modal')).toBeVisible();
    await page.click('.modal-actions >> text=Archive');
    await expect(page.locator('.modal')).not.toBeVisible();

    // Cash should be hidden
    await expect(page.locator('.account-name >> text=Cash')).not.toBeVisible();

    // But the account and its transactions still exist in the store
    const state = await page.evaluate((id) => {
      const acct = Store.byId('accounts', id);
      const txns = Store.all('transactions').filter((t) => t.account_id === id);
      return { archived: acct.archived, txnCount: txns.length };
    }, cashId);
    expect(state.archived).toBe(true);
    expect(state.txnCount).toBe(1);
  });

  test('archived accounts appear when toggling show archived', async ({ page }) => {
    await openApp(page);

    // Archive one account
    await page.evaluate(() => {
      const cash = Store.all('accounts').find((a) => a.name === 'Cash');
      Store.upsert('accounts', { id: cash.id, archived: true });
    });

    await page.click('[data-screen="accounts-screen"]');
    await expect(page.locator('.account-name >> text=Cash')).not.toBeVisible();

    await page.click('#accounts-toggle-archived');
    await expect(page.locator('.account-name >> text=Cash')).toBeVisible();
  });

  test('balance reflects income, expense and transfers in both directions', async ({ page }) => {
    await openApp(page);

    const balance = await page.evaluate(() => {
      const acct = Store.all('accounts').find((a) => a.name === 'Bank');
      Store.upsert('accounts', { id: acct.id, opening_balance: 100000 });
      Store.upsert('transactions', {
        account_id: acct.id, type: 'income', amount: 500000,
        own_share: 500000, category_id: 'c1', date: '2025-01-01',
      });
      Store.upsert('transactions', {
        account_id: acct.id, type: 'expense', amount: 12000,
        own_share: 12000, category_id: 'c2', date: '2025-01-02',
      });
      Store.upsert('transactions', {
        account_id: acct.id, type: 'transfer_out', amount: 50000,
        own_share: 0, date: '2025-01-03',
      });
      Store.upsert('transactions', {
        account_id: acct.id, type: 'transfer_in', amount: 3000,
        own_share: 0, date: '2025-01-04',
      });
      return accountBalance(acct.id, Store.all('accounts'), Store.all('transactions'));
    });
    // 100000 + 500000 - 12000 - 50000 + 3000 = 541000
    expect(balance).toBe(541000);
  });

  test('balance is unaffected by own_share differing from amount', async ({ page }) => {
    await openApp(page);

    const result = await page.evaluate(() => {
      const acct = Store.all('accounts').find((a) => a.name === 'Bank');
      Store.upsert('accounts', { id: acct.id, opening_balance: 100000 });
      Store.upsert('transactions', {
        account_id: acct.id, type: 'expense', amount: 10000,
        own_share: 3000, category_id: 'c1', date: '2025-01-01',
      });
      return accountBalance(acct.id, Store.all('accounts'), Store.all('transactions'));
    });
    // Balance uses amount (10000 deducted), not own_share (3000)
    expect(result).toBe(90000);
  });

  test('accounts screen displays balance correctly', async ({ page }) => {
    await openApp(page);

    await page.evaluate(() => {
      const bank = Store.all('accounts').find((a) => a.name === 'Bank');
      Store.upsert('accounts', { id: bank.id, opening_balance: 250000 });
    });

    await page.click('[data-screen="accounts-screen"]');
    const bankRow = page.locator('.account-row', { has: page.locator('.account-name >> text=Bank') });
    const balanceText = await bankRow.locator('.account-balance').textContent();
    expect(balanceText).toContain('2,500.00');
  });

  test('opening balance persists to localStorage', async ({ page }) => {
    await openApp(page);

    await page.evaluate(() => {
      const bank = Store.all('accounts').find((a) => a.name === 'Bank');
      Store.upsert('accounts', { id: bank.id, opening_balance: 75000 });
    });

    const cached = await readJson(page, 'cache');
    const bank = cached.accounts.find((a) => a.name === 'Bank');
    expect(bank.opening_balance).toBe(75000);
  });

  test('restore an archived account', async ({ page }) => {
    await openApp(page);

    await page.evaluate(() => {
      const cash = Store.all('accounts').find((a) => a.name === 'Cash');
      Store.upsert('accounts', { id: cash.id, archived: true });
    });

    await page.click('[data-screen="accounts-screen"]');
    await page.click('#accounts-toggle-archived');

    const restoreBtn = page.locator('button[aria-label^="Restore Cash"]');
    await restoreBtn.click();

    const archived = await page.evaluate(() => {
      return Store.all('accounts').find((a) => a.name === 'Cash').archived;
    });
    expect(archived).toBe(false);
  });
});
