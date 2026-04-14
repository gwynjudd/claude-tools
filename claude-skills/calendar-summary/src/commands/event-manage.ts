/**
 * commands/event-manage.ts
 * Implements: cal event create|update|delete|respond [options]
 *
 * Wraps Calendar REST write endpoints.
 */

import { createEvent, updateEvent, deleteEvent, respondToEvent } from '../calendar-api.js';

function parseKeyValues(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1]) {
      result[argv[i].slice(2)] = argv[++i];
    }
  }
  return result;
}

function require(opts: Record<string, string>, key: string): string {
  const val = opts[key];
  if (!val) throw new Error(`Missing required option: --${key}`);
  return val;
}

export async function run(argv: string[]): Promise<void> {
  const [subcommand, ...rest] = argv;
  const opts = parseKeyValues(rest);

  switch (subcommand) {
    case 'create': {
      const calendarId = opts['calendar'] ?? 'primary';
      const summary    = require(opts, 'title');
      const start      = require(opts, 'start');
      const end        = require(opts, 'end');
      const tz         = opts['tz'] ?? 'Pacific/Auckland';

      const body: Record<string, unknown> = {
        summary,
        start: start.includes('T')
          ? { dateTime: start, timeZone: tz }
          : { date: start },
        end: end.includes('T')
          ? { dateTime: end, timeZone: tz }
          : { date: end },
      };
      if (opts['description']) body['description'] = opts['description'];
      if (opts['location'])    body['location']    = opts['location'];

      const created = await createEvent(calendarId, body);
      console.log(JSON.stringify(created, null, 2));
      break;
    }

    case 'update': {
      const calendarId = opts['calendar'] ?? 'primary';
      const eventId    = require(opts, 'id');
      const body: Record<string, unknown> = {};

      if (opts['title'])       body['summary']     = opts['title'];
      if (opts['description']) body['description'] = opts['description'];
      if (opts['location'])    body['location']    = opts['location'];
      if (opts['start']) {
        const tz = opts['tz'] ?? 'Pacific/Auckland';
        body['start'] = opts['start'].includes('T')
          ? { dateTime: opts['start'], timeZone: tz }
          : { date: opts['start'] };
      }
      if (opts['end']) {
        const tz = opts['tz'] ?? 'Pacific/Auckland';
        body['end'] = opts['end'].includes('T')
          ? { dateTime: opts['end'], timeZone: tz }
          : { date: opts['end'] };
      }

      const updated = await updateEvent(calendarId, eventId, body);
      console.log(JSON.stringify(updated, null, 2));
      break;
    }

    case 'delete': {
      const calendarId = opts['calendar'] ?? 'primary';
      const eventId    = require(opts, 'id');
      await deleteEvent(calendarId, eventId);
      console.error(`Deleted event ${eventId}`);
      break;
    }

    case 'respond': {
      const calendarId = opts['calendar'] ?? 'primary';
      const eventId    = require(opts, 'id');
      const status     = require(opts, 'status');
      if (status !== 'accepted' && status !== 'declined' && status !== 'tentative') {
        throw new Error(`--status must be one of: accepted, declined, tentative`);
      }
      await respondToEvent(calendarId, eventId, status);
      console.error(`Responded "${status}" to event ${eventId}`);
      break;
    }

    default:
      throw new Error(
        `Unknown event subcommand: ${subcommand}. Use: create, update, delete, respond`
      );
  }
}
