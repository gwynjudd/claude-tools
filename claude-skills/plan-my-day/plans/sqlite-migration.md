# Plan: Migrate plan-my-day todo list to SQLite

**Status:** Complete ✓

- [x] Slice 1 — Project scaffold
- [x] Slice 2 — Schema
- [x] Slice 3 — Repository layer + integration tests
- [x] Slice 4 — Migration
- [x] Slice 5 — CLI commands + unit tests
- [x] Slice 6 — Shell wrappers
- [x] Slice 7 — Update skill definitions
- [x] Slice 8 — Archive markdown files

---

## Context

The plan-my-day skill currently stores tasks in markdown tables (`TASKS.md`, `DAILY_HABITS.md`, `COMPLETED_TASKS.md`, `HOUSE_MOVE.md`). Sub-agents read and edit these files using the `Read` and `Edit` tools — consuming significant tokens doing mechanical table manipulation. Moving to SQLite with a CLI tool means agents invoke bash scripts instead, dramatically reducing token overhead.

---

## Database Schema

File: `data/tasks.db` (SQLite)

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Projects: overall project context, key dates, addresses, general plans
CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(50)  NOT NULL UNIQUE,    -- e.g. 'house-move'
  description TEXT,
  status      VARCHAR(20)  NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'completed', 'archived')),
  start_date  DATE,
  end_date    DATE,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id              INTEGER PRIMARY KEY,          -- manually managed (preserves existing IDs)
  slug            VARCHAR(50) UNIQUE,           -- human-readable short ID e.g. 'hm-18', 'paint-house'
  type            VARCHAR(10)  NOT NULL DEFAULT 'task'
                  CHECK (type IN ('task', 'habit')),
  title           VARCHAR(200) NOT NULL,
  size            VARCHAR(5)   CHECK (size IN ('XS', 'S', 'M', 'L', 'XL')),
  eta             DATE,                         -- machine date, NULL if free-text or unknown
  eta_description VARCHAR(100),                 -- free text, only set when eta IS NULL
  status          VARCHAR(20)  NOT NULL DEFAULT 'idea'
                  CHECK (status IN ('idea', 'in-progress', 'blocked', 'done', 'recurring')),
  priority        VARCHAR(5)   CHECK (priority IN ('High', 'Med', 'Low')),
  project_id      INTEGER      REFERENCES projects(id) ON DELETE SET NULL,
  section         VARCHAR(100),                 -- grouping within a project
  external_id     VARCHAR(200),                 -- Google Tasks base64 ID
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (eta IS NULL OR eta_description IS NULL)  -- only one may be set
);

CREATE TRIGGER IF NOT EXISTS tasks_updated_at
  AFTER UPDATE ON tasks FOR EACH ROW
  BEGIN
    UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

-- Dependencies (junction table with FK integrity)
CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id   INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type VARCHAR(10) NOT NULL DEFAULT 'hard'
                  CHECK (dependency_type IN ('hard', 'soft')),
  PRIMARY KEY (task_id, depends_on_id),
  CHECK (task_id != depends_on_id)
);

