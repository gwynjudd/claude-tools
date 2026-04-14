import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDb } from '../../db.js';
import { SqliteTaskRepository } from '../../repository.js';
function makeDb(): Database.Database { return openDb(':memory:'); }
function makeRepo(db: Database.Database) { return new SqliteTaskRepository(db); }

describe('SqliteTaskRepository', () => {
  let db: Database.Database;
  let repo: SqliteTaskRepository;

  beforeEach(() => {
    db = makeDb();
    repo = makeRepo(db);
  });

  // ── nextId ──────────────────────────────────────────────────────────────

  describe('nextId', () => {
    it('starts at 1 and increments', () => {
      expect(repo.nextId()).toBe(1);
      expect(repo.nextId()).toBe(2);
      expect(repo.nextId()).toBe(3);
    });
  });

  // ── add / get ───────────────────────────────────────────────────────────

  describe('add + get', () => {
    it('inserts a task and retrieves it', () => {
      const t = repo.add({ title: 'Test task', size: 'S' });
      expect(t.title).toBe('Test task');
      expect(t.size).toBe('S');
      expect(t.status).toBe('idea');
      expect(t.type).toBe('task');

      const fetched = repo.get(t.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.title).toBe('Test task');
    });

    it('retrieves by slug', () => {
      const t = repo.add({ title: 'Slug task', slug: 'my-slug' });
      const fetched = repo.get('my-slug');
      expect(fetched!.id).toBe(t.id);
    });

    it('returns null for unknown id', () => {
      expect(repo.get(999)).toBeNull();
    });

    it('returns null for unknown slug', () => {
      expect(repo.get('no-such-slug')).toBeNull();
    });

    it('enforces eta XOR eta_description', () => {
      expect(() =>
        repo.add({ title: 'Bad', eta: '2026-01-01', eta_description: 'soon' })
      ).toThrow();
    });

    it('enforces unique external_id', () => {
      repo.add({ title: 'First', external_id: 'abc123' });
      expect(() =>
        repo.add({ title: 'Second', external_id: 'abc123' })
      ).toThrow();
    });

    it('allows multiple tasks with null external_id', () => {
      repo.add({ title: 'A' });
      repo.add({ title: 'B' });
      const rows = repo.list({ status: 'all' });
      expect(rows.length).toBe(2);
    });

    it('allows explicit id (migration path)', () => {
      const t = repo.add({ title: 'Existing', id: 42 });
      expect(t.id).toBe(42);
      expect(repo.maxId()).toBe(42);
    });
  });

  // ── list ────────────────────────────────────────────────────────────────

  describe('list', () => {
    beforeEach(() => {
      repo.add({ title: 'Alpha', status: 'idea' });
      repo.add({ title: 'Beta',  status: 'in-progress' });
      repo.add({ title: 'Done task', status: 'done' });
    });

    it('defaults to idea status', () => {
      const rows = repo.list({});
      expect(rows.every(r => r.status === 'idea')).toBe(true);
    });

    it('filters by status', () => {
      const rows = repo.list({ status: 'in-progress' });
      expect(rows.length).toBe(1);
      expect(rows[0].title).toBe('Beta');
    });

    it('returns all statuses with all', () => {
      const rows = repo.list({ status: 'all' });
      expect(rows.length).toBe(3);
    });

    it('excludes habits', () => {
      repo.add({ title: 'A habit', type: 'habit', status: 'recurring' });
      const rows = repo.list({ status: 'all' });
      expect(rows.every(r => r.type !== 'habit')).toBe(true);
    });

    it('excludes project tasks by default', () => {
      db.prepare("INSERT INTO projects (name, slug) VALUES ('P', 'p')").run();
      const project_id = (db.prepare('SELECT id FROM projects WHERE slug = ?').get('p') as { id: number }).id;
      repo.add({ title: 'Project task', project_id });
      const rows = repo.list({ status: 'all' });
      expect(rows.every(r => r.project_slug === null)).toBe(true);
    });
  });

  // ── update ──────────────────────────────────────────────────────────────

  describe('update', () => {
    it('patches a single field', () => {
      const t = repo.add({ title: 'Old title' });
      const updated = repo.update(t.id, { title: 'New title' });
      expect(updated.title).toBe('New title');
    });

    it('throws if no fields provided', () => {
      const t = repo.add({ title: 'Task' });
      expect(() => repo.update(t.id, {})).toThrow('No fields to update');
    });
  });

  // ── complete ────────────────────────────────────────────────────────────

  describe('complete', () => {
    it('sets status to done', () => {
      const t = repo.add({ title: 'Finish me' });
      repo.complete(t.id);
      expect(repo.get(t.id)!.status).toBe('done');
    });
  });

  // ── details ─────────────────────────────────────────────────────────────

  describe('details', () => {
    it('returns null when no details set', () => {
      const t = repo.add({ title: 'No detail' });
      expect(repo.getDetails(t.id)).toBeNull();
    });

    it('sets and retrieves details', () => {
      const t = repo.add({ title: 'Has detail' });
      repo.setDetails(t.id, 'Some content');
      expect(repo.getDetails(t.id)).toBe('Some content');
    });

    it('upserts details', () => {
      const t = repo.add({ title: 'Update detail' });
      repo.setDetails(t.id, 'First');
      repo.setDetails(t.id, 'Second');
      expect(repo.getDetails(t.id)).toBe('Second');
    });

    it('has_details reflects in v_task_summary', () => {
      const t = repo.add({ title: 'With detail' });
      expect(repo.get(t.id)!.has_details).toBe(0);
      repo.setDetails(t.id, 'content');
      expect(repo.get(t.id)!.has_details).toBe(1);
    });
  });

  // ── dependencies ────────────────────────────────────────────────────────

  describe('addDependency', () => {
    it('creates a dependency row', () => {
      const a = repo.add({ title: 'A' });
      const b = repo.add({ title: 'B' });
      repo.addDependency(b.id, a.id, 'hard');

      const rows = db.prepare('SELECT * FROM v_task_dependencies WHERE task_id = ?').all(b.id);
      expect(rows.length).toBe(1);
      expect((rows[0] as { dependency_type: string }).dependency_type).toBe('hard');
    });

    it('rejects self-dependency', () => {
      const a = repo.add({ title: 'Self' });
      expect(() => repo.addDependency(a.id, a.id, 'soft')).toThrow();
    });

    it('cascades delete when dependency task is deleted', () => {
      const a = repo.add({ title: 'Dep A' });
      const b = repo.add({ title: 'Dep B' });
      repo.addDependency(b.id, a.id);
      db.prepare('DELETE FROM tasks WHERE id = ?').run(a.id);
      const rows = db.prepare('SELECT * FROM task_dependencies WHERE depends_on_id = ?').all(a.id);
      expect(rows.length).toBe(0);
    });
  });
});
