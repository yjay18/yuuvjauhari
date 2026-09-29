// The town's ground: one landmass at the kit's fineness (0.15 a voxel), painted by rules from the plan's
// raster and meshed once, in square chunks. Each chunk is ONE geometry and one draw call: the mesher's glow
// faces ride along with a per-vertex flag and are drawn unlit by the same material, so a chunk off screen
// costs nothing and one on screen costs one call.
//
//   await buildGround(THREE, { plots: { id: island spec } }) -> { group, chunks, material, stats }
//   Chunks are built in parallel workers (js/town/ground-worker.js runs chunkArrays), or here if workers fail.
//
// What it paints: cobbled streets with kerbs and gutters (circuit light in some joints), stairs with nosings,
// flagged quays and wall walks, coursed stone terrace walls, ashlar town walls with merlons, arrow slits and
// lit windows, round towers under slate cones or crowns with crystal finials, gatehouses with arches and
// portcullises, stone arch bridges, water gates, street lamps with warm lanterns, parapets along every drop,
// lots as swept yards on a footing, gardens and meadows with flowers, strip fields, sand and pebbles, and
// cliffs in layered rock, wet and weedy at the waterline, with a vein of crystal here and there. A district's
// plot is painted by its own island spec (paths, plazas, flags, theme), flush with the town round it.
import { C, colour, hash, noise, grid, PALETTE, GLOWS } from '../kit/voxel-kit.js';
import { meshBox } from '../kit/voxel-mesher.js';
import { raster, KIND, LEVEL, WALL, WALLS, WALL_OUT, STREETS, TOWERS, towerHeight, RIVER, LAMPS, PLOTS, PLOT_IDS, ZONES, V, toSeg } from './plan.js';
import { plotPaint } from '../models/island.js';

const col = (n, hex, glow = false) => C[`town_${n}`] ?? colour(`town_${n}`, hex, glow);
const K = {};
for (const [n, hex, glow] of [
  // coursed stone (terraces, parapets), ashlar (walls, towers), mortar and circuit light in the joints
  ['m1', 0xb2a996], ['m2', 0x9c937f], ['m3', 0x877e6c], ['m4', 0xc6bda8], ['mortar', 0x4d4740], ['moss', 0x566b36], ['moss2', 0x6f8440],
  ['a1', 0xbfb8aa], ['a2', 0xaaa394], ['a3', 0x968f81], ['a4', 0xd3ccbc], ['plinth', 0x7c7569], ['plinth2', 0x6a645a], ['string', 0xddd5c4],
  ['trace', 0x1fd2ea, true], ['traceHot', 0xb6fbff, true], ['rune', 0x9f86ff, true], ['rune2', 0x6ff2ff, true],
  // streets, stairs, flags, lots
  ['cb1', 0x9d978c], ['cb2', 0x8a8479], ['cb3', 0xafa899], ['cb4', 0x7a7469], ['cb5', 0x928a7c], ['joint', 0x34312e], ['kerb', 0xc4bba8], ['kerb2', 0xaca390], ['gutter', 0x524d46],
  ['tread1', 0xb9b1a1], ['tread2', 0xa69e8e], ['nose', 0xd6cdba],
  ['fl1', 0xb3aa98], ['fl2', 0xa39a88], ['fl3', 0x958c7b], ['fl4', 0xc0b7a4],
  ['yard1', 0x8c7c62], ['yard2', 0x7b6c55], ['yard3', 0x9a8a6e], ['foot', 0xa0978a],
  // rock and earth
  ['r1', 0x78737c], ['r2', 0x68636d], ['r3', 0x88828a], ['r4', 0x56525c], ['r5', 0x8f8474], ['r6', 0x72695e],
  ['wet1', 0x403e46], ['wet2', 0x302f37], ['weed', 0x3c5634], ['weed2', 0x5b6a2c], ['barn', 0xd8d2c2],
  ['vein', 0x59e6ff, true], ['vein2', 0xa98bff, true],
  ['s1', 0x5a3d25], ['s2', 0x6b4a2e], ['s3', 0x4a3120],
  ['sa1', 0xe2d2a8], ['sa2', 0xd4c196], ['sa3', 0xc5b084], ['peb', 0x9a948a], ['shell', 0xf2e8d8],
  ['dry1', 0x9a9282], ['dry2', 0x848072], ['dry3', 0xafa796],
  // grass, meadow, fields, gardens
  ['g1', 0x3f6b2c], ['g2', 0x4d7d33], ['g3', 0x5f8f3c], ['g4', 0x7c9a45], ['g5', 0x6d8c3a], ['clover', 0x4a8a3c],
  ['w1', 0x8a9a48], ['w2', 0x9aa650], ['blade', 0x6fa648], ['blade2', 0x87b653], ['pW', 0xf3efe2], ['pY', 0xf2cd4c], ['pV', 0xa678e0], ['pR', 0xe0505a],
  ['wheat1', 0xd8b858], ['wheat2', 0xc8a442], ['wheat3', 0xe6cc70], ['lav1', 0x8a6cc8], ['lav2', 0x7458b0], ['cab1', 0x4f8a3a], ['cab2', 0x6aa048],
  ['earth1', 0x6b4a2e], ['earth2', 0x5a3d25], ['hay', 0xd6be6a],
  // roofs, iron, lanterns, crystal, lit windows, the river's bed
  ['sl1', 0x3b4a68], ['sl2', 0x4a5a7c], ['sl3', 0x2f3a55], ['sl4', 0x56668a], ['eave', 0x6ff2ff, true], ['fin', 0xe6fdff, true], ['crys', 0x9b7bff, true],
  ['iron1', 0x2a2624], ['iron2', 0x413b36], ['brass', 0xc49c3e], ['lamp', 0xffc764, true], ['lamp2', 0xffe6a8, true],
  ['win', 0xffb85a, true], ['win2', 0xffe0a0, true], ['slit', 0x1b1918],
  ['bed1', 0x4a4a44], ['bed2', 0x5c5a50], ['bed3', 0x3a3c36],
]) K[n] = col(n, hex, glow);

