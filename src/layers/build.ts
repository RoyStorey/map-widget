import type { Layer } from '@deck.gl/core';
import {
  ArcLayer,
  GeoJsonLayer,
  IconLayer,
  PathLayer,
  PolygonLayer,
  ScatterplotLayer,
  SolidPolygonLayer,
} from '@deck.gl/layers';
import { TripsLayer } from '@deck.gl/geo-layers';
import { DataFilterExtension, PathStyleExtension } from '@deck.gl/extensions';
import type { LabelItem } from './labels';

import type { MapWidget } from '../widget/MapWidget';
import { hexToRgb, mix, type RGB } from '../core/color';
import { densifyGreatCircle, graticule, nightPolygon, positionAtTime, type LonLat } from '../core/geo';
import { decimalYearToDate } from '../core/time';
import type { Route, Unit } from '../core/scenario';
import { EVENT_ICON, UNIT_ICON, iconAtlas } from './icons';
import { buildDataLayers } from './data';
import { buildStressLayers } from './stress';

const TRANSPARENT: [number, number, number, number] = [0, 0, 0, 0];
const BIG = 1e7;
const filter2 = new DataFilterExtension({ filterSize: 2 });
const dashExt = new PathStyleExtension({ dash: true });

// ---------------------------------------------------------------- caches

const routeGeom = new WeakMap<Route, { path: LonLat[]; cum: Float64Array; length: number; key: string }>();
function routeGeometry(r: Route) {
  const key = r.waypoints.flat().join(',');
  let g = routeGeom.get(r);
  if (!g || g.key !== key) {
    const path = densifyGreatCircle(r.waypoints, 60);
    const cum = new Float64Array(path.length);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
      const dy = b[1] - a[1];
      cum[i] = cum[i - 1] + Math.hypot(dx, dy) * 111.195;
    }
    g = { path, cum, length: cum[cum.length - 1] || 1, key };
    routeGeom.set(r, g);
  }
  return g;
}

const unitGeom = new WeakMap<Unit['path'], { path: LonLat[]; times: number[]; origin: number }>();
function unitGeometry(u: Unit, origin: number) {
  let g = unitGeom.get(u.path);
  if (!g || g.origin !== origin) {
    // densify long legs along great circles, interpolating time
    const path: LonLat[] = [];
    const times: number[] = [];
    for (let i = 0; i < u.path.length; i++) {
      const p = u.path[i];
      if (i === 0) {
        path.push([p[0], p[1]]);
        times.push(p[2] - origin);
        continue;
      }
      const a = u.path[i - 1];
      const seg = densifyGreatCircle([[a[0], a[1]], [p[0], p[1]]], 80);
      for (let k = 1; k < seg.length; k++) {
        path.push(seg[k]);
        times.push(a[2] - origin + ((p[2] - a[2]) * k) / (seg.length - 1));
      }
    }
    // unwrap across antimeridian for continuous trails
    for (let i = 1; i < path.length; i++) {
      while (path[i][0] - path[i - 1][0] > 180) path[i][0] -= 360;
      while (path[i][0] - path[i - 1][0] < -180) path[i][0] += 360;
    }
    g = { path, times, origin };
    unitGeom.set(u.path, g);
  }
  return g;
}

let graticuleCache: LonLat[][] | null = null;
let nightCache: { key: number; ring: LonLat[] } | null = null;

/** Vessel buffers are reused between frames to avoid GC churn. */
let vesselBuf = { positions: new Float32Array(0), angles: new Float32Array(0), colors: new Uint8Array(0), cap: 0 };
let borderColorCache: { src: unknown; rev: number; colors: Uint8Array; starts: Uint32Array } | null = null;

// ---------------------------------------------------------------- main

