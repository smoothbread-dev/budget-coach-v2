# Future Enhancements

Chunks not built yet. **Remove an entry when it ships and append it to `ENHANCED-LOG.md`** —
use the `/ship-chunk` prompt.

Chunks are ordered by dependency. Each one can be built, tested and shipped on its own.

**Phases:** A = ledger · B = shared expenses · **cutover from Money Manager** · C = planner ·
D = the bridge · E = later.

---

## Chunk 3 — Accounts

**Depends on: Chunk 2 (data layer — shipped).**

Manage the accounts money moves through, and show an accurate running balance for each.

### Behaviour

- Create, rename, archive. Types: Cash, Bank, E-Wallet, Credit Card, Loan.
- Opening balance per account. For liabilities this is the amount owed.
- Running balance is **derived from transactions**, never stored:
  `balance = opening_balance + income − expenses ± transfers`.
- Seeded on first run with Cash, Bank and E-Wallet so the app is usable immediately.
- Credit card and loan fields are added in Chunk 8 — this chunk only establishes the types.

### Files

| File | Change |
|---|---|
| `js/screens/accounts.js` | New |
| `js/calc.js` | New — `accountBalance()` |
| `index.html` | Accounts screen |
| `css/screens.css` | New |
| `tests/accounts.spec.js`, `tests/calc.spec.js` | New |

### Spec coverage

- Seeded accounts appear on first run and are not duplicated on second boot
- Create / rename / archive; archived accounts are hidden but their transactions survive
- Balance reflects income, expense and transfers in both directions
- Balance is unaffected by an expense whose `own_share` differs from `amount`
- Deleting an account with transactions is refused

### Verification

1. Fresh account → three seeded accounts
2. Add an opening balance, then a few transactions — balance matches hand arithmetic
3. Archive an account — hidden from pickers, history intact
4. `npm test` passes

---

## Chunk 4 — Categories

**Depends on: Chunk 2 (data layer — shipped).**

User-owned categories with one level of subcategories, each marked Fixed or Variable.

### Behaviour

- Create, rename, archive, reorder. One level of nesting only.
- **Budgets sit on leaves.** A parent's total is the sum of its children; parents have no cap.
- **Fixed** (rent, wifi) vs **Variable** (food) — Fixed is excluded from daily pacing in Chunk 18.
- Seeded on first run: Food (variable), Rent, Therapy, Wifi, Mobile Data (fixed).
- Archiving a parent archives its children.

### Files

| File | Change |
|---|---|
| `js/screens/categories.js` | New |
| `js/calc.js` | `categoryTree()`, `leafCategories()` |
| `index.html` | Categories screen |
| `tests/categories.spec.js` | New |

### Spec coverage

- Seeded categories appear once, with the right Fixed/Variable split
- Create a subcategory; the parent shows it nested
- A parent with children exposes no budget field of its own
- Archiving a parent archives its children
- Nesting is capped at one level

### Verification

1. Fresh account → five seeded categories with correct kinds
2. Add Groceries and Eating Out under Food — Food shows no budget field
3. Archive Food — both children disappear from pickers
4. `npm test` passes

---

## Chunk 5 — Quick-add

**Depends on: Chunks 3, 4.**

The most-used screen in the app: roughly 200 entries a month against one payday plan. Everything
else bends to its speed.

### Hard requirement

**≤ 3 taps and ≤ 5 seconds for a typical expense.** This is asserted by a test, not assumed.
Amount → category chip → save. The account defaults to the last one used.

### Behaviour

- Numeric keypad is focused on open; no form-field hunting.
- Category chips ordered by recency then frequency; full list behind a search field.
- Account defaults to last used, changeable in one tap.
- Optional note, collapsed by default.
- Income uses the same flow with the sign flipped.
- **Category is mandatory** — no Miscellaneous fallback.
- Writes locally and closes immediately; the Supabase push happens in the background.
- `own_share` equals `amount` here. Splits arrive in Chunk 12.

### Files

| File | Change |
|---|---|
| `js/screens/quickadd.js` | New |
| `js/store.js` | `addTransaction()` |
| `index.html` | Quick-add sheet, keypad, chip row |
| `css/components.css` | Keypad, chips |
| `tests/quickadd.spec.js` | New |