const mod = (a, n) => ((a % n) + n) % n;
const pick = (ids, h) => ids[Math.min(ids.length - 1, Math.floor(h * ids.length))];
const STONE = [K.m1, K.m2, K.m2, K.m3, K.m1, K.m4];
const ASHLAR = [K.a1, K.a2, K.a2, K.a3, K.a1, K.a4];
const ROCK = [K.r1, K.r2, K.r3, K.r1, K.r4, K.r5, K.r6];
const COB = [K.cb1, K.cb2, K.cb3, K.cb4, K.cb5];
const GRASS = [[K.g2, K.g3], [K.g3, K.g2], [K.g5, K.g2]];
const WALKS = new Set([KIND.STREET, KIND.STAIR, KIND.QUAY, KIND.GATE, KIND.BRIDGE, KIND.PLOT]);

// ---- rules for the sides of things: masonry, ashlar, rock, dry stone -------------------------------
function masonry(x, y, z, seed = 0) {
  if (mod(y, 4) === 0) return noise(x + z, y * 7, 9, 13 + seed) > 0.8 ? K.trace : K.mortar;
  const course = Math.floor(y / 4), along = x + z + (course % 2) * 3 + seed * 3;
  if (mod(along, 6) === 0) return K.mortar;
  const s = hash(Math.floor(along / 6), course, 11 + seed);
  return s < 0.05 ? K.moss : STONE[Math.floor(hash(Math.floor(along / 6), course, 3 + seed) * STONE.length)];
}
function ashlar(x, y, z, base, top, L = 9) {
  const up = y - base;
  if (up < 0) { const c = Math.floor(y / 4), along = x + z + (c % 2) * 5; return mod(y, 4) === 3 || mod(along, L + 2) === 0 ? K.mortar : hash(Math.floor(along / (L + 2)), c, 21) < 0.5 ? K.plinth : K.plinth2; } // its footing, down to the ground
  if (up < 3) return mod(x + z + Math.floor(y / 2) * 3, 7) === 0 ? K.mortar : hash(Math.floor((x + z) / 7), y >> 1, 21) < 0.5 ? K.plinth : K.plinth2;
  if (y === top - 6) return K.string;
  if (mod(up, 4) === 3) return noise(x + z, y * 5, 11, 17) > 0.78 ? (hash(x, y, z) < 0.1 ? K.traceHot : K.trace) : K.mortar;
  const course = Math.floor(up / 4), along = x + z + (course % 2) * 4;
  if (mod(along, L) === 0) return K.mortar;
  const s = hash(Math.floor(along / L), course, 5);
  return s < 0.04 ? K.moss : ASHLAR[Math.floor(hash(Math.floor(along / L), course, 9) * ASHLAR.length)];
}
// A tower's coursing: each course one stone's tone, an odd stone here and there, mortar and circuit light between.
function towerStone(x, y, z, base, seed) {
  const up = y - base, c = Math.floor(up / 4);
  if (mod(up, 4) === 3) return noise(x + z, y * 5, 11, 17) > 0.8 ? K.trace : K.mortar;
  const along = Math.floor((x + z + (c % 2) * 6) / 12);
  return hash(along, c, seed) < 0.18 ? (hash(along, c, 3) < 0.5 ? K.a4 : K.moss) : ASHLAR[Math.floor(hash(c, seed, 9) * ASHLAR.length)];
}
function rock(x, y, z) {
  if (y <= 2) { const w = noise(x + z, y * 3, 4, 19); return y === 2 ? (w > 0.62 ? K.barn : K.wet1) : w > 0.55 ? K.weed : w > 0.4 ? K.wet1 : w > 0.3 ? K.weed2 : K.wet2; }
  const band = Math.floor((y + 40 + noise(x, z, 9, 7) * 5) / 3);
  if (y > 6 && y < 30 && Math.abs(noise(x + z + y * 1.7, y * 0.5, 11, 23) - 0.5) < 0.012 && noise(x, z, 13, 29) > 0.62) return band % 2 ? K.vein : K.vein2; // a seam of crystal here and there
  if (y <= 5) return noise(x + z, y, 5, 29) > 0.5 ? K.wet1 : ROCK[mod(band, ROCK.length)];
  return ROCK[mod(band, ROCK.length)];
}
function drystone(x, y, z, top) {
  if (y >= top - 1) return K.s2;
  return pick([K.dry1, K.dry2, K.dry3, K.dry1, K.s3], hash(x, z, 3));
}

