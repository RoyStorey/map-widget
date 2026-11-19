# Atlas — the ultimate map widget

A high-performance, time-aware map widget for modelling **conquests over time**, **zooming into
campaigns as they happen**, **mapping shipping lanes**, and visualising any spatio-temporal data.

Built on **MapLibre GL** (globe and Mercator), **deck.gl** (WebGL layers) and **H3** (hexagonal
territory cells). TypeScript, no UI framework, works offline with bundled Natural Earth data.

```bash
npm install
npm run dev          # editor at http://localhost:5173  (?demo=ww2 | dday | mongol | rome | …, see below)
npm run build        # static site in dist/ (includes examples/)
npm run build:lib    # ES module library in dist-lib/
```

---

## Scenarios

Open them from the **Scenarios** button (top left) or with Ctrl+K and "scenario", or add `?demo=<id>` to the URL.

| Wars & conquests | id | Battles up close | id |
|---|---|---|---|
| Alexander the Great, 336–301 BCE | `alexander` | **D-Day**, 6 June 1944, hour by hour | `dday` |
| Rise of Rome, 264 BCE–117 CE | `rome` | Midway, 4 June 1942 | `midway` |
| Early Islamic conquests, 622–763 | `caliphate` | Stalingrad, 1942–43 | `stalingrad` |
| Mongol conquests, 1200–1280 | `mongol` | Waterloo, 18 June 1815 | `waterloo` |
| Rise of the Ottomans, 1299–1683 | `ottoman` | | |
| Napoleonic Europe, 1799–1815 | `europe` | | |
| **World War II**, 1939–1945 | `ww2` | | |
| Global shipping lanes, 2023–25 | `shipping` | | |

**Battle dives.** A war's events can link to a detailed battle: D-Day, Midway and Stalingrad from WW2, and Waterloo from
Napoleonic Europe.
- **During playback**, the event card offers "Watch … up close". You can also click the event and use the Inspector
  button.
- **In the battle**, the camera director flies you around the fighting at H3 resolution 7–10 (cells from about 5 km²
  down to about 0.015 km²), using 1:10m coastlines. You get airborne drops, fleets, naval gunfire arcs, beachheads and
  counter-attacks.
- **Afterwards**, "Back to …" returns you to the war at the moment you left.
- **Cinematic mode**: Settings → Linked battles → "Dive in automatically" enters each battle and comes back without you
  having to click.

All scenario data is approximate and illustrative.

### Making your own war (`src/demos/kit.ts`)
```ts
buildKit({
  title: 'My war', start: '1914-07-28', end: '1918-11-11', res: 4,
  factions: [{ id: 'cp', name: 'Central Powers', color: '#495057' }, { id: 'en', name: 'Entente', color: '#e03131' }],
  countries: [[['Germany', 'Austria', 'Hungary'], '1914-07-28', 'cp'], [['France', 'United Kingdom', 'Russia'], '1914-07-28', 'en']],
  regions: [{ ring: [[2.5, 51], [6, 50], [6.5, 49], [3, 49.3]], native: 'en', phases: [['cp', '1914-08-04', '1914-09-05', [6, 50.5]]] }],
  units: [march('kluck', '1st Army', 'cp', [[[6, 50.8], '1914-08-17'], [[2.8, 49.0], '1914-09-05']], 'army', 320000)],
  events: [ev('1914-09-06', [3.5, 48.9], 'First Battle of the Marne', 'battle', '…', { battle: 'marne' })],
  camera: 'auto',
});
```
- **Countries** are turned into H3 cells, so whole-country control and the fronts share one layer.
- **Regions** are polygons whose cells change hands in waves. Each wave is written as
  `[faction, start, end, origin?, jitter?]`.
- Battles add `hiResLand: bbox` for precise coastlines.
- `settings` and `utcOffsetHours` set display presets, such as night shading in local time.

---

## History lessons for courses (`atlas-lesson@1`)

A small JSON format and a student **lesson player** turn any battle, conquest, voyage or trade route into
an embeddable, guided map with a **draggable timeline**, story chapters and quiz questions. It's built so
an **AI agent can write a lesson end to end**. See [`AGENTS.md`](AGENTS.md) for the authoring guide and
`.claude/skills/history-map-lesson/` for the Claude skill.

```bash
npm run lesson:check -- public/lessons/my-lesson.json   # validate: errors give the JSON path and a fix
```

