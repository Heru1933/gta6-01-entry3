// Coral Bay's map: a seeded coastal grid of avenues and streets with city
// blocks, named landmark buildings, a park, a runway strip, docks and the
// eastern beach. Also builds the intersection graph traffic drives on and
// the collision / line-of-sight helpers every other system uses.

import { TILE, WORLD_COLS, WORLD_ROWS, WORLD_W, WORLD_H } from './config.js';
import { Rng, clamp } from './random.js';

export const T = { GRASS: 0, ROAD: 1, WALK: 2, BLOCK: 3, SAND: 4, WATER: 5, PARK: 6, PLAZA: 7, RUNWAY: 8, DOCK: 9 };

const AVENUES = [8, 28, 48, 68, 88];
const STREETS = [8, 28, 48, 68];
export const AVENUE_CENTERS = AVENUES.map((a) => (a + 2) * TILE);
export const STREET_CENTERS = STREETS.map((s) => (s + 2) * TILE);

const BLOCK_X = [[0, 7], [12, 27], [32, 47], [52, 67], [72, 87]];
const BLOCK_Y = [[0, 7], [12, 27], [32, 47], [52, 67], [72, 79]];

const ROOF_COLORS = ['#b0563a', '#8a6f4d', '#5d7a8c', '#946b54', '#6e5a7e', '#7a4a3a', '#546e7a', '#a9713f'];
const WALL_COLORS = ['#e8dcc8', '#d9c6a5', '#cfe0e8', '#e6c9b8', '#d5d8dc', '#f0e0b6', '#c8d8c0', '#e8c8d8'];

