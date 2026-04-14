/**
 * cli.ts — cal CLI router
 *
 * Subcommands:
 *   cal events fetch [--window 4w|14d|3m] [--yesterday] [--account normal]
 *   cal events present [--format human|json|pmd] [--input <file>]
 *   cal cache update
 *   cal event create|update|delete|respond [options]
 *   cal auth reauth [--account normal]
 *   cal auth migrate
 */

import { run as runFetch      } from './commands/events-fetch.js';
import { run as runPresent    } from './commands/events-present.js';
import { run as runCache      } from './commands/cache-update.js';
import { run as runManage     } from './commands/event-manage.js';
import { run as runJudgements } from './commands/apply-judgements.js';
import { reauth, migrateCalendarTokens } from '@gwynj/google-oauth';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const [cmd, sub, ...rest] = argv;

  try {
    switch (cmd) {
      case 'events':
        switch (sub) {
          case 'fetch':   await runFetch(rest);   break;
          case 'present': await runPresent(rest); break;
          default: throw new Error(
            `Unknown events subcommand: ${sub}. Use: fetch, present`
          );
        }
        break;

      case 'cache':
        switch (sub) {
          case 'update': await runCache(rest); break;
          default: throw new Error(
            `Unknown cache subcommand: ${sub}. Use: update`
          );
        }
        break;

      case 'judgements':
        switch (sub) {
          case 'apply': await runJudgements(rest); break;
          default: throw new Error(
            `Unknown judgements subcommand: ${sub}. Use: apply`
          );
        }
        break;

      case 'event':
        await runManage([sub, ...rest]);
        break;

      case 'auth': {
        const authArgv = [sub, ...rest];
        let account: string | undefined;
        for (let i = 0; i < authArgv.length; i++) {
          if (authArgv[i] === '--account' && authArgv[i + 1]) account = authArgv[++i];
        }
        switch (sub) {
          case 'reauth':
            await reauth('calendar', account);
            break;
          case 'migrate':
            await migrateCalendarTokens();
            break;
          default:
            throw new Error(`Unknown auth subcommand: ${sub}. Use: reauth, migrate`);
        }
        break;
      }

      default:
        throw new Error(
          `Unknown command: ${cmd}. Use: events, cache, event, auth`
        );
    }
  } catch (err) {
    console.error(`cal: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
