// The town plan: one walled cyber-medieval town on a coastal hill, as plain data. The harbour and the
// sea cliff are at the front (+z, toward the camera), the hilltop at the back. The story reads as one
// loop: in at the sea gate to Gate Square (the hub), west along the Canal Lane to the Workshop Quarter,
// back through the square and up Market Street to the Market, up the Grand Stair to the Academy in the
// old upper town, up the Hill Stair to the Observatory on the hilltop, down the East Road to the Sky
// Docks on the harbour cliff, out of the postern and down the headland to the Lighthouse on its point,
// and home along the quay and up the Harbour Stair to the gate.
//
// Everything here is deterministic data and pure functions (no three.js), so node can check it:
//   node js/town/plan.js
// World units (x east, z south toward the camera) unless noted; heights in voxels (V = 0.15 units).
//
//   PLOTS    each district's plot: centre c, footprint A x B (voxels, the district's island radii),
//            seed (the rim's wobble), level y, entries (plot-local units; the first is its `dock`)
//   STREETS  polylines [[x, z, y], ...] with a width and a surface: the walking graph
//   RIVER    [[x, z, water level, width], ...]; the last point is the lip of the waterfall
//   WALLS    polylines along the town's edge; towers and gates are found from them (TOWERS, GATES)
//   LOTS     building lots along the streets for filler houses (footprint, facing the street, height
//            class, style zone), and ZONES for trees, gardens, flower beds, orchards and fields
//   raster() every voxel column of the island: its top, what it is, its water, what it belongs to
import { hash, noise } from '../kit/voxel-kit.js';

export const V = 0.15;
export const LEVEL = { sea: 0, quay: 6, point: 30, low: 46, mid: 68, top: 94 };
export const WALL = { land: 30, sea: 8, gate: 42, thick: 13 }; // heights over the town's ground (walls, gatehouses), thickness (voxels)

