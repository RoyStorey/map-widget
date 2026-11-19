/**
 * Demo: the Mongol conquests, 1200–1280.
 *
 * Borders, dates and routes are deliberately approximate – this scenario is a
 * showcase of the widget's features, not a historical reference.
 */
import { cellToLatLng } from 'h3-js';
import type { LonLat } from '../core/geo';
import { timestampPath } from '../core/geo';
import { cellTouchesLand, polygonCells, waveEvents } from '../core/conquest';
import { isLand, loadLandMask } from '../core/landmask';
import { emptyScenario, type CellEvent, type MapEvent, type Scenario, type Unit } from '../core/scenario';

const RES = 4;

interface Region {
  key: string;
  native: string | null;
  ring: LonLat[];
  origin: LonLat;
  conquest: [number, number];
  successor: string | ((lon: number, lat: number) => string);
}

const REGIONS: Region[] = [
  { key: 'mongolia', native: 'tribes', ring: [[88, 50], [100, 52.5], [110, 51.5], [118, 50], [120, 46], [114, 42], [105, 41], [96, 42], [90, 45]], origin: [110.5, 48.5], conquest: [1203, 1207], successor: 'yuan' },
  { key: 'forest', native: null, ring: [[85, 52], [95, 57], [110, 57], [118, 53], [110, 51.5], [100, 52.5], [88, 50]], origin: [100, 52], conquest: [1207, 1218], successor: 'yuan' },
  { key: 'xia', native: 'xia', ring: [[97, 42], [106, 42], [108, 39], [107, 36], [103, 35], [98, 38]], origin: [103, 42], conquest: [1209, 1227.5], successor: 'yuan' },
  { key: 'manchuria', native: 'jin', ring: [[120, 46], [126, 52], [134, 48], [135, 43], [131, 42.5], [126, 41], [122, 42]], origin: [121, 45], conquest: [1215, 1234], successor: 'yuan' },
  { key: 'jin', native: 'jin', ring: [[106, 42], [114, 42], [120, 46], [122, 42], [126, 41], [124, 39.5], [121, 38.5], [119.5, 35], [118, 33], [114, 32], [110, 33], [106, 35]], origin: [115, 41.5], conquest: [1211, 1234.1], successor: 'yuan' },
  { key: 'qarakhitai', native: 'khitai', ring: [[70, 45], [80, 47.5], [88, 47.5], [90, 43], [86, 39], [76, 38.5], [70, 40.5]], origin: [88, 45], conquest: [1217.5, 1218.6], successor: 'chagatai' },
  {
    key: 'khwarezm', native: 'khwarezm', ring: [[52, 44.5], [62, 46.5], [70, 44.5], [72.5, 40.5], [70.5, 36], [66, 30], [62, 25.5], [57, 25.5], [52, 28], [50, 32], [48, 35.5], [50, 40]],
    origin: [68.3, 42.8], conquest: [1219.7, 1222], successor: (lon, lat) => (lat < 37 || lon < 58 ? 'ilkhanate' : 'chagatai'),
  },
  { key: 'kipchak', native: 'kipchak', ring: [[44, 56.5], [56, 57.5], [61, 52], [57, 46], [48, 42.5], [40, 44], [35, 46.5], [33, 51]], origin: [57, 51], conquest: [1236.5, 1239.5], successor: 'horde' },
  { key: 'rus', native: 'rus', ring: [[25, 50], [28, 56], [32, 60], [40, 59], [45, 56.5], [33, 51], [30, 48], [24, 48]], origin: [45, 55], conquest: [1237.8, 1240.95], successor: 'horde' },
  { key: 'goryeo', native: 'goryeo', ring: [[124.2, 40], [128, 42], [130.2, 42.6], [129.6, 36], [129.3, 35], [126.3, 34.3], [126, 37], [124.5, 38]], origin: [126, 41.5], conquest: [1231, 1259], successor: 'yuan' },
  { key: 'tibet', native: 'tibet', ring: [[78, 35.5], [90, 36.5], [98, 35], [102, 32], [100, 28], [92, 27], [85, 28], [79, 31]], origin: [96, 36], conquest: [1240, 1247], successor: 'yuan' },
  { key: 'rum', native: 'rum', ring: [[27, 41], [36, 42], [42, 41.2], [44.5, 39], [40, 37], [36, 36.2], [30, 36.2], [27, 38]], origin: [43.5, 40], conquest: [1243.4, 1244], successor: 'ilkhanate' },
  { key: 'persia', native: 'nizari', ring: [[44, 40], [48, 40], [52, 37.5], [52, 34], [48, 30.5], [44, 31], [42.5, 35], [44, 38]], origin: [50.6, 36.4], conquest: [1256.3, 1257.6], successor: 'ilkhanate' },
  { key: 'iraq', native: 'abbasid', ring: [[38, 37], [44, 37.2], [48, 30], [44, 29.5], [38, 33]], origin: [46, 35], conquest: [1257.8, 1258.3], successor: 'ilkhanate' },
  { key: 'dali', native: 'dali', ring: [[98, 28], [104, 28], [105.5, 23], [100, 21.5], [97.5, 24]], origin: [101, 28], conquest: [1253.6, 1254.5], successor: 'yuan' },
  {
    key: 'song', native: 'song', ring: [[106, 35], [110, 33], [114, 32], [118, 33], [119.5, 35], [121.5, 32], [122, 29.5], [120, 26], [117, 23], [112, 21.3], [108, 21.6], [106, 23], [104, 26], [102, 28.5], [102, 31], [104, 33]],
    origin: [111, 34], conquest: [1258, 1279.3], successor: 'yuan',
  },
];

