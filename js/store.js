// Single source of in-memory truth. Every mutation writes the local cache synchronously
// and queues a push, so the UI never waits on the network.

const TABLES = [
  'accounts',
  'categories',
  'budgets',
  'transactions',
  'people',
  'splits',
  'settlements',
  'month_plans',
  'scheduled_items',
  'scheduled_instances',
];

const LS = {
  cache: LS_PREFIX + 'cache',
  dirty: LS_PREFIX + 'dirty',
  lastSync: LS_PREFIX + 'last_sync',
  session: LS_PREFIX + 'session',
  setupDone: LS_PREFIX + 'setup_complete',
};

function lsGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : safeParse(raw, fallback);
  } catch {
    return fallback;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function lsRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* private mode or quota — non-fatal */
  }
}

function emptyData() {
  return TABLES.reduce((acc, table) => ({ ...acc, [table]: [] }), {});
}

const Store = {
  data: emptyData(),
  dirty: [],
  listeners: new Set(),

  load() {
    const cached = lsGet(LS.cache, null);
    Store.data = emptyData();
    if (cached && typeof cached === 'object') {
      TABLES.forEach((table) => {
        if (Array.isArray(cached[table])) Store.data[table] = cached[table];
      });
    }
    const dirty = lsGet(LS.dirty, []);
    Store.dirty = Array.isArray(dirty) ? dirty : [];
    return Store.data;
  },

  persist() {
    lsSet(LS.cache, Store.data);
    lsSet(LS.dirty, Store.dirty);
  },

  all(table) {
    return Store.data[table] || [];
  },

  byId(table, id) {
    return Store.all(table).find((row) => row.id === id) || null;
  },

  where(table, predicate) {
    return Store.all(table).filter(predicate);
  },

  /** Insert or update, then queue the push. Returns the stored row. */
  upsert(table, row, { queue = true } = {}) {
    if (!Store.data[table]) Store.data[table] = [];
    const record = { ...row, id: row.id || uid(), updated_at: nowISO() };
    const list = Store.data[table];
    const index = list.findIndex((r) => r.id === record.id);
    if (index >= 0) list[index] = { ...list[index], ...record };
    else list.push(record);

    if (queue) Store.markDirty(table, record.id, 'upsert');
    Store.persist();
    Store.notify();
    return Store.byId(table, record.id);
  },

  remove(table, id, { queue = true } = {}) {
    const list = Store.data[table] || [];
    const index = list.findIndex((r) => r.id === id);
    if (index < 0) return false;
    list.splice(index, 1);
    if (queue) Store.markDirty(table, id, 'delete');
    Store.persist();
    Store.notify();
    return true;
  },

  /** One pending op per row — a later write supersedes an earlier one. */
  markDirty(table, id, op) {
    Store.dirty = Store.dirty.filter((entry) => !(entry.table === table && entry.id === id));
    Store.dirty.push({ table, id, op });
  },

  isDirty(table, id) {
    return Store.dirty.some((entry) => entry.table === table && entry.id === id);
  },

  clearDirty(entries) {
    const done = new Set(entries.map((e) => e.table + ':' + e.id));
    Store.dirty = Store.dirty.filter((e) => !done.has(e.table + ':' + e.id));
    Store.persist();
  },

  /** Applies a server snapshot without clobbering rows still waiting to be pushed. */
  merge(table, rows) {
    const pending = Store.all(table).filter((row) => Store.isDirty(table, row.id));
    const pendingIds = new Set(pending.map((r) => r.id));
    const incoming = rows.filter((row) => !pendingIds.has(row.id));
    Store.data[table] = [...incoming, ...pending];
  },

  reset() {
    Store.data = emptyData();
    Store.dirty = [];
    lsRemove(LS.cache);
    lsRemove(LS.dirty);
    lsRemove(LS.lastSync);
    Store.notify();
  },

  subscribe(fn) {
    Store.listeners.add(fn);
    return () => Store.listeners.delete(fn);
  },

  notify() {
    Store.listeners.forEach((fn) => {
      try {
        fn(Store.data);
      } catch (err) {
        console.error('store listener failed', err);
      }
    });
  },
};
