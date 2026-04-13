# Todo List — Schema & Maintenance Instructions

This file contains instructions for maintaining the todo list. Task data lives in the sibling files:

- **`TASKS.md`** — active tasks (`idea`, `in-progress`, `blocked`)
- **`DAILY_HABITS.md`** — active daily habits (`recurring`)
- **`COMPLETED_TASKS.md`** — completed/done tasks (archive)
- **`todo/<N>-<slug>.md`** — detail files, one per task that needs them

---

## Table Schema

All task tables use this column format:

| # | Type | Task | Size | ETA / Deadline | Dependencies | Status | external_id | Details |
|---|------|------|------|----------------|--------------|--------|-------------|---------|

| Column | Description |
|--------|-------------|
| `#` | Unique incrementing integer ID |
| `Type` | `task` or `habit` |
| `Task` | Short description |
| `Size` | `XS` (<1hr) / `S` (half day) / `M` (1–2 days) / `L` (week+) / `XL` (open-ended) |
| `ETA / Deadline` | Specific date, relative phrase, or `none` |
| `Dependencies` | Other `#` items or external requirements, or `none` |
| `Status` | `idea` / `in-progress` / `blocked` / `done` / `recurring` |
| `external_id` | ID from an external system (e.g. Google Tasks), or blank |
| `Details` | `@<filename>.md` pointing to `data/todo/<filename>.md`, or blank |

---

## Trigger Phrases

When the user says any of the following, capture the task immediately:

- "Add X to the todo list"
- "I want to work on X in the future"
- "Put X on the list"
- "Make a note to X"
- Similar intent

**How to capture:**

1. Read `TASKS.md`
2. Assign the next available `#` (check all three tables for the highest existing number)
3. Ask for any missing fields if not clear from context (size, ETA, dependencies)
4. Add a row to `TASKS.md`
5. If the task has significant detail, create `data/todo/<N>-<slug>.md` and set the `Details` column to `@<N>-<slug>.md`

---

## Detail Files

Detail files live at `data/todo/<N>-<slug>.md`. Create one when:
- The task has research notes, checklists, or multi-step instructions
- The task is size M or larger with meaningful context to preserve

Detail files are only loaded into context when the task is being actioned — keep the main tables compact.

**Naming convention:** `<N>-<slug>.md` where slug is lowercase-hyphenated, e.g. `15-budget.md`

---

## Maintenance Rules

- `TASKS.md` and `DAILY_HABITS.md` must **never** contain `done` tasks
- When a task is completed: move its row to `COMPLETED_TASKS.md`, update `Status` to `done`
- `XS` completed tasks may be omitted from `COMPLETED_TASKS.md` (low reference value)
- When a task is started: update `Status` to `in-progress` in `TASKS.md`
- When asked to see the todo list: read and display `TASKS.md`
