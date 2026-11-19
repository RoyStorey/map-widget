/**
 * Battle of Midway, 3–5 June 1942 — carrier task forces, the air strikes that
 * decided the battle, and the loss of four Japanese carriers. Positions and
 * times (local) are approximate and illustrative.
 */
import { buildKit, cam, ev, march, T } from './kit';
import type { LonLat } from '../core/geo';
import type { Scenario } from '../core/scenario';

const H = (s: string) => `1942-06-${s.slice(0, 2)}T${s.slice(3)}`;
const t = (s: string) => T(H(s));

const MIDWAY: LonLat = [-177.37, 28.21];
const KB: LonLat = [-179.0, 30.4]; // Kido Butai at the time of the dive-bomber attack
const TF16: LonLat = [-176.0, 31.6];
const TF17: LonLat = [-176.2, 31.9];

const F = [
  { id: 'us', name: 'United States Navy', color: '#1c7ed6' },
  { id: 'jp', name: 'Imperial Japanese Navy', color: '#f03e3e' },
];

const UNITS = [
  // carriers
  march('akagi', 'Akagi (flagship)', 'jp', [[[-179.9, 31.1], H('03 18:00')], [[-179.3, 30.4], H('04 04:30')], [[-178.7, 30.5], H('04 10:25')], [[-178.68, 30.5], H('05 05:20')]], 'fleet', 1630),
  march('kaga', 'Kaga', 'jp', [[[-179.95, 31.05], H('03 18:00')], [[-179.35, 30.35], H('04 04:30')], [[-179.28, 30.33], H('04 10:22')], [[-179.27, 30.33], H('04 19:25')]], 'fleet', 1700),
  march('soryu', 'Sōryū', 'jp', [[[-179.85, 31.2], H('03 18:00')], [[-179.25, 30.5], H('04 04:30')], [[-179.2, 30.63], H('04 10:25')], [[-179.21, 30.64], H('04 19:13')]], 'fleet', 1100),
  march('hiryu', 'Hiryū', 'jp', [[[-179.8, 31.25], H('03 18:00')], [[-179.2, 30.55], H('04 04:30')], [[-178.9, 30.6], H('04 10:30')], [[-178.5, 31.0], H('04 17:03')], [[-179.4, 31.45], H('05 09:12')]], 'fleet', 1100),
  march('tf16', 'Task Force 16 (Enterprise, Hornet)', 'us', [[[-173.0, 32.0], H('03 18:00')], [TF16, H('04 07:00')], [[-176.2, 31.4], H('04 12:00')], [[-175.5, 31.6], H('04 18:00')], [[-176.0, 32.0], H('05 12:00')]], 'fleet', 6000),
  march('tf17', 'Task Force 17 (Yorktown)', 'us', [[[-173.2, 32.2], H('03 18:00')], [TF17, H('04 08:30')], [[-176.4, 31.7], H('04 12:05')], [[-176.5, 31.0], H('04 16:00')], [[-176.55, 30.7], H('05 12:00')]], 'fleet', 2300),
  // scouting
  march('pby', 'PBY Catalina scout (Ady)', 'us', [[MIDWAY, H('04 04:15')], [[-179.4, 30.0], H('04 05:34')], [[-178.0, 29.0], H('04 06:30')]], 'aircraft', 9),
  // Japanese strike on Midway
  march('tomonaga1', 'Strike on Midway (Tomonaga, 108 aircraft)', 'jp', [[[-179.25, 30.45], H('04 04:30')], [MIDWAY, H('04 06:20')], [[-179.15, 30.42], H('04 08:30')]], 'aircraft', 108),
  march('vmf221', 'VMF-221 Buffalos & Wildcats', 'us', [[MIDWAY, H('04 06:00')], [[-177.6, 28.6], H('04 06:16')], [MIDWAY, H('04 06:50')]], 'aircraft', 25),
  // Midway-based attacks
  march('midway-strike', 'Midway-based TBFs & B-26s', 'us', [[MIDWAY, H('04 06:00')], [[-179.15, 30.42], H('04 07:10')]], 'aircraft', 10),
  march('henderson', 'VMSB-241 (Henderson)', 'us', [[MIDWAY, H('04 06:10')], [[-179.15, 30.45], H('04 07:55')], [MIDWAY, H('04 09:30')]], 'aircraft', 27),
  march('b17', 'B-17 Flying Fortresses', 'us', [[MIDWAY, H('04 06:20')], [[-179.1, 30.4], H('04 08:10')], [MIDWAY, H('04 10:00')]], 'aircraft', 15),
  // carrier strikes
  march('vt8', 'Torpedo Squadron 8 (Hornet)', 'us', [[TF16, H('04 07:00')], [[-178.95, 30.48], H('04 09:20')]], 'aircraft', 15),
  march('vt6', 'Torpedo Squadron 6 (Enterprise)', 'us', [[TF16, H('04 07:50')], [[-178.95, 30.45], H('04 09:40')]], 'aircraft', 14),
  march('vt3', 'Torpedo Squadron 3 (Yorktown)', 'us', [[TF17, H('04 09:05')], [[-179.1, 30.6], H('04 10:15')]], 'aircraft', 12),
  march('mcclusky', 'McClusky’s dive bombers (Enterprise)', 'us', [[TF16, H('04 07:45')], [[-178.4, 30.05], H('04 09:30')], [[-178.9, 30.35], H('04 10:05')], [[-179.28, 30.33], H('04 10:22')], [[-176.2, 31.4], H('04 11:50')]], 'aircraft', 33),
  march('leslie', 'Leslie’s dive bombers (Yorktown)', 'us', [[TF17, H('04 09:05')], [[-179.2, 30.63], H('04 10:25')], [[-176.3, 31.8], H('04 11:30')]], 'aircraft', 17),
  march('kobayashi', 'Hiryū first strike (Kobayashi)', 'jp', [[[-178.9, 30.6], H('04 10:58')], [[-176.4, 31.7], H('04 12:05')], [[-178.7, 30.9], H('04 13:00')]], 'aircraft', 24),
  march('tomonaga2', 'Hiryū second strike (Tomonaga)', 'jp', [[[-178.6, 30.9], H('04 13:30')], [[-176.45, 31.2], H('04 14:40')], [[-178.5, 31.0], H('04 15:40')]], 'aircraft', 16),
  march('gallaher', 'Strike on Hiryū (Gallaher)', 'us', [[[-176.1, 31.5], H('04 15:30')], [[-178.5, 31.0], H('04 17:03')], [[-176.0, 31.7], H('04 18:30')]], 'aircraft', 24),
];

