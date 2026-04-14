import type { TaskRepository } from '../repository.js';

export function habitList(_argv: string[], repo: TaskRepository): unknown {
  return repo.listHabits();
}
