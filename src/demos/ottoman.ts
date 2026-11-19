/**
 * The rise of the Ottoman Empire, 1299–1683: from a Bithynian beylik to the
 * gates of Vienna. Approximate and illustrative.
 */
import { buildKit, ev, march, type KitRegion } from './kit';
import type { LonLat } from '../core/geo';
import type { Scenario } from '../core/scenario';

const F = [
  { id: 'ott', name: 'Ottoman Empire', color: '#c92a2a', capital: [28.98, 41.01] as LonLat },
  { id: 'byz', name: 'Byzantine Empire', color: '#7048e8' },
  { id: 'bey', name: 'Anatolian beyliks', color: '#ffc078' },
  { id: 'balk', name: 'Balkan kingdoms', color: '#74c0fc' },
  { id: 'hun', name: 'Kingdom of Hungary', color: '#40c057' },
  { id: 'mam', name: 'Mamluk Sultanate', color: '#fab005' },
  { id: 'saf', name: 'Safavid Persia', color: '#20c997' },
  { id: 'ven', name: 'Venice', color: '#e64980' },
  { id: 'hab', name: 'Habsburgs', color: '#ffd43b' },
  { id: 'pol', name: 'Poland–Lithuania', color: '#f783ac' },
  { id: 'maghreb', name: 'North African states', color: '#c0eb75' },
];

const REGIONS: KitRegion[] = [
  { name: 'Bithynia', ring: [[29.0, 40.9], [30.8, 41.1], [31.5, 40.4], [30.5, 39.7], [29.2, 39.9]], native: 'byz', phases: [['ott', 1299, 1331, [30.53, 39.78]]] },
  { name: 'Western Anatolia', ring: [[26.2, 40.0], [29.2, 39.9], [30.5, 39.7], [31.5, 38.0], [29.5, 36.6], [27.4, 36.9]], native: 'bey', phases: [['ott', 1336, 1425, [29.2, 39.9], 0.4]] },
  { name: 'Central & eastern Anatolia', ring: [[30.8, 41.1], [36, 41.6], [41.5, 41.5], [44.5, 40], [42, 38], [38, 37], [36.2, 36.6], [33, 36.1], [31.5, 38.0], [31.5, 40.4]], native: 'bey', phases: [['ott', 1354, 1474, [31.5, 40.0], 0.4]] },
  { name: 'Constantinople', ring: [[28.2, 41.5], [29.4, 41.5], [29.4, 40.85], [28.2, 40.85]], native: 'byz', phases: [['ott', 1453.27, 1453.42, [28.6, 41.1]]] },
  { name: 'Thrace', ring: [[26.3, 40.9], [28.2, 41.0], [28.2, 42.2], [26.0, 42.0], [25.5, 41.2]], native: 'byz', phases: [['ott', 1354, 1371, [26.6, 40.4]]] },
  { name: 'Bulgaria & Macedonia', ring: [[22.4, 41.1], [25.5, 41.2], [26.0, 42.0], [28.2, 42.2], [28.6, 43.7], [22.9, 44.1], [22.4, 42.3]], native: 'balk', phases: [['ott', 1371, 1396, [26.5, 41.8]]] },
  { name: 'Serbia & Bosnia', ring: [[18.8, 45.0], [22.9, 44.6], [22.4, 42.3], [20.2, 42.3], [19.0, 43.0], [15.8, 45.0]], native: 'balk', phases: [['ott', 1389.5, 1463.5, [21.2, 42.6], 0.45]] },
  { name: 'Greece & Albania', ring: [[19.3, 41.9], [22.4, 41.1], [24.0, 40.6], [24.0, 38.2], [23.2, 36.4], [21.6, 36.7], [20.2, 39.9]], native: 'byz', phases: [['ott', 1387, 1479, [22.9, 40.6], 0.45]] },
  { name: 'Wallachia & Moldavia (vassals)', ring: [[22.4, 44.6], [26.0, 43.7], [28.6, 43.7], [30.0, 45.3], [28.3, 48.1], [26.2, 48.3], [24.9, 47.7], [22.5, 45.5]], native: 'balk', phases: [['ott', 1417, 1504, [25.5, 44.3]]] },
  { name: 'Crimea (vassal)', ring: [[32.5, 45.4], [33.6, 46.2], [34.7, 46.1], [36.6, 45.4], [35.5, 44.4], [33.5, 44.4]], native: 'bey', phases: [['ott', 1475.4, 1475.6]] },
  { name: 'Syria & Palestine', ring: [[36.2, 36.6], [38, 37], [38.5, 35], [36.6, 32], [34.9, 31.3], [34.2, 31.3], [35.1, 33.2], [35.8, 34.6]], native: 'mam', phases: [['ott', 1516.6, 1516.95, [37.16, 36.5]]] },
  { name: 'Egypt', ring: [[34.2, 31.3], [32, 31.2], [29.5, 31], [25.5, 31.5], [25, 29], [30, 22], [33, 22], [35, 24], [34.5, 27.5], [32.5, 30]], native: 'mam', phases: [['ott', 1517.0, 1517.15, [34.2, 31.2]]] },
  { name: 'Hejaz', ring: [[35.0, 28.0], [38.5, 28.5], [41.5, 23.5], [42.5, 16.0], [38.8, 21.5]], native: 'mam', phases: [['ott', 1517.2, 1517.6]] },
  { name: 'Mesopotamia', ring: [[38, 37], [44.5, 37.5], [47, 34], [48.5, 30], [47, 29.5], [44, 31], [41, 33.5], [38.5, 35]], native: 'saf', phases: [['ott', 1534.5, 1535.3, [40, 37]]] },
  { name: 'Hungary', ring: [[16.1, 47.0], [17.0, 48.0], [22.1, 48.4], [22.9, 47.9], [21.0, 46.2], [18.8, 45.8], [16.6, 46.4]], native: 'hun', phases: [['ott', 1526.65, 1541.7, [18.68, 45.94], 0.4]] },
  { name: 'Royal Hungary', ring: [[16.1, 47.0], [17.0, 48.0], [17.3, 48.9], [19.5, 49.4], [22.1, 48.4], [17.0, 48.0]], native: 'hun', phases: [['hab', 1527, 1527.5]] },
  { name: 'Algeria & Tunisia', ring: [[-2.0, 35.2], [3.0, 36.9], [8.2, 37.1], [11.2, 37.2], [11.1, 35.2], [10.0, 33.5], [3.0, 33.5], [-1.5, 34.0]], native: 'maghreb', phases: [['ott', 1516, 1574.7, [3.05, 36.75], 0.5]] },
  { name: 'Libya', ring: [[11.5, 33.1], [15, 32.5], [20, 32.9], [25.5, 31.5], [25, 29], [19.8, 29], [11.5, 30]], native: 'maghreb', phases: [['ott', 1551.6, 1552, [13.2, 32.9]]] },
  { name: 'Cyprus', ring: [[32.2, 35.1], [34.6, 35.7], [34.0, 34.6], [32.4, 34.6]], native: 'ven', phases: [['ott', 1570.5, 1571.6, [33.0, 34.7]]] },
  { name: 'Crete', ring: [[23.4, 35.6], [26.4, 35.4], [26.2, 34.9], [23.6, 35.2]], native: 'ven', phases: [['ott', 1645.5, 1669.7, [23.8, 35.5], 0.5]] },
  { name: 'Podolia', ring: [[26.2, 48.3], [28.3, 48.1], [29.5, 48.5], [28.5, 49.6], [26.5, 49.5]], native: 'pol', phases: [['ott', 1672.6, 1672.8]] },
];

