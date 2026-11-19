/**
 * The rise of Rome, 264 BCE – 117 CE: from the Punic Wars to the empire at its
 * greatest extent under Trajan. Approximate and illustrative.
 */
import { buildKit, ev, march, type KitRegion } from './kit';
import type { LonLat } from '../core/geo';
import type { Scenario } from '../core/scenario';

/** BCE year (with optional fraction) → astronomical decimal year. */
const B = (y: number, f = 0) => 1 - y + f;

const F = [
  { id: 'rome', name: 'Rome', color: '#c92a2a', capital: [12.48, 41.9] as LonLat },
  { id: 'carth', name: 'Carthage', color: '#7950f2', capital: [10.32, 36.85] as LonLat },
  { id: 'gaul', name: 'Gauls', color: '#82c91e' },
  { id: 'iber', name: 'Iberians & Celtiberians', color: '#fab005' },
  { id: 'numid', name: 'Numidia', color: '#e67700' },
  { id: 'hell', name: 'Hellenistic kingdoms', color: '#4dabf7' },
  { id: 'sel', name: 'Seleucid Empire', color: '#20c997' },
  { id: 'ptol', name: 'Ptolemaic Egypt', color: '#f783ac' },
  { id: 'pontus', name: 'Pontus', color: '#9c36b5' },
  { id: 'parth', name: 'Parthia', color: '#868e96' },
  { id: 'brit', name: 'Britons', color: '#94d82d' },
  { id: 'dacia', name: 'Dacians', color: '#ffd43b' },
  { id: 'germ', name: 'Germanic tribes', color: '#2f9e44' },
  { id: 'trib', name: 'Alpine & Danubian tribes', color: '#c0eb75' },
];

