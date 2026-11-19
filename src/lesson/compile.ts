/**
 * Lesson compiler: atlas-lesson@1 JSON → full Scenario (browser only – it
 * rasterises coastlines and may compute sea routes).
 */
import { buildKit, ev, march, T, type KitRegion } from '../demos/kit';
import { paletteColor } from '../core/color';
import { haversineKm, timestampPath, type LonLat } from '../core/geo';
import { seaRouteVia } from '../core/h3client';
import { findPlace } from '../core/places';
import type { CameraKey, Scenario, StoryStep, Unit } from '../core/scenario';
import { DETAIL_RADIUS_KM, DETAIL_RES, type LessonSpec, type LessonView, type Place } from './spec';
import { formatIssues, validateLesson } from './validate';

export class LessonError extends Error {
  constructor(message: string, readonly report: string) {
    super(message);
  }
}

const DETAIL_ZOOM: Record<string, number> = { world: 4, continent: 5, region: 7, city: 11, battlefield: 13 };

export async function compileLesson(spec: LessonSpec): Promise<Scenario> {
  const v = validateLesson(spec);
  if (!v.ok) throw new LessonError(`Lesson has ${v.errors.length} error(s)`, formatIssues(v));
  const P = (p: Place): LonLat => (typeof p === 'string' ? findPlace(p)! : [p[0], p[1]]);
  const detail = spec.detail ?? 'continent';
  const res = DETAIL_RES[detail];
  const start = T(spec.start), end = T(spec.end);
  const span = end - start;

  // ---- sides
  const factions = spec.sides.map((s, i) => ({ id: s.id, name: s.name, color: s.color ?? paletteColor(i), capital: s.capital ? P(s.capital) : undefined, description: s.description }));
  const capitalOf = new Map(factions.map((f) => [f.id, f.capital]));

  // ---- territories
  const regions: KitRegion[] = (spec.territories ?? []).map((tr) => {
    const ring: LonLat[] = tr.area ? tr.area.map(P) : circle(P(tr.around!), tr.radiusKm!);
    const phases = (tr.changes ?? []).map((c) => {
      const a = T(c.start);
      const b = c.end !== undefined ? T(c.end) : a + span * 0.01;
      const cap = c.side ? capitalOf.get(c.side) : undefined;
      const origin = c.from ? P(c.from) : tr.around ? P(tr.around) : cap ? nearest(ring, cap) : ring[0];
      return [c.side, a, Math.max(a, b), origin, 0.3] as [string | null, number, number, LonLat, number];
    });
    return { name: tr.name, ring, native: tr.owner ?? null, phases, landOnly: !tr.includeSea };
  });

  // ---- moves (optionally routed by sea, keeping each leg's timing)
  const units: Unit[] = [];
  for (const [i, m] of (spec.moves ?? []).entries()) {
    const legs: [LonLat, number][] = m.path.map((w) => [P(w.at), T(w.time)]);
    if (m.bySea) {
      const path: [number, number, number][] = [];
      for (let k = 0; k < legs.length - 1; k++) {
        let lane: LonLat[];
        try {
          lane = await seaRouteVia([legs[k][0], legs[k + 1][0]]);
        } catch {
          lane = [legs[k][0], legs[k + 1][0]];
        }
        const seg = timestampPath(lane, legs[k][1], legs[k + 1][1]);
        if (k) seg.shift();
        path.push(...seg);
      }
      units.push({ id: `m${i}`, name: m.name, faction: m.side, kind: m.kind ?? 'fleet', strength: m.strength, path, width: 4 });
    } else units.push(march(`m${i}`, m.name, m.side, legs, m.kind ?? 'army', m.strength));
  }

  // ---- routes
  const routes = [];
  for (const [i, r] of (spec.routes ?? []).entries()) {
    const stops = r.stops.map(P);
    let waypoints = stops;
    if (r.bySea !== false) {
      try {
        waypoints = await seaRouteVia(stops);
      } catch {
        /* fall back to straight legs */
      }
    }
    routes.push({ id: `r${i}`, name: r.name, color: r.color ?? '#4dabf7', waypoints, vessels: r.ships ?? 30, speedKnots: 14, volume: 4, bidirectional: !!r.twoWay, start: r.start !== undefined ? T(r.start) : undefined, end: r.end !== undefined ? T(r.end) : undefined, description: r.description });
  }

  // ---- events & story
  const sideIds = new Set(factions.map((f) => f.id));
  const events = (spec.events ?? []).map((e) =>
    ev(e.time, P(e.at), e.title, e.kind ?? 'note', e.text ?? '', { faction: e.side && sideIds.has(e.side) ? e.side : undefined, end: e.until !== undefined ? T(e.until) : undefined, zoom: e.zoom ?? DETAIL_ZOOM[detail] }),
  );
  const steps = [...(spec.story ?? [])].sort((a, b) => T(a.time) - T(b.time));
  const allPts: LonLat[] = [...regions.flatMap((r) => r.ring), ...units.flatMap((u) => u.path.map((p) => [p[0], p[1]] as LonLat)), ...events.map((e) => e.position), ...routes.flatMap((r) => r.waypoints)];
  const overview: LessonView & { center: LonLat } = spec.view ? { ...spec.view, center: P(spec.view.center) } : fitView(allPts.length ? allPts : [[0, 20]], DETAIL_ZOOM[detail] - 1);

  const story: StoryStep[] = steps.map((s, i) => {
    const t = T(s.time);
    const until = s.until !== undefined ? T(s.until) : i + 1 < steps.length ? T(steps[i + 1].time) : end;
    let view: StoryStep['view'];
    if (s.view) view = { center: P(s.view.center), zoom: s.view.zoom, pitch: s.view.pitch ?? 0, bearing: s.view.bearing ?? 0 };
    else {
      // frame what happens during this step: its events, else where the moving units are
      const pts = events.filter((e) => e.t >= t - span * 0.002 && e.t <= until).map((e) => e.position);
      if (!pts.length) for (const u of units) for (const p of u.path) if (p[2] >= t && p[2] <= until) pts.push([p[0], p[1]]);
      view = pts.length ? fitView(pts, DETAIL_ZOOM[detail]) : undefined;
    }
    const q = s.question;
    const question = q
      ? q.locate !== undefined
        ? { prompt: q.prompt, choices: [], answer: 0, explain: q.explain, locate: P(q.locate), radiusKm: q.radiusKm ?? DETAIL_RADIUS_KM[detail] }
        : { prompt: q.prompt, choices: q.choices!, answer: q.answer!, explain: q.explain }
      : undefined;
    return { id: `step${i}`, title: s.title, text: s.text, t, end: until, view, question, image: s.image, imageCaption: s.imageCaption };
  });

  // ---- camera: follow the story, otherwise auto
  let camera: CameraKey[] | 'auto' = 'auto';
  if (story.length) {
    camera = [{ t: start, center: overview.center, zoom: overview.zoom, bearing: overview.bearing ?? 0, pitch: overview.pitch ?? 0 }];
    let last = camera[0];
    for (const s of story) {
      const v2 = s.view ?? last;
      const k = { t: s.t, center: v2.center, zoom: v2.zoom, bearing: v2.bearing ?? 0, pitch: v2.pitch ?? 0 };
      // hold the previous view until the step starts, then move
      if (s.t > start) camera.push({ ...last, t: Math.max(start, s.t - span * 0.004) });
      camera.push(k);
      last = k;
    }
    camera.sort((a, b) => a.t - b.t);
  }

  const allBox = bbox(allPts.length ? allPts : [overview.center]);
  const s = await buildKit({
    title: spec.title,
    description: spec.summary ?? '',
    start,
    end,
    res,
    basemap: spec.basemap ?? (res >= 7 ? 'ofm-liberty' : 'parchment'),
    view: { center: overview.center, zoom: overview.zoom, bearing: overview.bearing, pitch: overview.pitch },
    runSeconds: spec.playSeconds ?? 90,
    eventFraction: 0.04,
    factions,
    regions,
    countries: (spec.countries ?? []).map((c) => [c.countries, c.at, c.side] as [string[], string | number, string | null]),
    units,
    events,
    routes,
    eras: (spec.eras ?? []).map((e, i) => ({ name: e.name, start: T(e.start), end: T(e.end), color: e.color ?? ['#ffd43b', '#74c0fc', '#ff8787', '#8ce99a', '#e599f7', '#ffc078'][i % 6] })),
    annotations: (spec.labels ?? []).map((l) => ({ text: l.text, position: P(l.at), units: 'pixels' as const, size: l.size === 'large' ? 22 : l.size === 'small' ? 12 : 16, color: l.color, start: l.start !== undefined ? T(l.start) : undefined, end: l.end !== undefined ? T(l.end) : undefined })),
    flows: (spec.arrows ?? []).map((a) => ({ from: P(a.from), to: P(a.to), value: a.value ?? 10, label: a.label, color: a.color, start: a.start !== undefined ? T(a.start) : undefined, end: a.end !== undefined ? T(a.end) : undefined })),
    camera,
    hiResLand: res >= 7 ? [allBox[0] - 0.4, allBox[1] - 0.3, allBox[2] + 0.4, allBox[3] + 0.3] : undefined,
  });
  s.story = story;
  const trails = spec.trails ?? ((spec.moves ?? []).some((m) => m.bySea) ? 'full' : 'fade');
  s.meta.settings = { ...(s.meta.settings ?? {}), unitTrail: trails };
  s.meta.sources = spec.sources;
  s.meta.audience = spec.audience;
  return s;
}