const FACTIONS = [
  { id: 'mongol', name: 'Mongol Empire', color: '#e8590c', capital: [102.8, 47.2] as LonLat },
  { id: 'yuan', name: 'Yuan Dynasty', color: '#d6336c', capital: [116.4, 39.9] as LonLat },
  { id: 'horde', name: 'Golden Horde', color: '#fab005', capital: [47.5, 47.0] as LonLat },
  { id: 'chagatai', name: 'Chagatai Khanate', color: '#12b886', capital: [81.3, 43.9] as LonLat },
  { id: 'ilkhanate', name: 'Ilkhanate', color: '#9c36b5', capital: [46.3, 38.1] as LonLat },
  { id: 'tribes', name: 'Steppe Tribes', color: '#adb5bd' },
  { id: 'xia', name: 'Western Xia', color: '#868e96' },
  { id: 'jin', name: 'Jin Dynasty', color: '#1c7ed6' },
  { id: 'song', name: 'Southern Song', color: '#37b24d' },
  { id: 'khitai', name: 'Qara Khitai', color: '#a5d8ff' },
  { id: 'khwarezm', name: 'Khwarazmian Empire', color: '#4c6ef5' },
  { id: 'kipchak', name: 'Cumans & Kipchaks', color: '#96f2d7' },
  { id: 'rus', name: "Kievan Rus'", color: '#74c0fc' },
  { id: 'goryeo', name: 'Goryeo', color: '#ffa8a8' },
  { id: 'tibet', name: 'Tibet', color: '#ffe066' },
  { id: 'rum', name: 'Sultanate of Rum', color: '#d0bfff' },
  { id: 'nizari', name: 'Persian lands', color: '#3bc9db' },
  { id: 'abbasid', name: 'Abbasid Caliphate', color: '#2b8a3e' },
  { id: 'dali', name: 'Dali Kingdom', color: '#b2f2bb' },
];

type Leg = [LonLat, number];

