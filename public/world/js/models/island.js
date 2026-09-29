// Floating islands, medieval-cyber: turf in four tones with tufts, flowers and a
// few glowing mushrooms; cobbled paths whose seams glow with circuit light;
// flagstone yards and ringed plazas; a tapering rocky underside in strata with
// glowing veins, roots and hanging crystals; floating fragments; an iron lamp
// with a plasma orb and a banner pole with a holographic flag, a festoon cable
// slung between them. Painted by rules (height, path distance, edge distance,
// noise), never by hand.
//
// makeIsland({ A, B, seed, paths, plazas, flags, theme }) -> { part, edge(x, z), A, B }
//   A, B    radii in voxels along x and z; the outline wobbles by a seeded noise
//   paths   polylines [[x, z], ...]: cobbles with glowing seams, a gravel verge
//   plazas  circles [cx, cz, r]: cobbles laid in rings round a glowing ring
//   flags   rectangles [x0, z0, x1, z1, gx0?, gx1?]: flagstones; seams glow in
//           patches (only between x gx0..gx1 when given)
//   theme   { turf1: 0x..., seamGlow: 0x..., ... }: overrides any colour in BASE
// `edge(x, z)` is 0 at the middle and 1 at the rim. All in model voxels, island
// centre at 0, 0; y 0 is the top of the turf. `island` and `ISLE` are the
// approved prototype's island (the review page shows it).
//
// plotPaint(spec, { lip, speckle }) is the same ground one column at a time: the
// town (js/town/ground.js) paints each district's plot with it, flush with the
// streets round it (no lip) and with its turf speckled in the town's shader.
import { C, colour, hash, noise } from '../kit/voxel-kit.js';
import { box, tone } from './space.js';

const BASE = [
  ['turf1', 0x3f6b2c], ['turf2', 0x4d7d33], ['turf3', 0x5f8f3c], ['turf4', 0x7c9a45], ['blade', 0x6fa648], ['blade2', 0x87b653],
  ['soil1', 0x5a3d25], ['soil2', 0x6b4a2e], ['soil3', 0x4a3120], ['root', 0x3b2818],
  ['rock1', 0x77737f], ['rock2', 0x67636f], ['rock3', 0x87828c], ['rock4', 0x55525e], ['rock5', 0x8e8374],
  ['cob1', 0x9d978c], ['cob2', 0x8a8479], ['cob3', 0xafa899], ['cob4', 0x7a7469], ['seam', 0x34312e],
  ['seamGlow', 0x1d9bb0, true], ['seamHot', 0x6ff2ff, true],
  ['flag1', 0xb3aa98], ['flag2', 0xa39a88], ['flag3', 0x958c7b], ['gravel', 0x8f887b], ['dirt', 0x76583a],
  ['petalW', 0xf3efe2], ['petalY', 0xf2cd4c], ['petalV', 0xa678e0], ['stem', 0xe0d6be], ['cap', 0xc07cff, true], ['cap2', 0x6ff2ff, true],
  ['vein', 0x59e6ff, true], ['vein2', 0xa98bff, true], ['crys1', 0xe6fdff, true], ['crys2', 0x6ff2ff, true], ['crys3', 0x9b7bff, true],
  ['pl1', 0xf4fdff, true], ['pl2', 0x9ff8ff, true], ['pl3', 0x4fc6ff, true], ['pl4', 0x9b6bff, true],
  ['h1', 0xd8fdff, true], ['h2', 0x3fe6ff, true], ['h3', 0x1a9fc0, true], ['hm', 0xff5ad8, true],
  ['bead1', 0xffc764, true], ['bead2', 0xff5ad8, true], ['bead3', 0x6ff2ff, true],
];
for (const [n, hex, glow] of BASE) colour(`isle_${n}`, hex, glow);
const K = (n) => C[`isle_${n}`];
const col = (name, hex, glow) => C[name] ?? colour(name, hex, glow);
// A theme's palette: every BASE name to an id, overridden colours registered once per hex.
function paletteOf(theme = {}) {
  const P = {};
  for (const [n, , glow] of BASE) P[n] = theme[n] === undefined ? K(n) : col(`isle_${n}_${theme[n].toString(16)}`, theme[n], glow);
  return P;
}
const mod = (a, n) => ((a % n) + n) % n;

