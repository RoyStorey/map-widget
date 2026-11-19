/**
 * The early Islamic conquests, 622–763: the Rashidun and Umayyad caliphates
 * and the Abbasid revolution. Approximate and illustrative.
 */
import { buildKit, ev, march, type KitRegion } from './kit';
import type { LonLat } from '../core/geo';
import type { Scenario } from '../core/scenario';

const F = [
  { id: 'cal', name: 'Rashidun & Umayyad Caliphate', color: '#2b8a3e', capital: [36.3, 33.51] as LonLat },
  { id: 'abb', name: 'Abbasid Caliphate', color: '#343a40', capital: [44.36, 33.31] as LonLat },
  { id: 'arab', name: 'Arabian tribes', color: '#ffe066' },
  { id: 'byz', name: 'Byzantine Empire', color: '#7048e8', capital: [28.98, 41.01] as LonLat },
  { id: 'sas', name: 'Sasanian Empire', color: '#e8590c', capital: [44.58, 33.09] as LonLat },
  { id: 'vis', name: 'Visigothic Kingdom', color: '#fab005' },
  { id: 'ber', name: 'Berbers', color: '#c0eb75' },
  { id: 'sog', name: 'Sogdians & Turks', color: '#ff8787' },
  { id: 'ind', name: 'Sindh', color: '#20c997' },
  { id: 'frank', name: 'Franks', color: '#4dabf7' },
];

const REGIONS: KitRegion[] = [
  { name: 'Anatolia', ring: [[26.2, 40.0], [29, 41.2], [33, 42], [36, 41.6], [41.5, 41.5], [42.0, 38.5], [38, 37], [36.2, 36.6], [32, 36.1], [27.4, 36.9]], native: 'byz' },
  { name: 'Hejaz & Arabia', ring: [[35.0, 28.0], [39.0, 29.5], [46.5, 29.3], [48.5, 28.0], [51.5, 24.0], [56.4, 26.2], [59.8, 22.5], [52.0, 16.5], [43.2, 12.6], [42.5, 16.0], [38.8, 21.5]], native: 'arab', phases: [['cal', 622.5, 633, [39.61, 24.47]], ['abb', 750.1, 750.6, [44, 30]]] },
  { name: 'Levant', ring: [[35.0, 28.0], [36.2, 36.6], [38, 37], [38.5, 35], [39, 29.5], [35.0, 28.0], [34.2, 31.3], [35.1, 33.2], [35.8, 34.6]], native: 'byz', phases: [['cal', 634, 638.5, [36.0, 31.0]], ['abb', 750.0, 750.4, [38.5, 35]]] },
  { name: 'Mesopotamia', ring: [[38, 37], [44.5, 37.5], [47, 34], [48.5, 30], [47, 29.5], [44, 31], [41, 33.5], [38.5, 35]], native: 'sas', phases: [['cal', 633, 638, [46.5, 30.5]], ['abb', 749.7, 750.1, [44.3, 32.0]]] },
  { name: 'Egypt', ring: [[34.2, 31.3], [32, 31.2], [29.5, 31], [25.5, 31.5], [25, 29], [30, 22], [33, 22], [35, 24], [34.5, 27.5], [32.5, 30]], native: 'byz', phases: [['cal', 639.95, 642, [34.0, 31.1]], ['abb', 750.4, 750.7]] },
  { name: 'Persia', ring: [[44.5, 38.5], [48, 39], [54, 37.5], [61, 36.5], [61, 31], [58, 26], [51, 27.5], [48.5, 30], [47, 34], [44.5, 37.5]], native: 'sas', phases: [['cal', 637.5, 651.5, [46, 33.5]], ['abb', 748, 749.6, [59.5, 36.3]]] },
  { name: 'Armenia & Caucasus', ring: [[41.5, 41.5], [46.0, 42.0], [49.5, 40.5], [48, 39], [44.5, 38.5], [42.0, 38.5], [41.0, 39.5]], native: 'byz', phases: [['cal', 645, 655, [44.5, 38.5]], ['abb', 750.2, 750.6]] },
  { name: 'Cyrenaica & Tripolitania', ring: [[25.5, 31.5], [20, 32.9], [15, 32.5], [11.5, 33.1], [11.5, 30], [19.8, 29], [25, 29]], native: 'byz', phases: [['cal', 642.5, 647, [25.2, 31.3]], ['abb', 750.6, 751]] },
  { name: 'Ifriqiya', ring: [[8.2, 37.1], [11.2, 37.2], [11.1, 35.2], [11.5, 33.1], [10.0, 33.5], [8.3, 34.0]], native: 'byz', phases: [['cal', 670, 698.5, [10.1, 35.7]], ['abb', 761, 762]] },
  { name: 'Maghreb', ring: [[-9.8, 35.8], [-5.9, 35.9], [-2.0, 35.2], [3.0, 36.9], [8.2, 37.1], [8.3, 34.0], [3.0, 33.5], [-3.0, 32.0], [-9.5, 31.0]], native: 'ber', phases: [['cal', 681, 710.5, [8.3, 35.5]]] },
  { name: 'Iberia', ring: [[-9.5, 37.0], [-6.3, 36.8], [-2.0, 36.7], [0.2, 38.7], [3.3, 42.3], [-1.8, 43.0], [-5.0, 42.8], [-8.9, 42.0], [-9.5, 38.7]], native: 'vis', phases: [['cal', 711.35, 718.5, [-5.6, 36.1]]] },
  { name: 'Asturias', ring: [[-8.9, 43.8], [-1.8, 43.4], [-1.8, 43.0], [-5.0, 42.8], [-8.9, 42.0]], native: 'vis', phases: [['cal', 714, 715.5], ['vis', 722.4, 740, [-5.1, 43.3]]] },
  { name: 'Septimania', ring: [[3.1, 42.4], [3.2, 43.1], [4.5, 43.4], [4.8, 44.0], [3.5, 44.3], [1.5, 43.6], [1.8, 42.4]], native: 'vis', phases: [['cal', 719, 725, [2.9, 42.7]], ['frank', 752, 759.5, [4.5, 43.6]]] },
  { name: 'Khorasan & Transoxiana', ring: [[61, 36.5], [64, 39.5], [69, 41.5], [72.5, 41.0], [71, 37], [69, 34.5], [65, 35], [61, 34]], native: 'sog', phases: [['cal', 651.5, 715.5, [61.8, 37.6], 0.4], ['abb', 747.45, 748.5, [61.83, 37.6]]] },
  { name: 'Sindh', ring: [[66.5, 25.0], [68.5, 23.6], [72, 25.5], [74.5, 30], [72, 31], [69, 29], [66.5, 27.5]], native: 'ind', phases: [['cal', 711.5, 713.8, [67.6, 24.7]], ['abb', 751, 752]] },
];

