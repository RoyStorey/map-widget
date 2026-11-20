# Embedding the map widget

`map-widget/embed` puts an interactive historical map, with a draggable timeline and optional chapters, inside any
web page. It's one ES module with no runtime dependencies. MapLibre, deck.gl, H3 and the Natural Earth data are
bundled, and the CSS is injected when the first map mounts.

## Install

The package builds itself on install (`prepare` → `npm run build:lib`), so a git dependency is enough:

```bash
npm install github:RoyStorey/map-widget#<branch-or-tag>
```

Pin a tag or commit for reproducible builds. To pick up a newer version, run the same command again.

## Use

```ts
import { mountMap, type MapSpec } from 'map-widget/embed';

const handle = mountMap(document.getElementById('map')!, spec, {
  theme: 'light',          // 'light' | 'dark' chrome; default follows prefers-color-scheme
  chapter: 0,              // chapter to open on
  chapters: [1, 3],        // only these chapters (1-based); the timeline spans just their period
  lazy: true,              // create the WebGL map only when scrolled into view (default)
  story: true,             // show the chapter panel when the map has chapters
  onChapter: (i, n) => {}, // reader moved to chapter i of n
  onReady: (err) => {},    // built (or failed, with the validator report in err.report)
});

handle.goToChapter(2);
handle.setTheme('dark');
handle.destroy();          // removes the map, its WebGL context and every listener
```

The spec can be one of three things:
- an `atlas-map@1` object (see `AGENTS.md`);
- a full `Scenario` saved from the editor;
- a URL to either of those.

### One map beside several sections

A map's chapters often follow a page's sections. Instead of one map at the top, place the same map beside
each section, showing only that section's chapters:

```ts
mountMap(sectionOneFigure, spec, { chapters: [1, 3] });   // e.g. the conquest, 602–621
mountMap(sectionTwoFigure, spec, { chapters: [4, 7] });   // the counterattack, 622–630
```

Each placement numbers its own chapters ("Chapter 1 of 3"), and its timeline covers only their years. Maps that
scroll out of view pause.

## Theming

The widget is scoped to `.atlas-map` and reads these custom properties from its container, all optional:

| Property | Used for |
|---|---|
| `--atlas-paper` | panel background |
| `--atlas-sunk` | recessed background |
| `--atlas-ink` | text |
| `--atlas-muted` | secondary text |
| `--atlas-rule` | borders |
| `--atlas-accent` | buttons, playhead |
| `--atlas-font` | UI font |
| `--atlas-serif` | chapter titles |
| `--atlas-radius` | corner radius |
| `--atlas-aspect` | map aspect ratio (default `16 / 10`) |
| `--atlas-aspect-narrow` | aspect ratio when the widget is under 520 px wide (default `1 / 0.85`) |

```css
.my-figure { --atlas-paper: var(--paper); --atlas-ink: var(--ink); --atlas-accent: var(--accent); }
```

## React / Next.js

Import the module inside an effect, so it never runs on the server and only loads on pages that have a map:

```tsx
'use client';
import { useEffect, useRef } from 'react';
import type { MapSpec } from 'map-widget/embed';

export function HistoryMap({ spec }: { spec: MapSpec }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let handle: { destroy(): void } | undefined;
    let cancelled = false;
    import('map-widget/embed').then(({ mountMap }) => {
      if (!cancelled && ref.current) handle = mountMap(ref.current, spec, { theme: 'light' });
    });
    return () => { cancelled = true; handle?.destroy(); };
  }, [spec]);
  return <div ref={ref} />;
}
```

## Checking maps in Node

`map-widget/spec` has the types, the validator and the place gazetteer, with no browser code:

```ts
import { checkMapRoutes, formatIssues, validateMap } from 'map-widget/spec';

const r = validateMap(spec);                  // format, places, times
if (!r.ok) throw new Error(formatIssues(r));
const routes = await checkMapRoutes(spec);    // armies on land, ships on water
```

`checkMapRoutes` loads the Natural Earth coastline the first time it runs (about a second). It reports:
- **errors** for legs that can't happen, such as an army walking to an island;
- **warnings** for legs that are suspicious, such as a long detour that suggests a sea crossing, or a ship sailing
  over land.

## Behaviour notes

- **Scrolling:** the map uses MapLibre's cooperative gestures. The page scrolls normally, Ctrl/⌘ + scroll zooms,
  and on touch screens two fingers pan. In full screen, normal gestures apply.
- **Off-screen:** maps out of view pause, and the render loop goes idle.
- **Camera views:** views are authored for a ~1000 px wide map. Narrower maps zoom out to show the same area.
- **Controls:** there are deliberately few.
  - One play button plays the current chapter, pauses at its end, and goes on to the next.
  - Back and Next step through the chapters; the numbered stops on the timeline jump to one.
  - Dragging the timeline moves through time freely.
  - Moving the map hands the camera to the reader. A button then appears to fly back to the story's view.
- **Keyboard:** when the widget has focus, ← / → change chapter and Space plays or pauses. The timeline is an ARIA
  slider.
- **Online tiles:** city and battlefield maps use online tiles from OpenFreeMap and fall back to the built-in
  offline map.