### Spec coverage

- **Expense logged in 3 taps** (amount, category chip, save)
- Save-to-close completes under the perf budget
- Chips are ordered by recency, then frequency
- Account defaults to the last used and is overridable
- Save is refused with no category
- Entry appears in the cache before any network response
- Income increases the balance; expense decreases it

### Verification

1. Open quick-add — keypad focused, chips visible
2. Log RM12 Food in three taps
3. Kill the network, log another — it still saves and syncs later
4. Try to save without a category — blocked with a clear message
5. `npm test` passes

---

## Chunk 6 — PWA

**Depends on: Chunk 2 (data layer — shipped).**

Installable to the phone home screen so daily logging can become a habit before the rest of the
app exists.

### Implementation

- `manifest.json` — standalone display, dark theme, 192/512 icons.
- `sw.js` — app shell cached on install; **network-first for local files** so no cache busting is
  needed on deploy. **Never cache Supabase requests** — stale financial data is worse than none.
- Register with `navigator.serviceWorker.register('./sw.js').catch(() => {})`.

### Files

| File | Change |
|---|---|
| `manifest.json`, `sw.js`, `icons/` | New |
| `index.html` | Manifest link, theme-color, SW registration |
| `tests/pwa.spec.js` | New |

### Spec coverage

- Manifest is served and valid
- Service worker registers
- App shell loads from cache when offline
- Supabase requests are never served from cache

### Verification

1. Install to home screen — opens without browser chrome
2. Go offline and relaunch — the app shell still loads
3. Lighthouse: installable, Accessibility ≥ 95
4. `npm test` passes

---

## Chunk 7 — Transfers and the `own_share` rule

**Depends on: Chunk 5.**

Move money between accounts, and encode the rule that separates cash movement from spending.

### The rule

A transfer consumes budget **only if that money has never been counted as an expense anywhere**.

| Transfer | `own_share` | Consumes budget |
|---|---|---|
| Bank → Savings | 0 | No — the money is still yours |
| Bank → Credit card bill | 0 | No — already counted when you swiped |
| Bank → Car loan | full amount | **Yes** — the car predates the app |

Implemented by account type: `spendingBacked` liabilities contribute `own_share = 0`;
`debtServicing` liabilities require a category and set `own_share = amount`.

### Files

| File | Change |
|---|---|
| `js/screens/quickadd.js` | Transfer mode |
| `js/calc.js` | `budgetImpact(transaction)` |
| `tests/transfers.spec.js` | New |

### Spec coverage

- A transfer moves both balances and never appears as income
- Savings transfer contributes nothing to any category
- Transfer to a debt-servicing account requires a category and consumes budget
- Transfer to a spending-backed account consumes no budget
- Transferring to the same account is refused

### Verification

1. Bank → Savings — balances move, no budget touched
2. Bank → Car Loan — Car Loan category consumes the full amount
3. `npm test` passes

---

## Chunk 8 — Credit card and hire-purchase loan

**Depends on: Chunk 7.**

The two liability accounts, which behave differently on purpose.

### Credit card (spending-backed)

- Purchases raise the outstanding balance and hit the budget once, at purchase.
- Paying the bill is a transfer that consumes **no** budget — it would otherwise double-count.
- `due_day` drives a reminder via the Due inbox in Chunk 17.

### Hire-purchase loan (debt-servicing)

Malaysian fixed-rate HP: interest is baked in at signing, so there is no amortisation split.

```
outstanding = instalment_amount × (instalments_total − instalments_paid)
```

- Setup takes three inputs: instalment amount, total instalments, instalments already paid.
- Derived: payments remaining, payoff month, total remaining.
- Each payment reduces the outstanding by exactly one instalment **and** consumes its Fixed
  category budget.
- Progress display: *"Payment 23 of 84 · RM 61,000 left · paid off Mar 2032"*.

### Files

| File | Change |
|---|---|
| `js/screens/accounts.js` | Card and loan fields, loan progress |
| `js/calc.js` | `loanOutstanding()`, `loanProgress()`, `cardOutstanding()` |
| `tests/liabilities.spec.js` | New |

