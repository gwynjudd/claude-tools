/**
 * commands/events-fetch.ts
 * Implements: cal events fetch [--window 4w|14d|3m] [--yesterday] [--account normal]
 *
 * Fetches events from all non-excluded calendars, scores them for nearness,
 * looks up the cache for prep_level/notes, and writes FetchEventsOutput JSON to stdout.
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listCalendars, listEvents } from '../calendar-api.js';
import type {
  CalendarEvent,
  ScoredEvent,
  Nearness,
  FetchEventsOutput,
  EventCache,
} from '../types.js';

const TZ = 'Pacific/Auckland';
const CACHE_PATH = join(homedir(), '.config', 'calendar-summary', 'event-cache.json');

// Resolve config dir relative to dist/cli.js (one level up to package root, then config/)
const __dirname = dirname(fileURLToPath(import.meta.url));
const EXCLUDED_CALENDARS_PATH = join(__dirname, '..', 'config', 'excluded-calendars.json');

// ── Nearness scoring ─────────────────────────────────────────────────────────

export function nearness(daysUntil: number): Nearness {
  if (daysUntil <= 0) return 'IMMINENT';
  if (daysUntil <= 3) return 'VERY_SOON';
  if (daysUntil <= 7) return 'THIS_WEEK';
  if (daysUntil <= 14) return 'NEXT_WEEK';
  if (daysUntil <= 28) return 'THIS_MONTH';
  return 'LATER';
}

// ── Fingerprint ──────────────────────────────────────────────────────────────

export function fingerprint(event: Pick<CalendarEvent, 'summary' | 'description' | 'location' | 'start'>): string {
  const parts = [
    event.summary ?? '',
    event.description ?? '',
    event.location ?? '',
    event.start.dateTime ?? event.start.date ?? '',
  ];
  return createHash('sha256').update(parts.join('\0')).digest('hex');
}

// ── Window parsing ────────────────────────────────────────────────────────────

export function parseWindow(raw: string): number {
  const m = raw.match(/^(\d+)(d|w|m)$/i);
  if (!m) throw new Error(`Invalid window format "${raw}". Use e.g. 14d, 4w, 3m`);
  const n = parseInt(m[1], 10);
  switch (m[2].toLowerCase()) {
    case 'd': return n;
    case 'w': return n * 7;
    case 'm': return n * 30;
    default:  throw new Error(`Unknown unit: ${m[2]}`);
  }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayInTz(tz: string): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: tz }); // YYYY-MM-DD
}

function daysUntilEvent(event: CalendarEvent, today: string): number {
  const startStr = event.start.dateTime ?? event.start.date ?? '';
  const eventDate = startStr.slice(0, 10); // YYYY-MM-DD
  const todayMs = new Date(today + 'T00:00:00').getTime();
  const eventMs = new Date(eventDate + 'T00:00:00').getTime();
  return Math.floor((eventMs - todayMs) / (1000 * 60 * 60 * 24));
}

// ── Cache ─────────────────────────────────────────────────────────────────────

function loadCache(): EventCache {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as EventCache;
  } catch {
    return {};
  }
}

// ── Main command ─────────────────────────────────────────────────────────────

export interface FetchOptions {
  windowDays: number;
  yesterday: boolean;
  account: string;
}

export async function fetchEvents(opts: FetchOptions): Promise<FetchEventsOutput> {
  const today = todayInTz(TZ);

  // Load exclusion list
  let excludedIds: string[] = [];
  if (existsSync(EXCLUDED_CALENDARS_PATH)) {
    excludedIds = JSON.parse(readFileSync(EXCLUDED_CALENDARS_PATH, 'utf8')) as string[];
  }

  // Time window
  const timeMin = new Date(today + 'T00:00:00').toISOString();
  const timeMax = new Date(
    new Date(today + 'T00:00:00').getTime() + opts.windowDays * 24 * 60 * 60 * 1000
  ).toISOString();

  // Yesterday window (if requested)
  const yesterdayDate = new Date(new Date(today + 'T00:00:00').getTime() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const yesterdayMin = new Date(yesterdayDate + 'T00:00:00').toISOString();
  const yesterdayMax = new Date(today + 'T00:00:00').toISOString();

  // Load calendars
  const calendars = await listCalendars();
  const included = calendars.filter(c => !excludedIds.includes(c.id));

  const cache = loadCache();
  const fields = ['description', 'location', 'attendees', 'recurrence'];

  async function fetchAndScore(
    tMin: string,
    tMax: string,
    refToday: string,
  ): Promise<ScoredEvent[]> {
    const allEvents: ScoredEvent[] = [];

    for (const cal of included) {
      const calName = cal.summaryOverride ?? cal.summary;
      let rawEvents;
      try {
        rawEvents = await listEvents(cal.id, tMin, tMax, TZ, fields);
      } catch {
        // Skip calendars that fail (e.g. permission errors on shared calendars)
        continue;
      }

      for (const raw of rawEvents) {
        // Skip declined events
        const selfAttendee = raw.attendees?.find(a => a.self);
        if (selfAttendee?.responseStatus === 'declined') continue;

        const event: CalendarEvent = {
          ...raw,
          calendarId: cal.id,
          calendarName: calName,
        };

        const days_until = daysUntilEvent(event, refToday);
        const fp = fingerprint(event);
        const cached_entry = cache[event.id];
        const cacheHit = cached_entry && cached_entry.fingerprint === fp;

        const scored: ScoredEvent = {
          ...event,
          days_until,
          nearness: nearness(days_until),
          cached: cacheHit,
          ...(cacheHit ? {
            prep_level: cached_entry.prep_level,
            notes: cached_entry.notes,
          } : {}),
        };

        allEvents.push(scored);
      }
    }

    return allEvents;
  }

  const events = await fetchAndScore(timeMin, timeMax, today);
  const output: FetchEventsOutput = {
    generated_at: new Date().toISOString(),
    window_days: opts.windowDays,
    today,
    events,
  };

  if (opts.yesterday) {
    output.yesterday_events = await fetchAndScore(yesterdayMin, yesterdayMax, yesterdayDate);
  }

  return output;
}

// ── CLI entry point ──────────────────────────────────────────────────────────

export async function run(argv: string[]): Promise<void> {
  let windowStr = '4w';
  let yesterday = false;
  let account = 'normal';

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--window' && argv[i + 1]) windowStr = argv[++i];
    else if (argv[i] === '--yesterday') yesterday = true;
    else if (argv[i] === '--account' && argv[i + 1]) account = argv[++i];
  }

  const windowDays = parseWindow(windowStr);
  const output = await fetchEvents({ windowDays, yesterday, account });
  console.log(JSON.stringify(output, null, 2));
}
