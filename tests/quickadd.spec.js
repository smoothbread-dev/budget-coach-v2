const { test, expect } = require('@playwright/test');
const { openApp, readJson, activeScreen, readStorage } = require('./helpers');

const ACCOUNTS = [
  { id: 'acc-cash', name: 'Cash', type: 'Cash', opening_balance: 100000, archived: false },
  { id: 'acc-bank', name: 'Bank', type: 'Bank', opening_balance: 500000, archived: false },
];
const CATEGORIES = [
  { id: 'cat-food', name: 'Food', kind: 'variable', parent_id: null, archived: false, sort: 0 },
  { id: 'cat-rent', name: 'Rent', kind: 'fixed', parent_id: null, archived: false, sort: 0 },
  { id: 'cat-wifi', name: 'Wifi', kind: 'fixed', parent_id: null, archived: false, sort: 0 },
];

function seedWithCategories(extraTxns) {
  var txns = extraTxns || [];
  return {
    tables: { accounts: ACCOUNTS, categories: CATEGORIES, transactions: txns },
    cache: {
      accounts: ACCOUNTS,
      categories: CATEGORIES,
      transactions: txns,
    },
  };
}

async function openQuickAdd(page, opts) {
  await openApp(page, opts || seedWithCategories());
  await page.click('#home-quickadd');
  await expect(page.locator('#quickadd-screen.active')).toBeAttached();
}

test.describe('Quick-add', () => {
  test('expense logged in 3 taps', async ({ page }) => {
    await openQuickAdd(page);

    await page.click('.keypad-btn[data-key="5"]');
    await page.click('.chip >> text=Food');
    await page.click('#quickadd-save');

    const txns = await page.evaluate(() => Store.all('transactions'));
    expect(txns).toHaveLength(1);
    expect(txns[0].type).toBe('expense');
    expect(txns[0].amount).toBe(500);
    expect(txns[0].own_share).toBe(500);
    expect(txns[0].category_id).toBe('cat-food');
    expect(txns[0].payer).toBe('me');
  });

  test('save-to-close completes under 5 seconds', async ({ page }) => {
    await openQuickAdd(page);

    const start = Date.now();
    await page.click('.keypad-btn[data-key="1"]');
    await page.click('.keypad-btn[data-key="2"]');
    await page.click('.chip >> text=Rent');
    await page.click('#quickadd-save');
    await expect(page.locator('#home-screen.active')).toBeAttached();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000);
  });

  test('chips ordered by recency then frequency', async ({ page }) => {
    const txns = [
      { id: 't1', category_id: 'cat-wifi', date: '2026-09-01', type: 'expense', amount: 100, own_share: 100, account_id: 'acc-cash' },
      { id: 't2', category_id: 'cat-food', date: '2026-09-03', type: 'expense', amount: 200, own_share: 200, account_id: 'acc-cash' },
    ];
    await openQuickAdd(page, seedWithCategories(txns));

    const chips = await page.$$eval('#quickadd-chips .chip', els => els.map(e => e.textContent));
    expect(chips[0]).toBe('Food');
    expect(chips[1]).toBe('Wifi');
  });

  test('account defaults to last used and is overridable', async ({ page }) => {
    const opts = seedWithCategories();
    opts.storage = { last_account: 'acc-bank' };
    await openQuickAdd(page, { ...opts, storage: { last_account: 'acc-bank' } });

    const selected = await page.$eval('#quickadd-account', el => el.value);
    expect(selected).toBe('acc-bank');

    await page.selectOption('#quickadd-account', 'acc-cash');
    await page.click('.keypad-btn[data-key="1"]');
    await page.click('.chip >> text=Food');
    await page.click('#quickadd-save');

    const lastAccount = await readStorage(page, 'last_account');
    expect(lastAccount).toBe('acc-cash');
  });

  test('save refused with no category', async ({ page }) => {
    await openQuickAdd(page);

    await page.click('.keypad-btn[data-key="5"]');
    await page.click('#quickadd-save');

    const error = page.locator('#quickadd-error');
    await expect(error).not.toBeHidden();
    await expect(error).toHaveText('Pick a category.');

    const txns = await page.evaluate(() => Store.all('transactions'));
    expect(txns).toHaveLength(0);
  });

  test('save refused with zero amount', async ({ page }) => {
    await openQuickAdd(page);

    await page.click('.chip >> text=Food');
    await page.click('#quickadd-save');

    const error = page.locator('#quickadd-error');
    await expect(error).not.toBeHidden();
    await expect(error).toHaveText('Enter an amount.');
  });

  test('entry appears in store before network response', async ({ page }) => {
    await openQuickAdd(page);

    await page.click('.keypad-btn[data-key="7"]');
    await page.click('.chip >> text=Food');
    await page.click('#quickadd-save');

    const txns = await page.evaluate(() => Store.all('transactions'));
    expect(txns).toHaveLength(1);
    expect(txns[0].amount).toBe(700);
  });

  test('income increases balance, expense decreases it', async ({ page }) => {
    await openQuickAdd(page);

    await page.click('.keypad-btn[data-key="1"]');
    await page.click('.keypad-btn[data-key="0"]');
    await page.click('.chip >> text=Food');
    await page.click('#quickadd-save');

    await page.click('#home-quickadd');
    await page.click('#quickadd-type-income');
    await page.click('.keypad-btn[data-key="2"]');
    await page.click('.keypad-btn[data-key="0"]');
    await page.click('.chip >> text=Food');
    await page.click('#quickadd-save');

    const txns = await page.evaluate(() => Store.all('transactions'));
    expect(txns).toHaveLength(2);
    expect(txns[0].type).toBe('expense');
    expect(txns[0].amount).toBe(1000);
    expect(txns[1].type).toBe('income');
    expect(txns[1].amount).toBe(2000);

    const balance = await page.evaluate(() =>
      accountBalance('acc-cash', Store.all('accounts'), Store.all('transactions'))
    );
    expect(balance).toBe(100000 - 1000 + 2000);
  });

  test('note field hidden by default, toggles visible', async ({ page }) => {
    await openQuickAdd(page);

    await expect(page.locator('#quickadd-note-row')).toBeHidden();
    await page.click('#quickadd-note-toggle');
    await expect(page.locator('#quickadd-note-row')).not.toBeHidden();
  });

  test('note is saved with the transaction', async ({ page }) => {
    await openQuickAdd(page);

    await page.click('.keypad-btn[data-key="5"]');
    await page.click('.chip >> text=Food');
    await page.click('#quickadd-note-toggle');
    await page.fill('#quickadd-note', 'Lunch with friends');
    await page.click('#quickadd-save');

    const txns = await page.evaluate(() => Store.all('transactions'));
    expect(txns[0].note).toBe('Lunch with friends');
  });

  test('navigates back to home on save', async ({ page }) => {
    await openQuickAdd(page);

    await page.click('.keypad-btn[data-key="1"]');
    await page.click('.chip >> text=Food');
    await page.click('#quickadd-save');

    expect(await activeScreen(page)).toBe('home-screen');
  });
});
