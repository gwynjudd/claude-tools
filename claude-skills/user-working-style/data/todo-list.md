# Todo List

The todo list lives in the plan-my-day skill. Full schema and maintenance instructions are in:
`~/dev/tools/claude-skills/plan-my-day/data/TODO.md`

Key files:
- **`TASKS.md`** — active tasks (`idea`, `in-progress`, `blocked`)
- **`DAILY_HABITS.md`** — active daily habits
- **`COMPLETED_TASKS.md`** — completed tasks (archive)
- **`todo/<N>-<slug>.md`** — per-task detail files (load only when actioning that task)

**Trigger phrases** — when the user says any of these, capture the task immediately:
- "Add X to the todo list"
- "I want to work on X in the future"
- "Put X on the list"
- "Make a note to X"
- Similar intent

**How to capture:**
1. Read `TASKS.md` (and check `COMPLETED_TASKS.md` for highest `#`)
2. Assign the next available `#` number
3. Ask for any missing fields if not clear from context (size, ETA, dependencies)
4. Add a row to `TASKS.md`
5. If the task has significant detail (size M+, research notes, checklists), create `data/todo/<N>-<slug>.md` and set the `Details` column to `@<N>-<slug>.md`

When the user asks to see the todo list, read and display `TASKS.md`.
When a task is started, update its **Status** to `in-progress` in `TASKS.md`.
When a task is completed: move the row to `COMPLETED_TASKS.md` with status `done`. XS tasks can be omitted from the archive.
