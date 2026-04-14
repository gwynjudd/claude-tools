import type Database from 'better-sqlite3';

// ── Types ──────────────────────────────────────────────────────────────────

export type TaskStatus     = 'idea' | 'in-progress' | 'blocked' | 'done' | 'recurring';
export type TaskType       = 'task' | 'habit';
export type TaskSize       = 'XS' | 'S' | 'M' | 'L' | 'XL';
export type Priority       = 'High' | 'Med' | 'Low';
export type DependencyType = 'hard' | 'soft';

export interface TaskSummary {
  id:              number;
  slug:            string | null;
  type:            TaskType;
  title:           string;
  size:            TaskSize | null;
  eta:             string | null;
  eta_description: string | null;
  status:          TaskStatus;
  priority:        Priority | null;
  section:         string | null;
  external_id:     string | null;
  project_slug:    string | null;
  project_name:    string | null;
  has_details:     0 | 1;
}

export interface NewTask {
  title:            string;
  type?:            TaskType;
  size?:            TaskSize;
  eta?:             string;
  eta_description?: string;
  status?:          TaskStatus;
  priority?:        Priority;
  project_id?:      number;
  section?:         string;
  external_id?:     string;
  slug?:            string;
  id?:              number;   // migration only — skip auto-assign
}

export interface TaskPatch {
  title?:           string;
  size?:            TaskSize | null;
  eta?:             string | null;
  eta_description?: string | null;
  status?:          TaskStatus;
  priority?:        Priority | null;
  section?:         string | null;
  external_id?:     string | null;
}

export interface ListOpts {
  status?:   TaskStatus | 'all';
  project?:  string;    // project slug; omit = no-project tasks only
}

export interface ProjectSummary {
  id:          number;
  name:        string;
  slug:        string;
  description: string | null;
  status:      string;
  start_date:  string | null;
  end_date:    string | null;
}

export interface TaskRepository {
  list(opts: ListOpts): TaskSummary[];
  get(id: number | string): TaskSummary | null;
  add(task: NewTask): TaskSummary;
  update(id: number | string, patch: TaskPatch): TaskSummary;
  complete(id: number | string): void;
  getDetails(id: number | string): string | null;
  setDetails(id: number | string, content: string): void;
  addDependency(id: number | string, dependsOnId: number | string, type: DependencyType): void;
  nextId(): number;
  listHabits(): TaskSummary[];
  listProjects(): ProjectSummary[];
  getProjectTasks(projectSlug: string, section?: string, status?: TaskStatus | 'all'): TaskSummary[];
  updateProjectTask(projectSlug: string, taskId: number | string, patch: TaskPatch): TaskSummary;
  maxId(): number;
}

// ── SqliteTaskRepository ───────────────────────────────────────────────────

