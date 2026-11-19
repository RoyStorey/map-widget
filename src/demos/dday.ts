/**
 * D-Day, 6 June 1944 — the Normandy landings hour by hour: airborne drops,
 * the invasion fleet, naval gunfire, the five beaches and the first German
 * counter-attack. Positions and timings are approximate and illustrative.
 */
import { buildKit, cam, ev, march, T, type KitRegion } from './kit';
import type { LonLat } from '../core/geo';
import type { Scenario } from '../core/scenario';

/** '06 06:30' → 1944-06-06T06:30 (local time) */
const H = (s: string) => `1944-06-${s.slice(0, 2)}T${s.slice(3)}`;
const tOf = (s: string) => T(H(s));

const F = [
  { id: 'us', name: 'United States', color: '#1c7ed6' },
  { id: 'uk', name: 'British', color: '#e64980' },
  { id: 'ca', name: 'Canadian', color: '#f76707' },
  { id: 'de', name: 'German', color: '#495057' },
];

const REGIONS: KitRegion[] = [
  { name: 'Utah', ring: [[-1.23, 49.45], [-1.15, 49.45], [-1.15, 49.415], [-1.17, 49.39], [-1.21, 49.37], [-1.25, 49.38], [-1.26, 49.41]], native: 'de', phases: [['us', H('06 06:30'), H('06 18:00'), [-1.175, 49.415], 0.2]] },
  { name: 'Sainte-Mère-Église (82nd)', ring: [[-1.36, 49.435], [-1.29, 49.435], [-1.28, 49.39], [-1.32, 49.37], [-1.37, 49.39]], native: 'de', phases: [['us', H('06 01:45'), H('06 06:00'), [-1.317, 49.408]]] },
  { name: '101st Airborne', ring: [[-1.26, 49.41], [-1.21, 49.37], [-1.22, 49.33], [-1.28, 49.33], [-1.30, 49.36]], native: 'de', phases: [['us', H('06 01:20'), H('06 14:00'), [-1.25, 49.36]]] },
  { name: 'Pointe du Hoc', ring: [[-0.998, 49.399], [-0.98, 49.399], [-0.98, 49.389], [-0.998, 49.389]], native: 'de', phases: [['us', H('06 07:10'), H('06 07:40'), [-0.989, 49.396]]], landOnly: false },
  { name: 'Omaha', ring: [[-0.97, 49.41], [-0.86, 49.40], [-0.80, 49.39], [-0.80, 49.35], [-0.86, 49.352], [-0.93, 49.362], [-0.97, 49.375]], native: 'de', phases: [['us', H('06 07:45'), H('06 23:00'), [-0.87, 49.372], 0.4]] },
  { name: 'Gold', ring: [[-0.64, 49.375], [-0.58, 49.375], [-0.52, 49.37], [-0.48, 49.365], [-0.50, 49.29], [-0.58, 49.27], [-0.66, 49.29], [-0.67, 49.32]], native: 'de', phases: [['uk', H('06 07:25'), H('06 23:00'), [-0.56, 49.343]]] },
  { name: 'Juno', ring: [[-0.48, 49.365], [-0.38, 49.36], [-0.37, 49.29], [-0.42, 49.25], [-0.48, 49.26], [-0.50, 49.29]], native: 'de', phases: [['ca', H('06 07:50'), H('06 23:00'), [-0.43, 49.337]]] },
  { name: 'Sword', ring: [[-0.34, 49.33], [-0.26, 49.32], [-0.26, 49.25], [-0.32, 49.23], [-0.36, 49.27]], native: 'de', phases: [['uk', H('06 07:25'), H('06 22:00'), [-0.3, 49.296]]] },
  { name: '6th Airborne (east of the Orne)', ring: [[-0.275, 49.25], [-0.2, 49.28], [-0.15, 49.27], [-0.15, 49.21], [-0.22, 49.19], [-0.275, 49.22]], native: 'de', phases: [['uk', H('06 00:16'), H('06 06:00'), [-0.274, 49.242]]] },
  // everything else in the area is German-held all day
  { name: 'German-held Normandy', ring: [[-1.95, 49.73], [-1.25, 49.76], [-1.1, 49.5], [0.2, 49.5], [0.45, 49.2], [0.3, 48.95], [-1.62, 48.95], [-1.95, 49.4]], native: 'de' },
];

