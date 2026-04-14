# Todo List

The todo list is stored in a SQLite database managed by the plan-my-day skill.

Full schema and CLI reference: `~/dev/tools/claude-skills/plan-my-day/data/TODO.md`

**Trigger phrases** — when the user says any of these, capture the task immediately:
- "Add X to the todo list"
- "I want to work on X in the future"
- "Put X on the list"
- "Make a note to X"
- Similar intent

**How to capture:**

```bash
~/dev/tools/claude-skills/plan-my-day/scripts/task-add.sh \
  --title "..." --size S [--eta YYYY-MM-DD] [--status idea]
```

Ask for any missing fields if not clear from context (size, ETA). The script returns JSON with the new task including its `id`.

**How to view the todo list:**

```bash
~/dev/tools/claude-skills/plan-my-day/scripts/task-list.sh
~/dev/tools/claude-skills/plan-my-day/scripts/task-list.sh --status in-progress
~/dev/tools/claude-skills/plan-my-day/scripts/task-list.sh --status all
```

**How to update / complete a task:**

```bash
~/dev/tools/claude-skills/plan-my-day/scripts/task-update.sh <id|slug> --status in-progress
~/dev/tools/claude-skills/plan-my-day/scripts/task-complete.sh <id|slug>
```

Never edit any markdown files directly — all mutations go through the CLI scripts.
