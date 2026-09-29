// The town's houses (colours house_), every one from the same few parts, so a handful of designs stamped many
// times reads as one town:
//   lower town   timber-framed plaster over a stone plinth, jettied upper floors on carved joist ends, steep
//                tiled roofs (gable or eaves to the street), shutters, flower boxes, gutters and a rain barrel
//   upper town   coursed ashlar with quoins and string courses, an arched door with a fanlight up two steps,
//                tall windows in stone surrounds, a small iron balcony, slate roofs with dormers
//   harbour      on piles over the water: tarred boathouses, a tall net loft with a hoist, a warehouse with
//                stacked loading doors and a hoist beam, and the harbourmaster's office
//   country      a farmhouse and barn under thatch, a tower windmill, a watermill (its wheel is its own part)
//   shops        a lower-town house with a shop front and a hanging sign whose hologram says the trade
// Cyber threads through all of it: circuit light in the mortar, a neon rune over some doors, crystal lamps,
// a cable clipped up a wall, one brass dish on one roof.
//
//   design(spec) -> { b: the grid (model voxels: origin at the footprint's middle, y 0 on the lot, front +z),
//                     info: { door, chimneys, windows, sign, top, ... } }
//   spec: { kind: 'house' | 'pier' | 'farm' | 'barn' | 'windmill' | 'watermill', zone, size: [w, d], storeys,
//           seed, trade?, far?: a plain version for the far view (flat tones, no small things) }
// Every colour carries a flag for the town's house material (FLAG): 0 plain, 1 glowing, 2 wall paint, 3 roof,
// 4 trim paint (the last three tinted per house), 5 a lamp lit at night, 16 + n window n (lit or dark per house).
import { C, colour, hash, noise } from '../kit/voxel-kit.js';
import { box } from './space.js';

export const FLAG = new Map();
const P = {};
for (const [n, hex, flag = 0, glow = false] of [
  // stone: rubble and coursed stone below, ashlar above, mortar with circuit light in it
  ['s1', 0xb8b0a1], ['s2', 0xa39b8c], ['s3', 0x8e877a], ['s4', 0x777166], ['mortar', 0x4a453f], ['q1', 0xd6cdbb], ['q2', 0xc6bca8],
  ['a1', 0xd8d0c0], ['a2', 0xc8bfad], ['a3', 0xb7ad99], ['a4', 0xa39a87], ['am', 0x7a7266], ['sill', 0xe2dac9],
  ['rub1', 0x9a9284], ['rub2', 0x857e71], ['rub3', 0xaba395], ['rub4', 0x6f695e],
  // timber, plaster (flag 2: each house its own colour), trim (flag 4: shutters, doors, frames)
  ['t1', 0x3b2618], ['t2', 0x4d3220], ['t3', 0x5e3f28], ['tend', 0x80593a], ['tlight', 0x9a7450],
  ['p1', 0xf3eee4, 2], ['p2', 0xe3dac8, 2], ['p3', 0xcdbfa6, 2],
  ['k1', 0xeaeaea, 4], ['k2', 0xcdcdcd, 4], ['k3', 0xa9a9a9, 4],
  // roofs (flag 3: tile, slate or shingle by the house's tint), ridge, thatch
  ['r1', 0xe0e0e0, 3], ['r2', 0xd0d0d0, 3], ['r3', 0xb4b4b4, 3], ['ridge', 0x929292, 3],
  ['th1', 0xc9a55a], ['th2', 0xb08a44], ['th3', 0xdcbc72], ['th4', 0x8f6f38],
  // glass by day, the dark inside a doorway, iron, lead, copper
  ['void', 0x120f0d], ['glass', 0x2c3748], ['lead', 0x5d6470], ['copper', 0x4f9a86], ['copper2', 0x6fb5a0],
  // weather: moss, soot, damp, rust
  ['moss1', 0x566b36], ['moss2', 0x6f8440], ['soot', 0x33302d], ['rust', 0x8a4a2a],
  // flowers and leaves, clay pots
  ['fr', 0xd8434a], ['fy', 0xf2c84a], ['fw', 0xf3efe2], ['fv', 0x9a5bd6], ['fp', 0xef7fb0], ['lf1', 0x3b6a2a], ['lf2', 0x578a38], ['clay', 0xa4583a], ['clay2', 0x8a4630],
  // harbour: tarred boards, piles, weed, rope, nets, a life ring
  ['tar1', 0x2b2723], ['tar2', 0x37312b], ['tar3', 0x463d33], ['pile', 0x4a3a2a], ['pile2', 0x3a2d20], ['weed', 0x3c5634], ['barn', 0xd8d2c2],
  ['bd1', 0xb4aca2, 2], ['bd2', 0x9c958c, 2], ['bd3', 0x847e76, 2], ['bdj', 0x4a4540],
  ['rope', 0xc8b27a], ['net', 0x7d6f52], ['ringR', 0xd8322a], ['ringW', 0xf0ece0], ['boardR', 0x7a3226], ['boardR2', 0x8e3c2c],
  // shops: bread, flour, cloth, books, bottles
  ['bread', 0xc8843a], ['crust', 0x9a5a22], ['flour', 0xf0eadc], ['sack', 0xc9b48a], ['sack2', 0xb39c70],
  ['cl1', 0xb0304a], ['cl2', 0x2f5fa8], ['cl3', 0xe0b040], ['cl4', 0x3f8a5a], ['cl5', 0x8a4ab0], ['cl6', 0xe8e0d0],
  ['bk1', 0x7a2a2a], ['bk2', 0x2a3f6a], ['bk3', 0x2f5a3a], ['bk4', 0x6a4a22], ['page', 0xece2c8],
  ['aw1', 0xf2ece0], ['aw2', 0xc0392b], ['aw3', 0x2e6f8e], ['aw4', 0x3d7a4a], ['aw5', 0x7a3fa0], ['aw6', 0xd9822b],
  // light: circuit traces and vias, runes, neon, crystal, embers; lamps lit only at night (flag 5)
  ['trace', 0x1fd2ea, 1, true], ['via', 0xb6fbff, 1, true], ['rune', 0x9f86ff, 1, true], ['rune2', 0x6ff2ff, 1, true], ['neon', 0xff4fd8, 1, true],
  ['crys1', 0xe6fdff, 1, true], ['crys2', 0x6ff2ff, 1, true], ['crys3', 0xa98bff, 1, true],
  ['ember', 0xff7a2a, 1, true], ['coal', 0xff4a1a, 1, true], ['hot', 0xffd27a, 1, true],
  ['potG', 0x5dff9a, 1, true], ['potV', 0xc07bff, 1, true], ['potC', 0x6ff2ff, 1, true], ['potR', 0xff5a6a, 1, true],
  ['holo1', 0xe8fdff, 1, true], ['holo2', 0x5fe8ff, 1, true], ['holo3', 0x2aa8c8, 1, true],
  ['lamp', 0xffc764, 5], ['lamp2', 0xffe6a8, 5], ['lampC', 0x9ff4ff, 5], ['lampM', 0xff8ad8, 5], ['lampG', 0xa8ff9a, 5],
]) {
  const id = C[`house_${n}`] ?? colour(`house_${n}`, hex, glow);
  FLAG.set(id, flag);
  P[n] = id;
}
// Window glass: sixteen ids of one colour, so each window of a house can be lit or dark on its own at night.
export const WIN = Array.from({ length: 16 }, (_, k) => { const id = C[`house_win${k}`] ?? colour(`house_win${k}`, 0x2c3748); FLAG.set(id, 16 + k); return id; });
export const HP = P;
const pick = (arr, h) => arr[Math.min(arr.length - 1, Math.floor(h * arr.length))];

// ---- the builder's context: the grid, the spec, and helpers that respect the far (plain) version --------------------
function ctx(spec, bounds) {
  const b = box(...bounds);
  const S = { ...spec, b, far: Boolean(spec.far), seed: spec.seed | 0, win: 0, info: { chimneys: [], windows: 0 } };
  // a tone from a list by a hash of the voxel; the far version keeps the first
  S.tone = (list, x, y, z, k = 0) => (S.far ? list[0] : list[Math.floor(hash(x + k * 131 + S.seed * 7, y + k * 17, z + S.seed) * list.length)]);
  S.h = (a, b2 = 0, c = 0) => hash(a + S.seed * 977, b2 + 31, c + 7);
  S.nextWin = () => WIN[S.win++ % 16];
  return S;
}

// A facade of the wall box x0..x1, z0..z1: `len` voxels along it, at(u, d) -> [x, z] with u left to right as seen
// from outside and d the depth into the wall (negative: proud of it).
const FACES = {
  front: (r) => ({ name: 'front', len: r.x1 - r.x0 + 1, at: (u, d) => [r.x0 + u, r.z1 - d], out: [0, 1] }),
  back: (r) => ({ name: 'back', len: r.x1 - r.x0 + 1, at: (u, d) => [r.x1 - u, r.z0 + d], out: [0, -1] }),
  right: (r) => ({ name: 'right', len: r.z1 - r.z0 + 1, at: (u, d) => [r.x1 - d, r.z1 - u], out: [1, 0] }),
  left: (r) => ({ name: 'left', len: r.z1 - r.z0 + 1, at: (u, d) => [r.x0 + d, r.z0 + u], out: [-1, 0] }),
};
const faceOf = (r, name) => FACES[name](r);
const put = (S, f, u, y, d, id) => { const [x, z] = f.at(u, d); S.b.put(x, y, z, id); };
const cut = (S, f, u, y, d) => { const [x, z] = f.at(u, d); S.b.cut(x, y, z); };

