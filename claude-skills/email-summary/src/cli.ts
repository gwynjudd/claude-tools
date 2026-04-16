/**
 * cli.ts — email CLI router
 *
 * Subcommands:
 *   email auth reauth               → reauth('gmail')
 *   email auth migrate              → migrateGmailTokens()
 *   email cache store-ai --id <id> --category <CAT>  → storeAiClassification(id, cat)
 */

import { reauth, migrateGmailTokens } from '@gwynj/google-oauth';
import { storeAiClassification } from './email-cache.js';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const [cmd, sub, ...rest] = argv;

  try {
    switch (cmd) {
      case 'auth': {
        switch (sub) {
          case 'reauth':
            await reauth('gmail');
            break;
          case 'migrate':
            await migrateGmailTokens();
            break;
          default:
            throw new Error(`Unknown auth subcommand: ${sub}. Use: reauth, migrate`);
        }
        break;
      }

      case 'cache': {
        switch (sub) {
          case 'store-ai': {
            let id: string | undefined;
            let category: string | undefined;
            for (let i = 0; i < rest.length; i++) {
              if (rest[i] === '--id' && rest[i + 1]) id = rest[++i];
              else if (rest[i] === '--category' && rest[i + 1]) category = rest[++i];
            }
            if (!id) throw new Error('Missing required flag: --id');
            if (!category) throw new Error('Missing required flag: --category');
            storeAiClassification(id, category);
            break;
          }
          default:
            throw new Error(`Unknown cache subcommand: ${sub}. Use: store-ai`);
        }
        break;
      }

      default:
        throw new Error(`Unknown command: ${cmd}. Use: auth, cache`);
    }
  } catch (err) {
    console.error(`email: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
