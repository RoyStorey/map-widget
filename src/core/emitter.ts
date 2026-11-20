/** Tiny typed event emitter. */
export class Emitter<E extends Record<string, any>> {
  private handlers = new Map<keyof E, Set<(p: any) => void>>();

  on<K extends keyof E>(type: K, fn: (payload: E[K]) => void): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  once<K extends keyof E>(type: K, fn: (payload: E[K]) => void): () => void {
    const off = this.on(type, (p) => {
      off();
      fn(p);
    });
    return off;
  }

  /** Drop every handler (used when the owner is destroyed). */
  clearListeners(): void {
    this.handlers.clear();
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[emitter] handler for "${String(type)}" failed`, err);
      }
    }
  }
}