```
http://localhost:5173/lesson.html?lesson=lessons/norman-conquest-1066.json   # player
http://localhost:5173/lesson.html                                            # gallery of lessons
```

```html
<iframe src="https://YOUR-HOST/lesson.html?lesson=lessons/norman-conquest-1066.json" title="1066 – interactive map"
        width="100%" height="640" style="border:0;border-radius:12px" allow="fullscreen" loading="lazy"></iframe>
```

| Piece | Where |
|---|---|
| Format types and JSON Schema | `src/lesson/spec.ts`, `public/atlas-lesson.schema.json` |
| Gazetteer (~540 historic places, aliases) | `src/core/places.ts`, `docs/places.md` |
| Validator and compiler | `src/lesson/validate.ts`, `src/lesson/compile.ts` |
| Player | `lesson.html`, `src/player/` |
| Example lessons | `public/lessons/` (1066, Magellan, Constantinople 1453, Gettysburg) |

**Player features**
- **Modes:** a guided tour where each chapter plays and then pauses, and free explore mode.
- **Questions:** multiple-choice and "click it on the map" questions, with a score at the end.
- **Interaction:** click anything for details; read-aloud (text-to-speech).
- **Classroom:** a **printable worksheet** with an answer key, and **projector mode** (`&present=1` or `B`).
- **Layout:** works on phones with a bottom-sheet layout, keyboard and screen-reader friendly, light and dark themes.

**URL options**

| Option | Effect |
|---|---|
| `mode=explore` | free exploration |
| `step=N` | open at chapter N |
| `autoplay=1` | start playing |
| `globe=1` | start on the globe |
| `theme=light` | light theme |
| `present=1` | projector mode |
| `story=0` | hide the story panel |
| `title=0` | hide the title |

**Course platforms** can listen to `postMessage` events and record progress and scores:
- `atlas:loaded`
- `atlas:progress` (chapter)
- `atlas:quiz` (each answer)
- `atlas:complete` (score)

The editor's **Story** tab authors lessons visually. *Embed in course…* makes a self-contained link
(`lesson.html#lesson=…`) that needs no file hosting.

---

## Features

### Time & playback
- One timeline drives everything: territory, armies, fleets, events, labels, regions, routes, flows and data layers.
- Time is a **decimal year** (astronomical numbering), so `-500` (501 BCE), `1241.3`, and `2024-03-15T10:30` all work.
  Inputs accept `500 BCE`, `AD 800`, `Mar 1241`, ISO dates, and so on.
- Canvas timeline: a **stacked area chart of every faction's territory**, event ticks, camera keyframes, **named eras**
  as bands, a draggable playhead, wheel zoom, Shift-drag pan, Alt-drag snapping to events.
- Play, pause, loop, step to the previous/next change, and set the speed as a "full run" length.
- **Event cards** pop up during playback, and the chronicle shows the current era and latest event.

### Territory and conquest modelling
- **H3 hex-cell territory** (resolutions 2–6, from about 87,000 km² down to about 36 km² per cell) with a full ownership
  history per cell.
- **Incremental ownership engine**: scrubbing touches only the events between the old and new time. A random seek on the
  Mongol demo (33k events) takes about 0.07 ms.
- **Faction borders** are computed from the cell adjacency, and a **conquest glow** highlights newly taken land.
- **Atlas-style faction names** scale with the map. There are capitals, and an optional **3D extrusion by age of rule**.
- Tools:
  - **Brush and eraser** with an adjustable radius, land-only painting, and Alt-click to pick a faction.
  - **Conquest wave**: draw a region and it falls progressively from an origin, with an organic, noisy front.
  - **Country tool**: assign whole modern countries over time, or fill them with cells.
  - **Regions**: polygons with a lifespan.
- Bulk edits: clear the future, snapshot the current state as the start, shift every time, and change the cell
  resolution (existing data is resampled).

### Armies, fleets, shipping
- **Units** move along timed great-circle paths, shown as fading or full trails. Their heading-aware icons are sized by
  strength and labelled, and the camera can follow any unit.
- **Shipping lanes** carry thousands of animated vessels, either one-way or two-way, with opening and closing dates.
- **Automatic sea routing**: weighted A* over a land-mask water grid. It uses Suez, Panama, the Bosporus, Kiel,
  Gibraltar, Malacca, Hormuz and other straits, avoids polar ice, and smooths the route with line-of-sight checks.
  Click Shanghai, then Rotterdam, and you get a realistic lane via Malacca and Suez.