export const CHUNK = 128; // voxels a side: 19.2 units
// The arrays of the chunks in `list` ([ci, ck] raster corners; all of them when null), from the plots' island specs.
export function chunkArrays({ plots = {}, size = CHUNK, list = null } = {}) {
  const R = raster();
  const { nx, nz, i0, k0 } = R;
  const PL = PLOT_IDS.map((id) => PLOTS[id]);
  const painters = PLOT_IDS.map((id, pi) => { const p = PL[pi]; return plotPaint({ ...(plots[id] || {}), A: p.A, B: p.B, seed: p.seed }, { lip: false, speckle: false }); });
  const at = (i, k) => (i < 0 || k < 0 || i >= nx || k >= nz ? -1 : k * nx + i);
  const topAt = (i, k) => { const n = at(i, k); return n < 0 ? -6 : R.top[n]; };
  const streetQ = (n, x, z) => { const s = STREETS[R.ref[n]], a = s.pts[R.seg[n] - 1], b = s.pts[R.seg[n]]; return toSeg((x + 0.5) * V, (z + 0.5) * V, a[0], a[1], b[0], b[1]); };
  const wallQ = (wi, g, x, z) => { const w = WALLS[wi].pts, a = w[g - 1], b = w[g]; return toSeg((x + 0.5) * V, (z + 0.5) * V, a[0], a[1], b[0], b[1]); };
  const wallNear = (wi, x, z) => { let best = null; const w = WALLS[wi].pts; for (let g = 1; g < w.length; g += 1) { const q = wallQ(wi, g, x, z); if (!best || q.d < best.d) best = { ...q, g }; } return best; };
  const riverQ = (x, z) => { let best = null; for (let s = 1; s < RIVER.length; s += 1) { const q = toSeg((x + 0.5) * V, (z + 0.5) * V, RIVER[s - 1][0], RIVER[s - 1][1], RIVER[s][0], RIVER[s][1]); if (!best || q.d < best.d) best = { ...q, s }; } return best; };

  // ---- the surface of one column: its top (a joint sits one lower), the top voxel's colour, what grows on it
  const S = { top: 0, id: 0, grow: null };
  function surface(n, i, k) {
    const x = i + i0, z = k + k0, kind = R.kind[n];
    let top = R.top[n], id = 0, grow = null;
    const h = hash(x, z, 1);
    switch (kind) {
      case KIND.PLOT: {
        const p = PL[R.ref[n]], r = painters[R.ref[n]](x - p.o[0], z - p.o[1]);
        id = r.id; if (r.sink) top -= 1; grow = r.grow.length ? r.grow : null;
        break;
      }
      case KIND.STREET: case KIND.GATE: case KIND.BRIDGE: {
        const s = STREETS[R.ref[n]], q = streetQ(n, x, z), edge = s.w / 2 - q.d;
        if (kind === KIND.BRIDGE) top = R.deck[n];
        if (edge < 0.32) { id = hash(Math.floor((x + z) / 4), 7) < 0.5 ? K.kerb : K.kerb2; break; }
        if (edge < 0.62 && s.surface !== 'flag') { id = K.gutter; break; }
        if (s.surface === 'flag') { const row = Math.floor(z / 4), sx = mod(x + (row % 2) * 3, 6), sz = mod(z, 4); if (sx === 0 || sz === 0) { id = K.joint; top -= 1; } else id = pick([K.fl1, K.fl2, K.fl3, K.fl4], hash(Math.floor((x + (row % 2) * 3) / 6), row, 3)); break; }
        const row = Math.floor(z / 4), sz = mod(z, 4) === 0, sx = mod(x + row * 3, 5) === 0;
        if (sz || sx) id = noise(x, z, 6, 9) > 0.6 ? (hash(x, z, 9) < 0.1 ? K.traceHot : K.trace) : K.joint; // joints flush: the shader's per-voxel shading gives the setts their grain
        else id = pick(COB, hash(Math.floor((x + row * 3) / 5), row, 5));
        break;
      }
      case KIND.STAIR: {
        const s = STREETS[R.ref[n]], q = streetQ(n, x, z);
        if (s.w / 2 - q.d < 0.3) { id = K.kerb2; break; }
        let low = false;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const m = at(i + a, k + b); if (m >= 0 && R.kind[m] === KIND.STAIR && R.top[m] < top) low = true; }
        id = low ? K.nose : hash(x, z >> 1, 4) < 0.5 ? K.tread1 : K.tread2;
        break;
      }
      case KIND.QUAY: { const row = Math.floor(z / 5), sx = mod(x + (row % 2) * 3, 7), sz = mod(z, 5); if (sx === 0 || sz === 0) { id = K.joint; top -= 1; } else id = pick([K.fl1, K.fl2, K.fl3], hash(Math.floor((x + (row % 2) * 3) / 7), row, 8)); break; }
      case KIND.WALL: { const row = Math.floor(z / 4); id = mod(x + (row % 2) * 2, 5) === 0 || mod(z, 4) === 0 ? K.mortar : pick([K.fl1, K.fl2, K.fl3], hash(Math.floor(x / 5), row, 12)); break; }
      case KIND.TOWER: id = pick([K.fl2, K.fl3], h); break;
      case KIND.RIVER: id = K.bed3; break;
      case KIND.SEA: id = K.wet1; break;
      case KIND.LOT: {
        const l = R.lots[R.ref[n]], c = Math.cos(l.face), s = Math.sin(l.face), dx = (x + 0.5) * V - l.c[0], dz = (z + 0.5) * V - l.c[1];
        const a = dx * c - dz * s, b = dx * s + dz * c, e = Math.min(l.w / 2 - Math.abs(a), l.d / 2 - Math.abs(b));
        // an empty building plot until a house stands on it: a stone footing round a patch of garden
        if (e < 0.22) id = mod(x + z, 5) === 0 ? K.m3 : K.foot;
        else id = e < 0.45 ? K.yard2 : GRASS[1][0];
        break;
      }
      case KIND.BEACH: id = pick([K.sa1, K.sa2, K.sa3, K.sa1], noise(x, z, 4, 2)); if (h < 0.012) grow = [h < 0.004 ? K.shell : K.peb]; break;
      case KIND.ROCK: id = top <= 3 ? pick([K.wet1, K.weed, K.r2, K.barn], noise(x, z, 3, 4)) : pick([K.r1, K.r3, K.r5, K.r2], noise(x, z, 4, 5)); break;
      case KIND.FIELD: {
        const zi = R.ref[n], crop = Math.floor(hash(zi, 3, 5) * 4), dirX = hash(zi, 9) < 0.5, u = dirX ? x : z;
        const row = Math.floor(u / 3), tint = noise(x, z, 6, zi);
        if (mod(u, 3) === 0) id = tint < 0.5 ? K.earth1 : K.earth2;
        else if (crop === 0) { id = pick([K.wheat1, K.wheat2, K.wheat3], (tint + hash(row, zi) * 0.4) % 1); if (h > 0.9) grow = [K.wheat3]; }
        else if (crop === 1) { id = tint < 0.55 ? K.lav1 : K.lav2; if (h > 0.86) grow = [K.lav1]; }
        else if (crop === 2) { id = tint < 0.5 ? K.cab1 : K.cab2; if (h > 0.85 && mod(u, 3) === 1) grow = [K.cab2]; }
        else id = mod(u, 6) < 3 ? K.hay : tint < 0.5 ? K.earth1 : K.s2;
        break;
      }
      case KIND.TOWN: { // the town's own ground between its streets: kitchen gardens in rows, beds of flowers, lawns
        const g = noise(x, z, 10, 31), u = hash(x >> 5, z >> 5, 2) < 0.5 ? x : z;
        if (g > 0.64) { id = mod(u, 3) === 0 ? K.earth2 : pick([K.cab1, K.cab2, K.lav1, K.wheat2, K.cab1], hash(x >> 4, z >> 4, 3)); if (mod(u, 3) === 1 && h > 0.82) grow = [id === K.lav1 ? K.lav2 : K.cab2]; break; }
        if (g < 0.24) { id = pick([K.pW, K.pY, K.pV, K.pR, K.g3, K.g3], noise(x, z, 7, 5)); if (h > 0.8) grow = [pick([K.pW, K.pY, K.pV, K.pR], hash(x, z, 4))]; break; }
        id = noise(x, z, 17, 1) < 0.5 ? K.g3 : K.g5;
        if (h > 0.975) grow = [K.blade];
        break;
      }
      default: { // grass: the orchards, meadows and countryside outside the walls
        const nn = noise(x, z, 17, 1), T = GRASS[nn < 0.4 ? 0 : nn < 0.7 ? 1 : 2];
        id = T[0];
        const wild = kind === KIND.MEADOW || kind === KIND.LAND;
        if (kind === KIND.MEADOW && noise(x, z, 6, 4) > 0.6) id = pick([K.w1, K.w2, K.g4], noise(x, z, 9, 12));
        if (kind === KIND.TOWN && noise(x, z, 5, 8) > 0.7) id = K.clover;
        const f = noise(x, z, 7, 5), g = hash(x, z, 23);
        if (f > (wild ? 0.7 : 0.76) && g > 0.88 && hash(x >> 2, z >> 2, 6) > 0.45) grow = [pick([K.pW, K.pY, K.pV, K.pR], hash(x, z, 4))];
        else if (g > (kind === KIND.LAND ? 0.985 : 0.97)) grow = g > 0.994 ? [K.blade, K.blade2] : [g > 0.99 ? K.blade2 : K.blade];
      }
    }
    S.top = top; S.id = id; S.grow = grow;
    return S;
  }

  // ---- the paint below a column's surface
  function side(n, kind, x, y, z, top) {
    const depth = top - 1 - y;
    switch (kind) {
      case KIND.WALL: case KIND.GATE: {
        const wi = R.gate[n] - 1;
        if (wi >= 0 && (y >= R.base[n] - 1 || (y >= LEVEL.low - 3 && kind === KIND.WALL))) {
          if (kind === KIND.WALL) { // arrow slits on the outer face, some lit
            const q = wallQ(wi, R.seg[n], x, z), out = q.side * WALL_OUT[wi] > 0 && q.d > (WALL.thick * V) / 2 - 0.3;
            const along = Math.round((q.t * 100 + R.seg[n] * 1000) * 1.7), up = y - R.base[n];
            if (out && WALLS[wi].kind === 'land' && up >= 13 && up <= 17 && mod(along, 31) < 2) return up === 17 ? K.a4 : hash(along >> 5, wi, 3) < 0.35 ? K.win : K.slit;
          }
          return ashlar(x, y, z, R.base[n], R.base[n] + (kind === KIND.GATE ? WALL.gate : WALLS[wi].kind === 'land' ? WALL.land : WALL.sea));
        }
        break;
      }
      case KIND.TOWER: {
        const t = TOWERS[R.ref[n]], up = y - R.base[n], tall = towerHeight(t);
        if (up < 0) return y < LEVEL.low - 3 && R.base[n] <= LEVEL.low ? rock(x, y, z) : ashlar(x, y, z, R.base[n], R.base[n] + tall, 13);
        const r = Math.round(t.r / V), u = Math.abs(x - Math.round(t.at[0] / V) + 0.5) > Math.abs(z - Math.round(t.at[1] / V) + 0.5) ? z - Math.round(t.at[1] / V) + r : x - Math.round(t.at[0] / V) + r;
        const mid = Math.abs(u - r + 0.5) < 1.6;
        if (up === tall - 3 && mod(u, 3) === 1) return mod(u, 6) === 1 ? K.rune : K.rune2;
        if (up >= tall - 15 && up <= tall - 11 && mid) return up === tall - 11 ? K.a4 : hash(t.at[0] | 0, t.at[1] | 0, 5) < 0.7 ? K.win : K.win2;
        if (up >= 12 && up <= 16 && mid && t.kind !== 'sea') return up === 16 ? K.a4 : K.slit;
        return towerStone(x, y, z, R.base[n], R.ref[n]);
      }
      case KIND.QUAY: return y >= LEVEL.quay - 1 ? K.fl4 : y >= 0 ? masonry(x, y, z, 2) : rock(x, y, z);
      case KIND.RIVER: case KIND.BRIDGE: return y > LEVEL.low - 12 ? masonry(x, y, z, 1) : rock(x, y, z);
      case KIND.BEACH: return depth < 3 ? K.sa3 : rock(x, y, z);
      case KIND.ROCK: return rock(x, y, z);
      case KIND.LAND: case KIND.FIELD: case KIND.MEADOW: case KIND.ORCHARD: case KIND.GARDEN: {
        if (depth < 1) return K.s2;
        const drop = top - Math.min(topAt(x - i0 + 1, z - k0), topAt(x - i0 - 1, z - k0), topAt(x - i0, z - k0 + 1), topAt(x - i0, z - k0 - 1));
        return drop <= 14 && top > 8 ? drystone(x, y, z, top) : depth < 3 ? K.s1 : rock(x, y, z);
      }
      default: break;
    }
    // the town's ground, plots, lots, streets: built stone over the rock the town stands on
    if (kind === KIND.PLOT && R.top[n] <= LEVEL.point) return depth < 2 ? K.s2 : rock(x, y, z);
    return y >= LEVEL.low - 3 ? masonry(x, y, z) : y >= LEVEL.quay && kind === KIND.STAIR ? masonry(x, y, z, 3) : rock(x, y, z);
  }

  // ---- structures over the surface, stamped into a chunk (world voxels in, the chunk's grid out)
  function structures(put, ci, ck, cw, cd) {
    const x0 = ci + i0 - 1, z0 = ck + k0 - 1, x1 = x0 + cw + 1, z1 = z0 + cd + 1;
    const inside = (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
    for (let k = Math.max(0, ck - 1); k < Math.min(nz, ck + cd + 1); k += 1) for (let i = Math.max(0, ci - 1); i < Math.min(nx, ci + cw + 1); i += 1) {
      const n = k * nx + i, kind = R.kind[n], x = i + i0, z = k + k0, top = R.top[n];
      if (kind === KIND.WALL) { // merlons on the outer edge, a lip on the inner
        const wi = R.ref[n], q = wallQ(wi, R.seg[n], x, z), half = (WALL.thick * V) / 2, out = q.side * WALL_OUT[wi] > 0;
        const along = Math.round((q.t * Math.hypot(WALLS[wi].pts[R.seg[n]][0] - WALLS[wi].pts[R.seg[n] - 1][0], WALLS[wi].pts[R.seg[n]][1] - WALLS[wi].pts[R.seg[n] - 1][1])) / V);
        if (out && q.d > half - 0.32) { if (mod(along, 7) < 4) { put(x, top, z, ashlar(x, top, z, R.base[n], top + 20)); put(x, top + 1, z, ashlar(x, top + 1, z, R.base[n], top + 20)); put(x, top + 2, z, K.a4); } else put(x, top, z, K.a4); }
        else if (!out && q.d > half - 0.17) put(x, top, z, K.a3);
      } else if (kind === KIND.GATE) { // the arch over the passage, a portcullis raised in it
        const s = STREETS[R.ref[n]], q = streetQ(n, x, z), r = (s.w / 2) / V, a = q.d / V;
        const spring = top + 27, crown = spring + Math.round(Math.sqrt(Math.max(0, r * r - a * a)) * 0.8);
        const wi = R.gate[n] - 1, wq = wallNear(wi, x, z);
        for (let y = crown; y < R.deck[n]; y += 1) put(x, y, z, y === crown ? K.a4 : ashlar(x, y, z, R.base[n], R.deck[n]));
        if (wq.d < 0.2) for (let y = crown - 7; y < crown; y += 1) if (mod(x + z, 3) === 0 || mod(y, 3) === 0) put(x, y, z, y === crown - 7 && mod(x + z, 3) === 0 ? K.rune2 : K.iron1);
        const out = wq.side * WALL_OUT[wi] > 0 && wq.d > (WALL.thick * V) / 2 - 0.3;
        if (out && mod(x + z, 7) < 4) { put(x, R.deck[n], z, K.a2); put(x, R.deck[n] + 1, z, K.a4); }
        if (out && Math.abs(a) < 1) { put(x, crown + 2, z, K.fin); put(x, crown + 3, z, K.crys); } // a crystal keystone over the arch
      } else if (kind === KIND.BRIDGE) { // the deck on its arch, parapets along it
        const s = STREETS[R.ref[n]], q = streetQ(n, x, z), rq = riverQ(x, z), w = RIVER[rq.s][3] / 2 + 0.4;
        const soffit = R.water[n] + 1 + Math.round(5 * Math.sqrt(Math.max(0, 1 - (rq.d / w) ** 2)));
        const deck = R.deck[n];
        for (let y = soffit; y < deck; y += 1) put(x, y, z, y === soffit ? K.a4 : masonry(x, y, z, 4));
        if (s.w / 2 - q.d < 0.32) { put(x, deck, z, K.m2); put(x, deck + 1, z, K.m1); put(x, deck + 2, z, K.m4); }
      } else if (kind === KIND.RIVER && R.gate[n]) { // a water gate: the wall carried over the river on an arch
        const wi = R.gate[n] - 1, bank = LEVEL.low, wt = bank + (WALLS[wi].kind === 'land' ? WALL.land : WALL.sea);
        const rq = riverQ(x, z), w = RIVER[rq.s][3] / 2 + 0.3, spring = R.water[n] + 3, crown = spring + Math.round(5 * Math.sqrt(Math.max(0, 1 - (rq.d / w) ** 2)));
        for (let y = crown; y < wt; y += 1) put(x, y, z, y === crown ? K.a4 : ashlar(x, y, z, bank, wt));
        if (mod(x + z, 3) === 0) for (let y = crown - 4; y < crown; y += 1) put(x, y, z, K.iron1); // a grille
      } else if (kind === KIND.QUAY && mod(x * 3 + z * 7, 41) === 0) { // bollards at the water's edge
        let edge = false;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const m = at(i + a * 3, k + b * 3); if (m >= 0 && R.top[m] < 2 && R.kind[m] !== KIND.QUAY) edge = true; }
        if (edge) for (let y = top; y < top + 3; y += 1) { put(x, y, z, y === top + 2 ? K.brass : K.iron2); put(x + 1, y, z, y === top + 2 ? K.brass : K.iron1); }
      }
      // parapets along drops: the town's walkable ground and greens, never a district's plot
      if (kind === KIND.STREET || kind === KIND.STAIR || kind === KIND.QUAY || kind === KIND.TOWN || kind === KIND.LOT) {
        let drop = false;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const m = at(i + a, k + b);
          if (m < 0) continue;
          const mk = R.kind[m], mt = mk === KIND.BRIDGE ? R.deck[m] : R.top[m];
          if (mt < top - 5 && !(WALKS.has(mk) && mt >= top - 7) && mk !== KIND.RIVER) drop = true;
        }
        if (drop) { put(x, top, z, masonry(x, top, z, 5)); put(x, top + 1, z, mod(x + z, 5) === 0 ? K.m3 : K.m4); }
      }
    }
    // towers: a steep slate pyramid with a glowing eave, or a crown of merlons round a crystal brazier
    for (const t of TOWERS) {
      const r = Math.round(t.r / V), cx = Math.round(t.at[0] / V), cz = Math.round(t.at[1] / V);
      if (cx + r + 2 < x0 || cx - r - 2 > x1 || cz + r + 2 < z0 || cz - r - 2 > z1) continue;
      const n = at(cx - i0, cz - k0);
      if (n < 0) continue;
      const top = R.kind[n] === KIND.TOWER ? R.top[n] : R.base[n] + towerHeight(t);
      if (t.roof === 'cone') {
        const h0 = r + 1, H = Math.round(h0 * (t.kind === 'gate' ? 1.2 : 1.45));
        for (let y = 0; y < H; y += 1) {
          const half = Math.max(1, Math.round(h0 * (1 - y / H))), tone = y === 0 ? K.eave : [K.sl1, K.sl2, K.sl3, K.sl2, K.sl4][mod(y + (cx & 3), 5)];
          for (let z = cz - half; z < cz + half; z += 1) for (let x = cx - half; x < cx + half; x += 1) {
            if (!inside(x, z)) continue;
            put(x, top + y, z, tone);
          }
        }
        for (let y = H; y < H + 4; y += 1) for (const [dx, dz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (inside(cx + dx, cz + dz) && (y < H + 2 || (dx === -1 && dz === -1))) put(cx + dx, top + y, cz + dz, y > H + 1 ? K.fin : K.crys);
      } else {
        for (let z = cz - r - 1; z < cz + r + 1; z += 1) for (let x = cx - r - 1; x < cx + r + 1; x += 1) {
          if (!inside(x, z)) continue;
          const ring = Math.min(x - (cx - r - 1), cx + r - x, z - (cz - r - 1), cz + r - z);
          if (ring === 0) { put(x, top, z, K.a2); if (mod(x + z, 4) < 2) { put(x, top + 1, z, K.a1); put(x, top + 2, z, K.a4); } }
          else if (ring === 1) put(x, top, z, K.a3);
        }
        for (let z = cz - 1; z <= cz; z += 1) for (let x = cx - 1; x <= cx; x += 1) if (inside(x, z)) { put(x, top, z, K.iron2); put(x, top + 1, z, K.brass); }
        if (inside(cx - 1, cz - 1)) for (let y = 2; y < 7; y += 1) put(cx - 1, top + y, cz - 1, y > 5 ? K.fin : K.crys);
      }
    }
    // street lamps: a stone foot, an iron post, an arm over the street and a warm lantern hanging from it
    for (const l of LAMPS) {
      const x = Math.floor(l.at[0] / V), z = Math.floor(l.at[1] / V);
      if (x < x0 - 4 || x > x1 + 4 || z < z0 - 4 || z > z1 + 4) continue;
      const n = at(x - i0, z - k0);
      if (n < 0) continue;
      const y0 = R.kind[n] === KIND.BRIDGE ? R.deck[n] : R.top[n], ax = Math.round(l.arm[0] * 3), az = Math.round(l.arm[1] * 3);
      const P = (px, py, pz, id) => { if (inside(px, pz)) put(px, py, pz, id); };
      P(x, y0, z, K.m1); P(x, y0 + 1, z, K.plinth);
      for (let y = y0 + 2; y < y0 + 27; y += 1) P(x, y, z, y === y0 + 8 || y === y0 + 20 ? K.brass : K.iron1);
      P(x, y0 + 27, z, K.fin);
      for (let s = 1; s <= 3; s += 1) P(x + Math.round((ax * s) / 3), y0 + 25, z + Math.round((az * s) / 3), K.iron2);
      const lx = x + ax, lz = z + az;
      P(lx, y0 + 24, lz, K.iron2);
      for (let y = y0 + 19; y <= y0 + 23; y += 1) P(lx, y, lz, y === y0 + 19 ? K.iron2 : y === y0 + 23 ? K.iron1 : y === y0 + 21 ? K.lamp2 : K.lamp);
    }
  }

  // ---- the chunks
  const out = [];
  let voxels = 0;
  const tops = new Int16Array((size + 4) * (size + 4)), ids = new Uint16Array((size + 4) * (size + 4)), grows = [];
  for (const [ci, ck] of list || chunkList(size)) {
    const cw = Math.min(size, nx - ci), cd = Math.min(size, nz - ck), W = cw + 4;
    // surfaces of the chunk, its apron and one ring more (for what each side face shows)
    let yMin = 1e9, yMax = -1e9, land = false;
    grows.length = 0;
    for (let b = 0; b < cd + 4; b += 1) for (let a = 0; a < W; a += 1) {
      const i = ci + a - 2, k = ck + b - 2, n = at(i, k), m = b * W + a;
      if (n < 0) { tops[m] = -6; ids[m] = K.r2; continue; }
      const s = surface(n, i, k);
      tops[m] = s.top; ids[m] = s.id;
      if (a >= 1 && b >= 1 && a < W - 1 && b < cd + 3) {
        yMin = Math.min(yMin, s.top - 1); yMax = Math.max(yMax, s.top);
        if (R.kind[n] === KIND.BRIDGE || R.kind[n] === KIND.GATE) yMax = Math.max(yMax, R.deck[n] + 3);
        if (s.top > 0) land = true;
        if (s.grow && a >= 2 && b >= 2 && a < W - 2 && b < cd + 2) grows.push(i, k, s.top, s.grow);
      }
    }
    if (!land) continue;
    yMax += 44; // room for merlons, roofs, lamps
    const sy = yMax - yMin + 1, g = grid(cw + 2, sy, cd + 2);
    // the highest and lowest visible voxel of each column, to mesh only the blocks that hold a surface
    const hi = new Int16Array((cw + 2) * (cd + 2)).fill(-999), lo = new Int16Array((cw + 2) * (cd + 2)).fill(9999);
    const put = (x, y, z, id) => {
      const gx = x - (ci + i0 - 1), gz = z - (ck + k0 - 1), gy = y - yMin;
      if (!id || gx < 0 || gz < 0 || gy < 0 || gx >= cw + 2 || gz >= cd + 2 || gy >= sy) return;
      g.data[gx + g.sx * (gz + g.sz * gy)] = id;
      const c = gz * (cw + 2) + gx; if (gy > hi[c]) hi[c] = gy; if (gy < lo[c]) lo[c] = gy;
    };
    const sxz = g.sx * g.sz;
    for (let b = 1; b < cd + 3; b += 1) for (let a = 1; a < W - 1; a += 1) {
      const i = ci + a - 2, k = ck + b - 2, n = at(i, k), m = b * W + a, top = tops[m];
      const inner = a >= 2 && b >= 2 && a < W - 2 && b < cd + 2;
      const low = Math.min(tops[m - 1], tops[m + 1], tops[m - W], tops[m + W], top - 1);
      const gx = a - 1, gz = b - 1, x = i + i0, z = k + k0, kind = n < 0 ? KIND.SEA : R.kind[n];
      let idx = gx + g.sx * gz;
      const c = gz * (cw + 2) + gx;
      hi[c] = Math.max(hi[c], top - 1 - yMin); lo[c] = Math.min(lo[c], low - yMin);
      for (let y = yMin; y < top; y += 1, idx += sxz) {
        g.data[idx] = !inner || y < low ? K.r2 : y === top - 1 ? ids[m] : side(n, kind, x, y, z, R.top[n]);
      }
      voxels += top - low;
    }
    structures(put, ci, ck, cw, cd);
    // mesh in blocks, skipping those with nothing to show (all buried, or all air)
    const parts = [], BX = 64, BY = 16;
    for (let bz = 1; bz <= cd; bz += BX) for (let bx = 1; bx <= cw; bx += BX) {
      const w = Math.min(BX, cw + 1 - bx), d = Math.min(BX, cd + 1 - bz);
      let blo = 9999, bhi = -999;
      for (let z = bz - 1; z <= bz + d; z += 1) for (let x = bx - 1; x <= bx + w; x += 1) { const c = z * (cw + 2) + x; if (lo[c] < blo) blo = lo[c]; if (hi[c] > bhi) bhi = hi[c]; }
      for (let by = Math.max(1, blo - 1); by <= Math.min(sy - 1, bhi + 1); by += BY) {
        const h = Math.min(BY, sy - by);
        parts.push({ ...meshBox(g, bx, by, bz, w, h, d), at: [bx - 1, by - 1, bz - 1] });
      }
    }
    const main = merge(parts);
    if (!main) continue;
    // what grows on the ground (tufts, flowers, crops, mushrooms, shells): its own small mesh, drawn near only
    out.push({ ci, ck, at: [(ci + i0) * V, (yMin + 1) * V, (ck + k0) * V], main, detail: detail(grows, ci, yMin + 1, ck) });
  }
  return { chunks: out, voxels };
}
export function chunkList(size = CHUNK) {
  const R = raster(), list = [];
  for (let ck = 0; ck < R.nz; ck += size) for (let ci = 0; ci < R.nx; ci += size) list.push([ci, ck]);
  return list;
}
const transfers = (c) => [c.main, c.detail].filter(Boolean).flatMap((a) => [a.pos.buffer, a.nor.buffer, a.col.buffer, a.glow.buffer, a.idx.buffer]);