const UNITS = [
  march('khalid', 'Khalid ibn al-Walid', 'cal', [[[39.61, 24.47], 633.1], [[46.0, 31.0], 633.4], [[43.8, 33.4], 633.9], [[38.8, 34.0], 634.2], [[36.3, 33.5], 634.4], [[35.95, 32.8], 636.6], [[36.72, 34.73], 637.0], [[37.16, 36.2], 637.6]], 'army', 15000),
  march('saad', 'Saʿd ibn Abi Waqqas', 'cal', [[[39.61, 24.47], 636.3], [[44.3, 31.9], 636.85], [[44.58, 33.09], 637.2], [[45.6, 34.5], 637.9]], 'army', 30000),
  march('amr', 'ʿAmr ibn al-ʿAs', 'cal', [[[34.5, 31.5], 639.9], [[32.55, 31.05], 640.05], [[31.23, 30.0], 641.3], [[29.92, 31.2], 641.9], [[20.07, 32.12], 643.5], [[13.2, 32.9], 643.9]], 'army', 12000),
  march('tariq', 'Tariq ibn Ziyad', 'cal', [[[-5.8, 35.77], 711.3], [[-5.35, 36.14], 711.35], [[-5.9, 36.6], 711.55], [[-4.78, 37.88], 711.7], [[-4.02, 39.86], 711.85]], 'army', 7000),
  march('musa', 'Musa ibn Nusayr', 'cal', [[[-5.35, 36.14], 712.4], [[-5.99, 37.39], 712.6], [[-6.34, 38.92], 713.4], [[-4.02, 39.86], 713.8], [[-0.88, 41.65], 714.4]], 'army', 18000),
  march('ghafiqi', 'ʿAbd al-Rahman al-Ghafiqi', 'cal', [[[-1.64, 42.81], 732.45], [[-0.58, 44.84], 732.6], [[0.34, 46.58], 732.75], [[0.5, 46.85], 732.8]], 'army', 20000),
  march('martel', 'Charles Martel', 'frank', [[[2.35, 48.85], 732.65], [[0.69, 47.39], 732.75], [[0.5, 46.85], 732.8]], 'army', 15000),
  march('qutayba', 'Qutayba ibn Muslim', 'cal', [[[61.83, 37.6], 705.3], [[64.42, 39.77], 709.5], [[66.97, 39.65], 712.5], [[71.8, 40.4], 714.5], [[72.8, 40.8], 715.3]], 'army', 20000),
  march('qasim', 'Muhammad ibn Qasim', 'cal', [[[52.5, 29.6], 710.8], [[60.6, 25.3], 711.3], [[67.6, 24.7], 711.7], [[68.4, 25.4], 712.1], [[71.47, 30.2], 713.5]], 'army', 12000),
  march('abumuslim', 'Abu Muslim (Abbasid revolution)', 'abb', [[[61.83, 37.6], 747.45], [[58.8, 36.2], 748.2], [[51.4, 35.7], 749.0], [[44.32, 32.03], 749.7], [[43.6, 36.0], 750.07]], 'army', 30000),
  march('maslama', 'Siege of Constantinople (Maslama)', 'cal', [[[36.3, 33.5], 716.8], [[30.5, 39.5], 717.2], [[28.98, 41.01], 717.6], [[28.98, 41.01], 718.6], [[32.0, 37.0], 718.9]], 'army', 80000),
];

