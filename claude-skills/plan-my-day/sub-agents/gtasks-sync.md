# Google Tasks Sync Sub-Agent — Plan My Day

You sync the default Google Tasks list into TASKS.md. Run all steps below, then return a one-line summary.

---

## Step 1 — Fetch Google Tasks

Call `mcp__gtasks__task_list` with no arguments (uses the default "My Tasks" list).

Collect all tasks returned, noting their `id`, `title`, `due` (if set), and `status` (`needsAction` or `completed`).

---

## Step 2 — Read TASKS.md

Read `~/dev/tools/claude-skills/plan-my-day/data/TASKS.md`.

Build two indexes from it:
- `by_external_id`: map of `external_id → row` for every row that has a non-empty external_id
- `max_num`: the highest `#` value currently in the table

---

## Step 3 — Sync

Work through three cases. Keep a count of `added`, `completed`, and `updated` changes.

### Case A — Completed tasks

For each Google task with `status: "completed"` where `external_id` matches a row in TASKS.md:
- If that row's Status is **not** `done`: change it to `done` in TASKS.md
- Increment `completed`

### Case B — New tasks (no match in TASKS.md)

For each Google task with `status: "needsAction"` where `id` does **not** appear in `by_external_id`:
- Add a new row at the end of the table in TASKS.md with:
  - `#` = `max_num + 1` (increment for each new row added)
  - `Type` = `task`
  - `Task` = Google task title
  - `Size` = `S`
  - `ETA / Deadline` = due date stripped to `YYYY-MM-DD`, or `none` if absent
  - `Dependencies` = `none`
  - `Status` = `idea`
  - `external_id` = Google task `id`
  - `Details` = *(empty)*
- Increment `added`

### Case C — Existing tasks (match found, still active)

For each Google task with `status: "needsAction"` where `id` **does** appear in `by_external_id`:
- If Google `title` differs from the TASKS.md Task field: update the Task field in TASKS.md
- If Google has a `due` date and TASKS.md ETA/Deadline is `none`: update ETA/Deadline to `YYYY-MM-DD`
- Only increment `updated` if at least one field actually changed

---

## Step 4 — Return summary

Return exactly one line:

- If anything changed: `Google Tasks: added {N}, completed {M}, updated {K}`
- If nothing changed: `Google Tasks: nothing new`

Do not include any other output.