const UNITS = [
  march('osman', 'Osman I', 'ott', [[[30.15, 39.95], 1299], [[29.96, 40.15], 1301.6], [[29.06, 40.19], 1326.3]], 'army', 5000),
  march('murad', 'Murad I at Kosovo', 'ott', [[[26.55, 41.68], 1389.3], [[23.32, 42.7], 1389.4], [[21.1, 42.67], 1389.47]], 'army', 30000),
  march('timur', 'Timur (Tamerlane)', 'bey', [[[44.8, 41.7], 1401.9], [[38.95, 40.1], 1402.3], [[32.86, 39.93], 1402.57]], 'army', 140000),
  march('mehmed', 'Mehmed II', 'ott', [[[26.55, 41.68], 1453.2], [[28.93, 41.02], 1453.27], [[28.98, 41.01], 1453.41]], 'army', 80000),
  march('mehmed-fleet', 'Ottoman fleet (over the Galata hill)', 'ott', [[[28.5, 40.9], 1453.25], [[28.97, 41.02], 1453.3], [[28.97, 41.035], 1453.31]], 'fleet', 100),
  march('selim', 'Selim I against the Mamluks', 'ott', [[[28.98, 41.01], 1516.35], [[37.16, 36.5], 1516.64], [[36.3, 33.5], 1516.8], [[34.45, 31.5], 1516.95], [[31.24, 30.04], 1517.07]], 'army', 60000),
  march('suleiman-mohacs', 'Suleiman the Magnificent', 'ott', [[[28.98, 41.01], 1526.3], [[20.46, 44.8], 1526.55], [[18.68, 45.94], 1526.66], [[19.04, 47.5], 1526.7], [[28.98, 41.01], 1526.9]], 'army', 60000),
  march('suleiman-vienna', 'Suleiman’s march on Vienna', 'ott', [[[28.98, 41.01], 1529.35], [[19.04, 47.5], 1529.68], [[16.37, 48.21], 1529.74], [[19.04, 47.5], 1529.85]], 'army', 120000),
  march('lepanto-ott', 'Ottoman fleet (Ali Pasha)', 'ott', [[[21.73, 38.25], 1571.75], [[21.1, 38.25], 1571.77]], 'fleet', 280),
  march('lepanto-hl', 'Holy League fleet (Don John)', 'ven', [[[15.55, 38.19], 1571.7], [[20.5, 38.5], 1571.76], [[21.1, 38.25], 1571.77]], 'fleet', 210),
  march('kara', 'Kara Mustafa Pasha', 'ott', [[[26.55, 41.68], 1683.25], [[20.46, 44.8], 1683.45], [[17.9, 47.7], 1683.5], [[16.37, 48.21], 1683.54], [[16.37, 48.21], 1683.7]], 'army', 150000),
  march('sobieski', 'Jan III Sobieski (relief of Vienna)', 'pol', [[[19.94, 50.06], 1683.6], [[16.9, 48.6], 1683.68], [[16.33, 48.27], 1683.7]], 'army', 70000),
];

