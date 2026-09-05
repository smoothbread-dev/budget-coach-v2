const { test, expect } = require('@playwright/test');
const { openApp, readJson, waitForHydration } = require('./helpers');

test.describe('Categories', () => {
  test('seeded categories appear on first run', async ({ page }) => {
    await openApp(page);
    await waitForHydration(page);

    const categories = await page.evaluate(() => Store.all('categories'));
    expect(categories).toHaveLength(5);

    const names = categories.map((c) => c.name).sort();
    expect(names).toEqual(['Food', 'Mobile Data', 'Rent', 'Therapy', 'Wifi']);
  });

  test('seeded categories are not duplicated on second boot', async ({ page }) => {
    await openApp(page);
    await waitForHydration(page);

    const first = await page.evaluate(() => Store.all('categories'));
    expect(first).toHaveLength(5);

    await page.reload();
    await expect(page.locator('body[data-booted="1"]')).toBeAttached();

    const second = await page.evaluate(() => Store.all('categories'));
    expect(second).toHaveLength(5);
  });

  test('seeded categories have correct kinds', async ({ page }) => {
    await openApp(page);
    const categories = await page.evaluate(() => Store.all('categories'));
    const byName = {};
    categories.forEach((c) => { byName[c.name] = c; });

    expect(byName['Food'].kind).toBe('variable');
    expect(byName['Rent'].kind).toBe('fixed');
    expect(byName['Therapy'].kind).toBe('fixed');
    expect(byName['Wifi'].kind).toBe('fixed');
    expect(byName['Mobile Data'].kind).toBe('fixed');
  });

  test('create a new category', async ({ page }) => {
    await openApp(page);
    await page.click('[data-screen="categories-screen"]');
    await expect(page.locator('#categories-screen.active')).toBeAttached();

    await page.click('#categories-add');
    await expect(page.locator('.modal')).toBeVisible();

    await page.fill('#new-category-name', 'Transport');
    await page.selectOption('#new-category-kind', 'variable');

    await page.click('.modal-actions >> text=Create');
    await expect(page.locator('.modal')).not.toBeVisible();

    const categories = await page.evaluate(() => Store.all('categories'));
    const transport = categories.find((c) => c.name === 'Transport');
    expect(transport).toBeTruthy();
    expect(transport.kind).toBe('variable');
    expect(transport.parent_id).toBeNull();
    expect(transport.archived).toBe(false);
  });

  test('create a subcategory nested under a parent', async ({ page }) => {
    await openApp(page);
    await page.click('[data-screen="categories-screen"]');

    await page.click('#categories-add');
    await expect(page.locator('.modal')).toBeVisible();

    const foodId = await page.evaluate(() => {
      return Store.all('categories').find((c) => c.name === 'Food').id;
    });

    await page.fill('#new-category-name', 'Groceries');
    await page.selectOption('#new-category-parent', foodId);

    await page.click('.modal-actions >> text=Create');
    await expect(page.locator('.modal')).not.toBeVisible();

    const sub = await page.evaluate(() => {
      return Store.all('categories').find((c) => c.name === 'Groceries');
    });
    expect(sub).toBeTruthy();
    expect(sub.parent_id).toBe(foodId);
    expect(sub.kind).toBe('variable');

    // Verify it renders indented
    const childRow = page.locator('.category-child', { hasText: 'Groceries' });
    await expect(childRow).toBeVisible();
  });

  test('subcategory inherits kind from parent', async ({ page }) => {
    await openApp(page);
    await page.click('[data-screen="categories-screen"]');
    await page.click('#categories-add');

    const rentId = await page.evaluate(() => {
      return Store.all('categories').find((c) => c.name === 'Rent').id;
    });

    await page.fill('#new-category-name', 'Home Rent');
    await page.selectOption('#new-category-parent', rentId);
    await page.click('.modal-actions >> text=Create');

    const sub = await page.evaluate(() => {
      return Store.all('categories').find((c) => c.name === 'Home Rent');
    });
    expect(sub.kind).toBe('fixed');
  });

  test('rename a category', async ({ page }) => {
    await openApp(page);
    await page.click('[data-screen="categories-screen"]');

    const renameBtn = page.locator('button[aria-label^="Rename Food"]');
    await renameBtn.click();
    await expect(page.locator('.modal')).toBeVisible();

    const nameInput = page.locator('.modal input[type="text"]');
    await nameInput.fill('Food & Drink');
    await page.click('.modal-actions >> text=Save');
    await expect(page.locator('.modal')).not.toBeVisible();

    const categories = await page.evaluate(() => Store.all('categories'));
    const renamed = categories.find((c) => c.name === 'Food & Drink');
    expect(renamed).toBeTruthy();
    expect(categories.find((c) => c.name === 'Food')).toBeFalsy();
  });

  test('archive a category hides it from the list', async ({ page }) => {
    await openApp(page);
    await page.click('[data-screen="categories-screen"]');

    const archiveBtn = page.locator('button[aria-label^="Archive Wifi"]');
    await archiveBtn.click();
    await expect(page.locator('.modal')).toBeVisible();
    await page.click('.modal-actions >> text=Archive');
    await expect(page.locator('.modal')).not.toBeVisible();

    await expect(page.locator('.category-name >> text=Wifi')).not.toBeVisible();

    const wifi = await page.evaluate(() => {
      return Store.all('categories').find((c) => c.name === 'Wifi');
    });
    expect(wifi.archived).toBe(true);
  });

  test('archiving a parent archives its children', async ({ page }) => {
    await openApp(page);

    // Create a subcategory under Food
    await page.evaluate(() => {
      const food = Store.all('categories').find((c) => c.name === 'Food');
      Store.upsert('categories', {
        name: 'Groceries',
        kind: 'variable',
        parent_id: food.id,
        archived: false,
        sort: 0,
      });
    });

    await page.click('[data-screen="categories-screen"]');

    const archiveBtn = page.locator('button[aria-label^="Archive Food"]');
    await archiveBtn.click();
    await expect(page.locator('.modal')).toBeVisible();
    await page.click('.modal-actions >> text=Archive');
    await expect(page.locator('.modal')).not.toBeVisible();

    const state = await page.evaluate(() => {
      const food = Store.all('categories').find((c) => c.name === 'Food');
      const groceries = Store.all('categories').find((c) => c.name === 'Groceries');
      return { foodArchived: food.archived, groceriesArchived: groceries.archived };
    });
    expect(state.foodArchived).toBe(true);
    expect(state.groceriesArchived).toBe(true);
  });

  test('toggle show archived reveals archived categories', async ({ page }) => {
    await openApp(page);

    await page.evaluate(() => {
      const wifi = Store.all('categories').find((c) => c.name === 'Wifi');
      Store.upsert('categories', { id: wifi.id, archived: true });
    });

    await page.click('[data-screen="categories-screen"]');
    await expect(page.locator('.category-name >> text=Wifi')).not.toBeVisible();

    await page.click('#categories-toggle-archived');
    await expect(page.locator('.category-name >> text=Wifi')).toBeVisible();
  });

  test('restore an archived category', async ({ page }) => {
    await openApp(page);

    await page.evaluate(() => {
      const wifi = Store.all('categories').find((c) => c.name === 'Wifi');
      Store.upsert('categories', { id: wifi.id, archived: true });
    });

    await page.click('[data-screen="categories-screen"]');
    await page.click('#categories-toggle-archived');

    const restoreBtn = page.locator('button[aria-label^="Restore Wifi"]');
    await restoreBtn.click();

    const archived = await page.evaluate(() => {
      return Store.all('categories').find((c) => c.name === 'Wifi').archived;
    });
    expect(archived).toBe(false);
  });

  test('nesting is capped at one level — subcategories do not appear in parent dropdown', async ({ page }) => {
    await openApp(page);

    // Create a subcategory
    await page.evaluate(() => {
      const food = Store.all('categories').find((c) => c.name === 'Food');
      Store.upsert('categories', {
        name: 'Groceries',
        kind: 'variable',
        parent_id: food.id,
        archived: false,
        sort: 0,
      });
    });

    await page.click('[data-screen="categories-screen"]');
    await page.click('#categories-add');
    await expect(page.locator('.modal')).toBeVisible();

    const parentOptions = await page.evaluate(() => {
      const select = document.getElementById('new-category-parent');
      return Array.from(select.options).map((o) => o.text);
    });

    expect(parentOptions).toContain('Food');
    expect(parentOptions).not.toContain('Groceries');
  });

  test('parent with children shows Parent label', async ({ page }) => {
    await openApp(page);

    await page.evaluate(() => {
      const food = Store.all('categories').find((c) => c.name === 'Food');
      Store.upsert('categories', {
        name: 'Groceries',
        kind: 'variable',
        parent_id: food.id,
        archived: false,
        sort: 0,
      });
    });

    await page.click('[data-screen="categories-screen"]');

    const foodRow = page.locator('.category-row', { hasText: 'Food' }).first();
    await expect(foodRow.locator('.category-parent-label')).toBeVisible();
  });
});
