const { test, expect } = require('@playwright/test');
const { openApp, readJson } = require('./helpers');

test.describe('store', () => {
  test('an upsert writes localStorage synchronously', async ({ page }) => {
    await openApp(page);
    const written = await page.evaluate(() => {
      Store.upsert('accounts', { id: 'a1', name: 'Bank' });
      // Read back in the same tick — persistence must not be deferred.
      return JSON.parse(localStorage.getItem('bcv2_cache')).accounts;
    });
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ id: 'a1', name: 'Bank' });
    expect(written[0].updated_at).toBeTruthy();
  });

  test('an upsert queues exactly one dirty entry', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => Store.upsert('accounts', { id: 'a1', name: 'Bank' }));
    expect(await readJson(page, 'dirty')).toEqual([{ table: 'accounts', id: 'a1', op: 'upsert' }]);
  });

  test('repeated edits to one row collapse into a single queued push', async ({ page }) => {
    await openApp(page);
    const queue = await page.evaluate(() => {
      Store.upsert('accounts', { id: 'a1', name: 'Bank' });
      Store.upsert('accounts', { id: 'a1', name: 'Maybank' });
      Store.upsert('accounts', { id: 'a1', name: 'Maybank Savings' });
      return Store.dirty;
    });
    expect(queue).toHaveLength(1);
    expect(await page.evaluate(() => Store.byId('accounts', 'a1').name)).toBe('Maybank Savings');
  });

  test('generates an id when none is supplied', async ({ page }) => {
    await openApp(page);
    const id = await page.evaluate(() => Store.upsert('accounts', { name: 'Cash' }).id);
    expect(id).toMatch(/[0-9a-f-]{8,}/);
  });

  test('remove deletes the row and queues a delete', async ({ page }) => {
    await openApp(page, { signedIn: false, cache: { accounts: [{ id: 'a1', name: 'Bank' }] } });
    const out = await page.evaluate(() => {
      const ok = Store.remove('accounts', 'a1');
      return { ok, rows: Store.all('accounts').length, dirty: Store.dirty };
    });
    expect(out.ok).toBe(true);
    expect(out.rows).toBe(0);
    expect(out.dirty).toEqual([{ table: 'accounts', id: 'a1', op: 'delete' }]);
  });

  test('removing a row that does not exist is a no-op', async ({ page }) => {
    await openApp(page);
    const out = await page.evaluate(() => ({ ok: Store.remove('accounts', 'nope'), dirty: Store.dirty.length }));
    expect(out).toEqual({ ok: false, dirty: 0 });
  });

  test('cache is restored on boot', async ({ page }) => {
    await openApp(page, {
      signedIn: false,
      cache: { accounts: [{ id: 'a1', name: 'Bank' }], categories: [{ id: 'c1', name: 'Food' }] },
    });
    const out = await page.evaluate(() => ({
      accounts: Store.all('accounts').length,
      categories: Store.all('categories').length,
    }));
    expect(out).toEqual({ accounts: 1, categories: 1 });
  });

  test('a corrupt cache falls back to empty instead of throwing', async ({ page }) => {
    await openApp(page, { storage: { cache: 'not json{{{' } });
    await expect(page.locator('body[data-booted="1"]')).toBeAttached();
    const out = await page.evaluate(() => ({ accounts: Store.all('accounts').length, tables: TABLES.length }));
    expect(out.accounts).toBe(0);
    expect(out.tables).toBeGreaterThan(0);
  });

  test('a cache holding the wrong shape is ignored per table', async ({ page }) => {
    await openApp(page, { signedIn: false, storage: { cache: { accounts: 'nope', categories: [{ id: 'c1' }] } } });
    const out = await page.evaluate(() => ({
      accounts: Store.all('accounts').length,
      categories: Store.all('categories').length,
    }));
    expect(out).toEqual({ accounts: 0, categories: 1 });
  });

  test('merge keeps local rows that have not been pushed yet', async ({ page }) => {
    await openApp(page);
    const out = await page.evaluate(() => {
      Store.upsert('accounts', { id: 'local', name: 'Unpushed' });
      Store.merge('accounts', [
        { id: 'local', name: 'Server version' },
        { id: 'remote', name: 'From server' },
      ]);
      return Store.all('accounts').map((r) => r.name).sort();
    });
    expect(out).toEqual(['From server', 'Unpushed']);
  });

  test('subscribers fire on every mutation', async ({ page }) => {
    await openApp(page);
    const calls = await page.evaluate(() => {
      let n = 0;
      const off = Store.subscribe(() => (n += 1));
      Store.upsert('accounts', { id: 'a1', name: 'Bank' });
      Store.remove('accounts', 'a1');
      off();
      Store.upsert('accounts', { id: 'a2', name: 'Cash' });
      return n;
    });
    expect(calls).toBe(2);
  });

  test('a throwing subscriber does not break the mutation', async ({ page }) => {
    await openApp(page);
    const rows = await page.evaluate(() => {
      Store.subscribe(() => {
        throw new Error('listener exploded');
      });
      Store.upsert('accounts', { id: 'a1', name: 'Bank' });
      return Store.all('accounts').length;
    });
    expect(rows).toBe(1);
  });
});
