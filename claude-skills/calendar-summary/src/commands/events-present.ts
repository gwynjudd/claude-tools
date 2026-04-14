/**
 * commands/events-present.ts
 * Implements: cal events present [--format human|json|pmd] [--input <file>]
 *
 * Reads FetchEventsOutput JSON from stdin (or --input file) and formats it.
 */

import { readFileSync } from 'node:fs';
import type { Nearness, PrepLevel, ScoredEvent, FetchEventsOutput } from '../types.js';

// ── Priority matrix ───────────────────────────────────────────────────────────

export function priorityColor(
  n: Nearness,
  prep: PrepLevel,
): '🔴' | '🟡' | '🟢' | undefined {
  switch (n) {
    case 'IMMINENT':
    case 'VERY_SOON':
      return prep === 'LOW' ? '🟡' : '🔴';
    case 'THIS_WEEK':
      if (prep === 'HIGH')   return '🔴';
      if (prep === 'MEDIUM') return '🟡';
      return '🟢';
    case 'NEXT_WEEK':
      return prep === 'LOW' ? '🟢' : '🟡';
    case 'THIS_MONTH':
      return prep === 'HIGH' ? '🟡' : '🟢';
    case 'LATER':
      return prep === 'LOW' ? undefined : '🟢';
  }
}

// ── Date formatting ───────────────────────────────────────────────────────────

function formatEventDate(event: ScoredEvent): string {
  const start = event.start.dateTime ?? event.start.date ?? '';
  const end   = event.end.dateTime   ?? event.end.date   ?? '';

  const startDate = start.slice(0, 10);
  const endDate   = end.slice(0, 10);

  // All-day events: end date in Google is exclusive, subtract a day
  const isAllDay = !event.start.dateTime;
  const effectiveEndDate = isAllDay
    ? new Date(new Date(endDate).getTime() - 86_400_000).toISOString().slice(0, 10)
    : endDate.slice(0, 10);

  const fmt = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-NZ', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'Pacific/Auckland',
    });
  };

  if (startDate === effectiveEndDate || (!isAllDay && startDate === endDate.slice(0, 10))) {
    return fmt(startDate);
  }
  return `${fmt(startDate)} – ${fmt(effectiveEndDate)}`;
}

function formatEventTime(event: ScoredEvent): string {
  if (!event.start.dateTime) return 'All day';
  const dt = new Date(event.start.dateTime);
  return dt.toLocaleTimeString('en-NZ', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Pacific/Auckland',
  }).toLowerCase();
}

// ── human format ─────────────────────────────────────────────────────────────

function formatHuman(output: FetchEventsOutput): string {
  const lines: string[] = [
    `## Calendar Summary — next ${output.window_days} days\n`,
  ];

  // Separate events into buckets by color; skip LATER+LOW (undefined)
  const red:    ScoredEvent[] = [];
  const yellow: ScoredEvent[] = [];
  const green:  ScoredEvent[] = [];

  for (const ev of output.events) {
    const color = priorityColor(ev.nearness, ev.prep_level ?? 'LOW');
    if (color === '🔴') red.push(ev);
    else if (color === '🟡') yellow.push(ev);
    else if (color === '🟢') green.push(ev);
    // undefined = omit
  }

  const tableHeader = '| Date | Event | Calendar | Prep | Notes |\n|---|---|---|---|---|';

  function tableRows(events: ScoredEvent[]): string {
    return events
      .sort((a, b) => a.days_until - b.days_until)
      .map(ev => {
        const date  = formatEventDate(ev);
        const title = ev.summary ?? '(untitled)';
        const cal   = ev.calendarName;
        const prep  = ev.prep_level ?? '—';
        const notes = ev.notes ?? '';
        return `| ${date} | ${title} | ${cal} | ${prep} | ${notes} |`;
      })
      .join('\n');
  }

  if (red.length > 0) {
    lines.push('### 🔴 Urgent / Needs attention now\n');
    lines.push(tableHeader);
    lines.push(tableRows(red));
    lines.push('');
  }

  if (yellow.length > 0) {
    lines.push('### 🟡 Coming up — act soon\n');
    lines.push(tableHeader);
    lines.push(tableRows(yellow));
    lines.push('');
  }

  if (green.length > 0) {
    lines.push('### 🟢 On the radar\n');
    lines.push(tableHeader);
    lines.push(tableRows(green));
    lines.push('');
  }

  if (red.length === 0 && yellow.length === 0 && green.length === 0) {
    lines.push('_No events in this window._');
  }

  const calCount = new Set(output.events.map(e => e.calendarId)).size;
  lines.push(`_${output.events.length} events across ${calCount} calendars · next ${output.window_days} days_`);

  return lines.join('\n');
}

