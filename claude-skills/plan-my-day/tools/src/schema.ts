export const DDL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(50)  NOT NULL UNIQUE,
  description TEXT,
  status      VARCHAR(20)  NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'completed', 'archived')),
  start_date  DATE,
  end_date    DATE,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id              INTEGER PRIMARY KEY,
  slug            VARCHAR(50) UNIQUE,
  type            VARCHAR(10)  NOT NULL DEFAULT 'task'
                  CHECK (type IN ('task', 'habit')),
  title           VARCHAR(200) NOT NULL,
  size            VARCHAR(5)   CHECK (size IN ('XS', 'S', 'M', 'L', 'XL')),
  eta             DATE,
  eta_description VARCHAR(100),
  status          VARCHAR(20)  NOT NULL DEFAULT 'idea'
                  CHECK (status IN ('idea', 'in-progress', 'blocked', 'done', 'recurring')),
  priority        VARCHAR(5)   CHECK (priority IN ('High', 'Med', 'Low')),
  project_id      INTEGER      REFERENCES projects(id) ON DELETE SET NULL,
  section         VARCHAR(100),
  external_id     VARCHAR(200),
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (eta IS NULL OR eta_description IS NULL)
);

CREATE TRIGGER IF NOT EXISTS tasks_updated_at
  AFTER UPDATE ON tasks FOR EACH ROW
  BEGIN
    UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id   INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type VARCHAR(10) NOT NULL DEFAULT 'hard'
                  CHECK (dependency_type IN ('hard', 'soft')),
  PRIMARY KEY (task_id, depends_on_id),
  CHECK (task_id != depends_on_id)
);

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

CREATE TABLE IF NOT EXISTS meta (
  key   VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO meta VALUES ('max_id', '0');
INSERT OR IGNORE INTO meta VALUES ('schema_version', '1');

CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks (project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_ext_id ON tasks (external_id) WHERE external_id IS NOT NULL;

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
`;