function unit(id: string, name: string, faction: string, legs: Leg[], kind: Unit['kind'] = 'army', strength?: number): Unit {
  // densify each leg by distance between the given timed waypoints
  const path: [number, number, number][] = [];
  for (let i = 0; i < legs.length - 1; i++) {
    const seg = timestampPath([legs[i][0], legs[i + 1][0]], legs[i][1], legs[i + 1][1]);
    if (i > 0) seg.shift();
    path.push(...seg);
  }
  return { id, name, faction, path, kind, strength, width: 4 };
}

const UNITS: Unit[] = [
  unit('u_genghis', "Genghis Khan's main army", 'mongol', [
    [[102.8, 47.2], 1219.3], [[86, 46], 1219.55], [[68.3, 42.85], 1219.8], [[64.4, 39.77], 1220.15], [[66.97, 39.65], 1220.3],
    [[66.9, 36.75], 1220.85], [[69.1, 35.0], 1221.4], [[71.5, 33.9], 1221.9], [[67, 39.6], 1222.6], [[85, 46], 1224.5], [[102.8, 47.2], 1225.2],
  ], 'army', 100000),
  unit('u_jebe', 'Jebe & Subutai', 'mongol', [
    [[66.97, 39.65], 1220.4], [[58.8, 36.2], 1220.7], [[51.4, 35.6], 1220.9], [[46.3, 38.1], 1221.2], [[44.8, 41.7], 1221.8],
    [[48.3, 42.06], 1222.3], [[40.5, 45.5], 1222.9], [[37.9, 47.3], 1223.4], [[49.1, 54.9], 1223.8], [[60, 50], 1224.5],
  ], 'army', 20000),
  unit('u_jin', 'Campaign against the Jin', 'mongol', [
    [[110, 45], 1211.2], [[114.9, 40.8], 1211.7], [[116.4, 39.9], 1215.4], [[113.6, 34.75], 1232.3], [[114.6, 33.0], 1234.1],
  ], 'army', 90000),
  unit('u_batu', 'Batu Khan', 'mongol', [
    [[50, 53], 1236.8], [[39.7, 54.6], 1237.95], [[40.4, 56.1], 1238.1], [[35.8, 54.0], 1238.4], [[37, 48], 1239.5],
    [[30.5, 50.45], 1240.92], [[24, 49.5], 1241.1], [[20.9, 47.97], 1241.28], [[18.7, 47.8], 1241.95], [[30, 46], 1242.4], [[45, 47.5], 1242.9],
  ], 'army', 130000),
  unit('u_baidar', 'Baidar & Kadan', 'mongol', [
    [[30.5, 50.45], 1240.95], [[21.7, 50.68], 1241.1], [[19.94, 50.06], 1241.2], [[16.16, 51.2], 1241.27], [[17, 49.5], 1241.4], [[19, 47.5], 1241.6],
  ], 'army', 20000),
  unit('u_hulagu', 'Hulagu Khan', 'mongol', [
    [[102.8, 47.2], 1253.5], [[80, 44], 1254.6], [[66.97, 39.65], 1255.6], [[58.8, 36.2], 1256.3], [[50.6, 36.43], 1256.9],
    [[48.5, 34.8], 1257.7], [[44.4, 33.3], 1258.1], [[46.3, 38.1], 1259.3], [[37.16, 36.2], 1260.05], [[36.3, 33.5], 1260.2],
  ], 'army', 120000),
  unit('u_kitbuqa', 'Kitbuqa', 'ilkhanate', [[[36.3, 33.5], 1260.4], [[35.38, 32.55], 1260.7]], 'army', 15000),
  unit('u_mamluk', 'Mamluk army (Qutuz)', 'abbasid', [[[31.2, 30.05], 1260.5], [[33.8, 31.1], 1260.6], [[35.38, 32.55], 1260.7], [[36.3, 33.5], 1260.8]], 'army', 20000),
  unit('u_bayan', 'Bayan of the Baarin', 'yuan', [
    [[112.14, 32.04], 1273.1], [[114.3, 30.6], 1274.9], [[118.8, 32.05], 1275.5], [[120.15, 30.27], 1276.1],
    [[119.3, 26.08], 1277.2], [[113.26, 23.13], 1278.4], [[113.08, 22.35], 1279.2],
  ], 'army', 200000),
  unit('u_japan', 'Yuan fleet to Japan', 'yuan', [[[128.57, 35.2], 1274.78], [[129.3, 34.4], 1274.8], [[129.7, 33.8], 1274.83], [[130.4, 33.6], 1274.86], [[129.0, 34.9], 1274.9]], 'fleet', 30000),
];