// 0 at the middle, 1 at the rim; the rim wobbles by a noise that depends on the seed.
export const edgeOf = (A, B, s = 0) => (x, z) => {
  const th = Math.atan2(z / B, x / A);
  const wob = 1 + 0.12 * (noise(Math.cos(th) * 2.2 + 10 + s * 17, Math.sin(th) * 2.2 + 10 + s * 29, 1, 4 + s) - 0.5) + 0.03 * Math.sin(th * 5 + 1 + s);
  return Math.hypot(x / A, z / B) / wob;
};
const segDist = (pts) => (x, z) => {
  let best = Infinity;
  for (let i = 1; i < pts.length; i += 1) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
};

// The top of one column of a district's ground (model voxels about its centre): cobbled paths with glowing
// seams, ringed plazas, flagstone yards, turf in patches, and what grows on open turf. The town paints its
// plots with it (no lip: they sit flush in the town); the islands' ground below uses it too.
//   plotPaint(island, { lip }) -> (x, z, d?) => { id, sink (a seam, one voxel down), grow: [ids stacked on top], open }
export function plotPaint({ A, B, seed: s = 0, paths = [], plazas = [], flags = [], theme = {} }, { lip: rim = true, speckle = true } = {}) {
  const P = paletteOf(theme), edge = edgeOf(A, B, s), lipAt = rim ? 1 - 2.3 / Math.min(A, B) : 9;
  const dPath = paths.filter((pts) => pts && pts.length > 1).map(segDist);
  const pathDist = (x, z) => dPath.reduce((m, f) => Math.min(m, f(x, z)), Infinity);
  const paint = (x, z, d = edge(x + 0.5, z + 0.5)) => {
    const lip = d > lipAt;
    const dp = pathDist(x + 0.5, z + 0.5);
    const flag = !lip && flags.find(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1);
    const plaza = !lip && !flag && plazas.find(([cx, cz, r]) => Math.hypot(x + 0.5 - cx, z + 0.5 - cz) <= r);
    const r = hash(x, z, 1 + s);
    let id, sink = false;
    const grow = [];
    if (flag) {
      const row = Math.floor((z + 100) / 4), sx = mod(x + (row % 2) * 2, 5), sz = mod(z, 4);
      sink = sx === 0 || sz === 0;
      const [, , , , gx0 = -1e9, gx1 = 1e9] = flag;
      id = sink ? (x >= gx0 && x <= gx1 && noise(x, z, 4, 8) > (flag.length > 4 ? 0.35 : 0.55) ? P.seamGlow : P.seam) : [P.flag1, P.flag2, P.flag3][Math.floor(hash(Math.floor((x + (row % 2) * 2 + 100) / 5), row, 3) * 3)];
    } else if (plaza) {
      const [cx, cz, pr] = plaza;
      const rr = Math.hypot(x + 0.5 - cx, z + 0.5 - cz), ring = Math.floor(rr / 3);
      const a = Math.atan2(z + 0.5 - cz, x + 0.5 - cx) / (Math.PI * 2) + 0.5;
      const segs = Math.max(6, Math.round((Math.PI * 2 * (ring * 3 + 1.5)) / 4.5));
      const u = mod(a * segs + ring * 0.5, 1);
      const joint = rr % 3 < 0.8 || u < 0.75 / ((Math.PI * 2 * (ring * 3 + 1.5)) / segs);
      sink = joint && rr > 1.5;
      if (rr > pr - 1.2) { id = tone([P.cob4, P.rock2, P.cob4], x, 0, z, 3 + s); sink = false; } // a kerb
      else if (sink) id = ring === Math.floor(pr / 3) - 1 && rr % 3 < 0.8 ? P.seamHot : noise(x, z, 5, 6 + s) > 0.55 ? P.seamGlow : P.seam;
      else id = [P.cob1, P.cob2, P.cob3, P.cob3][Math.floor(hash(ring, Math.floor(a * segs + ring * 0.5), 5 + s) * 4)];
    } else if (dp < 3.6 && !lip) {
      const row = Math.floor((z + 100) / 3), sz = mod(z, 3) === 0, sx = mod(x + row * 2, 4) === 0;
      sink = sz || sx;
      if (sink) id = noise(x, z, 5, 6) > 0.52 ? (hash(x, z, 9) < 0.08 ? P.seamHot : P.seamGlow) : P.seam;
      else {
        const cid = hash(Math.floor((x + row * 2 + 100) / 4), row, 5);
        id = cid < 0.08 ? P.turf2 : [P.cob1, P.cob2, P.cob3, P.cob4][Math.floor(cid * 4)];
      }
    } else if (dp < 5.2 && !lip) {
      id = r < 0.35 ? P.gravel : r < 0.6 ? P.dirt : r < 0.8 ? P.turf4 : P.turf3;
      if (hash(x, z, 29) > 0.93) grow.push(P.blade);
    } else {
      const n = noise(x, z, 11, 1 + s);
      const T = n < 0.32 ? [P.turf1, P.turf2] : n < 0.58 ? [P.turf2, P.turf3] : n < 0.8 ? [P.turf3, P.turf2] : [P.turf4, P.turf3];
      id = speckle ? T[r < 0.7 ? 0 : 1] : T[0]; // the town speckles its turf in its shader instead, so its faces merge
      if (!lip) { // things that grow on open ground
        const f = noise(x, z, 8, 5 + s), h2 = hash(x, z, 23 + s);
        if (d > 0.72 && noise(x, z, 6, 9) > 0.66 && h2 > 0.99) grow.push(P.stem, h2 > 0.997 ? P.cap2 : P.cap);
        else if (f > 0.76 && h2 > 0.8 && hash(Math.floor(x / 3), Math.floor(z / 3), 6) > 0.55) grow.push([P.petalW, P.petalY, P.petalV][Math.floor(hash(x, z, 4) * 3)]);
        else if (h2 > 0.9) { grow.push(h2 > 0.95 ? P.blade2 : P.blade); if (h2 > 0.975) grow.push(P.blade2); }
        else if (h2 < 0.006) grow.push(P.cob4);
      }
    }
    return { id, sink, grow, lip, open: !flag && !plaza && dp >= 3.6 };
  };
  paint.P = P;
  paint.edge = edge;
  return paint;
}

