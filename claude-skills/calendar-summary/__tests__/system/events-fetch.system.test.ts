/**
 * System test — hits the real Google Calendar API.
 * Skipped unless CAL_SYSTEM_TEST=1 is set.
 */

import { describe, it, expect } from 'vitest';
import { fetchEvents } from '../../src/commands/events-fetch.js';

const ENABLED = process.env['CAL_SYSTEM_TEST'] === '1';

describe.skipIf(!ENABLED)('events-fetch (system)', () => {
  it('fetches events for a 7-day window with correct shape', async () => {
    const output = await fetchEvents({ windowDays: 7, yesterday: false, account: 'normal' });

    expect(output).toMatchObject({
      window_days: 7,
      today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      generated_at: expect.any(String),
      events: expect.any(Array),
    });

    for (const ev of output.events) {
      expect(ev.id).toBeTruthy();
      expect(ev.calendarId).toBeTruthy();
      expect(ev.calendarName).toBeTruthy();
      // Negative days_until is valid for multi-day events already in progress
      expect(typeof ev.days_until).toBe('number');
      expect(['IMMINENT', 'VERY_SOON', 'THIS_WEEK', 'NEXT_WEEK', 'THIS_MONTH', 'LATER'])
        .toContain(ev.nearness);
    }
  }, 30_000);
});