const REGIONS: KitRegion[] = [
  { name: 'Peninsular Italy', ring: [[10.0, 44.0], [12.4, 44.2], [14.0, 42.6], [16.2, 41.9], [18.6, 40.2], [16.2, 37.9], [15.6, 38.3], [15.6, 40.1], [12.0, 41.6], [10.3, 43.4]], native: 'rome' },
  { name: 'Sicily', ring: [[12.3, 37.9], [15.7, 38.3], [15.1, 36.6], [12.4, 37.6]], native: 'carth', phases: [['rome', B(264), B(241, 0.4), [15.5, 38.2]]] },
  { name: 'Sardinia & Corsica', ring: [[8.3, 41.1], [9.6, 41.2], [9.8, 39.2], [8.4, 38.9], [8.1, 40.6], [8.6, 42.5], [9.6, 43.0], [9.6, 41.4]], native: 'carth', phases: [['rome', B(238), B(237)]] },
  { name: 'Cisalpine Gaul', ring: [[7.0, 45.9], [10.5, 46.6], [13.6, 46.2], [13.8, 45.6], [12.4, 44.2], [10.0, 44.0], [7.6, 43.9], [6.6, 44.4]], native: 'gaul', phases: [['rome', B(225), B(191), [11.3, 44.4]]] },
  { name: 'Carthaginian Spain', ring: [[-6.3, 36.8], [-2.0, 36.7], [0.2, 38.7], [0.6, 40.5], [-1.5, 40.3], [-5.0, 39.0], [-7.5, 37.6]], native: 'iber', phases: [['carth', B(237), B(219), [-6.0, 36.8]], ['rome', B(209), B(206), [0.6, 40.5]]] },
  { name: 'Interior & northern Iberia', ring: [[-9.5, 42.0], [-8.9, 43.7], [-1.8, 43.4], [3.3, 42.3], [0.6, 40.5], [-1.5, 40.3], [-5.0, 39.0], [-7.5, 37.6], [-9.5, 38.7]], native: 'iber', phases: [['rome', B(195), B(19), [0.6, 40.8], 0.4]] },
  { name: 'Africa (Carthage)', ring: [[8.2, 37.1], [11.2, 37.2], [11.1, 35.2], [10.0, 33.5], [8.3, 34.0]], native: 'carth', phases: [['rome', B(146, 0.2), B(146, 0.4), [10.3, 36.85]]] },
  { name: 'Numidia & Mauretania', ring: [[-9.8, 35.8], [-2.0, 35.2], [3.0, 36.9], [8.2, 37.1], [8.3, 34.0], [3.0, 33.5], [-3.0, 32.0], [-9.5, 31.0]], native: 'numid', phases: [['rome', B(46), 44, [8.2, 36.5]]] },
  { name: 'Macedonia & Greece', ring: [[19.3, 41.9], [22.0, 42.2], [24.2, 41.3], [26.3, 40.9], [24.0, 38.2], [23.2, 36.4], [21.6, 36.7], [20.2, 39.9]], native: 'hell', phases: [['rome', B(168, 0.5), B(146, 0.5), [22.6, 40.4]]] },
  { name: 'Asia (Pergamon)', ring: [[26.2, 40.0], [29.5, 40.8], [31.5, 39.0], [30.5, 37.0], [27.4, 36.9]], native: 'hell', phases: [['rome', B(133), B(129)]] },
  { name: 'Narbonese Gaul', ring: [[3.1, 42.4], [3.2, 43.1], [4.5, 43.4], [6.5, 43.1], [7.6, 43.8], [6.6, 45.1], [5.0, 45.5], [3.5, 44.5], [1.5, 43.6]], native: 'gaul', phases: [['rome', B(125), B(118), [4.8, 43.7]]] },
  { name: 'Gaul', ring: [[-4.8, 48.4], [-1.3, 49.7], [2.5, 51.1], [6.1, 51.8], [8.2, 49.0], [7.6, 47.6], [6.1, 46.2], [5.0, 45.5], [3.5, 44.5], [1.5, 43.6], [-1.8, 43.35], [-1.2, 46.2], [-2.5, 47.3]], native: 'gaul', phases: [['rome', B(58, 0.3), B(50, 0.5), [6.1, 46.2], 0.35]] },
  { name: 'Anatolia & Pontus', ring: [[29.5, 40.8], [33, 42], [36, 41.6], [41.5, 41.5], [41, 39], [36.5, 37.2], [33, 36.5], [31.5, 39.0]], native: 'pontus', phases: [['rome', B(74), B(63), [29.5, 40.5]]] },
  { name: 'Syria', ring: [[36.2, 36.6], [38, 37], [38.5, 35], [36.6, 32], [34.9, 31.3], [34.2, 31.3], [35.1, 33.2], [35.8, 34.6]], native: 'sel', phases: [['rome', B(64, 0.3), B(63, 0.6)]] },
  { name: 'Egypt', ring: [[34.2, 31.3], [32, 31.2], [29.5, 31], [25.5, 31.5], [25, 29], [30, 22], [33, 22], [35, 24], [34.5, 27.5], [32.5, 30]], native: 'ptol', phases: [['rome', B(30, 0.6), B(30, 0.7)]] },
  { name: 'Alps & Danube', ring: [[6.6, 46.0], [10.5, 47.5], [13.0, 48.5], [17.0, 48.2], [19.0, 47.5], [22.5, 44.6], [28.5, 44.2], [27.5, 42.5], [22.0, 42.2], [19.3, 41.9], [15.0, 45.0], [13.6, 46.2], [10.5, 46.6], [7.0, 45.9]], native: 'trib', phases: [['rome', B(16), 9, [10.5, 46.4]]] },
  { name: 'Germania (to the Elbe)', ring: [[6.1, 51.8], [8.8, 53.9], [10.8, 53.9], [12.0, 51.5], [12.1, 50.3], [10.0, 50.0], [8.2, 49.0]], native: 'germ', phases: [['rome', B(12), B(1), [6.5, 50.8]], ['germ', 9.7, 10.2, [8.13, 52.4]]] },
  { name: 'Britannia', ring: [[-5.7, 50.0], [1.5, 51.2], [1.8, 52.8], [-0.3, 54.6], [-2.0, 55.0], [-3.2, 54.9], [-3.4, 54.2], [-4.8, 52.0], [-5.3, 51.5]], native: 'brit', phases: [['rome', 43.4, 84, [1.3, 51.3]]] },
  { name: 'Dacia', ring: [[21.0, 46.5], [22.5, 47.8], [24.5, 47.6], [26.0, 46.5], [26.5, 45.3], [25.0, 44.0], [22.5, 44.6], [21.0, 45.3]], native: 'dacia', phases: [['rome', 101.3, 106.6, [22.6, 44.6]]] },
  { name: 'Mesopotamia & Armenia', ring: [[38, 37], [41, 39], [44.5, 40.5], [46.5, 39.5], [47, 34], [48.5, 30], [47, 29.5], [44, 31], [41, 33.5], [38.5, 35]], native: 'parth', phases: [['rome', 114, 116.5, [38.5, 37]], ['parth', 117.5, 118]] },
];