### Spec coverage

- Three card purchases raise the outstanding by their total
- Paying the card bill lowers the outstanding and consumes no budget
- Budget is charged exactly once per card purchase
- Loan outstanding equals instalment × remaining
- A loan payment drops the outstanding by exactly one instalment
- A loan payment consumes its Fixed category budget
- Payoff month is calculated correctly
- Overpaying a loan beyond its total is refused

### Verification

1. Three card purchases plus a bill payment — outstanding correct, budget charged once
2. Loan set to 84 total / 22 paid — shows payment 23, correct remaining and payoff month
3. `npm test` passes

---

## Chunk 9 — Ledger list and reconcile

**Depends on: Chunk 5.**

Browse, correct and audit history.

### Behaviour

- Reverse-chronological list grouped by day, with a running daily total.
- Filter by account, category, type and date range; free-text search across notes.
- Edit and delete, with balances and budgets recomputed.
- **Reconcile view:** enter the real balance from your bank; the app shows the difference and the
  candidate transactions around it. **It never creates a plug entry** — the user finds the real
  missing transaction. A wrong balance means a missing fact, not a number to overwrite.

### Files

| File | Change |
|---|---|
| `js/screens/ledger.js` | New |
| `index.html` | Ledger + reconcile screens |
| `tests/ledger.spec.js`, `tests/reconcile.spec.js` | New |

### Spec coverage

- Grouped by day with correct daily totals
- Each filter narrows correctly; filters combine
- Search matches notes and category names
- Editing an amount updates the balance and the category total
- Deleting reverses its effects
- Reconcile reports the difference and offers **no** adjustment entry
- Reconcile reports a match when balances agree

### Verification

1. Log entries across several days — grouping and totals correct
2. Filter by account, then add a category filter
3. Edit an amount — balance and budget both follow
4. Reconcile with a deliberate discrepancy — difference shown, no plug offered
5. `npm test` passes

---

## Chunk 10 — First-run setup

**Depends on: Chunks 3, 4, 8.**

A short wizard that makes the clean switch from Money Manager possible in one sitting.

### Steps

1. Welcome — what the app is for, in one sentence.
2. Confirm or edit the seeded categories, marking each Fixed or Variable.
3. Enter today's real balance for each account; add or remove accounts.
4. Optional: add the car loan (instalment, total, already paid).
5. Optional: add the credit card and its due day.
6. Done — land on quick-add.

Skippable and resumable. Sets `bcv2_setup_complete`.

### Files

| File | Change |
|---|---|
| `js/screens/setup.js` | New |
| `index.html` | Wizard screens |
| `tests/setup.spec.js` | New |

### Spec coverage

- Wizard shows on first run only
- Opening balances persist to the right accounts
- Loan setup produces the correct outstanding
- Skipping still leaves a usable app
- Progress is resumable after a reload

### Verification

1. Fresh account → wizard appears
2. Complete it — balances, loan and card all correct
3. Reload mid-wizard — resumes in place
4. `npm test` passes

---

## Chunk 11 — People

**Depends on: Chunk 2 (data layer — shipped).**

Lightweight contacts for shared expenses. Free-text names, no address book integration.
Create, rename, archive; recent names surface first at entry time.

**Files:** `js/screens/people.js`, `index.html`, `tests/people.spec.js`.

**Spec coverage:** create / rename / archive; recency ordering; a person with open debts cannot
be deleted; duplicate names are rejected.

---

## Chunk 12 — Splits

**Depends on: Chunks 11, 5.**

The feature Money Manager cannot do, and the reason this app exists.

You paid RM100, your share was RM30, two friends owe RM70. All three facts stay true at once:

| Fact | Value |
|---|---|
| `amount` (cash out) | 10000 |
| `own_share` (budget) | 3000 |
| Receivable | 7000 across two people |

### Behaviour

- "Split" is one tap from the quick-add sheet; it must not slow the ordinary path.
- Default: even split among the selected people **including you**. Custom amounts override.
- Only `own_share` touches the budget and the daily pace.
- Receivables are visible per person and in a running total.