export function createWorld(seed) {
  const rng = new Rng(seed);
  const tiles = new Uint8Array(WORLD_COLS * WORLD_ROWS);
  const at = (x, y) => tiles[y * WORLD_COLS + x];
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < WORLD_COLS && y < WORLD_ROWS) tiles[y * WORLD_COLS + x] = v; };

  for (let y = 0; y < WORLD_ROWS; y++) for (let x = 0; x < WORLD_COLS; x++) {
    if (x >= 95) set(x, y, T.WATER);
    else if (x >= 92) set(x, y, T.SAND);
    else set(x, y, T.GRASS);
  }
  for (const a of AVENUES) for (let y = 0; y < WORLD_ROWS; y++) for (let dx = 0; dx < 4; dx++) set(a + dx, y, T.ROAD);
  for (const s of STREETS) for (let x = 0; x < 92; x++) for (let dy = 0; dy < 4; dy++) set(x, s + dy, T.ROAD);
  for (let y = 56; y <= 75; y++) for (let x = 92; x <= 94; x++) set(x, y, T.DOCK);

  const buildings = [];
  const trees = [];
  const lamps = [];
  const crates = [];
  const specialBlocks = new Map();

  function blockTiles(bx, by) {
    const [x0, x1] = BLOCK_X[bx]; const [y0, y1] = BLOCK_Y[by];
    return { x0, x1, y0, y1 };
  }
  function paintBlock(bx, by, inner) {
    const { x0, x1, y0, y1 } = blockTiles(bx, by);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1 || y === y0 || y === y1;
      set(x, y, edge ? T.WALK : inner);
    }
  }
  function addBuilding(bx, by, fx, fy, fw, fh, name, wallPick) {
    const { x0, y0 } = blockTiles(bx, by);
    const b = {
      x: (x0 + fx) * TILE, y: (y0 + fy) * TILE, w: fw * TILE, h: fh * TILE,
      color: wallPick || rng.pick(WALL_COLORS), roof: rng.pick(ROOF_COLORS),
      floors: rng.int(2, 9), name: name || null,
    };
    buildings.push(b);
    return b;
  }
  function scatterTrees(bx, by, n, kind) {
    const { x0, x1, y0, y1 } = blockTiles(bx, by);
    for (let i = 0; i < n; i++) trees.push({ x: rng.range(x0 + 1, x1) * TILE, y: rng.range(y0 + 1, y1) * TILE, kind: kind || (rng.chance(0.6) ? 'palm' : 'oak'), s: rng.range(0.8, 1.3) });
  }

  const specials = {
    '1,1': 'bank', '2,1': 'gunshop', '3,1': 'hospital', '4,1': 'beachlot',
    '1,2': 'garage', '2,2': 'spray', '3,2': 'parking',
    '1,3': 'flats', '2,3': 'park', '3,3': 'aero', '4,3': 'warehouse',
  };
  for (const [key, kind] of Object.entries(specials)) {
    const [bx, by] = key.split(',').map(Number);
    specialBlocks.set(key, kind);
    if (kind === 'park') { paintBlock(bx, by, T.PARK); scatterTrees(bx, by, 26); }
    else if (kind === 'beachlot' || kind === 'parking') { paintBlock(bx, by, T.PLAZA); }
    else if (kind === 'flats') { paintBlock(bx, by, T.PLAZA); scatterTrees(bx, by, 4, 'palm'); }
    else if (kind === 'aero') {
      paintBlock(bx, by, T.GRASS);
      const { x0, x1, y0, y1 } = blockTiles(bx, by);
      for (let y = y0 + 6; y <= y0 + 9; y++) for (let x = x0 + 1; x <= x1 - 1; x++) set(x, y, T.RUNWAY);
    } else paintBlock(bx, by, T.BLOCK);
  }
  addBuilding(1, 1, 3, 3, 10, 9, 'FIRST BANCROFT BANK', '#d8cf9f').floors = 12;
  addBuilding(1, 1, 4, 13, 8, 2, null);
  addBuilding(2, 1, 2, 2, 5, 4, 'IRONHOLD ARMS', '#9fb4c0');
  addBuilding(2, 1, 9, 2, 6, 4, 'CORAL MALL', '#e6c9b8');
  addBuilding(2, 1, 3, 9, 11, 5, null);
  addBuilding(3, 1, 3, 3, 10, 8, 'CORAL BAY GENERAL', '#eef2f0').floors = 7;
  addBuilding(4, 1, 12, 2, 3, 3, 'PALM CAFE', '#f0e0b6');
  addBuilding(4, 1, 2, 12, 4, 3, 'SURF RENTALS', '#cfe0e8');
  addBuilding(1, 3, 12, 3, 3, 3, 'KIOSK', '#e6c9b8');
  addBuilding(3, 3, 3, 12, 6, 3, 'HANGAR ONE', '#8a97a5');
  addBuilding(1, 2, 2, 3, 7, 6, 'FERRO CUSTOMS', '#c96a4a');
  addBuilding(1, 2, 11, 10, 4, 5, null);
  addBuilding(2, 2, 3, 3, 8, 6, 'SHINE AUTO', '#7fb3c8');
  addBuilding(2, 2, 12, 11, 3, 4, null);
  addBuilding(3, 1, 4, 13, 7, 2, null);
  addBuilding(4, 3, 2, 2, 6, 5, 'KRELL LOGISTICS', '#8a97a5');
  addBuilding(4, 3, 10, 9, 5, 4, 'HIDEOUT', '#6e5a7e');

  for (let bx = 0; bx < 5; bx++) for (let by = 0; by < 5; by++) {
    const key = bx + ',' + by;
    if (specialBlocks.has(key)) continue;
    const r = rng.next();
    if (r < 0.12) { paintBlock(bx, by, T.PARK); scatterTrees(bx, by, 18); continue; }
    paintBlock(bx, by, T.BLOCK);
    const { x0, x1, y0, y1 } = blockTiles(bx, by);
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const layout = rng.int(0, 2);
    if (bw < 12 && bh < 12) { addBuilding(bx, by, 2, 2, bw - 4, bh - 4); }
    else if (bw < 12) { addBuilding(bx, by, 1.5, 2, 5, 5); addBuilding(bx, by, 1.5, 9, 5, 5); }
    else if (bh < 12) { addBuilding(bx, by, 2, 1.5, 5, 5); addBuilding(bx, by, 9, 1.5, 5, 5); }
    else if (layout === 0) { addBuilding(bx, by, 2, 2, 9, 9); addBuilding(bx, by, 12, 11, 4, 4); }
    else if (layout === 1) { addBuilding(bx, by, 2, 2, 6, 6); addBuilding(bx, by, 9, 9, 6, 6); addBuilding(bx, by, 10, 2, 5, 4); }
    else { addBuilding(bx, by, 2, 2, 5, 5); addBuilding(bx, by, 9, 2, 5, 5); addBuilding(bx, by, 2, 9, 5, 5); addBuilding(bx, by, 9, 9, 5, 5); }
    if (rng.chance(0.5)) scatterTrees(bx, by, 3);
  }
  for (let i = 0; i < 26; i++) trees.push({ x: rng.range(92.2, 94.6) * TILE, y: rng.range(2, 78) * TILE, kind: 'palm', s: rng.range(0.9, 1.4) });
  for (let i = 0; i < 14; i++) crates.push({ x: rng.range(92.3, 94.2) * TILE, y: rng.range(57, 74) * TILE, w: 30, h: 30 });
  for (const ax of AVENUE_CENTERS) for (let y = 120; y < WORLD_H; y += 300) { lamps.push({ x: ax - 84, y }); lamps.push({ x: ax + 84, y: y + 150 }); }

  const nodes = new Map();
  const nodeKey = (x, y) => x + ',' + y;
  function addNode(x, y) { const k = nodeKey(x, y); if (!nodes.has(k)) nodes.set(k, { x, y, next: [] }); return k; }
  for (const ax of AVENUE_CENTERS) {
    addNode(ax, 60); addNode(ax, WORLD_H - 60);
    for (const sy of STREET_CENTERS) addNode(ax, sy);
  }
  for (const sy of STREET_CENTERS) { addNode(60, sy); addNode(3720, sy); }
  function link(a, b) { nodes.get(a).next.push(b); nodes.get(b).next.push(a); }
  for (const ax of AVENUE_CENTERS) {
    const ys = [60, ...STREET_CENTERS, WORLD_H - 60].sort((a, b) => a - b);
    for (let i = 0; i + 1 < ys.length; i++) link(nodeKey(ax, ys[i]), nodeKey(ax, ys[i + 1]));
  }
  for (const sy of STREET_CENTERS) {
    const xs = [60, ...AVENUE_CENTERS, 3720].sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i++) link(nodeKey(xs[i], sy), nodeKey(xs[i + 1], sy));
  }

  const L = (bx, by, fx, fy) => { const { x0, y0 } = blockTiles(bx, by); return { x: (x0 + fx) * TILE, y: (y0 + fy) * TILE }; };
  const locations = {
    spawn: { x: 700, y: 1740 },
    garage: L(1, 2, 8, 10.6),
    gunShop: L(2, 1, 4.5, 7.2),
    spray: L(2, 2, 7, 10.4),
    hospital: L(3, 1, 8, 12.2),
    bank: L(1, 1, 8, 13.4),
    beachLot: L(4, 1, 7, 9),
    flats: L(1, 3, 8, 8),
    aero: L(3, 3, 8, 8),
    docks: { x: 3745, y: 2540 },
    hideout: L(4, 3, 12.5, 14.2),
    foodStands: [
      { ...L(2, 1, 12, 8), name: 'TACO SOL' },
      { ...L(3, 2, 2, 13), name: 'NOODLE BOX' },
      { ...L(4, 1, 13.5, 6), name: 'PALM CAFE' },
    ],
  };

  const parkedSpots = [];
  function lotSpots(bx, by, rows, cols) {
    const { x0, y0 } = blockTiles(bx, by);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      parkedSpots.push({ x: (x0 + 2.5 + c * 2.6) * TILE, y: (y0 + 3 + r * 3.4) * TILE, angle: -Math.PI / 2 });
  }
  lotSpots(3, 2, 3, 5); lotSpots(4, 1, 3, 4);
  for (let i = 0; i < 5; i++) parkedSpots.push({ x: 3700, y: 2350 + i * 95, angle: Math.PI });
  for (let i = 0; i < 4; i++) parkedSpots.push({ x: 2260 + i * 110, y: 2450, angle: 0 });

  const world = {
    seed, tiles, buildings, trees, lamps, crates, nodes, locations, parkedSpots,
    tileAt(tx, ty) { if (tx < 0 || ty < 0 || tx >= WORLD_COLS || ty >= WORLD_ROWS) return T.WATER; return tiles[ty * WORLD_COLS + tx]; },
    tileAtPx(x, y) { return this.tileAt(Math.floor(x / TILE), Math.floor(y / TILE)); },
    isRoadPx(x, y) { return this.tileAtPx(x, y) === T.ROAD; },
    pointInBuilding(x, y, pad = 0) {
      for (const b of buildings) if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
      return null;
    },
    collideCircle(x, y, r, waterSolid = true) {
      let hit = false;
      if (waterSolid && this.tileAtPx(x, y) === T.WATER) hit = true;
      x = clamp(x, r, WORLD_W - r); y = clamp(y, r, WORLD_H - r);
      const solids = buildings.concat(crates);
      for (const b of solids) {
        const cx = clamp(x, b.x, b.x + b.w), cy = clamp(y, b.y, b.y + b.h);
        const dx = x - cx, dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          hit = true;
          if (d2 < 0.0001) {
            const left = x - b.x, right = b.x + b.w - x, top = y - b.y, bot = b.y + b.h - y;
            const m = Math.min(left, right, top, bot);
            if (m === left) x = b.x - r; else if (m === right) x = b.x + b.w + r;
            else if (m === top) y = b.y - r; else y = b.y + b.h + r;
          } else {
            const d = Math.sqrt(d2); x = cx + (dx / d) * r; y = cy + (dy / d) * r;
          }
        }
      }
      return { x, y, hit };
    },
    losBlocked(x1, y1, x2, y2) {
      const d = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.floor(d / 22));
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        if (this.pointInBuilding(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return true;
      }
      return false;
    },
    nearestNode(x, y) {
      let best = null, bd = Infinity;
      for (const n of nodes.values()) { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } }
      return best;
    },
    nearestRoadPoint(x, y) {
      let bx = AVENUE_CENTERS[0], bd = Infinity;
      for (const ax of AVENUE_CENTERS) { const d = Math.abs(ax - x); if (d < bd) { bd = d; bx = ax; } }
      let by = STREET_CENTERS[0]; bd = Infinity;
      for (const sy of STREET_CENTERS) { const d = Math.abs(sy - y); if (d < bd) { bd = d; by = sy; } }
      return Math.abs(bx - x) < Math.abs(by - y) ? { x: bx, y: clamp(y, 40, WORLD_H - 40) } : { x: clamp(x, 40, 3720), y: by };
    },
    randomRoadPoint(rng2, cx, cy, minD, maxD) {
      const list = [...nodes.values()].filter((n) => { const d = Math.hypot(n.x - cx, n.y - cy); return d >= minD && d <= maxD; });
      if (!list.length) return this.nearestNode(cx, cy);
      return rng2.pick(list);
    },
  };
  return world;
}