// ---------------------------------------------------------------- geometry helpers

function circle(c: LonLat, km: number, n = 40): LonLat[] {
  const out: LonLat[] = [];
  const dLat = km / 111.2;
  const dLon = dLat / Math.max(0.05, Math.cos((c[1] * Math.PI) / 180));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([c[0] + Math.cos(a) * dLon, c[1] + Math.sin(a) * dLat]);
  }
  return out;
}

function nearest(ring: LonLat[], p: LonLat): LonLat {
  let best = ring[0], d = Infinity;
  for (const q of ring) {
    const k = haversineKm(p, q);
    if (k < d) {
      d = k;
      best = q;
    }
  }
  return best;
}

function bbox(pts: LonLat[]): [number, number, number, number] {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const p of pts) {
    a = Math.min(a, p[0]); c = Math.max(c, p[0]);
    b = Math.min(b, p[1]); d = Math.max(d, p[1]);
  }
  return [a, b, c, d];
}

/** Centre + zoom that frames the points (assumes a ~1000 px wide map). */
export function fitView(pts: LonLat[], singleZoom: number): { center: LonLat; zoom: number; bearing: number; pitch: number } {
  const [a, b, c, d] = bbox(pts);
  const center: LonLat = [(a + c) / 2, (b + d) / 2];
  const dx = (c - a) * Math.cos((center[1] * Math.PI) / 180), dy = d - b;
  const extent = Math.max(dx, dy * 1.4);
  const zoom = extent < 0.01 ? singleZoom : Math.max(1.5, Math.min(singleZoom + 1, Math.log2(300 / extent) - 0.2));
  return { center, zoom, bearing: 0, pitch: 0 };
}