function buildGround({ A, B, seed: s, paths, plazas, flags, theme, edge }) {
  const R = Math.min(A, B);
  const k = Math.max(0.75, Math.min(1.3, R / 64)); // bigger islands hang deeper
  const cap = Math.round(42 * k);
  const bandAt = 1 - 4.5 / R;
  const paint = plotPaint({ A, B, seed: s, paths, plazas, flags, theme }), P = paint.P;
  // a cliff of 6 to 9 at the rim, then a lumpy cone down to a point
  const depthAt = (x, z, d) => Math.min(cap, Math.round(6 + 3 * noise(x + s * 101, z, 5, 5) + 34 * k * Math.max(0, 1 - d) ** 0.65 * (0.6 + 0.6 * noise(x, z + s * 71, 12, 2)) + 6 * Math.max(0, 0.3 - d) * noise(x, z, 5, 3)));
  const ex = Math.ceil(A * 1.1) + 1, ez = Math.ceil(B * 1.1) + 1;
  const g = box([-ex, -cap - 2, -ez], [ex, 2, ez]);
  for (let z = -ez; z <= ez; z += 1) for (let x = -ex; x <= ex; x += 1) {
    const d = edge(x + 0.5, z + 0.5);
    if (d > 1) continue;
    const D = depthAt(x, z, d);
    const { id, sink, grow, lip } = paint(x, z, d);
    const top = lip ? -2 : -1;
    // ---- the column: turf, soil with roots, strata of rock with glowing veins
    for (let y = top; y >= -1 - D; y -= 1) {
      const dy = top - y;
      let v;
      if (dy === 0) v = sink ? 0 : id;
      else if (dy === 1 && sink) v = id;
      else if (dy <= 2) v = lip || d > bandAt ? (dy === 1 ? P.turf1 : P.soil2) : tone([P.soil1, P.soil2, P.soil2, P.root], x, y, z, 2);
      else if (dy <= 4) v = hash(x, y, z) < 0.45 ? P.soil3 : P.rock2;
      else {
        const band = Math.floor((y + 44 + noise(x, z, 9, 7) * 5) / 3);
        const vein = Math.abs(noise(x + y * 0.8, z - y * 0.6, 6, 11 + s) - 0.5) < 0.012 && dy > 6;
        v = vein ? (band % 2 ? P.vein : P.vein2) : [P.rock1, P.rock2, P.rock3, P.rock1, P.rock4, P.rock5][mod(band, 6)];
        if (!vein && hash(x, y, z) < 0.12) v = P.rock4;
        if (y <= -1 - D + 1 && D > 20) v = P.rock4;
      }
      if (v) g.put(x, y, z, v);
    }
    grow.forEach((v, i) => g.put(x, i, z, v));
  }
  // ---- roots hanging from the rim, some with glowing tips
  const roots = Math.round((Math.PI * (A + B)) / 31);
  for (let i = 0; i < roots; i += 1) {
    const th = i * ((Math.PI * 2) / roots) + 0.2 + (hash(i, s, 3) - 0.5) * 0.25;
    let x = Math.cos(th) * A * 0.98, z = Math.sin(th) * B * 0.98;
    for (let n = 0; n < 30 && edge(x, z) > 0.97; n += 1) { x *= 0.98; z *= 0.98; }
    const ox = Math.cos(th), oz = Math.sin(th), L = 8 + (i % 4) * 3;
    g.rope([[x, -3, z], [x + ox * 2.5, -3 - L * 0.5, z + oz * 2.5], [x + ox * 3.2 + oz, -3 - L, z + oz * 3.2 - ox]], 0.9, 0.5, P.root);
    if (i % 2) g.put(Math.floor(x + ox * 3.2 + oz), -3 - L, Math.floor(z + oz * 3.2 - ox), P.cap);
  }
  // ---- crystals hanging from the underside
  const hang = Math.min(14, Math.round((7 * A * B) / (74 * 64)));
  for (let i = 0; i < hang; i += 1) {
    const th = i * 0.9 + 0.3 + s, rr = 0.25 + 0.12 * (i % 4);
    const x = Math.round(Math.cos(th) * rr * A), z = Math.round(Math.sin(th) * rr * B);
    const D = depthAt(x, z, edge(x + 0.5, z + 0.5));
    const y0 = -1 - D;
    const L = Math.min(8 + (i % 3) * 4, cap + 1 + y0);
    if (L < 4) continue;
    for (const [dx, dz, sc] of [[0, 0, 1], [1.6, 0.8, 0.6], [-1.2, 1.4, 0.5]]) {
      const len = Math.round(L * sc);
      for (let n = 0; n <= len; n += 1) {
        const rad = (1 - n / (len + 1)) * 1.7 * (0.6 + 0.4 * sc) + 0.35;
        for (let zz = -2; zz <= 2; zz += 1) for (let xx = -2; xx <= 2; xx += 1) {
          if (Math.hypot(xx + 0.5 - (dx % 1), zz + 0.5 - (dz % 1)) <= rad) g.put(x + xx + Math.trunc(dx), y0 - n + 1, z + zz + Math.trunc(dz), n > len * 0.7 ? P.crys1 : (xx + zz + n) % 3 ? P.crys2 : P.crys3);
        }
      }
    }
  }
  return g;
}