-- Details (separate table — keeps summary queries lean)
-- Replaces both @detail-file.md references and the old 'notes' column
CREATE TABLE IF NOT EXISTS task_details (
  task_id    INTEGER PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS task_details_updated_at
  AFTER UPDATE ON task_details FOR EACH ROW
  BEGIN
    UPDATE task_details SET updated_at = CURRENT_TIMESTAMP WHERE task_id = NEW.task_id;
  END;

-- Meta (schema version, max_id tracker)
CREATE TABLE IF NOT EXISTS meta (
  key   VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO meta VALUES ('max_id', '0');
INSERT OR IGNORE INTO meta VALUES ('schema_version', '1');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks (project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_ext_id ON tasks (external_id) WHERE external_id IS NOT NULL;

-- Views (CLI reads through these, not raw tables)

CREATE VIEW IF NOT EXISTS v_task_summary AS
  SELECT
    t.id,
    t.slug,
    t.type,
    t.title,
    t.size,
    t.eta,
    t.eta_description,
    t.status,
    t.priority,
    t.section,
    t.external_id,
    p.slug  AS project_slug,
    p.name  AS project_name,
    CASE WHEN d.task_id IS NOT NULL THEN 1 ELSE 0 END AS has_details
  FROM tasks t
  LEFT JOIN projects p ON p.id = t.project_id
  LEFT JOIN task_details d ON d.task_id = t.id;

CREATE VIEW IF NOT EXISTS v_active_tasks AS
  SELECT * FROM v_task_summary
  WHERE project_slug IS NULL
    AND status NOT IN ('done');

CREATE VIEW IF NOT EXISTS v_project_tasks AS
  SELECT * FROM v_task_summary
  WHERE project_slug IS NOT NULL
    AND status NOT IN ('done');

CREATE VIEW IF NOT EXISTS v_habits AS
  SELECT * FROM v_task_summary
  WHERE type = 'habit';

CREATE VIEW IF NOT EXISTS v_task_dependencies AS
  SELECT
    td.task_id,
    t1.title  AS task_title,
    td.depends_on_id,
    t2.title  AS depends_on_title,
    td.dependency_type
  FROM task_dependencies td
  JOIN tasks t1 ON t1.id = td.task_id
  JOIN tasks t2 ON t2.id = td.depends_on_id;
```

**Schema notes:**
- `id` is plain `INTEGER PRIMARY KEY` (not `AUTOINCREMENT`) — existing IDs from markdown are non-contiguous and must be preserved. `max_id` in meta tracks the highest issued ID.
- `slug` is optional (`UNIQUE` but nullable) — either `id` or `slug` can identify a task in CLI commands.
- Old `dependencies TEXT` replaced by `task_dependencies` junction table; old text like `#3 (hard)` is parsed during migration.
- Old `details TEXT` (file reference `@7-paint-house.md`) and `notes TEXT` both migrate into `task_details.content`. Detail file content is read and stored inline.
- `updated_at` maintained by triggers (SQLite has no native `ON UPDATE`).

---

## File / Directory Structure

```
plan-my-day/
├── tools/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsup.config.ts
│   └── src/
│       ├── schema.ts
│       ├── db.ts
│       ├── repository.ts           TaskRepository interface + SqliteTaskRepository
│       ├── cli.ts
│       ├── commands/
│       │   ├── task-list.ts
│       │   ├── task-get.ts
│       │   ├── task-add.ts
│       │   ├── task-update.ts
│       │   ├── task-complete.ts
│       │   ├── habit-list.ts
│       │   ├── project-list.ts
│       │   ├── project-tasks.ts
│       │   └── project-update.ts
│       ├── migrate.ts
│       └── __tests__/
│           ├── unit/
│           │   ├── task-add.test.ts
│           │   ├── task-update.test.ts
│           │   ├── task-list.test.ts
│           │   └── migrate.test.ts
│           ├── integration/
│           │   ├── repository.test.ts
│           │   ├── views.test.ts
│           │   └── dependencies.test.ts
│           └── system/
│               ├── fixtures/
│               ├── full-cycle.test.ts
│               └── migrate.test.ts
├── scripts/
│   ├── task-list.sh, task-get.sh, task-add.sh, task-update.sh, task-complete.sh
│   ├── habit-list.sh
│   ├── project-list.sh, project-tasks.sh, project-update.sh
│   └── db-migrate.sh
└── data/
    ├── tasks.db
    └── archive/  (markdown files moved here after Slice 8)
```

---

## CLI Commands

```
pmd task list [--status idea|in-progress|blocked|done|all] [--project <slug>]
pmd task get <id|slug>
pmd task add --title <text> --size <XS|S|M|L|XL> [--type task|habit]
             [--eta <YYYY-MM-DD>] [--eta-desc <text>] [--status <...>]
             [--priority High|Med|Low] [--external-id <id>]
             [--project <slug>] [--section <text>] [--slug <text>]
pmd task update <id|slug> [--title] [--size] [--eta] [--eta-desc]
                          [--status] [--external-id] [--priority] [--section]
pmd task complete <id|slug>
pmd task details <id|slug>
pmd task details-set <id|slug> --content <text>
pmd task dep-add <id|slug> --depends-on <id|slug> [--type hard|soft]
pmd habit list
pmd project list
pmd project tasks <slug> [--section <name>] [--status idea|done|all]
pmd project update <slug> <task-id|slug> --status <...>
pmd max-id
pmd migrate --from <data-dir> [--dry-run]
```

Output: JSON by default; `--human` for formatted table.

---

## Repository Interface

```typescript
export interface TaskRepository {
  list(opts: ListOpts): TaskSummary[];
  get(id: number | string): TaskSummary | null;
  add(task: NewTask): Task;
  update(id: number | string, patch: TaskPatch): Task;
  complete(id: number | string): void;
  getDetails(id: number | string): string | null;
  setDetails(id: number | string, content: string): void;
  addDependency(id: number | string, dependsOnId: number | string, type: 'hard' | 'soft'): void;
  nextId(): number;
}
```

Commands are injected with `TaskRepository` — unit tests use `vi.fn()` mocks, integration/system tests use `SqliteTaskRepository`.

---

## Test Tiers

| Tier | Location | DB | Tests |
|------|----------|----|-------|
| Unit | `__tests__/unit/` | None (vi.fn() mocks) | Command logic, arg parsing, output format |
| Integration | `__tests__/integration/` | `:memory:` SQLite | Schema constraints, views, triggers, FK cascade |
| System | `__tests__/system/` | Temp file DB | Full end-to-end, migration from fixtures |

---

## Migration Column Mappings

| Markdown | DB column | Notes |
|----------|-----------|-------|
| `#` | `id` | Preserved exactly |
| `Task` | `title` | |
| `ETA / Deadline` | `eta` or `eta_description` | ISO date → `eta`; free text → `eta_description`; `none` → both NULL |
| `Dependencies` | `task_dependencies` rows | Parse `#3, #5 (hard)` → junction rows |
| `Details` | `task_details.content` | Read file content inline |
| `Notes` | `task_details.content` | Appended |
| HM tasks | `tasks` with `project_id` | New IDs after main `max_id`; `slug = 'hm-N'` |

---

## New Dependencies

- **Runtime:** `better-sqlite3 ^12.x` (v12 adds C++20 support, required for Node 24)
- **Dev:** `@types/better-sqlite3 ^7.x`, `tsup ^8.x`, `typescript ^5.x`, `vitest ^2.x`
- `better-sqlite3` must be marked `external` in tsup (native addon, cannot bundle)
- Vitest config must add `better-sqlite3` to `server.deps.external`

---

## Implementation Slices

### Slice 1 — Project scaffold
Create `tools/package.json`, `tsconfig.json`, `tsup.config.ts`.

**Verify:**
```bash
cd tools && npm install && npm run build
node -e "require('better-sqlite3')"
```

---

### Slice 2 — Schema
Create `src/schema.ts` (DDL string) and `src/db.ts` (`openDb(path)`).

**Verify:**
```bash
# After build, run a quick init script then:
sqlite3 /tmp/test.db ".tables"      # tasks, projects, task_dependencies, task_details, meta
sqlite3 /tmp/test.db "PRAGMA integrity_check;"
```

---

### Slice 3 — Repository layer + integration tests
Create `src/repository.ts` (`TaskRepository` interface + `SqliteTaskRepository`).
Create `src/__tests__/integration/` tests.

**Verify:**
```bash
npm test -- --testPathPattern=integration
```
Confirm: mutual exclusion CHECK fires, `updated_at` trigger fires, `v_active_tasks` excludes done+project, cascade delete works.

---

### Slice 4 — Migration
Create `src/migrate.ts`, copy markdown files to `src/__tests__/system/fixtures/`, write system migration tests, add `pmd migrate` command, create `scripts/db-migrate.sh`.

**Verify:**
```bash
npm test -- --testPathPattern=system/migrate
scripts/db-migrate.sh
sqlite3 data/tasks.db "SELECT count(*) FROM tasks WHERE project_id IS NULL AND status != 'done';"
sqlite3 data/tasks.db "SELECT id, title, eta, eta_description FROM tasks WHERE id = 15;"
sqlite3 data/tasks.db "SELECT * FROM v_task_dependencies;"
```

---

### Slice 5 — CLI commands + unit tests
Create `src/cli.ts` and all `src/commands/*.ts`. Create `src/__tests__/unit/` tests.

**Verify:**
```bash
npm test -- --testPathPattern=unit
npm run build
node tools/dist/cli.js task list | jq length
node tools/dist/cli.js task get 15
node tools/dist/cli.js project tasks house-move | jq length
```

---

### Slice 6 — Shell wrappers
Create all `scripts/*.sh` (5-line passthroughs).

**Verify:**
```bash
npm test
scripts/task-list.sh | jq length
scripts/task-add.sh --title "Test task" --size XS
scripts/task-complete.sh <new-id>
```

---

### Slice 7 — Update skill definitions
Update `sub-agents/todo.md`, `sub-agents/gtasks-sync.md`, `SKILL.md`, `SETUP.md`, `~/dev/.claude/settings.json`.

**Verify:** Run plan-my-day end-to-end. Todo section and habits populate from DB; gtasks-sync writes to DB.

---

### Slice 8 — Archive markdown files
```bash
mkdir -p data/archive
mv data/TASKS.md data/DAILY_HABITS.md data/COMPLETED_TASKS.md data/HOUSE_MOVE.md data/archive/
mv data/todo/ data/archive/todo/
```
Update `data/TODO.md` to point to CLI.

**Verify:** Run plan-my-day once more; confirm no broken references.
