import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { validateLesson } from '../src/lesson/validate';
import { findPlace, suggestPlaces } from '../src/core/places';

const base = { format: 'atlas-lesson@1', title: 'T', start: 1000, end: 1100, sides: [{ id: 'a', name: 'A' }] };

describe('places', () => {
  it('resolves names, aliases and accents', () => {
    expect(findPlace('constantinople')).toEqual(findPlace('Istanbul'));
    expect(findPlace('Köln')).toEqual(findPlace('Cologne'));
    expect(findPlace('Atlantis')).toBeNull();
    expect(suggestPlaces('Hastngs')).toContain('Hastings');
  });
});

describe('validateLesson', () => {
  it('accepts a minimal lesson (with a warning for no story)', () => {
    const r = validateLesson(base);
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.path === 'story')).toBe(true);
  });
  it('reports swapped coordinates, unknown sides/places and bad quiz answers with paths', () => {
    const r = validateLesson({
      ...base,
      events: [{ title: 'X', time: 1050, at: [50, 120] }, { title: 'Y', time: 1050, at: 'Nowhereville' }],
      moves: [{ name: 'M', side: 'z', path: [{ at: 'Rome', time: 1060 }, { at: 'Paris', time: 1055 }] }],
      story: [{ title: 'S', text: 'x', time: 1001, question: { prompt: '?', choices: ['a', 'b'], answer: 5 } }],
    });
    const paths = r.errors.map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(['events[0].at', 'events[1].at', 'moves[0].side', 'moves[0].path[1].time', 'story[0].question.answer']));
    expect(r.errors.find((e) => e.path === 'events[0].at')!.message).toMatch(/latitude, longitude/);
  });
  it('rejects end before start and unknown detail', () => {
    const r = validateLesson({ ...base, end: 900, detail: 'galaxy' });
    expect(r.errors.map((e) => e.path)).toEqual(expect.arrayContaining(['end', 'detail']));
  });
  for (const f of readdirSync('public/lessons').filter((x) => x.endsWith('.json') && x !== 'index.json')) {
    it(`shipped lesson ${f} is valid`, () => {
      const r = validateLesson(JSON.parse(readFileSync(`public/lessons/${f}`, 'utf8')));
      expect(r.errors).toEqual([]);
    });
  }
  it('lesson index lists existing files', () => {
    const idx = JSON.parse(readFileSync('public/lessons/index.json', 'utf8'));
    const files = new Set(readdirSync('public/lessons'));
    for (const l of idx.lessons) expect(files.has(l.file)).toBe(true);
  });
});
