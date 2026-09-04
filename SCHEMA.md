# Database Schema

Supabase (PostgreSQL + Auth). Every table is scoped by `user_id` with Row-Level Security so a
user can only read and write their own rows.

Money is stored as **integer cents** (`RM 12.34` → `1234`). Never store currency as a float.

Status: **in progress** — the client-side tables and local cache landed in C2 (data layer); the
remaining columns are added by the chunks that need them.

## `accounts`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `auth.users` |
| `name` | text | |
| `type` | text | `cash` · `bank` · `ewallet` · `credit_card` · `loan_hp` |
| `opening_balance` | bigint | cents; for liabilities this is the amount owed |
| `due_day` | int | credit card only, 1–31 |
| `instalment_amount` | bigint | `loan_hp` only |
| `instalments_total` | int | `loan_hp` only |
| `instalments_paid_at_setup` | int | `loan_hp` only |
| `archived` | bool | |
| `sort` | int | |

Hire purchase interest is baked in at signing, so `outstanding = instalment_amount × remaining`.
No amortisation schedule is needed.

## `categories`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | |
| `name` | text | |
| `parent_id` | uuid | nullable; one level only |
| `kind` | text | `fixed` · `variable` |
| `archived` | bool | |
| `sort` | int | |

Budgets sit on **leaves**. A parent's total is the sum of its children — parents have no cap.
`fixed` categories are excluded from daily pacing.

## `budgets`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | |
| `month` | text | `YYYY-MM` |
| `category_id` | uuid | leaf only |
| `amount` | bigint | cents |

Unique on (`user_id`, `month`, `category_id`). Pre-filled from the previous month.

## `transactions`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | |
| `date` | date | |
| `type` | text | `expense` · `income` · `transfer` |
| `amount` | bigint | cents of cash that actually moved |
| `own_share` | bigint | **cents that hit the budget** |
| `account_id` | uuid | source |
| `to_account_id` | uuid | transfers only |
| `category_id` | uuid | required for `expense`; set on debt-servicing transfers |
| `payer` | text | `me` or a `people.id` |
| `note` | text | |

`own_share` is the single source of budget truth.

## `people`
`id` · `user_id` · `name` · `archived`

## `splits`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `transaction_id` | uuid | |
| `person_id` | uuid | |
| `amount` | bigint | cents |
| `direction` | text | `owed_to_me` · `i_owe` |
| `written_off` | bool | |

## `settlements`
`id` · `split_id` · `date` · `amount` · `account_id` — supports partial repayment.

## `month_plans`
`id` · `user_id` · `month` · `income` · `savings_amount` · `savings_confirmed`

## `scheduled_items`
`id` · `user_id` · `name` · `category_id` · `account_id` · `to_account_id` · `amount`
· `day_of_month` · `type` · `active`

## `scheduled_instances`
`id` · `scheduled_item_id` · `month` · `status` (`pending` · `confirmed` · `skipped`)
· `transaction_id`

The balance moves only when an instance is **confirmed**.
