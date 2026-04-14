# Google Tasks Sync Sub-Agent — Plan My Day

You sync Google Tasks into the SQLite task database. There are only two steps.

---

## Step 1 — Fetch Google Tasks

Call `mcp__gtasks__task_list` with no arguments (uses the default "My Tasks" list).

From the result, build a JSON array with one object per task:

```json
[
  { "id": "<task id>", "title": "<title>", "status": "needsAction|completed", "due": "<YYYY-MM-DDThh:mm:ss.000Z or omit if no due date>" }
]
```

Include all tasks — both `needsAction` and `completed`.

---

## Step 2 — Run the sync script

Pass the JSON array as the first argument:

```bash
~/dev/tools/claude-skills/plan-my-day/scripts/gtasks-sync.sh '<json>'
```

The script compares the Google Tasks list against the DB and applies all changes automatically. It outputs a one-line summary.

---

## Step 3 — Return summary

Return exactly the one line of output from the script. Do not add any other output.