**Files:** `js/screens/quickadd.js`, `js/screens/debts.js`, `js/calc.js`
(`splitShares()`, `receivableTotal()`), `tests/splits.spec.js`.

### Spec coverage

- RM100 split three ways → `own_share` 3333, receivable 6667
- Custom shares must sum to the total
- Only `own_share` hits the category budget
- Full `amount` leaves the account
- Split adds no more than 2 taps to the entry flow
- A receivable never appears as income

---

## Chunk 13 — Payables

**Depends on: Chunk 12.**

The reverse case: a friend paid and you owe your share.

- No cash leaves your account, but `own_share` **still counts as your expense** — the budget must
  see it.
- Creates a payable against that person.
- Paying them back is a settlement, not a second expense.

**Files:** `js/screens/quickadd.js`, `js/calc.js` (`payableTotal()`), `tests/payables.spec.js`.

### Spec coverage

- Friend-paid entry leaves balances untouched but charges the budget
- A payable is created for the right person
- Settling it moves cash and charges the budget nothing
- Payables and receivables against the same person net off

---

## Chunk 14 — Settlements and write-offs

**Depends on: Chunks 12, 13.**

- **Partial repayments** — a debt tracks `amount`, `settled` and `remaining`.
- **Write-off** — converts the remaining balance into a real expense **dated at write-off**,
  because you did end up bearing it.
- **Net position per person** — if Ali owes you RM30 and you owe Ali RM20, show RM10 owed to you.
- Per-person history of every shared item and settlement.

**Files:** `js/screens/debts.js`, `js/calc.js` (`personNetPosition()`, `settleDebt()`,
`writeOffDebt()`), `tests/settlements.spec.js`.

### Spec coverage

- Partial settlement reduces the remaining balance and leaves the debt open
- Settling in full closes it
- Over-settling is refused
- A write-off creates an expense for the remaining amount, dated today
- A written-off debt cannot be settled afterwards
- Net position nets both directions
- Settlement cash lands in the chosen account

> **Cut over from Money Manager here, on a month boundary.**

---

## Chunk 15 — Monthly budgets

**Depends on: Chunk 4.**

Set a monthly budget per leaf category, pre-filled from the previous month so a new month is
confirmed rather than authored — the single biggest friction in v1.

- Parent rows show the sum of their children.
- Totals split by Fixed and Variable; Variable feeds the daily pace in Chunk 18.
- Copy-forward runs on first visit to a new month and is fully editable.

**Files:** `js/screens/plan.js`, `js/calc.js` (`monthBudgets()`, `budgetTotals()`),
`tests/budgets.spec.js`.

### Spec coverage

- A new month copies the previous month's budgets
- Copy-forward runs once and never overwrites edits
- Parent totals equal the sum of children
- Fixed and Variable totals are reported separately
- Archived categories are excluded

---

## Chunk 16 — Payday plan

**Depends on: Chunk 15.**

Payday is not fixed, so this is **triggered by logging income**, not by a date.

- Logging income offers: *"Plan this month?"*
- Savings comes off the top: spendable = income − savings − fixed.
- The savings transfer is a **reminder only** — the user moves the money in their bank app and
  confirms it here, turning an intention into a logged event.
- Shows what is left to allocate across Variable categories.

**Files:** `js/screens/plan.js`, `js/store.js` (`monthPlan`), `tests/plan.spec.js`.

### Spec coverage

- Logging income prompts to plan
- Spendable = income − savings − fixed
- Savings reminder appears until confirmed
- Confirming records the date and stops the reminder
- Over-allocating warns but is permitted
- The plan survives a reload

---

## Chunk 17 — Scheduled items and the Due inbox

**Depends on: Chunks 8, 15.**

Kills v1's biggest complaint: re-entering the same items every month.

- Define recurring items with an amount, category, account and day of month.
- On the due date an instance is auto-created as **pending**.
- The Due inbox confirms with one tap; the amount is editable first for variable bills.
- **Balances move only on confirmation** — the user pays manually, so confirming reflects
  something that genuinely happened.
- Skipping is recorded, not silently dropped.
- Credit card due dates use the same mechanism.

**Files:** `js/screens/due.js`, `js/store.js`, `js/calc.js` (`pendingInstances()`),
`tests/scheduled.spec.js`.

