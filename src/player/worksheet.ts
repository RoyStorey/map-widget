/**
 * Printable worksheet for a lesson: cover, one section per chapter with a map
 * image, the text, the question (with answer boxes) and note lines, followed by
 * an answer key and the sources.
 */
import type { MapWidget } from '../widget/MapWidget';
import { formatTime, precisionForSpan } from '../core/time';
import { esc, toast } from '../ui/dom';
import { captureImage, mapIdle } from '../io/export';

export async function printWorksheet(w: MapWidget, md: (s: string) => string, onProgress: (msg: string | null) => void): Promise<void> {
  const sc = w.scenario;
  const steps = sc.story;
  if (!steps.length) return toast('This lesson has no chapters to print', 'warn');
  // open the window first (pop-up blockers only allow it straight after a click)
  const win = window.open('', '_blank');
  const saved = { time: w.time, cam: w.currentCamera(), director: w.settings.director, playing: w.playing };
  w.pause();
  w.updateSettings({ director: false });
  const prec = precisionForSpan(w.span);
  const images: string[] = [];
  try {
    for (let i = 0; i < steps.length; i++) {
      onProgress(`Preparing worksheet… map ${i + 1} of ${steps.length}`);
      const st = steps[i];
      const end = st.end ?? sc.meta.end;
      w.setTime(st.t + (end - st.t) * 0.85);
      if (st.view) w.map.jumpTo({ center: st.view.center, zoom: st.view.zoom, bearing: st.view.bearing ?? 0, pitch: Math.min(st.view.pitch ?? 0, 30) });
      await new Promise((r) => setTimeout(r, 250));
      await mapIdle(w, 3500);
      images.push(await captureImage(w, 900));
    }
  } finally {
    w.setTime(saved.time);
    w.map.jumpTo(saved.cam);
    w.updateSettings({ director: saved.director });
    onProgress(null);
  }
  const L = (k: number) => String.fromCharCode(65 + k);
  const sections = steps
    .map((st, i) => {
      const q = st.question;
      const qHtml = !q
        ? ''
        : q.locate
          ? `<div class="q"><b>Question ${i + 1}.</b> ${esc(q.prompt)}<div class="hint">Mark the place on the map above with an ✗.</div></div>`
          : `<div class="q"><b>Question ${i + 1}.</b> ${esc(q.prompt)}<ol type="A">${q.choices.map((c) => `<li><span class="box"></span>${esc(c)}</li>`).join('')}</ol></div>`;
      return `<section><div class="kicker">Chapter ${i + 1} · ${esc(formatTime(st.t, prec))}</div><h2>${esc(st.title)}</h2>
        <img src="${images[i]}" alt="Map for chapter ${i + 1}">${md(st.text)}${qHtml}
        <div class="notes"><div></div><div></div><div></div></div></section>`;
    })
    .join('\n');
  const key = steps
    .map((st, i) => (st.question ? `<li><b>${i + 1}.</b> ${st.question.locate ? `Near ${st.question.locate[1].toFixed(2)}°, ${st.question.locate[0].toFixed(2)}° (within ${st.question.radiusKm ?? '?'} km)` : `${L(st.question.answer)} – ${esc(st.question.choices[st.question.answer])}`}${st.question.explain ? ` <i>${esc(st.question.explain)}</i>` : ''}</li>` : ''))
    .join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(sc.meta.title)} – worksheet</title>
<style>
  body { font: 11.5pt/1.5 Georgia, 'Times New Roman', serif; color: #111; max-width: 760px; margin: 24px auto; padding: 0 20px; }
  h1 { font-size: 22pt; margin: 0 0 4px; } h2 { font-size: 15pt; margin: 2px 0 8px; }
  .meta { color: #555; margin-bottom: 14px; } .name { margin: 14px 0 22px; } .name span { display: inline-block; width: 220px; border-bottom: 1px solid #999; margin-right: 24px; }
  section { break-inside: avoid; page-break-inside: avoid; margin: 0 0 26px; padding-top: 6px; border-top: 1px solid #ddd; }
  .kicker { font: 600 9pt/1 system-ui, sans-serif; text-transform: uppercase; letter-spacing: 1px; color: #8a5a00; margin-top: 10px; }
  img { width: 100%; border: 1px solid #ccc; border-radius: 4px; margin: 4px 0 8px; }
  .q { background: #f6f3ea; border-radius: 6px; padding: 8px 12px; margin: 8px 0; } .q ol { margin: 6px 0 0; padding-left: 22px; } .q li { margin: 3px 0; }
  .box { display: inline-block; width: 11px; height: 11px; border: 1.3px solid #333; margin-right: 8px; vertical-align: -1px; }
  .hint { color: #666; font-style: italic; }
  .notes div { border-bottom: 1px solid #bbb; height: 26px; }
  .key { break-before: page; page-break-before: always; } .key li { margin: 4px 0; } .src { color: #444; font-size: 10pt; }
  @media print { body { margin: 0 auto; } .noprint { display: none; } }
</style></head><body>
<div class="noprint" style="text-align:right"><button onclick="print()">Print</button></div>
<h1>${esc(sc.meta.title)}</h1><div class="meta">${esc(sc.meta.audience ?? '')}</div>
<div class="name">Name <span></span> Date <span style="width:120px"></span></div>
${sc.meta.description ? md(sc.meta.description) : ''}
${sections}
<div class="key"><h2>Answer key</h2><ol style="list-style:none;padding:0">${key || '<li>No questions in this lesson.</li>'}</ol>
${sc.meta.sources?.length ? `<h2>Sources</h2><ul class="src">${sc.meta.sources.map((s) => `<li>${md(s)}</li>`).join('')}</ul>` : ''}</div>
</body></html>`;
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = `${sc.meta.title.replace(/\W+/g, '-').toLowerCase()}-worksheet.html`;
    a.click();
    toast('Pop-ups are blocked – the worksheet was downloaded instead', 'info', 4000);
  }
}
