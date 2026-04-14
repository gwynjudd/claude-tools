import type { TaskRepository } from '../repository.js';
import { parseArgs, resolveRef } from '../args.js';

export function taskGet(argv: string[], repo: TaskRepository): unknown {
  const { positionals } = parseArgs(argv);
  if (!positionals[0]) throw new Error('Usage: pmd task get <id|slug>');
  const task = repo.get(resolveRef(positionals[0]));
  if (!task) throw new Error(`Task not found: ${positionals[0]}`);
  return task;
}
