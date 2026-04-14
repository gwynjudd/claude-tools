import { describe, it, expect } from 'vitest';
import { priorityColor } from '../src/commands/events-present.js';
import type { FetchEventsOutput, ScoredEvent } from '../src/types.js';

// Minimal fixture factory
function makeEvent(overrides: Partial<ScoredEvent> = {}): ScoredEvent {
  return {
    id: 'evt-1',
    summary: 'Test event',
    calendarId: 'primary',
    calendarName: 'Personal',
    start: { dateTime: '2026-05-01T10:00:00+12:00' },
    end:   { dateTime: '2026-05-01T11:00:00+12:00' },
    days_until: 5,
    nearness: 'THIS_WEEK',
    cached: true,
    prep_level: 'MEDIUM',
    notes: 'Confirm attendance',
    ...overrides,
  };
}

function makeOutput(events: ScoredEvent[], yesterday_events?: ScoredEvent[]): FetchEventsOutput {
  return {
    generated_at: '2026-04-26T00:00:00.000Z',
    window_days: 28,
    today: '2026-04-26',
    events,
    yesterday_events,
  };
}

describe('priorityColor()', () => {
  it('returns 🔴 for IMMINENT + HIGH', () => {
    expect(priorityColor('IMMINENT', 'HIGH')).toBe('🔴');
  });
  it('returns 🟡 for IMMINENT + LOW', () => {
    expect(priorityColor('IMMINENT', 'LOW')).toBe('🟡');
  });
  it('returns undefined for LATER + LOW', () => {
    expect(priorityColor('LATER', 'LOW')).toBeUndefined();
  });
});

describe('FetchEventsOutput structure', () => {
  it('accepts events with all required fields', () => {
    const output = makeOutput([makeEvent()]);
    expect(output.events).toHaveLength(1);
    expect(output.events[0].nearness).toBe('THIS_WEEK');
    expect(output.events[0].prep_level).toBe('MEDIUM');
    expect(output.events[0].cached).toBe(true);
  });

  it('accepts yesterday_events when --yesterday was used', () => {
    const yev = makeEvent({ id: 'y-1', summary: 'Yesterday meeting', days_until: -1, nearness: 'IMMINENT' });
    const output = makeOutput([makeEvent()], [yev]);
    expect(output.yesterday_events).toHaveLength(1);
    expect(output.yesterday_events![0].summary).toBe('Yesterday meeting');
  });

  it('handles events without prep_level (uncached)', () => {
    const uncached = makeEvent({ cached: false, prep_level: undefined, notes: undefined });
    const output = makeOutput([uncached]);
    expect(output.events[0].cached).toBe(false);
    expect(output.events[0].prep_level).toBeUndefined();
  });
});