// A solid storey: its four faces painted by paint(u, v, face) (v up from y0), the inside filled dark so it meshes nothing.
function storey(S, r, y0, h, paint) {
  S.b.fill(r.x0 + 1, y0, r.z0 + 1, r.x1 - 1, y0 + h - 1, r.z1 - 1, P.void);
  for (const name of ['left', 'right', 'back', 'front']) {
    const f = faceOf(r, name);
    for (let v = 0; v < h; v += 1) for (let u = 0; u < f.len; u += 1) { const id = paint(u, v, f); if (id) put(S, f, u, y0 + v, 0, id); }
  }
}

// ---- wall surfaces -------------------------------------------------------------------------------------------------------
// Coursed stone: courses of three over mortar, stones of four to seven, a few joints lit with circuit light.
function stoneWall(S, lit = 0.12, tones = [P.s1, P.s2, P.s2, P.s3, P.s4]) {
  return (u, v, f) => {
    if (S.far) return tones[1];
    const c = Math.floor(v / 3), fk = f.name.length;
    if (v % 3 === 2) return !S.far && hash(Math.floor(u / 5), c, fk + S.seed) < lit ? (hash(u, c, 3) < 0.15 ? P.via : P.trace) : P.mortar;
    const w = 4 + Math.floor(hash(c, fk, S.seed) * 3), seg = Math.floor((u + c * 3 + (c % 2) * 2) / w);
    if ((u + c * 3 + (c % 2) * 2) % w === 0) return P.mortar;
    if (v < 3 && noise(u + fk * 30, v * 2, 3, S.seed) > 0.7) return hash(u, v, fk) < 0.5 ? P.moss1 : P.moss2;
    return S.tone(tones, seg, c, fk, 1);
  };
}
// Ashlar: long stones in courses of four, fine joints, quoins at the corners.
function ashlarWall(S, lit = 0.1) {
  const T = [P.a1, P.a2, P.a2, P.a3, P.a4];
  return (u, v, f) => {
    const c = Math.floor(v / 4), fk = f.name.length, corner = Math.min(u, f.len - 1 - u);
    if (S.far) return corner < 3 ? P.q1 : P.a2;
    if (corner < (c % 2 ? 3 : 5) && corner <= 5) return v % 4 === 3 ? P.am : c % 2 ? P.q1 : P.q2;
    if (v % 4 === 3) return !S.far && hash(Math.floor(u / 7), c, fk + S.seed * 3) < lit ? P.trace : P.am;
    const w = 7 + Math.floor(hash(c, fk, S.seed + 5) * 3), off = (c % 2) * 4;
    if ((u + off) % w === 0) return P.am;
    return S.tone(T, Math.floor((u + off) / w), c, fk, 2);
  };
}
// Rubble: irregular stones in rough courses, lots of mortar.
function rubbleWall(S) {
  const T = [P.rub1, P.rub1, P.rub2, P.rub3, P.rub4];
  return (u, v, f) => {
    if (S.far) return T[0];
    const fk = f.name.length, c = Math.floor((v + Math.floor(hash(Math.floor(u / 3), fk, 5) * 2)) / 2), seg = Math.floor((u + c * 2) / 3);
    if ((u + c * 2) % 3 === 0 && hash(seg, c, fk) < 0.55) return P.mortar;
    if (v < 3 && noise(u + fk * 30, v * 2, 3, S.seed + 4) > 0.68) return P.moss1;
    return S.tone(T, seg, c, fk, 3);
  };
}
// Timber framing: corner posts, studs flanking the bays, sill beam, mid rail and wall plate, braces in the end
// bays, plaster between (a damp stain low down, a patch where it has fallen off and the wattle shows).
function timberWall(S, h, bays) {
  return (u, v, f) => {
    const L = f.len, bay = bays(f);
    if (u <= 1 || u >= L - 2 || bay.posts.has(u)) return (v + u) % 7 === 0 ? P.t2 : P.t1;
    if (v === 0 || v === h - 1) return P.t1;
    if (v === 5 || v === 15) return P.t2;
    const b = bay.of(u);
    if (b && b.brace && v > 0 && v < 15) { const k = v < 5 ? v : v - 10, du = b.flip ? b.u1 - u : u - b.u0; if (Math.abs(du - (v < 5 ? k : 15 - v) * 0.8) < 0.7) return P.t2; }
    if (!S.far && v <= 3 && noise(u + f.name.length * 40, v * 2, 3, S.seed) > 0.62) return P.p3;
    if (!S.far && b && b.patch && v > 7 && v < 12 && u > b.u0 && u < b.u1) return (u + v) % 2 ? P.tlight : P.t3;
    return !S.far && hash(u, v, f.name.length + S.seed) < 0.04 ? P.p2 : P.p1;
  };
}
// The bays of a facade: a stud every seven or so, some with a window, the end bays braced.
function layBays(S, L, want, key) {
  const n = Math.max(1, Math.round((L - 4) / 7)), posts = new Set(), list = [];
  const inner = L - 4 - (n - 1);
  let u = 2;
  for (let i = 0; i < n; i += 1) {
    const w = Math.floor(inner / n) + (i < inner % n ? 1 : 0);
    list.push({ u0: u, u1: u + w - 1, i });
    u += w;
    if (i < n - 1) { posts.add(u); u += 1; }
  }
  list.forEach((b) => { b.window = want(b, n); b.brace = !b.window && !S.far && (b.i === 0 || b.i === n - 1); b.flip = b.i === n - 1; b.patch = !b.window && !b.brace && hash(key, b.i, S.seed) < 0.3; });
  return { posts, list, of: (x) => list.find((b) => x >= b.u0 && x <= b.u1) };
}

// ---- openings ----------------------------------------------------------------------------------------------------------
// A window: glass one voxel in, a glazing bar or two, a frame, a sill, sometimes shutters and a box of flowers.
function windowAt(S, f, u0, y0, w, h, o = {}) {
  const glass = S.nextWin();
  S.info.windows += 1;
  const frame = o.frame ?? P.t2;
  for (let v = -1; v <= h; v += 1) for (let u = u0 - 1; u <= u0 + w; u += 1) {
    const edge = u < u0 || u >= u0 + w || v < 0 || v >= h;
    if (edge) { if (o.frame !== null) put(S, f, u, y0 + v, 0, frame); continue; }
    cut(S, f, u, y0 + v, 0);
    const bar = !S.far && ((o.barsU ?? []).includes(u - u0) || (o.barsV ?? []).includes(v));
    put(S, f, u, y0 + v, bar ? 0 : 1, bar ? (o.bar ?? P.t1) : glass);
    if (bar) put(S, f, u, y0 + v, 1, glass);
  }
  if (o.sill !== false) for (let u = u0 - 1; u <= u0 + w; u += 1) put(S, f, u, y0 - 1, -1, o.sill ?? P.t3);
  if (o.lintel) for (let u = u0 - 1; u <= u0 + w; u += 1) put(S, f, u, y0 + h, 0, o.lintel);
  if (o.shutters && !S.far) for (const side of [-1, 1]) for (let v = 0; v < h; v += 1) for (let k = 1; k <= Math.ceil(w / 2); k += 1) {
    const u = side < 0 ? u0 - 1 - k : u0 + w + k - 1 + 1;
    put(S, f, u, y0 + v, -1, v % 3 === 1 ? P.k2 : k === 1 ? P.k3 : P.k1);
  }
  if (o.flowers && !S.far) {
    for (let u = u0 - 1; u <= u0 + w; u += 1) { put(S, f, u, y0 - 2, -1, P.t3); put(S, f, u, y0 - 2, -2, P.t3); }
    for (let u = u0 - 1; u <= u0 + w; u += 1) for (const d of [-1, -2]) {
      const r = hash(u, d, S.seed + y0);
      put(S, f, u, y0 - 1, d, r < 0.22 ? P.fr : r < 0.34 ? P.fy : r < 0.44 ? P.fp : r < 0.52 ? P.fw : r < 0.6 ? P.fv : P.lf2);
      if (r > 0.7) put(S, f, u, y0, d, r > 0.86 ? P.lf1 : o.bloom ?? P.fr);
    }
  }
  return glass;
}
// A door: a recess five deep (dark inside: the door leaf is its own part, so it can open), a frame, a step.
function doorAt(S, f, u0, y0, w, h, o = {}) {
  for (let v = 0; v < h; v += 1) for (let u = u0; u < u0 + w; u += 1) {
    const arch = o.arch ? (u + 0.5 - (u0 + w / 2)) ** 2 + (v + 0.5 - (h - w / 2)) ** 2 > (w / 2) ** 2 && v >= h - w / 2 : false;
    if (arch) continue;
    for (let d = 0; d < 5; d += 1) cut(S, f, u, y0 + v, d);
    put(S, f, u, y0 + v, 5, S.far ? P.k2 : P.void);
    if (S.far) put(S, f, u, y0 + v, 1, (u - u0) % 2 ? P.k1 : P.k2); // the far version: the door painted shut
  }
  if (o.frame !== null) for (let v = 0; v <= h; v += 1) for (const u of [u0 - 1, u0 + w]) put(S, f, u, y0 + v, 0, o.frame ?? P.t1);
  if (o.frame !== null && !o.arch) for (let u = u0 - 1; u <= u0 + w; u += 1) put(S, f, u, y0 + h, 0, o.frame ?? P.t1);
  const [x, z] = f.at(u0 + w / 2, 1);
  S.info.door = { at: [x, y0, z], w, h, face: f.name, out: f.out, hinge: f.at(u0, 1), steps: o.steps ?? 0 };
  return S.info.door;
}
// Steps and a doorstep out from a door, down to the lot.
function steps(S, f, u0, w, n, id = P.s2) {
  for (let k = 0; k < Math.max(1, n); k += 1) for (let u = u0 - 1; u <= u0 + w; u += 1) for (let y = 0; y < n - k; y += 1) put(S, f, u, y, -1 - k, k === 0 && y === n - k - 1 ? P.q1 : id);
  if (!n) for (let u = u0 - 1; u <= u0 + w; u += 1) put(S, f, u, 0, -1, P.q2);
}

