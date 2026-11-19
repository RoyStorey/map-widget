/**
 * Battle of Waterloo, 18 June 1815, 11:00–21:30 — Hougoumont, d'Erlon's attack,
 * the cavalry charges, La Haye Sainte, the Prussian arrival at Plancenoit and
 * the repulse of the Imperial Guard. Approximate and illustrative.
 */
import { buildKit, cam, ev, march, T, type KitRegion } from './kit';
import type { LonLat } from '../core/geo';
import type { Scenario } from '../core/scenario';

const H = (hm: string) => `1815-06-18T${hm}`;
const t = (hm: string) => T(H(hm));

const F = [
  { id: 'uk', name: 'Anglo-Allied army (Wellington)', color: '#e03131' },
  { id: 'pr', name: 'Prussian army (Blücher)', color: '#343a40' },
  { id: 'fr', name: 'French Armée du Nord', color: '#1c7ed6' },
];

const P = {
  hougoumont: [4.393, 50.672] as LonLat, lhs: [4.413, 50.686] as LonLat, papelotte: [4.43, 50.687] as LonLat, plancenoit: [4.452, 50.661] as LonLat,
  belleAlliance: [4.414, 50.673] as LonLat, ridge: [4.408, 50.69] as LonLat, wavre: [4.607, 50.717] as LonLat, rossomme: [4.408, 50.664] as LonLat,
};

const REGIONS: KitRegion[] = [
  { name: 'Hougoumont', ring: [[4.388, 50.676], [4.399, 50.676], [4.399, 50.668], [4.388, 50.668]], native: 'uk' },
  { name: 'La Haye Sainte', ring: [[4.41, 50.688], [4.417, 50.688], [4.417, 50.684], [4.41, 50.684]], native: 'uk', phases: [['fr', H('18:20'), H('18:40'), [4.413, 50.684]], ['uk', H('20:00'), H('20:15')]] },
  { name: 'Mont-Saint-Jean ridge', ring: [[4.375, 50.70], [4.445, 50.70], [4.445, 50.684], [4.375, 50.682]], native: 'uk' },
  { name: 'Papelotte & the east', ring: [[4.425, 50.692], [4.46, 50.692], [4.46, 50.678], [4.425, 50.678]], native: 'uk', phases: [['fr', H('18:30'), H('19:00'), [4.425, 50.68]], ['pr', H('19:30'), H('20:00'), [4.46, 50.69]]] },
  { name: 'Plancenoit', ring: [[4.44, 50.668], [4.465, 50.668], [4.465, 50.654], [4.44, 50.654]], native: 'fr', phases: [['pr', H('17:30'), H('18:30'), [4.465, 50.665]], ['fr', H('19:00'), H('19:20'), [4.44, 50.66]], ['pr', H('20:00'), H('21:00'), [4.465, 50.665]]] },
  { name: 'French positions', ring: [[4.375, 50.682], [4.425, 50.684], [4.425, 50.678], [4.465, 50.678], [4.465, 50.652], [4.375, 50.652]], native: 'fr', phases: [['uk', H('20:05'), H('21:15'), [4.41, 50.684]]] },
  { name: 'Paris wood & the Lasne', ring: [[4.445, 50.70], [4.52, 50.71], [4.52, 50.67], [4.465, 50.668], [4.46, 50.692], [4.445, 50.692]], native: null, phases: [['pr', H('16:00'), H('17:30'), [4.52, 50.69]]] },
];