export function makeIsland({ A = 74, B = 64, seed = 0, paths = [], plazas = [], flags = [], theme = {} } = {}) {
  const edge = edgeOf(A, B, seed);
  const g = buildGround({ A, B, seed, paths, plazas, flags, theme, edge });
  return { part: g.part('ground', [0, 0, 0]), edge, A, B };
}

// A fragment of island adrift: a lump of rock, a cap of turf, crystals growing out of it.
export function fragment(name, [cx, cy, cz], s, seed) {
  const f = box([cx - 8, cy - 12, cz - 8], [cx + 8, cy + 8, cz + 8]);
  for (let z = -7; z <= 7; z += 1) for (let x = -7; x <= 7; x += 1) {
    const d = Math.hypot(x, z) / (6 * s * (0.85 + 0.3 * noise(x, z, 3, seed)));
    if (d > 1) continue;
    const D = Math.round(2 + 9 * s * (1 - d) * (0.6 + 0.6 * noise(x, z, 4, seed + 1)));
    for (let y = 0; y >= -D; y -= 1) f.put(cx + x, cy + y, cz + z, y === 0 ? (hash(x, z, seed) < 0.5 ? K('turf2') : K('turf3')) : y === -1 ? K('soil2') : [K('rock1'), K('rock2'), K('rock3')][mod(Math.floor((y + seed) / 2), 3)]);
    if (hash(x, z, seed + 5) > 0.9 && d < 0.8) f.put(cx + x, cy + 1, cz + z, K('blade'));
  }
  for (const [x, z, h] of [[0, 0, 5], [1, 1, 3], [-1, 1, 2]]) for (let y = 1; y <= Math.round(h * s + 1); y += 1) f.put(cx + x, cy + y, cz + z, y > h * s ? K('crys1') : (x + y) % 2 ? K('crys2') : K('crys3'));
  f.put(cx, cy - Math.round(8 * s), cz, K('crys2'));
  return f.part(name, [cx + 0.5, cy, cz + 0.5]);
}

