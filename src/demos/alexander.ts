/**
 * Alexander the Great and the Wars of the Diadochi, 336–300 BCE.
 * Years use astronomical numbering (336 BCE = -335). Approximate and illustrative.
 */
import { buildKit, ev, march, type KitRegion } from './kit';
import type { LonLat } from '../core/geo';
import type { Scenario } from '../core/scenario';

/** 336 → -335 (BCE year to astronomical), with an optional fraction of the year. */
const B = (y: number, f = 0) => 1 - y + f;

const F = [
  { id: 'mac', name: 'Macedon', color: '#7048e8', capital: [22.52, 40.76] as LonLat },
  { id: 'per', name: 'Achaemenid Persia', color: '#f59f00', capital: [52.89, 29.93] as LonLat },
  { id: 'gr', name: 'Greek city-states', color: '#74c0fc' },
  { id: 'ind', name: 'Indian kingdoms', color: '#2b8a3e' },
  { id: 'ptol', name: 'Ptolemaic Egypt', color: '#e64980', capital: [29.92, 31.2] as LonLat },
  { id: 'sel', name: 'Seleucid Empire', color: '#40c057', capital: [44.42, 32.54] as LonLat },
  { id: 'ant', name: 'Antigonus', color: '#fd7e14' },
  { id: 'cas', name: 'Cassander (Macedon)', color: '#9775fa' },
  { id: 'lys', name: 'Lysimachus (Thrace)', color: '#22b8cf' },
  { id: 'mau', name: 'Maurya Empire', color: '#a9e34b' },
];

const REGIONS: KitRegion[] = [
  { name: 'Macedon', ring: [[20.5, 40.3], [22, 41.3], [24.2, 41.3], [24.2, 40.6], [23, 40.2], [22.6, 39.9], [21, 39.9]], native: 'mac', phases: [['cas', B(316), B(316, 0.3)]] },
  { name: 'Greece', ring: [[20.2, 39.9], [23, 40.2], [24, 38.2], [23.2, 36.4], [21.6, 36.7], [20.7, 38.3]], native: 'gr', phases: [['mac', B(335, 0.3), B(335, 0.6), [22.6, 40.2]], ['cas', B(316), B(316, 0.4)]] },
  { name: 'Thrace', ring: [[23, 40.8], [24.2, 41.3], [26.3, 40.9], [28.9, 41.2], [28, 42.3], [25.5, 42.6], [23, 42.4]], native: 'mac', phases: [['lys', B(323, 0.6), B(323, 0.8)]] },
  { name: 'Anatolia', ring: [[26.2, 40.0], [29, 41.2], [33, 42], [36, 41.6], [41.5, 41.5], [44.5, 40], [38, 37], [36.2, 36.6], [32, 36.1], [27.4, 36.9]], native: 'per', phases: [['mac', B(334, 0.4), B(333, 0.85), [26.4, 40.1]], ['ant', B(321), B(321, 0.4)], ['lys', B(301, 0.6), B(301, 0.95), [26.4, 40.1]]] },
  { name: 'Levant', ring: [[36.2, 36.6], [38, 37], [38.5, 35], [36.6, 32], [34.9, 31.3], [34.2, 31.3], [35.1, 33.2], [35.8, 34.6]], native: 'per', phases: [['mac', B(333, 0.87), B(332, 0.85), [36.2, 36.6]], ['ant', B(315), B(315, 0.3)], ['ptol', B(301, 0.6), B(301, 0.9), [34.3, 31.3]]] },
  { name: 'Egypt', ring: [[34.2, 31.3], [32, 31.2], [29.5, 31], [25.5, 31.5], [25, 29], [30, 22], [33, 22], [35, 24], [34.5, 27.5], [32.5, 30]], native: 'per', phases: [['mac', B(332, 0.85), B(332, 0.95), [32.5, 31]], ['ptol', B(323, 0.6), B(323, 0.7)]] },
  { name: 'Mesopotamia', ring: [[38, 37], [44.5, 37.5], [47, 34], [48.5, 30], [47, 29.5], [44, 31], [41, 33.5], [38.5, 35]], native: 'per', phases: [['mac', B(331, 0.75), B(331, 0.95), [43.4, 36.4]], ['sel', B(312, 0.3), B(312, 0.6), [44.4, 32.5]]] },
  { name: 'Persia & Media', ring: [[44.5, 40], [48, 39], [54, 37.5], [61, 36.5], [61, 31], [58, 26], [51, 27.5], [48.5, 30], [47, 34], [44.5, 37.5]], native: 'per', phases: [['mac', B(331, 0.95), B(330, 0.6), [47.5, 32.5]], ['sel', B(312, 0.6), B(311, 0.5), [47.5, 33]]] },
  { name: 'Bactria & Sogdiana', ring: [[61, 36.5], [64, 39.5], [69, 41.5], [71, 40.3], [71, 37], [69, 34.5], [65, 35], [61, 34]], native: 'per', phases: [['mac', B(329, 0.4), B(327, 0.1), [62, 36]], ['sel', B(308), B(306), [62, 36]]] },
  { name: 'Arachosia & Gandhara', ring: [[61, 34], [65, 35], [69, 34.5], [71.5, 35.5], [74, 34], [72, 31], [69, 29], [66, 26], [61, 25.5], [61, 31]], native: 'per', phases: [['mac', B(330, 0.7), B(327, 0.6), [62, 32]], ['sel', B(312), B(311, 0.5)], ['mau', B(305), B(303, 0.5), [74, 31]]] },
  { name: 'Indus valley', ring: [[72, 31], [74, 34], [75.5, 32.5], [74.5, 30], [72, 25.5], [68.5, 23.6], [68, 24], [69, 29]], native: 'ind', phases: [['mac', B(326, 0.3), B(325, 0.7), [72.5, 33.8]], ['mau', B(317), B(316, 0.5), [74.5, 30]]] },
];

