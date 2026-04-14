import { describe, it, expect, vi } from 'vitest';
import type { TaskRepository, TaskSummary } from '../../repository.js';
import { taskList } from '../../commands/task-list.js';

function makeRepo(overrides: Partial<TaskRepository> = {}): TaskRepository {
  return {
    list: vi.fn().mockReturnValue([]),
    get: vi.fn(), add: vi.fn(), update: vi.fn(), complete: vi.fn(),
    getDetails: vi.fn(), setDetails: vi.fn(), addDependency: vi.fn(),
    nextId: vi.fn(), listHabits: vi.fn(), listProjects: vi.fn(),
    getProjectTasks: vi.fn(), updateProjectTask: vi.fn(), maxId: vi.fn(),
    ...overrides,
  } as unknown as TaskRepository;
}

const sampleTask: TaskSummary = {
  id: 1, slug: null, type: 'task', title: 'Test', size: 'S',
  eta: null, eta_description: null, status: 'idea', priority: null,
  section: null, external_id: null, project_slug: null, project_name: null, has_details: 0,
};

describe('taskList command', () => {
  it('calls list with no options by default', () => {
    const repo = makeRepo();
    taskList([], repo);
    expect(repo.list).toHaveBeenCalledWith({ status: undefined, project: undefined });
  });

  it('passes status filter', () => {
    const repo = makeRepo();
    taskList(['--status', 'in-progress'], repo);
    expect(repo.list).toHaveBeenCalledWith({ status: 'in-progress', project: undefined });
  });

  it('passes project filter', () => {
    const repo = makeRepo();
    taskList(['--project', 'house-move'], repo);
    expect(repo.list).toHaveBeenCalledWith({ status: undefined, project: 'house-move' });
  });

  it('returns list result', () => {
    const repo = makeRepo({ list: vi.fn().mockReturnValue([sampleTask]) } as Partial<TaskRepository>);
    const result = taskList([], repo);
    expect(result).toEqual([sampleTask]);
  });
});