// ---- props, each at its own origin (base centre at 0, 0, 0)
function lampParts() {
  const l = box([-3, 0, -3], [3, 34, 3]);
  l.fill(-3, 0, -3, 3, 0, 3, (x, y, z) => (Math.abs(x) + Math.abs(z) > 5 ? 0 : tone([C.stone2, C.stone3, C.stone3], x, y, z, 1)));
  l.fill(-2, 1, -2, 2, 1, 2, (x, y, z) => (Math.abs(x) === 2 && Math.abs(z) === 2 ? 0 : C.stone1));
  l.fill(-1, 2, -1, 1, 2, 1, C.iron2);
  // a round-ish post, a spiral of circuit light up it, brass collars
  for (let y = 3; y <= 24; y += 1) for (let z = -1; z <= 0; z += 1) for (let x = -1; x <= 0; x += 1) {
    const a = mod(Math.floor(y / 2), 4), spiral = [[-1, -1], [0, -1], [0, 0], [-1, 0]][a];
    l.put(x, y, z, x === spiral[0] && z === spiral[1] && y > 9 && y < 17 ? K('seamGlow') : y % 3 ? C.iron1 : C.iron2);
  }
  for (const y of [8, 18]) l.fill(-2, y, -2, 1, y, 1, (x, yy, z) => ((x === -2 || x === 1) && (z === -2 || z === 1) ? 0 : C.brass2));
  l.fill(-2, 25, -2, 1, 25, 1, C.iron2);
  for (const [x, z] of [[-2, -2], [1, -2], [-2, 1], [1, 1]]) l.fill(x, 26, z, x, 30, z, C.iron1);
  l.fill(-2, 31, -2, 1, 31, 1, C.iron2);
  l.fill(-1, 32, -1, 0, 32, 0, C.iron3);
  l.put(-1, 33, -1, C.brass2); l.put(-1, 34, -1, C.iron3);
  // scrolls under the cage
  for (const [x, z] of [[-3, -1], [2, -1], [-1, -3], [-1, 2]]) { l.put(x, 24, z, C.iron2); l.put(x, 23, z, C.iron2); }
  const orb = box([-2, 26, -2], [1, 30, 1]);
  orb.egg(0, 28.4, 0, 1.75, 2.1, 1.75, (x, y, z) => { const d = Math.hypot(x + 0.5, (y + 0.5 - 28.4) * 0.85, z + 0.5); return d < 0.8 ? K('pl1') : d < 1.3 ? K('pl2') : hash(x, y, z) < 0.5 ? K('pl3') : K('pl4'); });
  const spark = box([2, 28, 0], [2, 28, 0]);
  spark.put(2, 28, 0, K('pl1'));
  return { lamp: l.part('lamp', [0, 0, 0]), orb: orb.part('orb', [0, 28.4, 0]), spark: spark.part('spark', [0, 28.4, 0]) };
}
const SIGIL = ['...#...', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '...#...'];
function poleParts() {
  const p = box([-3, 0, -3], [16, 41, 2]);
  p.fill(-3, 0, -3, 2, 0, 2, (x, y, z) => tone([C.stone2, C.stone3], x, y, z, 2));
  p.fill(-2, 1, -2, 1, 1, 1, C.stone1);
  p.fill(-1, 2, -1, 0, 38, 0, (x, y, z) => (y % 8 === 0 ? C.iron2 : y % 8 === 1 ? C.iron3 : tone([C.wood1, C.wood2, C.wood2], x, y, z, 3)));
  p.fill(0, 36, -1, 15, 36, 0, (x, y, z) => (x % 4 === 3 ? C.iron3 : C.iron2)); // crossbar
  p.fill(14, 35, -1, 15, 35, 0, C.iron2); p.put(15, 34, -1, K('h2'));
  for (let y = 39; y <= 41; y += 1) p.put(-1, y, -1, y === 41 ? K('crys1') : K('crys2')); // crystal finial
  p.put(0, 39, -1, K('crys3')); p.put(-1, 39, 0, K('crys3'));
  // the flag, in seven strips so it can ripple
  const strips = {};
  for (let k = 0; k < 7; k += 1) {
    const s = box([1 + 2 * k, 18, -1], [2 + 2 * k, 35, -1]);
    for (let y = 18; y <= 35; y += 1) for (let x = 1 + 2 * k; x <= 2 + 2 * k; x += 1) {
      const gi = x - 5, gj = 31 - y;
      const edge = y === 35 || x === 1 || x === 14 || y === 20;
      if (y < 20 && (x + y) % 2) continue; // a fringe
      if (gi >= 0 && gi < 7 && gj >= 0 && gj < 7 && SIGIL[gj][gi] === '#') s.put(x, y, -1, K('hm'));
      else if (edge || y < 20) s.put(x, y, -1, K('h2'));
      else if (y % 2 === 0 && hash(x, y, 71) > 0.2) s.put(x, y, -1, K('h3'));
      else if (y === 33 || y === 22) s.put(x, y, -1, K('h1'));
    }
    strips[`flag${k}`] = s.part(`flag${k}`, [2 + 2 * k, 36, -0.5]);
  }
  return { pole: p.part('pole', [0, 0, 0]), ...strips };
}