const ALEX: [LonLat, number][] = [
  [[22.52, 40.76], B(334, 0.25)], [[26.4, 40.15], B(334, 0.38)], [[27.4, 40.2], B(334, 0.4)], [[28.04, 38.48], B(334, 0.45)], [[27.42, 37.04], B(334, 0.7)],
  [[31.98, 39.65], B(333, 0.25)], [[36.2, 36.84], B(333, 0.87)], [[35.2, 33.27], B(332, 0.55)], [[34.45, 31.5], B(332, 0.8)], [[31.25, 29.85], B(332, 0.9)],
  [[29.92, 31.2], B(331, 0.05)], [[25.52, 29.2], B(331, 0.15)], [[31.25, 29.85], B(331, 0.3)], [[35.2, 33.27], B(331, 0.45)], [[43.43, 36.36], B(331, 0.75)],
  [[44.42, 32.54], B(331, 0.8)], [[48.25, 32.19], B(331, 0.95)], [[52.89, 29.93], B(330, 0.05)], [[48.5, 34.8], B(330, 0.45)], [[53.5, 35.6], B(330, 0.5)],
  [[61.2, 34.3], B(330, 0.8)], [[65.7, 31.6], B(329, 0.1)], [[66.9, 36.76], B(329, 0.4)], [[66.97, 39.65], B(329, 0.6)], [[69.6, 40.28], B(329, 0.7)],
  [[66.9, 36.76], B(328, 0.5)], [[66.97, 39.65], B(328, 0.8)], [[66.9, 36.76], B(327, 0.1)], [[69.2, 34.5], B(327, 0.4)], [[72.83, 33.75], B(326, 0.3)],
  [[73.6, 32.9], B(326, 0.4)], [[75.0, 31.5], B(326, 0.6)], [[73.6, 32.9], B(326, 0.8)], [[71.5, 29.5], B(325, 0.2)], [[68.4, 24.7], B(325, 0.4)],
  [[61.0, 27.3], B(325, 0.75)], [[52.89, 29.93], B(324, 0.0)], [[48.25, 32.19], B(324, 0.15)], [[48.5, 34.8], B(324, 0.7)], [[44.42, 32.54], B(323, 0.4)],
];

const UNITS = [
  march('alex', 'Alexander’s army', 'mac', ALEX, 'army', 47000),
  march('nearchus', 'Nearchus’ fleet', 'mac', [[[68.4, 24.7], B(325, 0.75)], [[66, 25.0], B(325, 0.85)], [[61, 25.2], B(325, 0.95)], [[57.5, 25.7], B(324, 0.05)], [[56.3, 27.0], B(324, 0.1)], [[51, 28.9], B(324, 0.2)], [[48.5, 30], B(324, 0.25)]], 'fleet', 3000),
  march('darius', 'Darius III', 'per', [[[48.5, 34.8], B(333, 0.6)], [[36.2, 36.84], B(333, 0.87)], [[44.42, 32.54], B(332, 0.1)], [[43.43, 36.36], B(331, 0.75)], [[48.5, 34.8], B(331, 0.85)], [[53.5, 35.6], B(330, 0.5)]], 'army', 50000),
  march('antigonus', 'Antigonus & Demetrius', 'ant', [[[32.0, 39.6], B(302, 0.2)], [[31.1, 38.7], B(301, 0.5)]], 'army', 80000),
  march('seleucus', 'Seleucus (with war elephants)', 'sel', [[[44.42, 32.54], B(302, 0.3)], [[38, 37], B(302, 0.7)], [[31.1, 38.7], B(301, 0.5)]], 'army', 64000),
];

