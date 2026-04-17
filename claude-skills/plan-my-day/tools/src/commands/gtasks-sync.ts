import { getAccessToken } from '@gwynj/google-oauth';
import type { TaskRepository, TaskSummary } from '../repository.js';

interface GTask {
	id: string;
	title: string;
	status: 'needsAction' | 'completed';
	due?: string; // "2026-04-30T00:00:00.000Z" or "YYYY-MM-DD" or absent
}

interface GTaskListItem {
	id: string;
	title: string;
}
interface GTaskItem {
	id: string;
	title: string;
	status: 'needsAction' | 'completed';
	due?: string;
}

function parseEta(due?: string): string | undefined {
	if (!due) return undefined;
	return due.split('T')[0]; // strip time component if present
}

async function tasksGet<T>(token: string, path: string): Promise<T> {
	const res = await fetch(`https://tasks.googleapis.com/tasks/v1${path}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok)
		throw new Error(
			`Tasks API ${res.status} on ${path}: ${await res.text()}`
		);
	return res.json() as Promise<T>;
}

async function fetchGoogleTasks(): Promise<GTask[]> {
	const token = await getAccessToken('tasks');
	const lists = await tasksGet<{ items?: GTaskListItem[] }>(
		token,
		'/users/@me/lists'
	);
	const listIds = (lists.items ?? []).map((l) => l.id);
	const taskPages = await Promise.all(
		listIds.map((id) =>
			tasksGet<{ items?: GTaskItem[] }>(
				token,
				`/lists/${id}/tasks?showCompleted=true&showHidden=false`
			)
		)
	);
	return taskPages.flatMap((p) =>
		(p.items ?? []).map((item) => ({
			id: item.id,
			title: item.title,
			status: item.status,
			...(item.due ? { due: item.due } : {}),
		}))
	);
}

/** Pure sync logic — exported for testing. */
export function syncGoogleTasks(gTasks: GTask[], repo: TaskRepository): string {
	const allTasks = repo.list({ status: 'all' });
	const byExtId = new Map<string, TaskSummary>();
	for (const t of allTasks) if (t.external_id) byExtId.set(t.external_id, t);

	let added = 0,
		completed = 0,
		updated = 0;

	for (const g of gTasks) {
		const db = byExtId.get(g.id);
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
				repo.add({
					title: g.title,
					size: 'S',
					external_id: g.id,
					...(eta ? { eta } : {}),
				});
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

/** CLI entry point — fetches Google Tasks via REST API and syncs to DB. */
export async function gtasksSync(
	_argv: string[],
	repo: TaskRepository
): Promise<string> {
	const gTasks = await fetchGoogleTasks();
	return syncGoogleTasks(gTasks, repo);
}
