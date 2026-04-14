/**
 * Migrates plan-my-day markdown tables into SQLite.
 *
 * Source files expected under <dataDir>/:
 *   TASKS.md, DAILY_HABITS.md, COMPLETED_TASKS.md, HOUSE_MOVE.md, todo/N-slug.md
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { SqliteTaskRepository } from './repository.js';
import type { NewTask, DependencyType } from './repository.js';

// ── Markdown table parsing ─────────────────────────────────────────────────

function parseTableRows(markdown: string): Array<Record<string, string>> {
  const lines = markdown.split('\n');
  let headers: string[] = [];
  const rows: Array<Record<string, string>> = [];

  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (cells.every(c => /^[-: ]+$/.test(c))) continue; // separator row
    if (headers.length === 0) {
      headers = cells;
    } else {
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
      rows.push(row);
    }
  }

  return rows;
}

// ── ETA parsing ────────────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseEta(raw: string): { eta: string | null; eta_description: string | null } {
  const v = raw.trim();
  if (!v || v === 'none' || v === '—') return { eta: null, eta_description: null };
  if (ISO_DATE.test(v)) return { eta: v, eta_description: null };
  // "by 2026-04-14" → extract ISO date
  const m = v.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return { eta: m[1], eta_description: null };
  return { eta: null, eta_description: v };
}

// ── Dependency parsing ─────────────────────────────────────────────────────

interface DepRef {
  ref: string;             // numeric id or slug like 'hm-18'
  type: DependencyType;
}

function parseDependencies(raw: string): DepRef[] {
  if (!raw || raw === 'none' || raw === '—') return [];

  const deps: DepRef[] = [];

  // Match patterns: #N, HM-N (with optional trailing text and (hard)/(soft))
  const re = /(HM-\d+|#\d+)(?:\s+[^,(#HM]*?)?\s*(?:\((hard|soft)\))?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const rawRef  = m[1].trim();
    const depType = (m[2]?.toLowerCase() as DependencyType | undefined) ?? 'hard';
    if (rawRef.startsWith('#')) {
      deps.push({ ref: rawRef.slice(1), type: depType }); // numeric string
    } else {
      // HM-N → slug 'hm-N'
      deps.push({ ref: `hm-${rawRef.slice(3)}`, type: depType });
    }
  }
  return deps;
}

// ── Detail file reading ────────────────────────────────────────────────────

function readDetailFile(dataDir: string, ref: string): string | null {
  if (!ref || ref === '—') return null;
  const m = ref.match(/^@(.+\.md)$/);
  if (!m) return null;
  const path = join(dataDir, 'todo', m[1]);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8').trim();
}

// ── Migration result ───────────────────────────────────────────────────────

export interface MigrationResult {
  tasksInserted:        number;
  habitsInserted:       number;
  projectTasksInserted: number;
  dependenciesInserted: number;
  detailsInserted:      number;
}

// ── Main migration function ────────────────────────────────────────────────

export function migrate(db: Database.Database, dataDir: string, dryRun = false): MigrationResult {
  const repo  = new SqliteTaskRepository(db);
  const stats = { tasksInserted: 0, habitsInserted: 0, projectTasksInserted: 0, dependenciesInserted: 0, detailsInserted: 0 };

  // Pending dependency insertions — resolved after all tasks are in DB
  const pendingDeps: Array<{ taskId: number; ref: string; type: DependencyType }> = [];

  // Map from slug → numeric task id (for HM slugs)
  const slugToId = new Map<string, number>();

  const run = <T>(fn: () => T): T => {
    if (dryRun) return undefined as unknown as T;
    return fn();
  };

  // ── Helper: insert a task from a parsed row ──────────────────────────────

  function insertTask(row: Record<string, string>, override: Partial<NewTask> = {}): number {
    const rawId       = (row['#'] ?? '').trim();
    const rawDeps     = row['Dependencies'] ?? row['Depends On'] ?? '';
    const rawDetails  = row['Details'] ?? '';
    const rawNotes    = row['Notes'] ?? '';
    const rawEta      = row['ETA / Deadline'] ?? row['Deadline'] ?? '';
    const rawStatus   = (row['Status'] ?? 'idea').trim() as NewTask['status'];
    const rawPriority = (row['Priority'] ?? '').trim() as NewTask['priority'] | '';

    const { eta, eta_description } = parseEta(rawEta);

    const task: NewTask = {
      title:           (row['Task'] ?? '').trim(),
      type:            (row['Type'] ?? 'task').trim() as NewTask['type'],
      size:            (row['Size'] ?? '').trim() as NewTask['size'] | '',
      eta,
      eta_description,
      status:          rawStatus || 'idea',
      priority:        (rawPriority || undefined) as NewTask['priority'],
      external_id:     (row['external_id'] ?? '').trim() || undefined,
      ...override,
    };

    // Remove empty size
    if (!task.size) delete task.size;

    const inserted = run(() => repo.add(task));
    const id       = dryRun ? parseInt(rawId, 10) : inserted.id;

    // Register slug if provided
    if (override.slug) slugToId.set(override.slug, id);

    // Queue dependencies
    const deps = parseDependencies(rawDeps);
    for (const d of deps) {
      pendingDeps.push({ taskId: id, ref: d.ref, type: d.type });
    }

    // Details
    let detailContent: string | null = null;
    const fileContent = readDetailFile(dataDir, rawDetails);
    if (fileContent) detailContent = fileContent;
    if (rawNotes.trim()) {
      detailContent = detailContent
        ? `${detailContent}\n\n---\n\n**Notes:** ${rawNotes.trim()}`
        : rawNotes.trim();
    }
    if (detailContent) {
      run(() => repo.setDetails(id, detailContent!));
      stats.detailsInserted++;
    }

    return id;
  }

  // ── 1. TASKS.md ──────────────────────────────────────────────────────────

  const tasksPath = join(dataDir, 'TASKS.md');
  if (existsSync(tasksPath)) {
    const rows = parseTableRows(readFileSync(tasksPath, 'utf8'));
    for (const row of rows) {
      const rawId = parseInt(row['#'], 10);
      if (!rawId) continue;
      insertTask(row, { id: rawId, type: 'task' });
      stats.tasksInserted++;
    }
  }

  // ── 2. DAILY_HABITS.md ───────────────────────────────────────────────────

  const habitsPath = join(dataDir, 'DAILY_HABITS.md');
  if (existsSync(habitsPath)) {
    const rows = parseTableRows(readFileSync(habitsPath, 'utf8'));
    for (const row of rows) {
      const rawId = parseInt(row['#'], 10);
      if (!rawId) continue;
      insertTask(row, { id: rawId, type: 'habit' });
      stats.habitsInserted++;
    }
  }

  // ── 3. COMPLETED_TASKS.md ────────────────────────────────────────────────

  const completedPath = join(dataDir, 'COMPLETED_TASKS.md');
  if (existsSync(completedPath)) {
    const rows = parseTableRows(readFileSync(completedPath, 'utf8'));
    for (const row of rows) {
      const rawId = parseInt(row['#'], 10);
      if (!rawId) continue;
      insertTask(row, { id: rawId, type: 'task' });
      stats.tasksInserted++;
    }
  }

  // ── 4. HOUSE_MOVE.md ─────────────────────────────────────────────────────

  const hmPath = join(dataDir, 'HOUSE_MOVE.md');
  if (existsSync(hmPath)) {
    const content  = readFileSync(hmPath, 'utf8');
    const sections = content.split(/^---$/m).filter(s => s.trim());

    // Determine project id
    let projectId: number | undefined;
    run(() => {
      db.prepare(
        "INSERT OR IGNORE INTO projects (name, slug, description) VALUES ('House Move', 'house-move', 'Melbourne house move Apr 2026')"
      ).run();
      const p = db.prepare("SELECT id FROM projects WHERE slug = 'house-move'").get() as { id: number };
      projectId = p.id;
    });

    for (const section of sections) {
      // Extract section name from the last ## heading before the table
      const headingMatch = section.match(/^##\s+(.+)$/m);
      const sectionName = headingMatch ? headingMatch[1].trim() : null;

      const rows = parseTableRows(section);
      for (const row of rows) {
        const rawHmId = (row['#'] ?? '').trim(); // e.g. 'HM-1', 'HM-18'
        const hmNum   = rawHmId.match(/^HM-(\d+)$/i)?.[1];
        if (!hmNum) continue;

        const slug = `hm-${hmNum}`;
        insertTask(row, {
          type:       'task',
          project_id: projectId,
          section:    sectionName ?? undefined,
          slug,
        });
        stats.projectTasksInserted++;
      }
    }
  }

  // ── 5. Resolve dependencies ───────────────────────────────────────────────

  for (const dep of pendingDeps) {
    // ref is either a numeric string (main task) or slug (hm-N)
    const isNumeric = /^\d+$/.test(dep.ref);
    try {
      run(() => {
        if (isNumeric) {
          repo.addDependency(dep.taskId, parseInt(dep.ref, 10), dep.type);
        } else {
          repo.addDependency(dep.taskId, dep.ref, dep.type);
        }
      });
      stats.dependenciesInserted++;
    } catch {
      // Silently skip unresolvable references (referenced tasks may not exist)
    }
  }

  return stats;
}
