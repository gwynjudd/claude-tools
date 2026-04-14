import type { TaskRepository, TaskStatus } from '../repository.js';
import { parseArgs, optArg } from '../args.js';

export function taskList(argv: string[], repo: TaskRepository): unknown {
  const { named } = parseArgs(argv);
  const status  = optArg(named, 'status') as TaskStatus | 'all' | undefined;
  const project = optArg(named, 'project');
  return repo.list({ status, project });
}
