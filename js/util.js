// Pure helpers. No DOM, no state, no I/O.

function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function nowISO() {
  return new Date().toISOString();
}

function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthKey(date = new Date()) {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(key = monthKey()) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** Inclusive of today, so the last day of the month returns 1 and never 0. */
function daysLeftInMonth(key = monthKey(), today = new Date()) {
  const total = daysInMonth(key);
  if (monthKey(today) !== key) return total;
  return total - today.getDate() + 1;
}

function addMonths(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}

/** Money is integer cents everywhere. Never do float arithmetic on currency. */
function fmtMoney(cents, { symbol = true } = {}) {
  const n = Math.round(Number(cents) || 0);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${symbol ? CURRENCY.symbol + ' ' : ''}${whole}.${frac}`;
}

/** Returns integer cents, or null when the text is not a valid amount. */
function parseMoney(text) {
  if (typeof text === 'number') return Math.round(text * 100);
  const cleaned = String(text ?? '')
    .replace(CURRENCY.symbol, '')
    .replace(/[\s,]/g, '')
    .trim();
  if (!cleaned || !/^-?\d*\.?\d*$/.test(cleaned) || cleaned === '.' || cleaned === '-') return null;
  return Math.round(parseFloat(cleaned) * 100);
}

function safeParse(json, fallback = null) {
  try {
    const value = JSON.parse(json);
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

function clone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function debounce(fn, ms) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => clearTimeout(timer);
  wrapped.flush = (...args) => {
    clearTimeout(timer);
    fn(...args);
  };
  return wrapped;
}

function byName(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''));
}
