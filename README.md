# Budget Coach v2

A payday planner with a built-in expense ledger.

> **2 minutes on payday. 5 seconds per spend. One honest number.**

Not a record of what you spent — a live answer to *"can I spend this right now?"*

**Status:** in development. Chunks 1–6 of 26 shipped — installable PWA with offline support.
See [FUTURE-ENHANCEMENTS.md](FUTURE-ENHANCEMENTS.md) for what's next and
[ENHANCED-LOG.md](ENHANCED-LOG.md) for what's done.

---

## Why v2

Version 1 was built to make its author "more aware" of their spending. That premise was wrong —
the awareness was already there. Three structural problems were the real cause:

1. **The plan and reality lived in separate apps.** The payday plan and the expense tracker's
   budgets were the same intention, authored twice, in two systems that could not see each other.
2. **The plan was write-once.** Useful on day 1, silent for the next 29.
3. **Split bills could not be recorded truthfully.** Paying RM100 for a shared meal when your
   share was RM30 had no honest representation.

v2 merges the planner and the ledger so the plan is drawn down by real spending as it happens.

---

## The idea that makes it work

**Cash movement and personal expense are two different numbers.**

Every transaction records `amount` — the cash that actually moved — and `own_share` — what it
truly cost you.

| Situation | `amount` | `own_share` | Hits budget |
|---|---|---|---|
| Normal expense | 50 | 50 | 50 |
| RM100 meal, your RM30 share | 100 | 30 | **30** |
| Friend paid, you owe RM30 | 0 | 30 | **30** |
| Transfer to savings | 500 | 0 | 0 |
| Credit card bill | 800 | 0 | 0 |
| Car loan payment | 1200 | 1200 | **1200** |
| Friend repays you | 70 | 0 | 0 |

**Budget impact is always `own_share`.** One rule, no special cases — and it is why split bills,
credit cards and hire-purchase loans all work without contradicting each other.

---

## Features

### Ledger
Cash, bank, e-wallet, credit card and loan accounts with accurate running balances. Editable
categories with one level of subcategories, each marked Fixed or Variable. Quick-add built for
speed: **three taps and under five seconds**, enforced by a test.

### Shared expenses
Track who owes you and who you owe, per person and in both directions. Even-split by default,
custom amounts when needed, partial repayments, and write-offs when a debt is never coming back.
Repayments settle a debt rather than counting as income, so your savings rate stays honest.

### Planner
Savings comes off the top on payday — never "whatever's left". Budgets pre-fill from last month,
so a new month is confirmed rather than authored. Fixed bills auto-appear in a Due inbox for
one-tap confirmation.

### The daily number

```
category daily pace = remaining category budget ÷ days left in month
```

Recomputed every day, so overspending shrinks the days ahead and underspending rolls forward —
from a single formula. Applies to Variable categories only; rent is not spread across 30 days.
Warnings fire **while you are still deciding**, and never block the entry.

---

## Tech

| Layer | Choice |
|---|---|
| Markup & styling | HTML5, CSS3 custom properties |
| Logic | Vanilla JavaScript, no build step, no framework |
| Data & auth | Supabase (PostgreSQL + Auth, row-level security) |
| Offline | localStorage cache, service worker, installable PWA |
| Tests | Playwright — desktop Chromium and Pixel 5 |
| Hosting | GitHub Pages via GitHub Actions |

Money is stored as **integer cents** throughout. Currency arithmetic never touches a float.

---

## Running it

No build step. Serve the folder and open it:

```bash
npm install
npm run serve      # http://127.0.0.1:4174
```

### Connecting Supabase locally

`js/config.js` ships with `SUPABASE_URL_PLACEHOLDER` values that GitHub Actions replaces at
deploy time. Locally, nothing replaces them, so sign-in would fail. Copy the example file and
fill in your project details:

```bash
cp js/config.local.example.json js/config.local.json
```

```json
{
  "url": "https://your-project-ref.supabase.co",
  "key": "your-anon-publishable-key"
}
```

Both values come from **Supabase → Project Settings → API**. The anon key is safe in a browser
— row-level security is what protects your data, so make sure RLS is enabled on every table.

`js/config.local.json` is gitignored and never deployed. Until it exists, the sign-in screen
says so rather than showing a raw network error.

### Tests

```bash
npm run setup      # once - installs the Chromium binary
npm test           # desktop + mobile
npm run test:ui    # interactive
npm run report     # last HTML report
```

Windows users can run `run-tests.bat` for a menu instead.

Tests never touch the network. `stubSupabase()` intercepts every `auth/v1` and `rest/v1` call,
and `openApp()` seeds localStorage before boot so any state can be reached without clicking
through the UI.

---

## Layout

```
index.html            markup only, no inline styles
css/                  tokens · base · components · screens
js/
  config.js           constants, no logic
  util.js             ids, dates, money formatting and parsing
  calc.js             pure money maths - no DOM, no state
  store.js            state + localStorage cache + dirty queue
  sync.js             the only file that talks to Supabase
  auth.js             sign in/up/out, session persistence
  router.js           screen routing
  ui.js               escapeHtml, modal, toast, chips
  main.js             boot order and wiring
  screens/            one module per screen
tests/                Playwright suite, static server, helpers
```

## Documentation

| File | Purpose |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Developer conventions |
| [SCHEMA.md](SCHEMA.md) | Database schema |
| [FUTURE-ENHANCEMENTS.md](FUTURE-ENHANCEMENTS.md) | Chunks not yet built |
| [ENHANCED-LOG.md](ENHANCED-LOG.md) | Chunks already shipped |