// ---- roofs ----------------------------------------------------------------------------------------------------------------
// A pitched roof over x0..x1, z0..z1 from y0: its ridge along x ('eaves' to the street) or along z ('gable' to it).
// Tiles in courses of two tones with an odd one out, a darker ridge, bargeboards at the gable ends, moss on the
// back slope. The gable ends' triangles are filled by gable(u, v, face) (null: the roof's own ends are left open).
function roof(S, r, y0, o) {
  const along = o.ridge === 'x', span = along ? r.z1 - r.z0 + 1 : r.x1 - r.x0 + 1, half = span / 2, pitch = o.pitch ?? 1;
  const T = o.tiles ?? [P.r1, P.r2, P.r2, P.r3], barge = o.barge ?? [P.t1, P.t2], under = o.under ?? P.t1;
  const top = Math.floor(half * pitch);
  for (let z = r.z0; z <= r.z1; z += 1) for (let x = r.x0; x <= r.x1; x += 1) {
    const q = along ? z - r.z0 : x - r.x0, k = Math.min(q, span - 1 - q), ridge = k >= Math.floor(half) - 1;
    const y = y0 + Math.floor((k + 1) * pitch) - 1, back = along ? z < (r.z0 + r.z1) / 2 : x < (r.x0 + r.x1) / 2;
    const end = along ? x === r.x0 || x === r.x1 : z === r.z0 || z === r.z1, lane = along ? x : z;
    let id;
    if (end && o.barge !== false) id = (k + lane) % 3 === 0 ? barge[1] : barge[0];
    else if (ridge) id = P.ridge;
    else if (S.far) id = o.thatch ? P.th1 : T[0];
    else {
      id = o.thatch ? pick([P.th1, P.th1, P.th2, P.th3], hash(Math.floor(lane / 2), k, S.seed)) : k % 2 ? T[1] : T[0];
      if (!o.thatch && hash(Math.floor((lane + (k % 2) * 2) / 3), k, S.seed + (back ? 1 : 2)) < 0.1) id = T[3];
      if (back && k > 2 && o.moss !== false && noise(x, z, 4, S.seed) > (o.thatch ? 0.74 : 0.78)) id = hash(x, z) < 0.6 ? P.moss1 : P.moss2;
      if (!o.thatch && hash(x, z, S.seed + 9) < 0.005) id = P.t1; // a slipped tile
    }
    const thick = o.thatch ? 3 : 2;
    for (let yy = y - thick + 1; yy <= y; yy += 1) S.b.put(x, yy, z, yy === y ? id : o.thatch ? P.th4 : under);
    if (pitch > 1) for (let yy = y - thick; yy > y - thick - Math.ceil(pitch); yy -= 1) S.b.put(x, yy, z, o.thatch ? P.th4 : under);
    // the attic, solid under the tiles inside the walls
    const inX = x > r.x0 + (along ? 1 : 2) && x < r.x1 - (along ? 1 : 2), inZ = z > r.z0 + (along ? 2 : 1) && z < r.z1 - (along ? 2 : 1);
    if (inX && inZ) S.b.fill(x, y0, z, x, y - thick, z, P.void);
  }
  // the gable ends: a triangle of wall under the verge, painted by the style
  if (o.gable) {
    for (const side of along ? ['left', 'right'] : ['front', 'back']) {
      const w = o.wall, f = faceOf(w, side), inset = along ? r.x0 - w.x0 : 0;
      for (let v = 0; v < top + 2; v += 1) for (let u = 0; u < f.len; u += 1) {
        const q = along ? (side === 'left' ? w.z0 + u : w.z1 - u) - r.z0 : (side === 'front' ? w.x0 + u : w.x1 - u) - r.x0;
        const k = Math.min(q, span - 1 - q), yTop = y0 + Math.floor((k + 1) * pitch) - 2;
        if (y0 + v > yTop) continue;
        const id = o.gable(u, v, f, k);
        if (id) put(S, f, u, y0 + v, 0, id);
      }
      void inset;
    }
  }
  return { top: y0 + top, span, pitch };
}
// A dormer through the front slope of an eaves roof: its own little gable, a window, lead on its cheeks.
function dormer(S, xc, zFace, y0, w, o = {}) {
  const f = { name: 'front', len: w + 2, at: (u, d) => [xc - (w >> 1) - 1 + u, zFace - d], out: [0, 1] };
  for (let v = 0; v < 10; v += 1) for (let u = 0; u < w + 2; u += 1) for (let d = 0; d < 8; d += 1) {
    const side = u === 0 || u === w + 1;
    put(S, f, u, y0 + v, d, side ? (d === 0 ? P.t1 : P.lead) : d === 0 ? (o.wall ?? P.p1) : P.void);
  }
  windowAt(S, f, 2, y0 + 2, w - 2, 6, { frame: P.t2, barsU: [(w - 2) >> 1], sill: P.t3 });
  for (let k = 0; k <= (w >> 1) + 2; k += 1) for (let d = -1; d < 9; d += 1) {
    const yy = y0 + 10 + Math.floor(k * 0.8);
    for (const s of [-1, 1]) { const x = xc + s * ((w >> 1) + 2 - k) - (s > 0 ? 1 : 0); S.b.put(x, yy, zFace - d, d === -1 ? P.t1 : k % 2 ? P.r2 : P.r1); S.b.put(x, yy - 1, zFace - d, P.t1); }
  }
}
// A chimney stack from y0 up to y1: coursed stone or brick, a cap, a pot or two, soot on top. Returns the pot's top.
function chimney(S, x0, z0, y0, y1, o = {}) {
  const T = o.tones ?? [P.s1, P.s2, P.s3, P.rub2];
  S.b.fill(x0, y0, z0, x0 + 3, y1, z0 + 3, (x, y, z) => ((y - y0) % 3 === 2 ? P.mortar : y > y1 - 3 && !S.far && hash(x, y, z) < 0.45 ? P.soot : S.tone(T, Math.floor((x + z + Math.floor(y / 3) * 2) / 2), Math.floor(y / 3), 0, 4)));
  S.b.fill(x0 - 1, y1 + 1, z0 - 1, x0 + 4, y1 + 1, z0 + 4, (x, y, z) => (x === x0 - 1 || x === x0 + 4 || z === z0 - 1 || z === z0 + 4 ? P.s3 : P.soot));
  const pots = o.pots ?? 1;
  for (let i = 0; i < pots; i += 1) {
    const px = x0 + (pots > 1 ? i * 2 : 1), pz = z0 + 1;
    S.b.fill(px, y1 + 2, pz, px + 1, y1 + 4, pz + 1, (x, y) => (y === y1 + 4 ? P.soot : y === y1 + 3 && !S.far ? P.clay2 : P.clay));
    S.info.chimneys.push([px + 1, y1 + 5, pz + 1]);
  }
  return y1 + 5;
}
// A gutter along the front eaves with a downpipe at one end into a rain barrel.
// (pz: the pipe's z, just proud of the wall it runs down)
function gutter(S, x0, x1, z, y, pipeX, o = {}) {
  if (S.far) return;
  const pz = o.pz ?? z;
  for (let x = x0; x <= x1; x += 1) S.b.put(x, y, z, x % 6 === 0 ? C.iron3 : C.iron2);
  for (let zz = Math.min(z, pz); zz <= Math.max(z, pz); zz += 1) S.b.put(pipeX, y, zz, C.iron2);
  for (let yy = o.barrel ? 7 : 1; yy < y; yy += 1) S.b.put(pipeX, yy, pz, yy % 6 === 0 ? C.iron3 : C.iron2);
  if (o.barrel) {
    for (let yy = 0; yy <= 6; yy += 1) for (let dz = 0; dz <= 3; dz += 1) for (let dx = -2; dx <= 1; dx += 1) {
      if (Math.hypot(dx + 0.5, dz - 1.5) > 2.1) continue;
      S.b.put(pipeX + dx, yy, pz + dz, yy === 1 || yy === 5 ? C.iron2 : (dx + dz + 9) % 3 === 0 ? P.t1 : P.t3);
    }
    S.b.put(pipeX, 7, pz + 1, P.glass);
  }
}
// A lantern on an iron bracket beside a door: lit at night (a crystal in the upper town).
function lantern(S, f, u, y, o = {}) {
  if (S.far) return;
  put(S, f, u, y + 5, -1, C.iron2); put(S, f, u, y + 5, -2, C.iron2); put(S, f, u, y + 4, -2, C.iron1);
  for (let v = 0; v < 4; v += 1) put(S, f, u, y + v, -2, v === 0 || v === 3 ? C.iron1 : o.crystal ? (v === 1 ? P.crys2 : P.crys1) : v === 1 ? P.lamp : P.lamp2);
  put(S, f, u - 1, y + 1, -2, C.iron1); put(S, f, u + 1, y + 1, -2, C.iron1);
}
// A neon rune over a door (four kinds), glowing.
const RUNES = [['.#.', '###', '.#.'], ['#.#', '.#.', '#.#'], ['###', '#.#', '###'], ['#..', '###', '..#']];
function rune(S, f, u, y, k) { if (S.far) return; RUNES[k % 4].forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') put(S, f, u + i - 1, y + 2 - j, -1, (i + j) % 2 ? P.neon : P.rune); })); }
// A cable clipped up a wall from the ground to the eaves, glowing clips and a junction box with a lit diode.
function wallCable(S, f, u, y0, y1) {
  if (S.far) return;
  for (let y = y0; y <= y1; y += 1) put(S, f, u, y, -1, (y - y0) % 5 === 4 ? P.via : C.iron1);
  for (let v = 0; v < 3; v += 1) for (let k = -1; k <= 1; k += 1) put(S, f, u + k, y0 + 4 + v, -1, v === 1 && k === 0 ? P.trace : C.iron2);
}

// ---- lower town: timber and plaster over a stone plinth ------------------------------------------------------------------
function lower(S) {
  const [W, D] = S.size, n = S.storeys, G = 24, U = 20;
  const x0 = -W / 2, x1 = W / 2 - 1, z0 = -D / 2, z1 = D / 2 - 1;
  const gableFront = W <= 24 && D >= 26, jet = n > 1 ? 2 : 0;
  const cottage = n === 1;
  // the wall boxes: the upper floors under the roof's overhangs, the ground floor under the jetty
  const up = gableFront ? { x0: x0 + 2, x1: x1 - 2, z0: z0 + 1, z1: z1 - 1 } : { x0: x0 + 1, x1: x1 - 1, z0: z0 + 2, z1: z1 - 2 };
  const terrace = S.trade === 'tavern' && n > 1 ? 8 : 0; // the tavern sits back under its jetty: a terrace on posts
  const gr = { ...up, z1: up.z1 - jet - terrace, x0: up.x0 + (jet && !gableFront ? 1 : 0), x1: up.x1 - (jet && !gableFront ? 1 : 0) };
  const stoneBelow = cottage || S.h(1) < 0.55;
  // ground floor: a plinth, then stone or timber
  const wall = cottage ? rubbleWall(S) : stoneWall(S);
  storey(S, gr, 0, G, (u, v, f) => {
    if (v <= 1) return v === 1 && (u + f.name.length) % 5 === 0 ? P.mortar : S.tone([P.s3, P.s4, P.s3], Math.floor(u / 4), v, f.name.length, 5);
    return stoneBelow ? wall(u, v - 2, f) : null;
  });
  if (!stoneBelow) {
    const bays = {};
    for (const name of ['left', 'right', 'back', 'front']) bays[name] = layBays(S, faceOf(gr, name).len, () => false, name.length);
    const tw = timberWall(S, G - 2, (f) => bays[f.name]);
    for (const name of ['left', 'right', 'back', 'front']) { const f = faceOf(gr, name); for (let v = 2; v < G; v += 1) for (let u = 0; u < f.len; u += 1) put(S, f, u, v, 0, tw(u, v - 2, f)); }
  }
  const sill = stoneBelow ? P.s1 : P.t3, lintel = stoneBelow ? P.q1 : null;
  // the front: a door (off-centre on a wide house), ground-floor windows either side, a lantern, sometimes a rune
  const ff = faceOf(gr, 'front'), L = ff.len;
  const shop = S.trade ? S.shopFront?.(S, ff, gr) : null;
  let du;
  if (shop) du = shop.door;
  else {
    du = L <= 22 ? Math.floor(L / 2) - 4 + (S.h(3) < 0.5 ? -3 : 3) : S.h(3) < 0.5 ? 3 : L - 11;
    du = Math.max(2, Math.min(L - 10, du));
    doorAt(S, ff, du, 2, 8, 18, { frame: P.t1 });
    steps(S, ff, du, 8, 2, P.s2);
    const spots = [];
    for (let u = 2; u + 7 <= L - 2; u += 1) if (u + 7 < du - 1 || u > du + 9) { spots.push(u); u += 8; }
    spots.slice(0, 2).forEach((u, i) => windowAt(S, ff, u, 8, 6, 9, { frame: P.t2, barsU: [3], barsV: [4], sill, shutters: S.h(4 + i) < 0.55, flowers: S.h(6 + i) < 0.5, lintel }));
    if (S.h(8) < 0.7) lantern(S, ff, du > L / 2 ? du - 3 : du + 10, 12);
    if (S.h(9) < 0.45) rune(S, ff, du + 4, 20, Math.floor(S.h(10) * 4));
  }
  // the other faces' ground floor: a window or two each
  for (const name of ['left', 'right', 'back']) {
    const f = faceOf(gr, name), k = f.len >= 26 ? 2 : 1;
    for (let i = 0; i < k; i += 1) windowAt(S, f, Math.floor(((i + 0.5) * f.len) / k) - 3, 8, 6, 8, { frame: P.t2, barsU: [3], sill, lintel });
  }
  // the jetty: joist ends under the overhang, a bressumer across the front
  if (terrace) { // posts on stone pads carry the jettied floor over the terrace; lanterns hang from its beams
    for (const x of [up.x0 + 1, 0, up.x1 - 1]) { S.b.fill(x - 1, 0, up.z1 - 1, x, 0, up.z1, P.q1); S.b.fill(x - 1, 1, up.z1 - 1, x, G - 1, up.z1, (xx, y) => (y === G - 1 || y === 1 ? P.tend : P.t1)); }
    for (let x = up.x0; x <= up.x1; x += 1) for (let z = gr.z1 + 1; z <= up.z1; z += 1) S.b.put(x, G - 1, z, (x + z) % 3 ? P.t2 : P.tend);
    if (!S.far) for (const x of [Math.floor(up.x0 / 2), Math.ceil(up.x1 / 2)]) {
      const z = gr.z1 + 4;
      S.b.put(x, G - 2, z, C.iron2); S.b.put(x, G - 3, z, C.iron1);
      for (let y = G - 7; y <= G - 4; y += 1) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) S.b.put(x + dx - 0, y, z + dz, y === G - 7 || y === G - 4 ? C.iron1 : y === G - 5 ? P.lamp2 : P.lamp);
    }
    S.info.terrace = { z0: gr.z1 + 1, z1: up.z1, x0: up.x0 + 2, x1: up.x1 - 2 };
  }
  let y = G;
  for (let s = 1; s < n; s += 1) {
    if (s === 1 && jet) for (let x = up.x0; x <= up.x1; x += 1) {
      for (let z = gr.z1 + 1; z <= up.z1; z += 1) if (!terrace) S.b.put(x, y - 1, z, !S.far && (x - up.x0) % 3 === 1 ? P.tend : 0);
      S.b.put(x, y, up.z1 + 1, S.far ? P.t1 : x % 4 === 0 ? P.tend : P.t1); // the bressumer, carved
    }
    const bays = {};
    for (const name of ['left', 'right', 'back', 'front']) {
      const f = faceOf(up, name);
      bays[name] = layBays(S, f.len, (b, nb) => (b.u1 - b.u0 < 3 ? false : name === 'front' ? nb <= 2 || (b.i + s) % 2 === 0 || b.i === Math.floor(nb / 2) : name === 'back' ? nb === 1 || (b.i + s) % 2 === 1 : b.i === Math.floor(nb / 2) || (nb >= 4 && b.i === nb - 1 - Math.floor(nb / 2) - (s % 2))), name.length * 10 + s);
    }
    storey(S, up, y, U, timberWall(S, U, (f) => bays[f.name]));
    for (const name of ['left', 'right', 'back', 'front']) {
      const f = faceOf(up, name);
      for (const b of bays[name].list) if (b.window) {
        const w = b.u1 - b.u0 + 1;
        windowAt(S, f, b.u0, y + 6, w, 8, { frame: null, sill: P.t3, barsU: w > 4 ? [w >> 1] : [], barsV: [4], shutters: name === 'front' && w <= 6 && S.h(s + b.i, 3) < 0.35, flowers: name !== 'back' && S.h(s + b.i, 5 + name.length) < 0.35, bloom: pick([P.fr, P.fy, P.fp, P.fv], S.h(b.i, s)) });
      }
    }
    y += U;
  }
  // the roof: steep, its gable to the street on a narrow house, eaves to it on a wide one
  const wallTop = y;
  const rr = { x0, x1, z0, z1 };
  const gb = (u, v, f) => ((u + v) % 7 === 0 || u === 0 || u === f.len - 1 || v === 0 ? P.t1 : v === 6 ? P.t2 : !S.far && hash(u, v, S.seed) < 0.04 ? P.p2 : P.p1);
  const res = roof(S, rr, wallTop, { ridge: gableFront ? 'z' : 'x', pitch: gableFront ? 1.5 : cottage ? 1.25 : 1, wall: up, gable: gb });
  // a window high in each gable, a finial on the front one; dormers on the front slope of a wide house
  for (const name of gableFront ? ['front', 'back'] : ['left', 'right']) {
    const f = faceOf(up, name);
    if (f.len >= 14) windowAt(S, f, (f.len >> 1) - 2, wallTop + 3, 4, 6, { frame: P.t2, barsV: [3], sill: P.t3 });
  }
  if (gableFront) { if (!S.far && S.h(12) < 0.5) for (let k = 0; k < 4; k += 1) S.b.put(-1, res.top + 1 + k, z1, k < 2 ? C.iron2 : k === 2 ? P.crys2 : P.crys1); }
  else if (!cottage || W >= 28) {
    const nd = W >= 30 ? 2 : 1;
    for (let i = 0; i < nd; i += 1) dormer(S, nd === 1 ? (S.h(13) < 0.5 ? -4 : 3) : i ? Math.floor(W / 4) : -Math.floor(W / 4), z1 - 5, wallTop + 3, 6, { wall: P.p1 });
  }
  // the chimney: through the ridge near one end (a narrow house's at the back)
  const cx = gableFront ? (S.h(14) < 0.5 ? up.x0 + 2 : up.x1 - 5) : S.h(14) < 0.5 ? up.x0 + 3 : up.x1 - 6;
  const cz = gableFront ? up.z0 + 3 : -2;
  chimney(S, cx, cz, wallTop - 2, res.top + (gableFront ? 3 : 5), { pots: W >= 28 ? 2 : 1 });
  // a gutter along the front eaves and a pipe down the wall to a rain barrel (a side gutter on a narrow house)
  if (!gableFront) gutter(S, x0 + 1, x1 - 1, z1 + 1, wallTop - 1, S.h(15) < 0.5 ? gr.x0 + 1 : gr.x1 - 1, { pz: gr.z1 + 1, barrel: S.h(16) < 0.6 && !terrace && !shop });
  else if (!S.far) { // a gutter along the side eaves, its pipe down the side wall near the front
    const gx = up.x0 - 1;
    for (let z = up.z0; z <= up.z1; z += 1) S.b.put(gx, wallTop - 1, z, z % 6 === 0 ? C.iron3 : C.iron2);
    for (let yy = 1; yy < wallTop - 1; yy += 1) S.b.put(gr.x0 - 1, yy, gr.z1 - 2, yy % 6 === 0 ? C.iron3 : C.iron2);
    for (let x = gr.x0 - 1; x <= gx; x += 1) S.b.put(x, wallTop - 1, gr.z1 - 2, C.iron2);
  }
  if (S.h(17) < 0.3) wallCable(S, faceOf(gr, S.h(18) < 0.5 ? 'left' : 'right'), 3, 3, wallTop - 2);
  S.info.top = res.top + 8;
  S.info.front = gr.z1;
  S.info.upFront = up.z1 + (jet ? 0 : 0);
  S.info.back = up.z0;
  S.info.eave = wallTop;
  S.info.ridge = gableFront ? [0, res.top + 1, Math.floor(D / 5)] : [Math.floor(W / 5), res.top + 1, 0];
  return S;
}