// The ground as meshes: its chunks built by a few workers at once (or here, if they can't be had).
export async function buildGround(THREE, { plots = {}, workers = Math.min(6, Math.max(1, (globalThis.navigator?.hardwareConcurrency || 4) - 2)) } = {}) {
  const t0 = performance.now();
  const list = chunkList(), specs = JSON.parse(JSON.stringify(plots)); // plain data for the workers
  let chunks = null, voxels = 0, via = 'main';
  if (workers > 1 && typeof Worker !== 'undefined') {
    try {
      const jobs = Array.from({ length: workers }, (_, w) => list.filter((_, i) => i % workers === w));
      const done = await Promise.all(jobs.map((job) => new Promise((resolve, reject) => {
        const wk = new Worker(new URL('./ground-worker.js', import.meta.url), { type: 'module' });
        wk.onmessage = (e) => { wk.terminate(); if (e.data.error) reject(new Error(e.data.error)); else resolve(e.data); };
        wk.onerror = (e) => { wk.terminate(); reject(new Error(e.message || 'worker failed')); };
        wk.postMessage({ plots: specs, list: job });
      })));
      chunks = done.flatMap((d) => d.chunks);
      voxels = done.reduce((a, d) => a + d.voxels, 0);
      via = `${workers} workers`;
    } catch (e) { console.warn('the town ground is built without workers:', e.message); }
  }
  if (!chunks) ({ chunks, voxels } = chunkArrays({ plots: specs, list }));
  const order = new Map(list.map(([ci, ck], i) => [`${ci},${ck}`, i]));
  chunks.sort((a, b) => order.get(`${a.ci},${a.ck}`) - order.get(`${b.ci},${b.ck}`));
  const material = townMaterial(THREE), group = new THREE.Group(), meshes = [];
  group.name = 'town-ground';
  let tris = 0, details = 0;
  const meshOf = (a, detailed) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(a.nor, 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(a.col, 3, true));
    g.setAttribute('glow', new THREE.BufferAttribute(a.glow, 1, true));
    g.setIndex(new THREE.BufferAttribute(a.idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    const m = new THREE.Mesh(g, material);
    m.scale.setScalar(V);
    m.receiveShadow = !detailed;
    m.matrixAutoUpdate = false;
    return m;
  };
  for (const c of chunks) {
    const mesh = meshOf(c.main, false);
    mesh.position.set(...c.at); mesh.updateMatrix();
    mesh.userData.chunk = [c.ci, c.ck];
    group.add(mesh); meshes.push(mesh);
    tris += c.main.idx.length / 3;
    if (c.detail) {
      const dm = meshOf(c.detail, true);
      dm.position.set(...c.at); dm.updateMatrix();
      dm.userData.detail = true;
      mesh.userData.detail = dm;
      group.add(dm);
      details += c.detail.idx.length / 3;
    }
  }
  return { group, chunks: meshes, material, raster: raster(), stats: { chunks: meshes.length, triangles: tris, details, ms: Math.round(performance.now() - t0), voxels, via } };
}
export { transfers };

// Small growing things as plain boxes (no bottom), in a chunk's frame (voxels from its origin).
const FACES = [[[0, 1, 0], [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]], [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]], [[-1, 0, 0], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]], [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]], [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]]];
function detail(grows, ox, oy, oz) {
  let n = 0;
  for (let q = 0; q < grows.length; q += 4) n += grows[q + 3].length;
  if (!n) return null;
  const pos = new Float32Array(n * 20 * 3), nor = new Int8Array(n * 20 * 3), colr = new Uint8Array(n * 20 * 3), gl = new Uint8Array(n * 20), idx = new Uint32Array(n * 30);
  let v = 0, e = 0;
  for (let q = 0; q < grows.length; q += 4) {
    const i = grows[q], k = grows[q + 1], top = grows[q + 2], list = grows[q + 3];
    list.forEach((id, j) => {
      const x = i - ox, y = top + j - oy, z = k - oz, rgb = PALETTE[id], lit = GLOWS.has(id) ? 255 : 0;
      for (const [f, [nx, ny, nz], quad] of FACES.map((F, fi) => [fi, ...F])) {
        if (f === 0 && j < list.length - 1) continue; // the top of a lower voxel in a stack is hidden
        const shade = f === 0 ? 1 : 0.8;
        for (const [a, b, c] of quad) {
          pos.set([x + a, y + b, z + c], v * 3); nor.set([nx * 127, ny * 127, nz * 127], v * 3);
          colr.set([rgb[0] * 255 * shade, rgb[1] * 255 * shade, rgb[2] * 255 * shade], v * 3); gl[v] = lit; v += 1;
        }
        idx.set([v - 4, v - 3, v - 2, v - 4, v - 2, v - 1], e); e += 6;
      }
    });
  }
  return { pos: pos.slice(0, v * 3), nor: nor.slice(0, v * 3), col: colr.slice(0, v * 3), glow: gl.slice(0, v), idx: idx.slice(0, e) };
}

