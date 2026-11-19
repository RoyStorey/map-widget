import { h } from './dom';

export interface Command {
  id: string;
  label: string;
  group?: string;
  hint?: string;
  run: () => void;
}

/** Ctrl/Cmd+K fuzzy command palette. */
export class Palette {
  private el: HTMLElement | null = null;
  private sel = 0;
  constructor(private commands: () => Command[]) {}

  get isOpen() {
    return !!this.el;
  }

  open(): void {
    if (this.el) return;
    const input = h('input', { type: 'text', placeholder: 'Type a command… (tools, basemaps, layers, export, demos)' });
    const list = h('div', { class: 'items' });
    let items: Command[] = [];
    const render = () => {
      const q = input.value.toLowerCase().trim();
      items = this.commands()
        .map((c) => ({ c, s: score(`${c.group ?? ''} ${c.label}`.toLowerCase(), q) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 60)
        .map((x) => x.c);
      this.sel = Math.min(this.sel, Math.max(0, items.length - 1));
      list.replaceChildren(
        ...items.map((c, i) =>
          h('div', { class: `it ${i === this.sel ? 'sel' : ''}`, onmousedown: (e: MouseEvent) => { e.preventDefault(); this.run(c); } },
            h('span', null, c.group ? h('span', { class: 'grp' }, c.group) : null, c.label),
            c.hint ? h('small', null, c.hint) : null,
          ),
        ),
      );
      list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
    };
    input.addEventListener('input', () => { this.sel = 0; render(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { this.sel = Math.min(items.length - 1, this.sel + 1); render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { this.sel = Math.max(0, this.sel - 1); render(); e.preventDefault(); }
      else if (e.key === 'Enter') { if (items[this.sel]) this.run(items[this.sel]); e.preventDefault(); }
      else if (e.key === 'Escape') { this.close(); e.preventDefault(); }
      e.stopPropagation();
    });
    input.addEventListener('blur', () => setTimeout(() => this.close(), 120));
    this.el = h('div', { class: 'mw-palette' }, input, list);
    document.body.append(this.el);
    render();
    input.focus();
  }

  close(): void {
    this.el?.remove();
    this.el = null;
  }

  private run(c: Command) {
    this.close();
    c.run();
  }
}

/** Subsequence fuzzy match score (0 = no match). */
function score(text: string, q: string): number {
  if (!q) return 1;
  if (text.includes(q)) return 100 - text.indexOf(q);
  let ti = 0, s = 0, streak = 0;
  for (const ch of q) {
    const i = text.indexOf(ch, ti);
    if (i < 0) return 0;
    streak = i === ti ? streak + 1 : 0;
    s += 1 + streak;
    ti = i + 1;
  }
  return s;
}
