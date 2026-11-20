import { describe, expect, it } from 'vitest';
import { checkMapRoutes, coastlineRouter } from '../src/spec/routes';
import { legMode } from '../src/spec/spec';
import { pathKm } from '../src/core/router';
import { findPlace } from '../src/core/places';

const base = { format: 'atlas-map@1' as const, title: 'T', start: 0, end: 10, sides: [{ id: 'a', name: 'A' }] };
const move = (path: any[], extra: object = {}) => ({ ...base, moves: [{ name: 'M', side: 'a', path, ...extra }] });

describe('legMode', () => {
  it('defaults armies to land, fleets and aircraft to straight, bySea to sea; a waypoint overrides', () => {
    const p = [{ at: 'Rome', time: 1 }, { at: 'Carthage', time: 2 }];
    expect(legMode({ path: p }, 1)).toBe('land');
    expect(legMode({ kind: 'fleet', path: p }, 1)).toBe('straight');
    expect(legMode({ kind: 'aircraft', path: p }, 1)).toBe('straight');
    expect(legMode({ bySea: true, path: p }, 1)).toBe('sea');
    expect(legMode({ path: [p[0], { ...p[1], by: 'sea' as const }] }, 1)).toBe('sea');
  });
});

describe('checkMapRoutes', { timeout: 30_000 }, () => {
  it('accepts an army marching overland', async () => {
    const r = await checkMapRoutes(move([{ at: 'Jerusalem', time: 1 }, { at: 'Pelusium', time: 2 }, { at: 'Alexandria', time: 3 }]));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
  it('rejects an army walking to an island, and accepts it by sea', async () => {
    const bad = await checkMapRoutes(move([{ at: 'Syracuse', time: 1 }, { at: 'Malta', time: 2 }]));
    expect(bad.errors.map((e) => e.path)).toEqual(['moves[0].path[1]']);
    const ok = await checkMapRoutes(move([{ at: 'Syracuse', time: 1 }, { at: 'Malta', time: 2, by: 'sea' }]));
    expect(ok.errors).toEqual([]);
  });
  it('warns when the overland detour means they must have sailed', async () => {
    const r = await checkMapRoutes(move([{ at: 'Rome', time: 1 }, { at: 'Carthage', time: 2 }]));
    expect(r.warnings[0].message).toMatch(/"by": "sea"/);
  });
  it('warns when ships sail over land', async () => {
    const r = await checkMapRoutes(move([{ at: 'Venice', time: 1 }, { at: 'Genoa', time: 2 }], { kind: 'fleet' }));
    expect(r.warnings[0].message).toMatch(/bySea/);
  });
  it('lets armies cross the Bosporus and ships use the Strait of Magellan', async () => {
    expect((await checkMapRoutes(move([{ at: 'Constantinople', time: 1 }, { at: 'Chalcedon', time: 2 }]))).errors).toEqual([]);
    const router = await coastlineRouter();
    const strait = router.route('sea', [-68.35, -52.33], [-74.6, -52.7])!;
    expect(pathKm(strait)).toBeLessThan(700); // through the strait, not round Tierra del Fuego
    const overland = router.route('land', findPlace('Jerusalem')!, findPlace('Pelusium')!)!;
    expect(overland.every(([lon, lat]) => router.passable('land', lon, lat))).toBe(true);
  });
});
