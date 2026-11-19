/**
 * Demo: major global shipping lanes with thousands of animated vessels.
 * Waypoints are hand-placed to stay at sea; volumes are illustrative.
 */
import { emptyScenario, defaultDataStyle, type Route, type Scenario } from '../core/scenario';
import type { LonLat } from '../core/geo';

const P: Record<string, LonLat> = {
  shanghai: [122.6, 30.9], ningbo: [122.4, 29.8], busan: [129.3, 34.9], tokyo: [139.9, 34.9], hk: [114.4, 21.9], taiwanS: [120.6, 21.5],
  scs1: [113, 16], scs2: [109.5, 9], singapore: [104.3, 1.25], malacca1: [100.6, 3.0], malacca2: [97.6, 5.6], achin: [95.0, 6.3],
  srilanka: [80.6, 5.4], arabian: [64, 13], aden: [48, 12.4], babel: [43.3, 12.6], redsea1: [39.5, 18.5], redsea2: [34.8, 26.8],
  suezS: [32.6, 29.7], suezN: [32.35, 31.4], med1: [28, 33.6], med2: [19, 35.5], sicily: [11.8, 37.3], med3: [4, 37.8], gibraltar: [-5.6, 35.95],
  portugal: [-10.2, 38.5], finisterre: [-10.2, 43.6], ushant: [-6, 48.5], channel: [-1.5, 50.1], dover: [1.6, 51.0], rotterdam: [3.9, 52.05], hamburg: [8.2, 54.0],
  hormuz: [56.6, 26.5], gulf: [52.2, 26.6], rasTanura: [50.4, 26.9], omanSea: [59, 23.5],
  madagascarE: [52, -18], mozambique: [41, -21], durban: [33, -31], cape: [18.5, -35.6], angola: [8, -20], gulfGuinea: [2, -2], senegal: [-19, 14], canaries: [-17, 28.5],
  panamaN: [-79.9, 9.45], panamaS: [-79.5, 8.7], caribbean: [-76, 14.5], windward: [-73.9, 19.9], bahamas: [-74.5, 25.5], ny: [-73.8, 40.35], nyOff: [-70, 39.5],
  floridaStr: [-80.6, 24.2], gom: [-89, 26.5], houston: [-94.7, 29.2], sabine: [-93.8, 29.5],
  la: [-118.3, 33.65], npac1: [-135, 38], npac2: [-165, 44], npac3: [165, 40], japanS: [141.5, 33.8], seattle: [-124.8, 48.45], juanDeFuca: [-123.3, 48.3],
  santos: [-46.2, -24.1], brazilNE: [-34.6, -6], brazilE: [-37.5, -15], atlMid: [-25, 10], atlN: [-35, 45], atlN2: [-55, 42],
  sunda: [105.8, -6.2], indOcE: [110, -14], hedland: [118.6, -20.0], wa: [113, -25], perth: [115.2, -32.2], bight: [130, -37], bass: [146.5, -39.6], sydney: [151.5, -33.9],
  pacS1: [-100, -5], callao: [-77.3, -12.1], valparaiso: [-71.8, -33.0],
};

type RouteDef = [name: string, kind: 'container' | 'tanker' | 'bulk' | 'lng', points: string[], volume: number, opts?: Partial<Route>];

const COLORS = { container: '#4dabf7', tanker: '#ff6b6b', bulk: '#69db7c', lng: '#e599f7' };