// ---- upper town: coursed ashlar, an arched door up two steps, tall windows, a balcony, slate and dormers ------------------
function upper(S) {
  const [W, D] = S.size, n = S.storeys, G = 24, U = 20;
  const x0 = -W / 2, x1 = W / 2 - 1, z0 = -D / 2, z1 = D / 2 - 1;
  const wall = { x0: x0 + 1, x1: x1 - 1, z0: z0 + 2, z1: z1 - 3 };
  const aw = ashlarWall(S);
  const H = G + U * (n - 1);
  const floorAt = (s) => (s ? G + U * (s - 1) : 0);
  storey(S, wall, 0, H, (u, v, f) => {
    if (v <= 2) return v === 2 ? P.sill : S.tone([P.a3, P.a4], Math.floor(u / 5), v, 0, 6); // a plinth
    if (v === G || (n > 2 && v === G + U)) return P.sill; // string courses
    return aw(u, v, f);
  });
  const ff = faceOf(wall, 'front');
  for (const name of ['front', 'back', 'left', 'right']) { const f = faceOf(wall, name); for (let s = 1; s < n; s += 1) for (let u = -1; u <= f.len; u += 1) put(S, f, u, floorAt(s), -1, P.sill); } // string courses stand proud
  // the door: arched, up two steps, a fanlight, a keystone, a crystal lamp beside it
  const L = ff.len;
  const du = L <= 20 ? (L >> 1) - 4 : S.h(21) < 0.5 ? 3 : L - 11;
  doorAt(S, ff, du, 2, 8, 19, { arch: true, frame: null, steps: 2 });
  for (let v = 0; v <= 22; v += 1) for (let u = du - 2; u <= du + 9; u += 1) { // the surround: jambs and voussoirs
    const r = Math.hypot(u + 0.5 - (du + 4), v + 0.5 - 15);
    if (v < 15 ? u === du - 1 || u === du + 8 : r > 4 && r <= 5.6) put(S, ff, u, v + 2, -1, v >= 15 && Math.abs(u + 0.5 - (du + 4)) < 1 ? P.q1 : (v >> 1) % 2 ? P.a1 : P.sill);
  }
  const fan = S.nextWin(); S.info.windows += 1;
  for (let v = 15; v <= 18; v += 1) for (let u = du; u < du + 8; u += 1) if (Math.hypot(u + 0.5 - (du + 4), v + 0.5 - 15) <= 3.6) { cut(S, ff, u, v + 2, 0); put(S, ff, u, v + 2, 1, (u + v) % 3 ? fan : P.t1); }
  steps(S, ff, du, 8, 2, P.a3);
  lantern(S, ff, du > L / 2 ? du - 3 : du + 10, 12, { crystal: true });
  if (S.h(22) < 0.55) rune(S, ff, du + 4, 24, Math.floor(S.h(23) * 4));
  // windows on every face and floor: tall, in stone surrounds, arched on the ground floor; one opening onto a balcony
  const win = (f, u, yy, tall, o = {}) => windowAt(S, f, u, yy, 5, tall ? 14 : 11, { frame: P.a1, sill: P.sill, barsU: [2], barsV: tall ? [5, 10] : [5], lintel: P.q1, ...o });
  for (const name of ['front', 'back', 'left', 'right']) {
    const f = faceOf(wall, name), front = name === 'front', step = front ? 7 : 8;
    const cols = [];
    for (let u = 3; u + 5 < f.len - 2; u += step) cols.push(u);
    const use = front || name === 'back' ? cols : cols.filter((_, i) => i === Math.floor((cols.length - 1) / 2) || i === cols.length - 1 - Math.floor((cols.length - 1) / 2));
    for (let s = 0; s < n; s += 1) {
      const yy = floorAt(s) + (s ? 4 : 7);
      const bal = front && s === 1 ? use[Math.floor(use.length / 2)] : -1;
      for (const u of use) {
        if (s === 0 && front && u + 6 >= du - 2 && u <= du + 10) continue; // the door's own bay
        const tall = u === bal;
        win(f, u, tall ? yy - 3 : yy, tall, { shutters: !tall && s > 0 && S.h(u + name.length, s) < 0.35, flowers: !tall && front && s > 0 && S.h(u, s + 9) < 0.3, bloom: P.fr });
        if (tall && !S.far) { // the balcony: a slab on two brackets, an iron railing, a pot of geraniums
          for (let k = -2; k <= 6; k += 1) for (let d = 1; d <= 3; d += 1) { put(S, f, u + k, yy - 4, -d, P.sill); if (d === 3 || k === -2 || k === 6) for (let v = 1; v <= 5; v += 1) put(S, f, u + k, yy - 4 + v, -d, v === 5 ? C.iron2 : (k + d) % 2 ? C.iron1 : 0); }
          for (const k of [-1, 5]) { put(S, f, u + k, yy - 5, -1, P.sill); put(S, f, u + k, yy - 5, -2, P.sill); put(S, f, u + k, yy - 6, -1, P.sill); }
          put(S, f, u + 4, yy - 3, -2, P.clay); put(S, f, u + 4, yy - 2, -2, P.lf2); put(S, f, u + 4, yy - 1, -2, P.fr);
        }
      }
    }
  }
  // a cornice under the eaves, then slate: steep, with a stone coping at the gables, dormers, the chimneys on the gable walls
  for (let u = -1; u <= ff.len; u += 1) { put(S, ff, u, H, -1, P.sill); put(S, ff, u, H - 1, -1, (u % 3) ? P.a1 : P.am); }
  const rr = { x0, x1, z0, z1 };
  const res = roof(S, rr, H + 1, { ridge: 'x', pitch: 1.25, tiles: [P.r1, P.r2, P.r2, P.r3], barge: [P.a2, P.a3], under: P.lead, wall, gable: (u, v, f) => aw(u, v + H + 1, f) });
  for (const name of ['left', 'right']) { const f = faceOf(wall, name); if (f.len >= 16) windowAt(S, f, (f.len >> 1) - 2, H + 4, 4, 7, { frame: P.a1, sill: P.sill, barsV: [3], lintel: P.q1 }); }
  const nd = W >= 28 ? 2 : 1;
  for (let i = 0; i < nd; i += 1) dormer(S, nd === 1 ? 0 : i ? Math.floor(W / 4) : -Math.floor(W / 4) - 1, z1 - 5, H + 4, 5, { wall: P.a1 });
  const top = chimney(S, S.h(24) < 0.5 ? wall.x0 + 1 : wall.x1 - 4, -2, H - 1, res.top + 6, { tones: [P.a2, P.a3, P.a4, P.a2], pots: 2 });
  if (W >= 28) chimney(S, S.h(24) < 0.5 ? wall.x1 - 4 : wall.x0 + 1, -2, H - 1, res.top + 4, { tones: [P.a2, P.a3, P.a4, P.a2] });
  if (!S.far) for (let x = x0 + 2; x < x1 - 1; x += 1) S.b.put(x, res.top + 1, 0, x % 3 ? 0 : C.iron2); // iron cresting on the ridge
  gutter(S, x0 + 1, x1 - 1, z1, H, S.h(25) < 0.5 ? wall.x0 + 1 : wall.x1 - 1, { pz: wall.z1 + 1, barrel: false });
  S.info.top = top + 2;
  S.info.front = wall.z1;
  S.info.upFront = wall.z1;
  S.info.back = wall.z0;
  S.info.eave = H;
  S.info.ridge = [Math.floor(W / 5), res.top + 2, 0];
  return S;
}

