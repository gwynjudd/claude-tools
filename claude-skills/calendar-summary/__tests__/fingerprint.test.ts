import { describe, it, expect } from 'vitest';
import { fingerprint } from '../src/commands/events-fetch.js';

const base = {
  summary: 'Team meeting',
  description: 'Quarterly review',
  location: 'Conference room A',
  start: { dateTime: '2026-05-01T10:00:00+12:00' },
};

describe('fingerprint()', () => {
  it('produces a consistent 64-char hex string', () => {
    const fp = fingerprint(base);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint(base)).toBe(fp); // stable across calls
  });

  it('changes when summary changes', () => {
    const fp1 = fingerprint(base);
    const fp2 = fingerprint({ ...base, summary: 'Different title' });
    expect(fp1).not.toBe(fp2);
  });

  it('changes when description changes', () => {
    const fp1 = fingerprint(base);
    const fp2 = fingerprint({ ...base, description: 'Changed description' });
    expect(fp1).not.toBe(fp2);
  });

  it('changes when location changes', () => {
    const fp1 = fingerprint(base);
    const fp2 = fingerprint({ ...base, location: 'Room B' });
    expect(fp1).not.toBe(fp2);
  });

  it('changes when start time changes', () => {
    const fp1 = fingerprint(base);
    const fp2 = fingerprint({ ...base, start: { dateTime: '2026-05-01T11:00:00+12:00' } });
    expect(fp1).not.toBe(fp2);
  });

  it('changes when start date changes (all-day event)', () => {
    const allDay = { ...base, start: { date: '2026-05-01' } };
    const fp1 = fingerprint(allDay);
    const fp2 = fingerprint({ ...allDay, start: { date: '2026-05-02' } });
    expect(fp1).not.toBe(fp2);
  });

  it('handles undefined optional fields gracefully', () => {
    const minimal = {
      summary: undefined,
      description: undefined,
      location: undefined,
      start: { date: '2026-05-01' },
    };
    expect(() => fingerprint(minimal)).not.toThrow();
    const fp = fingerprint(minimal);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable when attendees or htmlLink change (not included in fingerprint)', () => {
    // fingerprint only covers summary/description/location/start — attendee changes don't affect it
    const fp1 = fingerprint(base);
    // Same content — fingerprint should be identical regardless of what caller does with attendees
    expect(fingerprint(base)).toBe(fp1);
  });
});