### Spec coverage

- An instance is created on the due date
- Pending items do not move balances
- Confirming creates the transaction and moves the balance
- Editing the amount before confirming is honoured
- Skipping records the status and creates nothing
- Instances are never duplicated on repeated boots
- Card due dates appear in the inbox

---

## Chunk 18 — Daily pacing

**Depends on: Chunks 15, 5.**

The number the whole app exists to produce.

```
category daily pace = remaining category budget ÷ days left in month
```

- **Variable categories only.** Fixed is excluded — rent is not spread across 30 days.
- Recomputed daily, which gives the agreed behaviour for free: overspend shrinks the days ahead,
  underspend rolls forward. No separate rollover logic.
- Home shows one headline figure — today's total allowance across Variable categories — with a
  per-category drill-down.
- Negative remaining reads *"over by RM X"*, never a negative pace.
- Reimbursable portions never consume pace, because pace is driven by `own_share`.

**Files:** `js/screens/home.js`, `js/calc.js` (`categoryDailyPace()`, `dailyAllowance()`,
`spentToday()`), `tests/pacing.spec.js`.

### Spec coverage

- Pace equals remaining ÷ days left
- Fixed categories are excluded
- Overspending today lowers tomorrow's pace
- Underspending raises it
- Negative remaining renders as "over by", not a negative number
- A split charges pace only its `own_share`
- The last day of the month divides by 1, not 0

---

## Chunk 19 — Log-time warnings

**Depends on: Chunk 18.**

Warn while the decision is still being made — not in a report afterwards.

| Trigger | Level |
|---|---|
| Entry pushes today's category spend past 80% of its pace | Caution |
| Entry pushes today past 100% of pace | Warning |
| Entry pushes the month past 90% of the category budget | Warning |
| Entry exceeds the monthly budget | Over |

- Shown live on the quick-add sheet as the amount is typed.
- **Always allows the entry.** It is the user's money; the job is to make the consequence
  visible, not to refuse.
- No guilt language. State the number and its consequence.

**Files:** `js/screens/quickadd.js`, `js/calc.js` (`warningLevel()`), `css/components.css`,
`tests/warnings.spec.js`.

### Spec coverage

- Each threshold produces the right level
- Save is never blocked at any level
- The warning updates live as the amount changes
- Fixed categories produce no pace warning
- Warning copy contains no guilt language (asserted against a word list)

---

## Chunk 20 — Staleness

**Depends on: Chunk 18.**

A confidently wrong number is worse than no number. If logging lapses, say so.

- Track the last entry date; show *"last logged 3 days ago"* when it exceeds a day.
- Past 2 days, de-emphasise the headline figure and offer a catch-up flow.
- Catch-up: a fast multi-entry path for backfilling several days at once.

**Files:** `js/screens/home.js`, `js/calc.js` (`stalenessDays()`), `tests/staleness.spec.js`.

### Spec coverage

- Same-day logging shows no indicator
- Two days idle shows the indicator and de-emphasises the number
- Catch-up accepts back-dated entries
- Backfilling recomputes pace correctly

---

## Chunk 21 — History

**Depends on: Chunk 15.**

Browse past months: budget vs actual per category, savings achieved, month-over-month trend for
the categories that matter. Read-only.

---

## Chunk 22 — Savings goals

**Depends on: Chunk 16.**

Named goals (emergency fund, holiday) with target amounts and monthly contributions, fed by the
savings taken off the top each payday.

---

## Chunk 23 — Insights

**Depends on: Chunk 21.**

Small, specific observations rather than charts: which category most often overruns, what your
true average monthly spend is, how much of your spending is reimbursable.

---

## Chunk 24 — Export

**Depends on: Chunk 9.**

CSV and JSON export of every table. The user declined this at planning time, but with a clean
switch and no migration this app becomes the sole financial record — worth adding before the
history gets long enough to hurt.

---

## Chunk 25 — Early settlement rebate

**Depends on: Chunk 8.**

Malaysian hire purchase early settlement uses the Rule of 78 to rebate unearned interest.
Would let the app answer "what if I paid the car off now?".