// ---- the harbour: on piles over the water, tarred boards, hoists and nets ------------------------------------------------
function pier(S) {
  const [W, D] = S.size, n = S.storeys;
  const x0 = -W / 2, x1 = W / 2 - 1, z0 = -D / 2, z1 = D / 2 - 1;
  const master = S.kind === 'master', loft = !master && W <= 22, store = !master && W >= 30;
  // the deck on its piles (down into the sea, weed at the waterline), a rail along the water side
  for (let z = z0; z <= z1; z += 1) for (let x = x0; x <= x1; x += 1) S.b.put(x, -1, z, S.tone([P.t3, P.t2, P.tlight], x, 0, Math.floor(z / 3), 7));
  for (let z = z0; z <= z1; z += 1) for (let x = x0; x <= x1; x += 1) S.b.put(x, 0, z, (z + 99) % 4 === 0 ? P.t2 : S.tone([P.t3, P.tlight, P.t3], Math.floor((x + (Math.floor(z / 4) % 2) * 3) / 6), 0, Math.floor(z / 4), 8));
  for (let z = z0 + 1; z <= z1; z += 5) for (let x = x0 + 1; x <= x1; x += 6) for (let y = -16; y < -1; y += 1) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) S.b.put(x + dx, y, z + dz, y < -9 && y > -13 && !S.far ? P.weed : (y + dx) % 5 === 0 ? P.pile2 : P.pile);
  const wall = { x0: x0 + 2, x1: x1 - 2, z0: z0 + 3, z1: z1 - 3 };
  // painted boards (each building its own colour), dark joints between them, a tarred skirt at the foot
  const boards = (u, v, f) => (v < 3 ? P.tar2 : (u + (f.name.length % 2)) % 3 === 0 ? P.bdj : !S.far && (v + Math.floor(u / 3) * 5) % 17 === 0 ? P.bdj : S.tone([P.bd1, P.bd2, P.bd1, P.bd3], Math.floor(u / 3), Math.floor(v / 7), f.name.length, 9));
  const G = master ? 24 : 22, U = 20, H = G + U * (n - 1);
  storey(S, wall, 1, H, (u, v, f) => {
    if (master) return v < G ? stoneWall(S, 0.15)(u, v, f) : v === G ? P.t1 : boards(u, v, f);
    if (store) return v < G ? stoneWall(S, 0.1)(u, v, f) : boards(u, v, f);
    return v === 0 ? P.t1 : boards(u, v, f);
  });
  const ff = faceOf(wall, 'front'), fb = faceOf(wall, 'back'), L = ff.len;
  // doors: a man door on the quay side; a boathouse's big doors on the water side; a store's stacked loading doors
  if (store || loft) {
    // a door from the quay; stacked loading doors on the water side, where the boats unload, under a hoist beam
    const du = (L >> 1) - 5, bl = fb.len, bu = (bl >> 1) - 5;
    doorAt(S, ff, du, 1, 10, 18, { frame: P.t1 });
    for (let s = 0; s < n; s += 1) {
      const yy = s ? 1 + G + U * (s - 1) + 2 : 3;
      for (let v = 0; v < 15; v += 1) for (let u = bu; u < bu + 10; u += 1) put(S, fb, u, yy + v, 0, u === bu || u === bu + 9 || v === 0 || v === 14 ? P.t1 : (u + v) % 7 === 0 ? P.t1 : u < bu + 5 ? P.k1 : P.k2);
      for (let u = bu; u < bu + 10; u += 1) put(S, fb, u, yy - 1, -1, P.t2);
    }
    // the hoist beam out of the gable top, a pulley, a rope with a crate on it (the crate is its own part)
    if (!S.far) { const yy = 1 + H + 6; for (let d = -6; d <= 1; d += 1) for (const dy of [0, 1]) put(S, fb, (bl >> 1) - 1, yy + dy, d, P.t1); put(S, fb, (bl >> 1) - 1, yy - 1, -5, C.iron2); put(S, fb, (bl >> 1) - 1, yy - 2, -5, C.iron3); }
    S.info.hoist = fb.at((bl >> 1) - 1, -5).concat(1 + H + 4);
  } else {
    const du = master ? (L >> 1) - 4 : 3;
    doorAt(S, ff, du, 1, 8, 18, { frame: P.t1 });
    const fb2 = fb;
    if (!master) { // the boat doors onto the water, and a slipway down into it
      const bw = Math.min(L - 6, 16), bu = (L - bw) >> 1;
      for (let v = 0; v < 18; v += 1) for (let u = bu; u < bu + bw; u += 1) put(S, fb2, u, 1 + v, 0, u === bu || u === bu + bw - 1 || v === 17 ? P.t1 : (u - bu) === (bw >> 1) ? P.t1 : Math.abs((u - bu) % (bw >> 1) - v * 0.45) < 0.6 ? P.t2 : P.k2);
      if (!S.far) for (let k = 0; k < 6; k += 1) for (let u = bu; u < bu + bw; u += 1) S.b.put(...(() => { const [x, z] = fb2.at(u, -1 - k); return [x, -1 - Math.floor(k * 0.8), z]; })(), (u + k) % 3 ? P.t3 : P.t2);
    }
    for (const u of master ? [2, L - 8] : [L - 9]) windowAt(S, ff, u, 7, 6, 8, { frame: P.t1, barsU: [3], sill: P.t3 });
  }
  // side windows, lit lofts
  for (const name of ['left', 'right']) { const f = faceOf(wall, name); if (f.len > 14) for (let s = 0; s < n; s += 1) windowAt(S, f, (f.len >> 1) - 2, 1 + 7 + (s ? G + U * (s - 1) : 0), 5, 7, { frame: P.t1, barsU: [2], sill: P.t3 }); }
  if (master) { // a bay window to the harbour, lit
    const f = fb;
    for (let v = 0; v < 12; v += 1) for (let u = (f.len >> 1) - 6; u < (f.len >> 1) + 6; u += 1) for (let d = -3; d <= 0; d += 1) put(S, f, u, 6 + v, d, d > -3 || v === 0 || v === 11 ? (u === (f.len >> 1) - 6 || u === (f.len >> 1) + 5 || v === 0 || v === 11 ? P.t1 : 0) : 0);
    windowAt(S, f, (f.len >> 1) - 5, 7, 10, 10, { frame: P.t1, barsU: [3, 6], barsV: [5], sill: P.t3 });
    for (let u = (f.len >> 1) - 6; u < (f.len >> 1) + 6; u += 1) for (let d = -3; d <= 0; d += 1) { put(S, f, u, 6, d, P.t2); put(S, f, u, 18, d, P.lead); }
  }
  // the roof: shingles (dark by tint), a cupola vent on a boathouse, a weathervane on the net loft
  const rr = { x0: x0 + 1, x1: x1 - 1, z0: z0 + 1, z1: z1 - 1 };
  const res = roof(S, rr, 1 + H, { ridge: loft ? 'z' : 'x', pitch: loft ? 1.5 : 1, wall, moss: false, gable: (u, v, f) => boards(u, v + H, f) });
  if (!S.far && !loft && !store) for (let y = 0; y < 6; y += 1) for (let x = -2; x <= 1; x += 1) for (let z = -2; z <= 1; z += 1) S.b.put(x, res.top + y, z, y === 5 ? P.r3 : y === 4 ? P.t1 : (x + z) % 2 ? P.tar1 : y > 1 && y < 4 && (x === -2 || x === 1) ? P.void : P.tar2);
  if (!S.far && loft) { for (let y = 1; y <= 6; y += 1) S.b.put(0, res.top + y, 0, C.iron2); for (let x = -3; x <= 3; x += 1) S.b.put(x, res.top + 6, 0, x === 3 ? P.copper2 : P.copper); S.b.put(-3, res.top + 7, 0, P.copper); S.b.put(-3, res.top + 5, 0, P.copper); }
  if (master) { // the signal mast: a yard with flags, a lamp on top
    for (let y = 0; y < 20; y += 1) S.b.put(x1 - 5, res.top - 4 + y, -1, y % 6 === 0 ? C.iron3 : P.t1);
    if (!S.far) for (let x = -3; x <= 3; x += 1) S.b.put(x1 - 5 + x, res.top + 12, -1, P.t1);
    if (!S.far) for (const [x, c] of [[-3, P.ringR], [-1, P.fy], [1, P.cl2], [3, P.ringW]]) for (let y = 0; y < 3; y += 1) S.b.put(x1 - 5 + x, res.top + 11 - y, -1, c);
    S.b.put(x1 - 5, res.top + 16, -1, P.lamp); S.b.put(x1 - 5, res.top + 17, -1, P.lamp2);
  }
  S.info.chimneys = [];
  if (master || store) chimney(S, wall.x1 - 5, wall.z0 + 2, H - 2, res.top + 4);
  // the story at the foot: a life ring, coils of rope, nets hung to dry, crab pots, oars, a lantern by the door
  if (!S.far) {
    const lr = (f, u, y) => { for (let a = 0; a < 16; a += 1) { const t = (a / 16) * Math.PI * 2; put(S, f, u + Math.round(Math.cos(t) * 2.5), y + Math.round(Math.sin(t) * 2.5), -1, a % 4 < 2 ? P.ringR : P.ringW); } };
    lr(ff, L - 4, 12);
    // a net hung to dry on the side wall: a diamond mesh from a rope, sagging, with cork floats along it
    const fs = faceOf(wall, 'left'), nw = Math.min(fs.len - 6, 14);
    for (let u = 0; u < nw; u += 1) {
      const sag = Math.round(3 * Math.sin((u / (nw - 1)) * Math.PI));
      put(S, fs, 3 + u, 19, -1, P.rope);
      for (let v = 0; v < 12 - sag; v += 1) if ((u + v) % 3 === 0 || (u - v + 99) % 3 === 0) put(S, fs, 3 + u, 18 - v, -1, v === 11 - sag ? P.ringW : P.net);
    }
    lantern(S, ff, (L >> 1) + (store || loft ? 7 : master ? 6 : -1), 12);
    for (const [x, z] of [[x0 + 2, z1 - 1], [x1 - 3, z1 - 1]]) for (let y = 1; y <= 3; y += 1) for (let a = 0; a < 10; a += 1) S.b.put(x + Math.round(Math.cos(a) * 1.2), y, z + Math.round(Math.sin(a) * 1.2), a % 3 ? P.rope : P.sack2);
  }
  S.info.top = res.top + (master ? 18 : 8);
  S.info.front = wall.z1;
  return S;
}

