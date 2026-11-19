import { emptyScenario, type Scenario } from '../core/scenario';
import { paletteColor } from '../core/color';

export async function buildBlankDemo(): Promise<Scenario> {
  const s = emptyScenario({ title: 'Blank world', start: 1900, end: 2000, speed: 100 / 60, eventDuration: 3, h3Resolution: 3, view: { center: [15, 30], zoom: 1.8 } });
  s.factions = ['Azure', 'Crimson', 'Verdant', 'Gold'].map((name, i) => ({ id: `f${i}`, name, color: paletteColor([3, 0, 1, 2][i]) }));
  return s;
}