// The mesher's solid and glowing faces, from every block, as one geometry; a `glow` attribute marks the glowing.
function merge(parts) {
  const sinks = [];
  for (const p of parts) for (const [part, lit] of [[p.opaque, 0], [p.glow, 255]]) if (part.indices.length) sinks.push({ part, lit, at: p.at });
  const nv = sinks.reduce((a, s) => a + s.part.positions.length / 3, 0), ni = sinks.reduce((a, s) => a + s.part.indices.length, 0);
  if (!nv) return null;
  const pos = new Float32Array(nv * 3), nor = new Int8Array(nv * 3), colr = new Uint8Array(nv * 3), gl = new Uint8Array(nv);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let v = 0, e = 0;
  for (const { part, lit, at } of sinks) {
    const n = part.positions.length / 3;
    for (let q = 0; q < n; q += 1) { pos[(v + q) * 3] = part.positions[q * 3] + at[0]; pos[(v + q) * 3 + 1] = part.positions[q * 3 + 1] + at[1]; pos[(v + q) * 3 + 2] = part.positions[q * 3 + 2] + at[2]; }
    nor.set(part.normals, v * 3); colr.set(part.colours, v * 3); gl.fill(lit, v, v + n);
    for (let q = 0; q < part.indices.length; q += 1) idx[e + q] = part.indices[q] + v;
    v += n; e += part.indices.length;
  }
  return { pos, nor, col: colr, glow: gl, idx };
}

