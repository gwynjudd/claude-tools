import type { TaskRepository, DependencyType } from '../repository.js';
import { parseArgs, requireArg, optArg, resolveRef } from '../args.js';

export function taskDepAdd(argv: string[], repo: TaskRepository): unknown {
  const { positionals, named } = parseArgs(argv);
  if (!positionals[0]) throw new Error('Usage: pmd task dep-add <id|slug> --depends-on <id|slug> [--type hard|soft]');
  const ref      = resolveRef(positionals[0]);
  const depOn    = resolveRef(requireArg(named, 'depends-on'));
  const depType  = (optArg(named, 'type') ?? 'hard') as DependencyType;
  repo.addDependency(ref, depOn, depType);
  return { ok: true };
}