// ---- the country: a farmhouse and a barn under thatch, a windmill, a watermill ---------------------------------------------
function farm(S) {
  const [W, D] = S.size, drop = S.drop ?? 12;
  const x0 = -W / 2, x1 = W / 2 - 1, z0 = -D / 2, z1 = D / 2 - 1;
  const barn = S.kind === 'barn', wall = { x0: x0 + 2, x1: x1 - 2, z0: z0 + 2, z1: z1 - 2 };
  // the plinth down to the lower terrace
  S.b.fill(wall.x0 - 1, -drop, wall.z0 - 1, wall.x1 + 1, -1, wall.z1 + 1, (x, y, z) => rubbleWall(S)(x + z, y + drop, { name: 'plinth', len: 99 }));
  const H = barn ? 26 : 22 + 18;
  storey(S, wall, 0, H, (u, v, f) => {
    if (barn) return v < 4 ? rubbleWall(S)(u, v, f) : (u % 4 === 0 ? P.t1 : S.tone([P.boardR, P.boardR2, P.boardR], Math.floor(u / 4), Math.floor(v / 9), f.name.length, 11));
    if (v < 22) return rubbleWall(S)(u, v, f);
    const vv = v - 22;
    if (u <= 1 || u >= f.len - 2 || u % 6 === 0 || vv === 0 || vv === 17) return P.t1;
    if (vv === 8) return P.t2;
    return P.p1;
  });
  const ff = faceOf(wall, 'front'), L = ff.len;
  if (barn) {
    const bw = 14, bu = (L - bw) >> 1;
    for (let v = 0; v < 20; v += 1) for (let u = bu; u < bu + bw; u += 1) put(S, ff, u, v, 0, u === bu || u === bu + bw - 1 || v === 19 || u === bu + (bw >> 1) ? P.t1 : Math.abs(((u - bu) % (bw >> 1)) - (19 - v) * 0.35) < 0.6 ? P.t2 : P.k2);
    S.info.door = { at: ff.at(bu + bw / 2, 1).length ? [ff.at(bu + bw / 2, 1)[0], 0, ff.at(bu + bw / 2, 1)[1]] : [0, 0, 0], w: bw, h: 20, face: 'front', out: [0, 1], hinge: ff.at(bu, 1), barn: true };
    for (let v = 0; v < 5; v += 1) for (let u = (L >> 1) - 3; u < (L >> 1) + 3; u += 1) { cut(S, ff, u, 21 + v, 0); put(S, ff, u, 21 + v, 1, v < 3 && !S.far ? (hash(u, v) < 0.6 ? P.th1 : P.th3) : P.void); } // the hay loft door, hay in it
  } else {
    const du = (L >> 1) - 4;
    doorAt(S, ff, du, 0, 8, 18, { frame: P.t1 });
    steps(S, ff, du, 8, 0);
    for (const u of [3, L - 9]) windowAt(S, ff, u, 7, 6, 8, { frame: P.t1, barsU: [3], sill: P.s1, flowers: true });
    for (const u of [4, (L >> 1) - 2, L - 8]) windowAt(S, ff, u, 27, 4, 6, { frame: P.t1, barsV: [3], sill: P.t3 });
    lantern(S, ff, du + 10, 11);
  }
  const res = roof(S, { x0, x1, z0, z1 }, H, { ridge: 'x', pitch: barn ? 1 : 1.25, thatch: true, wall, gable: barn ? (u, v) => (u % 4 === 0 ? P.t1 : P.boardR) : (u, v) => (u % 6 === 0 || v === 0 ? P.t1 : P.p1) });
  if (!barn) chimney(S, wall.x1 - 5, -2, H - 2, res.top + 4, { tones: [P.rub1, P.rub2, P.rub3] });
  S.info.top = res.top + 6;
  S.info.front = wall.z1;
  return S;
}
function windmill(S) {
  const drop = S.drop ?? 12, R0 = 10, R1 = 7, H = 64;
  S.b.fill(-11, -drop, -11, 10, -1, 10, (x, y, z) => (Math.hypot(x + 0.5, z + 0.5) <= R0 + 0.8 ? rubbleWall(S)(x + z, y + drop, { name: 'x', len: 99 }) : 0));
  for (let y = 0; y < H; y += 1) {
    const r = R0 - ((R0 - R1) * y) / H;
    for (let z = -11; z <= 10; z += 1) for (let x = -11; x <= 10; x += 1) {
      const d = Math.hypot(x + 0.5, z + 0.5);
      if (d > r) continue;
      if (d < r - 1.4) { S.b.put(x, y, z, P.void); continue; }
      // whitewash over rubble: patches where it has worn through near the foot, one circuit line spiralling up
      const a = Math.atan2(z + 0.5, x + 0.5), u = (a / (Math.PI * 2) + 0.5) * 60;
      const spiral = !S.far && Math.abs(((u - y * 0.9) % 60 + 60) % 60 - 30) < 0.6;
      const worn = !S.far && y < 14 && noise(u, y, 4, 7) > 0.66 - y * 0.01;
      S.b.put(x, y, z, spiral ? (y % 7 === 0 ? P.via : P.trace) : worn ? (hash(x, y, z) < 0.5 ? P.rub2 : P.rub1) : y < 3 && !S.far && noise(u, y, 2, 3) > 0.6 ? P.moss1 : !S.far && hash(Math.floor(u), y, 12) < 0.05 ? P.p2 : P.p1);
    }
  }
  // a door, little windows up the tower, a gallery round it, the cap
  const f = { name: 'front', len: 8, at: (u, d) => [-4 + u, R0 - 1 - d], out: [0, 1] };
  doorAt(S, f, 0, 0, 8, 17, { frame: P.t1, arch: true });
  for (const [y, a] of [[24, 0.4], [40, -0.5], [52, 0.1]]) {
    const r = R0 - ((R0 - R1) * y) / H, fx = Math.round(Math.sin(a) * (r - 0.6)), fz = Math.round(Math.cos(a) * (r - 0.6));
    const glass = S.nextWin(); S.info.windows += 1;
    for (let v = 0; v < 5; v += 1) for (let k = -1; k <= 1; k += 1) { S.b.put(fx + k, y + v, fz, v === 0 || v === 4 || k !== 0 ? P.t1 : glass); }
  }
  if (!S.far) for (let a = 0; a < 48; a += 1) { const t = (a / 48) * Math.PI * 2; S.b.put(Math.round(Math.cos(t) * (R1 + 2.5)) - 1, H - 10, Math.round(Math.sin(t) * (R1 + 2.5)) - 1, P.t2); if (a % 3 === 0) S.b.put(Math.round(Math.cos(t) * (R1 + 2.5)) - 1, H - 9, Math.round(Math.sin(t) * (R1 + 2.5)) - 1, P.t1); }
  // the cap: a boat-shaped wooden hood (tinted like a roof) with a crystal finial
  for (let y = 0; y < 10; y += 1) {
    const r = R1 + 1 - y * 0.8;
    for (let z = -12; z <= 11; z += 1) for (let x = -11; x <= 10; x += 1) if (Math.hypot((x + 0.5) * 1, (z + 0.5) * 0.72) <= r && r > 0) S.b.put(x, H + y, z, y === 0 ? P.t1 : y % 2 ? P.r1 : P.r2);
  }
  S.b.put(-1, H + 10, -1, P.crys2); S.b.put(-1, H + 11, -1, P.crys1);
  S.info.hub = [-0.5, H + 3, R1 + 3]; // where the sails turn, in front of the cap
  S.info.top = H + 12;
  S.info.front = R0;
  S.info.chimneys = [];
  return S;
}
function watermill(S) {
  const [W, D] = S.size, drop = S.drop ?? 12, side = S.water || 1;
  const x0 = -W / 2, x1 = W / 2 - 1, z0 = -D / 2, z1 = D / 2 - 1;
  const wall = { x0: x0 + 2, x1: x1 - 2, z0: z0 + 2, z1: z1 - 2 };
  S.b.fill(wall.x0 - 1, -drop, wall.z0 - 1, wall.x1 + 1, -1, wall.z1 + 1, (x, y, z) => stoneWall(S, 0.1)(x + z, y + drop, { name: 'mill', len: 99 }));
  const H = 24 + 18;
  storey(S, wall, 0, H, (u, v, f) => (v < 24 ? stoneWall(S, 0.14)(u, v, f) : u <= 1 || u >= f.len - 2 || u % 5 === 0 || v === 24 || v === H - 1 ? P.t1 : P.p1));
  const ff = faceOf(wall, 'front'), L = ff.len;
  doorAt(S, ff, 3, 0, 8, 18, { frame: P.t1 });
  windowAt(S, ff, L - 9, 8, 6, 8, { frame: P.t1, barsU: [3], sill: P.s1 });
  windowAt(S, ff, (L >> 1) - 3, 29, 6, 7, { frame: P.t1, barsU: [3], sill: P.t3 });
  lantern(S, ff, 13, 11);
  const res = roof(S, { x0, x1, z0, z1 }, H, { ridge: 'x', pitch: 1.1, wall, gable: (u, v) => (u % 5 === 0 || v === 0 ? P.t1 : P.p1) });
  chimney(S, side > 0 ? wall.x0 + 1 : wall.x1 - 4, -2, H - 2, res.top + 3);
  // the axle's bearing on the river side, and a launder (a trough) that brings the water over the wheel
  const ax = side > 0 ? wall.x1 + 1 : wall.x0 - 1;
  for (let y = 6; y <= 9; y += 1) for (let z = -2; z <= 1; z += 1) S.b.put(ax, y, z, C.iron2);
  S.info.wheel = [ax + side * 4, 4, -0.5]; // the wheel's axle: out from the wall over the river
  S.info.side = side;
  S.info.top = res.top + 6;
  S.info.front = wall.z1;
  return S;
}