// ---- shapes -------------------------------------------------------------------------------------
// Corner cutting: a few rounds turn a control polygon into a smooth coast or terrace edge.
export function chaikin(pts, rounds = 3, closed = true) {
  let p = pts;
  for (let r = 0; r < rounds; r += 1) {
    const out = [];
    const n = closed ? p.length : p.length - 1;
    if (!closed) out.push(p[0]);
    for (let i = 0; i < n; i += 1) {
      const a = p[i], b = p[(i + 1) % p.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) out.push(p[p.length - 1]);
    p = out;
  }
  return p;
}
export function inPoly([x, z], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
// Distance from p to the segment ab, and how far along it (0..1) the nearest point is.
export function toSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
  const qx = ax + dx * t, qz = az + dz * t;
  return { d: Math.hypot(px - qx, pz - qz), t, x: qx, z: qz, side: Math.sign(dx * (pz - az) - dz * (px - ax)) };
}
// 0 at the plot's middle, 1 on its rim (voxels about its centre): the rim wobbles by the seed, as the
// islands' did, so a district's own `edgeOf(A, B, seed)` still finds the same rim.
export const edgeOf = (A, B, s = 0) => (x, z) => {
  const th = Math.atan2(z / B, x / A);
  const wob = 1 + 0.12 * (noise(Math.cos(th) * 2.2 + 10 + s * 17, Math.sin(th) * 2.2 + 10 + s * 29, 1, 4 + s) - 0.5) + 0.03 * Math.sin(th * 5 + 1 + s);
  return Math.hypot(x / A, z / B) / wob;
};

// The island's coast, the walled town, its two raised terraces, the harbour quay and the point.
export const COAST = [
  ...chaikin([[-86, 24], [-78, 29], [-66, 31.2]], 2, false),
  [-11.6, 31.2], [-8.8, 31], ...chaikin([[-7.8, 26.6], [-7, 24.6], [8, 24.4], [15, 24.2], [17, 29], [19, 37], [26, 41.5], [33, 40.5], [37.4, 35], [38.4, 29], [40.6, 23.4], [44, 19.6], [46.2, 16]], 2, false),
  [46.4, 6], [46.2, -4],
  ...chaikin([[48.6, -14], [48, -20], [42, -36], [28, -50], [12, -64], [-6, -86], [-36, -91], [-58, -86], [-76, -70], [-86, -46], [-88, -16], [-88, 10], [-86, 24]], 2, false),
];
export const TOWN = [
  [-66, 31.6], [-11.4, 31.6], [-7.4, 25], [-7.4, 19.6], [16.6, 19.6], [16.6, 17.4], [47.6, 17.4], [49, 6], [48.5, -6.5], [46.8, -13.8],
  [38.8, -13.8], [38.8, -27.8], [26.8, -27.8], [26.8, -39.8], [12.8, -39.8], [12.8, -51.8], [-6.8, -51.8], [-6.8, -76.8], [-46.8, -76.8], [-46.8, -52.8],
  [-57.8, -52.8], [-57.8, -26.8], [-66, -26.8],
];
export const UPPER = [
  [-72, -17.6], [-18.6, -17.6], [-18.6, -26.6], [-8.6, -26.6], [-8.6, -35.6], [13.4, -35.6], [13.4, -32.6], [40, -32.6], [40, -90], [-72, -90],
];
export const HILLTOP = [[-50, -50.6], [-4, -50.6], [-4, -90], [-50, -90]];
export const QUAY = [[-5, 20.2], [19, 20.4], [17, 23.6], [-4, 24.2], [-6.6, 22]];

// ---- the plots: each district's ground, flat at its level. Entries are plot-local units, on the rim.
export const PLOTS = {
  hub: { c: [3.5, 7.2], A: 70, B: 64, seed: 1, y: LEVEL.low, entries: [[0, 9.2], [-10, 0.6], [0.2, -9.2], [10, 0.8]] }, // sea gate, canal lane, market street, east street
  shipped: { c: [-34.7, 2.2], A: 168, B: 116, seed: 5, y: LEVEL.low, entries: [[20.6, 9.2]] }, // the end of the front lane
  more: { c: [-3, -20], A: 92, B: 76, seed: 6, y: LEVEL.low, entries: [[3.4, 10.6]] },
  education: { c: [-30, -34], A: 90, B: 80, seed: 4, y: LEVEL.mid, entries: [[-5.7, -10.7], [13.4, 2.2]] }, // through the range's gate, and in from the Grand Stair
  research: { c: [-26, -62], A: 72, B: 64, seed: 2, y: LEVEL.top, entries: [[7.6, 5.6]] }, // where the Hill Stair tops out
  work: { c: [34.8, 3.2], A: 88, B: 76, seed: 3, y: LEVEL.low, entries: [[-12.6, 1.8], [1.6, 10.7]], cliff: 'east' }, // the landward side, the postern
  contact: { c: [26, 35], A: 70, B: 54, seed: 7, y: LEVEL.point, entries: [[10, -1.8]], cliff: 'all' }, // the headland end
};
export const ORDER = ['hub', 'shipped', 'more', 'education', 'research', 'work', 'contact']; // the story's order
export const PLOT_IDS = Object.keys(PLOTS);
// A plot's centre sits on the voxel grid, so its district's voxels line up with the town's.
// An entry is given as a direction from the plot's middle; it sits just inside the plot's walkable ground.
for (const p of Object.values(PLOTS)) {
  p.o = [Math.round(p.c[0] / V), Math.round(p.c[1] / V)]; p.c = [p.o[0] * V, p.o[1] * V];
  const e = edgeOf(p.A, p.B, p.seed), walk = 1 - 1 / (Math.min(p.A, p.B) * V) - 0.015;
  p.entries = p.entries.map(([x, z]) => { const k = walk / e(x / V, z / V); return [+(x * k).toFixed(2), +(z * k).toFixed(2)]; });
}

// ---- the river: from a spring on the hill outside the walls, through the water gate, along the canal
// past the Workshop Quarter, and over the sea cliff. [x, z, water level (voxels), width (units)].
export const RIVER = [
  [-54, -62, 66, 1.4], [-63, -48, 57, 1.6], [-71, -30, 45, 1.8], [-74, -12, 44, 2], [-72.6, 2, 44, 2.2], [-69, 12, 43, 2.4],
  [-66, 17.6, 42, 2.8], [-48, 18.6, 42, 3.2], [-26, 18.6, 42, 3.2], [-16.5, 18.8, 42, 3.1], [-11.4, 24, 42, 2.8], [-10.2, 31, 42, 2.6],
];

// ---- the town walls: along the land side and the cliff tops; none along the Sky Docks' cliff
export const WALLS = [
  { kind: 'sea', pts: [[47.4, 16.4], [15.6, 16.4], [15.6, 18.6], [-6.4, 18.6], [-6.4, 24.4], [-10.6, 30.6], [-65, 30.6]] },
  { kind: 'land', pts: [[-65, 30.6], [-65, -25.8], [-56.8, -25.8], [-56.8, -51.8], [-45.8, -51.8], [-45.8, -75.8], [-7.8, -75.8], [-7.8, -50.8], [11.8, -50.8], [11.8, -38.8], [25.8, -38.8], [25.8, -26.8], [37.8, -26.8], [37.8, -12.8], [46.4, -12.8]] },
];

// ---- the streets: the walking graph. y in voxels at each point; 'stair' steps, the rest ramps.
const P = (id, i) => { const p = PLOTS[id], e = p.entries[i]; return [+(p.c[0] + e[0]).toFixed(2), +(p.c[1] + e[1]).toFixed(2), p.y]; };
export const STREETS = [
  { id: 'harbour-stair', w: 2.4, surface: 'stair', pts: [P('hub', 0), [3.6, 19.2, 46], [5.6, 20.6, 43], [15.6, 21.8, 9], [17.4, 22, 6]] },
  { id: 'quay', w: 3, surface: 'flag', pts: [[17.4, 22, 6], [8, 22.1, 6], [-3.6, 22.4, 6]] },
  { id: 'point-road', w: 2.6, surface: 'cobble', pts: [[17.4, 22, 6], [24, 21.4, 12], [31, 21.6, 20], [35.6, 24.4, 27], [37.4, 28.6, 30], P('contact', 0)] },
  { id: 'headland', w: 2.2, surface: 'stair', pts: [P('work', 1), [36.6, 17.8, 46], [40.6, 19.2, 40], [38.6, 22.4, 32], [35.6, 24.4, 27]] },
  { id: 'canal-lane', w: 3.2, surface: 'cobble', pts: [P('hub', 1), [-9.4, 10.9, 46], P('shipped', 0)] },
  { id: 'bridge-street', w: 2.8, surface: 'cobble', pts: [[-9.4, 10.9, 46], [-8.4, 15.6, 46], [-9, 20.4, 46], [-15.6, 22.4, 46], [-24, 22.4, 46], [-44, 22.4, 46], [-58, 22.6, 46]] },
  { id: 'west-lane', w: 2.8, surface: 'cobble', pts: [[-58, 22.6, 46], [-61.6, 14, 46], [-62.4, 4, 46], [-62.2, -12, 46]] },
  { id: 'west-stair', w: 2.6, surface: 'stair', pts: [[-62.2, -12, 46], [-62, -21.6, 68], [-58.4, -23.4, 68]] },
  { id: 'scholars-lane', w: 2.8, surface: 'cobble', pts: [[-58.4, -23.4, 68], [-53.4, -24, 68], [-52.8, -40, 68], [-46, -47.6, 68], [-35.7, -48, 68]] },
  { id: 'west-gate', w: 2.8, surface: 'cobble', pts: [[-62.4, 4, 46], [-66.6, 3.4, 46], [-69.8, 2.8, 50], [-72.6, 2.2, 53], [-75.6, 1.6, 53], [-79.6, 0.2, 50], [-84, -2.4, 44]] },
  { id: 'market-street', w: 3.4, surface: 'cobble', pts: [P('hub', 2), [3.2, -6, 46], P('more', 0)] },
  { id: 'east-street', w: 3.2, surface: 'cobble', pts: [P('hub', 3), [17.6, 7.4, 46], P('work', 0)] },
  { id: 'harbour-row', w: 2.6, surface: 'cobble', pts: [[17.6, 7.4, 46], [18.4, 14.2, 46]] },
  { id: 'guild-row', w: 3, surface: 'cobble', pts: [[3.2, -6, 46], [-8, -6.6, 46], [-15.6, -10.8, 46], [-17.4, -16, 46], [-17.2, -20, 46]] },
  { id: 'grand-stair', w: 3, surface: 'stair', pts: [[-17.2, -20, 46], [-14.6, -29, 68], [-13.6, -34, 68]] },
  { id: 'upper-street', w: 3.2, surface: 'cobble', pts: [P('education', 1), [-14.4, -31.6, 68], [-13.6, -34, 68], [-13.4, -41, 68], [-17, -47.6, 68], [-35.7, -48, 68], P('education', 0)] },
  { id: 'hill-stair', w: 2.6, surface: 'stair', pts: [[-17, -47.6, 68], [-12, -49, 68], [-11.2, -52.6, 81], [-13.8, -55.2, 94], P('research', 0)] },
  { id: 'east-road', w: 3.2, surface: 'cobble', pts: [[-13.4, -41, 68], [-2, -41.2, 68], [6, -40, 68], [8.4, -34.6, 68], [18.4, -20, 46], [19.4, -8, 46], [17.6, 7.4, 46]] },
];

// ---- zones outside the walls (and gardens inside): where flora, fields and orchards go
export const ZONES = [
  { kind: 'orchard', poly: [[-86, -40], [-72, -46], [-66, -34], [-84, -24]] },
  { kind: 'field', poly: [[-60, -84], [-40, -92], [-30, -86], [-50, -78]] },
  { kind: 'field', poly: [[-31, -85], [-12, -86], [-11, -77], [-30, -76]] },
  { kind: 'field', poly: [[-67, -73], [-53, -76], [-49, -63], [-63, -60]] },
  { kind: 'orchard', poly: [[-7, -67], [2, -67], [2, -53], [-7, -53]] },
  { kind: 'field', poly: [[-86, -14], [-72, -18], [-72, 8], [-84, 12]] },
  { kind: 'meadow', poly: [[42, -26], [48, -20], [46, -12], [40, -18]] },
  { kind: 'field', poly: [[28, -44], [38, -36], [34, -30], [26, -38]] },
  { kind: 'field', poly: [[4, -64], [16, -56], [12, -52], [0, -60]] },
  { kind: 'orchard', poly: [[-4, -80], [8, -70], [2, -64], [-6, -72]] },
  { kind: 'field', poly: [[-40, -88], [-24, -90], [-22, -84], [-38, -82]] },
  { kind: 'trees', poly: [[-80, 16], [-70, 20], [-72, 28], [-84, 24]] },
];

// ---- derived: towers along the walls, gates where streets pass them
function wallLen(pts) { let s = 0; for (let i = 1; i < pts.length; i += 1) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; }
function along(pts, s) {
  for (let i = 1; i < pts.length; i += 1) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az);
    if (s <= L) return [ax + ((bx - ax) * s) / L, az + ((bz - az) * s) / L, Math.atan2(bx - ax, bz - az)];
    s -= L;
  }
  const n = pts.length - 1; return [pts[n][0], pts[n][1], 0];
}
function segCross(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { t, u, p: [a[0] + r[0] * t, a[1] + r[1] * t] } : null;
}
export const GATES = [];
for (const [wi, w] of WALLS.entries()) for (let i = 1; i < w.pts.length; i += 1) {
  for (const s of STREETS) for (let k = 1; k < s.pts.length; k += 1) {
    const hit = segCross(w.pts[i - 1], w.pts[i], s.pts[k - 1], s.pts[k]);
    if (hit) GATES.push({ at: hit.p, wall: wi, street: s.id, w: s.w, dir: Math.atan2(w.pts[i][0] - w.pts[i - 1][0], w.pts[i][1] - w.pts[i - 1][1]), y: s.pts[k - 1][2] + (s.pts[k][2] - s.pts[k - 1][2]) * hit.u });
  }
  for (let k = 1; k < RIVER.length; k += 1) {
    const hit = segCross(w.pts[i - 1], w.pts[i], RIVER[k - 1], RIVER[k]);
    if (hit) GATES.push({ at: hit.p, wall: wi, river: true, w: RIVER[k][3], dir: Math.atan2(w.pts[i][0] - w.pts[i - 1][0], w.pts[i][1] - w.pts[i - 1][1]), y: RIVER[k][2] });
  }
}
export const TOWERS = [];
for (const w of WALLS) {
  const spots = [];
  w.pts.forEach((p, i) => { if (i > 0 || w.kind === 'land') spots.push(p); });
  for (let i = 1; i < w.pts.length; i += 1) { // long runs get towers between their corners
    const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / (w.kind === 'land' ? 21 : 26));
    for (let k = 1; k <= n; k += 1) spots.push([ax + ((bx - ax) * k) / (n + 1), az + ((bz - az) * k) / (n + 1)]);
  }
  for (const [x, z] of spots) {
    if (GATES.some((g) => Math.hypot(g.at[0] - x, g.at[1] - z) < g.w / 2 + 4)) continue; // a gate's own towers flank it
    if (TOWERS.some((t) => Math.hypot(t.at[0] - x, t.at[1] - z) < 5)) continue;
    TOWERS.push({ at: [+x.toFixed(2), +z.toFixed(2)], r: w.kind === 'land' ? 2.2 : 1.7, kind: w.kind, roof: hash(Math.round(x), Math.round(z), 7) < 0.55 ? 'cone' : 'crown' });
  }
}
for (const g of GATES) {
  if (g.river) continue;
  for (const s of [-1, 1]) {
    const off = g.w / 2 + 2.3;
    TOWERS.push({ at: [g.at[0] + Math.sin(g.dir) * off * s, g.at[1] + Math.cos(g.dir) * off * s], r: 1.5, kind: 'gate', roof: 'crown' });
  }
}