const UNITS = [
  march('hannibal', 'Hannibal', 'carth', [[[-0.98, 37.6], B(218, 0.3)], [[0.8, 40.7], B(218, 0.4)], [[2.5, 42.4], B(218, 0.5)], [[4.7, 44.1], B(218, 0.65)], [[6.9, 45.2], B(218, 0.8)], [[9.6, 45.0], B(218, 0.95)], [[12.1, 43.2], B(217, 0.5)], [[16.13, 41.3], B(216, 0.6)], [[14.25, 41.08], B(216, 0.8)], [[16.2, 40.6], B(210)], [[17.13, 39.08], B(204)], [[17.13, 39.08], B(203, 0.5)], [[10.6, 35.8], B(203, 0.8)], [[9.2, 36.0], B(202, 0.8)]], 'army', 50000),
  march('scipio', 'Scipio Africanus', 'rome', [[[12.48, 41.9], B(210, 0.6)], [[1.25, 41.12], B(210, 0.8)], [[-0.98, 37.6], B(209, 0.4)], [[-6.0, 37.5], B(206, 0.4)], [[15.1, 37.1], B(205, 0.6)], [[10.06, 37.06], B(204, 0.6)], [[9.2, 36.0], B(202, 0.8)]], 'army', 35000),
  march('caesar', 'Julius Caesar in Gaul', 'rome', [[[6.14, 46.2], B(58, 0.3)], [[4.03, 46.92], B(58, 0.45)], [[6.02, 47.24], B(58, 0.7)], [[3.5, 50.0], B(57, 0.5)], [[-3.0, 47.6], B(56, 0.5)], [[1.3, 51.2], B(55, 0.65)], [[2.0, 50.5], B(54, 0.5)], [[3.12, 45.71], B(52, 0.4)], [[4.5, 47.54], B(52, 0.7)]], 'army', 50000),
  march('rubicon', 'Caesar crosses the Rubicon', 'rome', [[[12.25, 44.15], B(49, 0.02)], [[12.48, 41.9], B(49, 0.25)], [[22.38, 39.3], B(48, 0.6)]], 'army', 22000),
  march('actium', 'Octavian’s fleet (Actium)', 'rome', [[[15.6, 38.2], B(31, 0.5)], [[20.6, 39.0], B(31, 0.7)], [[20.75, 38.95], B(31, 0.75)]], 'fleet', 400),
  march('claudius', 'Claudian invasion of Britain', 'rome', [[[1.6, 50.7], 43.3], [[1.35, 51.27], 43.4], [[0.9, 51.9], 43.6]], 'fleet', 40000),
  march('trajan', 'Trajan in Dacia', 'rome', [[[12.48, 41.9], 101.2], [[22.6, 44.6], 101.5], [[23.31, 45.62], 102.6], [[22.6, 44.6], 105.5], [[23.31, 45.62], 106.5]], 'army', 100000),
];