const ROUTES: RouteDef[] = [
  ['Asia – Europe (Suez)', 'container', ['shanghai', 'taiwanS', 'hk', 'scs1', 'scs2', 'singapore', 'malacca1', 'malacca2', 'achin', 'srilanka', 'arabian', 'aden', 'babel', 'redsea1', 'redsea2', 'suezS', 'suezN', 'med1', 'med2', 'sicily', 'med3', 'gibraltar', 'portugal', 'finisterre', 'ushant', 'channel', 'dover', 'rotterdam'], 10, { end: 2023.95 }],
  ['Asia – Europe (via Cape, Red Sea diversion)', 'container', ['shanghai', 'taiwanS', 'hk', 'scs1', 'scs2', 'singapore', 'malacca1', 'malacca2', 'achin', 'srilanka', 'madagascarE', 'durban', 'cape', 'angola', 'gulfGuinea', 'senegal', 'canaries', 'portugal', 'finisterre', 'ushant', 'channel', 'dover', 'rotterdam'], 10, { start: 2023.95 }],
  ['Transpacific', 'container', ['shanghai', 'japanS', 'npac3', 'npac2', 'npac1', 'la'], 9],
  ['Transpacific North', 'container', ['busan', 'japanS', 'npac3', 'npac2', 'seattle', 'juanDeFuca'], 5],
  ['Transatlantic', 'container', ['rotterdam', 'dover', 'channel', 'ushant', 'atlN', 'atlN2', 'nyOff', 'ny'], 6],
  ['Asia – US East Coast (Panama)', 'container', ['shanghai', 'japanS', 'npac3', [-170, 28] as any, [-120, 15] as any, [-90, 8] as any, 'panamaS', 'panamaN', 'caribbean', 'windward', 'bahamas', 'nyOff', 'ny'], 5],
  ['Intra-Asia', 'container', ['busan', 'shanghai', 'ningbo', 'taiwanS', 'hk', 'scs1', 'scs2', 'singapore'], 7],
  ['Hamburg feeder', 'container', ['rotterdam', 'hamburg'], 3],
  ['Gulf crude → Asia', 'tanker', ['rasTanura', 'gulf', 'hormuz', 'omanSea', 'arabian', 'srilanka', 'achin', 'malacca2', 'malacca1', 'singapore', 'scs2', 'scs1', 'hk', 'taiwanS', 'ningbo'], 8],
  ['Gulf crude → Europe (Cape)', 'tanker', ['rasTanura', 'gulf', 'hormuz', 'omanSea', 'madagascarE', 'durban', 'cape', 'angola', 'gulfGuinea', 'senegal', 'canaries', 'portugal', 'finisterre', 'ushant', 'channel', 'rotterdam'], 4],
  ['US Gulf LNG → Europe', 'lng', ['sabine', 'gom', 'floridaStr', 'bahamas', 'atlN2', 'atlN', 'ushant', 'channel', 'rotterdam'], 4, { start: 2016.1 }],
  ['Qatar LNG → East Asia', 'lng', ['gulf', 'hormuz', 'omanSea', 'arabian', 'srilanka', 'achin', 'malacca2', 'malacca1', 'singapore', 'scs2', 'scs1', 'taiwanS', 'busan', 'tokyo'], 4],
  ['Iron ore: Pilbara → China', 'bulk', ['hedland', 'indOcE', 'sunda', [107, -4] as any, [106.5, 2] as any, 'scs2', 'scs1', 'hk', 'taiwanS', 'shanghai'], 7],
  ['Iron ore: Brazil → China', 'bulk', ['santos', 'brazilE', [-20, -28] as any, 'cape', [40, -38] as any, [80, -30] as any, 'indOcE', 'sunda', [107, -4] as any, [106.5, 2] as any, 'scs2', 'scs1', 'hk', 'shanghai'], 4],
  ['Grain: US Gulf → Asia (Panama)', 'bulk', ['houston', 'gom', [-84, 22] as any, 'caribbean', 'panamaN', 'panamaS', [-100, 12] as any, [-150, 20] as any, [170, 30] as any, 'japanS', 'shanghai'], 3],
  ['Europe – South America', 'container', ['rotterdam', 'channel', 'ushant', 'finisterre', 'canaries', 'atlMid', 'brazilNE', 'brazilE', 'santos'], 3],
  ['Australia – Asia', 'container', ['sydney', 'bass', 'bight', 'perth', 'wa', 'indOcE', 'sunda', 'singapore'], 3],
  ['West coast South America – Asia', 'bulk', ['valparaiso', 'callao', 'pacS1', [-150, 10] as any, [170, 25] as any, 'japanS', 'shanghai'], 3],
];

