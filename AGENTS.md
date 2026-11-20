# Authoring Atlas history maps (guide for AI agents)

You are making an **interactive historical map** that a host site shows inside its own pages, such as a
Cornerstone lesson. The map illustrates one moment of that lesson: a battle, a conquest, a voyage, a trade route,
a war. Readers get a map, a **draggable timeline** and a few short **chapters** that step through what happened.

The map **supplements** the host's text. It does not teach on its own:
- Chapters are captions of 1–3 sentences.
- The explaining, the knowledge checks and the exercises stay in the host's lesson.
- There are no quiz questions in a map.

You write **one map spec** in the `atlas-map@1` format: a JSON file, or a TypeScript object in a host project. You
don't write any widget code.

```
map spec (atlas-map@1)  →  mountMap(element, spec)  from  'map-widget/embed'
```

## Workflow

1. **Read the host lesson** the map belongs to. Pick the moment where a map helps the reader most: movement,
   territory changing hands, distance, geography. Use the lesson's own names, dates and spellings, so the map and the
   text agree.
2. **Research** the 5–12 key dates, places and movements, using well-established facts. Keep dates in ISO form
   (`1066-10-14`) or as years.
3. **Write the spec.**
   - In this repository, example maps live in `public/maps/<slug>.json`. Add
     `"$schema": "../atlas-map.schema.json"` to them.
   - In a host project, use whatever place the host keeps maps. In Cornerstone that's `src/content/maps/<id>.ts`,
     typed as `MapSpec`.
4. **Validate** and fix every `✗` error. Read the `⚠` warnings too. Besides the format, the check makes sure
   armies stay on land and ships on water.
   ```bash
   npm run map:check -- public/maps/<slug>.json
   ```
   Use `--json` for machine-readable output. The messages give the JSON path and the fix, for example
   `events[3].at: Unknown place "Hastngs". Did you mean "Hastings"?`
   Hosts call `validateMap()` from `map-widget/spec` in their own checks.
5. **Preview it.** Run `npm run dev`, then open `http://localhost:5173/widget.html?map=maps/<slug>.json`. That page
   shows the widget inside an article-width column, the way a host shows it. Add `&step=3` to open chapter 3.
   Take screenshots of a few chapters to check the camera views.

## Rules that matter

**Places**
- A place is either a **name from the built-in gazetteer** (see `docs/places.md`: about 620 cities, battlefields,
  landmarks, straits and seas, with historic aliases such as Constantinople or Peking) or
  **`[longitude, latitude]`**.
- Longitude comes **first** (x, then y). London is `[-0.13, 51.5]`. The validator flags pairs that look swapped.
- Prefer names. Use coordinates for small or obscure sites.

**Times**
- Accepted forms: `1066`, `-499` (that is 500 BCE; astronomical years), `"500 BCE"`, `"Oct 1066"`, `"1066-10-14"`,
  `"1944-06-06T06:30"`.
- Everything must fall between `start` and `end`. Pad the range a little before the first and after the last event.

**`detail`** sets the map scale. It decides territory cell size and coastline precision.

| detail | use for | territory cell |
|---|---|---|
| `world` | voyages, world wars, global trade | ~12,000 km² |
| `continent` (default) | empires, multi-year conquests | ~1,800 km² |
| `region` | a campaign within a country | ~250 km² |
| `city` | sieges, city battles | ~0.7 km² |
| `battlefield` | a single battle | ~0.1 km² |

City and battlefield maps automatically use a detailed online street-style map. If it can't be reached,
they fall back to a built-in offline map.

**Zoom** (in `view`):

| zoom | shows |
|---|---|
| 1.5 | world |
| 3 | continent |
| 5 | country |
| 7 | region |
| 10–11 | city |
| 12–14 | battlefield |

`pitch` (0–60) tilts the camera for drama. Use it sparingly.