const EVENTS = [
  ev(B(264), [15.55, 38.19], 'First Punic War begins', 'battle', 'Rome intervenes in Sicily.'),
  ev(B(241, 0.2), [12.05, 37.95], 'Battle of the Aegates', 'battle', 'Rome’s new navy wins the war at sea.'),
  ev(B(218, 0.8), [6.9, 45.2], 'Hannibal crosses the Alps', 'note', 'With an army and war elephants.'),
  ev(B(216, 0.6), [16.13, 41.3], 'Battle of Cannae', 'battle', 'Hannibal’s masterpiece: a Roman army is encircled and destroyed.'),
  ev(B(202, 0.8), [9.2, 36.0], 'Battle of Zama', 'battle', 'Scipio defeats Hannibal; Carthage sues for peace.'),
  ev(B(168, 0.5), [22.6, 40.37], 'Battle of Pydna', 'battle', 'The end of the Macedonian kingdom.'),
  ev(B(146, 0.3), [10.32, 36.85], 'Destruction of Carthage', 'disaster', '“Carthago delenda est.”'),
  ev(B(146, 0.5), [22.93, 37.9], 'Sack of Corinth', 'disaster'),
  ev(B(52, 0.7), [4.5, 47.54], 'Siege of Alesia', 'siege', 'Vercingetorix surrenders to Caesar.'),
  ev(B(49, 0.02), [12.4, 44.1], 'Caesar crosses the Rubicon', 'note', '“The die is cast” — civil war begins.'),
  ev(B(48, 0.6), [22.38, 39.3], 'Battle of Pharsalus', 'battle', 'Caesar defeats Pompey.'),
  ev(B(44, 0.2), [12.48, 41.9], 'Assassination of Caesar', 'note', 'The Ides of March.'),
  ev(B(31, 0.75), [20.75, 38.95], 'Battle of Actium', 'battle', 'Octavian defeats Antony and Cleopatra.'),
  ev(B(27), [12.48, 41.9], 'Augustus becomes emperor', 'founding', 'The Republic gives way to the Principate.'),
  ev(9.7, [8.13, 52.4], 'Battle of the Teutoburg Forest', 'battle', 'Three legions are annihilated; Rome withdraws to the Rhine.'),
  ev(43.4, [1.35, 51.27], 'Invasion of Britain', 'battle', 'Claudius’ legions land at Richborough.'),
  ev(64.55, [12.48, 41.9], 'Great Fire of Rome', 'disaster'),
  ev(79.65, [14.43, 40.82], 'Eruption of Vesuvius', 'disaster', 'Pompeii and Herculaneum are buried.'),
  ev(106.6, [23.31, 45.62], 'Fall of Sarmizegetusa', 'siege', 'Dacia becomes a province; Trajan’s Column records the war.'),
  ev(116.5, [44.5, 31.0], 'Rome reaches the Persian Gulf', 'note', 'The empire at its greatest extent.'),
  ev(117.6, [36.17, 36.2], 'Death of Trajan', 'note', 'Hadrian gives up Mesopotamia.'),
];

export async function buildRomeDemo(): Promise<Scenario> {
  return buildKit({
    title: 'The Rise of Rome (illustrative)',
    description: 'From the First Punic War in 264 BCE to the empire at its greatest extent under Trajan in 117 CE. Approximate and illustrative.',
    start: B(264),
    end: 118.5,
    res: 4,
    basemap: 'parchment',
    view: { center: [15, 41], zoom: 3.4 },
    runSeconds: 150,
    eventFraction: 0.01,
    factions: F,
    regions: REGIONS,
    units: UNITS,
    events: EVENTS,
    eras: [
      { name: 'First Punic War', start: B(264), end: B(241, 0.4), color: '#b197fc' },
      { name: 'Second Punic War', start: B(218, 0.3), end: B(201), color: '#9775fa' },
      { name: 'Caesar in Gaul', start: B(58, 0.3), end: B(50, 0.5), color: '#a9e34b' },
      { name: 'Civil wars', start: B(49), end: B(30, 0.7), color: '#ff8787' },
      { name: 'Pax Romana', start: B(27), end: 118.5, color: '#ffc9c9' },
    ],
    annotations: [
      { text: 'Mare Nostrum', position: [18, 35], units: 'meters', size: 120000, color: '#5c7a80' },
      { text: 'Pontus Euxinus', position: [34.5, 43.3], units: 'meters', size: 70000, color: '#5c7a80' },
    ],
    camera: 'auto',
  });
}
