import { join } from 'node:path';
import Database from 'better-sqlite3';
import { openDb } from './db.js';
import { SqliteTaskRepository } from './repository.js';
import { migrate } from './migrate.js';
import { taskList }     from './commands/task-list.js';
import { taskGet }      from './commands/task-get.js';
import { taskAdd }      from './commands/task-add.js';
import { taskUpdate }   from './commands/task-update.js';
import { taskComplete } from './commands/task-complete.js';
import { taskDetails, taskDetailsSet } from './commands/task-details.js';
import { taskDepAdd }   from './commands/task-dep-add.js';
import { habitList }    from './commands/habit-list.js';
import { projectList }  from './commands/project-list.js';
import { projectTasks } from './commands/project-tasks.js';
import { projectUpdate } from './commands/project-update.js';
import { gtasksSync }   from './commands/gtasks-sync.js';
import { parseArgs, optArg } from './args.js';

// ── DB path ───────────────────────────────────────────────────────────────���

function getDbPath(): string {
  // Allow override via PMD_DB env var for testing
  const env = process.env['PMD_DB'];
  if (env) return env;
  // Default: data/tasks.db relative to this script's location (dist/../data/)
  return join(import.meta.dirname, '..', '..', 'data', 'tasks.db');
}

// ── Output ──────────────────────────────���──────────────────────────────���───

function formatHuman(data: unknown): string {
  if (Array.isArray(data)) {
    if (data.length === 0) return '(no results)';
    const keys = Object.keys(data[0] as object);
    const rows = data as Record<string, unknown>[];
    const widths = keys.map(k => Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)));
    const header = keys.map((k, i) => k.padEnd(widths[i])).join('  ');
    const sep    = widths.map(w => '-'.repeat(w)).join('  ');
    const lines  = rows.map(r => keys.map((k, i) => String(r[k] ?? '').padEnd(widths[i])).join('  '));
    return [header, sep, ...lines].join('\n');
  }
  return JSON.stringify(data, null, 2);
}

// ── Router ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { positionals: cmds, named } = parseArgs(argv);
  const human = 'human' in named;
  const rest  = argv.filter(a => a !== '--human');

  let db: Database.Database | null = null;
  let result: unknown;

  try {
    const [cmd, sub] = cmds;

    // ── pmd migrate ────────────────���───────────────────────────���───────────
    if (cmd === 'migrate') {
      const from   = optArg(named, 'from');
      const dryRun = 'dry-run' in named;
      if (!from) throw new Error('Usage: pmd migrate --from <data-dir> [--dry-run]');
      db = openDb(getDbPath());
      result = migrate(db, from, dryRun);

    // ── pmd max-id ─────────────────────────────────────────────────────────
    } else if (cmd === 'max-id') {
      db = openDb(getDbPath());
      result = { max_id: new SqliteTaskRepository(db).maxId() };

    // ── pmd task <subcommand> ──────────────────────────────────────────────
    } else if (cmd === 'task') {
      db = openDb(getDbPath());
      const repo = new SqliteTaskRepository(db);
      const subArgv = rest.slice(rest.indexOf(sub ?? '') + 1);
      switch (sub) {
        case 'list':         result = taskList(subArgv, repo);       break;
        case 'get':          result = taskGet(subArgv, repo);        break;
        case 'add':          result = taskAdd(subArgv, repo);        break;
        case 'update':       result = taskUpdate(subArgv, repo);     break;
        case 'complete':     result = taskComplete(subArgv, repo);   break;
        case 'details':      result = taskDetails(subArgv, repo);    break;
        case 'details-set':  result = taskDetailsSet(subArgv, repo); break;
        case 'dep-add':      result = taskDepAdd(subArgv, repo);     break;
        default: throw new Error(`Unknown task subcommand: ${sub}. Try: list get add update complete details details-set dep-add`);
      }

    // ── pmd habit <subcommand> ─────────────────────────────────────────────
    } else if (cmd === 'habit') {
      db = openDb(getDbPath());
      const repo = new SqliteTaskRepository(db);
      switch (sub) {
        case 'list': result = habitList([], repo); break;
        default: throw new Error(`Unknown habit subcommand: ${sub}`);
      }

    // ── pmd project <subcommand> ───────────────────────────────────────────
    } else if (cmd === 'project') {
      db = openDb(getDbPath());
      const repo = new SqliteTaskRepository(db);
      const subArgv = rest.slice(rest.indexOf(sub ?? '') + 1);
      switch (sub) {
        case 'list':   result = projectList(subArgv, repo);   break;
        case 'tasks':  result = projectTasks(subArgv, repo);  break;
        case 'update': result = projectUpdate(subArgv, repo); break;
        default: throw new Error(`Unknown project subcommand: ${sub}`);
      }

    // ── pmd gtasks-sync ───────────────────────────────────────────────────────
    } else if (cmd === 'gtasks-sync') {
      db = openDb(getDbPath());
      const repo = new SqliteTaskRepository(db);
      const subArgv = rest.slice(rest.indexOf('gtasks-sync') + 1);
      // Returns a plain string — print directly, not JSON-wrapped
      console.log(await gtasksSync(subArgv, repo));
      process.exit(0);

    } else {
      throw new Error(`Unknown command: ${cmd}. Try: task habit project max-id migrate gtasks-sync`);
    }

    if (human) {
      console.log(formatHuman(result));
    } else {
      console.log(JSON.stringify(result));
    }
    process.exit(0);

  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  } finally {
    db?.close();
  }
}

main();