const EVENTS = [
  ev(H('04 04:30'), [-179.3, 30.4], 'Kido Butai launches against Midway', 'note', 'Admiral Nagumo sends 108 aircraft against the atoll.', { zoom: 7 }),
  ev(H('04 05:34'), [-179.4, 30.0], 'PBY sights the carriers', 'discovery', '“Many planes heading Midway” — then the carriers themselves are reported.'),
  ev(H('04 06:30'), MIDWAY, 'Midway is bombed', 'battle', 'The airfield survives; Tomonaga signals that a second strike is needed.', { zoom: 8 }),
  ev(H('04 07:15'), KB, 'Nagumo’s dilemma', 'note', 'He orders reserve aircraft rearmed with bombs — then learns US carriers are near.'),
  ev(H('04 09:20'), [-178.95, 30.48], 'Torpedo Squadron 8 is annihilated', 'battle', 'All 15 aircraft are shot down; one pilot survives. The Zeros are drawn down to sea level.'),
  ev(H('04 10:22'), [-179.28, 30.33], 'Kaga hit', 'battle', 'McClusky’s Dauntlesses dive out of the sun.', { zoom: 9 }),
  ev(H('04 10:25'), [-178.7, 30.5], 'Akagi hit', 'battle', 'A single bomb among rearming aircraft dooms the flagship.', { zoom: 9 }),
  ev(H('04 10:26'), [-179.2, 30.63], 'Sōryū hit', 'battle', 'Yorktown’s bombers strike — three carriers burning in six minutes.', { zoom: 9 }),
  ev(H('04 12:05'), [-176.4, 31.7], 'Yorktown hit by dive bombers', 'battle'),
  ev(H('04 14:42'), [-176.45, 31.2], 'Yorktown torpedoed', 'battle', 'Hiryū’s second strike leaves Yorktown dead in the water.'),
  ev(H('04 17:03'), [-178.5, 31.0], 'Hiryū hit', 'battle', 'Enterprise’s bombers find the last Japanese carrier.', { zoom: 9 }),
  ev(H('04 19:13'), [-179.21, 30.64], 'Sōryū sinks', 'disaster'),
  ev(H('04 19:25'), [-179.27, 30.33], 'Kaga sinks', 'disaster'),
  ev(H('05 02:55'), [-179.0, 30.8], 'Yamamoto cancels the operation', 'note', 'The invasion of Midway is abandoned.'),
  ev(H('05 05:20'), [-178.68, 30.5], 'Akagi scuttled', 'disaster'),
  ev(H('05 09:12'), [-179.4, 31.45], 'Hiryū sinks', 'disaster', 'Japan has lost four fleet carriers and many veteran aircrew.'),
];

