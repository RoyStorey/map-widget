# Putting Atlas lessons in a course (e.g. Cornerstone Academy)

## 1. Host the player

```bash
npm run build
```

Upload `dist/` to any static host, such as Netlify, Vercel, GitHub Pages, S3 or your own server. Lessons live
in `dist/lessons/` (copied from `public/lessons/`). To add one later, drop a new JSON file there; you don't
need to rebuild.

## 2. Embed a lesson

```html
<iframe src="https://YOUR-HOST/lesson.html?lesson=lessons/d-day-1944.json&id=wwii-unit3"
        title="D-Day – interactive map" width="100%" height="640"
        style="border:0;border-radius:12px" allow="fullscreen" loading="lazy"></iframe>
```

**Useful options**

| Option | Effect |
|---|---|
| `&mode=explore` | free exploration instead of the guided tour |
| `&step=N` | open at chapter N |
| `&present=1` | projector mode (big text) for teaching in class |
| `&theme=light` | light theme |
| `&globe=1` | start on the globe |
| `&story=0` | hide the story panel |
| `&title=0` | hide the title |
| `&id=…` | your own id, echoed back in every message (see below) |

If the course lives on a different site from the player, that's fine: the player only talks to its parent
page through `postMessage`.

## 3. Record progress and quiz scores (optional)

The player posts these messages to the parent page:

| `type` | When | Extra fields |
|---|---|---|
| `atlas:ready` | player loaded, waiting (only with `&wait=1`) | |
| `atlas:loaded` | lesson ready | `title`, `steps`, `questions` |
| `atlas:progress` | student opens a chapter | `step`, `of`, `title` |
| `atlas:quiz` | student answers a question | `step`, `question`, `correct`, `chosen` or `distanceKm`, `score` |
| `atlas:complete` | student reaches the end | `score: { right, answered, asked }` |

Every message also carries `lesson` (the `lesson=` file) and `embedId` (your `&id=`).

```html
<script>
  window.addEventListener('message', (e) => {
    if (e.origin !== 'https://YOUR-HOST') return;          // only trust your player
    const m = e.data;
    if (!m || typeof m.type !== 'string' || !m.type.startsWith('atlas:')) return;
    if (m.type === 'atlas:complete') {
      // e.g. save to your backend
      fetch('/api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson: m.lesson, embed: m.embedId, right: m.score.right, asked: m.score.asked }) });
    }
  });
</script>
```

## 4. Load a lesson from your own data (optional)

For lessons stored in your database instead of as files, open `lesson.html?wait=1`. Wait for `atlas:ready`,
then send the lesson JSON:

```js
const frame = document.querySelector('iframe');
window.addEventListener('message', (e) => {
  if (e.data?.type === 'atlas:ready') frame.contentWindow.postMessage({ type: 'atlas', id: 1, method: 'loadLesson', args: [lessonJson] }, '*');
  if (e.data?.type === 'atlas:result' && e.data.error) console.error(e.data.error);   // validation report
});
```

There's also a no-hosting option: the editor's **Story → Embed in course…** packs the whole lesson into the
URL (`lesson.html#lesson=…`).

## 5. Have an AI agent write lessons

Point an agent (such as Claude Code in this repository) at [`AGENTS.md`](../AGENTS.md). For example:

> Make a lesson on the Battle of Tours (732) for grade 8, with 6 chapters and 3 questions, and give me the embed code.

The agent writes `public/lessons/<slug>.json` and runs `npm run lesson:check` until it's clean. It then
screenshots a few chapters and hands back the iframe. The skill in `.claude/skills/history-map-lesson/`
loads automatically in Claude Code.

## 6. Classroom extras

- **Printable worksheet:** the ⤓ button in the player makes a page per chapter with a map snapshot, text,
  questions, note lines and an answer key. Use *Print → Save as PDF*.
- **Projector mode:** the 👁 button, the **B** key or `&present=1`.
- **Read aloud:** the speaker button on each chapter reads it aloud with the browser's text-to-speech.
- **Keyboard:** ← / → change chapter, Space plays, F is full screen, and the timeline slider takes arrow keys,
  Home and End.
