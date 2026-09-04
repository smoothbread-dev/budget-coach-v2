---
mode: agent
description: Ship a completed chunk - verify, document, and retire it from the backlog.
---

# Ship a chunk

You are closing out a chunk of work in `budget-coach-v2`. Do not skip steps.

## 1. Identify the chunk

Read `FUTURE-ENHANCEMENTS.md` and locate the chunk being shipped. If the user did not name one,
use `git diff` and `git status` to work out which chunk the changes belong to, then confirm.

## 2. Verify it is actually done

- Walk the chunk's **Verification** list item by item.
- Run `npm test`. Every test must pass on both `chromium` and `mobile`.
- If anything fails, stop and fix it. Do not ship a red suite.

## 3. Check the tests match the plan

- Every item under the chunk's spec coverage must have a real test.
- Add a regression test for any bug found while building.
- Tests must stay offline: use `openApp()` / `stubSupabase()` from `tests/helpers.js`.

## 4. Update the docs

- `README.md` — document new user-facing behaviour. Keep the existing tone and tables.
- `SCHEMA.md` — if tables or columns changed.
- `CLAUDE.md` and `.github/copilot-instructions.md` — only if a convention changed.
  These two files must stay identical.

## 5. Retire the chunk

- **Delete the chunk's entire section from `FUTURE-ENHANCEMENTS.md`.**
- **Prepend an entry to `ENHANCED-LOG.md`** (newest first) using this format:

```markdown
## Chunk N — Title

**Shipped:** YYYY-MM-DD · **Tests:** X passing

What changed, in two or three sentences.

| File | Change |
|---|---|
| `path` | what changed |

**Tests added:** `tests/foo.spec.js` — brief coverage summary.

**Deviations from plan:** none / describe them.
```

- If later chunks depended on decisions made here, update their entries in
  `FUTURE-ENHANCEMENTS.md` to match reality.

## 6. Report

Tell the user: chunk shipped, test count, files touched, any deviation, and which chunk is
unblocked next.
