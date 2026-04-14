import { describe, it, expect } from 'vitest';
import { priorityColor } from '../src/commands/events-present.js';
import type { Nearness, PrepLevel } from '../src/types.js';

// Priority matrix from the plan:
//              HIGH prep  MEDIUM prep  LOW prep
// IMMINENT       🔴          🔴           🟡
// VERY_SOON      🔴          🔴           🟡
// THIS_WEEK      🔴          🟡           🟢
// NEXT_WEEK      🟡          🟡           🟢
// THIS_MONTH     🟡          🟢           🟢
// LATER          🟢          🟢           —  (undefined)

type Cell = { nearness: Nearness; prep: PrepLevel; expected: '🔴' | '🟡' | '🟢' | undefined };

const matrix: Cell[] = [
  // IMMINENT
  { nearness: 'IMMINENT',   prep: 'HIGH',   expected: '🔴' },
  { nearness: 'IMMINENT',   prep: 'MEDIUM', expected: '🔴' },
  { nearness: 'IMMINENT',   prep: 'LOW',    expected: '🟡' },
  // VERY_SOON
  { nearness: 'VERY_SOON',  prep: 'HIGH',   expected: '🔴' },
  { nearness: 'VERY_SOON',  prep: 'MEDIUM', expected: '🔴' },
  { nearness: 'VERY_SOON',  prep: 'LOW',    expected: '🟡' },
  // THIS_WEEK
  { nearness: 'THIS_WEEK',  prep: 'HIGH',   expected: '🔴' },
  { nearness: 'THIS_WEEK',  prep: 'MEDIUM', expected: '🟡' },
  { nearness: 'THIS_WEEK',  prep: 'LOW',    expected: '🟢' },
  // NEXT_WEEK
  { nearness: 'NEXT_WEEK',  prep: 'HIGH',   expected: '🟡' },
  { nearness: 'NEXT_WEEK',  prep: 'MEDIUM', expected: '🟡' },
  { nearness: 'NEXT_WEEK',  prep: 'LOW',    expected: '🟢' },
  // THIS_MONTH
  { nearness: 'THIS_MONTH', prep: 'HIGH',   expected: '🟡' },
  { nearness: 'THIS_MONTH', prep: 'MEDIUM', expected: '🟢' },
  { nearness: 'THIS_MONTH', prep: 'LOW',    expected: '🟢' },
  // LATER
  { nearness: 'LATER',      prep: 'HIGH',   expected: '🟢' },
  { nearness: 'LATER',      prep: 'MEDIUM', expected: '🟢' },
  { nearness: 'LATER',      prep: 'LOW',    expected: undefined },
];

describe('priorityColor()', () => {
  for (const { nearness, prep, expected } of matrix) {
    it(`${nearness} + ${prep} → ${expected ?? '(omit)'}`, () => {
      expect(priorityColor(nearness, prep)).toBe(expected);
    });
  }
});
