# Budget Coach v2 — Developer Conventions

Payday planner + daily expense ledger. Replaces both v1 (`../budget-coach`) and Money Manager.

## Why this app exists

Awareness was never the problem — the user already knows they overspend. v1 failed because the
plan and reality lived in separate apps, the plan was write-once, and split bills could not be
recorded truthfully. v2 fixes those three things.

Target: **2 minutes on payday, 5 seconds per spend, one honest number.**

## The rule everything derives from

**Cash movement and personal expense are two different numbers. Never conflate them.**

Every transaction stores `amount` (cash that moved) and `own_share` (what it cost *you*).

> **Budget impact = `own_share`, always.** No special cases.

| Situation | `amount` | `own_share` |
|---|---|---|
| Normal expense | 50 | 50 |
| RM100 meal, your RM30 share | 100 | 30 |
| Friend paid, you owe RM30 | 0 | 30 |
| Transfer to savings | 500 | 0 |
| Credit card bill payment | 800 | 0 |
| Car loan payment | 1200 | 1200 |
| Repayment received | 70 | 0 |

A transfer consumes budget only if that money has **never** been counted as an expense anywhere.
Credit cards are *spending-backed* (purchases logged individually, so the bill must not
double-count). Hire-purchase loans are *debt-servicing* (the car predates the app, so the
payment is the expense).

## Layout

| Path | Contains |
|---|---|
| `index.html` | Markup only. No inline styles. |
| `css/tokens.css` | Custom properties. All colour/spacing lives here. |
| `css/base.css` | Resets, screen routing, focus states. |
| `js/config.js` | Constants. No logic, no DOM. |
| `js/util.js` | Pure helpers: ids, dates, money formatting and parsing. |
| `js/calc.js` | **Pure** money maths. No DOM, no state, no I/O. |
| `js/store.js` | In-memory state + localStorage cache + dirty queue. |
| `js/sync.js` | The only file that talks to Supabase. |
| `js/auth.js` | Sign in/up/out, password reset, session persistence. |
| `js/router.js` | `.screen`/`.active` routing, hash-based. |
| `js/ui.js` | `escapeHtml`, `el`, modal, toast, chips. |
| `js/main.js` | Boot order and top-level wiring. |
| `js/screens/*.js` | One screen each: `init()` / `render()`. |
| `tests/` | Playwright suite, static server, helpers. |

## Conventions

- **No build step.** Classic `<script>` tags, so Playwright reaches globals via `page.evaluate()`.
- **Screen routing.** Screens are `.screen` divs; exactly one has `.active`.
- **Never `innerHTML` with user data.** Use `textContent`, or `escapeHtml()` from `ui.js`.
- **All `localStorage` access is wrapped in try/catch** and namespaced with `bcv2_`.
- **Local-first.** Write to store → localStorage immediately → queue the Supabase push.
  Never block the UI on the network.
- **Money is stored in whole cents (integers).** Never float arithmetic on currency.
- **Category is mandatory** on every expense. There is no Miscellaneous fallback.
- **Warn, never block.** Budget warnings inform the decision; they never refuse the entry.
- **No balance plug entries.** If a balance drifts, the user finds the real missing transaction.
- **Accessibility:** `role="dialog"` + `aria-modal` on modals, `aria-label` on icon-only buttons,
  visible `:focus-visible`, 44px minimum tap targets.

## Month semantics

Months are **calendar months**, keyed `YYYY-MM`. Payday is not fixed, so the payday plan is
triggered by **logging income**, not by a date. Fixed bills still use calendar due dates.

## Local configuration

`SUPABASE_URL` / `SUPABASE_KEY` in `js/config.js` are placeholders replaced by GitHub Actions.
For local work, copy `js/config.local.example.json` to `js/config.local.json` (gitignored).
Tests inject `window.__BC_CONFIG__` instead. Never call Supabase without checking
`isSupabaseConfigured()` first — an unconfigured build must explain itself, not throw.

## Testing

- `npm test` runs chromium + Pixel 5.
- `openApp(page, { storage, tables })` seeds localStorage before boot and stubs Supabase.
- `stubSupabase()` intercepts `**/auth/v1/**` and `**/rest/v1/**`. **Tests never hit the network.**
- `calc.js` is tested directly — cheapest and highest-value coverage in the project.

## When changing behaviour

1. Update or add tests. Add a regression test for every bug fixed.
2. Update `README.md`.
3. Run the full suite.
4. When a chunk ships: remove it from `FUTURE-ENHANCEMENTS.md` and append an entry to
   `ENHANCED-LOG.md`. Use the `/ship-chunk` prompt.