const EVENTS = [
  ev(B(336, 0.8), [22.32, 40.48], 'Assassination of Philip II', 'note', 'Alexander, aged 20, becomes king of Macedon.'),
  ev(B(335, 0.7), [23.32, 38.32], 'Destruction of Thebes', 'disaster', 'The rebellious city is razed as a warning to Greece.'),
  ev(B(334, 0.4), [27.4, 40.2], 'Battle of the Granicus', 'battle', 'Alexander’s first victory over the Persian satraps.'),
  ev(B(334, 0.7), [27.42, 37.04], 'Siege of Halicarnassus', 'siege'),
  ev(B(333, 0.25), [31.98, 39.65], 'The Gordian Knot', 'note', 'Legend says whoever untied it would rule Asia.'),
  ev(B(333, 0.87), [36.2, 36.84], 'Battle of Issus', 'battle', 'Darius III flees, abandoning his family.'),
  ev(B(332, 0.55), [35.2, 33.27], 'Siege of Tyre', 'siege', 'A seven-month siege ends after Alexander builds a causeway to the island city.'),
  ev(B(331, 0.05), [29.92, 31.2], 'Founding of Alexandria', 'founding'),
  ev(B(331, 0.15), [25.52, 29.2], 'Oracle of Siwa', 'note', 'Alexander is hailed as son of Zeus-Ammon.'),
  ev(B(331, 0.75), [43.43, 36.36], 'Battle of Gaugamela', 'battle', 'The decisive defeat of the Persian Empire.'),
  ev(B(330, 0.3), [52.89, 29.93], 'Burning of Persepolis', 'disaster'),
  ev(B(330, 0.5), [53.5, 35.6], 'Death of Darius III', 'note', 'Murdered by his own satrap Bessus.'),
  ev(B(327, 0.1), [66.9, 36.76], 'Marriage to Roxana', 'note'),
  ev(B(326, 0.4), [73.6, 32.9], 'Battle of the Hydaspes', 'battle', 'Victory over King Porus and his war elephants.'),
  ev(B(326, 0.6), [75.0, 31.5], 'Mutiny at the Hyphasis', 'note', 'Exhausted, the army refuses to march further east.'),
  ev(B(325, 0.75), [61.0, 27.3], 'Crossing of the Gedrosian Desert', 'disaster', 'Thousands die of thirst and heat.'),
  ev(B(324, 0.15), [48.25, 32.19], 'Susa weddings', 'treaty', 'Macedonian officers marry Persian noblewomen.'),
  ev(B(323, 0.45), [44.42, 32.54], 'Death of Alexander', 'note', 'Alexander dies in Babylon aged 32; his generals divide the empire.'),
  ev(B(323, 0.5), [44.42, 32.54], 'Partition of Babylon', 'treaty'),
  ev(B(312, 0.3), [44.42, 32.54], 'Seleucus takes Babylon', 'founding', 'The start of the Seleucid era.'),
  ev(B(305), [29.92, 31.2], 'Ptolemy I crowned king', 'founding'),
  ev(B(303), [74, 31], 'Treaty with Chandragupta', 'treaty', 'Seleucus cedes the east to the Maurya Empire for 500 war elephants.'),
  ev(B(301, 0.5), [31.1, 38.7], 'Battle of Ipsus', 'battle', 'Antigonus is killed; his realm is carved up.'),
];

export async function buildAlexanderDemo(): Promise<Scenario> {
  return buildKit({
    title: 'Alexander the Great (illustrative)',
    description: 'From the accession of Alexander in 336 BCE to the Battle of Ipsus in 301 BCE: the conquest of the Persian Empire, the march to India and the wars of his successors. Approximate and illustrative.',
    start: B(336, 0.5),
    end: B(301, 0.99),
    res: 4,
    basemap: 'parchment',
    view: { center: [45, 33], zoom: 3.0 },
    runSeconds: 120,
    eventFraction: 0.015,
    factions: F,
    regions: REGIONS,
    units: UNITS,
    events: EVENTS,
    eras: [
      { name: 'Conquest of Persia', start: B(334, 0.3), end: B(330, 0.5), color: '#9775fa' },
      { name: 'Central Asia', start: B(330, 0.5), end: B(327, 0.3), color: '#e599f7' },
      { name: 'India', start: B(327, 0.3), end: B(325, 0.5), color: '#8ce99a' },
      { name: 'Wars of the Diadochi', start: B(322), end: B(301, 0.99), color: '#ffc078' },
    ],
    annotations: [
      { text: 'Mediterranean Sea', position: [22, 34.2], units: 'meters', size: 120000, color: '#5c7a80' },
      { text: 'Persian Gulf', position: [51, 27.2], units: 'meters', size: 70000, color: '#5c7a80' },
      { text: 'Hindu Kush', position: [70, 35.6], units: 'meters', size: 60000, color: '#8d7b5a' },
    ],
    camera: 'auto',
  });
}
