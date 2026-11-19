---
name: history-map-lesson
description: Create an interactive, embeddable history map lesson (battle, conquest, siege, voyage, trade route or war) with a draggable timeline, guided story chapters and quiz questions, in the atlas-lesson@1 JSON format. Use when asked to make, write, add or fix a map / lesson / interactive timeline for a history topic or course.
---

# Make a history map lesson

Follow `AGENTS.md` at the repository root. It holds the full format reference, the rules and a template. In short:

1. **Plan.** Pick the scope (`detail`: world / continent / region / city / battlefield), the sides, 6–15 dated key
   moments, territory changes and troop or ship movements. Plan 5–8 story chapters, and add a multiple-choice
   question to about half of them.
2. **Write** `public/lessons/<slug>.json` with `"format": "atlas-lesson@1"` and
   `"$schema": "../atlas-lesson.schema.json"`.
   - Give places as gazetteer names (`docs/places.md`) or `[longitude, latitude]`, longitude first.
   - Give times as years, "500 BCE" or ISO dates.
3. **Validate** until it shows no `✗` errors:
   ```bash
   npm run lesson:check -- public/lessons/<slug>.json
   ```
4. **Register** the lesson in `public/lessons/index.json`.
5. **Preview** if a browser is available. Run `npm run dev`, then open
   `/lesson.html?lesson=lessons/<slug>.json&step=N` and screenshot two or three chapters to check the camera
   views and that territory looks right.
6. **Deliver.** Report the lesson URL and an `<iframe>` embed snippet (template in AGENTS.md), plus a one-line
   summary of the chapters and questions.

Quality bar:
- Historically accurate dates and places.
- Chapters explain causes and consequences in 60–120 words each.
- Questions test understanding and carry an `explain`.
- Sources are listed.
- Perspectives are balanced, including those of the people affected.
