# Authoring Atlas history-map lessons (guide for AI agents)

You are making an **interactive map lesson** for a history course: a battle, a conquest, a voyage, a trade
route, a war. Students see it in an embedded player. It has a map, a **draggable timeline**, guided story
chapters and quiz questions.

You only write **one JSON file** in the `atlas-lesson@1` format. You don't write any code.

```
public/lessons/<slug>.json   →   lesson.html?lesson=lessons/<slug>.json   →   <iframe> in the course
```

## Workflow

1. **Research the topic.** Collect 6–15 key dates, places, the sides involved, and how territory and armies
   moved. Use well-established facts. Keep dates in ISO form (`1066-10-14`) or as years.
2. **Write `public/lessons/<slug>.json`.** Start from the template below. Add
   `"$schema": "../atlas-lesson.schema.json"` so editors can check the structure.
3. **Validate** and fix every `✗` error. Read the `⚠` warnings too.
   ```bash
   npm run lesson:check -- public/lessons/<slug>.json
   ```
   Use `--json` for machine-readable output. The messages give the JSON path and the fix, for example
   `events[3].at: Unknown place "Hastngs". Did you mean "Hastings"?`
4. **Optionally list it** in `public/lessons/index.json`, which feeds the gallery shown at `lesson.html`.
5. **Preview it.** Run `npm run dev`, then open `http://localhost:5173/lesson.html?lesson=lessons/<slug>.json`.
   To check visually, take a screenshot of a few chapters (`&step=3` opens chapter 3).
6. **Give the embed code** back to the course author:
   ```html
   <iframe src="https://YOUR-HOST/lesson.html?lesson=lessons/<slug>.json" title="<Title> – interactive map"
           width="100%" height="640" style="border:0;border-radius:12px" allow="fullscreen" loading="lazy"></iframe>
   ```
   The player also accepts these URL options:

   | Option | Effect |
   |---|---|
   | `&mode=explore` | open in free exploration instead of the guided tour |
   | `&theme=light` | light theme |
   | `&step=N` | open at chapter N |
   | `&autoplay=1` | start playing immediately |
   | `&globe=1` | start on the globe |
   | `&story=0` | hide the story panel |
   | `&title=0` | hide the title |
   | `&present=1` | projector mode (big text, for a classroom screen) |

## Rules that matter

**Places**
- A place is either a **name from the built-in gazetteer** (see `docs/places.md`: about 540 cities, battlefields,
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

City and battlefield lessons automatically use a detailed online street-style map. If it can't be reached,
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
- `"bySea": true` routes each leg over water and avoids land. It knows the major canals and straits. Use it for
  ships.
- For very narrow passages, such as the Strait of Magellan, write the waypoints by hand as a separate move
  without `bySea`.
- `kind` sets the icon: `army`, `armor`, `fleet`, `ship`, `aircraft`, `caravan`, `explorer`.

**`routes`** are lanes with continuously animated ships, for trade routes. Ports and waypoints go in `stops`, and
`bySea` defaults to `true`.

**`events`** are dated markers (`battle`, `siege`, `founding`, `treaty`, `disaster`, `discovery`, `note`). Each
has a short `text` that pops up during playback. Use `until` to keep a marker on screen longer.

**`arrows`** are curved arcs from one place to another, such as artillery fire, invasions or migrations. They can
have a time window.

**`eras`** are named bands on the timeline. **`labels`** are map text (seas, regions, walls).

## Writing for students

- **5–8 story chapters** suit a 10-minute lesson. Each chapter has:
  - a clear `title`;
  - 1–3 short paragraphs (60–120 words) that explain *what happened and why it mattered*, with **bold** for key
    names and terms;
  - a `time` that starts the chapter;
  - a `view` that frames the action.
- A chapter plays from its `time` until the next chapter's time, or its `until`. The camera holds that view.
  Without a `view`, it frames that chapter's events automatically.
- Add a **question** to about half the chapters. Use 3 choices, make `answer` the 0-based index of the correct
  one, and use `explain` to correct a likely misconception.
  - Ask about cause, consequence and significance, not trivia.
  - Avoid "all of the above".
  - Keep wrong answers plausible but clearly wrong.
- **Map questions:** a question can be answered by clicking the map. Use
  `{ "prompt": "Click where William landed.", "locate": "Pevensey", "radiusKm": 40, "explain": "…" }` with no
  `choices`.
  - It's correct if the click lands within `radiusKm`. The default depends on `detail`: world 800, continent 300,
    region 60, city 2, battlefield 0.6.
  - Use one or two per lesson. They build geographic literacy.
- Write for the stated `audience`. Name sources in `sources`.
- Be accurate and even-handed about violence, conquest and colonialism. Include the perspective of the people
  conquered or affected where it's relevant.

## Template

```json
{
  "$schema": "../atlas-lesson.schema.json",
  "format": "atlas-lesson@1",
  "title": "The Battle of Example, 1066",
  "summary": "One or two sentences for the lesson card.",
  "audience": "Grade 8 · Medieval history",
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
    { "title": "Setting the scene", "text": "Who, where and why – with **key terms** in bold.", "time": "1066-09-01",
      "view": { "center": [0.5, 51.5], "zoom": 6 } },
    { "title": "The battle", "text": "What happened and why it mattered.", "time": "1066-10-13", "until": "1066-10-20",
      "view": { "center": "Hastings", "zoom": 9, "pitch": 40 },
      "question": { "prompt": "Why …?", "choices": ["Right answer", "Plausible wrong", "Plausible wrong"], "answer": 0, "explain": "Short explanation." } }
  ],
  "sources": ["Author, Title (year)"]
}
```

## Complete examples

| File | Shows |
|---|---|
| `public/lessons/norman-conquest-1066.json` | regional campaign: territory waves, armies, fleets by sea, 6 chapters |
| `public/lessons/magellan-circumnavigation.json` | world voyage: sea routing, a hand-drawn strait, full trails |
| `public/lessons/fall-of-constantinople-1453.json` | city siege: city detail, arrows for cannon fire, ships over land |
| `public/lessons/gettysburg-1863.json` | battle hour by hour: battlefield detail, adjoining positions, three days as eras |

Keep side `name`s short (they're drawn across their territory) and put the long form in `description`.
Make neighbouring `area`s share edge points, so there are no unowned gaps between the lines.

## Other ways to deliver a lesson

- **Self-contained link:** `lesson.html#lesson=<deflate-raw+base64url of the lesson JSON>`. This needs no file
  hosting. The editor's *Story → Embed in course…* dialog makes these.
- **postMessage:** the parent page sends `{ "type": "atlas", "id": 1, "method": "loadLesson", "args": [<lesson JSON>] }`
  to the iframe.
  - The player answers with `atlas:result`.
  - It also reports progress as `atlas:loaded`, `atlas:progress`, `atlas:quiz` and `atlas:complete`, which a
    course platform can store as progress and scores.
- **Editor:** open `index.html` and drop the lesson JSON onto it to refine it by hand. That gives you painting,
  drawing armies and adjusting camera views. Export it again from the Story tab.

## Commands

```bash
npm run dev                                  # editor at /, player at /lesson.html
```

```bash
npm run lesson:check -- public/lessons/*.json
```

```bash
npm run lesson:schema                        # regenerate public/atlas-lesson.schema.json
```

```bash
npm run lesson:places                        # regenerate docs/places.md
```

```bash
npm run build                                # static site in dist/ (deploy anywhere)
```
