import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { openDb } from '../../db.js';
import { migrate } from '../../migrate.js';
import { SqliteTaskRepository } from '../../repository.js';
import type Database from 'better-sqlite3';

const FIXTURES = join(import.meta.dirname, 'fixtures');

describe('migrate from fixtures', () => {
  let db: Database.Database;
  let repo: SqliteTaskRepository;

  beforeAll(() => {
    db   = openDb(':memory:');
    repo = new SqliteTaskRepository(db);
    migrate(db, FIXTURES);
  });

  it('migrates main tasks', () => {
    const task = repo.get(7);
    expect(task).not.toBeNull();
    expect(task!.title).toMatch(/paint house/i);
    expect(task!.status).toBe('in-progress');
    expect(task!.type).toBe('task');
  });

  it('preserves original task IDs', () => {
    expect(repo.get(1)).not.toBeNull();
    expect(repo.get(15)).not.toBeNull();
    expect(repo.get(32)).not.toBeNull();
  });

  it('migrates done tasks from COMPLETED_TASKS.md', () => {
    const task = repo.get(2);
    expect(task).not.toBeNull();
    expect(task!.status).toBe('done');
  });

  it('migrates habits', () => {
    const habit = repo.get(20);
    expect(habit).not.toBeNull();
    expect(habit!.type).toBe('habit');
  });

  it('parses ISO eta correctly', () => {
    const task = repo.get(12);
    expect(task!.eta).toBe('2026-05-01');
    expect(task!.eta_description).toBeNull();
  });

  it('parses free-text eta as description', () => {
    const task = repo.get(13); // '~May 2026'
    expect(task!.eta).toBeNull();
    expect(task!.eta_description).toBe('~May 2026');
  });

  it('stores detail file content in task_details', () => {
    const details = repo.getDetails(7);  // @7-paint-house.md
    expect(details).not.toBeNull();
    expect(details).toContain('Paint house');
  });

  it('stores inline notes as task_details', () => {
    const details = repo.getDetails(32);  // has detail file
    expect(details).not.toBeNull();
  });

  it('migrates HM tasks with slugs', () => {
    const task = repo.get('hm-18');
    expect(task).not.toBeNull();
    expect(task!.title).toMatch(/collect keys/i);
    expect(task!.project_slug).toBe('house-move');
  });

  it('sets sections on HM tasks', () => {
    const task = repo.get('hm-1');
    expect(task!.section).toBeTruthy();
  });

  it('creates house-move project', () => {
    const projects = repo.listProjects();
    expect(projects.some(p => p.slug === 'house-move')).toBe(true);
  });

  it('inserts main task dependencies', () => {
    // Task 15 depends on #21 and #23
    const deps = db.prepare(
      'SELECT depends_on_id FROM task_dependencies WHERE task_id = 15'
    ).all() as { depends_on_id: number }[];
    const depIds = deps.map(d => d.depends_on_id);
    expect(depIds).toContain(21);
    expect(depIds).toContain(23);
  });

  it('inserts HM task dependencies with hard type', () => {
    const hm19 = repo.get('hm-19')!;
    const deps = db.prepare(
      'SELECT d.dependency_type, t.slug FROM task_dependencies d JOIN tasks t ON t.id = d.depends_on_id WHERE d.task_id = ?'
    ).all(hm19.id) as { dependency_type: string; slug: string }[];
    expect(deps.some(d => d.slug === 'hm-18' && d.dependency_type === 'hard')).toBe(true);
  });

  it('sets max_id to highest task id', () => {
    expect(repo.maxId()).toBeGreaterThan(55);
  });
});
