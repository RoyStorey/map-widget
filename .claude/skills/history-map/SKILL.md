---
name: history-map
description: Create or fix an interactive historical map (battle, conquest, siege, voyage, trade route or war) with a draggable timeline and short guided chapters, in the atlas-map@1 format, to supplement a lesson in a host site such as Cornerstone. Use when asked to make, write, add or fix a map / interactive timeline for a history topic.
---

# Make a history map

Follow `AGENTS.md` at the repository root. It holds the full format reference, the rules and a template. In short:

1. **Read the host lesson** the map supports, and pick the moment a map explains best.
2. **Plan** the scope (`detail`: world / continent / region / city / battlefield), the sides, 5–12 dated key moments,
   territory changes and movements, and 3–7 chapters.
3. **Write** the spec with `"format": "atlas-map@1"`.
   - Here, that's `public/maps/<slug>.json`.
   - In a host project, follow its convention (Cornerstone: `src/content/maps/<id>.ts`).
   - Places are gazetteer names (`docs/places.md`) or `[longitude, latitude]`, longitude first. Times are years,
     "500 BCE" or ISO dates.
4. **Validate** until it shows no `✗` errors:
   ```bash
   npm run map:check -- public/maps/<slug>.json
   ```
   A host project uses its own check script, which calls `validateMap` from `map-widget/spec`.
5. **Preview** if a browser is available. Use `/widget.html?map=maps/<slug>.json&step=N` here, or the host's lesson
   page. Screenshot two or three chapters to check the camera views.

Quality bar:
- Dates and places are accurate and match the host lesson's text.
- Chapter texts are 1–3 sentences that point at what's on the map.
- There are no questions: the host does the teaching and testing.
- Sources are listed.
- Perspectives are balanced.
