import { describe, it, expect, vi } from 'vitest';
import type { TaskRepository, TaskSummary } from '../../repository.js';
import { syncGoogleTasks } from '../../commands/gtasks-sync.js';

function makeTask(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: 1, slug: null, type: 'task', title: 'Existing task', size: 'S',
    eta: null, eta_description: null, status: 'idea', priority: null,
    section: null, external_id: null, project_slug: null, project_name: null, has_details: 0,
    ...overrides,
  };
}

function makeRepo(tasks: TaskSummary[] = [], overrides: Partial<TaskRepository> = {}): TaskRepository {
  return {
    list: vi.fn().mockReturnValue(tasks),
    get: vi.fn(), add: vi.fn().mockReturnValue(makeTask()), update: vi.fn().mockReturnValue(makeTask()),
    complete: vi.fn(), getDetails: vi.fn(), setDetails: vi.fn(), addDependency: vi.fn(),
    nextId: vi.fn(), listHabits: vi.fn(), listProjects: vi.fn(), getProjectTasks: vi.fn(),
    updateProjectTask: vi.fn(), maxId: vi.fn(),
    ...overrides,
  } as unknown as TaskRepository;
}

describe('syncGoogleTasks', () => {
  it('returns "nothing new" when lists match and no changes needed', () => {
    const db = makeTask({ id: 1, external_id: 'gid1', eta: '2026-05-01', status: 'idea' });
    const repo = makeRepo([db]);
    const result = syncGoogleTasks(
      [{ id: 'gid1', title: 'Existing task', status: 'needsAction', due: '2026-05-01T00:00:00.000Z' }],
      repo,
    );
    expect(result).toBe('Google Tasks: nothing new');
    expect(repo.add).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.complete).not.toHaveBeenCalled();
  });

  it('returns "nothing new" for empty Google Tasks list', () => {
    const repo = makeRepo();
    expect(syncGoogleTasks([], repo)).toBe('Google Tasks: nothing new');
  });

  // ── Case A — completed ──────────────────────────────────────────────────

  describe('Case A — completed Google task', () => {
    it('completes a matching DB task', () => {
      const db = makeTask({ id: 5, external_id: 'gid-done', status: 'idea' });
      const repo = makeRepo([db]);
      const result = syncGoogleTasks(
        [{ id: 'gid-done', title: 'Some task', status: 'completed' }],
        repo,
      );
      expect(repo.complete).toHaveBeenCalledWith(5);
      expect(result).toBe('Google Tasks: added 0, completed 1, updated 0');
    });

    it('does not re-complete an already-done task', () => {
      const db = makeTask({ id: 5, external_id: 'gid-done', status: 'done' });
      const repo = makeRepo([db]);
      syncGoogleTasks([{ id: 'gid-done', title: 'Some task', status: 'completed' }], repo);
      expect(repo.complete).not.toHaveBeenCalled();
    });

    it('ignores completed Google task with no DB match', () => {
      const repo = makeRepo([]);
      syncGoogleTasks([{ id: 'no-match', title: 'Ghost', status: 'completed' }], repo);
      expect(repo.complete).not.toHaveBeenCalled();
      expect(repo.add).not.toHaveBeenCalled();
    });
  });

  // ── Case B — new task ───────────────────────────────────────────────────

  describe('Case B — new Google task', () => {
    it('adds a task with no due date', () => {
      const repo = makeRepo([]);
      const result = syncGoogleTasks(
        [{ id: 'new-gid', title: 'Buy milk', status: 'needsAction' }],
        repo,
      );
      expect(repo.add).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Buy milk', external_id: 'new-gid', size: 'S',
      }));
      expect(repo.add).toHaveBeenCalledWith(expect.not.objectContaining({ eta: expect.anything() }));
      expect(result).toBe('Google Tasks: added 1, completed 0, updated 0');
    });

    it('adds a task with a due date', () => {
      const repo = makeRepo([]);
      syncGoogleTasks(
        [{ id: 'new-gid', title: 'Buy milk', status: 'needsAction', due: '2026-06-01T00:00:00.000Z' }],
        repo,
      );
      expect(repo.add).toHaveBeenCalledWith(expect.objectContaining({ eta: '2026-06-01' }));
    });

    it('strips time component from due date', () => {
      const repo = makeRepo([]);
      syncGoogleTasks(
        [{ id: 'gid', title: 'Task', status: 'needsAction', due: '2026-04-30T00:00:00.000Z' }],
        repo,
      );
      expect(repo.add).toHaveBeenCalledWith(expect.objectContaining({ eta: '2026-04-30' }));
    });
  });

  // ── Case C — existing task ──────────────────────────────────────────────

  describe('Case C — existing Google task', () => {
    it('fills in missing eta from Google', () => {
      const db = makeTask({ id: 3, external_id: 'gid3', eta: null, eta_description: null });
      const repo = makeRepo([db]);
      const result = syncGoogleTasks(
        [{ id: 'gid3', title: 'Existing task', status: 'needsAction', due: '2026-07-01T00:00:00.000Z' }],
        repo,
      );
      expect(repo.update).toHaveBeenCalledWith(3, { eta: '2026-07-01' });
      expect(result).toBe('Google Tasks: added 0, completed 0, updated 1');
    });

    it('does not overwrite existing DB eta', () => {
      const db = makeTask({ id: 3, external_id: 'gid3', eta: '2026-05-01' });
      const repo = makeRepo([db]);
      syncGoogleTasks(
        [{ id: 'gid3', title: 'Existing task', status: 'needsAction', due: '2026-07-01T00:00:00.000Z' }],
        repo,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('does not overwrite existing DB eta_description', () => {
      const db = makeTask({ id: 3, external_id: 'gid3', eta: null, eta_description: '~May 2026' });
      const repo = makeRepo([db]);
      syncGoogleTasks(
        [{ id: 'gid3', title: 'Existing task', status: 'needsAction', due: '2026-07-01T00:00:00.000Z' }],
        repo,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('does not update title from Google (DB title wins)', () => {
      const db = makeTask({ id: 3, external_id: 'gid3', title: 'Long DB title with extra detail' });
      const repo = makeRepo([db]);
      syncGoogleTasks(
        [{ id: 'gid3', title: 'Long DB title', status: 'needsAction' }],
        repo,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  // ── summary format ──────────────────────────────────────────────────────

  it('reports combined counts correctly', () => {
    const existing = makeTask({ id: 2, external_id: 'existing', status: 'idea', eta: null, eta_description: null });
    const done     = makeTask({ id: 3, external_id: 'will-complete', status: 'idea' });
    const repo = makeRepo([existing, done]);
    const result = syncGoogleTasks([
      { id: 'new1',          title: 'New task',  status: 'needsAction' },
      { id: 'will-complete', title: 'Done task', status: 'completed' },
      { id: 'existing',      title: 'Existing',  status: 'needsAction', due: '2026-08-01T00:00:00.000Z' },
    ], repo);
    expect(result).toBe('Google Tasks: added 1, completed 1, updated 1');
  });
});