- **Flows**: 3D great-circle arcs with animated packets.

### Camera direction
- **Director mode** flies the camera between keyframes during playback. It uses a zoom-out-and-in curve for long jumps.
- **Auto-director** generates keyframes that **follow the conquest fronts**, which it finds by clustering territory
  changes in time windows. It can also visit every event. One click and playback zooms into each campaign as it
  happens.
- Bookmarks (Alt+1…9), a bookmark tour, converting bookmarks to keyframes, and following a unit.

### Basemaps & overlays
- **Offline styles** from bundled Natural Earth data: Parchment (historical), Dark atlas, Light atlas, Blueprint, Ink and
  paper, and War room. Modern borders can be switched on or off.
- **Online styles**: OpenFreeMap vector (Liberty, Positron, Bright, Dark, Fiord), Esri satellite, ocean and NatGeo,
  Carto, OpenTopoMap, OSM, and NASA night lights.
- **Globe or Mercator**, 3D terrain, hillshade, graticule, the **day/night terminator** for the timeline date, and
  country labels.
- **XYZ tile overlays** (for example georeferenced historical maps, or OpenSeaMap seamarks) and **image overlays**
  pinned to the view. Both can be given a time window.

### Data
- Import **GeoJSON, TopoJSON, CSV/TSV, KML, GPX**, scenario files and images by drag and drop, file picker or paste.
- CSV import works out the layout from the columns:
  - lat/lon columns become points;
  - from/to columns become arcs;
  - id + time columns become **animated trips** (for example AIS or GPS tracks);
  - a WKT column becomes geometry.
- Render a layer as scatter, heatmap, hexbin, grid, screen grid, GeoJSON, arcs or trips. You can colour it by category,
  size it by weight, label it from a field, and **filter it by time on the GPU** using a sliding window or a cumulative
  view.
- **Performance lab**: 100k–5M synthetic points, filtered by time on the GPU every frame.

### Editor UX
- Command palette (Ctrl+K), search (countries, events, units, factions, bookmarks, coordinates, and Nominatim place
  search), a minimap, a performance HUD, a live legend, and tooltips.
- **Inspector** for anything you click. It shows details, edit forms, raw JSON editing and the full ownership history
  of a cell.
- Full **undo/redo**, **IndexedDB autosave**, saves by name, and URL state (`#v=lon,lat,zoom,bearing,pitch&t=…`).
- **Share links** that can embed the whole scenario (compressed with deflate) in the URL.
- **Export**: scenario JSON, territory GeoJSON at the current time, features as GeoJSON, events as CSV, a PNG screenshot
  with labels, and **WebM video**. The video can play the whole timeline and burns in the title, date and legend.
- Presentation mode, light and dark UI, and keyboard shortcuts for everything (press `?`).

---

## Performance notes

**Performance mode** (Settings → Performance):

| Mode | Resolution | Frame cap (playing / idle animation) | Territory updates while playing | Extras |
|---|---|---|---|---|
| Quality | up to 2× | 60 / 60 fps | 30/s | glow, minimap |
| Balanced | up to 1.5× | 60 / 30 fps | 12/s | glow, minimap |
| Lite | 1× | 30 / 15 fps | 6/s | no glow, no minimap |

**Auto** (the default) picks Lite on low-memory, low-core or touch devices and Balanced everywhere else.

- Everything that animates is on the GPU or in incremental CPU structures:
  - territory colours are recomputed only when ownership changes, or in glow steps;
  - borders are rebuilt from cached cell-edge geometry only when ownership changes;
  - time filtering for regions, events, flows, routes and data uses `DataFilterExtension` on the GPU;
  - vessels are written into reused typed arrays and uploaded as binary attributes.
- Labels and icons are drawn by a dedicated Canvas2D overlay. It does priority-based collision detection, culls labels
  behind the horizon on the globe, and caches text measurements. This also works around deck.gl's text and icon layers
  not rendering in globe mode.
- Heavy work runs off the main thread: H3 polygon fills and sea routing run in Web Workers. The land test is a
  rasterised bitmap lookup, not a polygon test.
