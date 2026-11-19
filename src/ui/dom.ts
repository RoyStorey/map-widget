/** Minimal DOM helpers – no framework, no virtual DOM. */
type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, any> & { class?: string; style?: string | Partial<CSSStyleDeclaration> };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') typeof v === 'string' ? (el.style.cssText = v) : Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k in el && k !== 'list' && k !== 'form') (el as any)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: Element, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : String(c));
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Inline SVG icon (Lucide-style strokes). */
export function icon(name: keyof typeof ICONS, size = 18): HTMLElement {
  const span = document.createElement('span');
  span.className = 'ico';
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  return span;
}

export const ICONS = {
  play: '<polygon points="6 4 20 12 6 20 6 4" fill="currentColor"/>',
  pause: '<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>',
  skipBack: '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>',
  skipFwd: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>',
  stepBack: '<polyline points="15 18 9 12 15 6"/>',
  stepFwd: '<polyline points="9 18 15 12 9 6"/>',
  loop: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  pointer: '<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>',
  brush: '<path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>',
  eraser: '<path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L14.6 1.6c.8-.8 2-.8 2.8 0l4.9 4.9c.8.8.8 2 0 2.8L11 20"/><line x1="18" y1="13" x2="11" y2="6"/>',
  wave: '<path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M2 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M2 6c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  army: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>',
  ship: '<path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
  hexagon: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
  ruler: '<path d="M21.3 8.7 8.7 21.3c-1 1-2.5 1-3.4 0l-2.6-2.6c-1-1-1-2.5 0-3.4L15.3 2.7c1-1 2.5-1 3.4 0l2.6 2.6c1 1 1 2.5 0 3.4Z"/><path d="m7.5 10.5 2 2"/><path d="m10.5 7.5 2 2"/><path d="m13.5 4.5 2 2"/><path d="m4.5 13.5 2 2"/>',
  arc: '<path d="M3 18c0-8 6-12 9-12s9 4 9 12"/><circle cx="3" cy="18" r="2"/><circle cx="21" cy="18" r="2"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  command: '<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  undo: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  redo: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  film: '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>',
  maximize: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  sidebar: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="15" y1="3" x2="15" y2="21"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  crosshair: '<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  sparkle: '<path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/>',
} as const;

// ------------------------------------------------------------------ toasts

let toastHost: HTMLElement | null = null;
export function toast(message: string, kind: 'info' | 'success' | 'warn' | 'error' = 'info', timeout = 2600): void {
  if (!toastHost) {
    toastHost = h('div', { class: 'mw-toasts' });
    document.body.append(toastHost);
  }
  const el = h('div', { class: `mw-toast ${kind}` }, message);
  toastHost.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, timeout);
}

// ------------------------------------------------------------------ modal forms

export type Field =
  | { key: string; label: string; type: 'text' | 'textarea' | 'time' | 'color' | 'url'; value?: string; placeholder?: string; hint?: string }
  | { key: string; label: string; type: 'number' | 'range'; value?: number; min?: number; max?: number; step?: number; hint?: string }
  | { key: string; label: string; type: 'select'; value?: string; options: { value: string; label: string }[]; hint?: string }
  | { key: string; label: string; type: 'checkbox'; value?: boolean; hint?: string };

export interface ModalOptions {
  title: string;
  description?: string;
  fields?: Field[];
  body?: HTMLElement;
  submitLabel?: string;
  cancelLabel?: string | null;
  wide?: boolean;
}

