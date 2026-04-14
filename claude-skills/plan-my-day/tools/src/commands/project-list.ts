import type { TaskRepository } from '../repository.js';

export function projectList(_argv: string[], repo: TaskRepository): unknown {
  return repo.listProjects();
}
