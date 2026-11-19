import type { Layer } from '@deck.gl/core';
import type { MapWidget } from '../widget/MapWidget';

/** An interactive map tool (paint, draw, measure…). */
export interface Tool {
  id: string;
  name: string;
  icon: string;
  shortcut?: string;
  hint?: string;
  cursor?: string;
  /** Keep the render loop running while active. */
  animating?: boolean;
  suppressHover?: boolean;
  activate(w: MapWidget): void;
  deactivate(): void;
  layers?(): Layer[];
  /** Return true if the key was handled. */
  onKey?(e: KeyboardEvent): boolean;
}
