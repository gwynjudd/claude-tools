import type { TaskRepository, TaskSize, TaskStatus, Priority } from '../repository.js';
import { parseArgs, optArg, resolveRef } from '../args.js';

export function taskUpdate(argv: string[], repo: TaskRepository): unknown {
  const { positionals, named } = parseArgs(argv);
  if (!positionals[0]) throw new Error('Usage: pmd task update <id|slug> [--field value ...]');

  const ref   = resolveRef(positionals[0]);
  const patch: Record<string, unknown> = {};

  // Collect only fields that were explicitly passed
  const fieldMap: Record<string, string> = {
    'title': 'title', 'size': 'size', 'eta': 'eta',
    'eta-desc': 'eta_description', 'status': 'status',
    'priority': 'priority', 'section': 'section', 'external-id': 'external_id',
  };

  for (const [flag, dbField] of Object.entries(fieldMap)) {
    if (flag in named) {
      const v = named[flag];
      patch[dbField] = v === 'null' || v === '' ? null : v;
    }
  }

  return repo.update(ref, patch as Parameters<TaskRepository['update']>[1]);
}