export async function buildMidwayDemo(): Promise<Scenario> {
  return buildKit({
    title: 'Battle of Midway',
    description: 'The carrier battle of 3–5 June 1942: the strike on Midway, the doomed torpedo attacks, the six minutes that sank three carriers, and Hiryū’s revenge on Yorktown. Approximate and illustrative.',
    start: H('03 18:00'),
    end: H('05 12:00'),
    res: 4,
    basemap: 'esri-ocean',
    view: { center: [-177.8, 29.8], zoom: 6.6 },
    utcOffsetHours: -12,
    settings: { terminator: true },
    runSeconds: 150,
    eventFraction: 0.03,
    factions: F,
    units: UNITS,
    events: EVENTS,
    eras: [
      { name: 'Strike on Midway', start: t('04 04:30'), end: t('04 07:00'), color: '#ff8787' },
      { name: 'US counter-strikes', start: t('04 07:00'), end: t('04 10:30'), color: '#74c0fc' },
      { name: 'Hiryū fights back', start: t('04 10:50'), end: t('04 17:10'), color: '#ffa94d' },
    ],
    annotations: [
      { text: 'Midway Atoll', position: [-177.37, 28.05], units: 'pixels', size: 14, color: '#ffffff' },
      { text: 'Pacific Ocean', position: [-177.8, 32.6], units: 'pixels', size: 16, color: '#d0ebff' },
    ],
    camera: [
      cam(H('03 18:00'), [-177.8, 29.8], 6.4),
      cam(H('04 04:30'), [-179.2, 30.4], 8.6, 40),
      cam(H('04 06:15'), MIDWAY, 9.5, 45),
      cam(H('04 07:30'), [-177.8, 30.6], 7.2, 30),
      cam(H('04 09:15'), [-178.95, 30.48], 9.4, 50),
      cam(H('04 10:20'), [-179.0, 30.45], 10.2, 55),
      cam(H('04 11:30'), [-177.6, 31.0], 7.4, 30),
      cam(H('04 12:05'), [-176.4, 31.7], 9.6, 50),
      cam(H('04 14:40'), [-176.45, 31.2], 9.6, 50),
      cam(H('04 17:00'), [-178.5, 31.0], 9.6, 50),
      cam(H('04 19:20'), [-179.2, 30.5], 9.0, 40),
      cam(H('05 09:10'), [-179.4, 31.45], 9.0, 40),
      cam(H('05 12:00'), [-177.8, 30.0], 6.6),
    ],
  });
}
