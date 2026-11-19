/**
 * Demo: Napoleonic Europe 1799–1815 using whole-country control. Modern
 * borders act as rough proxies – illustrative only.
 */
import { emptyScenario, type CountryEvent, type MapEvent, type Scenario, type Unit } from '../core/scenario';
import { timestampPath, type LonLat } from '../core/geo';

// ISO 3166-1 numeric codes (Natural Earth ids)
const C = { FRA: '250', BEL: '056', NLD: '528', ITA: '380', ESP: '724', PRT: '620', DEU: '276', AUT: '040', POL: '616', CHE: '756', HRV: '191', SVN: '705', RUS: '643', GBR: '826', TUR: '792', SWE: '752', DNK: '208', CZE: '203', HUN: '348', BLR: '112', UKR: '804', LTU: '440', GRC: '300', LUX: '442', IRL: '372' };

const FACTIONS = [
  { id: 'fr', name: 'French Empire', color: '#2f6fd6', capital: [2.35, 48.86] as LonLat },
  { id: 'client', name: 'French client states', color: '#8fb3ef' },
  { id: 'uk', name: 'Britain', color: '#d6334a', capital: [-0.12, 51.5] as LonLat },
  { id: 'ru', name: 'Russia', color: '#2b8a3e', capital: [30.3, 59.94] as LonLat },
  { id: 'at', name: 'Austria', color: '#f2c94c', capital: [16.37, 48.21] as LonLat },
  { id: 'pr', name: 'Prussia & German states', color: '#495057' },
  { id: 'es', name: 'Spain & Portugal', color: '#e8590c' },
  { id: 'ot', name: 'Ottoman Empire', color: '#a61e4d' },
  { id: 'sc', name: 'Scandinavia', color: '#74c0fc' },
];

const ce = (t: number, faction: string | null, ...countries: string[]): CountryEvent[] => countries.map((country) => ({ country, t, faction }));

function unit(id: string, name: string, faction: string, legs: [LonLat, number][], kind: Unit['kind'] = 'army', strength?: number): Unit {
  const path: [number, number, number][] = [];
  for (let i = 0; i < legs.length - 1; i++) {
    const seg = timestampPath([legs[i][0], legs[i + 1][0]], legs[i][1], legs[i + 1][1]);
    if (i) seg.shift();
    path.push(...seg);
  }
  return { id, name, faction, path, kind, strength, width: 4 };
}

