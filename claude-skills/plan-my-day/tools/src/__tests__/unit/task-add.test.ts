import { describe, it, expect, vi } from 'vitest';
import type { TaskRepository, TaskSummary } from '../../repository.js';
import { taskAdd } from '../../commands/task-add.js';

function makeRepo(overrides: Partial<TaskRepository> = {}): TaskRepository {
  const addedTask: TaskSummary = {
    id: 1, slug: null, type: 'task', title: '', size: null,
    eta: null, eta_description: null, status: 'idea', priority: null,
    section: null, external_id: null, project_slug: null, project_name: null, has_details: 0,
  };
  return {
    list: vi.fn().mockReturnValue([]),
    get: vi.fn(), add: vi.fn().mockReturnValue(addedTask), update: vi.fn(), complete: vi.fn(),
    getDetails: vi.fn(), setDetails: vi.fn(), addDependency: vi.fn(),
    nextId: vi.fn(), listHabits: vi.fn(), listProjects: vi.fn().mockReturnValue([]),
    getProjectTasks: vi.fn(), updateProjectTask: vi.fn(), maxId: vi.fn(),
    ...overrides,
  } as unknown as TaskRepository;
}

describe('taskAdd command', () => {
  it('requires --title', () => {
    const repo = makeRepo();
    expect(() => taskAdd([], repo)).toThrow('--title');
  });

  it('passes title to repo.add', () => {
    const repo = makeRepo();
    taskAdd(['--title', 'My task'], repo);
    expect(repo.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'My task' }));
  });

  it('passes optional fields', () => {
    const repo = makeRepo();
    taskAdd(['--title', 'T', '--size', 'L', '--status', 'in-progress', '--priority', 'High'], repo);
    expect(repo.add).toHaveBeenCalledWith(expect.objectContaining({
      size: 'L', status: 'in-progress', priority: 'High',
    }));
  });

  it('throws if project not found', () => {
    const repo = makeRepo({ listProjects: vi.fn().mockReturnValue([]) } as Partial<TaskRepository>);
    expect(() => taskAdd(['--title', 'T', '--project', 'no-such'], repo)).toThrow('Project not found');
  });
});
