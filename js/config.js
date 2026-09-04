// App-wide constants. No logic, no DOM — safe to load first and read from anywhere.

const APP_NAME = 'Budget Coach';
const APP_VERSION = '0.1.0';

// Every localStorage key is namespaced so v1 data can never collide with v2.
const LS_PREFIX = 'bcv2_';

const CURRENCY = { code: 'MYR', symbol: 'RM', locale: 'en-MY' };

// Placeholders are replaced by GitHub Actions at deploy time. For local development,
// drop a js/config.local.json next to this file (gitignored) or set __BC_CONFIG__.
let SUPABASE_URL = globalThis.__BC_CONFIG__?.url || 'SUPABASE_URL_PLACEHOLDER';
let SUPABASE_KEY = globalThis.__BC_CONFIG__?.key || 'SUPABASE_KEY_PLACEHOLDER';

function isSupabaseConfigured() {
  return /^https?:\/\//.test(SUPABASE_URL) && !/PLACEHOLDER/.test(SUPABASE_KEY);
}

const SAVE_DEBOUNCE_MS = 600;
const TOAST_MS = 1800;

// Liability accounts differ in whether their bill payment consumes budget.
// spendingBacked: purchases are logged individually, so paying the bill must NOT double-count.
// debtServicing:  the purchase predates the app, so the payment itself IS the expense.
const ACCOUNT_TYPES = {
  cash:        { label: 'Cash',        liability: false, spendingBacked: false },
  bank:        { label: 'Bank',        liability: false, spendingBacked: false },
  ewallet:     { label: 'E-Wallet',    liability: false, spendingBacked: false },
  credit_card: { label: 'Credit Card', liability: true,  spendingBacked: true  },
  loan_hp:     { label: 'Loan',        liability: true,  spendingBacked: false },
};

// Fixed categories are committed obligations and are excluded from daily pacing.
const CATEGORY_KINDS = { fixed: 'Fixed', variable: 'Variable' };

// Warn while the user is still deciding, never block the entry.
const PACE_WARN_RATIO = 0.8;
const BUDGET_WARN_RATIO = 0.9;

// Created on first run so the app is usable immediately.
const SEED_CATEGORIES = [
  { name: 'Food',        kind: 'variable' },
  { name: 'Rent',        kind: 'fixed' },
  { name: 'Therapy',     kind: 'fixed' },
  { name: 'Wifi',        kind: 'fixed' },
  { name: 'Mobile Data', kind: 'fixed' },
];

const SEED_ACCOUNTS = [
  { name: 'Cash',    type: 'cash' },
  { name: 'Bank',    type: 'bank' },
  { name: 'E-Wallet', type: 'ewallet' },
];
