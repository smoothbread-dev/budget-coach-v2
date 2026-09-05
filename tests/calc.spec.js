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

test.describe('calc — categoryTree', () => {
  test('groups children under their parent', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => {
      const cats = [
        { id: 'p1', name: 'Food', kind: 'variable', parent_id: null },
        { id: 'c1', name: 'Groceries', kind: 'variable', parent_id: 'p1' },
        { id: 'c2', name: 'Eating out', kind: 'variable', parent_id: 'p1' },
      ];
      const tree = categoryTree(cats);
      return { roots: tree.length, children: tree[0].children.length, names: tree[0].children.map(c => c.name).sort() };
    });
    expect(result.roots).toBe(1);
    expect(result.children).toBe(2);
    expect(result.names).toEqual(['Eating out', 'Groceries']);
  });

  test('top-level with no children has empty children array', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => {
      const cats = [{ id: 'p1', name: 'Rent', kind: 'fixed', parent_id: null }];
      return categoryTree(cats)[0].children;
    });
    expect(result).toEqual([]);
  });

  test('orphaned parent_id is treated as top-level', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => {
      const cats = [
        { id: 'c1', name: 'Orphan', kind: 'variable', parent_id: 'gone' },
        { id: 'p1', name: 'Food', kind: 'variable', parent_id: null },
      ];
      return categoryTree(cats).map(n => n.name).sort();
    });
    expect(result).toEqual(['Food', 'Orphan']);
  });

  test('roots are sorted by name', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => {
      const cats = [
        { id: '1', name: 'Wifi', kind: 'fixed', parent_id: null },
        { id: '2', name: 'Food', kind: 'variable', parent_id: null },
        { id: '3', name: 'Rent', kind: 'fixed', parent_id: null },
      ];
      return categoryTree(cats).map(n => n.name);
    });
    expect(result).toEqual(['Food', 'Rent', 'Wifi']);
  });
});

test.describe('calc — leafCategories', () => {
  test('returns categories with no children', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => {
      const cats = [
        { id: 'p1', name: 'Food', kind: 'variable', parent_id: null },
        { id: 'c1', name: 'Groceries', kind: 'variable', parent_id: 'p1' },
        { id: 'p2', name: 'Rent', kind: 'fixed', parent_id: null },
      ];
      return leafCategories(cats).map(c => c.name).sort();
    });
    expect(result).toEqual(['Groceries', 'Rent']);
  });

  test('a parent with children is excluded', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => {
      const cats = [
        { id: 'p1', name: 'Food', parent_id: null },
        { id: 'c1', name: 'Groceries', parent_id: 'p1' },
      ];
      return leafCategories(cats).map(c => c.name);
    });
    expect(result).toEqual(['Groceries']);
  });
});

test.describe('calc — categoryChipOrder', () => {
  test('recently used categories appear first', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => {
      const cats = [
        { id: 'c1', name: 'Food', parent_id: null },
        { id: 'c2', name: 'Rent', parent_id: null },
        { id: 'c3', name: 'Wifi', parent_id: null },
      ];
      const txns = [
        { category_id: 'c2', date: '2026-09-01' },
        { category_id: 'c1', date: '2026-09-03' },
      ];
      return categoryChipOrder(cats, txns).map(c => c.name);
    });
    expect(result[0]).toBe('Food');
    expect(result[1]).toBe('Rent');
  });

  test('higher frequency breaks ties when recency is equal', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => {
      const cats = [
        { id: 'c1', name: 'Alpha', parent_id: null },
        { id: 'c2', name: 'Beta', parent_id: null },
      ];
      const txns = [
        { category_id: 'c1', date: '2026-09-01' },
        { category_id: 'c2', date: '2026-09-01' },
        { category_id: 'c2', date: '2026-09-01' },
      ];
      return categoryChipOrder(cats, txns).map(c => c.name);
    });
    expect(result[0]).toBe('Beta');
    expect(result[1]).toBe('Alpha');
  });

  test('never-used categories appear last, alphabetically', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => {
      const cats = [
        { id: 'c1', name: 'Wifi', parent_id: null },
        { id: 'c2', name: 'Food', parent_id: null },
        { id: 'c3', name: 'Rent', parent_id: null },
      ];
      return categoryChipOrder(cats, []).map(c => c.name);
    });
    expect(result).toEqual(['Food', 'Rent', 'Wifi']);
  });

  test('archived categories are excluded', async ({ page }) => {
    await openApp(page);
    const result = await page.evaluate(() => {
      const cats = [
        { id: 'c1', name: 'Food', parent_id: null, archived: false },
        { id: 'c2', name: 'Old', parent_id: null, archived: true },
      ];
      return categoryChipOrder(cats, []).map(c => c.name);
    });
    expect(result).toEqual(['Food']);
  });
});
