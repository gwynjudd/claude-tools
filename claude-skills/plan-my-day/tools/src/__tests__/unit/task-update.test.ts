import { describe, it, expect, vi } from 'vitest';
import type { TaskRepository, TaskSummary } from '../../repository.js';
import { taskUpdate } from '../../commands/task-update.js';

function makeRepo(overrides: Partial<TaskRepository> = {}): TaskRepository {
  const task: TaskSummary = {
    id: 5, slug: 'my-task', type: 'task', title: 'Old', size: 'S',
    eta: null, eta_description: null, status: 'idea', priority: null,
    section: null, external_id: null, project_slug: null, project_name: null, has_details: 0,
  };
  return {
    list: vi.fn(), get: vi.fn(), add: vi.fn(),
    update: vi.fn().mockReturnValue(task), complete: vi.fn(),
    getDetails: vi.fn(), setDetails: vi.fn(), addDependency: vi.fn(),
    nextId: vi.fn(), listHabits: vi.fn(), listProjects: vi.fn(),
    getProjectTasks: vi.fn(), updateProjectTask: vi.fn(), maxId: vi.fn(),
    ...overrides,
  } as unknown as TaskRepository;
}

describe('taskUpdate command', () => {
  it('requires positional id/slug', () => {
    const repo = makeRepo();
    expect(() => taskUpdate([], repo)).toThrow('Usage');
  });

  it('updates by numeric id', () => {
    const repo = makeRepo();
    taskUpdate(['5', '--title', 'New title'], repo);
    expect(repo.update).toHaveBeenCalledWith(5, expect.objectContaining({ title: 'New title' }));
  });

  it('updates by slug', () => {
    const repo = makeRepo();
    taskUpdate(['my-task', '--status', 'done'], repo);
    expect(repo.update).toHaveBeenCalledWith('my-task', expect.objectContaining({ status: 'done' }));
  });

  it('passes null for explicit --eta null', () => {
    const repo = makeRepo();
    taskUpdate(['5', '--eta', 'null'], repo);
    expect(repo.update).toHaveBeenCalledWith(5, expect.objectContaining({ eta: null }));
  });

  it('throws if no fields', () => {
    const repo = makeRepo({ update: vi.fn().mockImplementation(() => { throw new Error('No fields to update'); }) } as Partial<TaskRepository>);
    expect(() => taskUpdate(['5'], repo)).toThrow('No fields to update');
  });
});