/** Show a modal form; resolves with the values or null if cancelled. */
export function modal(opts: ModalOptions): Promise<Record<string, any> | null> {
  return new Promise((resolve) => {
    const inputs = new Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>();
    const form = h('form', { class: 'mw-form' });
    for (const f of opts.fields ?? []) {
      let input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (f.type === 'select') {
        input = h('select', null, ...f.options.map((o) => h('option', { value: o.value, selected: o.value === f.value }, o.label)));
      } else if (f.type === 'textarea') {
        input = h('textarea', { rows: 4, placeholder: f.placeholder ?? '' }, f.value ?? '');
      } else if (f.type === 'checkbox') {
        input = h('input', { type: 'checkbox', checked: !!f.value });
      } else if (f.type === 'number' || f.type === 'range') {
        input = h('input', { type: f.type, value: String(f.value ?? ''), min: f.min, max: f.max, step: f.step ?? 'any' });
      } else {
        input = h('input', { type: f.type === 'time' ? 'text' : f.type, value: f.value ?? '', placeholder: (f as any).placeholder ?? '' });
      }
      inputs.set(f.key, input);
      const out = f.type === 'range' ? h('output', null, String(f.value ?? '')) : null;
      if (out) input.addEventListener('input', () => (out.textContent = input.value));
      form.append(
        h('label', { class: `mw-field ${f.type}` }, h('span', { class: 'lbl' }, f.label), input, out, f.hint ? h('small', { class: 'hint' }, f.hint) : null),
      );
    }
    if (opts.body) form.append(opts.body);
    const close = (v: Record<string, any> | null) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
      resolve(v);
    };
    const submit = () => {
      const out: Record<string, any> = {};
      for (const f of opts.fields ?? []) {
        const el = inputs.get(f.key)!;
        if (f.type === 'checkbox') out[f.key] = (el as HTMLInputElement).checked;
        else if (f.type === 'number' || f.type === 'range') out[f.key] = el.value === '' ? undefined : parseFloat(el.value);
        else out[f.key] = el.value;
      }
      close(out);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(null);
      }
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submit();
    });
    document.addEventListener('keydown', onKey, true);
    const actions = h(
      'div',
      { class: 'mw-actions' },
      opts.cancelLabel === null ? null : h('button', { type: 'button', class: 'btn ghost', onclick: () => close(null) }, opts.cancelLabel ?? 'Cancel'),
      h('button', { type: 'button', class: 'btn primary', onclick: submit }, opts.submitLabel ?? 'OK'),
    );
    const dialog = h(
      'div',
      { class: `mw-modal ${opts.wide ? 'wide' : ''}`, role: 'dialog' },
      h('h3', null, opts.title),
      opts.description ? h('p', { class: 'muted' }, opts.description) : null,
      form,
      actions,
    );
    const overlay = h('div', { class: 'mw-overlay', onmousedown: (e: MouseEvent) => e.target === overlay && close(null) }, dialog);
    document.body.append(overlay);
    const first = form.querySelector('input,select,textarea') as HTMLElement | null;
    setTimeout(() => first?.focus(), 30);
  });
}

export function confirmDialog(title: string, description: string, submitLabel = 'Confirm'): Promise<boolean> {
  return modal({ title, description, submitLabel }).then((r) => r !== null);
}

/** Download a Blob or string as a file. */
export function download(data: Blob | string, filename: string, type = 'application/json'): void {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function pickFile(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, multiple, style: 'display:none' });
    input.addEventListener('change', () => {
      resolve([...(input.files ?? [])]);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}

/** Simple dropdown menu anchored to an element. */
export function menu(anchor: HTMLElement, items: ({ label: string; hint?: string; active?: boolean; onClick: () => void } | 'sep' | { header: string })[]): void {
  document.querySelectorAll('.mw-menu').forEach((m) => m.remove());
  const r = anchor.getBoundingClientRect();
  const m = h(
    'div',
    { class: 'mw-menu' },
    ...items.map((it) =>
      it === 'sep'
        ? h('div', { class: 'sep' })
        : 'header' in it
          ? h('div', { class: 'hdr' }, it.header)
          : h(
              'button',
              {
                class: `item ${it.active ? 'active' : ''}`,
                onclick: () => {
                  m.remove();
                  it.onClick();
                },
              },
              h('span', null, it.label),
              it.hint ? h('small', null, it.hint) : null,
            ),
    ),
  );
  document.body.append(m);
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let left = r.left, top = r.bottom + 4;
  if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 4);
  m.style.left = `${left}px`;
  m.style.top = `${top}px`;
  const off = (e: MouseEvent) => {
    if (!m.contains(e.target as Node)) {
      m.remove();
      document.removeEventListener('mousedown', off, true);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', off, true), 0);
}
