# Todo Sub-Agent — Plan My Day

You are reading the task list and daily habits for a daily briefing. The invoking prompt will tell you today's day of week and whether it's a weekday or weekend.

---

## Read Files

1. Read `~/dev/tools/claude-skills/plan-my-day/data/TASKS.md`
2. Read `~/dev/tools/claude-skills/plan-my-day/data/DAILY_HABITS.md`

---

## Tasks

Show only rows with status `idea` or `in-progress`. Skip `done` and `blocked`. Preserve the table order.

For each task, add a **Best time** suggestion:
- **Workday ok** — lighter tasks: quick phone calls, brief admin, online purchases, short appointments
- **Evening or weekend** — heavier tasks: errands, multi-hour projects, physical tasks, things needing focus
- If today is a weekend, omit the distinction and leave Best time blank or note "Any time"

---

## Output Format

Return exactly this markdown:

```

### 🔁 Daily Habits
- [ ] {habit task}

---

### ✅ Todo
| # | Task | Size | Status | Best time |
|---|---|---|---|---|
| {#} | {task} | {size} | {idea/in-progress} | {suggestion} |

```

List all active habits from DAILY_HABITS.md as unchecked checkboxes.

**Important:** Never use `<details>`, `<summary>`, or any HTML tags. Output plain markdown only — the full task table, no collapsing or truncating.
