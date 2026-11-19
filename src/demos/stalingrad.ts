/**
 * Battle of Stalingrad, August 1942 – February 1943: the drive to the Volga,
 * street fighting in the city, Operation Uranus, the failed relief and the
 * destruction of the 6th Army. Approximate and illustrative.
 */
import { buildKit, cam, ev, march, shuttle, type KitRegion } from './kit';
import type { LonLat } from '../core/geo';
import type { Scenario } from '../core/scenario';

const F = [
  { id: 'su', name: 'Soviet Union', color: '#e03131', capital: [44.56, 48.75] as LonLat },
  { id: 'de', name: 'Germany', color: '#495057' },
  { id: 'ro', name: 'Romania', color: '#d4a72c' },
];

const MAMAYEV: LonLat = [44.537, 48.742];
const KALACH: LonLat = [43.48, 48.69];
const PITOMNIK: LonLat = [44.08, 48.66];

const REGIONS: KitRegion[] = [
  // city, inset from the river so a thin Soviet strip survives on the bank
  { name: 'Stalingrad', ring: [[44.40, 48.86], [44.56, 48.83], [44.505, 48.735], [44.455, 48.63], [44.37, 48.53], [44.30, 48.55], [44.30, 48.70], [44.33, 48.80]],
    native: 'su', phases: [['de', '1942-09-13', '1942-11-18', [44.3, 48.62], 0.45], ['su', '1943-01-22', '1943-02-02', [44.45, 48.55]]] },
  { name: 'Volga bank', ring: [[44.56, 48.83], [44.64, 48.83], [44.57, 48.73], [44.51, 48.62], [44.43, 48.51], [44.37, 48.53], [44.455, 48.63], [44.505, 48.735]], native: 'su' },
  { name: 'Don–Volga steppe (the pocket)', ring: [[43.4, 49.05], [44.3, 49.05], [44.6, 48.86], [44.3, 48.55], [44.3, 48.45], [44.0, 48.3], [43.5, 48.4], [43.3, 48.7]],
    native: 'su', phases: [['de', '1942-08-17', '1942-09-12', [43.3, 48.9]], ['su', '1943-01-10', '1943-01-26', [43.3, 48.7]]] },
  { name: 'Northern flank', ring: [[41.5, 49.7], [43.4, 49.05], [43.3, 48.7], [42.6, 48.6], [41.5, 48.9], [40.8, 49.4]],
    native: 'su', phases: [['ro', '1942-08-01', '1942-08-20', [40.8, 49.2]], ['su', '1942-11-19', '1942-11-24', [42.5, 49.65]]] },
  { name: 'Southern flank', ring: [[43.3, 48.7], [43.5, 48.4], [44.0, 48.3], [44.3, 48.45], [44.4, 48.0], [43.6, 47.6], [42.0, 47.8], [41.5, 48.9], [42.6, 48.6]],
    native: 'su', phases: [['ro', '1942-08-05', '1942-08-28', [42, 47.8]], ['su', '1942-11-20', '1942-11-24', [44.4, 48.0]], ['de', '1942-12-12', '1942-12-19', [42.7, 47.5]], ['su', '1942-12-24', '1942-12-31', [43.6, 48.1]]] },
];

// Luftwaffe airlift: shuttles between Tatsinskaya / Morozovsk and Pitomnik
const airlift = [
  shuttle('lift1', 'Luftwaffe airlift (Tatsinskaya)', 'de', [41.27, 48.2], PITOMNIK, '1942-11-25', '1942-12-24', 12),
  shuttle('lift2', 'Luftwaffe airlift (Morozovsk)', 'de', [41.8, 48.35], PITOMNIK, '1942-11-26', '1943-01-15', 18),
];

const UNITS = [
  march('6army', '6th Army (Paulus)', 'de', [[[42.0, 49.3], '1942-08-17'], [[43.5, 48.9], '1942-08-23'], [[44.35, 48.65], '1942-09-13'], [[44.5, 48.72], '1942-10-14'], [[44.515, 48.708], '1943-01-31']], 'army', 250000),
  march('xiv', 'XIV Panzer Corps (to the Volga)', 'de', [[[43.45, 49.0], '1942-08-23T04:00'], [[44.58, 48.84], '1942-08-23T18:00'], [[44.58, 48.84], '1942-11-22']], 'armor', 20000),
  march('4pz', '4th Panzer Army (Hoth)', 'de', [[[43.0, 47.6], '1942-08-20'], [[44.35, 48.45], '1942-09-10'], [[44.3, 48.5], '1942-11-20'], [[42.8, 47.5], '1942-11-28']], 'armor', 100000),
  march('62army', '62nd Army (Chuikov)', 'su', [[[44.57, 48.76], '1942-09-12'], [[44.56, 48.75], '1943-02-02']], 'army', 54000),
  march('13gds', '13th Guards Division crosses the Volga', 'su', [[[44.62, 48.72], '1942-09-14T20:00'], [MAMAYEV, '1942-09-16']], 'army', 10000),
  march('swf', 'Southwestern Front (Vatutin)', 'su', [[[42.6, 49.6], '1942-11-19'], [[42.9, 49.25], '1942-11-20'], [KALACH, '1942-11-23']], 'armor', 400000),
  march('stf', 'Stalingrad Front (Yeryomenko)', 'su', [[[44.5, 48.0], '1942-11-20'], [[44.2, 48.2], '1942-11-21'], [[43.6, 48.4], '1942-11-22'], [[43.5, 48.66], '1942-11-23']], 'armor', 300000),
  march('winterstorm', 'Operation Winter Storm (relief)', 'de', [[[42.7, 47.4], '1942-12-12'], [[43.3, 47.9], '1942-12-17'], [[43.6, 48.05], '1942-12-19'], [[42.8, 47.4], '1942-12-27']], 'armor', 60000),
  march('ring', 'Don Front — Operation Ring (Rokossovsky)', 'su', [[[43.3, 48.75], '1943-01-10'], [PITOMNIK, '1943-01-16'], [[44.32, 48.79], '1943-01-22'], [[44.5, 48.72], '1943-02-02']], 'army', 212000),
  ...airlift,
];

