import type { TaskRepository, TaskStatus } from '../repository.js';
import { parseArgs, optArg } from '../args.js';

export function projectTasks(argv: string[], repo: TaskRepository): unknown {
  const { positionals, named } = parseArgs(argv);
  if (!positionals[0]) throw new Error('Usage: pmd project tasks <slug> [--section <name>] [--status idea|done|all]');
  const slug    = positionals[0];
  const section = optArg(named, 'section');
  const status  = optArg(named, 'status') as TaskStatus | 'all' | undefined;
  return repo.getProjectTasks(slug, section, status);
}
