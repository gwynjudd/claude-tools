# Plan: Self-contained `pmd gtasks-sync` using Google Tasks REST API

## Context

The `plan-my-day-gtasks-sync` sub-agent currently:
1. Calls `mcp__gtasks__task_list` (an MCP tool) to fetch tasks
2. Manually constructs a JSON array from the result
3. Passes that JSON to `pmd gtasks-sync '<json>'`

This is wasteful: it spends AI tokens on a mechanical JSON construction step, and uses MCP instead of the same shared OAuth library that the calendar and email skills already use.

The goal is to make `pmd gtasks-sync` self-contained — it fetches from the Google Tasks REST API directly, syncs to the DB, and returns the summary string. The sub-agent then becomes a trivial one-liner.

---

## Changes

### 1. `tools/package.json` — add google-oauth dependency

Add `@gwynj/google-oauth` as a local file dependency (same pattern as calendar-summary):

```json
"dependencies": {
  "better-sqlite3": "^12.0.0",
  "@gwynj/google-oauth": "file:../../../google-oauth"
}
```

After editing, run `npm install` in the `tools/` directory.

---

### 2. `tools/src/commands/gtasks-sync.ts` — add fetch logic

**Add** an import at the top:
```typescript
import { getAccessToken } from '@gwynj/google-oauth';
```

**Add** types and fetch helpers above `syncGoogleTasks`:
```typescript
interface GTaskListItem { id: string; title: string; }
interface GTaskItem {
  id: string;
  title: string;
  status: 'needsAction' | 'completed';
  due?: string;
}

async function tasksGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Tasks API ${res.status} on ${path}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function fetchGoogleTasks(): Promise<GTask[]> {
  const token = await getAccessToken('tasks');
  const lists = await tasksGet<{ items?: GTaskListItem[] }>(token, '/users/@me/lists');
  const listIds = (lists.items ?? []).map(l => l.id);
  const taskPages = await Promise.all(
    listIds.map(id =>
      tasksGet<{ items?: GTaskItem[] }>(token, `/lists/${id}/tasks?showCompleted=true&showHidden=false`)
    )
  );
  return taskPages.flatMap(p => (p.items ?? []).map(item => ({
    id: item.id,
    title: item.title,
    status: item.status,
    ...(item.due ? { due: item.due } : {}),
  })));
}
```

**Replace** the `gtasksSync` CLI entry point — remove `readStdin` and the JSON-from-argv logic:
```typescript
export async function gtasksSync(_argv: string[], repo: TaskRepository): Promise<string> {
  const gTasks = await fetchGoogleTasks();
  return syncGoogleTasks(gTasks, repo);
}
```

Remove the now-unused `readStdin()` helper.

Note: `syncGoogleTasks` (the pure sync function) is **unchanged** — existing unit tests continue to pass.

---

### 3. `scripts/gtasks-sync.sh` — no changes needed

Already calls `pmd_run gtasks-sync "$@"` with no JSON argument. Will work correctly once `pmd gtasks-sync` fetches data itself.

---

### 4. `sub-agents/gtasks-sync.md` — simplify to one step

Replace the entire three-step MCP/JSON/script flow with:

```markdown
# Google Tasks Sync Sub-Agent — Plan My Day

Run this command and return its output verbatim:

```bash
~/dev/tools/claude-skills/plan-my-day/scripts/gtasks-sync.sh
```

Do not add any other output.
```

---

### 5. `~/.claude/agents/plan-my-day-gtasks-sync.md` — remove MCP tools

The agent registration currently lists `mcp__gtasks__task_list` and `mcp__gtasks__tasklist_list` in its tools. Remove them — the sub-agent now only needs `Bash`:

```markdown
---
name: plan-my-day-gtasks-sync
description: Syncs Google Tasks into the SQLite task DB for the plan-my-day briefing. Only invoke from the plan-my-day skill.
model: haiku
tools: Read, Bash
---

Read ~/dev/tools/claude-skills/plan-my-day/sub-agents/gtasks-sync.md and follow those instructions exactly.
```

---

## Files to modify

| File | Change |
|------|--------|
| `tools/claude-skills/plan-my-day/tools/package.json` | Add `@gwynj/google-oauth` dependency |
| `tools/claude-skills/plan-my-day/tools/src/commands/gtasks-sync.ts` | Add fetch logic, remove stdin/argv JSON input |
| `tools/claude-skills/plan-my-day/sub-agents/gtasks-sync.md` | Replace 3-step MCP flow with single script call |
| `~/.claude/agents/plan-my-day-gtasks-sync.md` | Remove `mcp__gtasks__task_list` and `mcp__gtasks__tasklist_list` from tools |

**Not changed:** `scripts/gtasks-sync.sh`, `SKILL.md`, `cli.ts`, all tests.

---

## Notes

- **All task lists** are fetched (not just "My Tasks"). This matches the spirit of "full sync" and is a slight improvement over the current behaviour, which only fetched the default list.
- If the tasks token hasn't been initialised, `getAccessToken('tasks')` throws with a helpful message directing the user to run reauth. The SKILL.md already handles sub-agent failures gracefully.
- The `syncGoogleTasks` pure function and its unit tests are untouched.

---

## Verification

1. `cd ~/dev/tools/claude-skills/plan-my-day/tools && npm install && npm run build` — should compile cleanly
2. `npm test` — all existing unit tests should pass
3. `pmd gtasks-sync` — should fetch from Google Tasks API and print a sync summary
4. Run `/plan-my-day` — the gtasks-sync sub-agent result should appear as a footnote in the briefing