// Street lamps: every eight units or so along each street, on alternate sides, clear of gates and ends.
export const LAMPS = [];
for (const [si, s] of STREETS.entries()) {
  let run = 2.5, side = si % 2 ? 1 : -1;
  for (let g = 1; g < s.pts.length; g += 1) {
    const [ax, az, ay] = s.pts[g - 1], [bx, bz, by] = s.pts[g], L = Math.hypot(bx - ax, bz - az);
    for (; run < L; run += s.surface === 'stair' ? 6 : 8) {
      const t = run / L, x = ax + (bx - ax) * t, z = az + (bz - az) * t, nx = -(bz - az) / L, nz = (bx - ax) / L;
      const off = s.w / 2 - 0.2, p = [x + nx * off * side, z + nz * off * side];
      side = -side;
      if (GATES.some((q) => Math.hypot(q.at[0] - p[0], q.at[1] - p[1]) < q.w / 2 + 2.6)) continue;
      if (LAMPS.some((q) => Math.hypot(q.at[0] - p[0], q.at[1] - p[1]) < 4)) continue;
      LAMPS.push({ at: [+p[0].toFixed(2), +p[1].toFixed(2)], y: Math.round(ay + (by - ay) * t), arm: [-nx * -side, -nz * -side], street: s.id });
    }
    run -= L;
  }
}
// Which side of each wall is outside the town (+1: the left of its direction, -1: the right).
export const WALL_OUT = WALLS.map((w) => {
  const [ax, az] = w.pts[0], [bx, bz] = w.pts[1], L = Math.hypot(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
  return inPoly([mx - ((bz - az) / L) * 3, mz + ((bx - ax) / L) * 3], TOWN) ? -1 : 1;
});

// ---- the raster: every voxel column of the island ---------------------------------------------
export const KIND = { SEA: 0, ROCK: 1, BEACH: 2, LAND: 3, FIELD: 4, TOWN: 5, STREET: 6, STAIR: 7, PLOT: 8, RIVER: 9, WALL: 10, TOWER: 11, LOT: 12, GARDEN: 13, QUAY: 14, BRIDGE: 15, GATE: 16, ORCHARD: 17, MEADOW: 18 };
export const BOUNDS = { x0: -94, z0: -98, x1: 54, z1: 50 }; // units
const HILL = [-26, -62]; // the hill's crown

// Scanline fill of a polygon over the raster: calls put(index) for every column inside it.
function fillPoly(R, poly, put) {
  let z0 = Infinity, z1 = -Infinity;
  for (const [, z] of poly) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const k0 = Math.max(0, Math.floor(z0 / V - R.k0)), k1 = Math.min(R.nz - 1, Math.ceil(z1 / V - R.k0));
  const xs = [];
  for (let k = k0; k <= k1; k += 1) {
    const z = (k + R.k0 + 0.5) * V;
    xs.length = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
      const [xi, zi] = poly[i], [xj, zj] = poly[j];
      if ((zi > z) !== (zj > z)) xs.push(xi + ((z - zi) / (zj - zi)) * (xj - xi));
    }
    xs.sort((a, b) => a - b);
    for (let n = 0; n + 1 < xs.length; n += 2) {
      const i0 = Math.max(0, Math.ceil(xs[n] / V - 0.5 - R.i0)), i1 = Math.min(R.nx - 1, Math.floor(xs[n + 1] / V - 0.5 - R.i0));
      for (let i = i0; i <= i1; i += 1) put(k * R.nx + i, i, k);
    }
  }
}
// Every column within `reach` units of a polyline: put(index, i, k, nearest) with the nearest segment's
// distance, t, index and side.
function fillLine(R, pts, reach, put) {
  for (let s = 1; s < pts.length; s += 1) {
    const [ax, az] = pts[s - 1], [bx, bz] = pts[s];
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - reach) / V - R.i0)), i1 = Math.min(R.nx - 1, Math.ceil((Math.max(ax, bx) + reach) / V - R.i0));
    const k0 = Math.max(0, Math.floor((Math.min(az, bz) - reach) / V - R.k0)), k1 = Math.min(R.nz - 1, Math.ceil((Math.max(az, bz) + reach) / V - R.k0));
    for (let k = k0; k <= k1; k += 1) for (let i = i0; i <= i1; i += 1) {
      const q = toSeg((i + R.i0 + 0.5) * V, (k + R.k0 + 0.5) * V, ax, az, bx, bz);
      if (q.d <= reach) put(k * R.nx + i, i, k, q, s);
    }
  }
}
// Exact Euclidean distance transform (in columns) to the nearest column where `seed` is true.
export function distanceTo(R, seed) {
  const { nx, nz } = R, INF = 1e12, f = new Float64Array(Math.max(nx, nz)), d = new Float64Array(Math.max(nx, nz));
  const v = new Int32Array(Math.max(nx, nz)), zz = new Float64Array(Math.max(nx, nz) + 1), out = new Float32Array(nx * nz);
  const pass = (n, get, set) => {
    for (let q = 0; q < n; q += 1) f[q] = get(q);
    let k = 0; v[0] = 0; zz[0] = -INF; zz[1] = INF;
    for (let q = 1; q < n; q += 1) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= zz[k]) { k -= 1; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k += 1; v[k] = q; zz[k] = s; zz[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q += 1) { while (zz[k + 1] < q) k += 1; d[q] = (q - v[k]) ** 2 + f[v[k]]; set(q, d[q]); }
  };
  for (let i = 0; i < nx; i += 1) pass(nz, (k) => (seed(k * nx + i) ? 0 : INF), (k, x) => { out[k * nx + i] = x; });
  for (let k = 0; k < nz; k += 1) pass(nx, (i) => out[k * nx + i], (i, x) => { out[k * nx + i] = Math.sqrt(x); });
  return out;
}