// ── pmd format ────────────────────────────────────────────────────────────────

function formatPmd(output: FetchEventsOutput): string {
  const lines: string[] = [];

  // Yesterday section
  if (output.yesterday_events && output.yesterday_events.length > 0) {
    lines.push('### ⏮ Yesterday — anything slipped?\n');
    for (const ev of output.yesterday_events) {
      const title = ev.summary ?? '(untitled)';
      const note  = ev.notes ? ` — _${ev.notes}_` : '';
      lines.push(`- ${title}${note}`);
    }
    lines.push('\n---\n');
  }

  // Today's events
  const today = output.today;
  const todayEvents = output.events.filter(ev => {
    const d = (ev.start.dateTime ?? ev.start.date ?? '').slice(0, 10);
    return d === today;
  });

  lines.push('### 📅 Today\n');
  if (todayEvents.length === 0) {
    lines.push('_No events today._\n');
  } else {
    lines.push('| Time | Event | Notes |');
    lines.push('|---|---|---|');
    for (const ev of todayEvents.sort((a, b) => a.days_until - b.days_until)) {
      const time  = formatEventTime(ev);
      const title = ev.summary ?? '(untitled)';
      const note  = ev.location ?? ev.notes ?? '';
      lines.push(`| ${time} | ${title} | ${note} |`);
    }
    lines.push('');

    // Heads-up: weekday events 8am–6pm
    const now  = new Date();
    const dow  = now.getDay(); // 0=Sun, 6=Sat
    if (dow >= 1 && dow <= 5) {
      const headsUp = todayEvents.filter(ev => {
        if (!ev.start.dateTime) return false;
        const h = new Date(ev.start.dateTime).getHours();
        return h >= 8 && h < 18;
      });
      for (const ev of headsUp) {
        const time  = formatEventTime(ev);
        const title = ev.summary ?? '(untitled)';
        lines.push(`**Heads up:** you have ${title} at ${time}`);
      }
      if (headsUp.length > 0) lines.push('');
    }
  }

  // Coming up (next 30 days, 🔴 and 🟡 only)
  const upcoming = output.events.filter(ev => {
    const d = (ev.start.dateTime ?? ev.start.date ?? '').slice(0, 10);
    if (d === today) return false; // already shown in Today
    const color = priorityColor(ev.nearness, ev.prep_level ?? 'LOW');
    return color === '🔴' || color === '🟡';
  });

  if (upcoming.length > 0) {
    lines.push('**Coming up (next 30 days):**');
    for (const ev of upcoming.sort((a, b) => a.days_until - b.days_until)) {
      const date  = formatEventDate(ev);
      const title = ev.summary ?? '(untitled)';
      const color = priorityColor(ev.nearness, ev.prep_level ?? 'LOW')!;
      lines.push(`- ${date} — ${title} _${color}_`);
    }
  }

  return lines.join('\n');
}

// ── json format ───────────────────────────────────────────────────────────────

function formatJson(output: FetchEventsOutput): string {
  return JSON.stringify(output, null, 2);
}

// ── CLI entry point ───────────────────────────────────────────────────────────

export async function run(argv: string[]): Promise<void> {
  let format: 'human' | 'json' | 'pmd' = 'human';
  let inputFile: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === '--format' || argv[i] === '-f') && argv[i + 1]) {
      const f = argv[++i];
      if (f !== 'human' && f !== 'json' && f !== 'pmd') {
        throw new Error(`Unknown format "${f}". Use: human, json, pmd`);
      }
      format = f;
    } else if (argv[i] === '--input' && argv[i + 1]) {
      inputFile = argv[++i];
    }
  }

  const raw = inputFile
    ? readFileSync(inputFile, 'utf8')
    : readFileSync('/dev/stdin', 'utf8');

  const output = JSON.parse(raw) as FetchEventsOutput;

  switch (format) {
    case 'human': console.log(formatHuman(output)); break;
    case 'json':  console.log(formatJson(output));  break;
    case 'pmd':   console.log(formatPmd(output));   break;
  }
}
