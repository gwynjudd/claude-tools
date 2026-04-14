/**
 * commands/apply-judgements.ts
 * Implements: cal judgements apply --fetch <file> [--format human|json|pmd]
 *
 * Reads a compact judgements array from stdin:
 *   [{"id": "...", "prep_level": "HIGH"|"MEDIUM"|"LOW", "notes": "..."}, ...]
 *
 * Patches the FetchEventsOutput JSON at --fetch <file>, updates the cache,
 * then outputs the result in the requested format.
 *
 * This keeps the AI's output small — just a JSON array of {id, prep_level, notes}
 * rather than rewriting the full event list.
 */

import { readFileSync } from 'node:fs';
import type { FetchEventsOutput, PrepLevel } from '../types.js';
import { updateCache } from './cache-update.js';

interface Judgement {
  id: string;
  prep_level: PrepLevel;
  notes: string;
}

export async function run(argv: string[]): Promise<void> {
  let fetchFile: string | undefined;
  let format: 'human' | 'json' | 'pmd' = 'pmd';

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--fetch' && argv[i + 1]) fetchFile = argv[++i];
    else if ((argv[i] === '--format' || argv[i] === '-f') && argv[i + 1]) {
      const f = argv[++i];
      if (f !== 'human' && f !== 'json' && f !== 'pmd') {
        throw new Error(`Unknown format "${f}". Use: human, json, pmd`);
      }
      format = f;
    }
  }

  if (!fetchFile) throw new Error('Usage: cal judgements apply --fetch <file> [--format pmd|human|json]');

  // Read the fetch output
  const output = JSON.parse(readFileSync(fetchFile, 'utf8')) as FetchEventsOutput;

  // Read judgements from stdin
  const raw = readFileSync('/dev/stdin', 'utf8').trim();
  if (!raw) {
    // No judgements — nothing to patch, still update cache (no-op) and present
  } else {
    const judgements = JSON.parse(raw) as Judgement[];
    const byId = new Map(judgements.map(j => [j.id, j]));

    // Patch events
    for (const ev of output.events) {
      const j = byId.get(ev.id);
      if (j) {
        ev.prep_level = j.prep_level;
        ev.notes = j.notes;
        ev.cached = true;
      }
    }
    if (output.yesterday_events) {
      for (const ev of output.yesterday_events) {
        const j = byId.get(ev.id);
        if (j) {
          ev.prep_level = j.prep_level;
          ev.notes = j.notes;
          ev.cached = true;
        }
      }
    }

    // Update cache
    updateCache(output);
  }

  // Present
  const { run: runPresent } = await import('./events-present.js');
  // Write patched JSON to a temp file for present to read
  const { writeFileSync } = await import('node:fs');
  writeFileSync(fetchFile + '.judged', JSON.stringify(output, null, 2));
  await runPresent(['--format', format, '--input', fetchFile + '.judged']);
}