const UNITS = [
  march('reille', 'II Corps (Reille) — Hougoumont', 'fr', [[[4.40, 50.664], H('11:20')], [[4.396, 50.669], H('11:35')], [[4.395, 50.671], H('19:30')], [[4.40, 50.664], H('20:30')]], 'army', 13000),
  march('derlon', 'I Corps (d’Erlon)', 'fr', [[[4.425, 50.675], H('13:30')], [[4.42, 50.684], H('13:55')], [[4.425, 50.677], H('14:30')], [[4.425, 50.677], H('18:00')], [[4.423, 50.683], H('18:30')], [[4.425, 50.672], H('20:30')]], 'army', 16000),
  march('ney', 'Ney’s cavalry charges', 'fr', [[[4.405, 50.676], H('16:00')], [[4.403, 50.687], H('16:15')], [[4.405, 50.678], H('16:40')], [[4.402, 50.688], H('17:00')], [[4.405, 50.678], H('17:20')], [[4.403, 50.688], H('17:40')], [[4.406, 50.676], H('18:00')]], 'army', 9000),
  march('lobau', 'VI Corps (Lobau)', 'fr', [[[4.42, 50.668], H('15:30')], [[4.445, 50.666], H('16:30')], [[4.448, 50.662], H('19:00')], [[4.43, 50.655], H('20:30')]], 'army', 10000),
  march('guard', 'Imperial Guard', 'fr', [[P.rossomme, H('11:00')], [[4.412, 50.668], H('19:00')], [[4.407, 50.683], H('19:35')], [[4.41, 50.676], H('19:55')], [[4.415, 50.66], H('20:40')]], 'army', 13000),
  march('youngguard', 'Young Guard to Plancenoit', 'fr', [[P.rossomme, H('17:45')], [[4.448, 50.661], H('18:30')], [[4.448, 50.661], H('20:15')], [[4.43, 50.65], H('21:00')]], 'army', 4000),
  march('union', 'Union Brigade (Scots Greys) charge', 'uk', [[[4.418, 50.691], H('14:00')], [[4.422, 50.683], H('14:08')], [[4.425, 50.675], H('14:18')], [[4.42, 50.69], H('14:45')]], 'army', 2600),
  march('wellington', 'Wellington', 'uk', [[P.ridge, H('11:00')], [[4.405, 50.689], H('19:30')], [[4.41, 50.68], H('20:15')], [P.belleAlliance, H('21:15')]], 'other', 1),
  march('allied-advance', 'General advance', 'uk', [[[4.41, 50.69], H('20:00')], [[4.412, 50.676], H('20:30')], [[4.414, 50.665], H('21:15')]], 'army', 45000),
  march('bulow', 'IV Corps (Bülow)', 'pr', [[[4.6, 50.715], H('10:00')], [[4.49, 50.70], H('13:00')], [[4.475, 50.675], H('16:30')], [P.plancenoit, H('18:00')], [P.plancenoit, H('20:00')], [[4.43, 50.655], H('21:15')]], 'army', 30000),
  march('zieten', 'I Corps (Zieten)', 'pr', [[[4.55, 50.725], H('14:00')], [[4.47, 50.70], H('18:00')], [P.papelotte, H('19:30')], [[4.42, 50.672], H('20:45')]], 'army', 20000),
  march('napoleon', 'Napoleon', 'fr', [[P.rossomme, H('11:00')], [P.belleAlliance, H('19:00')], [[4.43, 50.63], H('21:00')]], 'other', 1),
];

const fire = (from: LonLat, to: LonLat, a: string, b: string, label: string, color: string, value = 10) => ({ from, to, start: t(a), end: t(b), label, color, value });
const FLOWS = [
  fire([4.418, 50.678], [4.418, 50.689], '13:00', '13:40', 'Grand Battery (80 guns)', '#ffd43b', 16),
  fire([4.41, 50.679], [4.405, 50.69], '15:00', '18:00', 'French artillery on the ridge', '#ffd43b', 10),
  fire([4.4, 50.688], [4.396, 50.672], '11:30', '19:30', 'Allied guns support Hougoumont', '#ff8787', 8),
  fire([4.41, 50.689], [4.41, 50.678], '16:00', '18:00', 'Allied artillery fires on the cavalry', '#ff8787', 10),
  fire([4.47, 50.675], [4.45, 50.662], '16:30', '20:30', 'Prussian guns on Plancenoit', '#adb5bd', 10),
  fire([4.405, 50.689], [4.407, 50.683], '19:35', '19:50', 'Volleys break the Guard', '#ff8787', 14),
];