**Territories**
- An `area` is a polygon of at least 3 places, listed in order around the outline. Use `around` + `radiusKm`
  instead for a circle.
- Areas are filled with land cells only, and the coastline crops them. Rough outlines over the sea are
  therefore fine and even help.
- `owner` is who holds the area at the start. Each entry in `changes` is a takeover that spreads like a wave:
  - from `from` (default: the corner nearest the new owner's capital),
  - between `start` and `end`.
- Several changes can follow each other: conquest, reconquest, and so on.
- When areas overlap, **the first area listed wins**. So list small, specific areas before big background ones.

**`countries`** are modern countries by name (`["France", "Belgium"]`).
- They're good for the 19th–21st centuries.
- Modern borders are anachronistic for earlier periods. Use `territories` there instead.

**`moves`** are armies, fleets, ships, aircraft, caravans and explorers.
- `path` is a list of `{ "at": place, "time": when }` waypoints, with times that never go backwards.
- Repeat the same place with a later time to make a unit wait somewhere.
- **How a leg travels.** Armies, caravans and explorers go **overland**: a leg that would cross a sea or a gulf
  is routed around it. Narrow straits armies really crossed (the Bosporus, the Dardanelles, Messina, Kerch) count
  as land.
- `"bySea": true` routes every leg over water instead, around land. It knows the major canals and straits,
  including the Strait of Magellan. Use it for fleets and ships. Without it, fleets, ships and aircraft fly
  straight.
- **Real sea crossings by an army** are marked on the waypoint where the crossing ends:
  `{ "at": "Pylae", "time": "622-04", "by": "sea" }`. `"by"` can be `"land"`, `"sea"` or `"straight"`, and it
  overrides the move's default for that one leg.
- **Waypoints are the places the sources attest.** Between them the route is a reconstruction, so add the passes,
  fords and towns an army is known to have gone through.
- `npm run map:check` checks the routes. It is an error to walk to an island, and a warning when a detour is so
  long that the army must have sailed, or when a ship sails over land. Fix every one.
- `kind` sets the icon: `army`, `armor`, `fleet`, `ship`, `aircraft`, `caravan`, `explorer`.

**`routes`** are lanes with continuously animated ships, for trade routes. Ports and waypoints go in `stops`, and
`bySea` defaults to `true`.

**`events`** are dated markers (`battle`, `siege`, `founding`, `treaty`, `disaster`, `discovery`, `note`). Each
has a short `text` that pops up during playback. Use `until` to keep a marker on screen longer.

**`arrows`** are curved arcs from one place to another, such as artillery fire, invasions or migrations. They can
have a time window.

**`eras`** are named bands on the timeline. **`labels`** are map text (seas, regions, walls).

## Writing chapters

- **3–7 chapters** per map. Each chapter has:
  - a short `title`;
  - a `text` of **1–3 sentences** that says what the reader is seeing, with **bold** for key names;
  - a `time` that starts the chapter;
  - a `view` that frames the action.
- A chapter plays from its `time` until the next chapter's time, or its `until`. The camera holds that view.
  Without a `view`, it frames that chapter's events automatically.
- Views are written for a map about **1,000 px wide**. The widget zooms out automatically when it's narrower,
  such as in a 40rem reading column.
- **Match the scope of the passage the map sits in.** Cover its span of time and its events, and no more. A
  five-year passage gets a five-year map, not the whole war. Only narrate (in markers and chapters) what the lesson
  discusses. Other changes of the time may still appear as territory, so the map stays correct, but leave them
  unnarrated.
- Don't repeat the host lesson's paragraphs. Point at the map instead: "Watch the Persian armies reach the
  Bosporus while Heraclius sails for the Caucasus."
- Don't add questions. The host's knowledge checks do that job.
- Name sources in `sources`.
- Be accurate and even-handed about violence, conquest and colonialism.

## Template

```json
{
  "$schema": "../atlas-map.schema.json",
  "format": "atlas-map@1",
  "title": "The Battle of Example, 1066",
  "summary": "One or two sentences describing the map.",
  "start": "1066-09-01",
  "end": "1066-12-31",
  "detail": "region",
  "playSeconds": 120,
  "sides": [
    { "id": "a", "name": "Side A", "color": "#c92a2a", "capital": "London" },
    { "id": "b", "name": "Side B", "color": "#1c7ed6", "capital": "Rouen" }
  ],
  "territories": [
    { "name": "Contested land", "area": [[-2, 50.6], [1.4, 51.1], [1.6, 52], [-1, 52]], "owner": "a",
      "changes": [ { "side": "b", "start": "1066-10-14", "end": "1066-12-25", "from": "Hastings" } ] }
  ],
  "moves": [
    { "name": "Side B's army", "side": "b", "kind": "army", "strength": 7000,
      "path": [ { "at": "Pevensey", "time": "1066-09-28" }, { "at": "Hastings", "time": "1066-10-14" } ] },
    { "name": "Side B's fleet", "side": "b", "kind": "fleet", "bySea": true,
      "path": [ { "at": [1.63, 50.18], "time": "1066-09-27" }, { "at": "Pevensey", "time": "1066-09-28" } ] }
  ],
  "events": [
    { "title": "Battle of Hastings", "time": "1066-10-14", "at": "Hastings", "kind": "battle", "side": "b", "text": "What happened, in one or two sentences." }
  ],
  "eras": [ { "name": "Invasion", "start": "1066-09-28", "end": "1066-12-25" } ],
  "labels": [ { "text": "English Channel", "at": [-1, 50.25], "size": "medium" } ],
  "story": [
    { "title": "Setting the scene", "text": "One or two sentences on what the reader sees, with **key names** in bold.", "time": "1066-09-01",
      "view": { "center": [0.5, 51.5], "zoom": 6 } },
    { "title": "The battle", "text": "What happens on the map in this chapter.", "time": "1066-10-13", "until": "1066-10-20",
      "view": { "center": "Hastings", "zoom": 9, "pitch": 40 } }
  ],
  "sources": ["Author, Title (year)"]
}
```

## Complete examples

| File | Shows |
|---|---|
| `public/maps/norman-conquest-1066.json` | regional campaign: territory waves, armies, fleets by sea, 6 chapters |
| `public/maps/magellan-circumnavigation.json` | world voyage: sea routing, a hand-drawn strait, full trails |
| `public/maps/fall-of-constantinople-1453.json` | city siege: city detail, arrows for cannon fire, ships over land |
| `public/maps/gettysburg-1863.json` | battle hour by hour: battlefield detail, adjoining positions, three days as eras |
| `public/maps/d-day-1944.json` | invasion hour by hour: city detail, several allied sides, fleets, naval gunfire arrows |
| `public/maps/journeys-of-paul.json` | journeys: mixed land and sea legs as separate moves, sides used as journey colours, an empire backdrop |

Keep side `name`s short (they're drawn across their territory) and put the long form in `description`.
Make neighbouring `area`s share edge points, so there are no unowned gaps between the lines.

## Embedding (for the host)

```ts
import { mountMap } from 'map-widget/embed';
const handle = mountMap(element, spec, { theme: 'light' });   // spec: atlas-map@1 object, Scenario or URL
handle.destroy();                                             // on unmount
```

`docs/embedding.md` covers installing, theming, React/Next.js and the options.

## Commands

```bash
npm run dev                                  # editor at /, widget preview at /widget.html
```

```bash
npm run map:check -- public/maps/*.json
```

```bash
npm run map:schema                           # regenerate public/atlas-map.schema.json
```

```bash
npm run map:places                           # regenerate docs/places.md
```

```bash
npm run build                                # static site in dist/ (deploy anywhere)
```

```bash
npm run build:lib                            # the package (dist-lib/), built automatically on install
```