const P = {
  utah: [-1.175, 49.415] as LonLat, omaha: [-0.87, 49.372] as LonLat, gold: [-0.56, 49.343] as LonLat, juno: [-0.43, 49.337] as LonLat, sword: [-0.3, 49.296] as LonLat,
  hoc: [-0.989, 49.396] as LonLat, pegasus: [-0.274, 49.242] as LonLat, sme: [-1.317, 49.408] as LonLat, merville: [-0.2, 49.27] as LonLat, longues: [-0.694, 49.343] as LonLat,
};

const UNITS = [
  // ---- airborne (night of 5–6 June)
  march('ox', 'Ox & Bucks gliders (Operation Deadstick)', 'uk', [[[-2.08, 50.85], H('05 22:56')], [[-0.5, 50.2], H('05 23:45')], [[-0.15, 49.36], H('06 00:08')], [P.pegasus, H('06 00:16')]], 'aircraft', 181),
  march('6ab', '6th Airborne Division (Ranville & Merville)', 'uk', [[[-1.31, 51.6], H('05 23:10')], [[-0.3, 50.5], H('06 00:15')], [[-0.15, 49.33], H('06 00:45')], [[-0.22, 49.24], H('06 00:55')], [[-0.6, 49.9], H('06 01:30')], [[-1.3, 51.5], H('06 02:40')]], 'aircraft', 4800),
  march('101-air', '101st Airborne — C-47 serials', 'us', [[[-3.1, 50.88], H('05 22:30')], [[-2.0, 50.3], H('05 23:50')], [[-2.65, 49.62], H('06 00:35')], [[-1.6, 49.38], H('06 00:55')], [[-1.25, 49.36], H('06 01:10')], [[-0.95, 49.6], H('06 01:30')], [[-1.3, 50.6], H('06 02:30')]], 'aircraft', 6900),
  march('82-air', '82nd Airborne — C-47 serials', 'us', [[[-1.0, 52.0], H('05 22:45')], [[-2.0, 50.3], H('06 00:10')], [[-2.65, 49.6], H('06 00:55')], [[-1.6, 49.42], H('06 01:40')], [[-1.33, 49.41], H('06 01:55')], [[-0.95, 49.7], H('06 02:20')], [[-1.0, 50.7], H('06 03:00')]], 'aircraft', 6400),
  // ---- invasion fleet
  march('force-u', 'Force U (Utah)', 'us', [[[-3.2, 50.2], H('05 21:00')], [[-1.6, 50.0], H('06 00:30')], [[-1.08, 49.53], H('06 02:30')], [[-1.08, 49.53], H('06 23:59')]], 'fleet', 865),
  march('force-o', 'Force O (Omaha)', 'us', [[[-2.2, 50.35], H('05 21:00')], [[-1.2, 50.25], H('05 23:30')], [[-0.95, 49.85], H('06 01:30')], [[-0.9, 49.52], H('06 03:00')], [[-0.9, 49.52], H('06 23:59')]], 'fleet', 1000),
  march('force-g', 'Force G (Gold)', 'uk', [[[-1.35, 50.75], H('05 21:00')], [[-1.0, 50.3], H('05 23:30')], [[-0.6, 49.8], H('06 02:30')], [[-0.56, 49.45], H('06 05:30')], [[-0.56, 49.45], H('06 23:59')]], 'fleet', 800),
  march('force-j', 'Force J (Juno)', 'ca', [[[-1.15, 50.75], H('05 21:00')], [[-0.95, 50.3], H('05 23:40')], [[-0.45, 49.8], H('06 03:00')], [[-0.42, 49.45], H('06 05:45')], [[-0.42, 49.45], H('06 23:59')]], 'fleet', 600),
  march('force-s', 'Force S (Sword)', 'uk', [[[-1.05, 50.77], H('05 21:00')], [[-0.85, 50.3], H('05 23:50')], [[-0.3, 49.75], H('06 03:30')], [[-0.27, 49.42], H('06 06:00')], [[-0.27, 49.42], H('06 23:59')]], 'fleet', 650),
  // ---- landing craft
  march('lc-utah', 'Utah assault wave (LCVPs)', 'us', [[[-1.08, 49.53], H('06 04:30')], [[-1.16, 49.43], H('06 06:15')], [P.utah, H('06 06:30')]], 'ship', 600),
  march('lc-omaha', 'Omaha assault wave (LCVPs)', 'us', [[[-0.9, 49.52], H('06 04:15')], [[-0.88, 49.39], H('06 06:15')], [P.omaha, H('06 06:31')]], 'ship', 1450),
  march('rangers', '2nd Ranger Battalion (to Pointe du Hoc)', 'us', [[[-0.9, 49.52], H('06 04:30')], [[-0.94, 49.40], H('06 06:45')], [P.hoc, H('06 07:10')], [[-0.99, 49.388], H('06 09:00')], [[-0.99, 49.385], H('06 23:59')]], 'ship', 225),
  march('lc-gold', 'Gold assault wave', 'uk', [[[-0.56, 49.45], H('06 05:50')], [P.gold, H('06 07:25')]], 'ship', 1500),
  march('lc-juno', 'Juno assault wave', 'ca', [[[-0.42, 49.45], H('06 06:05')], [P.juno, H('06 07:50')]], 'ship', 2400),
  march('lc-sword', 'Sword assault wave', 'uk', [[[-0.27, 49.42], H('06 06:00')], [P.sword, H('06 07:25')]], 'ship', 1700),
  // ---- air support
  march('b26', 'B-26 Marauders over Utah', 'us', [[[0.8, 51.6], H('06 05:05')], [[-1.17, 49.43], H('06 06:10')], [[-0.4, 50.6], H('06 07:00')]], 'aircraft', 276),
  march('b24', 'B-24 Liberators over Omaha', 'us', [[[1.0, 52.4], H('06 04:30')], [[-0.88, 49.36], H('06 06:05')], [[0.5, 51.0], H('06 07:10')]], 'aircraft', 329),
  // ---- ground forces after landing
  march('4id', '4th Infantry Division', 'us', [[P.utah, H('06 06:30')], [[-1.2, 49.4], H('06 09:00')], [[-1.25, 49.39], H('06 13:00')], [[-1.3, 49.40], H('06 21:00')]], 'army', 21000),
  march('82-ground', '82nd Airborne (Sainte-Mère-Église)', 'us', [[[-1.34, 49.41], H('06 02:00')], [P.sme, H('06 04:30')], [[-1.32, 49.40], H('06 23:59')]], 'army', 6400),
  march('101-ground', '101st Airborne (causeway exits)', 'us', [[[-1.25, 49.36], H('06 01:30')], [[-1.22, 49.39], H('06 06:00')], [[-1.24, 49.33], H('06 16:00')], [[-1.245, 49.315], H('06 23:00')]], 'army', 6900),
  march('1id', '1st Infantry Division ("Big Red One")', 'us', [[[-0.85, 49.368], H('06 06:40')], [[-0.85, 49.366], H('06 10:00')], [[-0.84, 49.355], H('06 12:30')], [[-0.82, 49.345], H('06 20:00')]], 'army', 34000),
  march('29id', '29th Infantry Division', 'us', [[[-0.915, 49.38], H('06 06:35')], [[-0.912, 49.378], H('06 10:30')], [[-0.906, 49.372], H('06 11:30')], [[-0.89, 49.36], H('06 20:00')]], 'army', 34000),
  march('50div', '50th (Northumbrian) Division', 'uk', [[P.gold, H('06 07:25')], [[-0.62, 49.335], H('06 12:00')], [[-0.65, 49.31], H('06 18:00')], [[-0.69, 49.285], H('06 23:00')]], 'army', 25000),
  march('47rm', '47 Royal Marine Commando', 'uk', [[[-0.62, 49.345], H('06 08:00')], [[-0.7, 49.33], H('06 18:00')], [[-0.73, 49.335], H('06 23:59')]], 'army', 420),
  march('3cdn', '3rd Canadian Division', 'ca', [[P.juno, H('06 07:50')], [[-0.43, 49.31], H('06 11:00')], [[-0.46, 49.27], H('06 18:00')], [[-0.47, 49.25], H('06 21:00')]], 'army', 21400),
  march('3bri', '3rd British Division', 'uk', [[P.sword, H('06 07:30')], [[-0.31, 49.27], H('06 11:00')], [[-0.33, 49.24], H('06 16:00')], [[-0.34, 49.235], H('06 21:00')]], 'army', 28800),
  march('lovat', '1st Special Service Brigade (Lord Lovat)', 'uk', [[[-0.28, 49.29], H('06 08:40')], [[-0.26, 49.27], H('06 11:00')], [P.pegasus, H('06 13:00')], [[-0.25, 49.245], H('06 23:59')]], 'army', 2500),
  // ---- German reaction
  march('21pz', '21st Panzer Division', 'de', [[[-0.25, 49.05], H('06 06:00')], [[-0.36, 49.18], H('06 13:00')], [[-0.38, 49.22], H('06 16:00')], [[-0.355, 49.315], H('06 20:00')], [[-0.4, 49.22], H('06 22:30')]], 'armor', 16000),
  march('352', 'Kampfgruppe Meyer (352nd Infantry)', 'de', [[[-0.8, 49.25], H('06 04:00')], [[-1.0, 49.3], H('06 08:00')], [[-0.75, 49.3], H('06 14:00')], [[-0.65, 49.3], H('06 17:30')]], 'army', 3000),
  march('mallard', 'Operation Mallard (glider reinforcement)', 'uk', [[[-1.5, 51.0], H('06 19:30')], [[-0.2, 49.36], H('06 20:45')], [[-0.22, 49.22], H('06 21:00')]], 'aircraft', 256),
];