const EVENTS = [
  ev(1299.5, [30.15, 39.95], 'Osman I founds the beylik', 'founding'),
  ev(1326.3, [29.06, 40.19], 'Conquest of Bursa', 'siege', 'Bursa becomes the first Ottoman capital.'),
  ev(1354.2, [26.67, 40.41], 'Gallipoli: a foothold in Europe', 'note'),
  ev(1369, [26.55, 41.68], 'Edirne becomes the capital', 'founding'),
  ev(1389.47, [21.1, 42.67], 'Battle of Kosovo', 'battle', 'Both Sultan Murad I and Prince Lazar are killed.'),
  ev(1396.73, [24.97, 43.62], 'Battle of Nicopolis', 'battle', 'A crusading army is destroyed.'),
  ev(1402.57, [32.86, 39.93], 'Battle of Ankara', 'battle', 'Timur captures Sultan Bayezid; the Ottoman interregnum follows.'),
  ev(1444.86, [27.9, 43.2], 'Battle of Varna', 'battle'),
  ev(1453.41, [28.98, 41.01], 'Fall of Constantinople', 'siege', 'Mehmed II ends the Byzantine Empire after a 53-day siege.'),
  ev(1517.07, [31.24, 30.04], 'Conquest of Cairo', 'siege', 'The Mamluk Sultanate falls; the sultan takes the title of caliph.'),
  ev(1526.66, [18.68, 45.94], 'Battle of Mohács', 'battle', 'King Louis II of Hungary is killed.'),
  ev(1529.74, [16.37, 48.21], 'First siege of Vienna', 'siege', 'Winter forces Suleiman to withdraw.'),
  ev(1538.74, [20.75, 38.95], 'Battle of Preveza', 'battle', 'Barbarossa wins control of the eastern Mediterranean.'),
  ev(1565.4, [14.51, 35.9], 'Great Siege of Malta', 'siege', 'The Knights Hospitaller hold out.'),
  ev(1571.77, [21.1, 38.25], 'Battle of Lepanto', 'battle', 'The Holy League destroys the Ottoman fleet.'),
  ev(1669.7, [25.13, 35.34], 'Fall of Candia', 'siege', 'Ends a 21-year siege of Crete.'),
  ev(1683.7, [16.33, 48.27], 'Battle of Vienna', 'battle', 'The winged hussars break the siege — the high-water mark of Ottoman expansion.'),
];

export async function buildOttomanDemo(): Promise<Scenario> {
  return buildKit({
    title: 'The Rise of the Ottoman Empire (illustrative)',
    description: 'From Osman’s beylik in 1299 to the siege of Vienna in 1683: Constantinople, the Balkans, the Mamluk lands, Hungary and the Mediterranean. Approximate and illustrative.',
    start: 1298.5,
    end: 1684,
    res: 4,
    basemap: 'parchment',
    view: { center: [28, 40], zoom: 3.3 },
    runSeconds: 150,
    eventFraction: 0.01,
    factions: F,
    regions: REGIONS,
    units: UNITS,
    events: EVENTS,
    eras: [
      { name: 'Ottoman interregnum', start: 1402.57, end: 1413.5, color: '#ced4da' },
      { name: 'Mehmed the Conqueror', start: 1451.1, end: 1481.3, color: '#ff8787' },
      { name: 'Suleiman the Magnificent', start: 1520.7, end: 1566.7, color: '#fa5252' },
      { name: 'Great Turkish War', start: 1683.5, end: 1684, color: '#ffd43b' },
    ],
    annotations: [
      { text: 'Black Sea', position: [34.5, 43.3], units: 'meters', size: 80000, color: '#5c7a80' },
      { text: 'Mediterranean Sea', position: [22, 34.2], units: 'meters', size: 110000, color: '#5c7a80' },
    ],
    camera: 'auto',
  });
}