const ev = (t: number, position: LonLat, title: string, kind: MapEvent['kind'], description: string, faction?: string): MapEvent => ({
  id: `e_${t}_${title.slice(0, 8).replace(/\W/g, '')}`, t, position, title, kind, description, faction, zoom: 5,
});

const EVENTS: MapEvent[] = [
  ev(1206.3, [110.5, 48.5], 'Kurultai on the Onon', 'founding', 'Temüjin is proclaimed Genghis Khan, uniting the steppe tribes.', 'mongol'),
  ev(1215.4, [116.4, 39.9], 'Fall of Zhongdu', 'siege', 'The Jin capital (modern Beijing) falls after a long siege.', 'mongol'),
  ev(1218.5, [81, 43], 'Qara Khitai absorbed', 'battle', 'Jebe defeats Kuchlug; the Qara Khitai lands submit.', 'mongol'),
  ev(1219.85, [68.3, 42.85], 'Siege of Otrar', 'siege', 'Retribution for the massacre of a Mongol trade caravan.', 'mongol'),
  ev(1220.15, [64.4, 39.77], 'Fall of Bukhara', 'siege', 'Genghis Khan takes Bukhara.', 'mongol'),
  ev(1220.3, [66.97, 39.65], 'Fall of Samarkand', 'siege', 'The Khwarazmian capital falls.', 'mongol'),
  ev(1221.9, [71.5, 33.9], 'Battle of the Indus', 'battle', 'Jalal ad-Din escapes across the Indus.', 'mongol'),
  ev(1223.4, [37.9, 47.3], 'Battle of the Kalka River', 'battle', "Jebe and Subutai rout a Rus'–Cuman coalition.", 'mongol'),
  ev(1227.6, [106.27, 38.47], 'Fall of Western Xia', 'disaster', 'The Tangut state is destroyed; Genghis Khan dies during the campaign.', 'mongol'),
  ev(1234.1, [114.6, 33.0], 'Fall of the Jin', 'siege', 'Caizhou falls; the Jin dynasty ends.', 'mongol'),
  ev(1238.1, [40.4, 56.1], 'Sack of Vladimir', 'siege', 'The capital of Vladimir-Suzdal is burned.', 'mongol'),
  ev(1240.92, [30.5, 50.45], 'Siege of Kiev', 'siege', 'Kiev is stormed and largely destroyed.', 'mongol'),
  ev(1241.27, [16.16, 51.2], 'Battle of Legnica', 'battle', 'Polish and Moravian forces defeated.', 'mongol'),
  ev(1241.28, [20.9, 47.97], 'Battle of Mohi', 'battle', 'The Hungarian army is crushed.', 'mongol'),
  ev(1243.5, [39.0, 39.9], 'Battle of Köse Dağ', 'battle', 'The Sultanate of Rum becomes a vassal.', 'mongol'),
  ev(1256.9, [50.6, 36.43], 'Fall of Alamut', 'siege', 'The Nizari stronghold surrenders to Hulagu.', 'mongol'),
  ev(1258.1, [44.4, 33.3], 'Siege of Baghdad', 'siege', 'The Abbasid capital is sacked.', 'mongol'),
  ev(1260.3, [102.8, 47.2], 'Toluid Civil War', 'note', 'Kublai and Ariq Böke both claim the title of Great Khan; the empire fractures into four khanates.'),
  ev(1260.7, [35.38, 32.55], 'Battle of Ain Jalut', 'battle', 'The Mamluks halt the Mongol advance in the Levant.', 'abbasid'),
  ev(1271.9, [116.4, 39.9], 'Yuan Dynasty proclaimed', 'founding', 'Kublai Khan proclaims the Great Yuan at Dadu.', 'yuan'),
  ev(1273.1, [112.14, 32.04], 'Fall of Xiangyang', 'siege', 'After a six-year siege, counterweight trebuchets breach the walls.', 'yuan'),
  ev(1274.86, [130.4, 33.6], 'Invasion of Japan', 'battle', 'The first Yuan invasion lands at Hakata Bay before withdrawing.', 'yuan'),
  ev(1276.1, [120.15, 30.27], "Fall of Lin'an", 'siege', 'The Song capital surrenders.', 'yuan'),
  ev(1279.2, [113.08, 22.35], 'Battle of Yamen', 'battle', 'The last Song resistance is destroyed at sea.', 'yuan'),
];