- The render loop sleeps when nothing is animating, so CPU use is 0% when idle with ambient animation turned off.
- Vendor code is split into chunks: MapLibre, deck.gl and H3 each get their own. Demos and world data are loaded
  lazily.

---

## Library usage

### Full editor
```ts
import { createAtlas } from './src/index';
const app = createAtlas(document.getElementById('host')!);
app.widget.loadScenario(myScenario);
```

### Headless widget (no editor UI)
```ts
import { MapWidget, emptyScenario } from './src/index';

const w = new MapWidget({
  container: document.getElementById('map')!,
  scenario: emptyScenario({ title: 'My war', start: 0, end: 100, h3Resolution: 3 }),
  settings: { basemap: 'parchment', projection: 'globe' },
});

w.on('ready', async () => {
  const red = w.addFaction({ name: 'Red', color: '#e03131', capital: [12.5, 41.9] });
  await w.conquer([[[5, 36], [20, 36], [22, 46], [8, 47]]], red, 5, 40, { origin: [12.5, 41.9] });
  w.setCountries(['France', 'Spain'], red, 50);
  w.addUnit({ name: 'Legion', faction: red, path: [[12.5, 41.9, 55], [4.85, 45.75, 75]] });
  w.addEvent({ t: 75, position: [4.85, 45.75], title: 'Fall of Lugdunum', kind: 'siege' });
  const lane = await w.seaRoute([[12.3, 45.4], [-0.1, 51.5]]);
  w.addRoute({ name: 'Venice – London', waypoints: lane, vessels: 40 });
  w.play();
});
w.on('time', (t) => console.log(t));
```

Key methods:
- **Playback**: `setTime`, `play`, `pause`, `togglePlay`, `setSpeed`, `stepEvent`.
- **Loading and saving**: `loadScenario`, `exportScenario`.
- **Adding content**: `addFaction`, `addUnit`, `addRoute`, `addEvent`, `addLabel`, `addFlow`, `addRegion`,
  `addDataLayer`, `remove`.
- **Territory**: `conquer`, `paintCells`, `setCountries`, `setCountryOwner`.
- **Routing**: `seaRoute`.
- **Camera**: `flyTo`, `fitBounds`, `addCameraKey`, `addBookmark`.
- **Editing**: `commit(label, keys, mutator)` for any custom undoable edit, plus `undo` and `redo`.
- **Settings and output**: `updateSettings`, `screenshot`, `setStress`.

Events: `ready`, `time`, `play`, `speed`, `scenario`, `settings`, `select`, `hover`, `tool`, `history`, `eventsPassed`,
`frame` (perf stats), `basemap`, `world`.

See `examples/api.html` for a complete example built only with the API.

### Embedding via iframe + postMessage
```html
<iframe id="atlas" src="https://your-host/index.html?demo=mongol&embed=1&viewer=1"></iframe>
<script>
  atlas.contentWindow.postMessage({ type: 'atlas', id: 1, method: 'setTime', args: [1241.3] }, '*');
  window.addEventListener('message', (e) => {
    if (e.data.type === 'atlas:result') console.log(e.data.id, e.data.result);
    if (e.data.type === 'atlas:event') console.log(e.data.name, e.data.payload); // time, play, select, ready
  });
</script>
```
`viewer=1` hides the editing UI. See `examples/embed.html`.

---

## Scenario format

A scenario is plain JSON (`version: 1`). Times are decimal years.

