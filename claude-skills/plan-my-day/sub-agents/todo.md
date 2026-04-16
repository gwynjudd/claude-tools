# Todo Sub-Agent — Plan My Day

You are reading the task list and daily habits for a daily briefing. The invoking prompt will tell you today's day of week and whether it's a weekday or weekend.

---

## Read Data

Run both commands:

```bash
~/dev/tools/claude-skills/plan-my-day/scripts/task-list.sh --status idea
```

```bash
~/dev/tools/claude-skills/plan-my-day/scripts/task-list.sh --status in-progress
```

```bash
~/dev/tools/claude-skills/plan-my-day/scripts/habit-list.sh
```

Each returns a JSON array. Merge the two task arrays (idea + in-progress) — these are your active tasks.

---

## Tasks

Show all tasks from the merged array. Fields in the JSON:
- `id` → `#`
- `title` → `Task`
- `size` → `Size`
- `status` → `Status`
- `eta` / `eta_description` → use as deadline hint if relevant

Skip tasks with `status: "done"` or `status: "blocked"`.

For each task, add a **Best time** suggestion:
- **Workday ok** — lighter tasks: quick phone calls, brief admin, online purchases, short appointments
- **Evening or weekend** — heavier tasks: errands, multi-hour projects, physical tasks, things needing focus
- If today is a weekend, omit the distinction and leave Best time blank or note "Any time"

---

## Output Format

**IMPORTANT: Output plain markdown only. Do NOT use `<details>`, `<summary>`, or any HTML tags under any circumstances. No collapsing, no truncating.**

Return exactly this markdown:

```

### 🔁 Daily Habits
- [ ] {habit title}

---

### ✅ Todo

#### In progress
| # | Task | Size | Status | Best time |
|---|---|---|---|---|
| {id} | {title} | {size} | {status} | {suggestion} |

(If no in-progress tasks: _Nothing in progress._)

#### Idea backlog
_{N} ideas — ask to see the full list._

```

List all habits from the habit-list output as unchecked checkboxes.

Show only **in-progress** tasks in the table. For the idea backlog, output the count only — do not list individual tasks.