const EVENTS = [
  ev(622.5, [39.61, 24.47], 'The Hijra', 'founding', 'Muhammad migrates from Mecca to Medina; year 1 of the Islamic calendar.'),
  ev(624.2, [38.78, 23.73], 'Battle of Badr', 'battle'),
  ev(630.05, [39.83, 21.42], 'Conquest of Mecca', 'note'),
  ev(632.45, [39.61, 24.47], 'Death of Muhammad', 'note', 'Abu Bakr becomes the first caliph.'),
  ev(636.6, [35.95, 32.8], 'Battle of Yarmouk', 'battle', 'Byzantine power in Syria collapses.'),
  ev(636.9, [44.3, 31.9], 'Battle of al-Qadisiyyah', 'battle', 'The Sasanian army is defeated.'),
  ev(637.2, [44.58, 33.09], 'Fall of Ctesiphon', 'siege', 'The Sasanian capital is taken.'),
  ev(637.4, [35.23, 31.78], 'Surrender of Jerusalem', 'treaty'),
  ev(641.9, [29.92, 31.2], 'Fall of Alexandria', 'siege'),
  ev(642.3, [48.37, 34.19], 'Battle of Nahavand', 'battle', '“The victory of victories.”'),
  ev(651.6, [61.83, 37.6], 'Death of Yazdegerd III', 'note', 'The last Sasanian shah is killed near Merv.'),
  ev(655.4, [30.5, 36.2], 'Battle of the Masts', 'battle', 'The caliphate’s new navy defeats the Byzantine fleet.'),
  ev(661.1, [36.3, 33.51], 'The Umayyad dynasty', 'founding', 'Muʿawiya rules from Damascus.'),
  ev(680.8, [44.03, 32.6], 'Battle of Karbala', 'battle'),
  ev(698.5, [10.32, 36.85], 'Fall of Carthage', 'siege'),
  ev(711.55, [-5.9, 36.6], 'Battle of Guadalete', 'battle', 'King Roderic is defeated; Visigothic Spain falls within a few years.'),
  ev(717.6, [28.98, 41.01], 'Siege of Constantinople', 'siege', 'Greek fire and a harsh winter break the siege.', { end: 718.65 }),
  ev(722.4, [-5.07, 43.31], 'Battle of Covadonga', 'battle', 'Pelagius founds the Kingdom of Asturias.'),
  ev(732.8, [0.5, 46.85], 'Battle of Tours', 'battle', 'Charles Martel halts the raid into Francia.'),
  ev(750.07, [43.6, 36.0], 'Battle of the Zab', 'battle', 'The Abbasids overthrow the Umayyads.'),
  ev(751.5, [72.0, 42.5], 'Battle of Talas', 'battle', 'Abbasids defeat the Tang Chinese in Central Asia.'),
  ev(756.4, [-4.78, 37.88], 'Emirate of Córdoba', 'founding', 'Umayyad survivor ʿAbd al-Rahman I rules al-Andalus.'),
  ev(762.6, [44.36, 33.31], 'Founding of Baghdad', 'founding', 'The Round City of al-Mansur.'),
];

export async function buildCaliphateDemo(): Promise<Scenario> {
  return buildKit({
    title: 'The Early Islamic Conquests (illustrative)',
    description: 'From the Hijra in 622 to the founding of Baghdad in 762: the Rashidun and Umayyad conquests from Iberia to the Indus, and the Abbasid revolution. Approximate and illustrative.',
    start: 621.5,
    end: 763,
    res: 4,
    basemap: 'parchment',
    view: { center: [30, 32], zoom: 2.8 },
    runSeconds: 150,
    eventFraction: 0.015,
    factions: F,
    regions: REGIONS,
    units: UNITS,
    events: EVENTS,
    eras: [
      { name: 'Prophet Muhammad', start: 622.5, end: 632.45, color: '#8ce99a' },
      { name: 'Rashidun Caliphate', start: 632.45, end: 661.1, color: '#69db7c' },
      { name: 'Umayyad Caliphate', start: 661.1, end: 750.1, color: '#51cf66' },
      { name: 'Abbasid Caliphate', start: 750.1, end: 763, color: '#adb5bd' },
    ],
    annotations: [
      { text: 'Mediterranean Sea', position: [18, 34.2], units: 'meters', size: 120000, color: '#5c7a80' },
      { text: 'Arabian Desert', position: [45, 23], units: 'meters', size: 100000, color: '#8d7b5a' },
    ],
    camera: 'auto',
  });
}