// ---- shops: the ground floor of a lower-town house opened up for a trade ----------------------------------------------------
// Each trade: an awning's colour, what fills the window, a glyph for the hanging sign, and a prop by the door.
export const TRADES = {
  bakery: { label: 'Bakery', awning: P.aw6, glyph: ['.....', '.###.', '#####', '#.#.#', '#####'] },
  smithy: { label: 'Smithy', awning: P.aw1, glyph: ['####.', '#####', '..#..', '.###.', '#####'] },
  apothecary: { label: 'Apothecary', awning: P.aw4, glyph: ['.###.', '..#..', '.###.', '#####', '.###.'] },
  tavern: { label: 'The Tavern', awning: P.aw2, glyph: ['####.', '#..##', '#..#.', '#..##', '####.'] },
  tailor: { label: 'Tailor', awning: P.aw5, glyph: ['#...#', '.#.#.', '..#..', '##.##', '##.##'] },
  bookbinder: { label: 'Bookbinder', awning: P.aw3, glyph: ['##.##', '#.#.#', '#.#.#', '#.#.#', '##.##'] },
  lampmaker: { label: 'Lamp-maker', awning: P.aw1, glyph: ['..#..', '.###.', '##.##', '.###.', '..#..'] },
};
export const GLYPHS = Object.fromEntries(Object.entries(TRADES).map(([k, t]) => [k, t.glyph]));
function shopFront(S, f, gr) {
  const t = S.trade, T = TRADES[t], L = f.len, du = L >= 26 ? L - 11 : 2;
  const wu0 = du > L / 2 ? 2 : 12, ww = Math.min(L - 14, 12);
  doorAt(S, f, du, 2, 8, 18, { frame: P.t1 });
  steps(S, f, du, 8, 0);
  // the shop window: wide, low sill, small panes, the wares behind the glass
  windowAt(S, f, wu0, 6, ww, 11, { frame: P.t1, barsU: [3, 7, 11].filter((q) => q < ww), barsV: [5], sill: P.t3 });
  const ware = (u, v) => { // one voxel behind the glass: what the trade shows
    const [x, z] = f.at(u, 2);
    return [x, z];
  };
  if (!S.far) for (let u = wu0; u < wu0 + ww; u += 1) for (let v = 6; v < 10; v += 1) {
    const [x, z] = ware(u, v), r = hash(u, v, 5);
    const id = t === 'bakery' ? (v === 6 ? P.t3 : v < 9 && r < 0.7 ? (r < 0.35 ? P.bread : P.crust) : 0)
      : t === 'apothecary' ? (v === 6 ? P.t3 : v < 9 && u % 2 ? [P.potG, P.potV, P.potC, P.potR][Math.floor(r * 4)] : 0)
      : t === 'tailor' ? (v < 10 ? [P.cl1, P.cl2, P.cl3, P.cl4, P.cl5, P.cl6][Math.floor((u - wu0) / 2) % 6] : 0)
      : t === 'bookbinder' ? (v < 9 ? [P.bk1, P.bk2, P.bk3, P.bk4, P.page][Math.floor(r * 5)] : 0)
      : t === 'lampmaker' ? (v === 8 && u % 3 === 0 ? [P.lamp, P.lampC, P.lampM, P.lampG][(u >> 1) % 4] : 0)
      : t === 'smithy' ? (v === 6 ? C.iron2 : v === 7 && u % 3 === 0 ? P.coal : 0)
      : t === 'tavern' ? (v === 6 ? P.t2 : v === 7 && u % 3 === 1 ? P.lamp2 : 0) : 0;
    if (id) S.b.put(x, 2 + v, z, id);
  }
  // the awning over the window: striped, on iron rods
  if (!S.far) for (let u = wu0 - 1; u <= wu0 + ww; u += 1) for (let d = 1; d <= 4; d += 1) put(S, f, u, 18 - Math.floor(d * 0.6), -d, d === 4 ? P.t1 : (u >> 1) % 2 ? T.awning : P.aw1);
  // the sign's iron bracket, out over the street (the board hangs from it: its own part)
  const su = du > L / 2 ? du + 9 : du - 2;
  if (!S.far) { for (let d = 1; d <= 7; d += 1) put(S, f, su, 21, -d, C.iron2); put(S, f, su, 20, -1, C.iron2); put(S, f, su, 19, -1, C.iron1); for (let d = 2; d <= 4; d += 1) put(S, f, su, 20 - (d - 2), -d + 1, C.iron1); }
  const [sx, sz] = f.at(su, -6);
  S.info.sign = [sx, 21, sz];
  // a lantern by the door that stays lit through the night
  const lu = du > L / 2 ? du - 3 : du + 10;
  lantern(S, f, lu, 12);
  S.info.lantern = [...f.at(lu, -2)];
  // the trade at the door
  if (!S.far) {
    const [px, pz] = f.at(du > L / 2 ? du - 3 : du + 10, -2);
    if (t === 'bakery') S.b.fill(px - 1, 0, pz - 1, px + 1, 3, pz + 1, (x, y) => (y === 3 ? P.flour : P.sack)); // a sack of flour
    if (t === 'tavern') for (let y = 0; y < 6; y += 1) for (let a = 0; a < 12; a += 1) S.b.put(px + Math.round(Math.cos(a) * 1.6), y, pz + Math.round(Math.sin(a) * 1.6), y === 1 || y === 4 ? C.iron2 : P.t3); // a barrel
    if (t === 'smithy') { S.b.fill(px - 2, 0, pz, px + 2, 3, pz, C.iron2); S.b.fill(px - 3, 4, pz, px + 3, 5, pz, C.iron1); S.b.put(px + 3, 6, pz, C.iron3); } // an anvil
    if (t === 'apothecary') for (let y = 0; y < 5; y += 1) S.b.put(px, y, pz, y < 2 ? P.clay : y < 4 ? P.lf2 : P.fv); // a potted herb
    if (t === 'lampmaker') for (let k = 0; k < 4; k += 1) { S.b.put(px - 2 + k * 2, 13, pz, C.iron1); S.b.put(px - 2 + k * 2, 12, pz, [P.lamp, P.lampC, P.lampM, P.lampG][k]); S.b.put(px - 2 + k * 2, 11, pz, C.iron1); }
    if (t === 'bookbinder') S.b.fill(px - 1, 0, pz, px + 1, 2, pz, (x, y) => [P.bk1, P.bk2, P.bk3][y]);
    if (t === 'tailor') { S.b.fill(px, 0, pz, px, 9, pz, (x, y) => (y < 2 ? C.iron2 : y < 5 ? P.t2 : P.cl1)); S.b.fill(px - 1, 6, pz, px + 1, 8, pz, P.cl1); }
  }
  // a smithy's forge glows in the doorway, a bakery's oven in its window
  if (t === 'smithy' || t === 'bakery') { const [x, z] = f.at(t === 'smithy' ? du + 3 : wu0 + (ww >> 1), 3); S.b.fill(x - 1, 3, z, x + 1, 5, z, (xx, y) => (y === 4 ? P.hot : P.ember)); S.info.oven = [x, 4, z]; }
  return { door: du };
}

