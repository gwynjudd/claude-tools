---
name: plan-my-day
description: >
  Load this skill when the user asks to plan their day, get a morning briefing, see what's
  on today, or asks "what's on today" / "plan my day" / "what do I have on". Combines
  today's calendar, recent emails, and open todo items into a single morning digest.
---

# Plan My Day

Produces a unified morning briefing: calendar events, email digest, and todo/habits.

---

## Step 1: Initialise (all three in parallel)

```bash
~/dev/tools/claude-skills/plan-my-day/scripts/record-last-run.sh
```

```bash
~/dev/tools/claude-skills/plan-my-day/scripts/fetch-emails.sh
```

Call `mcp__gcal__get-current-time` with `timeZone: "Pacific/Auckland"`. From the result, derive:
- `dateLabel` — human-readable, e.g. `Saturday, 12 April 2026`
- `dayOfWeek` — e.g. `Saturday`
- `isWeekday` — true if Mon–Fri
- `yesterday` — the NZ calendar day before today
- `todayMin` — today at `00:00:00` (NZ time, ISO 8601)
- `todayMax30` — today + 30 days at `23:59:59` (NZ time, ISO 8601)
- `yesterdayMin` / `yesterdayMax` — yesterday at `00:00:00` / `23:59:59`

The `fetch-emails.sh` script outputs a compact text digest:
- `PRE-CLASSIFIED (N emails):` — one line per email with category already assigned
- `UNCLASSIFIED (N emails):` — emails needing AI classification, with ID, sender, subject, and snippet

Keep this output for Step 3.

---

## Step 2: Launch three sub-agents in parallel

Send a single message with all three Agent tool calls.

**Agent 1 — Calendar** (`subagent_type: "plan-my-day-calendar"`):
```
Today is {dateLabel} ({dayOfWeek}).
Yesterday range: {yesterdayMin} to {yesterdayMax}.
Today+30 range: {todayMin} to {todayMax30}.
Today is {"a weekday" if isWeekday else "a weekend"}.
Fetch calendar events and return the formatted calendar section.
```

**Agent 2 — Todo** (`subagent_type: "plan-my-day-todo"`):
```
Today is {dayOfWeek}. {"It is a weekday." if isWeekday else "It is a weekend — no workday constraints."}
Read the task list and habits. Return the formatted todo and habits sections.
```

**Agent 3 — Google Tasks Sync** (`subagent_type: "plan-my-day-gtasks-sync"`):
```
Sync Google Tasks into the task DB. Add any new tasks not already in the DB, mark completed Google Tasks as done, and update titles/dates where Google differs. Return a one-line summary.
```

Keep the Google Tasks sync result for Step 3.

---

## Step 3: Classify emails and compile

### Email classification

Using the JSON from Step 1, classify emails following the rules in
`~/dev/tools/claude-skills/email-summary/SKILL.md` Steps 3–3b (AI classification,
attachment downloads). Use period label `last 24 hours`.

Format the email section as:

```
### 📧 Emails
| Priority | From | Subject | Action |
|---|---|---|---|
| 🔴/🟡/🟢 | {sender name} | {subject} | {one-line action or "No action needed"} |
```

Priority: 🔴 immediate action · 🟡 act soon · 🟢 informational.
Omit DISCARD emails. If nothing notable: `_Nothing notable in the last 24 hours._`

### Compile and present

```
## Plan My Day — {dateLabel}

{calendar result}

---

{email section}

---

{todo result}
```

If the Google Tasks sync result is anything other than `nothing new`, append it as a italic footnote after the todo section:
```
_Sync: {gtasks sync result}_
```

**Work context note:** if today is a weekday and the calendar result includes a "Heads up" about office/home events, make sure it's visible after the Today table.

After presenting, offer to act on anything (reply to email, update a task, create a calendar event) and ask if they'd like to dig into anything.

---

## Notes

- Task mutations (marking done, adding tasks, etc.) are handled by the main agent after the briefing — not by sub-agents
- If a script or sub-agent fails, note it in the briefing and continue with the others

---

## Task mutations (during or after briefing)

All task reads and writes go through the CLI scripts in `scripts/`.

### Adding a task

```bash
~/dev/tools/claude-skills/plan-my-day/scripts/task-add.sh \
  --title "..." --size S [--eta YYYY-MM-DD] [--status idea]
```

Returns JSON with the new task including its `id`.

After adding, check if it qualifies for Google Tasks:
- Has a future `eta`, **or**
- Is likely actionable away from home (phone calls, purchases, errands, bookings, appointments)

If it qualifies, offer: _"Should I also add this to Google Tasks so it's on your phone?"_

On confirmation:
1. Call `mcp__gtasks__task_create` with `title` and, if a date is set, `due` in RFC 3339 format (`YYYY-MM-DDT00:00:00Z`)
2. Store the returned Google task `id`:

```bash
~/dev/tools/claude-skills/plan-my-day/scripts/task-update.sh {id} --external-id "{google_task_id}"
```

### Completing a task

```bash
~/dev/tools/claude-skills/plan-my-day/scripts/task-complete.sh {id|slug}
```

If the task has a non-null `external_id`, also call `mcp__gtasks__task_update` with `status: "completed"`.

### Updating a task

```bash
~/dev/tools/claude-skills/plan-my-day/scripts/task-update.sh {id|slug} [--title "..."] [--eta YYYY-MM-DD] [--status ...]
```

If the task has a non-null `external_id`, mirror title/date changes to Google automatically via `mcp__gtasks__task_update`.
