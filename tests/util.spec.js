const { test, expect } = require('@playwright/test');
const { openApp } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test.describe('money formatting', () => {
  test('formats cents with a symbol, decimals and thousands separators', async ({ page }) => {
    const out = await page.evaluate(() => [
      fmtMoney(0),
      fmtMoney(5),
      fmtMoney(1234),
      fmtMoney(123456789),
      fmtMoney(-4550),
      fmtMoney(1234, { symbol: false }),
    ]);
    expect(out).toEqual(['RM 0.00', 'RM 0.05', 'RM 12.34', 'RM 1,234,567.89', '-RM 45.50', '12.34']);
  });

  test('parses user input into integer cents', async ({ page }) => {
    const out = await page.evaluate(() => [
      parseMoney('12.34'),
      parseMoney('RM 12.34'),
      parseMoney('1,234.50'),
      parseMoney('  7 '),
      parseMoney('0.1'),
      parseMoney('-3.20'),
    ]);
    expect(out).toEqual([1234, 1234, 123450, 700, 10, -320]);
  });

  test('rejects input that is not an amount', async ({ page }) => {
    const out = await page.evaluate(() => [
      parseMoney(''),
      parseMoney('abc'),
      parseMoney('.'),
      parseMoney('-'),
      parseMoney('1.2.3'),
    ]);
    expect(out).toEqual([null, null, null, null, null]);
  });

  test('round-trips without float drift', async ({ page }) => {
    const drifted = await page.evaluate(() => {
      const values = [1, 5, 10, 99, 100, 1999, 250050, 999999999];
      return values.filter((cents) => parseMoney(fmtMoney(cents)) !== cents);
    });
    expect(drifted).toEqual([]);
  });

  test('0.1 + 0.2 stays exact in cents', async ({ page }) => {
    const total = await page.evaluate(() => parseMoney('0.1') + parseMoney('0.2'));
    expect(total).toBe(30);
    expect(await page.evaluate(() => fmtMoney(30))).toBe('RM 0.30');
  });
});

test.describe('dates', () => {
  test('monthKey and daysInMonth handle month lengths', async ({ page }) => {
    const out = await page.evaluate(() => [
      monthKey(new Date(2026, 8, 5)),
      daysInMonth('2026-09'),
      daysInMonth('2026-02'),
      daysInMonth('2024-02'),
      daysInMonth('2026-01'),
    ]);
    expect(out).toEqual(['2026-09', 30, 28, 29, 31]);
  });

  test('daysLeftInMonth is inclusive of today and never zero', async ({ page }) => {
    const out = await page.evaluate(() => [
      daysLeftInMonth('2026-09', new Date(2026, 8, 1)),
      daysLeftInMonth('2026-09', new Date(2026, 8, 5)),
      daysLeftInMonth('2026-09', new Date(2026, 8, 30)),
    ]);
    expect(out).toEqual([30, 26, 1]);
  });

  test('a different month returns the whole month', async ({ page }) => {
    const days = await page.evaluate(() => daysLeftInMonth('2026-10', new Date(2026, 8, 15)));
    expect(days).toBe(31);
  });

  test('addMonths crosses year boundaries', async ({ page }) => {
    const out = await page.evaluate(() => [
      addMonths('2026-09', 1),
      addMonths('2026-12', 1),
      addMonths('2026-01', -1),
    ]);
    expect(out).toEqual(['2026-10', '2027-01', '2025-12']);
  });
});

test.describe('misc', () => {
  test('safeParse falls back instead of throwing', async ({ page }) => {
    const out = await page.evaluate(() => [safeParse('{"a":1}').a, safeParse('not json', 'fb'), safeParse('null', 'fb')]);
    expect(out).toEqual([1, 'fb', 'fb']);
  });

  test('uid returns unique values', async ({ page }) => {
    const unique = await page.evaluate(() => new Set(Array.from({ length: 500 }, () => uid())).size);
    expect(unique).toBe(500);
  });
});
