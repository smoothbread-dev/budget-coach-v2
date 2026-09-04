const { test, expect } = require('@playwright/test');
const { openApp } = require('./helpers');

// openModal resolves only once the user answers, so the promise is parked on the page
// instead of being returned — returning it would stall page.evaluate until timeout.
async function showModal(page, options) {
  await page.evaluate((opts) => {
    window.__modalResult = 'PENDING';
    UI.openModal(opts).then((value) => {
      window.__modalResult = value;
    });
  }, options);
  await expect(page.locator('.modal')).toBeVisible();
}

const modalResult = (page) => page.evaluate(() => window.__modalResult);

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test.describe('escaping', () => {
  test('escapeHtml neutralises markup in user data', async ({ page }) => {
    const out = await page.evaluate(() => escapeHtml('<script>alert("x")</script>'));
    expect(out).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  });

  test('a hostile category name never becomes a live element', async ({ page }) => {
    const injected = await page.evaluate(() => {
      const host = document.createElement('div');
      host.innerHTML = escapeHtml('<img src=x onerror="window.__pwned=1">');
      document.body.appendChild(host);
      return { html: host.textContent, pwned: Boolean(window.__pwned), imgs: host.querySelectorAll('img').length };
    });
    expect(injected.imgs).toBe(0);
    expect(injected.pwned).toBe(false);
    expect(injected.html).toContain('<img');
  });

  test('el() sets text as textContent, never markup', async ({ page }) => {
    const count = await page.evaluate(() => {
      const node = el('span', { text: '<b>bold</b>' });
      return { tags: node.querySelectorAll('b').length, text: node.textContent };
    });
    expect(count.tags).toBe(0);
    expect(count.text).toBe('<b>bold</b>');
  });
});

test.describe('modal', () => {
  test('is announced as a dialog', async ({ page }) => {
    await showModal(page, { title: 'Hello', body: 'World' });
    const dialog = page.locator('.modal');
    await expect(dialog).toHaveAttribute('role', 'dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('.modal-title')).toHaveText('Hello');
  });

  test('Escape closes it and resolves null', async ({ page }) => {
    await showModal(page, { title: 'Close me' });
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal')).toHaveCount(0);
    expect(await modalResult(page)).toBeNull();
  });

  test('traps focus inside the dialog', async ({ page }) => {
    await showModal(page, {
      title: 'Trap',
      actions: [
        { label: 'Cancel', value: false },
        { label: 'Confirm', value: true },
      ],
    });

    const insideModal = () => page.evaluate(() => document.activeElement.closest('.modal') !== null);
    await page.keyboard.press('Tab');
    expect(await insideModal()).toBe(true);
    await page.keyboard.press('Tab');
    expect(await insideModal()).toBe(true);
    await page.keyboard.press('Shift+Tab');
    expect(await insideModal()).toBe(true);
  });

  test('confirm resolves true or false', async ({ page }) => {
    const yes = page.evaluate(() => UI.confirm('Delete it?'));
    await page.locator('.modal button', { hasText: 'Confirm' }).click();
    expect(await yes).toBe(true);

    const no = page.evaluate(() => UI.confirm('Delete it?'));
    await page.locator('.modal button', { hasText: 'Cancel' }).click();
    expect(await no).toBe(false);
  });

  test('restores focus to the element that opened it', async ({ page }) => {
    await page.locator('#sign-out').focus();
    await showModal(page, { title: 'Focus' });
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal')).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement.id)).toBe('sign-out');
  });
});

test.describe('toast and validation', () => {
  test('toast appears then clears itself', async ({ page }) => {
    await page.evaluate(() => UI.toast('Saved', 'success'));
    await expect(page.locator('.toast')).toHaveText('Saved');
    await expect(page.locator('.toast')).toHaveCount(0, { timeout: 4000 });
  });

  test('validate reports the first problem only', async ({ page }) => {
    const out = await page.evaluate(() => [
      UI.validate([{ value: '', label: 'Name', required: true }]),
      UI.validate([{ value: 'ok', label: 'Name', required: true }]),
      UI.validate([{ value: 150, label: 'Percent', max: 100 }]),
      UI.validate([{ value: -1, label: 'Amount', min: 0 }]),
      UI.validate([
        { value: '', label: 'First', required: true },
        { value: '', label: 'Second', required: true },
      ]),
    ]);
    expect(out).toEqual([
      'Name is required.',
      null,
      'Percent must be at most 100.',
      'Amount must be at least 0.',
      'First is required.',
    ]);
  });
});