const EVENTS = [
  ev('1942-08-23', [44.5, 48.72], 'Bombing of Stalingrad', 'disaster', 'Massive Luftwaffe raids set the city ablaze; German tanks reach the Volga north of the city.', { zoom: 10 }),
  ev('1942-09-13', [44.4, 48.65], 'Assault on the city begins', 'battle', 'The 6th Army attacks into the city centre.', { zoom: 10 }),
  ev('1942-09-14', [44.62, 48.72], '13th Guards cross the Volga', 'battle', 'Rodimtsev’s guardsmen land under fire and retake Mamayev Kurgan.', { zoom: 11 }),
  ev('1942-09-27', [44.524, 48.712], 'Pavlov’s House', 'siege', 'A small garrison holds an apartment block for 58 days.', { zoom: 13 }),
  ev('1942-10-14', [44.58, 48.775], 'Assault on the Tractor Factory', 'battle', 'The fiercest fighting of the battle among the northern factories.', { zoom: 12 }),
  ev('1942-11-19', [42.6, 49.6], 'Operation Uranus: northern pincer', 'battle', 'Soviet armies smash the Romanian 3rd Army on the Don.', { zoom: 8 }),
  ev('1942-11-20', [44.5, 48.0], 'Operation Uranus: southern pincer', 'battle', 'The Romanian 4th Army collapses south of the city.', { zoom: 8 }),
  ev('1942-11-23', [43.5, 48.66], 'The ring closes at Kalach', 'battle', 'About 290,000 Axis troops are trapped.', { zoom: 9 }),
  ev('1942-11-25', PITOMNIK, 'The airlift begins', 'note', 'The Luftwaffe never comes close to the 300 tonnes a day the pocket needs.'),
  ev('1942-12-12', [42.7, 47.4], 'Operation Winter Storm', 'battle', 'Manstein’s relief attempt drives north-east.', { zoom: 8 }),
  ev('1942-12-19', [43.6, 48.05], 'Relief halted at the Myshkova', 'battle', '48 km from the pocket; Paulus does not break out.', { zoom: 9 }),
  ev('1943-01-10', [43.3, 48.75], 'Operation Ring', 'battle', 'The final Soviet offensive against the pocket.'),
  ev('1943-01-16', PITOMNIK, 'Pitomnik airfield falls', 'siege'),
  ev('1943-01-31', [44.515, 48.708], 'Paulus surrenders', 'treaty', 'The newly promoted field marshal is captured in the Univermag department store.', { zoom: 13 }),
  ev('1943-02-02', [44.58, 48.78], 'The battle ends', 'note', 'The northern pocket surrenders. About 91,000 prisoners march into captivity.', { zoom: 10 }),
];

export async function buildStalingradDemo(): Promise<Scenario> {
  return buildKit({
    title: 'Battle of Stalingrad',
    description: 'August 1942 – February 1943: the German drive to the Volga, street fighting in the city, the Soviet encirclement (Operation Uranus), the failed relief and the surrender of the 6th Army. Approximate and illustrative.',
    start: '1942-08-15',
    end: '1943-02-05',
    res: 7,
    hiResLand: [40.5, 47.4, 45.0, 49.9],
    basemap: 'esri-imagery',
    view: { center: [43.5, 48.7], zoom: 7.2 },
    utcOffsetHours: 3,
    settings: { territoryOpacity: 0.55 },
    runSeconds: 150,
    eventFraction: 0.04,
    factions: F,
    regions: REGIONS,
    units: UNITS,
    events: EVENTS,
    eras: [
      { name: 'Drive to the Volga', start: 1942.62, end: 1942.7, color: '#adb5bd' },
      { name: 'Street fighting', start: 1942.7, end: 1942.885, color: '#ff8787' },
      { name: 'Operation Uranus', start: 1942.885, end: 1942.9, color: '#fa5252' },
      { name: 'The Kessel', start: 1942.9, end: 1943.09, color: '#74c0fc' },
    ],
    annotations: [
      { text: 'Volga', position: [44.75, 48.6], units: 'pixels', size: 14, color: '#d0ebff' },
      { text: 'Don', position: [42.7, 48.95], units: 'pixels', size: 14, color: '#d0ebff' },
      { text: 'Mamayev Kurgan', position: MAMAYEV, units: 'pixels', size: 11, color: '#ffffff' },
      { text: 'Kalach', position: KALACH, units: 'pixels', size: 11, color: '#ffffff' },
    ],
    camera: [
      cam('1942-08-15', [43.5, 48.8], 7.4),
      cam('1942-08-23', [44.2, 48.8], 9.2, 40),
      cam('1942-09-14', [44.5, 48.71], 11.2, 50),
      cam('1942-09-27', [44.52, 48.71], 12.8, 55),
      cam('1942-10-14', [44.57, 48.77], 12.0, 50),
      cam('1942-11-12', [44.48, 48.7], 10.6, 40),
      cam('1942-11-19', [43.4, 48.9], 7.8, 30),
      cam('1942-11-23', [43.55, 48.7], 8.4, 35),
      cam('1942-12-15', [43.3, 47.95], 8.0, 30),
      cam('1943-01-12', [43.9, 48.7], 8.8, 35),
      cam('1943-01-31', [44.51, 48.71], 12.4, 50),
      cam('1943-02-05', [43.8, 48.6], 7.6, 20),
    ],
  });
}