const PORTS: [string, LonLat, number][] = [
  ['Shanghai', [121.8, 31.2], 49], ['Singapore', [103.85, 1.27], 39], ['Ningbo-Zhoushan', [121.9, 29.9], 35], ['Shenzhen', [114.1, 22.5], 30], ['Qingdao', [120.3, 36.1], 28],
  ['Guangzhou', [113.5, 22.8], 25], ['Busan', [129.05, 35.1], 22], ['Tianjin', [117.7, 38.97], 21], ['Hong Kong', [114.15, 22.3], 15], ['Rotterdam', [4.1, 51.95], 14],
  ['Dubai (Jebel Ali)', [55.05, 25.0], 14], ['Port Klang', [101.3, 3.0], 13], ['Antwerp-Bruges', [4.3, 51.3], 13], ['Xiamen', [118.1, 24.45], 12], ['Los Angeles / Long Beach', [-118.25, 33.75], 17],
  ['Tanjung Pelepas', [103.55, 1.36], 10], ['Hamburg', [9.95, 53.53], 8], ['New York / New Jersey', [-74.1, 40.67], 9], ['Santos', [-46.3, -23.95], 5], ['Colombo', [79.85, 6.95], 7],
  ['Piraeus', [23.6, 37.94], 5], ['Algeciras', [-5.43, 36.13], 5], ['Tanger Med', [-5.5, 35.88], 8], ['Port Said', [32.3, 31.25], 4], ['Ras Tanura', [50.16, 26.64], 6],
  ['Port Hedland', [118.6, -20.31], 6], ['Houston', [-95.0, 29.6], 4], ['Sydney (Botany)', [151.22, -33.97], 3], ['Durban', [31.03, -29.87], 3], ['Valparaíso', [-71.62, -33.03], 2],
];