// Naval gunfire, bombing and German batteries as animated arcs with time windows.
const fire = (from: LonLat, to: LonLat, a: string, b: string, label: string, color: string, value = 10) => ({ from, to, start: tOf(a), end: tOf(b), label, color, value });
const FLOWS = [
  fire([-1.12, 49.5], [-1.29, 49.48], '06 05:36', '06 09:00', 'USS Nevada → Crisbecq & Azeville batteries', '#ffd43b', 14),
  fire([-0.98, 49.44], P.hoc, '06 05:50', '06 06:35', 'USS Texas → Pointe du Hoc', '#ffd43b', 14),
  fire([-0.98, 49.44], [-0.9, 49.37], '06 06:35', '06 12:00', 'USS Texas → Omaha bluffs', '#ffd43b', 12),
  fire([-0.85, 49.45], [-0.88, 49.366], '06 05:50', '06 07:30', 'USS Arkansas → Les Moulins', '#ffd43b', 12),
  fire([-0.91, 49.39], [-0.906, 49.374], '06 09:50', '06 11:30', 'Destroyers close in off Omaha', '#ffa94d', 8),
  fire([-0.65, 49.43], P.longues, '06 05:50', '06 08:45', 'HMS Ajax → Longues-sur-Mer battery', '#ffd43b', 12),
  fire([-0.42, 49.45], [-0.53, 49.32], '06 05:30', '06 07:30', 'HMS Belfast → Ver-sur-Mer battery', '#ffd43b', 12),
  fire([-0.12, 49.42], [0.12, 49.39], '06 05:30', '06 09:00', 'HMS Warspite → Villerville battery', '#ffd43b', 14),
  fire([-0.2, 49.42], [0.05, 49.35], '06 05:30', '06 09:00', 'HMS Ramillies → Benerville battery', '#ffd43b', 12),
  fire(P.longues, [-0.6, 49.44], '06 05:37', '06 08:40', 'Longues battery fires on HMS Bulolo', '#ced4da', 8),
  fire([-1.29, 49.48], [-1.12, 49.52], '06 05:52', '06 09:00', 'Crisbecq battery fires on the Utah fleet', '#ced4da', 8),
  fire([-0.5, 50.8], P.utah, '06 06:05', '06 06:25', 'Air bombardment of Utah', '#e599f7', 10),
  fire([-0.5, 51.0], P.omaha, '06 06:00', '06 06:15', 'Air bombardment of Omaha (mostly missed)', '#e599f7', 10),
];

