import type { TaskRepository, TaskType, TaskSize, TaskStatus, Priority } from '../repository.js';
import { parseArgs, requireArg, optArg } from '../args.js';

export function taskAdd(argv: string[], repo: TaskRepository): unknown {
  const { named } = parseArgs(argv);
  const title = requireArg(named, 'title');

  // Resolve project_id from slug if provided
  let project_id: number | undefined;
  const projectSlug = optArg(named, 'project');
  if (projectSlug) {
    const projects = repo.listProjects();
    const p = projects.find(p => p.slug === projectSlug);
    if (!p) throw new Error(`Project not found: ${projectSlug}`);
    project_id = p.id;
  }

  const task = repo.add({
    title,
    type:            optArg(named, 'type') as TaskType | undefined,
    size:            optArg(named, 'size') as TaskSize | undefined,
    eta:             optArg(named, 'eta'),
    eta_description: optArg(named, 'eta-desc'),
    status:          optArg(named, 'status') as TaskStatus | undefined,
    priority:        optArg(named, 'priority') as Priority | undefined,
    external_id:     optArg(named, 'external-id'),
    section:         optArg(named, 'section'),
    slug:            optArg(named, 'slug'),
    project_id,
  });

  return task;
}
