/**
 * commands/cache-update.ts
 * Implements: cal cache update
 *
 * Reads a fully-judged FetchEventsOutput JSON from stdin, merges prep_level + notes
 * for all judged events into ~/.config/calendar-summary/event-cache.json (atomic write).
 */

import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fingerprint } from './events-fetch.js';
import type { FetchEventsOutput, EventCache, CacheEntry } from '../types.js';

const CACHE_PATH = join(homedir(), '.config', 'calendar-summary', 'event-cache.json');

function loadCache(): EventCache {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as EventCache;
  } catch {
    return {};
  }
}

function writeCache(cache: EventCache): void {
  const dir = dirname(CACHE_PATH);
  mkdirSync(dir, { recursive: true });
  const tmp = CACHE_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(cache, null, 2));
  renameSync(tmp, CACHE_PATH);
}

function todayYMD(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Pacific/Auckland' });
}

export function updateCache(output: FetchEventsOutput): { updated: number; skipped: number } {
  const cache = loadCache();
  let updated = 0;
  let skipped = 0;

  const allEvents = [
    ...output.events,
    ...(output.yesterday_events ?? []),
  ];

  for (const event of allEvents) {
    if (!event.prep_level) {
      // Not judged — skip (AI hasn't assigned a prep level)
      skipped++;
      continue;
    }

    const fp = fingerprint(event);
    const entry: CacheEntry = {
      fingerprint: fp,
      prep_level: event.prep_level,
      notes: event.notes ?? '',
      last_assessed: todayYMD(),
    };

    cache[event.id] = entry;
    updated++;
  }

  writeCache(cache);
  return { updated, skipped };
}

export async function run(_argv: string[]): Promise<void> {
  const stdin = readFileSync('/dev/stdin', 'utf8');
  const output = JSON.parse(stdin) as FetchEventsOutput;
  const { updated, skipped } = updateCache(output);
  console.error(`Cache updated: ${updated} entries written, ${skipped} skipped (no prep_level)`);
}