const EVENTS = [
  ev(H('05 21:15'), [-0.12, 51.5], 'BBC broadcasts the Verlaine message', 'note', '“Les sanglots longs des violons…” — the signal to the French Resistance that the invasion is imminent.'),
  ev(H('06 00:16'), P.pegasus, 'Pegasus Bridge captured', 'battle', 'Glider-borne troops of the Ox & Bucks seize the Caen canal bridge in ten minutes.', { zoom: 13 }),
  ev(H('06 00:50'), [-1.3, 49.38], 'Airborne drops over the Cotentin', 'note', 'Scattered by cloud and flak, US paratroopers land far from their drop zones.'),
  ev(H('06 04:45'), P.merville, 'Merville Battery assault', 'battle', '150 men of the 9th Parachute Battalion storm the battery.'),
  ev(H('06 04:30'), P.sme, 'Sainte-Mère-Église liberated', 'founding', 'The first town liberated in France.', { zoom: 12.5 }),
  ev(H('06 05:30'), [-0.6, 49.45], 'Naval bombardment begins', 'battle', 'Seven battleships, 23 cruisers and over 100 destroyers open fire.'),
  ev(H('06 06:30'), P.utah, 'H-Hour: Utah Beach', 'battle', 'Landing 2 km south of the target, the 4th Division meets light resistance.', { zoom: 12 }),
  ev(H('06 06:31'), P.omaha, 'H-Hour: Omaha Beach', 'battle', 'Heavy fire from the bluffs pins the first waves on the shingle.', { zoom: 12 }),
  ev(H('06 07:10'), P.hoc, 'Rangers scale Pointe du Hoc', 'battle', 'The 2nd Rangers climb the 30 m cliffs under fire.', { zoom: 14 }),
  ev(H('06 07:25'), P.gold, 'Gold Beach landings', 'battle', 'The 50th Division lands at La Rivière and Le Hamel.', { zoom: 12 }),
  ev(H('06 07:26'), P.sword, 'Sword Beach landings', 'battle', 'The 3rd British Division lands at Ouistreham.', { zoom: 12 }),
  ev(H('06 07:50'), P.juno, 'Juno Beach landings', 'battle', 'The 3rd Canadian Division lands at Courseulles and Bernières.', { zoom: 12 }),
  ev(H('06 09:32'), [-1.17, 50.87], 'Eisenhower’s communiqué', 'note', '“Allied naval forces, supported by strong air forces, began landing Allied armies this morning on the northern coast of France.”'),
  ev(H('06 11:30'), [-0.906, 49.374], 'Vierville draw opened', 'battle', 'Omaha’s first exit is cleared; troops push up the bluffs.'),
  ev(H('06 13:00'), P.pegasus, 'Lovat’s commandos reach Pegasus Bridge', 'note', 'Piper Bill Millin plays them across the bridge.'),
  ev(H('06 16:00'), [-0.36, 49.22], '21st Panzer counter-attacks', 'battle', 'The only German armoured counter-attack of the day.'),
  ev(H('06 20:00'), [-0.355, 49.315], 'German tanks reach the coast', 'battle', 'A battle group slips between Juno and Sword to Luc-sur-Mer — then withdraws.'),
  ev(H('06 21:00'), [-0.22, 49.22], 'Operation Mallard gliders land', 'note', 'Reinforcements for the 6th Airborne east of the Orne.'),
  ev(H('06 23:59'), [-0.6, 49.33], 'End of D-Day', 'note', 'About 156,000 Allied troops are ashore. Roughly 4,400 Allied soldiers have been killed.', { zoom: 9 }),
];