```jsonc
{
  "version": 1,
  "meta": { "title": "…", "start": 1200, "end": 1281, "speed": 1.6, "eventDuration": 3, "h3Resolution": 4,
            "basemap": "parchment", "view": { "center": [80, 42], "zoom": 2.4 } },
  "factions":  [{ "id": "mongol", "name": "Mongol Empire", "color": "#e8590c", "capital": [102.8, 47.2] }],
  "cells":     [{ "cell": "8425a1bffffffff", "t": 1219.8, "faction": "mongol" }],      // H3 ownership changes (null = release)
  "countries": [{ "country": "250", "t": 1804.9, "faction": "fr" }],                     // ISO numeric (Natural Earth ids)
  "units":     [{ "id": "u1", "name": "Batu Khan", "faction": "mongol", "kind": "army", "strength": 130000,
                  "path": [[50, 53, 1236.8], [39.7, 54.6, 1237.95]] }],                  // [lon, lat, t]
  "routes":    [{ "id": "r1", "name": "Asia–Europe", "color": "#4dabf7", "waypoints": [[122.6, 30.9], [4.1, 52]],
                  "vessels": 200, "speedKnots": 20, "volume": 10, "bidirectional": true, "end": 2023.95 }],
  "events":    [{ "id": "e1", "t": 1241.28, "position": [20.9, 47.97], "title": "Battle of Mohi", "kind": "battle" }],
  "annotations": [{ "id": "a1", "text": "Gobi", "position": [105, 43], "units": "meters", "size": 90000 }],
  "flows":     [{ "id": "f1", "from": [121.5, 31.2], "to": [4.1, 51.9], "value": 24 }],
  "regions":   [{ "id": "g1", "name": "Province", "faction": "mongol", "rings": [[[…]]], "start": 1220, "end": 1260 }],
  "eras":      [{ "id": "x1", "name": "Western campaign", "start": 1236, "end": 1242.5, "color": "#74c0fc" }],
  "camera":    [{ "t": 1241.3, "center": [19, 49], "zoom": 4.6, "bearing": 10, "pitch": 35 }],
  "bookmarks": [{ "id": "b1", "name": "Europe 1241", "center": [22, 49], "zoom": 4.8, "bearing": 0, "pitch": 0, "t": 1241.3 }],
  "layers":    [{ "id": "d1", "name": "Ports", "visible": true, "data": { "type": "FeatureCollection", "features": [] },
                  "style": { "render": "scatter", "color": "#ffd43b", "radius": 3, "opacity": 0.9, "ramp": "inferno",
                             "timeWindow": 0, "timeField": "date", "weightField": "teu", "labelField": "name" } }],
  "tileOverlays": [{ "id": "t1", "name": "Seamarks", "url": "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", "opacity": 0.8, "visible": true }],
  "images": []
}
```

---

## Keyboard shortcuts

| Key | Action | Key | Action |
|---|---|---|---|
| Space | Play / pause | `,` `.` | Previous / next change |
| ← → (Shift ×10) | Step time | Home / End | Start / end |
| `[` `]` | Brush size (painting) or speed | D | Director mode |
| K | Camera keyframe | G | Globe / flat |
| B / E | Paint / erase | W | Conquest wave |
| C | Assign country | U | Army / unit path |
| R | Shipping route | V / T | Event / label |
| M | Measure | S / Esc | Select tool |
| Shift+1…9 | Select faction | Alt+1…9 | Go to bookmark |
| Ctrl+Z / Ctrl+Shift+Z | Undo / redo | Ctrl+K | Command palette |
| Ctrl+S / Ctrl+O | Save / open | P | Screenshot |
| F | Presentation mode | H / `\` | Toggle timeline / sidebar |

---

## Project layout

```
src/
  core/      time, geodesy, scenario model, ownership timeline, H3 territory engine, camera, director,
             basemaps, world data, land mask, conquest generators, worker clients
  layers/    deck.gl layer builder, data layers, stress layers, canvas label overlay, icon atlas
  widget/    MapWidget (headless core: map, clock, render loop, undoable edit API), settings
  tools/     interactive tools (paint, wave, country, region, unit, route, flow, event, label, measure)
  ui/        editor shell: app, timeline, panels, command palette, minimap, DOM helpers
  lesson/    atlas-lesson@1 spec, validator, compiler
  player/    student lesson player (lesson.html), worksheet
  io/        import (GeoJSON/TopoJSON/CSV/KML/GPX), export, IndexedDB storage, video recorder, iframe bridge
  workers/   H3 polyfill worker, sea-routing worker
  demos/     WW2, D-Day, Midway, Stalingrad, Waterloo, Alexander, Rome, Caliphates, Ottomans, Mongols, Napoleon, shipping
public/lessons/  example lessons + index.json (gallery)
scripts/   lesson:check, lesson:schema, lesson:places
test/      vitest unit tests (npm test)
examples/    api.html (headless API), embed.html (iframe + postMessage)
```

## Notes on data

The demo scenarios are **approximate and illustrative**. They show what the widget can do and are not historical or
economic references. Offline basemaps use Natural Earth (public domain) via `world-atlas`. Online basemaps and
geocoding are provided by their own services (OpenFreeMap, Esri, Carto, OpenTopoMap, OSM, NASA GIBS, Nominatim)
under their own terms. See the attribution on the map.