let cached = null;
export function raster() {
  if (cached) return cached;
  const R = { i0: Math.round(BOUNDS.x0 / V), k0: Math.round(BOUNDS.z0 / V) };
  R.nx = Math.round(BOUNDS.x1 / V) - R.i0; R.nz = Math.round(BOUNDS.z1 / V) - R.k0;
  const N = R.nx * R.nz;
  R.top = new Int16Array(N).fill(-2); // the sea floor, just under the water
  R.kind = new Uint8Array(N); // KIND
  R.ref = new Int16Array(N).fill(-1); // the street, plot, lot or zone a column belongs to
  R.seg = new Int16Array(N); // the street's segment
  R.water = new Int16Array(N).fill(-99); // water surface for river columns
  R.town = new Uint8Array(N); // 1 inside the walls
  R.deck = new Int16Array(N).fill(-99); // a bridge's deck, a gate's passage floor
  R.base = new Int16Array(N); // the ground a wall or tower stands on
  R.gate = new Uint8Array(N); // 1 + the wall a column lies under (walls, gates, water gates)
  const X = (i) => (i + R.i0 + 0.5) * V, Z = (k) => (k + R.k0 + 0.5) * V;
  // land and its natural height: rising from the shore, up to the hill's crown, in field terraces
  const land = new Uint8Array(N);
  fillPoly(R, COAST, (n) => { land[n] = 1; });
  const shore = distanceTo(R, (n) => !land[n]); // columns to the sea
  R.shore = shore;
  for (let k = 0; k < R.nz; k += 1) for (let i = 0; i < R.nx; i += 1) {
    const n = k * R.nx + i;
    if (!land[n]) continue;
    const x = X(i), z = Z(k), d = shore[n] * V, r = Math.hypot(x - HILL[0], z - HILL[1]);
    const rise = Math.min(d < 1.6 ? 3 + d * 6 : 12 + (d - 1.6) * 3.4, LEVEL.top - 6 - r * 0.45 + 8 * (noise(x, z, 14, 3) - 0.5)); // a rocky shore, then broad field terraces up the hill
    const h = d < 1.6 ? Math.min(Math.round(rise), d < 0.7 ? 4 : 9) : Math.max(12, Math.round((rise - 12) / 12) * 12 + 12); // two rocky ledges at the shore
    R.top[n] = h;
    R.kind[n] = d < 1.4 && h < 10 ? (noise(x, z, 9, 5) > 0.55 ? KIND.BEACH : KIND.ROCK) : KIND.LAND;
  }
  fillPoly(R, QUAY, (n) => { if (land[n]) { R.top[n] = LEVEL.quay; R.kind[n] = KIND.QUAY; } });
  // the walled town and its terraces
  fillPoly(R, TOWN, (n) => { if (land[n]) { R.top[n] = LEVEL.low; R.kind[n] = KIND.TOWN; R.town[n] = 1; } });
  fillPoly(R, UPPER, (n) => { if (R.town[n]) R.top[n] = LEVEL.mid; });
  fillPoly(R, HILLTOP, (n) => { if (R.town[n]) R.top[n] = LEVEL.top; });
  // zones outside the walls: fields, orchards, meadows, woods
  ZONES.forEach((zn, zi) => fillPoly(R, chaikin(zn.poly, 2), (n) => {
    if (R.kind[n] !== KIND.LAND) return;
    R.kind[n] = zn.kind === 'field' ? KIND.FIELD : zn.kind === 'orchard' ? KIND.ORCHARD : zn.kind === 'meadow' ? KIND.MEADOW : KIND.GARDEN;
    R.ref[n] = zi;
  }));
  // the plots: flat at their level
  Object.values(PLOTS).forEach((p, pi) => {
    const e = edgeOf(p.A, p.B, p.seed), [cx, cz] = p.c, [ox, oz] = p.o;
    const i0 = Math.max(0, Math.floor((cx - p.A * V * 1.15) / V - R.i0)), i1 = Math.min(R.nx - 1, Math.ceil((cx + p.A * V * 1.15) / V - R.i0));
    const k0 = Math.max(0, Math.floor((cz - p.B * V * 1.15) / V - R.k0)), k1 = Math.min(R.nz - 1, Math.ceil((cz + p.B * V * 1.15) / V - R.k0));
    for (let k = k0; k <= k1; k += 1) for (let i = i0; i <= i1; i += 1) {
      const n = k * R.nx + i;
      if (e(i + R.i0 - ox + 0.5, k + R.k0 - oz + 0.5) > 1) continue;
      R.top[n] = p.y; R.kind[n] = KIND.PLOT; R.ref[n] = pi;
    }
  });
  // the river: a channel under its water; natural banks outside the walls, canal walls inside
  fillLine(R, RIVER.map((p) => [p[0], p[1]]), 3, (n, i, k, q, s) => {
    if (!land[n]) return;
    const a = RIVER[s - 1], b = RIVER[s], w = a[3] + (b[3] - a[3]) * q.t, lvl = q.t < 0.5 || a[2] === b[2] ? a[2] : b[2];
    const level = s === RIVER.length - 1 ? b[2] : lvl;
    if (q.d <= w / 2) {
      if (R.kind[n] === KIND.RIVER && R.water[n] >= level) return;
      R.top[n] = Math.min(R.top[n], level - 4); R.kind[n] = KIND.RIVER; R.water[n] = level; R.ref[n] = s;
    } else if (!R.town[n] && R.kind[n] !== KIND.RIVER && R.kind[n] !== KIND.PLOT) {
      // its banks: a flat strip of meadow either side, the land's own terraces beyond
      if (q.d < w / 2 + 0.9) { R.top[n] = level + 3; if (R.kind[n] !== KIND.BEACH) R.kind[n] = KIND.MEADOW; } // a flat bank either side
    }
  });
  // the walls, then the streets (over the river they are bridges, through a wall a gate)
  WALLS.forEach((w, wi) => fillLine(R, w.pts, (WALL.thick * V) / 2, (n, i, k, q, g) => {
    if (!land[n] || R.kind[n] === KIND.PLOT) return;
    R.gate[n] = wi + 1; // the wall over it: a water gate's arch over the river, a gate's over a street
    if (R.kind[n] === KIND.RIVER) return;
    R.kind[n] = KIND.WALL; R.ref[n] = wi; R.seg[n] = g; R.base[n] = R.top[n];
  }));
  for (const [ti, t] of TOWERS.entries()) {
    const r = Math.round(t.r / V), cx = Math.round(t.at[0] / V) - R.i0, cz = Math.round(t.at[1] / V) - R.k0;
    for (let k = cz - r; k < cz + r; k += 1) for (let i = cx - r; i < cx + r; i += 1) {
      const n = k * R.nx + i;
      if (i < 0 || k < 0 || i >= R.nx || k >= R.nz || !land[n] || R.kind[n] === KIND.PLOT || R.kind[n] === KIND.RIVER) continue;
      if (R.kind[n] !== KIND.WALL) R.base[n] = R.top[n];
      R.kind[n] = KIND.TOWER; R.ref[n] = ti;
    }
  }
  STREETS.forEach((s, si) => fillLine(R, s.pts, s.w / 2, (n, i, k, q, g) => {
    if (R.kind[n] === KIND.PLOT) return;
    const a = s.pts[g - 1], b = s.pts[g], y = a[2] + (b[2] - a[2]) * q.t;
    const was = R.kind[n];
    if ((was === KIND.STREET || was === KIND.STAIR || was === KIND.BRIDGE || was === KIND.GATE) && R.ref[n] !== si) return; // the first street keeps a crossing
    if (was === KIND.RIVER || was === KIND.BRIDGE) { R.kind[n] = KIND.BRIDGE; R.deck[n] = Math.round(y); }
    else if ((was === KIND.WALL || was === KIND.TOWER || was === KIND.GATE) && R.gate[n]) { R.kind[n] = KIND.GATE; R.top[n] = Math.round(y); }
    else { R.kind[n] = s.surface === 'stair' ? KIND.STAIR : KIND.STREET; R.top[n] = Math.round(y); }
    R.ref[n] = si; R.seg[n] = g;
  }));
  // walls and towers stand on the town's ground and rise over it
  for (let n = 0; n < N; n += 1) {
    if (R.kind[n] === KIND.WALL) R.top[n] = R.base[n] + (WALLS[R.ref[n]].kind === 'land' ? WALL.land : WALL.sea);
    else if (R.kind[n] === KIND.TOWER) R.top[n] = R.base[n] + towerHeight(TOWERS[R.ref[n]]);
    else if (R.kind[n] === KIND.GATE) R.deck[n] = R.base[n] + WALL.gate; // the gatehouse over the passage
  }
  R.lots = placeLots(R);
  cached = R;
  return R;
}