export async function buildNapoleonDemo(): Promise<Scenario> {
  const s = emptyScenario({ title: 'Napoleonic Europe (illustrative)', start: 1799, end: 1816, speed: 17 / 75, eventDuration: 0.8, h3Resolution: 4, basemap: 'parchment', view: { center: [14, 50], zoom: 3.4 } });
  s.meta.description = 'Whole-country control using modern borders as rough proxies for the states of 1799–1815, with major campaigns and battles. Illustrative only.';
  s.factions = FACTIONS.map((f) => ({ ...f }));
  s.countries = [
    ...ce(1799, 'fr', C.FRA, C.BEL, C.LUX),
    ...ce(1799, 'uk', C.GBR, C.IRL),
    ...ce(1799, 'ru', C.RUS, C.BLR, C.UKR, C.LTU),
    ...ce(1799, 'at', C.AUT, C.CZE, C.HUN, C.HRV, C.SVN),
    ...ce(1799, 'pr', C.DEU, C.POL),
    ...ce(1799, 'es', C.ESP, C.PRT),
    ...ce(1799, 'ot', C.TUR, C.GRC),
    ...ce(1799, 'sc', C.SWE, C.DNK),
    ...ce(1799, 'client', C.NLD, C.CHE),
    ...ce(1800.5, 'client', C.ITA),
    ...ce(1806.6, 'client', C.DEU),
    ...ce(1807.5, 'client', C.POL),
    ...ce(1808.4, 'client', C.ESP),
    ...ce(1809.8, 'fr', C.SVN, C.HRV),
    ...ce(1810.5, 'fr', C.NLD),
    ...ce(1813.5, 'es', C.ESP),
    ...ce(1813.8, 'pr', C.DEU),
    ...ce(1813.9, 'ru', C.POL),
    ...ce(1813.9, 'uk', C.NLD),
    ...ce(1814.0, 'at', C.SVN, C.HRV, C.ITA),
    ...ce(1814.25, null, C.FRA, C.BEL, C.LUX),
    ...ce(1815.2, 'fr', C.FRA),
    ...ce(1815.5, null, C.FRA),
    ...ce(1815.5, 'uk', C.BEL),
    ...ce(1815.6, 'client', C.NLD),
  ];
  s.units = [
    unit('marengo', 'Army of the Reserve', 'fr', [[[5.9, 45.6], 1800.35], [[7.2, 45.85], 1800.39], [[8.68, 44.89], 1800.45]], 'army', 40000),
    unit('austerlitz', 'Grande Armée (1805)', 'fr', [[[1.6, 50.7], 1805.65], [[8.4, 49.0], 1805.73], [[10.0, 48.4], 1805.8], [[16.37, 48.2], 1805.87], [[16.76, 49.13], 1805.92]], 'army', 200000),
    unit('nelson', "Nelson's fleet", 'uk', [[[-9.5, 38.0], 1805.72], [[-6.5, 36.4], 1805.8], [[-6.0, 36.3], 1805.81]], 'fleet', 18000),
    unit('jena', 'Grande Armée (1806)', 'fr', [[[10.9, 49.9], 1806.74], [[11.58, 50.93], 1806.78], [[13.4, 52.52], 1806.82], [[21.0, 52.2], 1806.9], [[21.0, 54.45], 1807.45], [[21.88, 55.08], 1807.52]], 'army', 180000),
    unit('wellington', 'Wellington', 'uk', [[[-9.14, 38.72], 1809.3], [[-4.8, 39.96], 1809.55], [[-9.14, 38.72], 1810.8], [[-6.97, 40.6], 1812.0], [[-5.67, 40.97], 1812.55], [[-2.67, 42.85], 1813.47], [[1.44, 43.6], 1814.28]], 'army', 60000),
    unit('russia', 'Grande Armée (1812)', 'fr', [[[2.35, 48.85], 1812.2], [[13.4, 52.5], 1812.38], [[23.9, 54.9], 1812.48], [[32.04, 54.78], 1812.62], [[35.8, 55.52], 1812.68], [[37.6, 55.75], 1812.7], [[37.6, 55.75], 1812.8], [[32.04, 54.78], 1812.87], [[28.6, 54.3], 1812.9], [[25.28, 54.68], 1812.95], [[13.4, 52.5], 1813.05]], 'army', 600000),
    unit('kutuzov', 'Kutuzov', 'ru', [[[30.3, 55.0], 1812.55], [[35.8, 55.52], 1812.68], [[37.0, 55.3], 1812.75], [[33.5, 54.6], 1812.86], [[28.6, 54.3], 1812.9]], 'army', 120000),
    unit('leipzig', 'Grande Armée (1813)', 'fr', [[[11.0, 50.98], 1813.32], [[13.74, 51.05], 1813.6], [[12.37, 51.34], 1813.79], [[8.68, 50.1], 1813.84], [[2.35, 48.85], 1813.95]], 'army', 190000),
    unit('waterloo', 'Armée du Nord', 'fr', [[[2.35, 48.85], 1815.45], [[4.44, 50.41], 1815.46], [[4.4, 50.68], 1815.47]], 'army', 70000),
  ];
  const ev = (t: number, p: LonLat, title: string, kind: MapEvent['kind'], description: string, faction?: string): MapEvent => ({ id: `n_${title.replace(/\W/g, '')}`, t, position: p, title, kind, description, faction, zoom: 6 });
  s.events = [
    ev(1799.86, [2.35, 48.86], 'Coup of 18 Brumaire', 'founding', 'Napoleon Bonaparte seizes power as First Consul.', 'fr'),
    ev(1800.45, [8.68, 44.89], 'Battle of Marengo', 'battle', 'French victory secures northern Italy.', 'fr'),
    ev(1804.92, [2.35, 48.85], 'Coronation of Napoleon', 'founding', 'Napoleon crowns himself Emperor in Notre-Dame.', 'fr'),
    ev(1805.81, [-6.0, 36.3], 'Battle of Trafalgar', 'battle', 'The Royal Navy destroys the Franco-Spanish fleet.', 'uk'),
    ev(1805.92, [16.76, 49.13], 'Battle of Austerlitz', 'battle', 'Napoleon defeats Russia and Austria — the Battle of the Three Emperors.', 'fr'),
    ev(1806.78, [11.58, 50.93], 'Jena–Auerstedt', 'battle', 'Prussia is shattered in a single day.', 'fr'),
    ev(1807.45, [21.0, 54.45], 'Battle of Friedland', 'battle', 'Decisive victory over Russia.', 'fr'),
    ev(1807.52, [21.88, 55.08], 'Treaties of Tilsit', 'treaty', 'Peace with Russia and Prussia; Duchy of Warsaw created.'),
    ev(1809.51, [16.56, 48.3], 'Battle of Wagram', 'battle', 'Austria defeated again.', 'fr'),
    ev(1812.68, [35.8, 55.52], 'Battle of Borodino', 'battle', 'The bloodiest day of the Napoleonic Wars.', 'fr'),
    ev(1812.71, [37.6, 55.75], 'Fire of Moscow', 'disaster', 'Moscow burns shortly after the French arrive.', 'ru'),
    ev(1812.9, [28.6, 54.3], 'Crossing of the Berezina', 'disaster', 'The shattered Grande Armée escapes across the river.', 'fr'),
    ev(1813.47, [-2.67, 42.85], 'Battle of Vitoria', 'battle', "Wellington breaks French power in Spain.", 'uk'),
    ev(1813.79, [12.37, 51.34], 'Battle of Leipzig', 'battle', 'The Battle of the Nations — Napoleon is driven from Germany.', 'pr'),
    ev(1814.3, [10.3, 42.8], 'Exile to Elba', 'note', 'Napoleon abdicates and is exiled.'),
    ev(1815.2, [7.0, 43.55], 'The Hundred Days', 'founding', 'Napoleon returns from Elba and retakes power.', 'fr'),
    ev(1815.45, [16.37, 48.21], 'Congress of Vienna', 'treaty', 'The great powers redraw the map of Europe.'),
    ev(1815.47, [4.4, 50.68], 'Battle of Waterloo', 'battle', 'Final defeat of Napoleon.', 'uk'),
  ];
  s.eras = [
    { id: 'e1', name: 'Consulate', start: 1799.86, end: 1804.92, color: '#a5d8ff' },
    { id: 'e2', name: 'First French Empire', start: 1804.92, end: 1814.3, color: '#4dabf7' },
    { id: 'e3', name: 'War of the Third Coalition', start: 1805.3, end: 1805.99, color: '#ffc078' },
    { id: 'e4', name: 'Peninsular War', start: 1808.2, end: 1814.3, color: '#ff8787' },
    { id: 'e5', name: 'Russian campaign', start: 1812.47, end: 1812.97, color: '#8ce99a' },
    { id: 'e6', name: 'Hundred Days', start: 1815.2, end: 1815.52, color: '#e599f7' },
  ];
  s.camera = [
    { t: 1799, center: [14, 50], zoom: 3.4, bearing: 0, pitch: 0 },
    { t: 1805.7, center: [12, 49], zoom: 4.6, bearing: 0, pitch: 30 },
    { t: 1806, center: [14, 50], zoom: 3.6, bearing: 0, pitch: 0 },
    { t: 1812.4, center: [28, 54], zoom: 4.4, bearing: 10, pitch: 35 },
    { t: 1813.1, center: [20, 52], zoom: 3.8, bearing: 0, pitch: 10 },
    { t: 1813.8, center: [12.4, 51.3], zoom: 5.2, bearing: 0, pitch: 35 },
    { t: 1815.4, center: [4.4, 50.6], zoom: 6.5, bearing: 0, pitch: 40 },
    { t: 1816, center: [14, 50], zoom: 3.4, bearing: 0, pitch: 0 },
  ];
  return s;
}