export async function buildMongolDemo(): Promise<Scenario> {
  const s = emptyScenario({ title: 'The Mongol Conquests (illustrative)', start: 1200, end: 1281, speed: 1.6, eventDuration: 3, h3Resolution: RES, basemap: 'parchment', view: { center: [80, 42], zoom: 2.4 } });
  s.meta.description = 'Approximate, illustrative reconstruction of Mongol expansion 1200–1280: territorial waves, campaigns, battles and the split into four khanates. Not a historical reference.';
  s.factions = FACTIONS.map((f) => ({ ...f }));
  await loadLandMask();
  const onLand = (c: string) => cellTouchesLand(c, isLand);
  const cells: CellEvent[] = [];
  const claimed = new Map<string, Region>();
  const conquestT = new Map<string, number>();
  REGIONS.forEach((r, i) => {
    const list = polygonCells([r.ring], RES).filter(onLand);
    for (const c of list) {
      if (claimed.has(c)) continue; // first region wins overlaps
      claimed.set(c, r);
    }
    const own = list.filter((c) => claimed.get(c) === r);
    if (r.native) for (const c of own) cells.push({ cell: c, t: 1200, faction: r.native });
    const wave = waveEvents(own, r.origin, r.conquest[0], r.conquest[1], 'mongol', { jitter: 0.3, seed: i + 7 });
    for (const e of wave) conquestT.set(e.cell, e.t);
    cells.push(...wave);
  });
  // 1260–1264: the empire fractures into successor khanates
  let k = 0;
  for (const [c, r] of claimed) {
    const [lat, lon] = cellToLatLng(c);
    const succ = typeof r.successor === 'function' ? r.successor(lon, lat) : r.successor;
    const t = 1260.3 + (((k++ * 0.618) % 1) * 0.15 + (Math.abs(lon - 100) / 80) * 0.35) * 4;
    cells.push({ cell: c, t: Math.max(t, (conquestT.get(c) ?? t) + 0.01), faction: succ });
  }
  // Song region gets conquered by Yuan directly (after 1260)
  for (const e of cells) if (e.faction === 'mongol' && e.t > 1260.3 && claimed.get(e.cell)?.key === 'song') e.faction = 'yuan';
  s.cells = cells;
  s.units = UNITS;
  s.events = EVENTS;
  s.annotations = [
    { id: 'a1', text: 'Gobi', position: [105, 43], units: 'meters', size: 90000, color: '#8d7b5a', start: 1200, end: 1281 },
    { id: 'a2', text: 'Caspian Sea', position: [50.5, 41.5], units: 'meters', size: 70000, color: '#4f6d75' },
    { id: 'a3', text: 'Silk Road', position: [75, 40.6], units: 'meters', size: 60000, color: '#8d7b5a' },
    { id: 'a4', text: 'Kingdom of Hungary', position: [19.5, 46.8], units: 'meters', size: 45000, color: '#5c4a2a', start: 1240, end: 1243 },
  ];
  s.camera = [
    { t: 1200, center: [100, 44], zoom: 3.1, bearing: 0, pitch: 0 },
    { t: 1206.5, center: [108, 46], zoom: 4.2, bearing: 0, pitch: 20 },
    { t: 1213, center: [112, 40], zoom: 3.8, bearing: 0, pitch: 25 },
    { t: 1218.5, center: [82, 42], zoom: 3.4, bearing: 0, pitch: 15 },
    { t: 1221.5, center: [64, 38], zoom: 4.1, bearing: -10, pitch: 30 },
    { t: 1223.5, center: [48, 46], zoom: 3.6, bearing: 0, pitch: 20 },
    { t: 1230, center: [95, 40], zoom: 2.6, bearing: 0, pitch: 0 },
    { t: 1237, center: [50, 52], zoom: 3.5, bearing: 0, pitch: 20 },
    { t: 1240.6, center: [33, 52], zoom: 4.0, bearing: 0, pitch: 30 },
    { t: 1241.3, center: [19, 49], zoom: 4.6, bearing: 10, pitch: 35 },
    { t: 1244, center: [60, 45], zoom: 2.7, bearing: 0, pitch: 0 },
    { t: 1256.5, center: [50, 36], zoom: 4.0, bearing: 0, pitch: 25 },
    { t: 1258.1, center: [44.4, 33.3], zoom: 5.3, bearing: 0, pitch: 40 },
    { t: 1260.7, center: [38, 34], zoom: 4.2, bearing: 0, pitch: 20 },
    { t: 1263, center: [80, 44], zoom: 2.4, bearing: 0, pitch: 0 },
    { t: 1273.2, center: [114, 31], zoom: 4.3, bearing: 0, pitch: 30 },
    { t: 1275, center: [128, 33], zoom: 4.3, bearing: 0, pitch: 30 },
    { t: 1279.3, center: [113, 25], zoom: 4.2, bearing: 0, pitch: 20 },
    { t: 1281, center: [80, 44], zoom: 2.3, bearing: 0, pitch: 0 },
  ];
  s.eras = [
    { id: 'era1', name: 'Unification of the steppe', start: 1200, end: 1206.5, color: '#ffd43b' },
    { id: 'era2', name: 'Genghis Khan', start: 1206.5, end: 1227.6, color: '#ff922b' },
    { id: 'era3', name: 'Ögedei', start: 1229.6, end: 1241.9, color: '#ffa94d' },
    { id: 'era4', name: 'Western campaign', start: 1236, end: 1242.5, color: '#74c0fc' },
    { id: 'era5', name: 'Möngke', start: 1251.5, end: 1259.6, color: '#ffc078' },
    { id: 'era6', name: 'Hulagu in the west', start: 1253.5, end: 1260.7, color: '#da77f2' },
    { id: 'era7', name: 'Kublai Khan', start: 1260.3, end: 1281, color: '#f783ac' },
  ];
  s.bookmarks = [
    { id: 'b1', name: 'Steppe heartland', center: [104, 46], zoom: 4.5, bearing: 0, pitch: 0, t: 1207 },
    { id: 'b2', name: 'Khwarezm campaign', center: [64, 39], zoom: 4.5, bearing: 0, pitch: 0, t: 1220.5 },
    { id: 'b3', name: 'Europe 1241', center: [22, 49], zoom: 4.8, bearing: 0, pitch: 0, t: 1241.3 },
    { id: 'b4', name: 'Baghdad 1258', center: [44.4, 33.3], zoom: 5.5, bearing: 0, pitch: 0, t: 1258.1 },
    { id: 'b5', name: 'Fall of the Song', center: [114, 28], zoom: 4.4, bearing: 0, pitch: 0, t: 1276 },
  ];
  return s;
}