export async function buildDDayDemo(): Promise<Scenario> {
  return buildKit({
    title: 'D-Day: the Normandy landings',
    description: 'Hour by hour from the evening of 5 June to midnight on 6 June 1944: airborne assaults, the invasion fleet, naval gunfire, the five beaches and the German counter-attack. Approximate and illustrative.',
    start: H('05 21:00'),
    end: H('07 00:00'),
    res: 8,
    hiResLand: [-2.0, 48.9, 0.5, 49.8],
    basemap: 'ofm-liberty',
    view: { center: [-0.75, 49.4], zoom: 9, pitch: 30 },
    utcOffsetHours: 2,
    settings: { terminator: true, territoryOpacity: 0.5 },
    runSeconds: 180,
    eventFraction: 0.05,
    factions: F,
    regions: REGIONS,
    units: UNITS,
    events: EVENTS,
    flows: FLOWS,
    eras: [
      { name: 'Airborne assault', start: tOf('06 00:00'), end: tOf('06 04:30'), color: '#b197fc' },
      { name: 'Bombardment', start: tOf('06 05:30'), end: tOf('06 06:30'), color: '#ffd43b' },
      { name: 'Beach landings', start: tOf('06 06:30'), end: tOf('06 08:00'), color: '#ff8787' },
      { name: 'Breaking out', start: tOf('06 11:00'), end: tOf('06 23:59'), color: '#74c0fc' },
    ],
    annotations: [
      { text: 'UTAH', position: [-1.15, 49.44], units: 'pixels', size: 18, color: '#ffffff' },
      { text: 'OMAHA', position: [-0.87, 49.395], units: 'pixels', size: 18, color: '#ffffff' },
      { text: 'GOLD', position: [-0.56, 49.365], units: 'pixels', size: 18, color: '#ffffff' },
      { text: 'JUNO', position: [-0.43, 49.36], units: 'pixels', size: 18, color: '#ffffff' },
      { text: 'SWORD', position: [-0.29, 49.315], units: 'pixels', size: 18, color: '#ffffff' },
      { text: 'English Channel', position: [-0.9, 49.95], units: 'pixels', size: 15, color: '#d0ebff' },
      { text: 'Bayeux', position: [-0.703, 49.276], units: 'pixels', size: 12, color: '#f8f9fa' },
      { text: 'Caen', position: [-0.37, 49.183], units: 'pixels', size: 13, color: '#f8f9fa' },
      { text: 'Carentan', position: [-1.248, 49.303], units: 'pixels', size: 12, color: '#f8f9fa' },
      { text: 'Arromanches', position: [-0.62, 49.34], units: 'pixels', size: 11, color: '#f8f9fa' },
      { text: 'Ouistreham', position: [-0.25, 49.28], units: 'pixels', size: 11, color: '#f8f9fa' },
      { text: 'Portsmouth', position: [-1.09, 50.8], units: 'pixels', size: 12, color: '#f8f9fa' },
    ],
    camera: [
      cam(H('05 21:00'), [-1.4, 50.15], 7.2, 30),
      cam(H('05 23:40'), [-0.8, 49.85], 7.8, 35),
      cam(H('06 00:12'), [-0.27, 49.245], 12.2, 50),
      cam(H('06 00:40'), [-1.0, 49.55], 8.6, 30),
      cam(H('06 01:20'), [-1.28, 49.39], 10.8, 45),
      cam(H('06 04:30'), P.sme, 12.6, 50),
      cam(H('06 05:20'), [-0.7, 49.47], 9.0, 40),
      cam(H('06 06:00'), [-0.95, 49.43], 10.6, 45),
      cam(H('06 06:32'), [-1.175, 49.42], 12.4, 55, -20),
      cam(H('06 06:50'), [-0.875, 49.38], 12.6, 55),
      cam(H('06 07:12'), P.hoc, 14.2, 60, 30),
      cam(H('06 07:32'), [-0.56, 49.345], 12.2, 50),
      cam(H('06 07:55'), [-0.43, 49.335], 12.2, 50),
      cam(H('06 08:40'), [-0.3, 49.29], 12.2, 50),
      cam(H('06 11:30'), [-0.9, 49.37], 12.4, 50),
      cam(H('06 13:00'), [-0.274, 49.245], 13.2, 55),
      cam(H('06 16:30'), [-0.37, 49.25], 11.2, 45),
      cam(H('06 20:00'), [-0.355, 49.3], 12.0, 50),
      cam(H('06 21:00'), [-0.24, 49.23], 11.6, 45),
      cam(H('06 23:00'), [-0.75, 49.33], 9.6, 30),
      cam(H('07 00:00'), [-0.75, 49.35], 9.4, 25),
    ],
    bookmarks: [
      { name: 'Utah', center: P.utah, zoom: 12.5, bearing: 0, pitch: 45 },
      { name: 'Omaha', center: P.omaha, zoom: 12.5, bearing: 0, pitch: 45 },
      { name: 'Pointe du Hoc', center: P.hoc, zoom: 14.5, bearing: 30, pitch: 60 },
      { name: 'Gold', center: P.gold, zoom: 12.5, bearing: 0, pitch: 45 },
      { name: 'Juno', center: P.juno, zoom: 12.5, bearing: 0, pitch: 45 },
      { name: 'Sword', center: P.sword, zoom: 12.5, bearing: 0, pitch: 45 },
      { name: 'Pegasus Bridge', center: P.pegasus, zoom: 13.5, bearing: 0, pitch: 50 },
    ],
  });
}
