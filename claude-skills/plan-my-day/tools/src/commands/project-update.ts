import type { TaskRepository, TaskStatus } from '../repository.js';
import { parseArgs, requireArg, resolveRef } from '../args.js';

export function projectUpdate(argv: string[], repo: TaskRepository): unknown {
  const { positionals, named } = parseArgs(argv);
  if (positionals.length < 2) throw new Error('Usage: pmd project update <slug> <task-id|slug> --status <...>');
  const projectSlug = positionals[0];
  const taskRef     = resolveRef(positionals[1]);
  const status      = requireArg(named, 'status') as TaskStatus;
  return repo.updateProjectTask(projectSlug, taskRef, { status });
}