export async function buildShippingDemo(): Promise<Scenario> {
  const s = emptyScenario({ title: 'Global shipping lanes', start: 2023.0, end: 2025.0, speed: 2 / 60, eventDuration: 0.15, h3Resolution: 3, basemap: 'dark-atlas', view: { center: [60, 15], zoom: 1.7 } });
  s.meta.description = 'Illustrative major sea lanes with animated container ships, tankers, bulk carriers and LNG carriers. Volumes and routings are approximate. Watch the Asia–Europe trade divert around the Cape of Good Hope at the end of 2023.';
  s.factions = [];
  s.routes = ROUTES.map(([name, kind, pts, volume, opts], i) => ({
    id: `route_${i}`,
    name,
    color: COLORS[kind],
    waypoints: pts.map((p) => (typeof p === 'string' ? P[p] : (p as unknown as LonLat))),
    vessels: Math.round(volume * 22),
    speedKnots: kind === 'container' ? 20 : kind === 'lng' ? 18 : 13,
    volume,
    bidirectional: kind === 'container',
    description: `${kind[0].toUpperCase()}${kind.slice(1)} trade`,
    ...opts,
  }));
  s.layers = [
    {
      id: 'ports',
      name: 'Major container ports (M TEU, approx.)',
      visible: true,
      data: { type: 'FeatureCollection', features: PORTS.map(([name, pos, teu]) => ({ type: 'Feature', properties: { name, teu }, geometry: { type: 'Point', coordinates: pos } })) },
      style: defaultDataStyle({ render: 'scatter', color: '#ffd43b', radius: 3, opacity: 0.9, weightField: 'teu', labelField: 'name' }),
    },
  ];
  s.events = [
    { id: 'ev1', t: 2023.55, position: [-79.7, 9.1], title: 'Panama Canal drought restrictions', kind: 'disaster', description: 'Low water levels in Gatun Lake force draft limits and fewer daily transits.', zoom: 6, end: 2024.3 },
    { id: 'ev2', t: 2023.88, position: [43.3, 12.6], title: 'Red Sea attacks on shipping', kind: 'battle', description: 'Attacks near Bab-el-Mandeb push major carriers to reroute via the Cape of Good Hope.', zoom: 5, end: 2024.4 },
    { id: 'ev3', t: 2023.97, position: [18.5, -35.6], title: 'Mass diversion around the Cape', kind: 'note', description: 'Asia–Europe services add roughly 10–14 days per voyage.', zoom: 4, end: 2024.6 },
    { id: 'ev4', t: 2024.25, position: [-76.5, 39.2], title: 'Baltimore bridge collapse', kind: 'disaster', description: 'A container ship strikes the Francis Scott Key Bridge, closing the port for weeks.', zoom: 8 },
  ];
  s.flows = [
    { id: 'fl1', from: [121.5, 31.2], to: [4.1, 51.9], value: 24, color: '#4dabf7', label: 'China → Europe (containers)' },
    { id: 'fl2', from: [121.5, 31.2], to: [-118.2, 33.7], value: 20, color: '#4dabf7', label: 'China → US West Coast' },
    { id: 'fl3', from: [50.2, 26.6], to: [121.9, 29.9], value: 18, color: '#ff6b6b', label: 'Gulf → China (crude)' },
    { id: 'fl4', from: [-93.8, 29.6], to: [4.1, 51.9], value: 10, color: '#e599f7', label: 'US → Europe (LNG)' },
    { id: 'fl5', from: [118.6, -20.3], to: [121.5, 31.2], value: 16, color: '#69db7c', label: 'Australia → China (iron ore)' },
  ];
  s.annotations = [
    { id: 'a1', text: 'Strait of Malacca', position: [99.5, 4.5], units: 'pixels', size: 12, color: '#9fb4d0' },
    { id: 'a2', text: 'Suez Canal', position: [32.4, 30.6], units: 'pixels', size: 12, color: '#9fb4d0' },
    { id: 'a3', text: 'Panama Canal', position: [-79.7, 9.0], units: 'pixels', size: 12, color: '#9fb4d0' },
    { id: 'a4', text: 'Cape of Good Hope', position: [18.5, -34.4], units: 'pixels', size: 12, color: '#9fb4d0' },
    { id: 'a5', text: 'Strait of Hormuz', position: [56.4, 26.6], units: 'pixels', size: 12, color: '#9fb4d0' },
    { id: 'a6', text: 'Bab-el-Mandeb', position: [43.4, 12.6], units: 'pixels', size: 12, color: '#9fb4d0' },
  ];
  s.camera = [
    { t: 2023.0, center: [60, 15], zoom: 1.7, bearing: 0, pitch: 0 },
    { t: 2023.5, center: [-80, 12], zoom: 3.8, bearing: 0, pitch: 30 },
    { t: 2023.85, center: [42, 16], zoom: 4.3, bearing: -10, pitch: 35 },
    { t: 2024.05, center: [22, -28], zoom: 3.4, bearing: 0, pitch: 20 },
    { t: 2024.4, center: [100, 5], zoom: 4.2, bearing: 20, pitch: 40 },
    { t: 2025.0, center: [60, 15], zoom: 1.7, bearing: 0, pitch: 0 },
  ];
  s.bookmarks = [
    { id: 'b1', name: 'Strait of Malacca', center: [100.5, 3.5], zoom: 5.5, bearing: 0, pitch: 30 },
    { id: 'b2', name: 'Suez & Red Sea', center: [36, 22], zoom: 4.5, bearing: 0, pitch: 0 },
    { id: 'b3', name: 'English Channel', center: [1, 50.5], zoom: 6, bearing: 0, pitch: 0 },
    { id: 'b4', name: 'Panama', center: [-79.7, 9.2], zoom: 7, bearing: 0, pitch: 30 },
  ];
  return s;
}
