import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { validateMap } from '../src/spec/validate';
import { findPlace, suggestPlaces } from '../src/core/places';

const base = { format: 'atlas-map@1', title: 'T', start: 1000, end: 1100, sides: [{ id: 'a', name: 'A' }] };

describe('places', () => {
  it('resolves names, aliases and accents', () => {
    expect(findPlace('constantinople')).toEqual(findPlace('Istanbul'));
    expect(findPlace('Köln')).toEqual(findPlace('Cologne'));
    expect(findPlace('Atlantis')).toBeNull();
    expect(suggestPlaces('Hastngs')).toContain('Hastings');
  });
});

describe('validateMap', () => {
  it('accepts a minimal map (with a warning for no story)', () => {
    const r = validateMap(base);
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.path === 'story')).toBe(true);
  });
  it('reports swapped coordinates, unknown sides/places and backwards times with paths', () => {
    const r = validateMap({
      ...base,
      events: [{ title: 'X', time: 1050, at: [50, 120] }, { title: 'Y', time: 1050, at: 'Nowhereville' }],
      moves: [{ name: 'M', side: 'z', path: [{ at: 'Rome', time: 1060 }, { at: 'Paris', time: 1055 }] }],
      story: [{ title: 'S', text: 'x', time: 1001, question: { prompt: '?' } }],
    });
    const paths = r.errors.map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(['events[0].at', 'events[1].at', 'moves[0].side', 'moves[0].path[1].time']));
    expect(r.warnings.map((w) => w.path)).toContain('story[0].question');
    expect(r.errors.find((e) => e.path === 'events[0].at')!.message).toMatch(/latitude, longitude/);
  });
  it('rejects end before start and unknown detail', () => {
    const r = validateMap({ ...base, end: 900, detail: 'galaxy' });
    expect(r.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['end', 'detail']));
  });
  it('still accepts the older "atlas-lesson@1" format name', () => {
    expect(validateMap({ ...base, format: 'atlas-lesson@1' }).ok).toBe(true);
  });
  for (const f of readdirSync('public/maps').filter((x) => x.endsWith('.json') && x !== 'index.json')) {
    it(`shipped map ${f} is valid`, () => {
      const r = validateMap(JSON.parse(readFileSync(`public/maps/${f}`, 'utf8')));
      expect(r.errors).toEqual([]);
    });
  }
  it('map index lists existing files', () => {
    const idx = JSON.parse(readFileSync('public/maps/index.json', 'utf8'));
    const files = new Set(readdirSync('public/maps'));
    for (const l of idx.maps) expect(files.has(l.file)).toBe(true);
  });
});