export const towerHeight = (t) => (t.kind === 'land' ? WALL.land + 14 : t.kind === 'gate' ? WALL.gate + 5 : WALL.sea + 16);

// What the ground is at a point (a KIND), and its surface height in units (the water's over the sea and the river,
// a bridge's deck): for placing anything on the town.
export function kindAt(x, z) { const R = raster(), i = Math.floor(x / V) - R.i0, k = Math.floor(z / V) - R.k0; return i < 0 || k < 0 || i >= R.nx || k >= R.nz ? KIND.SEA : R.kind[k * R.nx + i]; }
export function heightAt(x, z) {
  const R = raster(), i = Math.floor(x / V) - R.i0, k = Math.floor(z / V) - R.k0;
  if (i < 0 || k < 0 || i >= R.nx || k >= R.nz) return 0;
  const n = k * R.nx + i, kind = R.kind[n];
  return (kind === KIND.SEA ? 0 : kind === KIND.RIVER ? R.water[n] : kind === KIND.BRIDGE ? R.deck[n] : R.top[n]) * V;
}

// ---- lots: building plots for the town's houses, facing their streets, clear of everything else ---------
// A lot's footprint comes from a short menu (voxels, w along its street x d deep, eaves and jetties included),
// so a few house designs stamped many times fill the town. Each lot is { c, w, d, face, y, street, zone, storeys,
// size: [w, d] in voxels, row, kind }: row 1 fronts its street or square, 2 and 3 stand in the yards behind;
// kind is 'house', 'pier' (a harbour building on piles over the water, its floor at the quay), or out in the
// country 'farm', 'barn', 'windmill' or 'watermill' (its wheel turns in the river on its `water` side: +1 its
// own +x, -1 its -x).
export const LOT_SIZES = [[20, 26], [24, 30], [28, 32], [32, 34], [30, 22], [22, 20]]; // the last only fills in behind
export const PIER_SIZES = [[22, 32], [26, 34], [30, 36]];
// [kind, size (voxels), near [x, z], facing [x, z]]: farmsteads by the fields, a windmill on the east meadow facing the camera,
// a watermill on the river by the west gate's bridge. The country's terraces are narrow, so these are shallow.
const COUNTRY = [
  ['watermill', [26, 20], [-77, -7], [-77, 4]],
  ['farm', [30, 20], [-82, -8], [-84, -2.4]], ['barn', [34, 20], [-82, 6], [-84, -2.4]],
  ['farm', [30, 20], [22, -47], [30, -38]], ['barn', [34, 20], [18, -54], [30, -38]],
  ['windmill', [22, 22], [43, -21], [60, 5]],
];
const isTown = (k) => k === KIND.TOWN;
const isLand = (k) => k === KIND.LAND || k === KIND.FIELD || k === KIND.MEADOW || k === KIND.ORCHARD || k === KIND.GARDEN;
const isWet = (k) => k === KIND.SEA || k === KIND.ROCK || k === KIND.BEACH || k === KIND.QUAY;
const zoneAt = (x, z, y) => (y >= LEVEL.mid ? 'upper' : z > 13 && x > -12 ? 'harbour' : 'lower');
// Storeys by style and size (one house design each): the narrow go up, the shallow stay low, the upper town stands tall.
const STOREYS = { lower: { 20: 2, 22: 1, 24: 3, 28: 2, 32: 2, 30: 1 }, upper: { 20: 3, 22: 2, 24: 3, 28: 2, 32: 3, 30: 2 }, harbour: { 20: 3, 22: 1, 24: 2, 28: 2, 32: 2, 30: 1 } };