export function buildLayers(w: MapWidget): { layers: Layer[]; labels: LabelItem[] } {
  const s = w.settings;
  const sc = w.scenario;
  const t = w.time;
  const origin = sc.meta.start;
  const rt = t - origin; // relative time for GPU precision
  const span = Math.max(1e-9, sc.meta.end - sc.meta.start);
  const dark = w.basemap.dark;
  const layers: Layer[] = [];
  const beforeId = w.labelBeforeId;
  const factionRgb = w.factionRgb;
  const globe = s.projection === 'globe';
  // Flat overlays: skip depth testing against the basemap mesh (avoids z-fighting on the globe);
  // back-face culling hides polygons on the far side of the globe.
  const flatParams: any = globe ? { depthCompare: 'always', depthWriteEnabled: false, cullMode: (window as any).__cull ?? 'back' } : { depthCompare: 'always', depthWriteEnabled: false };
  const fcol = (fid?: string, alpha = 255, fallback?: string): [number, number, number, number] => {
    const i = fid ? w.factionIndex.get(fid) : undefined;
    const c = i !== undefined ? factionRgb[i] : fallback ? hexToRgb(fallback) : ([200, 200, 200] as RGB);
    return [c[0], c[1], c[2], alpha];
  };
  const textCss = dark ? '#f2f2f2' : '#19191e';
  const haloCss = dark ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.85)';
  const labels: LabelItem[] = [];

  // ------------------------------------------------ terminator & graticule (bottom)
  if (s.terminator) {
    const date = decimalYearToDate(t);
    const key = Math.round(date.getTime() / 300000); // 5 min resolution
    if (!nightCache || nightCache.key !== key) nightCache = { key, ring: nightPolygon(date) };
    layers.push(
      new SolidPolygonLayer({
        id: 'terminator',
        data: [nightCache.ring],
        getPolygon: (d: LonLat[]) => d,
        getFillColor: [0, 0, 20, 110],
        beforeId,
        updateTriggers: { getPolygon: key },
      } as any),
    );
  }
  if (s.graticule) {
    graticuleCache ??= graticule(15);
    layers.push(
      new PathLayer({
        id: 'graticule',
        data: graticuleCache,
        getPath: (d: LonLat[]) => d,
        getColor: dark ? [255, 255, 255, 40] : [0, 0, 0, 40],
        getWidth: 1,
        widthUnits: 'pixels',
        beforeId,
      } as any),
    );
  }

  // ------------------------------------------------ regions
  if (s.showRegions && sc.regions.length) {
    layers.push(
      new PolygonLayer({
        id: 'regions',
        data: sc.regions,
        getPolygon: (r: any) => r.rings,
        getFillColor: (r: any) => fcol(r.faction, Math.round(s.territoryOpacity * 200), r.color),
        getLineColor: (r: any) => fcol(r.faction, 255, r.color),
        lineWidthUnits: 'pixels',
        getLineWidth: 1.5,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 60],
        extensions: [filter2],
        getFilterValue: (r: any) => [(r.start ?? -BIG) - origin, (r.end ?? BIG) - origin],
        filterRange: [[-BIG * 2, rt], [rt, BIG * 2]],
        updateTriggers: { getFillColor: [w.revision, s.territoryOpacity], getLineColor: w.revision, getFilterValue: w.revision },
        beforeId,
      } as any),
    );
  }

  // ------------------------------------------------ country control
  const world = w.world;
  if (world && s.showCountries && (sc.countries.length || w.tool?.id === 'country')) {
    const ct = w.countryTimeline;
    layers.push(
      new GeoJsonLayer({
        id: 'countries',
        data: world.countries as any,
        stroked: false,
        filled: true,
        pickable: true,
        autoHighlight: w.tool?.id === 'country',
        highlightColor: [255, 255, 255, 70],
        getFillColor: (f: any) => {
          const k = ct.keyIndex.get(f.id);
          const o = k === undefined ? -1 : ct.owner[k];
          if (o < 0) return w.tool?.id === 'country' ? [255, 255, 255, 1] : TRANSPARENT;
          const c = factionRgb[o];
          return [c[0], c[1], c[2], Math.round(s.territoryOpacity * 255)];
        },
        updateTriggers: { getFillColor: [ct.version, w.revision, s.territoryOpacity, w.tool?.id] },
        beforeId,
      } as any),
    );
  }

  // ------------------------------------------------ H3 territory
  const terr = w.territory;
  const tl = terr.timeline;
  if (s.showTerritory && tl.keys.length) {
    const glowDur = s.glowFraction * span;
    const lastChange = tl.prevEventTime(t + 1e-12);
    const glowActive = s.conquestGlow && lastChange !== null && t - lastChange < glowDur;
    const glowKey = glowActive ? Math.floor((t / glowDur) * 24) : -1;
    const opacity = Math.round(s.territoryOpacity * 255);
    const owner = tl.owner;
    const changedAt = tl.changedAt;
    layers.push(
      new SolidPolygonLayer({
        id: 'territory',
        data: terr.indices,
        getPolygon: (i: number) => terr.polygons[i],
        getFillColor: (i: number) => {
          const o = owner[i];
          if (o < 0) return TRANSPARENT;
          const c = factionRgb[o] ?? [128, 128, 128];
          if (glowActive) {
            const age = t - changedAt[i];
            if (age < glowDur) {
              const f = 1 - age / glowDur;
              const m = mix(c, [255, 250, 220], f * 0.75);
              return [m[0], m[1], m[2], Math.min(255, opacity + f * 120)];
            }
          }
          return [c[0], c[1], c[2], opacity];
        },
        extruded: s.territoryExtrude,
        getElevation: (i: number) => (owner[i] < 0 ? 0 : Math.max(0, Math.min(1, (t - changedAt[i]) / span)) * 400000),
        material: false,
        parameters: s.territoryExtrude ? undefined : flatParams,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 50],
        updateTriggers: {
          getFillColor: [tl.version, glowKey, w.revision, opacity],
          getElevation: s.territoryExtrude ? [tl.version, Math.round((t / span) * 200)] : 0,
          getPolygon: terr.geometryVersion,
        },
        beforeId,
      } as any),
    );
    if (s.territoryBorders) {
      const b = terr.borders();
      if (!borderColorCache || borderColorCache.src !== b || borderColorCache.rev !== w.revision) {
        // per-vertex colours (2 vertices per segment)
        const colors = new Uint8Array(b.length * 8);
        const starts = new Uint32Array(b.length);
        for (let i = 0; i < b.length; i++) {
          const c = factionRgb[b.owners[i]] ?? [128, 128, 128];
          for (let v = 0; v < 2; v++) {
            const o = (i * 2 + v) * 4;
            colors[o] = c[0] * 0.55;
            colors[o + 1] = c[1] * 0.55;
            colors[o + 2] = c[2] * 0.55;
            colors[o + 3] = 255;
          }
          starts[i] = i * 2;
        }
        borderColorCache = { src: b, rev: w.revision, colors, starts };
      }
      layers.push(
        new PathLayer({
          id: 'territory-borders',
          data: {
            length: b.length,
            startIndices: borderColorCache.starts,
            attributes: {
              getPath: { value: b.positions, size: 2 },
              getColor: { value: borderColorCache.colors, size: 4, normalized: true },
            },
          },
          _pathType: 'open',
          widthUnits: 'pixels',
          getWidth: s.borderWidth,
          beforeId,
        } as any),
      );
    }
  }

  // ------------------------------------------------ data layers (imported datasets)
  if (s.showData) {
    layers.push(...buildDataLayers(w, beforeId, labels));
    layers.push(...buildStressLayers(w));
  }

  // ------------------------------------------------ routes & vessels
  if (s.showRoutes && sc.routes.length) {
    layers.push(
      new PathLayer({
        id: 'routes',
        data: sc.routes,
        getPath: (r: Route) => routeGeometry(r).path,
        getColor: (r: Route) => [...hexToRgb(r.color), 150],
        getWidth: (r: Route) => 1 + Math.sqrt(r.volume) * 1.2,
        widthUnits: 'pixels',
        widthMinPixels: 1,
        capRounded: true,
        jointRounded: true,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 120],
        extensions: [filter2],
        getFilterValue: (r: Route) => [(r.start ?? -BIG) - origin, (r.end ?? BIG) - origin],
        filterRange: [[-BIG * 2, rt], [rt, BIG * 2]],
        updateTriggers: { getPath: w.revision, getColor: w.revision, getWidth: w.revision, getFilterValue: w.revision },
      } as any),
    );
    if (s.showVessels) {
      const v = computeVessels(w);
      w.lastStats.vessels = v.count;
      if (v.count && globe) {
        layers.push(
          new ScatterplotLayer({
            id: 'vessels',
            data: {
              length: v.count,
              attributes: {
                getPosition: { value: v.positions.subarray(0, v.count * 2), size: 2 },
                getFillColor: { value: v.colors.subarray(0, v.count * 4), size: 4, normalized: true },
              },
            },
            getRadius: 2.2 * s.vesselScale,
            radiusUnits: 'pixels',
            radiusMinPixels: 1,
          } as any),
        );
      } else if (v.count) {
        const atlas = iconAtlas();
        layers.push(
          new IconLayer({
            id: 'vessels',
            data: {
              length: v.count,
              attributes: {
                // fresh subarray views each frame: deck skips re-upload when the buffer object is identical
                getPosition: { value: v.positions.subarray(0, v.count * 2), size: 2 },
                getAngle: { value: v.angles.subarray(0, v.count), size: 1 },
                getColor: { value: v.colors.subarray(0, v.count * 4), size: 4, normalized: true },
              },
            },
            iconAtlas: atlas.url,
            iconMapping: atlas.mapping,
            getIcon: () => 'ship',
            getSize: 11 * s.vesselScale,
            sizeUnits: 'pixels',
            sizeMinPixels: 4,
            billboard: false,
            pickable: false,
          } as any),
        );
      }
    }
  }

  // ------------------------------------------------ flows
  if (s.showFlows && sc.flows.length) {
    const maxV = Math.max(1, ...sc.flows.map((f) => f.value));
    layers.push(
      new ArcLayer({
        id: 'flows',
        data: sc.flows,
        getSourcePosition: (f: any) => f.from,
        getTargetPosition: (f: any) => f.to,
        getSourceColor: (f: any) => [...hexToRgb(f.color ?? '#ffcc00'), 220],
        getTargetColor: (f: any) => [...mix(hexToRgb(f.color ?? '#ffcc00'), [255, 255, 255], 0.5), 220],
        getWidth: (f: any) => 1 + (f.value / maxV) * 8,
        widthUnits: 'pixels',
        greatCircle: true,
        getHeight: 0.4,
        pickable: true,
        autoHighlight: true,
        extensions: [filter2],
        getFilterValue: (f: any) => [(f.start ?? -BIG) - origin, (f.end ?? BIG) - origin],
        filterRange: [[-BIG * 2, rt], [rt, BIG * 2]],
        updateTriggers: { getFilterValue: w.revision, getWidth: w.revision, getSourceColor: w.revision, getTargetColor: w.revision },
      } as any),
    );
  }

  // ------------------------------------------------ units (armies, fleets…)
  if (s.showUnits && sc.units.length) {
    const trailLen = s.unitTrail === 'full' ? BIG : Math.max(1e-6, s.unitTrailFraction * span);
    if (s.plannedPaths) {
      layers.push(
        new PathLayer({
          id: 'units-planned',
          data: sc.units,
          getPath: (u: Unit) => unitGeometry(u, origin).path,
          getColor: (u: Unit) => fcol(u.faction, 110, u.color),
          getWidth: 1.5,
          widthUnits: 'pixels',
          getDashArray: [4, 4],
          dashJustified: true,
          extensions: [dashExt],
          updateTriggers: { getPath: w.revision, getColor: w.revision },
        } as any),
      );
    }
    layers.push(
      new TripsLayer({
        id: 'units-trails',
        data: sc.units,
        getPath: (u: Unit) => unitGeometry(u, origin).path,
        getTimestamps: (u: Unit) => unitGeometry(u, origin).times,
        getColor: (u: Unit) => fcol(u.faction, 255, u.color),
        getWidth: (u: Unit) => (u.width ?? 4) * s.unitScale,
        widthUnits: 'pixels',
        widthMinPixels: 1.5,
        capRounded: true,
        jointRounded: true,
        fadeTrail: s.unitTrail === 'fade',
        trailLength: trailLen,
        currentTime: rt,
        pickable: true,
        updateTriggers: { getPath: [w.revision, origin], getTimestamps: [w.revision, origin], getColor: w.revision, getWidth: [w.revision, s.unitScale] },
      } as any),
    );
    const heads: { unit: Unit; id: string; pos: LonLat; heading: number }[] = [];
    for (const u of sc.units) {
      const n = u.path.length;
      if (!n || t < u.path[0][2] || t > u.path[n - 1][2] + span * 0.01) continue;
      const p = positionAtTime(u.path, t, true);
      if (p) heads.push({ unit: u, id: u.id, pos: p.pos, heading: p.heading });
    }
    if (heads.length) {
      layers.push(
        new ScatterplotLayer({
          id: 'units-heads',
          data: heads,
          getPosition: (h: any) => h.pos,
          getRadius: (h: any) => (11 + (h.unit.strength ? Math.min(8, Math.sqrt(h.unit.strength) / 50) : 0)) * s.unitScale,
          radiusUnits: 'pixels',
          getFillColor: (h: any) => fcol(h.unit.faction, 255, h.unit.color),
          stroked: true,
          getLineColor: [255, 255, 255, 230],
          lineWidthUnits: 'pixels',
          getLineWidth: 1.5,
          pickable: true,
          autoHighlight: true,
        } as any),
      );
      for (const h of heads) {
        const kind = h.unit.kind ?? 'army';
        const icon = UNIT_ICON[kind] ?? 'arrow';
        const r = (11 + (h.unit.strength ? Math.min(8, Math.sqrt(h.unit.strength) / 50) : 0)) * s.unitScale;
        labels.push({
          pos: h.pos,
          icon,
          iconSize: r * 1.25,
          iconColor: '#ffffff',
          angle: icon === 'arrow' || icon === 'ship' ? h.heading : undefined,
          collide: false,
          priority: 1000,
        });
        if (s.unitLabels) {
          labels.push({ pos: h.pos, text: h.unit.name, size: 12, weight: 600, color: textCss, halo: haloCss, offset: [0, -r - 10], priority: 900 });
        }
      }
    }
  }

  // ------------------------------------------------ events
  if (s.showEvents && sc.events.length) {
    const dur = sc.meta.eventDuration ?? span * 0.03;
    const fade = dur * 0.35;
    const pulse = 1 + 0.25 * Math.sin(((performance.now() - w.startedAt) / 1000) * 4);
    const ef = (e: any) => [e.t - origin, (e.end ?? e.t + dur) - origin];
    const range = [[-BIG * 2, rt], [rt, BIG * 2]];
    const soft = [[-BIG * 2, rt], [rt + fade, BIG * 2]];
    layers.push(
      new ScatterplotLayer({
        id: 'events-rings',
        data: sc.events,
        getPosition: (e: any) => e.position,
        getRadius: 16,
        radiusUnits: 'pixels',
        radiusScale: pulse,
        stroked: true,
        filled: true,
        getFillColor: (e: any) => fcol(e.faction, 60, kindColor(e.kind)),
        getLineColor: (e: any) => [...hexToRgb(kindColor(e.kind)), 230],
        lineWidthUnits: 'pixels',
        getLineWidth: 2,
        pickable: true,
        autoHighlight: true,
        extensions: [filter2],
        getFilterValue: ef,
        filterRange: range,
        filterSoftRange: soft,
        updateTriggers: { getFilterValue: [w.revision, dur], getFillColor: w.revision, getLineColor: w.revision },
      } as any),
    );
    for (const e of sc.events) {
      const end = e.end ?? e.t + dur;
      if (t < e.t || t > end) continue;
      const alpha = Math.min(1, (end - t) / fade);
      labels.push({ pos: e.position, icon: EVENT_ICON[e.kind] ?? 'note', iconSize: 18, iconColor: dark ? '#ffffff' : '#111111', collide: false, alpha, priority: 2000 });
      if (s.eventLabels) labels.push({ pos: e.position, text: e.title, size: 13, weight: 700, color: textCss, halo: haloCss, offset: [0, 28], alpha, priority: 1500 + (e.t - origin) / span });
    }
  }

  // ------------------------------------------------ capitals
  if (s.capitals) {
    for (const f of sc.factions) {
      if (!f.capital) continue;
      // only show capitals of factions that currently hold territory (or have no territory model)
      const fi = w.factionIndex.get(f.id) ?? -1;
      if (tl.keys.length && fi >= 0 && !tl.counts[fi] && !(w.countryTimeline.counts[fi] > 0)) continue;
      labels.push({ pos: f.capital, icon: 'star', iconSize: 16, iconColor: f.color, halo: 'rgba(0,0,0,0.8)', collide: false, priority: 800 });
    }
  }

  // ------------------------------------------------ annotations
  if (s.showAnnotations) {
    for (const a of sc.annotations) {
      if ((a.start !== undefined && t < a.start) || (a.end !== undefined && t > a.end)) continue;
      const meters = (a.units ?? 'pixels') === 'meters';
      labels.push({
        pos: a.position,
        text: a.text,
        font: 'Cinzel, Georgia, serif',
        weight: 700,
        size: meters ? undefined : a.size ?? 16,
        sizeMeters: meters ? a.size ?? 60000 : undefined,
        minPx: meters ? 9 : undefined,
        maxPx: meters ? 64 : undefined,
        color: a.color ?? textCss,
        halo: haloCss,
        haloWidth: 2,
        letterSpacing: 1.5,
        priority: 500,
      });
    }
  }

  // ------------------------------------------------ faction labels (atlas style)
  if (s.factionLabels && s.showTerritory && tl.keys.length) {
    const cellArea = Math.sqrt(cellAreaKm2(sc.meta.h3Resolution));
    for (const l of terr.factionLabels()) {
      const f = sc.factions[l.owner];
      if (!f) continue;
      const c = factionRgb[l.owner] ?? [255, 255, 255];
      const m = dark ? mix(c, [255, 255, 255], 0.55) : mix(c, [0, 0, 0], 0.5);
      labels.push({
        pos: l.position,
        text: f.name,
        uppercase: true,
        font: 'Cinzel, Georgia, serif',
        weight: 700,
        sizeMeters: Math.sqrt(l.count) * cellArea * 1000 * 0.12,
        minPx: 10,
        maxPx: 40,
        letterSpacing: 3,
        color: `rgb(${m[0] | 0},${m[1] | 0},${m[2] | 0})`,
        halo: haloCss,
        haloWidth: 2,
        priority: 100 + Math.log(l.count + 1),
      });
    }
  }

  // ------------------------------------------------ country labels
  if (s.countryLabels && world) {
    for (const c of world.list) {
      labels.push({ pos: c.labelPoint, text: c.name, size: 11, weight: 500, color: dark ? 'rgba(220,225,235,0.8)' : 'rgba(40,40,50,0.8)', halo: haloCss, haloWidth: 2, priority: Math.log(c.area + 1) - 50 });
    }
  }

  // ------------------------------------------------ selection highlight
  const sel = w.selection;
  if (sel?.kind === 'unit' && sel.object) {
    const u = sel.object as Unit;
    layers.push(
      new PathLayer({
        id: 'sel-unit',
        data: [u],
        getPath: (x: Unit) => unitGeometry(x, origin).path,
        getColor: [255, 255, 255, 200],
        getWidth: 2,
        widthUnits: 'pixels',
        getDashArray: [6, 4],
        extensions: [dashExt],
      } as any),
    );
  } else if (sel?.kind === 'route' && sel.object) {
    layers.push(
      new PathLayer({
        id: 'sel-route',
        data: [sel.object],
        getPath: (r: Route) => routeGeometry(r).path,
        getColor: [255, 255, 255, 220],
        getWidth: (r: Route) => 3 + Math.sqrt(r.volume) * 1.2,
        widthUnits: 'pixels',
      } as any),
    );
  } else if (sel?.position && (sel.kind === 'event' || sel.kind === 'cell' || sel.kind === 'country' || sel.kind === 'data')) {
    layers.push(
      new ScatterplotLayer({
        id: 'sel-point',
        data: [sel.position],
        getPosition: (p: LonLat) => p,
        getRadius: 22,
        radiusUnits: 'pixels',
        stroked: true,
        filled: false,
        getLineColor: [255, 255, 255, 230],
        lineWidthUnits: 'pixels',
        getLineWidth: 2,
      } as any),
    );
  }

  layers.push(...w.toolLayers());
  if (globe) {
    // Pull overlays slightly toward the camera so they don't z-fight with the globe mesh,
    // while geometry on the far side of the planet stays occluded.
    const bias = (window as any).__bias ?? { depthBias: -40000, depthBiasSlopeScale: -4 };
    return { layers: layers.map((l) => (l.props.parameters && Object.keys(l.props.parameters).length ? l : l.clone({ parameters: bias } as any))), labels };
  }
  return { layers, labels };
}

