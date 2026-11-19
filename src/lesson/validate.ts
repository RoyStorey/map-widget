/**
 * Lesson validator: checks a lesson spec and explains every problem with a
 * JSON path, so an author (or AI agent) can fix it in one pass. Pure – runs in
 * the browser and in Node (see scripts/check-lesson.ts).
 */
import { findPlace, suggestPlaces } from '../core/places';
import { parseTime } from '../core/time';
import type { LonLat } from '../core/geo';
import { DETAIL_RES, type LessonSpec, type Place, type When } from './spec';

export interface Issue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
  /** Resolved coordinates for every place that was checked, keyed by JSON path. */
  places: Map<string, LonLat>;
  stats: { sides: number; territories: number; moves: number; events: number; steps: number; questions: number };
}

const KINDS_MOVE = ['army', 'armor', 'fleet', 'ship', 'aircraft', 'caravan', 'explorer', 'other'];
const KINDS_EVENT = ['battle', 'siege', 'founding', 'treaty', 'disaster', 'discovery', 'note'];
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function validateLesson(input: unknown): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const places = new Map<string, LonLat>();
  const err = (path: string, message: string) => errors.push({ path, message });
  const warn = (path: string, message: string) => warnings.push({ path, message });
  const stats = { sides: 0, territories: 0, moves: 0, events: 0, steps: 0, questions: 0 };
  const result = (): ValidationResult => ({ ok: errors.length === 0, errors, warnings, places, stats });

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    err('$', 'A lesson must be a JSON object.');
    return result();
  }
  const L = input as LessonSpec & Record<string, unknown>;

  // ---- header
  if (L.format !== 'atlas-lesson@1') err('format', `Must be "atlas-lesson@1" (got ${JSON.stringify(L.format)}).`);
  if (!str(L.title)) err('title', 'A title is required.');
  const start = time(L.start, 'start');
  const end = time(L.end, 'end');
  if (start !== null && end !== null && end <= start) err('end', `"end" (${L.end}) must be after "start" (${L.start}).`);
  const inRange = (t: number | null, path: string) => {
    if (t === null || start === null || end === null) return;
    const pad = (end - start) * 0.001;
    if (t < start - pad || t > end + pad) warn(path, `Time ${t.toFixed(3)} is outside the lesson's start–end range; it won't be visible on the timeline.`);
  };
  if (L.detail !== undefined && !(L.detail in DETAIL_RES)) err('detail', `Must be one of ${Object.keys(DETAIL_RES).join(', ')}.`);
  if (L.playSeconds !== undefined && !(typeof L.playSeconds === 'number' && L.playSeconds >= 5 && L.playSeconds <= 3600)) err('playSeconds', 'Must be a number of seconds between 5 and 3600.');
  if (L.view) view(L.view, 'view');
  if (L.trails !== undefined && L.trails !== 'full' && L.trails !== 'fade') err('trails', 'Must be "full" or "fade".');

  // ---- sides
  const sideIds = new Set<string>();
  if (!Array.isArray(L.sides) || !L.sides.length) err('sides', 'At least one side is required, e.g. [{ "id": "rome", "name": "Rome" }].');
  else
    L.sides.forEach((s, i) => {
      const p = `sides[${i}]`;
      if (!str(s?.id)) err(`${p}.id`, 'Each side needs a short id (letters, digits, - or _).');
      else if (!/^[A-Za-z0-9_-]+$/.test(s.id)) err(`${p}.id`, `"${s.id}" – ids may only contain letters, digits, "-" and "_".`);
      else if (sideIds.has(s.id)) err(`${p}.id`, `Duplicate side id "${s.id}".`);
      else sideIds.add(s.id);
      if (!str(s?.name)) err(`${p}.name`, 'Each side needs a display name.');
      if (s?.color !== undefined && !HEX.test(s.color)) err(`${p}.color`, `"${s.color}" is not a hex colour like "#c92a2a".`);
      if (s?.capital !== undefined) place(s.capital, `${p}.capital`);
      stats.sides++;
    });
  const side = (v: unknown, path: string, allowNull = true) => {
    if (v === null && allowNull) return;
    if (typeof v !== 'string' || !sideIds.has(v)) err(path, `Unknown side ${JSON.stringify(v)}. Known sides: ${[...sideIds].join(', ') || '(none)'}${allowNull ? ' (or null)' : ''}.`);
  };

  // ---- territories
  arr(L.territories, 'territories').forEach((tr, i) => {
    const p = `territories[${i}]`;
    stats.territories++;
    if (tr.area !== undefined) {
      if (!Array.isArray(tr.area) || tr.area.length < 3) err(`${p}.area`, 'An area needs at least 3 places (a polygon outline).');
      else tr.area.forEach((pl, k) => place(pl, `${p}.area[${k}]`));
    } else if (tr.around !== undefined) {
      place(tr.around, `${p}.around`);
      if (!(typeof tr.radiusKm === 'number' && tr.radiusKm > 0 && tr.radiusKm < 5000)) err(`${p}.radiusKm`, 'With "around", give "radiusKm" between 0 and 5000.');
    } else err(p, 'A territory needs either "area" (polygon) or "around" + "radiusKm" (circle).');
    if (tr.owner !== undefined) side(tr.owner, `${p}.owner`);
    let last = -Infinity;
    arr(tr.changes, `${p}.changes`).forEach((c, k) => {
      const q = `${p}.changes[${k}]`;
      side(c.side, `${q}.side`);
      const a = time(c.start, `${q}.start`);
      const b = c.end !== undefined ? time(c.end, `${q}.end`) : a;
      if (a !== null && b !== null && b < a) err(`${q}.end`, '"end" must not be before "start".');
      if (a !== null && a < last) warn(`${q}.start`, 'Changes should be listed in time order.');
      if (a !== null) last = a;
      inRange(a, `${q}.start`);
      if (c.from !== undefined) place(c.from, `${q}.from`);
    });
    if (tr.owner === undefined && !tr.changes?.length) warn(p, 'This territory has no owner and no changes, so it will never be coloured.');
  });

  // ---- countries
  arr(L.countries, 'countries').forEach((c, i) => {
    const p = `countries[${i}]`;
    if (!Array.isArray(c.countries) || !c.countries.length || !c.countries.every(str)) err(`${p}.countries`, 'Give a list of modern country names, e.g. ["France", "Spain"].');
    side(c.side, `${p}.side`);
    inRange(time(c.at, `${p}.at`), `${p}.at`);
  });

  // ---- moves
  arr(L.moves, 'moves').forEach((m, i) => {
    const p = `moves[${i}]`;
    stats.moves++;
    if (!str(m.name)) err(`${p}.name`, 'Each move needs a name, e.g. "William\'s army".');
    side(m.side, `${p}.side`, false);
    if (m.kind !== undefined && !KINDS_MOVE.includes(m.kind)) err(`${p}.kind`, `Must be one of ${KINDS_MOVE.join(', ')}.`);
    if (!Array.isArray(m.path) || m.path.length < 2) err(`${p}.path`, 'A move needs at least 2 waypoints: [{ "at": …, "time": … }, …].');
    else {
      let last = -Infinity;
      m.path.forEach((w, k) => {
        const q = `${p}.path[${k}]`;
        place(w?.at, `${q}.at`);
        const t = time(w?.time, `${q}.time`);
        if (t !== null && t < last) err(`${q}.time`, 'Waypoint times must not go backwards.');
        if (t !== null) last = t;
        inRange(t, `${q}.time`);
      });
    }
  });

  // ---- routes
  arr(L.routes, 'routes').forEach((r, i) => {
    const p = `routes[${i}]`;
    if (!str(r.name)) err(`${p}.name`, 'Each route needs a name.');
    if (!Array.isArray(r.stops) || r.stops.length < 2) err(`${p}.stops`, 'A route needs at least 2 stops.');
    else r.stops.forEach((s, k) => place(s, `${p}.stops[${k}]`));
    if (r.color !== undefined && !HEX.test(r.color)) err(`${p}.color`, `"${r.color}" is not a hex colour.`);
    if (r.start !== undefined) time(r.start, `${p}.start`);
    if (r.end !== undefined) time(r.end, `${p}.end`);
  });

  // ---- events
  arr(L.events, 'events').forEach((e, i) => {
    const p = `events[${i}]`;
    stats.events++;
    if (!str(e.title)) err(`${p}.title`, 'Each event needs a title.');
    const t = time(e.time, `${p}.time`);
    inRange(t, `${p}.time`);
    place(e.at, `${p}.at`);
    if (e.kind !== undefined && !KINDS_EVENT.includes(e.kind)) err(`${p}.kind`, `Must be one of ${KINDS_EVENT.join(', ')}.`);
    if (e.side !== undefined) side(e.side, `${p}.side`, false);
    if (e.until !== undefined) {
      const u = time(e.until, `${p}.until`);
      if (u !== null && t !== null && u < t) err(`${p}.until`, '"until" must not be before "time".');
    }
  });

  // ---- eras, labels, arrows
  arr(L.eras, 'eras').forEach((e, i) => {
    const p = `eras[${i}]`;
    if (!str(e.name)) err(`${p}.name`, 'Each era needs a name.');
    const a = time(e.start, `${p}.start`), b = time(e.end, `${p}.end`);
    if (a !== null && b !== null && b <= a) err(`${p}.end`, '"end" must be after "start".');
  });
  arr(L.labels, 'labels').forEach((l, i) => {
    const p = `labels[${i}]`;
    if (!str(l.text)) err(`${p}.text`, 'A label needs text.');
    place(l.at, `${p}.at`);
    if (l.size !== undefined && !['small', 'medium', 'large'].includes(l.size)) err(`${p}.size`, 'Must be "small", "medium" or "large".');
  });
  arr(L.arrows, 'arrows').forEach((a, i) => {
    const p = `arrows[${i}]`;
    place(a.from, `${p}.from`);
    place(a.to, `${p}.to`);
  });

  // ---- story
  let lastStep = -Infinity;
  arr(L.story, 'story').forEach((s, i) => {
    const p = `story[${i}]`;
    stats.steps++;
    if (!str(s.title)) err(`${p}.title`, 'Each story step needs a title.');
    if (!str(s.text)) err(`${p}.text`, 'Each story step needs some text for students.');
    else if (s.text.length > 900) warn(`${p}.text`, 'Long text – students read best with 1–3 short paragraphs per step.');
    const t = time(s.time, `${p}.time`);
    inRange(t, `${p}.time`);
    if (t !== null && t < lastStep) warn(`${p}.time`, 'Story steps should be in time order (they will be sorted).');
    if (t !== null) lastStep = t;
    if (s.until !== undefined) time(s.until, `${p}.until`);
    if (s.view) view(s.view, `${p}.view`);
    if (s.question) {
      stats.questions++;
      const q = s.question;
      const qp = `${p}.question`;
      if (!str(q.prompt)) err(`${qp}.prompt`, 'A question needs a prompt.');
      if (!Array.isArray(q.choices) || q.choices.length < 2 || !q.choices.every(str)) err(`${qp}.choices`, 'Give at least 2 answer choices (strings).');
      else if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length)) err(`${qp}.answer`, `"answer" must be the 0-based index of the correct choice (0–${q.choices.length - 1}).`);
    }
  });
  if (!L.story?.length) warn('story', 'No story steps: students will get a free-play map without guided chapters.');

  return result();

  // ---------------------------------------------------------------- helpers
  function str(v: unknown): v is string {
    return typeof v === 'string' && v.trim().length > 0;
  }
  function arr<T>(v: T[] | undefined, path: string): T[] {
    if (v === undefined) return [];
    if (!Array.isArray(v)) {
      err(path, 'Must be a list.');
      return [];
    }
    return v;
  }
  function time(v: When | undefined, path: string): number | null {
    if (v === undefined || v === null || v === '') {
      err(path, 'A time is required, e.g. "1066-10-14", "1066" or "500 BCE".');
      return null;
    }
    const t = parseTime(v as any);
    if (t === null) err(path, `Couldn't read ${JSON.stringify(v)} as a time. Use a year (1066, -499), "500 BCE", "Oct 1066", "1066-10-14" or "1944-06-06T06:30".`);
    return t;
  }
  function place(v: Place | undefined, path: string): LonLat | null {
    if (typeof v === 'string') {
      const p = findPlace(v);
      if (!p) {
        const s = suggestPlaces(v);
        err(path, `Unknown place "${v}". ${s.length ? `Did you mean ${s.map((x) => `"${x}"`).join(', ')}? ` : ''}Use a known name or [longitude, latitude].`);
        return null;
      }
      places.set(path, p);
      return p;
    }
    if (Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number' && Number.isFinite(x))) {
      const [lon, lat] = v;
      if (Math.abs(lat) > 90 && Math.abs(lon) <= 90) {
        err(path, `[${lon}, ${lat}] looks like [latitude, longitude] – places are [longitude, latitude] (x first). Try [${lat}, ${lon}].`);
        return null;
      }
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        err(path, `[${lon}, ${lat}] is out of range – longitude must be −180…180 and latitude −90…90.`);
        return null;
      }
      places.set(path, [lon, lat]);
      return [lon, lat];
    }
    err(path, 'A place must be a known name (e.g. "Rome") or [longitude, latitude].');
    return null;
  }
  function view(v: any, path: string) {
    if (!v || typeof v !== 'object') return err(path, 'A view is { "center": place, "zoom": number }.');
    place(v.center, `${path}.center`);
    if (!(typeof v.zoom === 'number' && v.zoom >= 0 && v.zoom <= 18)) err(`${path}.zoom`, 'Zoom must be a number from 0 (whole world) to 18 (street). Countries ≈ 5, cities ≈ 10, battlefields ≈ 12–14.');
  }
}

/** Human-readable report. */
export function formatIssues(r: ValidationResult): string {
  const lines: string[] = [];
  for (const e of r.errors) lines.push(`✗ ${e.path}: ${e.message}`);
  for (const w of r.warnings) lines.push(`⚠ ${w.path}: ${w.message}`);
  if (r.ok) lines.unshift(`✓ Valid lesson – ${r.stats.sides} sides, ${r.stats.territories} territories, ${r.stats.moves} moves, ${r.stats.events} events, ${r.stats.steps} story steps (${r.stats.questions} questions).`);
  return lines.join('\n');
}