const EVENTS = [
  ev(H('11:30'), P.hougoumont, 'Attack on Hougoumont', 'battle', 'A diversion that draws in a whole French corps for the rest of the day.', { zoom: 15.5 }),
  ev(H('13:00'), [4.418, 50.679], 'The Grand Battery opens fire', 'battle', 'Some 80 guns bombard the Allied centre.'),
  ev(H('13:30'), [4.42, 50.684], 'd’Erlon’s attack', 'battle', 'Four infantry divisions advance in massive columns.'),
  ev(H('14:05'), [4.422, 50.683], 'Charge of the Union Brigade', 'battle', 'The Scots Greys break d’Erlon’s columns — then are cut to pieces.'),
  ev(H('16:00'), [4.403, 50.687], 'Ney’s cavalry charges', 'battle', 'Thousands of horsemen break against the Allied infantry squares.'),
  ev(H('16:30'), [4.47, 50.675], 'The Prussians arrive', 'note', 'Bülow’s corps emerges from the Bois de Paris.'),
  ev(H('18:30'), P.lhs, 'La Haye Sainte falls', 'siege', 'The King’s German Legion runs out of ammunition.', { zoom: 15.5 }),
  ev(H('19:35'), [4.407, 50.683], 'The Imperial Guard attacks', 'battle', '“La Garde recule!” — the Guard is repulsed.'),
  ev(H('20:00'), [4.41, 50.685], 'General advance', 'battle', 'Wellington waves his hat; the Allied line advances.'),
  ev(H('21:15'), P.belleAlliance, 'Wellington and Blücher meet', 'treaty', 'At La Belle Alliance, as the French army disintegrates.'),
];

export async function buildWaterlooDemo(): Promise<Scenario> {
  return buildKit({
    title: 'Battle of Waterloo',
    description: '18 June 1815, from the first shots at Hougoumont to the meeting of Wellington and Blücher. Approximate and illustrative.',
    start: H('10:30'),
    end: H('21:45'),
    res: 10,
    basemap: 'ofm-liberty',
    view: { center: [4.42, 50.677], zoom: 13.5, pitch: 40 },
    utcOffsetHours: 0.3,
    settings: { terminator: true, territoryOpacity: 0.5 },
    runSeconds: 150,
    eventFraction: 0.03,
    factions: F,
    regions: REGIONS,
    units: UNITS,
    events: EVENTS,
    flows: FLOWS,
    eras: [
      { name: 'Hougoumont', start: t('11:30'), end: t('19:30'), color: '#ffa8a8' },
      { name: 'Cavalry charges', start: t('16:00'), end: t('18:00'), color: '#74c0fc' },
      { name: 'Prussians engaged', start: t('16:30'), end: t('21:30'), color: '#adb5bd' },
    ],
    annotations: [
      { text: 'Hougoumont', position: [4.393, 50.6745], units: 'pixels', size: 12, color: '#ffffff' },
      { text: 'La Haye Sainte', position: [4.415, 50.6875], units: 'pixels', size: 12, color: '#ffffff' },
      { text: 'Plancenoit', position: [4.452, 50.6635], units: 'pixels', size: 12, color: '#ffffff' },
      { text: 'La Belle Alliance', position: [4.414, 50.6715], units: 'pixels', size: 12, color: '#ffffff' },
      { text: 'Mont-Saint-Jean', position: [4.405, 50.695], units: 'pixels', size: 12, color: '#ffffff' },
    ],
    camera: [
      cam(H('10:30'), [4.43, 50.68], 12.8, 30),
      cam(H('11:35'), P.hougoumont, 15.2, 55),
      cam(H('13:10'), [4.418, 50.683], 14.4, 50),
      cam(H('14:10'), [4.422, 50.682], 15.0, 55),
      cam(H('16:10'), [4.405, 50.684], 14.8, 55, -15),
      cam(H('16:40'), [4.46, 50.672], 14.0, 45, 25),
      cam(H('18:35'), P.lhs, 15.4, 55),
      cam(H('19:40'), [4.408, 50.682], 15.0, 55),
      cam(H('20:20'), [4.42, 50.675], 13.8, 45),
      cam(H('21:15'), P.belleAlliance, 14.6, 50),
      cam(H('21:45'), [4.42, 50.677], 13.2, 30),
    ],
  });
}
