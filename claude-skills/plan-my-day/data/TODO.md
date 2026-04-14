# Todo List — How It Works

Task data is stored in `data/tasks.db` (SQLite). Interact via the CLI scripts in `scripts/`.

## Quick reference

```bash
# List active tasks
~/dev/tools/claude-skills/plan-my-day/scripts/task-list.sh
~/dev/tools/claude-skills/plan-my-day/scripts/task-list.sh --status in-progress
~/dev/tools/claude-skills/plan-my-day/scripts/task-list.sh --status all

# Get a task
~/dev/tools/claude-skills/plan-my-day/scripts/task-get.sh <id|slug>

# Add a task
~/dev/tools/claude-skills/plan-my-day/scripts/task-add.sh --title "..." --size S [--eta YYYY-MM-DD]

# Update a task
~/dev/tools/claude-skills/plan-my-day/scripts/task-update.sh <id|slug> --status in-progress
~/dev/tools/claude-skills/plan-my-day/scripts/task-update.sh <id|slug> --title "..." --eta 2026-06-01

# Complete a task
~/dev/tools/claude-skills/plan-my-day/scripts/task-complete.sh <id|slug>

# Daily habits
~/dev/tools/claude-skills/plan-my-day/scripts/habit-list.sh

# House move project
~/dev/tools/claude-skills/plan-my-day/scripts/project-tasks.sh house-move
~/dev/tools/claude-skills/plan-my-day/scripts/project-tasks.sh house-move --status all
~/dev/tools/claude-skills/plan-my-day/scripts/project-update.sh house-move <id|slug> --status done
```

## Task sizes

| Size | Effort |
|------|--------|
| XS   | < 1 hr |
| S    | Half day |
| M    | 1–2 days |
| L    | Week+ |
| XL   | Open-ended |

## Markdown archive

The old markdown files (TASKS.md, DAILY_HABITS.md, etc.) are in `data/archive/` for reference.