// The ground's material: Lambert with the vertex colours, plus three touches in its shader. Every voxel face
// gets its own small shift of tone by a hash of its cell, so a large merged face still reads as voxels; glow
// faces draw unlit and breathe a little; and at night the street lamps' light, baked into a small texture
// over the town (lampMap: warmth in R, the lamps' floor height in G), pools warm on the ground under them.
export function townMaterial(THREE) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  const U = m.userData.uniforms = {
    uTime: { value: 0 }, uNight: { value: 1 }, uLampMap: { value: null }, uLampRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uLampColor: { value: new THREE.Color(0xffb35c) },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;\nvarying vec3 vWp;\nvarying vec3 vWn;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvGlow = glow;\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWn = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vGlow;
varying vec3 vWp;
varying vec3 vWn;
uniform float uTime;
uniform float uNight;
uniform sampler2D uLampMap;
uniform vec4 uLampRect;
uniform vec3 uLampColor;
float cellHash(vec3 c) { return fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 cell = floor((vWp - vWn * 0.075) / 0.15 + 0.001);
float hv = cellHash(cell);
diffuseColor.rgb *= mix(1.0 + (hv - 0.5) * 0.16, 1.0, vGlow);`)
      .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;', `vec2 luv = (vWp.xz - uLampRect.xy) / uLampRect.zw;
vec4 lm = texture2D(uLampMap, luv);
float lampK = lm.r * uNight * smoothstep(3.2, 0.2, abs(vWp.y - lm.g * 16.0)) * (0.55 + 0.45 * max(vWn.y, 0.0));
reflectedLight.indirectDiffuse += diffuseColor.rgb * uLampColor * lampK * 1.6;
vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
float pulse = 0.86 + 0.14 * sin(uTime * 2.2 + hv * 6.283 + vWp.x * 0.3);
outgoingLight = mix(outgoingLight, diffuseColor.rgb * pulse, vGlow);`);
  };
  m.customProgramCacheKey = () => 'town-ground';
  return m;
}

// The street lamps' light as a small texture over the town: warmth falling off round each lantern (R) and
// the height of the ground it lights (G, in units / 16), for the ground's shader to pool at night.
export function lampTexture(THREE, lamps, { size = 256 } = {}) {
  const R = raster(), x0 = R.i0 * V, z0 = R.k0 * V, w = R.nx * V, d = R.nz * V;
  const warm = new Float32Array(size * size), floor = new Float32Array(size * size), wsum = new Float32Array(size * size);
  for (const l of lamps) {
    const r = l.r || 3.4, px = ((l.at[0] - x0) / w) * size, pz = ((l.at[1] - z0) / d) * size, rp = (r / w) * size;
    for (let b = Math.floor(pz - rp); b <= Math.ceil(pz + rp); b += 1) for (let a = Math.floor(px - rp); a <= Math.ceil(px + rp); a += 1) {
      if (a < 0 || b < 0 || a >= size || b >= size) continue;
      const q = Math.hypot(a + 0.5 - px, b + 0.5 - pz) / rp;
      if (q >= 1) continue;
      const k = (1 - q * q) ** 2 * (l.power || 1), m = b * size + a;
      warm[m] += k; floor[m] += k * l.y * V; wsum[m] += k;
    }
  }
  const data = new Uint8Array(size * size * 4);
  for (let m = 0; m < size * size; m += 1) {
    data[m * 4] = Math.min(255, warm[m] * 255);
    data[m * 4 + 1] = wsum[m] > 0 ? Math.min(255, (floor[m] / wsum[m] / 16) * 255) : 0;
    data[m * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return { tex, rect: new THREE.Vector4(x0, z0, w, d) };
}
