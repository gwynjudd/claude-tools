import type { TaskRepository, TaskSummary } from '../repository.js';

interface GTask {
  id:     string;
  title:  string;
  status: 'needsAction' | 'completed';
  due?:   string; // "2026-04-30T00:00:00.000Z" or "YYYY-MM-DD" or absent
}

function parseEta(due?: string): string | undefined {
  if (!due) return undefined;
  return due.split('T')[0]; // strip time component if present
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

/** Pure sync logic — exported for testing. */
export function syncGoogleTasks(gTasks: GTask[], repo: TaskRepository): string {
  const allTasks = repo.list({ status: 'all' });
  const byExtId  = new Map<string, TaskSummary>();
  for (const t of allTasks) if (t.external_id) byExtId.set(t.external_id, t);

  let added = 0, completed = 0, updated = 0;

  for (const g of gTasks) {
    const db  = byExtId.get(g.id);
    const eta = parseEta(g.due);

    if (g.status === 'completed') {
      // Case A — mark done in DB if not already
      if (db && db.status !== 'done') {
        repo.complete(db.id);
        completed++;
      }
    } else {
      // needsAction
      if (!db) {
        // Case B — new task from Google, add to DB
        repo.add({ title: g.title, size: 'S', external_id: g.id, ...(eta ? { eta } : {}) });
        added++;
      } else {
        // Case C — existing task; DB title wins, only fill in missing eta
        if (eta && db.eta === null && db.eta_description === null) {
          repo.update(db.id, { eta });
          updated++;
        }
      }
    }
  }

  const total = added + completed + updated;
  return total === 0
    ? 'Google Tasks: nothing new'
    : `Google Tasks: added ${added}, completed ${completed}, updated ${updated}`;
}

/** CLI entry point — reads Google Tasks JSON from argv[0] or stdin. */
export async function gtasksSync(argv: string[], repo: TaskRepository): Promise<string> {
  const json = argv[0] ?? await readStdin();
  return syncGoogleTasks(JSON.parse(json.trim()), repo);
}