export class SqliteTaskRepository implements TaskRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  private resolveTaskId(ref: number | string): number {
    if (typeof ref === 'number') return ref;
    const row = this.db.prepare('SELECT id FROM tasks WHERE slug = ?').get(ref) as { id: number } | undefined;
    if (!row) throw new Error(`Task not found: ${ref}`);
    return row.id;
  }

  // ── nextId ───────────────────────────────────────────────────────────────

  nextId(): number {
    const row = this.db.prepare("SELECT CAST(value AS INTEGER) AS v FROM meta WHERE key = 'max_id'").get() as { v: number };
    const next = row.v + 1;
    this.db.prepare("UPDATE meta SET value = ? WHERE key = 'max_id'").run(next);
    return next;
  }

  maxId(): number {
    const row = this.db.prepare("SELECT CAST(value AS INTEGER) AS v FROM meta WHERE key = 'max_id'").get() as { v: number };
    return row.v;
  }

  // ── list ─────────────────────────────────────────────────────────────────

  list(opts: ListOpts = {}): TaskSummary[] {
    const { status = 'idea', project } = opts;

    const conditions: string[] = ["type != 'habit'"];
    const params: unknown[] = [];

    if (project === 'all') {
      // no project filter
    } else if (project) {
      conditions.push('project_slug = ?');
      params.push(project);
    } else {
      conditions.push('project_slug IS NULL');
    }

    if (status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    return this.db.prepare(`SELECT * FROM v_task_summary ${where} ORDER BY id`).all(...params) as TaskSummary[];
  }

  // ── get ──────────────────────────────────────────────────────────────────

  get(id: number | string): TaskSummary | null {
    const col = typeof id === 'number' ? 'id' : 'slug';
    const row = this.db.prepare(`SELECT * FROM v_task_summary WHERE ${col} = ?`).get(id);
    return (row as TaskSummary | undefined) ?? null;
  }

  // ── add ──────────────────────────────────────────────────────────────────

  add(task: NewTask): TaskSummary {
    const id = task.id ?? this.nextId();

    if (task.id !== undefined) {
      const cur = this.maxId();
      if (task.id > cur) {
        this.db.prepare("UPDATE meta SET value = ? WHERE key = 'max_id'").run(task.id);
      }
    }

    this.db.prepare(`
      INSERT INTO tasks (id, slug, type, title, size, eta, eta_description, status, priority,
                         project_id, section, external_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      task.slug ?? null,
      task.type ?? 'task',
      task.title,
      task.size ?? null,
      task.eta ?? null,
      task.eta_description ?? null,
      task.status ?? 'idea',
      task.priority ?? null,
      task.project_id ?? null,
      task.section ?? null,
      task.external_id ?? null,
    );

    return this.get(id)!;
  }

  // ── update ───────────────────────────────────────────────────────────────

  update(id: number | string, patch: TaskPatch): TaskSummary {
    const numId = this.resolveTaskId(id);

    const sets: string[] = [];
    const params: unknown[] = [];

    const fields = ['title', 'size', 'eta', 'eta_description', 'status', 'priority', 'section', 'external_id'] as const;
    for (const f of fields) {
      if (Object.prototype.hasOwnProperty.call(patch, f)) {
        sets.push(`${f} = ?`);
        params.push((patch as Record<string, unknown>)[f] ?? null);
      }
    }

    if (sets.length === 0) throw new Error('No fields to update');

    params.push(numId);
    this.db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    return this.get(numId)!;
  }

  // ── complete ─────────────────────────────────────────────────────────────

  complete(id: number | string): void {
    const numId = this.resolveTaskId(id);
    this.db.prepare("UPDATE tasks SET status = 'done' WHERE id = ?").run(numId);
  }

  // ── details ──────────────────────────────────────────────────────────────

  getDetails(id: number | string): string | null {
    const numId = this.resolveTaskId(id);
    const row = this.db.prepare('SELECT content FROM task_details WHERE task_id = ?').get(numId) as { content: string } | undefined;
    return row?.content ?? null;
  }

  setDetails(id: number | string, content: string): void {
    const numId = this.resolveTaskId(id);
    this.db.prepare(`
      INSERT INTO task_details (task_id, content) VALUES (?, ?)
      ON CONFLICT(task_id) DO UPDATE SET content = excluded.content
    `).run(numId, content);
  }

  // ── dependencies ─────────────────────────────────────────────────────────

  addDependency(id: number | string, dependsOnId: number | string, type: DependencyType = 'hard'): void {
    const taskId  = this.resolveTaskId(id);
    const depOnId = this.resolveTaskId(dependsOnId);
    this.db.prepare(`
      INSERT OR REPLACE INTO task_dependencies (task_id, depends_on_id, dependency_type)
      VALUES (?, ?, ?)
    `).run(taskId, depOnId, type);
  }

  // ── habits ───────────────────────────────────────────────────────────────

  listHabits(): TaskSummary[] {
    return this.db.prepare("SELECT * FROM v_habits ORDER BY id").all() as TaskSummary[];
  }

  // ── projects ─────────────────────────────────────────────────────────────

  listProjects(): ProjectSummary[] {
    return this.db.prepare("SELECT * FROM projects WHERE status != 'archived' ORDER BY name").all() as ProjectSummary[];
  }

  getProjectTasks(projectSlug: string, section?: string, status: TaskStatus | 'all' = 'idea'): TaskSummary[] {
    const conditions = ['project_slug = ?'];
    const params: unknown[] = [projectSlug];

    if (section) {
      conditions.push('section = ?');
      params.push(section);
    }
    if (status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    return this.db.prepare(
      `SELECT * FROM v_task_summary WHERE ${conditions.join(' AND ')} ORDER BY id`
    ).all(...params) as TaskSummary[];
  }

  updateProjectTask(projectSlug: string, taskId: number | string, patch: TaskPatch): TaskSummary {
    const numId = this.resolveTaskId(taskId);
    const row = this.db.prepare(
      'SELECT id FROM v_task_summary WHERE id = ? AND project_slug = ?'
    ).get(numId, projectSlug);
    if (!row) throw new Error(`Task ${taskId} not found in project ${projectSlug}`);
    return this.update(numId, patch);
  }
}