// The festoon: a cable sagging from a to b (model voxels), glowing beads along it.
export function festoon([ax, ay, az], [bx, by, bz], { sag = 7, name = 'festoon' } = {}) {
  const f = box([Math.floor(Math.min(ax, bx)) - 2, Math.floor(Math.min(ay, by)) - sag - 3, Math.floor(Math.min(az, bz)) - 2], [Math.ceil(Math.max(ax, bx)) + 2, Math.ceil(Math.max(ay, by)) + 1, Math.ceil(Math.max(az, bz)) + 2]);
  const pts = [];
  for (let i = 0; i <= 20; i += 1) { const t = i / 20; pts.push([ax + (bx - ax) * t, ay + (by - ay) * t - sag * 4 * t * (1 - t), az + (bz - az) * t]); }
  f.rope(pts, 0.5, 0.5, C.iron1);
  for (let i = 1; i < 20; i += 1) {
    const [x, y, z] = pts[i];
    if (i % 2) continue;
    f.put(Math.floor(x), Math.floor(y) - 1, Math.floor(z), [K('bead1'), K('bead2'), K('bead3')][(i / 2) % 3]);
    f.put(Math.floor(x), Math.floor(y) - 2, Math.floor(z), [K('bead1'), K('bead2'), K('bead3')][(i / 2) % 3]);
  }
  return f.part(name, [0, 0, 0]);
}

