/**
 * Incremental ownership timeline.
 *
 * Given a set of keyed ownership-change events, maintains the owner of every
 * key at a "current time". Seeking forward/backward only touches the events
 * between the old and new time, so scrubbing and playback are O(Δevents)
 * rather than O(keys). Each event remembers the owner it replaced so seeking
 * backwards is an exact undo.
 */
export interface OwnershipEventInput {
  key: string;
  t: number;
  owner: number; // -1 = unowned
}

export class OwnershipTimeline {
  keys: string[] = [];
  keyIndex = new Map<string, number>();
  owner = new Int16Array(0);
  /** Time at which the key last changed owner (−Infinity if never). */
  changedAt = new Float64Array(0);
  /** Count of keys owned per owner index at current time. */
  counts: number[] = [];

  private evT = new Float64Array(0);
  private evKey = new Int32Array(0);
  private evOwner = new Int16Array(0);
  private evPrev = new Int16Array(0);
  private evPrevT = new Float64Array(0);
  private cursor = 0; // events [0, cursor) are applied
  time = -Infinity;
  version = 0;
  ownerCount = 0;

  get eventCount(): number {
    return this.evT.length;
  }

  build(events: OwnershipEventInput[], ownerCount: number, extraKeys: Iterable<string> = []): void {
    this.ownerCount = ownerCount;
    const keyIndex = new Map<string, number>();
    const keys: string[] = [];
    const addKey = (k: string) => {
      let i = keyIndex.get(k);
      if (i === undefined) {
        i = keys.length;
        keys.push(k);
        keyIndex.set(k, i);
      }
      return i;
    };
    for (const k of extraKeys) addKey(k);
    // stable sort by time
    const order = events.map((_, i) => i);
    order.sort((a, b) => events[a].t - events[b].t || a - b);
    const n = events.length;
    const evT = new Float64Array(n);
    const evKey = new Int32Array(n);
    const evOwner = new Int16Array(n);
    const evPrev = new Int16Array(n);
    const evPrevT = new Float64Array(n);
    for (let j = 0; j < n; j++) {
      const e = events[order[j]];
      evT[j] = e.t;
      evKey[j] = addKey(e.key);
      evOwner[j] = e.owner;
    }
    // compute previous owners by a forward sweep
    const state = new Int16Array(keys.length).fill(-1);
    const stateT = new Float64Array(keys.length).fill(-Infinity);
    for (let j = 0; j < n; j++) {
      const k = evKey[j];
      evPrev[j] = state[k];
      evPrevT[j] = stateT[k];
      state[k] = evOwner[j];
      stateT[k] = evT[j];
    }
    this.keys = keys;
    this.keyIndex = keyIndex;
    this.evT = evT;
    this.evKey = evKey;
    this.evOwner = evOwner;
    this.evPrev = evPrev;
    this.evPrevT = evPrevT;
    this.owner = new Int16Array(keys.length).fill(-1);
    this.changedAt = new Float64Array(keys.length).fill(-Infinity);
    this.counts = new Array(ownerCount).fill(0);
    this.cursor = 0;
    const t = this.time;
    this.time = -Infinity;
    this.version++;
    if (Number.isFinite(t)) this.seek(t);
  }

  /** Move to time t. Returns true if any ownership changed. */
  seek(t: number): boolean {
    const { evT, evKey, evOwner, evPrev, evPrevT, owner, changedAt, counts } = this;
    let changed = false;
    let c = this.cursor;
    const n = evT.length;
    // forward: apply events with time <= t
    while (c < n && evT[c] <= t) {
      const k = evKey[c];
      const prev = owner[k];
      const next = evOwner[c];
      if (prev >= 0) counts[prev]--;
      if (next >= 0) counts[next]++;
      owner[k] = next;
      changedAt[k] = evT[c];
      if (prev !== next) changed = true;
      c++;
    }
    // backward: undo events with time > t
    while (c > 0 && evT[c - 1] > t) {
      c--;
      const k = evKey[c];
      const cur = owner[k];
      const prev = evPrev[c];
      if (cur >= 0) counts[cur]--;
      if (prev >= 0) counts[prev]++;
      owner[k] = prev;
      changedAt[k] = evPrevT[c];
      if (cur !== prev) changed = true;
    }
    this.cursor = c;
    this.time = t;
    if (changed) this.version++;
    return changed;
  }

  /** Time of the next event strictly after t (or null). */
  nextEventTime(t: number): number | null {
    const i = upperBound(this.evT, t);
    return i < this.evT.length ? this.evT[i] : null;
  }

  prevEventTime(t: number): number | null {
    const i = lowerBound(this.evT, t) - 1;
    return i >= 0 ? this.evT[i] : null;
  }

  timeExtent(): [number, number] | null {
    const n = this.evT.length;
    return n ? [this.evT[0], this.evT[n - 1]] : null;
  }

  /**
   * Owner counts sampled at `samples` evenly spaced times in [t0, t1].
   * Returns counts[sample][owner]. Single O(events) sweep.
   */
  sampleCounts(t0: number, t1: number, samples: number): Int32Array[] {
    const out: Int32Array[] = [];
    const state = new Int16Array(this.keys.length).fill(-1);
    const counts = new Int32Array(this.ownerCount);
    const { evT, evKey, evOwner } = this;
    let c = 0;
    for (let s = 0; s < samples; s++) {
      const t = t0 + ((t1 - t0) * s) / Math.max(1, samples - 1);
      while (c < evT.length && evT[c] <= t) {
        const k = evKey[c];
        const prev = state[k];
        const next = evOwner[c];
        if (prev >= 0 && prev < counts.length) counts[prev]--;
        if (next >= 0 && next < counts.length) counts[next]++;
        state[k] = next;
        c++;
      }
      out.push(counts.slice());
    }
    return out;
  }
}

/**
 * Sum of key weights owned per owner at `samples` times (single sweep).
 * Used for area-weighted charts (e.g. countries weighted by km²).
 */
export function sampleWeighted(tl: OwnershipTimeline, t0: number, t1: number, samples: number, weight: (keyIndex: number) => number): Float64Array[] {
  const out: Float64Array[] = [];
  const state = new Int16Array(tl.keys.length).fill(-1);
  const sums = new Float64Array(tl.ownerCount);
  const w = new Float64Array(tl.keys.length);
  for (let i = 0; i < w.length; i++) w[i] = weight(i);
  const { evT, evKey, evOwner } = tl as any;
  let c = 0;
  for (let s = 0; s < samples; s++) {
    const t = t0 + ((t1 - t0) * s) / Math.max(1, samples - 1);
    while (c < evT.length && evT[c] <= t) {
      const k = evKey[c];
      const prev = state[k];
      const next = evOwner[c];
      if (prev >= 0 && prev < sums.length) sums[prev] -= w[k];
      if (next >= 0 && next < sums.length) sums[next] += w[k];
      state[k] = next;
      c++;
    }
    out.push(sums.slice());
  }
  return out;
}

export function upperBound(arr: ArrayLike<number>, v: number): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (arr[m] <= v) lo = m + 1;
    else hi = m;
  }
  return lo;
}

export function lowerBound(arr: ArrayLike<number>, v: number): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (arr[m] < v) lo = m + 1;
    else hi = m;
  }
  return lo;
}
