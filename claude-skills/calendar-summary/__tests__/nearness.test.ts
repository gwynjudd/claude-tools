import { describe, it, expect } from 'vitest';
import { nearness } from '../src/commands/events-fetch.js';

describe('nearness()', () => {
  it('returns IMMINENT for 0 days', () => {
    expect(nearness(0)).toBe('IMMINENT');
  });

  it('returns IMMINENT for negative days (multi-day event in progress)', () => {
    expect(nearness(-1)).toBe('IMMINENT');
    expect(nearness(-5)).toBe('IMMINENT');
  });

  it('returns VERY_SOON for 1–3 days', () => {
    expect(nearness(1)).toBe('VERY_SOON');
    expect(nearness(2)).toBe('VERY_SOON');
    expect(nearness(3)).toBe('VERY_SOON');
  });

  it('returns THIS_WEEK for 4–7 days', () => {
    expect(nearness(4)).toBe('THIS_WEEK');
    expect(nearness(7)).toBe('THIS_WEEK');
  });

  it('returns NEXT_WEEK for 8–14 days', () => {
    expect(nearness(8)).toBe('NEXT_WEEK');
    expect(nearness(14)).toBe('NEXT_WEEK');
  });

  it('returns THIS_MONTH for 15–28 days', () => {
    expect(nearness(15)).toBe('THIS_MONTH');
    expect(nearness(28)).toBe('THIS_MONTH');
  });

  it('returns LATER for 29+ days', () => {
    expect(nearness(29)).toBe('LATER');
    expect(nearness(60)).toBe('LATER');
    expect(nearness(365)).toBe('LATER');
  });
});