function placeLots(R) {
  const lots = [];
  const at = (x, z) => { const i = Math.floor(x / V) - R.i0, k = Math.floor(z / V) - R.k0; return i < 0 || k < 0 || i >= R.nx || k >= R.nz ? -1 : k * R.nx + i; };
  // The level of the ground under a footprint (w x d units at cx, cz, turned face) when every column under it and
  // a margin round it is an `ok` kind on one level (any level when `flat` is false); null otherwise.
  // With a `step`, the ground may fall that far across it (the house stands at its highest, on a plinth): probe.drop.
  function probe(cx, cz, face, w, d, ok = isTown, margin = 0.15, flat = true, step = 0) {
    const c = Math.cos(face), s = Math.sin(face), A = w / 2 + margin, B = d / 2 + margin;
    let lo = Infinity, hi = -Infinity;
    const col = (a, b) => {
      const n = at(cx + a * c + b * s, cz - a * s + b * c);
      if (n < 0 || !ok(R.kind[n])) return false;
      if (flat) { const t = R.top[n]; if (t < lo) lo = t; if (t > hi) hi = t; if (hi - lo > step) return false; }
      return true;
    };
    for (const [a, b] of [[0, 0], [-A, -B], [A, -B], [-A, B], [A, B], [0, -B], [0, B], [-A, 0], [A, 0]]) if (!col(a, b)) return null; // corners first: most misses end here
    for (let a = -A; a <= A + 1e-6; a += V) for (let b = -B; b <= B + 1e-6; b += V) if (!col(a, b)) return null;
    probe.drop = flat ? hi - lo : 0;
    return flat ? hi : 0;
  }
  const free = (l) => lots.every((o) => Math.hypot(o.c[0] - l.c[0], o.c[1] - l.c[1]) > (Math.hypot(o.w, o.d) + Math.hypot(l.w, l.d)) / 2 || !overlap(o, l));
  const make = (cx, cz, face, size, y, street, row, kind = 'house', zone = zoneAt(cx, cz, y)) => ({
    c: [+cx.toFixed(2), +cz.toFixed(2)], w: +(size[0] * V).toFixed(2), d: +(size[1] * V).toFixed(2), face: +face.toFixed(3), y, street, zone,
    storeys: STOREYS[zone]?.[size[0]] ?? 2, size, row, kind,
  });
  // Between a district's plot and the camera (it looks from the south-east, yaw 0.45) houses stay low, so they frame its
  // landmarks instead of hiding them: one storey in the lower town, two in the upper.
  const LOOK = [Math.sin(0.45), Math.cos(0.45)];
  const shades = (x, z) => Object.values(PLOTS).some((p) => {
    const dx = x - p.c[0], dz = z - p.c[1], d = Math.hypot(dx, dz), e = edgeOf(p.A, p.B, p.seed)(dx / V, dz / V);
    return (dx * LOOK[0] + dz * LOOK[1]) / d > 0.35 && d - d / e < 7;
  });
  const low = (l) => l.storeys <= (l.zone === 'upper' ? 2 : 1) || !shades(l.c[0], l.c[1]);
  // Try the sizes in turn (the hashed pick first, then the rest, biggest first) at the spot where(size) gives; keep the first that fits.
  function tryAt(pick, where, { ok = isTown, street = null, row = 1, sizes = LOT_SIZES, margin = 0.15, flat = true } = {}) {
    const order = [pick, ...sizes.map((_, i) => i).filter((i) => i !== pick).sort((a, b) => sizes[b][0] * sizes[b][1] - sizes[a][0] * sizes[a][1])];
    for (const i of order) {
      const spot = where(sizes[i]);
      if (!spot) continue;
      const [cx, cz, face] = spot, y = probe(cx, cz, face, sizes[i][0] * V, sizes[i][1] * V, ok, margin, flat);
      if (y === null) continue;
      const l = make(cx, cz, face, sizes[i], y, street, row);
      if (free(l) && (ok !== isTown || low(l))) { lots.push(l); return l; }
    }
    return null;
  }
  const n5 = (a, b, c) => Math.floor(hash(a, b, c) * 5);
  const FRONT = LOT_SIZES.slice(0, 5);

  // 1. round the two squares (Gate Square and the Market), their fronts to the square
  for (const id of ['hub', 'more']) {
    const p = PLOTS[id], e = edgeOf(p.A, p.B, p.seed);
    let th = 0.05;
    while (th < Math.PI * 2 - 0.05) {
      const dx = Math.cos(th), dz = Math.sin(th);
      let r = 0;
      while (r < 40 && e((dx * r) / V, (dz * r) / V) < 1) r += 0.1;
      const face = Math.atan2(-dx, -dz);
      const l = tryAt(n5(Math.round(th * 100), 7, 3), ([, dv]) => [p.c[0] + dx * (r + 0.55 + (dv * V) / 2), p.c[1] + dz * (r + 0.55 + (dv * V) / 2), face], { street: id, sizes: FRONT });
      th += l ? (l.w + 0.1) / (r + 0.55) : 0.3 / r;
    }
  }
  // 2. along the streets and stairs, in terraced rows with an alley now and then
  STREETS.forEach((s, si) => {
    if (s.id === 'quay') return;
    for (let g = 1; g < s.pts.length; g += 1) {
      const [ax, az] = s.pts[g - 1], [bx, bz] = s.pts[g], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
      for (const side of [-1, 1]) {
        const nx = -uz * side, nz = ux * side, face = Math.atan2(-nx, -nz), off = s.w / 2 + 0.35;
        let u = 0.3, run = 0;
        while (u < L - 0.3) {
          const l = tryAt(n5(si * 31 + g, Math.round(u * 10), side + 5), ([wv, dv]) => (u + wv * V > L - 0.1 ? null : [ax + ux * (u + (wv * V) / 2) + nx * (off + (dv * V) / 2), az + uz * (u + (wv * V) / 2) + nz * (off + (dv * V) / 2), face]), { street: s.id, sizes: FRONT });
          if (l) { run += 1; u += l.w + (run % 4 === 0 && hash(si, g, run) < 0.6 ? 0.9 : 0.08); } else u += 0.3;
        }
      }
    }
  });
  // 3. the yards behind: a second and third row where the ground runs on, a small yard between
  for (const f of lots.filter((l) => l.row === 1)) {
    let back = f;
    for (let row = 2; row <= 3 && back; row += 1) {
      const b = back, fx = Math.sin(b.face), fz = Math.cos(b.face), yard = 0.9 + hash(Math.round(b.c[0] * 10), row, 11) * 0.8;
      back = tryAt(n5(Math.round(b.c[0] * 10), Math.round(b.c[1] * 10), row), ([, dv]) => { const dd = b.d / 2 + yard + (dv * V) / 2; return [b.c[0] - fx * dd, b.c[1] - fz * dd, b.face]; }, { street: b.street, row });
    }
  }
  // 4. what is left of the town's open ground (the citadel on the hilltop kept open): a house wherever one fits,
  // turned to the nearest street
  for (let z = -76; z <= 32; z += 0.6) for (let x = -66; x <= 48; x += 0.6) {
    const n = at(x, z);
    if (n < 0 || R.kind[n] !== KIND.TOWN || inPoly([x, z], HILLTOP) || lots.some((l) => Math.abs(l.c[0] - x) < 2.2 && Math.abs(l.c[1] - z) < 2.2)) continue;
    let best = null;
    for (const s of STREETS) for (let g = 1; g < s.pts.length; g += 1) { const q = toSeg(x, z, s.pts[g - 1][0], s.pts[g - 1][1], s.pts[g][0], s.pts[g][1]); if (!best || q.d < best.d) best = { ...q, s }; }
    const face = Math.atan2(best.x - x, best.z - z);
    tryAt(n5(Math.round(x * 10), Math.round(z * 10), 9), () => [x, z, face], { street: best.s.id, row: 2 });
  }
  // 5. the harbour: boathouses, net lofts and warehouses on piles along the quay's sea side, room for boats between
  {
    const s = STREETS.find((q) => q.id === 'quay'); // near enough straight: one run from end to end
    {
      const [ax, az] = s.pts[0], [bx, bz] = s.pts[s.pts.length - 1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
      const side = ux > 0 ? 1 : -1, nx = -uz * side, nz = ux * side, face = Math.atan2(-nx, -nz), off = s.w / 2 + 0.3; // the sea side (+z)
      let u = 0.6;
      while (u < L - 0.6) {
        const l = tryAt(Math.floor(hash(7, Math.round(u * 10), 41) * 3), ([wv, dv]) => (u + wv * V > L ? null : [ax + ux * (u + (wv * V) / 2) + nx * (off + (dv * V) / 2), az + uz * (u + (wv * V) / 2) + nz * (off + (dv * V) / 2), face]), { ok: isWet, street: 'quay', sizes: PIER_SIZES, margin: 0.1, flat: false });
        if (l) { Object.assign(l, { kind: 'pier', zone: 'harbour', y: LEVEL.quay, storeys: l.size[0] === 22 ? 3 : l.size[0] === 26 ? 1 : 2 }); u += l.w + 0.9; } else u += 0.3;
      }
    }
  }
  // 6. out in the country: turned every way near its spot until it sits on one terrace, clear of the river
  // (the watermill beside it)
  const riverD = (x, z) => RIVER.slice(1).reduce((m, q, i) => Math.min(m, toSeg(x, z, RIVER[i][0], RIVER[i][1], q[0], q[1]).d), Infinity);
  for (const [kind, size, [hx, hz], [fx, fz]] of COUNTRY) {
    let done = null;
    for (let r = 0; r <= 7 && !done; r += 0.5) for (let a = 0; a < Math.PI * 2 && !done; a += r ? 0.5 / r : 7) for (let turn = 0; turn < 8 && !done; turn += 1) {
      const cx = hx + Math.cos(a) * r, cz = hz + Math.sin(a) * r, face = Math.atan2(fx - cx, fz - cz) + [0, 0.3, -0.3, 0.6, -0.6, 1.57, -1.57, 3.14][turn];
      const y = probe(cx, cz, face, size[0] * V, size[1] * V, isLand, 0.25, true, 12);
      if (y === null) continue;
      const drop = probe.drop, hw = (size[0] * V) / 2, sideD = [1, -1].map((k) => riverD(cx + Math.cos(face) * hw * k, cz - Math.sin(face) * hw * k));
      if (kind === 'watermill' ? Math.min(...sideD) > 1.9 : riverD(cx, cz) < 4.6) continue;
      const l = make(cx, cz, face, size, y, null, 1, kind, 'lower');
      if (!free(l)) continue;
      Object.assign(l, { storeys: kind === 'windmill' ? 3 : kind === 'barn' ? 1 : 2, drop });
      if (kind === 'watermill') l.water = sideD[0] < sideD[1] ? 1 : -1;
      lots.push(l); done = l;
    }
  }
  // paint them: town and country ground under a house becomes LOT (the water under a pier stays water)
  lots.forEach((l, li) => {
    if (l.kind === 'pier') return;
    const c = Math.cos(l.face), s = Math.sin(l.face);
    for (let a = -l.w / 2; a <= l.w / 2; a += V * 0.5) for (let b = -l.d / 2; b <= l.d / 2; b += V * 0.5) {
      const n = at(l.c[0] + a * c + b * s, l.c[1] - a * s + b * c);
      if (n >= 0 && (R.kind[n] === KIND.TOWN || isLand(R.kind[n]))) { R.kind[n] = KIND.LOT; R.ref[n] = li; }
    }
  });
  return lots;
}
// Do two turned rectangles overlap? (separating axes; touching is not overlapping)
function overlap(a, b) {
  const axes = [a.face, a.face + Math.PI / 2, b.face, b.face + Math.PI / 2];
  const corners = (r) => { const c = Math.cos(r.face), s = Math.sin(r.face); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([p, q]) => [r.c[0] + (p * r.w / 2) * c + (q * r.d / 2) * s, r.c[1] - (p * r.w / 2) * s + (q * r.d / 2) * c]); };
  const A = corners(a), B = corners(b);
  for (const t of axes) {
    const ax = [Math.cos(t), -Math.sin(t)];
    const pa = A.map(([x, z]) => x * ax[0] + z * ax[1]), pb = B.map(([x, z]) => x * ax[0] + z * ax[1]);
    if (Math.max(...pa) < Math.min(...pb) + 0.02 || Math.max(...pb) < Math.min(...pa) + 0.02) return false;
  }
  return true;
}

