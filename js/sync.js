// The only file that talks to Supabase. Plain REST over fetch — no SDK, so there is
// nothing to load from a CDN and every call is trivially stubbable in tests.

const Sync = {
  online: true,
  lastError: null,

  headers(extra = {}) {
    const token = Auth.session()?.access_token;
    return {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token || SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  },

  url(table, query = '') {
    return `${SUPABASE_URL}/rest/v1/${table}${query}`;
  },

  /** Pulls every table, keeping any row that still has an unpushed local edit. */
  async hydrate() {
    if (!Auth.isSignedIn()) return false;
    try {
      const results = await Promise.all(
        TABLES.map(async (table) => {
          const res = await fetch(Sync.url(table, '?select=*'), { headers: Sync.headers() });
          if (!res.ok) throw new Error(`${table}: ${res.status}`);
          return [table, await res.json()];
        })
      );
      results.forEach(([table, rows]) => Store.merge(table, Array.isArray(rows) ? rows : []));
      Store.persist();
      Store.notify();
      lsSet(LS.lastSync, nowISO());
      Sync.online = true;
      Sync.lastError = null;
      return true;
    } catch (err) {
      Sync.online = false;
      Sync.lastError = String(err);
      return false;
    }
  },

  /** Pushes the dirty queue. Anything that fails stays queued for the next attempt. */
  async flush() {
    if (!Auth.isSignedIn() || !Store.dirty.length) return true;
    const batch = [...Store.dirty];
    const pushed = [];
    let allOk = true;

    for (const entry of batch) {
      try {
        let res;
        if (entry.op === 'delete') {
          res = await fetch(Sync.url(entry.table, `?id=eq.${entry.id}`), {
            method: 'DELETE',
            headers: Sync.headers(),
          });
        } else {
          const row = Store.byId(entry.table, entry.id);
          if (!row) {
            pushed.push(entry);
            continue;
          }
          res = await fetch(Sync.url(entry.table), {
            method: 'POST',
            headers: Sync.headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
            body: JSON.stringify([row]),
          });
        }
        if (!res.ok) throw new Error(`${entry.table}: ${res.status}`);
        pushed.push(entry);
      } catch (err) {
        allOk = false;
        Sync.online = false;
        Sync.lastError = String(err);
        break;
      }
    }

    if (pushed.length) Store.clearDirty(pushed);
    if (allOk) {
      Sync.online = true;
      Sync.lastError = null;
      lsSet(LS.lastSync, nowISO());
    }
    return allOk;
  },

  lastSyncAt() {
    return lsGet(LS.lastSync, null);
  },

  pendingCount() {
    return Store.dirty.length;
  },
};

const scheduleFlush = debounce(() => Sync.flush(), SAVE_DEBOUNCE_MS);

function initSync() {
  Store.subscribe(() => {
    if (Store.dirty.length) scheduleFlush();
  });
  window.addEventListener('online', () => {
    Sync.online = true;
    Sync.flush();
  });
  window.addEventListener('offline', () => {
    Sync.online = false;
  });
}