export function cellAreaKm2(res: number): number {
  const table = [4357449, 609788, 86802, 12393, 1770, 252.9, 36.13, 5.16, 0.737];
  return table[res] ?? 0.1;
}

export function kindColor(kind: string): string {
  switch (kind) {
    case 'battle': return '#ff4d4d';
    case 'siege': return '#ff9f43';
    case 'founding': return '#4dd2ff';
    case 'treaty': return '#7bed9f';
    case 'disaster': return '#a55eea';
    case 'discovery': return '#ffd32a';
    default: return '#dfe4ea';
  }
}

// ---------------------------------------------------------------- vessels

function computeVessels(w: MapWidget) {
  const sc = w.scenario;
  const t = w.time;
  let total = 0;
  for (const r of sc.routes) {
    if ((r.start !== undefined && t < r.start) || (r.end !== undefined && t > r.end)) continue;
    total += Math.max(0, Math.floor(r.vessels));
  }
  if (vesselBuf.cap < total) {
    const cap = Math.ceil(total * 1.5) + 16;
    vesselBuf = { positions: new Float32Array(cap * 2), angles: new Float32Array(cap), colors: new Uint8Array(cap * 4), cap };
  }
  const { positions, angles, colors } = vesselBuf;
  // ambient clock (seconds) drives the loop; scale so a ~20,000 km route takes ~60 s at speed 1
  const clock = w.settings.ambientAnimation ? w.ambientClock : (w.time - sc.meta.start) * 365.25 * 24;
  let k = 0;
  for (const r of sc.routes) {
    if ((r.start !== undefined && t < r.start) || (r.end !== undefined && t > r.end)) continue;
    const n = Math.max(0, Math.floor(r.vessels));
    if (!n) continue;
    const g = routeGeometry(r);
    const c = hexToRgb(r.color);
    const kmPerSec = (r.speedKnots || 15) * 22; // stylised ambient speed
    const travelled = clock * kmPerSec;
    const cum = g.cum, path = g.path, L = g.length;
    for (let i = 0; i < n; i++) {
      const reverse = r.bidirectional && i % 2 === 1;
      // golden-ratio spacing gives an even but non-mechanical distribution
      const phase = ((i * 0.6180339887) % 1) * L;
      let d = (phase + travelled) % L;
      if (reverse) d = L - d;
      // binary search segment
      let lo = 0, hi = cum.length - 1;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (cum[m] <= d) lo = m;
        else hi = m;
      }
      const a = path[lo], b = path[hi];
      const seg = cum[hi] - cum[lo] || 1;
      const f = (d - cum[lo]) / seg;
      positions[k * 2] = a[0] + (b[0] - a[0]) * f;
      positions[k * 2 + 1] = a[1] + (b[1] - a[1]) * f;
      const dx = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180);
      const dy = b[1] - a[1];
      let heading = (Math.atan2(dx, dy) * 180) / Math.PI;
      if (reverse) heading += 180;
      angles[k] = -heading;
      colors[k * 4] = Math.min(255, c[0] * 0.5 + 128);
      colors[k * 4 + 1] = Math.min(255, c[1] * 0.5 + 128);
      colors[k * 4 + 2] = Math.min(255, c[2] * 0.5 + 128);
      colors[k * 4 + 3] = 255;
      k++;
    }
  }
  return { count: k, positions, angles, colors };
}