// The walking graph's nodes and links (street points joined where streets meet; plots joined through their entries).
export function streetGraph() {
  const nodes = [], links = [];
  const at = (x, z) => { let k = nodes.findIndex(([a, b]) => Math.hypot(a - x, b - z) < 0.05); if (k < 0) { k = nodes.length; nodes.push([x, z]); links.push(new Set()); } return k; };
  for (const s of STREETS) for (let i = 1; i < s.pts.length; i += 1) { const a = at(s.pts[i - 1][0], s.pts[i - 1][1]), b = at(s.pts[i][0], s.pts[i][1]); links[a].add(b); links[b].add(a); }
  for (const p of Object.values(PLOTS)) {
    const ids = p.entries.map(([ex, ez]) => nodes.findIndex(([a, b]) => Math.hypot(a - p.c[0] - ex, b - p.c[1] - ez) < 0.05));
    for (const a of ids) for (const b of ids) if (a >= 0 && b >= 0 && a !== b) { links[a].add(b); links[b].add(a); }
  }
  return { nodes, links };
}

// A self-check: node js/town/plan.js
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now();
  const R = raster();
  const bad = [];
  const assert = (c, m) => { if (!c) bad.push(m); };
  const inPlot = (p, x, z) => edgeOf(p.A, p.B, p.seed)(x / V - p.o[0], z / V - p.o[1]) < 1;
  const walkIn = (p, x, z) => edgeOf(p.A, p.B, p.seed)(x / V - p.o[0], z / V - p.o[1]) < 1 - 1 / (Math.min(p.A, p.B) * V);
  const ids = Object.keys(PLOTS);
  // plots never overlap: no point of one plot's footprint is inside another's
  for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) {
    const a = PLOTS[ids[i]], b = PLOTS[ids[j]];
    let hit = 0;
    for (let u = -1; u <= 1; u += 0.04) for (let w = -1; w <= 1; w += 0.04) { const x = a.c[0] + u * a.A * V * 1.1, z = a.c[1] + w * a.B * V * 1.1; if (inPlot(a, x, z) && inPlot(b, x, z)) hit += 1; }
    assert(!hit, `plots ${ids[i]} and ${ids[j]} overlap`);
  }
  // every entry sits on the street graph, inside its plot's walkable ground, at the plot's level
  const { nodes, links } = streetGraph();
  for (const [id, p] of Object.entries(PLOTS)) for (const [ex, ez] of p.entries) {
    const x = p.c[0] + ex, z = p.c[1] + ez;
    const s = STREETS.find((st) => st.pts.some(([a, b]) => Math.hypot(a - x, b - z) < 0.05));
    assert(s, `${id}'s entry [${ex}, ${ez}] is not a street's point`);
    if (s) assert(s.pts.find(([a, b]) => Math.hypot(a - x, b - z) < 0.05)[2] === p.y, `${id}'s entry is not at its level (${p.y})`);
    assert(walkIn(p, x, z), `${id}'s entry [${ex}, ${ez}] is off its walkable ground`);
  }
  // streets keep out of plots, except where they come in at an entry
  for (const s of STREETS) for (let i = 1; i < s.pts.length; i += 1) {
    const [ax, az] = s.pts[i - 1], [bx, bz] = s.pts[i], L = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t <= L; t += 0.25) {
      const x = ax + ((bx - ax) * t) / L, z = az + ((bz - az) * t) / L;
      for (const [id, p] of Object.entries(PLOTS)) if (inPlot(p, x, z) && !p.entries.some(([ex, ez]) => Math.hypot(p.c[0] + ex - x, p.c[1] + ez - z) < s.w / 2 + 2.2)) { assert(false, `${s.id} runs through ${id} at [${x.toFixed(1)}, ${z.toFixed(1)}]`); break; }
    }
  }
  // lots stand clear of every street, plot and wall
  for (const [li, l] of R.lots.entries()) {
    const c = Math.cos(l.face), sn = Math.sin(l.face);
    for (let a = -l.w / 2; a <= l.w / 2; a += 0.3) for (let b = -l.d / 2; b <= l.d / 2; b += 0.3) {
      const x = l.c[0] + a * c + b * sn, z = l.c[1] - a * sn + b * c;
      for (const s of STREETS) for (let i = 1; i < s.pts.length; i += 1) if (toSeg(x, z, s.pts[i - 1][0], s.pts[i - 1][1], s.pts[i][0], s.pts[i][1]).d < s.w / 2) { assert(false, `lot ${li} blocks ${s.id}`); a = b = 1e9; }
    }
  }
  // every column under a lot is the lot's own (a pier's is water, rock or the quay's edge): never a street, stair,
  // gate, bridge, plot, wall, tower, the river or the canal; lots never overlap; sizes and storeys from the menus
  const under = { pier: new Set([KIND.SEA, KIND.ROCK, KIND.BEACH, KIND.QUAY]) };
  for (const [li, l] of R.lots.entries()) {
    const c = Math.cos(l.face), sn = Math.sin(l.face), ok = under[l.kind];
    for (let a = -l.w / 2 + 0.2; a < l.w / 2 - 0.2; a += V) for (let b = -l.d / 2 + 0.2; b < l.d / 2 - 0.2; b += V) { // (a party wall's columns may go to either neighbour)
      const n = (Math.floor((l.c[1] - a * sn + b * c) / V) - R.k0) * R.nx + Math.floor((l.c[0] + a * c + b * sn) / V) - R.i0, k = R.kind[n];
      if (ok ? !ok.has(k) : k !== KIND.LOT || R.ref[n] !== li) { assert(false, `lot ${li} (${l.kind} at ${l.c}) is over ${Object.keys(KIND).find((q) => KIND[q] === k)}`); a = b = 1e9; }
    }
    for (let j = li + 1; j < R.lots.length; j += 1) assert(!overlap(l, R.lots[j]), `lots ${li} and ${j} overlap`);
    assert((l.kind === 'pier' ? PIER_SIZES : l.kind === 'house' ? LOT_SIZES : [l.size]).some(([w, d]) => w === l.size[0] && d === l.size[1]) && l.storeys >= 1 && l.storeys <= 3, `lot ${li} has an odd size or height`);
  }
  assert(R.lots.length >= 80, `only ${R.lots.length} lots: the town reads empty`);
  for (const kind of ['pier', 'farm', 'barn', 'windmill', 'watermill']) assert(R.lots.some((l) => l.kind === kind), `no ${kind}`);
  for (const l of R.lots.filter((q) => q.kind === 'watermill')) { // its wheel's side is on the river
    const hw = l.w / 2 + 0.6, x = l.c[0] + Math.cos(l.face) * hw * l.water, z = l.c[1] - Math.sin(l.face) * hw * l.water;
    assert(RIVER.slice(1).some((q, i) => toSeg(x, z, RIVER[i][0], RIVER[i][1], q[0], q[1]).d < 1.6), 'the watermill\'s wheel is not in the river');
  }
  // the graph is connected: every street point and every plot can be reached from the gate
  const seen = new Set([nodes.findIndex(([a, b]) => Math.hypot(a - PLOTS.hub.c[0] - PLOTS.hub.entries[0][0], b - PLOTS.hub.c[1] - PLOTS.hub.entries[0][1]) < 0.05)]);
  for (const q = [...seen]; q.length;) for (const n of links[q.pop()]) if (!seen.has(n)) { seen.add(n); q.push(n); }
  assert(seen.size === nodes.length, `${nodes.length - seen.size} street points can't be reached from the gate`);
  for (const [id, p] of Object.entries(PLOTS)) assert(p.entries.some(([ex, ez]) => [...seen].some((n) => Math.hypot(nodes[n][0] - p.c[0] - ex, nodes[n][1] - p.c[1] - ez) < 0.05)), `${id} can't be reached`);
  // outside the walls the river runs below the land beside it, not on a dyke (a cascade may be level with the land above it)
  for (let g = 1; g < RIVER.length; g += 1) {
    const [ax, az, al, aw] = RIVER[g - 1], [bx, bz, bl] = RIVER[g], L = Math.hypot(bx - ax, bz - az);
    for (let t = 0.05; t < 0.95; t += 0.1) {
      if (Math.abs(t - 0.5) < 0.12) continue;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t, level = t < 0.5 || al === bl ? al : bl;
      for (const s of [-1, 1]) {
        const off = aw / 2 + 1.4, n = (Math.floor((z + ((bx - ax) / L) * off * s) / V) - R.k0) * R.nx + (Math.floor((x - ((bz - az) / L) * off * s) / V) - R.i0);
        if (!R.town[n] && R.kind[n] !== KIND.SEA && R.top[n] < level + 1) { assert(false, `the river runs above the land beside it at [${x.toFixed(1)}, ${z.toFixed(1)}]`); t = 1; break; }
      }
    }
  }
  // the story's order is a loop that visits every plot
  assert(ORDER.length === ids.length && ORDER.every((id) => PLOTS[id]), 'the story visits every plot once');
  console.log(`plan: ${ids.length} plots, ${STREETS.length} streets (${nodes.length} points), ${GATES.length} gates, ${TOWERS.length} towers, ${LAMPS.length} lamps, ${R.lots.length} lots, ${ZONES.length} zones; raster ${R.nx} x ${R.nz} in ${Date.now() - t0} ms`);
  if (bad.length) { console.log('plan check FAILED:\n  ' + bad.join('\n  ')); process.exit(1); }
  console.log('plan ok');
}
