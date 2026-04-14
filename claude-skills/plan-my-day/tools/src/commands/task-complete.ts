import type { TaskRepository } from '../repository.js';
import { parseArgs, resolveRef } from '../args.js';

export function taskComplete(argv: string[], repo: TaskRepository): unknown {
  const { positionals } = parseArgs(argv);
  if (!positionals[0]) throw new Error('Usage: pmd task complete <id|slug>');
  const ref = resolveRef(positionals[0]);
  repo.complete(ref);
  return { ok: true, id: ref };
}
