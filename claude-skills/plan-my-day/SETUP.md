# Plan My Day — Setup

One-time initialisation steps. Run these when setting up the skill in a new environment.

---

## 1. Register sub-agents

The skill uses four sub-agents launched in parallel during the briefing. Each needs an agent registration file so Claude Code can resolve the `subagent_type` name.

### User-level vs project-level

- **User-level** (`~/.claude/agents/`) — available in every workspace. Recommended for a personal daily tool.
- **Project-level** (`.claude/agents/` at your workspace root) — scoped to a single project.

Create one file per sub-agent in whichever location you choose.

---

### `plan-my-day-calendar.md`

```markdown
---
name: plan-my-day-calendar
description: Fetches and formats the calendar section for the plan-my-day briefing. Only invoke from the plan-my-day skill.
model: haiku
tools: Read, mcp__gcal__list-events
---

Read ~/dev/tools/claude-skills/plan-my-day/sub-agents/calendar.md and follow those instructions exactly.
```

---

### `plan-my-day-todo.md`

```markdown
---
name: plan-my-day-todo
description: Reads the todo list and daily habits for the plan-my-day briefing. Only invoke from the plan-my-day skill.
model: haiku
tools: Read, Bash
---

Read ~/dev/tools/claude-skills/plan-my-day/sub-agents/todo.md and follow those instructions exactly.
```

---

### `plan-my-day-email.md`

```markdown
---
name: plan-my-day-email
description: Fetches and classifies recent emails for the plan-my-day briefing. Only invoke from the plan-my-day skill.
model: haiku
tools: Read, Bash
---

Read ~/dev/tools/claude-skills/plan-my-day/sub-agents/email.md and follow those instructions exactly.
```

---

### `plan-my-day-gtasks-sync.md`

```markdown
---
name: plan-my-day-gtasks-sync
description: Syncs Google Tasks into the SQLite task DB for the plan-my-day briefing. Only invoke from the plan-my-day skill.
model: haiku
tools: Read, Bash, mcp__gtasks__task_list, mcp__gtasks__tasklist_list
---

Read ~/dev/tools/claude-skills/plan-my-day/sub-agents/gtasks-sync.md and follow those instructions exactly.
```

---

## 2. MCP servers required

The skill depends on the following MCP servers being configured:

| MCP server | Used for |
|---|---|
| `mcp__gcal__*` | Calendar events |
| `mcp__gmail__*` | Email fetching and classification |
| `mcp__gtasks__*` | Google Tasks sync |

---

## 3. Skill registration

Register the skill so it can be invoked via `/plan-my-day`. Create a symlink or entry pointing to this directory in your Claude Code skills config:

```bash
ln -s ~/dev/tools/claude-skills/plan-my-day ~/.claude/skills/plan-my-day
```

---

## 4. Permissions

Add the following to your workspace `.claude/settings.json` (or user-level settings) to allow the skill and sub-agents to run:

```json
{
  "permissions": {
    "allow": [
      "Edit(~/dev/tools/claude-skills/plan-my-day/config/)",
      "Write(~/dev/tools/claude-skills/plan-my-day/config/)",
      "Edit(~/dev/tools/claude-skills/plan-my-day/data/)",
      "Write(~/dev/tools/claude-skills/plan-my-day/data/)",
      "Bash(~/dev/tools/claude-skills/plan-my-day/scripts/*)",
      "mcp__gcal__get-current-time",
      "mcp__gcal__list-calendars",
      "mcp__gcal__list-events",
      "mcp__gcal__manage-accounts",
      "mcp__gcal__search-events",
      "mcp__gcal__update-event",
      "mcp__gcal__create-event",
      "mcp__gmail__search_emails",
      "mcp__gmail__read_email",
      "mcp__gmail__download_attachment",
      "mcp__gtasks__task_create",
      "mcp__gtasks__task_update",
      "mcp__gtasks__task_list",
      "mcp__gtasks__tasklist_list"
    ]
  }
}
```