const move = (parts, [dx, dy, dz]) => Object.fromEntries(Object.entries(parts).map(([n, p]) => [n, p.parent ? p : { ...p, at: [p.at[0] + dx, p.at[1] + dy, p.at[2] + dz] }]));

const LIFE = {
  lamp(P, t) {
    P.orb.rotation.y += t * 0.9;
    P.orb.scale.setScalar(1 + 0.07 * Math.sin(t * 3.1) + 0.03 * Math.sin(t * 11));
    P.spark.rotation.y += t * 3.2;
    P.spark.rotation.z += 0.5 * Math.sin(t * 1.7);
  },
  pole(P, t) {
    for (let k = 0; k < 7; k += 1) {
      const f = P[`flag${k}`];
      f.position.z += Math.sin(t * 2.2 - k * 0.75) * (0.25 + k * 0.22);
      f.rotation.x += Math.sin(t * 2.2 - k * 0.75 - 0.6) * 0.08;
      f.scale.x = hash(Math.floor(t * 14), k) < 0.02 ? 0 : 1; // hologram glitch
    }
  },
};

// The lamp's orb sits 28.4 voxels up (for halos and lights); the pole's flag hangs from its crossbar.
export const LAMP_ORB = 28.4;
export const lampDef = { gait: 'still', build: () => ({ parts: lampParts() }), idle: ({ parts, state }) => LIFE.lamp(parts, state.t), act: (ctx) => ctx.burst(ctx.where(ctx.parts.orb), 16, 2.4, [0xe6fdff, 0x9b6bff], 0.06, 0.8) };
export const poleDef = { gait: 'still', build: () => ({ parts: poleParts() }), idle: ({ parts, state }) => LIFE.pole(parts, state.t) };

// ---- the prototype's island (model voxels): the default look, kept for the review page
export const ISLE = {
  plot: [0, -22], // the workshop's origin
  lamp: [30, 40],
  pole: [-50, 20],
  path: [[12, 70], [11, 52], [5, 36], [-7, 20], [-14, 7], [-15, -6]],
  plaza: [-28, -10, 24, -3], // x0, z0, x1, z1
  edge: edgeOf(74, 64, 0),
};
let cached = null;
export const island = {
  gait: 'still',
  build() {
    if (cached) return cached;
    const [lx, lz] = ISLE.lamp, [qx, qz] = ISLE.pole;
    cached = {
      parts: {
        ground: makeIsland({ A: 74, B: 64, seed: 0, paths: [ISLE.path], flags: [[...ISLE.plaza, -6, 17]] }).part,
        ...move(lampParts(), [lx, 0, lz]),
        ...move(poleParts(), [qx, 0, qz]),
        festoon: festoon([ISLE.plot[0] - 23, 36, ISLE.plot[1] + 11.5], [qx - 0.5, 39, qz - 0.5]), // pole to the workshop's jetty
        fragA: fragment('fragA', [-92, -6, 24], 1, 3),
        fragB: fragment('fragB', [88, -14, -30], 0.8, 7),
        fragC: fragment('fragC', [74, -16, 34], 0.55, 11),
      },
    };
    return cached;
  },
  idle({ parts: P, state: { t } }) {
    LIFE.lamp(P, t);
    LIFE.pole(P, t);
    [['fragA', 0], ['fragB', 2], ['fragC', 4]].forEach(([n, ph]) => {
      P[n].position.y += Math.sin(t * 0.7 + ph) * 1.4;
      P[n].rotation.y += t * 0.05 + ph;
      P[n].rotation.z += Math.sin(t * 0.5 + ph) * 0.04;
    });
  },
  act(ctx) { lampDef.act(ctx); },
};
