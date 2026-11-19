import { describe, expect, it } from 'vitest';
import { OwnershipTimeline, sampleWeighted } from '../src/core/ownership';

describe('OwnershipTimeline', () => {
  const tl = new OwnershipTimeline();
  tl.build([
    { key: 'a', t: 1, owner: 0 },
    { key: 'b', t: 2, owner: 0 },
    { key: 'a', t: 3, owner: 1 },
    { key: 'b', t: 4, owner: -1 },
  ], 2);
  it('seeks forward and backward exactly', () => {
    tl.seek(0);
    expect([...tl.owner]).toEqual([-1, -1]);
    tl.seek(3.5);
    expect([...tl.owner]).toEqual([1, 0]);
    expect(tl.counts).toEqual([1, 1]);
    tl.seek(1.5);
    expect([...tl.owner]).toEqual([0, -1]);
    tl.seek(10);
    expect([...tl.owner]).toEqual([1, -1]);
    expect(tl.counts).toEqual([0, 1]);
  });
  it('finds neighbouring event times', () => {
    expect(tl.nextEventTime(2)).toBe(3);
    expect(tl.prevEventTime(2)).toBe(1);
  });
  it('samples weighted areas in one sweep', () => {
    const s = sampleWeighted(tl, 0, 4, 5, () => 2);
    expect(Array.from(s[2])).toEqual([4, 0]); // t=2: a,b both owner 0
    expect(Array.from(s[4])).toEqual([0, 2]); // t=4: a owner 1, b released
  });
});
