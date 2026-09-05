const { test, expect } = require('@playwright/test');
const { openApp } = require('./helpers');

test.describe('PWA', () => {
  test('manifest is served and valid', async ({ page }) => {
    const res = await page.goto('/manifest.json');
    expect(res.status()).toBe(200);
    const manifest = await res.json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#0f1115');
    expect(manifest.background_color).toBe('#0f1115');
    expect(manifest.icons).toHaveLength(2);
    expect(manifest.icons[0].sizes).toBe('192x192');
    expect(manifest.icons[1].sizes).toBe('512x512');
  });

  test('service worker registers', async ({ page }) => {
    await openApp(page);
    const hasActive = await page.evaluate(async () => {
      var reg = await navigator.serviceWorker.ready;
      return !!reg.active;
    });
    expect(hasActive).toBe(true);
  });

  test('app shell loads from cache offline', async ({ page, context }) => {
    await openApp(page);
    await page.evaluate(() => navigator.serviceWorker.ready);

    await context.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('#app')).toBeAttached();
  });

  test('supabase requests are never cached', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => navigator.serviceWorker.ready);

    const hasSupa = await page.evaluate(async () => {
      var cache = await caches.open('bc-shell-v1');
      var keys = await cache.keys();
      return keys.some(function (r) {
        return r.url.includes('/auth/v1/') || r.url.includes('/rest/v1/');
      });
    });
    expect(hasSupa).toBe(false);
  });
});