// ---- the one door into it all -------------------------------------------------------------------------------------------------
export function design(spec) {
  const kind = spec.kind === 'pier' || spec.kind === 'master' ? 'pier' : spec.kind || 'house';
  const [W, D] = spec.size, drop = spec.drop ?? 0;
  const hi = kind === 'windmill' ? 90 : 24 + 21 * 2 + 36 + 16;
  const S = ctx(spec, [[-W / 2 - 2, -Math.max(drop, kind === 'pier' ? 17 : 0), -D / 2 - 6], [W / 2 + 1, hi, D / 2 + 4]]);
  if (spec.trade) S.shopFront = shopFront;
  if (kind === 'pier') pier(S);
  else if (kind === 'farm' || kind === 'barn') farm(S);
  else if (kind === 'windmill') windmill(S);
  else if (kind === 'watermill') watermill(S);
  else if (spec.zone === 'upper') upper(S);
  else lower(S);
  return { b: S.b, info: S.info };
}

// A self-check: node js/models/house_build.js (every design builds, has a door and a window, and stays in its lot)
if (typeof window === 'undefined' && typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const specs = [];
  for (const zone of ['lower', 'upper']) for (const size of [[20, 26], [24, 30], [28, 32], [32, 34], [30, 22], [22, 20]]) specs.push({ zone, size, storeys: 2 });
  for (const size of [[22, 32], [26, 34], [30, 36]]) specs.push({ kind: 'pier', zone: 'harbour', size, storeys: size[0] === 22 ? 3 : size[0] === 26 ? 1 : 2 });
  specs.push({ kind: 'master', zone: 'harbour', size: [26, 34], storeys: 2 }, { kind: 'farm', size: [30, 20], drop: 12 }, { kind: 'barn', size: [34, 20], drop: 12 }, { kind: 'windmill', size: [22, 22], drop: 12 }, { kind: 'watermill', size: [26, 20], drop: 12, water: 1 });
  for (const t of Object.keys(TRADES)) specs.push({ zone: 'lower', size: [28, 32], storeys: 2, trade: t });
  const t0 = Date.now();
  for (const s of specs) for (const far of [false, true]) {
    const { b, info } = design({ seed: 3, ...s, far });
    if (!info.door && s.kind !== 'windmill') throw new Error(`${JSON.stringify(s)}: no door`);
    let n = 0; for (const v of b.g.data) if (v) n += 1;
    if (!n) throw new Error('empty');
  }
  console.log(`house_build.js ok: ${specs.length} designs, near and far, in ${Date.now() - t0} ms`);
}
