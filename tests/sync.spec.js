const { test, expect } = require('@playwright/test');
const { openApp, stubSupabase, waitForHydration, readJson } = require('./helpers');

test.describe('local-first boot', () => {
  test('cached data is on screen before the network answers', async ({ page }) => {
    await openApp(page, {
      delayMs: 3000,
      cache: { accounts: [{ id: 'a1', name: 'Bank' }, { id: 'a2', name: 'Cash' }] },
    });

    // Booted, painted, and still waiting on the server.
    expect(await page.evaluate(() => Store.all('accounts').length)).toBe(2);
    await expect(page.locator('#home-counts')).toContainText('accounts');
    expect(await page.evaluate(() => document.body.dataset.hydrated)).toBeUndefined();
  });

  test('server rows arrive after hydration', async ({ page }) => {
    await openApp(page, { tables: { accounts: [{ id: 'srv', name: 'From server' }] } });
    await waitForHydration(page);
    expect(await page.evaluate(() => Store.all('accounts').map((r) => r.name))).toEqual(['From server']);
  });

  test('hydration failure leaves the cached data usable', async ({ page }) => {
    const rows = [{ id: 'a1', name: 'Bank' }];
    await openApp(page, { cache: { accounts: rows }, tables: { accounts: rows } });
    await waitForHydration(page);
    await page.unroute('**/rest/v1/**');
    await page.route('**/rest/v1/**', (route) => route.abort());
    const ok = await page.evaluate(() => Sync.hydrate());
    expect(ok).toBe(false);
    expect(await page.evaluate(() => Store.all('accounts').length)).toBe(1);
    expect(await page.evaluate(() => Sync.online)).toBe(false);
  });
});

test.describe('flush', () => {
  test('a successful flush empties the queue', async ({ page }) => {
    await openApp(page);
    await waitForHydration(page);
    const out = await page.evaluate(async () => {
      Store.upsert('accounts', { id: 'a1', name: 'Bank' });
      const ok = await Sync.flush();
      return { ok, pending: Sync.pendingCount() };
    });
    expect(out).toEqual({ ok: true, pending: 0 });
    expect(await readJson(page, 'dirty')).toEqual([]);
  });

  test('a failed flush keeps the work queued', async ({ page }) => {
    await openApp(page, { failWrites: true });
    const out = await page.evaluate(async () => {
      Store.upsert('accounts', { id: 'a1', name: 'Bank' });
      const ok = await Sync.flush();
      return { ok, pending: Sync.pendingCount(), online: Sync.online };
    });
    expect(out).toEqual({ ok: false, pending: 1, online: false });
    expect(await readJson(page, 'dirty')).toHaveLength(1);
  });

  test('queued work replays once the network recovers', async ({ page }) => {
    await openApp(page, { failWrites: true });
    await page.evaluate(async () => {
      Store.upsert('accounts', { id: 'a1', name: 'Bank' });
      Store.upsert('categories', { id: 'c1', name: 'Food' });
      await Sync.flush();
    });
    expect(await page.evaluate(() => Sync.pendingCount())).toBe(2);

    await page.unroute('**/rest/v1/**');
    await page.unroute('**/auth/v1/**');
    await stubSupabase(page);

    const out = await page.evaluate(async () => ({ ok: await Sync.flush(), pending: Sync.pendingCount() }));
    expect(out).toEqual({ ok: true, pending: 0 });
  });

  test('an edit made offline still reaches the server', async ({ page }) => {
    await openApp(page, { failWrites: true });
    await page.evaluate(async () => {
      Store.upsert('accounts', { id: 'offline-1', name: 'Made offline' });
      await Sync.flush();
    });

    await page.unroute('**/rest/v1/**');
    await page.unroute('**/auth/v1/**');
    const db = await stubSupabase(page);
    await page.evaluate(() => Sync.flush());

    expect(db.accounts.map((r) => r.name)).toEqual(['Made offline']);
  });

  test('a delete of a row that never synced is dropped safely', async ({ page }) => {
    await openApp(page);
    const out = await page.evaluate(async () => {
      Store.upsert('accounts', { id: 'ghost', name: 'Ghost' });
      Store.remove('accounts', 'ghost');
      const ok = await Sync.flush();
      return { ok, pending: Sync.pendingCount() };
    });
    expect(out).toEqual({ ok: true, pending: 0 });
  });

  test('nothing is pushed while signed out', async ({ page }) => {
    await openApp(page, { signedIn: false });
    const out = await page.evaluate(async () => {
      Store.upsert('accounts', { id: 'a1', name: 'Bank' });
      return { ok: await Sync.flush(), pending: Sync.pendingCount() };
    });
    expect(out).toEqual({ ok: true, pending: 1 });
  });
});

test.describe('sync status', () => {
  test('pending changes are surfaced to the user', async ({ page }) => {
    await openApp(page, { failWrites: true });
    await page.evaluate(async () => {
      Store.upsert('accounts', { id: 'a1', name: 'Bank' });
      await Sync.flush();
    });
    await expect(page.locator('#sync-status')).toHaveText('1 change waiting to sync');
  });

  test('a clean queue reports everything saved', async ({ page }) => {
    await openApp(page);
    await waitForHydration(page);
    await expect(page.locator('#sync-status')).toHaveText('All changes saved');
  });
});
