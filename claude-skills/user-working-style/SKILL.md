---
name: user-working-style
description: >
  Personal working style preferences for this user. ALWAYS load and follow this skill at the
  start of every conversation. Apply these preferences automatically without asking — they
  govern shell syntax, tooling choices, directory structure, language preferences, and more.
  When the user mentions a new preference or correction during a conversation (e.g. "I prefer X",
  "I always use Y", "use Z instead"), recognise it as a potential skill update and offer to
  record it: "Would you like me to update your working style skill with that preference?"
---

# User Working Style

This skill captures how this user likes to work. Follow all preferences below automatically.
When the user states a new preference, offer to update this skill so it persists.

---

## Environment

- Running **Claude Code in WSL** (Windows Subsystem for Linux) on Windows
- The working environment is Linux/Unix — favour Unix conventions throughout
- Home directory is `/home/gwynj`; projects live under `~/dev`

---

## Shell & Terminal

- **Preferred shell: bash** (WSL)
- Use Unix environment variable syntax: `$HOME`, `$PATH`, `export VAR=value`
- Use standard Unix commands: `mkdir`, `mv`, `cp`, `rm`, `find`, `grep`, etc.
- Prefer **shell scripts** (`.sh`) over PowerShell scripts for automation
- Avoid PowerShell syntax — do not use `$env:VAR`, `New-Item`, `Move-Item`, or any cmdlet-style commands

---

## Editor

- **VS Code** is the preferred editor
- When suggesting how to open or edit files, default to `code <path>`
- Suggest relevant VS Code extensions where appropriate

---

## Languages & Tooling

- **JavaScript** for small/simple reusable tools (a page or less)
- **TypeScript** for anything more substantial (2+ pages / complex logic)
- Node.js is the default runtime — if it's not suitable for a task, suggest alternatives explicitly
- **`nvm`** (standard, not nvm-windows) is used to manage Node.js versions
- Prefer modern tooling and syntax (ES modules, async/await, etc.)
- **Modern Java** for more substantial applications — use current Java LTS features (records, sealed classes, pattern matching, etc.)
- Avoid legacy Java patterns; favour idiomatic modern Java

---

## Project Directory Structure

- All development projects live under **`~/dev`**
- Suggested top-level layout:
  ~/dev/
  ├── tools/        # Small reusable scripts and CLI tools
  ├── projects/     # Larger or ongoing projects
  └── scratch/      # Throwaway experiments
- When creating a new project or tool, default to placing it in the appropriate subdirectory
- If unsure where something belongs, suggest the most logical location and ask

---

## General Preferences

- Favour Unix-native tooling and idioms over Windows or legacy approaches
- Be direct — skip unnecessary preamble when giving instructions
- When providing multi-step instructions, use clear numbered steps
- When investigating a problem with a third-party tool or library (e.g. an MCP server, npm package), **clone the repo locally** into `~/dev/scratch/` and read the source directly — do not use web fetch/search agents

---

## Plan My Day — Daily Offer

At the start of each new conversation, before responding to the user's first message, check
when Plan My Day was last run:

```bash
cat ~/dev/tools/claude-skills/plan-my-day/.last-run 2>/dev/null
```

If the file doesn't exist, or the timestamp is more than 24 hours ago, and the user hasn't
already asked about their day or emails, add a single line at the top of your first response:

> _It's been a while since your last morning briefing — would you like me to run Plan My Day?_

Only offer once per conversation. Do not offer if the user's first message is clearly task-focused
(e.g. they're asking you to write code, fix a bug, or continue previous work).

---

## Todo List

A running list of ideas and future tasks is maintained at `~/dev/tools/claude-skills/user-working-style/TODO.md`.

**Trigger phrases** — when the user says any of these, capture the task immediately:
- "Add X to the todo list"
- "I want to work on X in the future"
- "Put X on the list"
- "Make a note to X"
- Similar intent

**How to capture:**
1. Read the current `TODO.md`
2. Assign the next available `#` number
3. Ask for any missing fields if not clear from context (size, ETA, dependencies)
4. Add a row to the table and a details entry below:

```
### #N — Task name
- **Summary:** one or two sentence description
- **Size:** XS / S / M / L / XL  (XS = <1hr, S = half day, M = 1-2 days, L = week+, XL = open-ended)
- **ETA / Deadline:** specific date or relative (e.g. "before June"), or "none"
- **Dependencies:** list any other todo items or external requirements, or "none"
- **Added:** YYYY-MM-DD
- **Status:** idea
```

When the user asks to see the todo list, read and display `TODO.md`.
When a task is completed or started, update its **Status** field accordingly.
When a task is marked done: remove XS tasks from the list entirely; keep larger tasks with status `done` for reference.

---

## Updating This Skill

When the user states a new preference during a conversation:
1. Note it clearly: "That sounds like a working style preference."
2. Offer to update: "Would you like me to add that to your working style skill?"
3. If yes, update this SKILL.md with the new preference under the appropriate section
4. Confirm what was added
