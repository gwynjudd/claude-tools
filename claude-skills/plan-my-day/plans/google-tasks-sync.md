# Plan: Google Tasks sync for plan-my-day

## Context

The plan-my-day skill currently reads tasks only from a local `TASKS.md` file. The user wants bidirectional sync with Google Tasks to support mobile capture: tasks created on the phone or away from home should flow into `TASKS.md` during the morning briefing, and tasks in `TASKS.md` with future dates / away-from-home relevance should be pushed to Google Tasks so they're accessible on mobile.

The `external_id` column in `TASKS.md` is already used to hold Google Tasks IDs (base64-encoded strings) for ~13 existing rows — the infrastructure is ready; it just isn't wired up yet.

---

## Approach Overview

1. **New sub-agent** (`plan-my-day-gtasks-sync`) — runs in Step 2 of plan-my-day alongside calendar and todo. Fetches Google Tasks, syncs new/completed tasks into `TASKS.md`, and returns a brief sync report.

2. **Outbound sync guidance in SKILL.md** — when the main agent creates or updates a task in `TASKS.md` *after* the briefing, it should offer to push it to Google Tasks if it qualifies (future ETA, or actionable away from home). If the task already has an `external_id`, it updates the existing Google Task.

3. **Settings update** — ensure the plan-my-day `.claude/settings.json` includes the gtasks tools the new sub-agent needs.

---

## Files to Create / Modify

| File | Change |
|---|---|
| `sub-agents/gtasks-sync.md` | **CREATE** — sync logic instructions (read by the agent at runtime) |
| `~/dev/.claude/agents/plan-my-day-gtasks-sync.md` | **CREATE** — agent registration (name, model, tools, pointer to sub-agents file) |
| `SKILL.md` | **MODIFY** — add gtasks-sync to Step 2 parallel launch; add outbound sync section |
| `.claude/settings.json` | **MODIFY** — add missing gtasks tool permissions |
| `~/dev/.claude/settings.json` | **MODIFY** — add outbound gtasks permissions for main agent |

No reusable scripts are needed — the sync logic is pure reasoning over structured data and MCP calls, handled inline by the sub-agent.

---

## 1. New agent + sub-agent

**Agent file** (`~/dev/.claude/agents/plan-my-day-gtasks-sync.md`):
```yaml
---
name: plan-my-day-gtasks-sync
description: Syncs Google Tasks into TASKS.md for the plan-my-day briefing. Only invoke from the plan-my-day skill.
model: haiku
tools: Read, Edit, mcp__gtasks__task_list, mcp__gtasks__tasklist_list
---

Read ~/dev/tools/claude-skills/plan-my-day/sub-agents/gtasks-sync.md and follow those instructions exactly.
```

**Sub-agent instructions file** (`sub-agents/gtasks-sync.md`) — contains the detailed sync logic below.

Sub-agent type name: `plan-my-day-gtasks-sync`

### Logic

**Step A — Fetch Google Tasks**
- Call `mcp__gtasks__task_list` using the default task list (`@default` / "My Tasks") — do not enumerate all lists
- Fetch tasks with both `needsAction` and `completed` status

**Step B — Read TASKS.md**
- Read `~/dev/tools/claude-skills/plan-my-day/data/TASKS.md`
- Build an index of `external_id → row number` for all rows that have an external_id

**Step C — Inbound sync (Google → TASKS.md)**

For each Google task with status `completed` that has a matching `external_id` in TASKS.md:
- Read the matching row's current status
- If it's not already `done`: change status to `done` in TASKS.md (do NOT move to COMPLETED_TASKS.md — let the main agent do that later)

For each Google task with status `needsAction` that has **no** matching `external_id` in TASKS.md:
- Add a new row at the end of TASKS.md using next available `#`
- Map fields: title → Task, due date → ETA/Deadline (strip time, format as YYYY-MM-DD or "none"), notes → omit (no Details file created), `id` → external_id
- Default values: Type=`task`, Size=`S`, Dependencies=`none`, Status=`idea`, Details=``

For each Google task with status `needsAction` that **does** have a matching `external_id` in TASKS.md:
- If the Google title differs from TASKS.md: update the Task field in TASKS.md (Google wins for title)
- Due date: if Google has a due date and TASKS.md shows "none", update ETA/Deadline

**Step D — Return summary**
Return a one-line report: `Google Tasks: added N, completed M, updated K` (or `nothing new` if no changes).

### What it does NOT do
- Does not overwrite Size, Dependencies, Status (unless completed), or Details fields — those are TASKS.md-only
- Does not delete from TASKS.md if deleted from Google

---

## 2. SKILL.md changes

### Step 2 — add third parallel sub-agent

Add **Agent 3 — Google Tasks Sync** (`subagent_type: "plan-my-day-gtasks-sync"`) alongside calendar and todo.

Prompt to pass:
```
Sync Google Tasks into TASKS.md. Add any new tasks not already in the file. Mark completed Google Tasks as done in TASKS.md. Return a one-line summary.
```

### Step 3 / Compile — include sync report

In the final compiled output, include the sync summary line under the Todo section or as a footer note (only if something changed; omit if `nothing new`).

### New section — Outbound sync (after briefing)

Add a section at the end of SKILL.md:

**When creating a new task in TASKS.md** (at user's request, during or after the briefing):
- If the task has a future `ETA / Deadline` OR is likely actionable away from home (phone calls, purchases, errands, appointments): offer to also create it in Google Tasks
- On confirmation: call `mcp__gtasks__task_create` with title, due date (RFC 3339), and notes (if any). Write the returned task ID into `external_id` in TASKS.md.

**When updating an existing task in TASKS.md** that has an `external_id`:
- Mirror the relevant change to Google Tasks via `mcp__gtasks__task_update` — title, due date, or status as appropriate
- If status is changed to `done`: call `mcp__gtasks__task_update` with `status: "completed"`

---

## 3. Settings changes

### `plan-my-day/.claude/settings.json`
Add to the existing gtasks allow list:
- `mcp__gtasks__tasklist_get`
- `mcp__gtasks__task_move`

### `~/dev/.claude/settings.json`
Ensure the main agent has access to:
- `mcp__gtasks__task_create`
- `mcp__gtasks__task_update`
- `mcp__gtasks__tasklist_list`

(these are needed for outbound sync which the main agent handles, not the sub-agent)

---

## Sync rules summary

| Direction | Trigger | Source of truth |
|---|---|---|
| Google → TASKS.md (new tasks) | Every plan-my-day run | Google Tasks |
| Google → TASKS.md (completions) | Every plan-my-day run | Google Tasks |
| Google → TASKS.md (title updates) | Every plan-my-day run | Google Tasks |
| TASKS.md → Google (new tasks) | User creates task matching outbound criteria | User confirms |
| TASKS.md → Google (updates) | User updates task with external_id | TASKS.md |

TASKS.md fields (size, dependencies, details, etc.) are never overwritten by inbound sync — Google only contributes title, due date, and completion status.

---

## Verification

1. Run `/plan-my-day` — the briefing should include a `Google Tasks: added N, completed M` line
2. Manually create a task on phone, then run plan-my-day — new task appears in TASKS.md with external_id populated
3. Complete a Google Task on phone, run plan-my-day — matching TASKS.md row status changes to `done`
4. Ask Claude to add a task with a future date — it should offer to push to Google Tasks, and after confirmation the external_id should be set in TASKS.md
5. Update the title of a task that has an external_id — the matching Google Task title should update
