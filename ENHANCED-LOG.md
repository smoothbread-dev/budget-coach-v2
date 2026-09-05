# Enhancement Log

Shipped chunks, newest first. Entries are moved here from `FUTURE-ENHANCEMENTS.md` by the
`/ship-chunk` prompt.

---

## Chunk 6 — PWA

**Shipped:** 2026-09-05 · **Tests:** 248 passing (124 × chromium + mobile)

Makes the app installable to the phone home screen and offline-capable. A service worker caches
the app shell on install, using a **network-first** strategy so deploys take effect immediately
without cache busting. **Supabase requests are never cached** — stale financial data is worse
than none. `skipWaiting()` + `clients.claim()` ensure new SW versions activate immediately.

| File | Change |
|---|---|
| `manifest.json` | New — standalone display, dark theme (#0f1115), 192/512 icons |
| `sw.js` | New — network-first cache, Supabase bypass, shell precache on install |
| `icons/icon-192.png` | New — 192×192 app icon (green circle on dark background) |
| `icons/icon-512.png` | New — 512×512 app icon |
| `index.html` | Manifest link, apple-touch-icon, inline SW registration script |
| `tests/pwa.spec.js` | New — 4 tests for manifest, SW registration, offline, Supabase bypass |

**Tests added:** `pwa.spec.js` (manifest served and valid with standalone display and correct
theme colors, service worker registers and activates, app shell loads from cache when offline,
Supabase requests are never present in the SW cache).

**Deviations from plan:** none. The existing `<meta name="theme-color">` was already present from
Chunk 1, so only the manifest link and apple-touch-icon were added. Icons are generated via a
one-time Node.js script (`scripts/generate-icons.js`) — simple green circle on dark background,
replaceable with branded icons later.

---

## Chunk 5 — Quick-add

**Shipped:** 2026-09-05 · **Tests:** 240 passing (120 × chromium + mobile)

The most-used screen in the app. Hard requirement: **≤ 3 taps and ≤ 5 seconds** for a typical
expense, asserted by tests. Flow: Amount → category chip → save. Custom numeric keypad (4×3 grid:
1–9, `.`, 0, `⌫`) avoids native keyboard. Category chips ordered by recency then frequency via
`categoryChipOrder()`. Account defaults to last used (stored in `bcv2_last_account`). Optional
note, collapsed by default. `own_share = amount` until splits arrive in Chunk 12.

| File | Change |
|---|---|
| `js/calc.js` | `categoryChipOrder()` — sorts leaf categories by recency, frequency, then name |
| `js/screens/quickadd.js` | New — IIFE with custom keypad, category chips, type toggle, save |
| `css/components.css` | Keypad grid, chip row, chip selection styles |
| `css/screens.css` | Quick-add layout: type toggle, amount display, account row, note row, save |
| `index.html` | Quick-add screen markup, home "Add entry" button, script tag |
| `js/main.js` | `QuickAddScreen.init()`, home-quickadd click handler |
| `tests/quickadd.spec.js` | New — 11 tests for quick-add flow |
| `tests/calc.spec.js` | 4 new tests for `categoryChipOrder()` |

**Tests added:** `quickadd.spec.js` (expense logged in 3 taps, save-to-close under 5 seconds,
chips ordered by recency then frequency, account defaults to last used and is overridable, save
refused with no category, save refused with zero amount, entry appears in store before network
response, income increases balance / expense decreases it, note field hidden by default / toggles
visible, note saved with transaction, navigates back to home on save), `calc.spec.js` (recently
used categories appear first, higher frequency breaks ties when recency is equal, never-used
categories appear last alphabetically, archived categories are excluded).

**Deviations from plan:** `Store.upsert('transactions', ...)` is used directly instead of adding
an `addTransaction()` helper to `store.js` — the generic upsert path is sufficient. Tests required
passing `tables` alongside `cache` in the seed helper to prevent `hydrateInBackground()` from
wiping cached data via `merge()` with empty server responses.

---

## Chunk 4 — Categories

**Shipped:** 2026-09-05 · **Tests:** 210 passing (105 × chromium + mobile)

User-owned categories with one level of subcategories, each marked Fixed or Variable.
`categoryTree()` and `leafCategories()` are pure functions in `calc.js`, tested directly via
`page.evaluate()`. The categories screen follows the same IIFE pattern as accounts: `init()` /
`render()`, wired from `main.js`.

Key behaviours: create with optional parent (enforcing one-level nesting), rename, archive
(cascading to children), restore (cascading to parent). Subcategories inherit `kind` from their
parent — the kind field is hidden when a parent is selected. Five categories seeded on first run:
Food (variable), Rent, Therapy, Wifi, Mobile Data (fixed).

| File | Change |
|---|---|
| `js/calc.js` | `categoryTree()`, `leafCategories()` |
| `js/screens/categories.js` | New — list, create, rename, archive, restore, toggle archived |
| `css/screens.css` | Category rows, child indentation, parent label |
| `index.html` | Categories screen, home nav with Categories button |
| `js/main.js` | Category seeding in `seedDefaults()`, `CategoriesScreen.init()`, router wiring |
| `tests/calc.spec.js` | 6 new tests for `categoryTree()` and `leafCategories()` |
| `tests/categories.spec.js` | New — 13 tests for category CRUD, seeding, nesting |

**Tests added:** `calc.spec.js` (groups children under parents, empty children array for
top-level, orphaned parent_id treated as top-level, roots sorted by name, leafCategories returns
leaves, parent with children excluded from leaves), `categories.spec.js` (seeded categories
appear with correct count, not duplicated on reload, correct kinds, create new category, create
subcategory nested under parent, subcategory inherits kind from parent, rename, archive hides
from list, archiving parent archives children, toggle show archived, restore archived, nesting
capped at one level, parent with children shows Parent label).

**Deviations from plan:** restoring a child also restores its archived parent (not in the
original spec, but necessary for consistency). The "parent with children exposes no budget field"
spec item was deferred to Chunk 15 (monthly budgets) since budget fields don't exist yet —
replaced with a "parent shows Parent label" test.

---

## Chunk 3 — Accounts

**Shipped:** 2026-09-05 · **Tests:** 172 passing (86 × chromium + mobile)

Account management: create, rename, archive, with types (Cash, Bank, E-Wallet, Credit Card,
Loan). Running balance derived from transactions, never stored. Three default accounts (Cash,
Bank, E-Wallet) seeded on first run so the app is usable immediately.

Pure money maths lives in `calc.js`, which is tested directly via `page.evaluate()` — cheapest
and highest-value coverage in the project. Screen modules follow an IIFE pattern with `init()`
and `render()`, wired from `main.js`.

| File | Change |
|---|---|
| `js/calc.js` | New — `accountBalance()` |
| `js/screens/accounts.js` | New — list, create, rename, archive, restore, toggle archived |
| `css/screens.css` | New — screen nav, account rows, modal form |
| `index.html` | Accounts screen, home nav with Accounts button, script tags |
| `js/main.js` | `seedDefaults()`, `AccountsScreen.init()`, router wiring, home nav handler |
| `tests/calc.spec.js` | New — 9 tests for `accountBalance()` |
| `tests/accounts.spec.js` | New — 12 tests for account CRUD, seeding, balances |
| `tests/store.spec.js` | 3 tests set to `signedIn: false` to isolate from account seeding |

**Tests added:** `calc.spec.js` (unknown account returns 0, opening balance, income/expense,
transfer_in/out, combined operations, ignores other accounts, uses `amount` not `own_share`,
missing opening_balance defaults to 0), `accounts.spec.js` (seeded accounts appear and aren't
duplicated, correct types, create via modal, rename, archive hides but transactions survive,
toggle show archived, balance with all transaction types, balance unaffected by `own_share`,
screen displays balance, opening balance persists, restore archived).

**Deviations from plan:** "deleting an account with transactions is refused" was replaced by
archive semantics — accounts are soft-deleted (archived) rather than hard-deleted, so
transactions always survive. Seeding required `{ queue: false }` to avoid polluting the dirty
queue, plus a re-seed after hydration since `Store.merge()` wipes non-dirty rows. Seeding is
gated on `Auth.isSignedIn()` so store-mechanics tests run without interference.

---

## Chunk 2 — Data layer

**Shipped:** 2026-09-05 · **Tests:** 126 passing (63 × chromium + mobile)

Built the foundation every screen will sit on: pure helpers, a local-first store, Supabase sync
over plain REST, auth, hash routing and shared UI primitives. The app now boots straight from
the localStorage cache and reconciles with the server behind the UI, so nothing ever waits on
the network.

Two decisions worth recording:

- **No Supabase SDK.** Auth and REST are plain `fetch` calls, so there is no CDN dependency to
  load before the app is usable, and every request is trivially stubbable in tests.
- **Money is integer cents from the very first line.** `fmtMoney` / `parseMoney` round-trip
  without drift, and a test asserts `0.1 + 0.2` stays exact.

| File | Change |
|---|---|
| `js/util.js` | New — `uid`, `monthKey`, `daysLeftInMonth`, `fmtMoney`, `parseMoney`, `debounce` |
| `js/ui.js` | New — `escapeHtml`, `el`, one modal implementation, toast, confirm, validate |
| `js/store.js` | New — state, synchronous cache write, dirty queue, `merge`, subscribers |
| `js/sync.js` | New — `hydrate`, `flush`, debounced push, online/offline replay |
| `js/auth.js` | New — sign in/up/out, password reset, session persistence |
| `js/router.js` | New — `.screen`/`.active` routing, hash-based for phone back |
| `js/main.js` | New — boot order, auth form wiring, home render |
| `css/components.css` | New — buttons, forms, cards, modal, toast, <360px breakpoint |
| `index.html` | Auth + home screens, modal/toast roots, script tags |
| `tests/helpers.js` | `delayMs`, `failWrites`, `failAuth`, session seeding, `waitForHydration` |
| `tests/smoke.spec.js` | Updated for the real boot screens |
| `CLAUDE.md`, `.github/copilot-instructions.md` | Added `util.js`, `router.js`, `main.js` |
| `SCHEMA.md` | Core tables marked as in use |

**Tests added:** `util.spec.js` (money formatting and parsing, float-drift round trip, month
arithmetic, `daysLeftInMonth` never zero), `ui.spec.js` (escaping including a live-XSS attempt,
dialog roles, Escape, focus trap, focus restore, toast, validation), `store.spec.js` (synchronous
persistence, dirty-queue collapsing, corrupt and wrong-shaped cache recovery, merge protecting
unpushed rows, listener isolation), `sync.spec.js` (cache paints before the network answers,
flush success and failure, offline replay reaching the server, sync status copy),
`auth.spec.js` (session restore, sign in/out, bad credentials, corrupt session, reset email).

**Deviations from plan:** added `js/main.js`, which the plan had not named — boot logic needed a
home that was neither the router nor a screen. Fixed a redirect bug found by the tests: after
signing in, the hash still read `#auth`, so `renderShell()` sent the user back to the auth
screen; it now ignores the hash when it points at auth.

**Follow-up (same day):** signing in locally failed with a bare "Failed to fetch", because the
placeholder credentials are only replaced by Actions at deploy time. `SUPABASE_URL` / `_KEY` are
now `let` and can be supplied by a gitignored `js/config.local.json` (or `window.__BC_CONFIG__`),
`isSupabaseConfigured()` gates every auth call, and the auth screen explains the situation
instead of surfacing a network error. Tests now boot with a realistic absolute Supabase URL
rather than the placeholder.

---

## Chunk 1 — Scaffold and test harness

**Shipped:** 2026-09-05 · **Tests:** 10 passing (5 specs × chromium + mobile)

Created `budget-coach-v2/` with the Playwright harness, project constants, a minimal app shell
and the full documentation set. The old `budget-coach/` is untouched and stays deployed until
cutover after Chunk 14.

Also resolved the outstanding security question from planning: **the Groq API key was never
exposed.** `deploy.yml` injects only `SUPABASE_URL` and `SUPABASE_KEY`, and v1's `app.js` contains
no `GROQ_API_KEY` and no `Authorization` header — the Cloudflare Worker holds the key. No
rotation needed. v1's README claim about an injected placeholder is simply out of date. v2 drops
the AI Coach entirely, so the question does not carry forward.

| File | Change |
|---|---|
| `package.json` | New — Playwright scripts mirroring the pokedex project |
| `playwright.config.js` | New — chromium + Pixel 5, port 4174 to avoid clashing with pokedex |
| `tests/server.js` | New — static server with a path-traversal guard and `no-store` |
| `tests/helpers.js` | New — `openApp()`, `stubSupabase()`, `readJson()`, `activeScreen()` |
| `tests/smoke.spec.js` | New — proves the harness works end to end |
| `index.html` | New — minimal shell with one `.screen.active` |
| `css/tokens.css` | New — colour, spacing, radius and typography custom properties |
| `css/base.css` | New — reset, screen routing, focus-visible, 44px tap targets |
| `js/config.js` | New — storage prefix, currency, account types, seed data, warning ratios |
| `run-tests.bat` | New — interactive menu, no terminal knowledge required |
| `CLAUDE.md` | New — conventions, the `own_share` rule, layout, testing |
| `.github/copilot-instructions.md` | New — identical to `CLAUDE.md` for automatic pickup |
| `.github/prompts/ship-chunk.prompt.md` | New — the chunk retirement workflow |
| `.github/prompts/sync-tests-and-docs.prompt.md` | New — keeps tests and docs aligned |
| `.github/workflows/deploy.yml` | New — Pages deploy, Supabase-only secret injection, test gate |
| `FUTURE-ENHANCEMENTS.md` | New — chunks 2–25, dependency-ordered |
| `ENHANCED-LOG.md` | New — this file |
| `SCHEMA.md` | New — planned Supabase tables, money stored as integer cents |
| `README.md` | New |
| `.gitignore` | New |

**Tests added:** `tests/smoke.spec.js` — app boots with exactly one active screen; config
constants are reachable from the page; credit card is spending-backed while the loan is not;
localStorage seeding is namespaced under `bcv2_`; Supabase calls are stubbed and never live.

**Deviations from plan:** none. Port moved from 4173 to 4174 so the suite can run alongside the
pokedex project.
