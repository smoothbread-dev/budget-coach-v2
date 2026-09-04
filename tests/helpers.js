// Shared Playwright helpers. Tests must never touch the network or a real Supabase project.
const { expect } = require('@playwright/test');

const LS_PREFIX = 'bcv2_';

const SESSION = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: 'test-user-0000-0000-0000-000000000000', email: 'test@example.com' },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Intercepts every Supabase call so the suite runs fully offline and deterministically.
 *   tables     seeds the fake REST backend, e.g. { accounts: [...] }
 *   delayMs    stalls REST reads, to prove the UI paints from cache first
 *   failWrites rejects POST/DELETE, to prove the dirty queue survives
 *   failAuth   rejects sign in / sign up
 */
async function stubSupabase(page, { tables = {}, delayMs = 0, failWrites = false, failAuth = false } = {}) {
  const db = JSON.parse(JSON.stringify(tables));

  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/logout')) return route.fulfill({ status: 204, body: '' });
    if (failAuth) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error_description: 'Invalid login credentials' }),
      });
    }
    if (url.includes('/recover')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(url.includes('/user') ? SESSION.user : SESSION),
    });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const table = new URL(request.url()).pathname.split('/rest/v1/')[1]?.split('?')[0];
    const method = request.method();

    if (!db[table]) db[table] = [];

    if (method === 'GET') {
      if (delayMs) await sleep(delayMs);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(db[table]),
      });
    }

    if (failWrites) return route.fulfill({ status: 500, body: 'boom' });

    if (method === 'POST' || method === 'PATCH') {
      const rows = [].concat(request.postDataJSON() ?? []);
      rows.forEach((row) => {
        const i = db[table].findIndex((r) => r.id === row.id);
        if (i >= 0) db[table][i] = { ...db[table][i], ...row };
        else db[table].push(row);
      });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rows),
      });
    }

    if (method === 'DELETE') {
      const id = new URL(request.url()).searchParams.get('id')?.replace('eq.', '');
      db[table] = db[table].filter((r) => r.id !== id);
      return route.fulfill({ status: 204, body: '' });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  return db;
}

/**
 * Boots the app with localStorage pre-seeded, so tests can start from any state
 * without clicking through the UI to build it.
 */
async function openApp(page, options = {}) {
  const { storage = {}, signedIn = true, cache = null, dirty = null, waitForBoot = true } = options;
  await stubSupabase(page, options);

  const seed = { ...storage };
  if (signedIn && seed.session === undefined) seed.session = SESSION;
  if (cache) seed.cache = cache;
  if (dirty) seed.dirty = dirty;

  await page.addInitScript(
    ([prefix, values, config]) => {
      window.__BC_CONFIG__ = config;
      localStorage.clear();
      Object.entries(values).forEach(([key, value]) => {
        localStorage.setItem(prefix + key, typeof value === 'string' ? value : JSON.stringify(value));
      });
    },
    [LS_PREFIX, seed, { url: 'https://test.supabase.co', key: 'test-anon-key' }]
  );

  await page.goto('/');
  if (waitForBoot) await expect(page.locator('body[data-booted="1"]')).toBeAttached();
}

function waitForHydration(page) {
  return expect(page.locator('body[data-hydrated]')).toBeAttached();
}

function readStorage(page, key) {
  return page.evaluate((k) => localStorage.getItem(k), LS_PREFIX + key);
}

async function readJson(page, key) {
  const raw = await readStorage(page, key);
  return raw ? JSON.parse(raw) : null;
}

function activeScreen(page) {
  return page.evaluate(() => document.querySelector('.screen.active')?.id ?? null);
}

function signIn(page, email = 'test@example.com', password = 'hunter2hunter2') {
  return page.evaluate(([e, p]) => Auth.signIn(e, p), [email, password]);
}

module.exports = {
  LS_PREFIX,
  SESSION,
  stubSupabase,
  openApp,
  waitForHydration,
  readStorage,
  readJson,
  activeScreen,
  signIn,
};
