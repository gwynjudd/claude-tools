import type { TaskRepository } from '../repository.js';
import { parseArgs, requireArg, resolveRef } from '../args.js';

export function taskDetails(argv: string[], repo: TaskRepository): unknown {
  const { positionals } = parseArgs(argv);
  if (!positionals[0]) throw new Error('Usage: pmd task details <id|slug>');
  const ref     = resolveRef(positionals[0]);
  const content = repo.getDetails(ref);
  return { id: ref, content };
}

export function taskDetailsSet(argv: string[], repo: TaskRepository): unknown {
  const { positionals, named } = parseArgs(argv);
  if (!positionals[0]) throw new Error('Usage: pmd task details-set <id|slug> --content <text>');
  const ref     = resolveRef(positionals[0]);
  const content = requireArg(named, 'content');
  repo.setDetails(ref, content);
  return { ok: true, id: ref };
}
