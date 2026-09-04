---
mode: agent
description: Bring tests and docs back in sync with recent code changes.
---

# Sync tests and docs

## 1. Find what changed

Run `git diff` and `git status`. List the behaviour that actually changed — not the diff itself.

## 2. Inventory the behaviour

Note anything that affects tests or docs:

- New or renamed DOM ids and screens
- New `bcv2_` localStorage keys or Supabase columns
- Changed money rules (`own_share`, pacing, warnings, balances)
- New user-facing flows

## 3. Update the tests

- Extend the matching `tests/*.spec.js`, or add a new spec.
- Reuse helpers from `tests/helpers.js`; add new domain helpers there rather than repeating setup.
- Keep everything offline — no real network, no real Supabase.
- Add a regression test for every bug fixed.
- Prefer testing `calc.js` directly when the change is arithmetic.

## 4. Update the docs

- `README.md` — user-facing behaviour, keeping the existing tables and tone.
- `SCHEMA.md` — schema changes.
- `CLAUDE.md` + `.github/copilot-instructions.md` — conventions only, and keep them identical.
- `FUTURE-ENHANCEMENTS.md` — remove anything now shipped; adjust chunks whose assumptions changed.

## 5. Verify

Run `npm test` and report the pass count. If a chunk is now complete, run `/ship-chunk`.
