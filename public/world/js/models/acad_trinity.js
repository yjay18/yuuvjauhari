// The Academy's Trinity College group (colours acad_), after Trinity College Dublin's Front Square.
//   campanile()  the free-standing bell tower: stepped granite piers, a big round arch right through its
//                base on all four faces between paired columns, an entablature whose frieze runs with gold
//                circuit light, a balustrade with a statue at each corner (one of them dressed for graduation
//                in a hoodie and a mortarboard), an open belfry on paired columns where a glowing bell hangs,
//                a ribbed stone dome with a thread of gold light up each rib, and a lantern with a turning
//                crystal. Coursed granite, circuit light in the mortar. The bell sways at rest; ctx.ring() rings it: a hard swing, the clapper lagging,
//                two ripples of light rolling out round the belfry and motes falling.
//   range()      a short, low granite range behind it: rusticated ground storey, sash windows (lit at night,
//                one with a monitor's cyan), a balustrade, a slate roof with chimneys, and a pedimented gate
//                tower in the middle for the path from the bridge, a lantern swaying in its passage.
// Model voxels, origin at the base centre, front +z. CAMPANILE and RANGE give the sizes the district needs.
import { C, colour, hash, noise } from '../kit/voxel-kit.js';
import { box, tone, smooth } from './space.js';

const col = (n, hex, glow = false) => C[n] ?? colour(n, hex, glow);
for (const [n, hex, glow] of [
  ['g1', 0xc4c1b9], ['g2', 0xb1aea6], ['g3', 0x9e9b93], ['g4', 0x8b8881], ['g5', 0x77746e], ['gm', 0x3d3b39], ['gj', 0x6a6761],
  ['d1', 0xdcd7cc], ['d2', 0xcac5b9], ['damp', 0x6c6a63], ['lich1', 0x8f9a62],
  ['trace', 0x1fd2ea, true], ['via', 0xb6fbff, true], ['au1', 0xfff0b8, true], ['au2', 0xffc764, true], ['au3', 0xd9922e, true],
  ['sl1', 0x3a404d], ['sl2', 0x464d5c], ['sl3', 0x30353f], ['moss', 0x55703a],
  ['m1', 0xe8e4da], ['m2', 0xd8d3c7], ['m3', 0xc5bfb2], ['m4', 0x9f998d],
  ['hood1', 0x1b1a20], ['hood2', 0x26252d], ['hood3', 0x34323c], ['string', 0xeee2c4], ['board', 0x17181f], ['board2', 0x2a2c40],
  ['tassel', 0xf2c24a], ['tassel2', 0xb8891f], ['globe1', 0xd8fdff, true], ['globe2', 0x6ff2ff, true], ['globe3', 0x2aa8d0, true],
  ['page', 0xf2ead6], ['page2', 0xdcd0b2], ['ink', 0x4a4038], ['ribbon', 0xb3322a],
  ['sash', 0xefebe2], ['sash2', 0xd6d1c6], ['pane', 0x1c2331], ['pane2', 0x2a3446], ['lit1', 0xffc764, true], ['lit2', 0xffe6a8, true], ['mon', 0x7ff0ff, true],
  ['crys1', 0xe6fdff, true], ['crys2', 0x6ff2ff, true], ['crys3', 0xa98bff, true], ['clay', 0x9a5a3c], ['soot', 0x3a3634], ['ember', 0xff9a3c, true],
]) col(`acad_${n}`, hex, glow);
const K = (n) => C[`acad_${n}`];
const STONE = [K('g1'), K('g2'), K('g2'), K('g3'), K('g3'), K('g4')];
const DRESSED = [K('d1'), K('d1'), K('d2')];

// Four faces round a square of half-width H (x, z in -H..H-1). Face k: u runs left to right seen from
// outside (-H..H-1), d counts voxels inward from the outer skin (negative: proud of it).
const FACES = [
  (u, d, H) => [u, H - 1 - d], // front, +z
  (u, d, H) => [H - 1 - d, -1 - u], // right, +x
  (u, d, H) => [-1 - u, -H + d], // back, -z
  (u, d, H) => [-H + d, u], // left, -x
];
function round(H, d0, d1, over, fn) {
  for (let k = 0; k < 4; k += 1) for (let u = -H - over; u <= H - 1 + over; u += 1) for (let d = d0; d <= d1; d += 1) { const [x, z] = FACES[k](u, d, H); fn(k, u, d, x, z); }
}
// An arch's opening across a face: `half` voxels either side of the axis, straight up to `spring`, a semicircle over it.
const archOpen = (u, y, half, spring) => Math.abs(u + 0.5) <= half && (y < spring || (u + 0.5) ** 2 + (y + 0.5 - spring) ** 2 <= half * half);
// Coursed granite: courses of three (two of stone, a bed joint), blocks w long and offset every other course;
// runs of the joints carry circuit light, with a brighter via where a run ends.
const lit = (c, a, s, dens) => hash(c * 13 + s * 101, Math.floor((a + c * 7 + 400) / 6), 17) < dens;
function ashlar(a, y, { y0 = 0, w = 6, dens = 0.2, s = 0 } = {}) {
  const row = y - y0, c = Math.floor(row / 3);
  if (row % 3 === 2) return lit(c, a, s, dens) ? ((a + c * 7 + 400) % 6 === 5 ? K('via') : K('trace')) : K('gj');
  const seg = a + 400 + (c % 2) * 3;
  if (seg % w === 0) return lit(c, a, s, dens) && lit(c - 1, a, s, dens) ? K('trace') : K('gj');
  const t = Math.floor(hash(Math.floor(seg / w), c, s + 7) * STONE.length);
  if (y < y0 + 4 && noise(a, y * 3, 3.5, s) > 0.62) return hash(a, y, s) < 0.5 ? K('damp') : K('g5'); // damp at the foot
  return hash(a, y, s + 3) < 0.08 ? STONE[Math.min(STONE.length - 1, t + 1)] : STONE[t];
}
// A voussoir ring round an arch: dressed blocks (every other one a shade darker), mortar joints radiating.
function voussoir(u, y, spring, r0, r1, n) {
  const r = Math.hypot(u + 0.5, y + 0.5 - spring);
  if (y < spring || r <= r0 || r > r1) return 0;
  const seg = (Math.atan2(y + 0.5 - spring, u + 0.5) / Math.PI) * n;
  return seg - Math.floor(seg) < 0.14 ? K('gm') : Math.floor(seg) % 2 ? K('d1') : K('d2');
}
// A frieze of gold circuitry: a trace along the band, square pads every so often.
const frieze = (u, y, y0, k) => {
  const a = u + 40 + k * 5;
  if (a % 10 === 0) return y === y0 ? K('au1') : K('au2');
  if (y === y0) return hash(Math.floor(a / 3), k, 5) < 0.5 ? K('au3') : K('d2');
  return a % 10 === 5 ? K('gj') : K('d2');
};

// ---------------------------------------------------------------------------------------------
// The Campanile: x, z -19..18 at its steps (the axis between voxels -1 and 0), 93 high at the finial.
const H1 = 15, H2 = 16, H3 = 10; // the arch stage, the deck, the belfry: half-widths
const BELL_Y = 58; // the bell hangs from here
export const CAMPANILE = { piers: 19, gap: 8, top: 95, bellY: 53, lanternY: 85 };

// A statue on a corner pedestal (x0, z0 its 5 x 5 corner), 15 high from y 47, facing out (dir +1: +z, -1: -z).
function statue(b, x0, z0, dir, kind) {
  const P = (x, y, z, id) => { if (id) b.put(x0 + 2 + dir * x, 47 + y, z0 + 2 + dir * z, id); };
  const M = (x, y, z) => (hash(x + x0, y, z + z0) < 0.1 ? K('m3') : (x + 5) % 2 && y < 7 ? K('m2') : K('m1')); // pale stone, drapery folds
  const student = kind === 'student';
  const H = (x, y, z) => ((x + y + z) % 3 === 0 ? K('hood2') : hash(x, y, z + 9) < 0.2 ? K('hood3') : K('hood1'));
  // the robe: a rounded hem, folds falling to it
  for (let y = 0; y <= 6; y += 1) for (let z = -2; z <= 2; z += 1) for (let x = -2; x <= 2; x += 1) {
    if (Math.abs(z) === 2 && (y > 1 || Math.abs(x) === 2)) continue;
    P(x, y, z, y === 0 && hash(x, z + x0, 3) < 0.35 ? K('m4') : M(x, y, z));
  }
  // the torso, arms at its sides, shoulders
  for (let y = 7; y <= 10; y += 1) for (let z = -1; z <= 1; z += 1) for (let x = -1; x <= 1; x += 1) P(x, y, z, student ? H(x, y, z) : M(x, y, z));
  for (const x of [-2, 2]) P(x, 10, 0, student ? H(x, 10, 0) : M(x, 10, 0));
  // the head: a rounded block, eyes in shadow
  for (let y = 11; y <= 13; y += 1) for (let z = -1; z <= 1; z += 1) for (let x = -1; x <= 1; x += 1) {
    if (Math.abs(x) + Math.abs(z) + Math.abs(y - 12) === 3) continue;
    P(x, y, z, z === 1 && y === 12 && x !== 0 ? K('m4') : student && (y === 13 || z === -1) ? K('board') : y === 13 ? K('m2') : K('m1'));
  }
  const arm = (x, y0, y1, z = 0) => { for (let y = y0; y <= y1; y += 1) P(x, y, z, student ? H(x, y, z) : M(x, y, z)); };
  if (kind === 'book') { // Divinity: an open book held at the breast
    arm(-2, 8, 9); arm(2, 8, 9); P(-2, 7, 1, M(-2, 7, 1)); P(2, 7, 1, M(2, 7, 1));
    for (let x = -2; x <= 2; x += 1) { P(x, 7, 2, x === 0 ? K('ink') : K('page')); P(x, 8, 2, Math.abs(x) === 2 ? 0 : x === 0 ? K('page2') : K('page')); }
  } else if (kind === 'globe') { // Science: a glowing globe held up on the palm
    arm(-2, 7, 9); arm(2, 8, 9); P(2, 8, 1, M(2, 8, 1));
    for (const [x, y, z, id] of [[2, 9, 2, 'globe2'], [2, 10, 2, 'globe1'], [1, 9, 2, 'globe3'], [3, 9, 2, 'globe3'], [2, 9, 3, 'globe2'], [2, 11, 2, 'globe3']]) P(x, y, z, K(id));
  } else if (kind === 'staff') { // Medicine: a staff with a gold light at its head
    arm(2, 7, 9); arm(-2, 8, 9); P(-2, 8, 1, M(-2, 8, 1));
    for (let y = 0; y <= 15; y += 1) P(-2, y, 2, y === 15 ? K('au2') : y === 14 ? K('au1') : y % 4 === 0 ? C.brass2 : K('m3'));
  } else { // the joke: dressed for graduation, a black hoodie with its drawstrings, a mortarboard, a diploma raised in a cheer
    for (const x of [-1, 1]) { P(x, 9, 1, K('string')); P(x, 8, 1, K('string')); } // drawstrings
    for (let x = -1; x <= 1; x += 1) { P(x, 7, 1, K('hood3')); P(x, 10, -2, K('hood3')); P(x, 11, -2, K('hood2')); } // the pocket's edge, the hood behind the neck
    arm(-2, 7, 9); P(-2, 6, 0, K('m1')); // left sleeve, a stone hand
    for (let y = 10; y <= 15; y += 1) P(2, y, 0, y === 15 ? K('m1') : H(2, y, 0)); // right arm up past the cap
    for (let z = -2; z <= 2; z += 1) P(2, 16, z, z === 0 ? K('ribbon') : Math.abs(z) === 2 ? K('page2') : K('page')); // the diploma, held high
    for (let z = -2; z <= 2; z += 1) for (let x = -2; x <= 2; x += 1) P(x, 14, z, x === 2 && z === 0 ? 0 : Math.abs(x) === 2 || Math.abs(z) === 2 ? K('board2') : K('board'));
    P(0, 15, 0, K('tassel2')); P(-1, 14, 1, K('tassel')); // the button, the cord to the corner (the tassel swings: a part)
  }
}

function tower() {
  const b = box([-19, 0, -19], [18, 95, 18]);
  // ---- three steps round the corner piers (the passages run through at ground level)
  for (let y = 0; y <= 2; y += 1) {
    const e = H1 + 3 - y;
    for (let z = -e; z < e; z += 1) for (let x = -e; x < e; x += 1) {
      if (Math.abs(x + 0.5) <= 9.5 || Math.abs(z + 0.5) <= 9.5) continue;
      const edge = Math.max(Math.abs(x + 0.5), Math.abs(z + 0.5)) > e - 1;
      b.put(x, y, z, edge && (x + z + y) % 5 === 0 ? K('gm') : edge ? tone([K('d2'), K('g2'), K('d1')], x, y, z, 1) : K('g3'));
    }
  }
  // ---- the arch stage: four piers joined over arches that cross under the tower
  for (let y = 0; y <= 34; y += 1) for (let z = -H1; z < H1; z += 1) for (let x = -H1; x < H1; x += 1) {
    if (archOpen(x, y, 8, 24) || archOpen(z, y, 8, 24)) continue;
    b.put(x, y, z, ashlar(x + z, y, { s: 1 }));
  }
  // rustication: the piers' bed joints cut back a voxel, the light running in the grooves
  round(H1, 0, 0, 0, (k, u, d, x, z) => { for (let y = 2; y <= 20; y += 3) if (!archOpen(u, y, 8, 24)) b.cut(x, y, z); });
  // the arch faces: voussoirs, quoined jambs, a keystone with a gold rune; the springing marked inside
  round(H1, 0, 0, 0, (k, u, d, x, z) => {
    for (let y = 0; y <= 34; y += 1) {
      const v = voussoir(u, y, 24, 8, 11.5, 11);
      if (v) { b.put(x, y, z, v); continue; }
      const jamb = (u === -9 || u === 8) || ((u === -10 || u === 9) && Math.floor(y / 3) % 2);
      if (jamb && y < 24 && y % 3 !== 2) b.put(x, y, z, Math.floor(y / 3) % 2 ? K('d1') : K('d2'));
    }
    for (let y = 31; y <= 35; y += 1) for (let uu = -2; uu <= 1; uu += 1) {
      if (y < 34 && (uu === -2 || uu === 1)) continue;
      const [kx, kz] = FACES[k](uu, -1, H1);
      const rune = (uu === -1 || uu === 0) && (y === 32 || y === 33);
      b.put(kx, y, kz, rune ? (y === 33 ? K('au1') : K('au2')) : K('d1'));
      const [bx, bz] = FACES[k](uu, 0, H1); b.put(bx, y, bz, K('d2'));
    }
  });
  for (let a = -8; a <= 7; a += 1) for (const y of [23, 24]) for (const w of [-9, 8]) { b.put(w, y, a, K('d1')); b.put(a, y, w, K('d1')); } // imposts inside
  // under the crossing: a gold rune ring in the vault
  for (let z = -8; z <= 7; z += 1) for (let x = -8; x <= 7; x += 1) { const r = Math.hypot(x + 0.5, z + 0.5); if (r > 4.2 && r <= 5.3) b.put(x, 33, z, (x + z) % 3 ? K('au2') : K('au1')); else if (r <= 5.3) b.put(x, 34, z, K('gm')); }
  // paired columns on every face: a base, drums of dressed granite, capitals with gold leaves
  for (let k = 0; k < 4; k += 1) for (const c0 of [-14, -11, 9, 12]) for (let y = 0; y <= 34; y += 1) for (let du = -1; du <= 2; du += 1) for (let d = -3; d <= 0; d += 1) {
    const core = du >= 0 && du <= 1 && d >= -2 && d <= -1;
    const wide = y <= 1 || y >= 32;
    if (!core && !wide) continue;
    const [x, z] = FACES[k](c0 + du, d, H1);
    let id;
    if (y <= 1) id = y === 0 ? K('g4') : K('d2');
    else if (y >= 32) id = y === 33 && !core && (du === -1 || du === 2) && d === -3 ? K('au2') : y === 34 ? K('d2') : K('d1');
    else if (y === 2 || y === 31) id = K('d2');
    else id = (y - 2) % 5 === 0 ? K('d2') : hash(x, y, z) < 0.1 ? K('g1') : K('d1');
    b.put(x, y, z, id);
  }
  // ---- the entablature: architrave, a frieze of gold circuitry, dentils, a cornice with lights along its lip
  const band = (H, y0, fn) => round(H, -4, 0, 4, (k, u, d, x, z) => {
    for (let i = 0; i < 7; i += 1) {
      const y = y0 + i, p = i <= 3 ? 3 : 4;
      if (d < -p || u < -H - p || u > H - 1 + p) continue;
      const id = fn(k, u, d, i, p, y);
      if (id) b.put(x, y, z, id);
    }
  });
  const entab = (k, u, d, i, p, y) => {
    if (i <= 1) return i === 1 && d === -p ? K('d2') : K('d1');
    if (i <= 3) return d === -p ? frieze(u, y, y - (i - 2), k) : K('d2');
    if (i === 4) return d === -p ? ((u + 40) % 2 ? K('d1') : 0) : K('d2');
    if (i === 5) return K('d1');
    return d === -p && lights && (u + 41) % lights === 0 ? K('au2') : K('d1');
  };
  let lights = 0;
  band(H1, 35, entab);
  // ---- the deck, its balustrade, a pedestal and a statue at each corner
  b.fill(-H2, 42, -H2, H2 - 1, 42, H2 - 1, (x, y, z) => ((x + 40) % 5 === 0 || (z + 40) % 5 === 0 ? K('gm') : tone([K('g2'), K('g3'), K('g1')], Math.floor(x / 5), 42, Math.floor(z / 5), 3)));
  round(H2, 0, 0, 0, (k, u, d, x, z) => {
    b.put(x, 43, z, K('d2'));
    if ((u + 40) % 2 === 0) { b.put(x, 44, z, K('d1')); b.put(x, 45, z, hash(x, z, 3) < 0.15 ? K('lich1') : K('d1')); }
    b.put(x, 46, z, K('d1'));
  });
  for (const [x0, z0, dir, kind] of [[-19, 14, 1, 'staff'], [14, 14, 1, 'student'], [-19, -19, -1, 'book'], [14, -19, -1, 'globe']]) {
    b.fill(x0, 42, z0, x0 + 4, 46, z0 + 4, (x, y, z) => (y === 42 ? K('g4') : y === 46 ? K('d1') : y === 45 ? K('d2') : tone(DRESSED, x, y, z, 4)));
    statue(b, x0, z0, dir, kind);
  }
  // ---- the belfry: four piers round an open chamber, an arch in every face over a low sill
  round(H3, 0, 1, 0, (k, u, d, x, z) => {
    for (let y = 43; y <= 60; y += 1) {
      if (y >= 47 && archOpen(u, y, 5, 55)) continue;
      const v = y >= 55 && d === 0 ? voussoir(u, y, 55, 5, 7.2, 7) : 0;
      b.put(x, y, z, v || (y === 46 && Math.abs(u + 0.5) <= 5 ? K('d1') : ashlar(x + z, y, { y0: 43, s: 2, dens: 0.1, w: 5 })));
    }
    for (let y = 60; y <= 62; y += 1) for (const uu of [-1, 0]) { const [kx, kz] = FACES[k](uu, -1, H3); b.put(kx, y, kz, y === 61 ? K('au1') : K('d1')); } // keystones
  });
  for (let k = 0; k < 4; k += 1) for (const c0 of [-10, -7, 5, 8]) for (let y = 43; y <= 60; y += 1) for (let du = -1; du <= 2; du += 1) for (let d = -3; d <= 0; d += 1) {
    const core = du >= 0 && du <= 1 && d >= -2 && d <= -1;
    const wide = y === 43 || y >= 59;
    if (!core && !wide) continue;
    if ((c0 === -10 && du < 0) || (c0 === 8 && du > 1)) continue; // not past the corner
    const [x, z] = FACES[k](c0 + du, d, H3);
    b.put(x, y, z, y >= 59 ? (y === 59 && !core && d === -3 ? K('au2') : K('d1')) : y === 43 ? K('d2') : (y - 44) % 5 === 0 ? K('d2') : K('d1'));
  }
  // the chamber's ceiling: dark timbers, a ring of gold runes; the beam the bell hangs from
  b.fill(-9, 61, -9, 8, 67, 8, (x, y, z) => { if (y > 61) return K('gm'); const r = Math.hypot(x + 0.5, z + 0.5); return r > 5 && r <= 6.1 ? ((x * 3 + z) % 4 ? K('au2') : K('au1')) : (x + 40) % 3 === 0 ? C.wood2 : C.wood1; });
  b.fill(-8, 59, -1, 7, 60, 0, (x) => (Math.abs(x + 0.5) < 2 ? C.iron2 : (x + 40) % 4 === 0 ? C.brass2 : C.wood1));
  band(H3, 61, entab);
  // ---- the attic, a drum with glowing oculi, the ribbed lead dome
  round(9, 0, 1, 0, (k, u, d, x, z) => { for (let y = 68; y <= 69; y += 1) b.put(x, y, z, y === 69 ? K('d2') : tone(DRESSED, x, y, z, 5)); });
  b.fill(-8, 68, -8, 7, 69, 7, (x, y, z) => (b.at(x, y, z) ? b.at(x, y, z) : K('gm')));
  for (let y = 70; y <= 72; y += 1) for (let z = -9; z <= 8; z += 1) for (let x = -9; x <= 8; x += 1) {
    const r = Math.hypot(x + 0.5, z + 0.5);
    if (r > 8.3) continue;
    const a = (Math.atan2(z + 0.5, x + 0.5) / (Math.PI * 2)) * 8 + 8.5;
    const oc = y === 71 && r > 7.2 && Math.abs((a % 1) - 0.5) < 0.12;
    b.put(x, y, z, oc ? K('au2') : y === 72 ? K('d1') : r > 7.2 ? tone(DRESSED, x, y, z, 6) : K('gm'));
  }
  // the dome: a tall ellipsoid shell, eight dressed ribs, the granite between them paler toward the top
  for (let y = 73; y <= 82; y += 1) for (let z = -10; z <= 9; z += 1) for (let x = -10; x <= 9; x += 1) {
    const rho = Math.hypot(x + 0.5, z + 0.5), t = (y + 0.5 - 72.5) / 9.6, R = 8.9 * Math.sqrt(Math.max(0, 1 - t * t));
    if (rho > R || rho < R - 1.8) continue;
    const a = (Math.atan2(z + 0.5, x + 0.5) / (Math.PI * 2)) * 8 + 8;
    const off = Math.abs((a % 1) - 0.5) * ((Math.PI * 2 * Math.max(rho, 1)) / 8), rib = off < 0.72 + t * 0.5;
    const shade = t > 0.62 ? [K('g1'), K('d2')] : t > 0.3 ? [K('g1'), K('g2')] : [K('g2'), K('g3')];
    const inlay = off < 0.5 && rho > R - 0.9 && y > 73; // a thread of gold light up each rib
    b.put(x, y, z, inlay ? K('au3') : rib ? K('d1') : tone(shade, Math.floor(x / 2), y, Math.floor(z / 2), 7));
  }
  // the lantern: a ring of posts round the crystal, a cap, a brass ball, a crystal spike
  for (let y = 81; y <= 88; y += 1) for (let z = -4; z <= 3; z += 1) for (let x = -4; x <= 3; x += 1) {
    const r = Math.hypot(x + 0.5, z + 0.5);
    if (y <= 82) { if (r <= 4) b.put(x, y, z, y === 82 ? K('d1') : K('d2')); continue; }
    if (r > 3.6 || r < 2.3) continue;
    const post = Math.abs(x + 0.5) > 2.4 && Math.abs(z + 0.5) > 2.4;
    if (y >= 88 || post || y === 83) b.put(x, y, z, y === 88 ? K('d1') : K('d2'));
  }
  for (let y = 89; y <= 90; y += 1) b.fill(-3, y, -3, 2, y, 2, (x, yy, z) => (Math.hypot(x + 0.5, z + 0.5) <= (y === 89 ? 3.2 : 2.2) ? (y === 89 ? K('d2') : K('d1')) : 0));
  b.fill(-1, 91, -1, 0, 92, 0, C.brass2);
  b.fill(-1, 93, -1, -1, 95, -1, (x, y) => (y === 95 ? K('crys1') : K('crys2')));
  return b;
}
function bellParts() {
  const bell = box([-5, 48, -5], [4, BELL_Y, 4]);
  const R = [4.3, 4.1, 3.7, 3.3, 3.1, 3.0, 2.9, 2.5, 1.7]; // lip (y 49) to crown (y 57)
  for (let y = 49; y <= 57; y += 1) for (let z = -5; z <= 4; z += 1) for (let x = -5; x <= 4; x += 1) {
    const r = Math.hypot(x + 0.5, z + 0.5), R0 = R[y - 49];
    if (r > R0 || (r <= R0 - 1.3 && y < 56)) continue;
    bell.put(x, y, z, y <= 50 ? K('au1') : y === 53 ? ((x + z) % 2 ? K('au3') : K('au1')) : r > R0 - 0.6 && hash(x, y, z) < 0.25 ? K('au3') : K('au2'));
  }
  bell.fill(-1, 57, -1, 0, BELL_Y, 0, C.iron2);
  const clapper = box([-1, 46, -1], [0, 56, 0]);
  clapper.fill(-1, 49, -1, -1, 56, -1, C.iron3);
  clapper.fill(-1, 47, -1, 0, 48, 0, C.iron1);
  // two ripples of light, flat rings round the belfry (scaled out and faded when the bell rings)
  const ripple = (i) => {
    const r = box([-12, 53, -12], [11, 53, 11]);
    for (let z = -12; z <= 11; z += 1) for (let x = -12; x <= 11; x += 1) { const d = Math.hypot(x + 0.5, z + 0.5); if (d > 10.6 && d <= 11.6) r.put(x, 53, z, (x + z + i) % 3 ? K('au2') : K('au1')); }
    return r.part(`ripple${i}`, [0, 53.5, 0]);
  };
  const crystal = box([-2, 83, -2], [1, 87, 1]);
  crystal.put(-1, 83, -1, K('crys3')); crystal.put(-1, 87, -1, K('crys1'));
  for (let y = 84; y <= 86; y += 1) { crystal.put(-1, y, -1, K('crys1')); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (y === 85 || (dx + dz) % 2) crystal.put(-1 + dx, y, -1 + dz, (dx + y) % 2 ? K('crys2') : K('crys3')); }
  // the student statue's tassel, on the mortarboard's corner
  const tassel = box([14, 55, 18], [14, 60, 18]);
  tassel.fill(14, 58, 18, 14, 60, 18, K('tassel'));
  tassel.fill(14, 55, 18, 14, 57, 18, (x, y) => (y === 57 ? K('tassel2') : K('tassel')));
  const B = bell.part('bell', [0, BELL_Y, 0]);
  return { bell: B, clapper: clapper.part('clapper', [0, 56, 0], bell), ripple0: ripple(0), ripple1: ripple(1), crystal: crystal.part('crystal', [-0.5, 85.5, -0.5]), tassel: tassel.part('tassel', [14.5, 61, 18.5]) };
}

let towerBuilt = null;
export function campanile() {
  return {
    gait: 'still',
    build() { towerBuilt ??= { parts: { tower: tower().part('tower', [0, 0, 0]), ...bellParts() } }; return towerBuilt; },
    setup(ctx) {
      const { mem, state, parts, THREE } = ctx;
      mem.rungAt = -100;
      ctx.ring = () => { mem.rungAt = state.t; mem.motes = 0; };
      // the ripples are a haze of light: each its own see-through material
      mem.fade = ['ripple0', 'ripple1'].map((n) => {
        const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
        parts[n].traverse((o) => { if (o.isMesh) { o.material = m; o.castShadow = false; } });
        return m;
      });
    },
    idle(ctx) {
      const { parts: P, state: { t }, mem } = ctx;
      const u = t - mem.rungAt;
      // the bell: a slow sway at rest; rung, it swings hard and settles, the clapper lagging behind
      const ring = u >= 0 && u < 5 ? 0.42 * Math.exp(-0.9 * u) * Math.sin(4.4 * u) : 0;
      P.bell.rotation.z += 0.045 * Math.sin(t * 1.3) + ring;
      P.clapper.rotation.z += -0.6 * (u >= 0 && u < 5 ? 0.42 * Math.exp(-0.9 * u) * Math.sin(4.4 * u - 0.8) : 0.045 * Math.sin(t * 1.3 - 0.8)) - (P.bell.rotation.z * 0.7);
      P.bell.scale.setScalar(1 + (u >= 0 && u < 1.2 ? 0.05 * Math.exp(-3 * u) * Math.sin(u * 40) : 0)); // it shivers as it strikes
      mem.fade.forEach((m, i) => {
        const v = (u - i * 0.35) / 1.5;
        const on = v >= 0 && v < 1;
        P[`ripple${i}`].scale.setScalar(on ? 0.9 + 2.6 * smooth(v) : 0);
        P[`ripple${i}`].position.y += on ? -2 * v : 0;
        m.opacity = on ? 0.95 * (1 - v) ** 1.5 : 0;
      });
      if (u >= 0 && u < 2.4 && (mem.motes ?? 9) < 3 && u > mem.motes * 0.5) { // motes of light fall from the belfry, three times
        mem.motes += 1;
        ctx.burst({ x: 0, y: CAMPANILE.bellY * ctx.voxel, z: 0 }, 22, 2.2, [0xfff0b8, 0xd9922e], 0.07, 1.4);
      }
      // the lantern's crystal turns and breathes; the student's tassel swings
      P.crystal.rotation.y += t * 0.9;
      P.crystal.position.y += Math.sin(t * 1.6) * 0.3;
      P.crystal.scale.setScalar(1 + 0.08 * Math.sin(t * 4.1));
      P.tassel.rotation.x += 0.22 * Math.sin(t * 1.9) + 0.08 * Math.sin(t * 4.3);
      P.tassel.rotation.z += 0.12 * Math.sin(t * 1.3 + 1) + (u >= 0 && u < 3 ? 0.4 * Math.exp(-u) * Math.sin(u * 9) : 0);
    },
    act(ctx) { ctx.ring(); },
  };
}

// ---------------------------------------------------------------------------------------------
// The range: x -33..32, z -9..8 at the gate tower; 47 high at its pediment.
export const RANGE = { half: 29, gate: 6, deep: 9 };
function sash(b, x0, y0, h, z, out, seed) { // a sash window 5 wide on the face z (out: +1 front, -1 back)
  const r = hash(x0, y0, seed), room = r < 0.3 ? 'dark' : r < 0.38 ? 'mon' : 'lit';
  for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + 5; x += 1) {
    const edge = x === x0 || x === x0 + 4 || y === y0 || y === y0 + h - 1, rail = y === y0 + Math.floor(h / 2);
    if (edge || rail) { b.put(x, y, z, edge ? K('sash') : K('sash2')); continue; }
    b.cut(x, y, z);
    const pane = room === 'dark' ? ((x + y) % 3 ? K('pane') : K('pane2')) : room === 'mon' && y < y0 + h / 2 ? K('mon') : (x + y) % 4 === 0 ? K('lit2') : K('lit1');
    b.put(x, y, z - out, pane);
  }
  b.fill(x0 - 1, y0 - 1, z + out, x0 + 5, y0 - 1, z + out, K('d1')); // sill
  b.fill(x0 - 1, y0 + h, z, x0 + 5, y0 + h, z, (x) => (x === x0 + 2 ? K('d1') : K('d2'))); // a flat arch over it
}
function rangeGrid() {
  const b = box([-30, 0, -10], [29, 47, 9]);
  const pav = (x) => x >= -11 && x <= 10;
  const gate = (x, y) => archOpen(x, y, 6, 26);
  // ---- the mass: wings two storeys high, the gate tower higher, a passage through it
  for (let y = 0; y <= 36; y += 1) for (let z = -9; z <= 8; z += 1) for (let x = -29; x <= 28; x += 1) {
    const p = pav(x);
    if (!p && (z < -6 || z > 5 || y > 32)) continue;
    if (p && gate(x, y)) continue;
    let id;
    if (y <= 1) id = tone([K('g4'), K('g5'), K('g4')], Math.floor(x / 4), y, z, 8);
    else if (y === 17 && !p) id = K('d1');
    else if (y <= 16 || p) id = ashlar(x + z, y, { y0: 2, w: 7, s: 4, dens: 0.14 });
    else id = y >= 31 ? (y === 32 ? K('d1') : K('d2')) : ashlar(x + z, y, { y0: 18, w: 5, s: 5, dens: 0.08 });
    b.put(x, y, z, id);
  }
  b.fill(-30, 0, -7, 29, 0, 6, (x, y, z) => (b.at(x, y, z) || (!pav(x) && (z === -7 || z === 6 || x === -30 || x === 29) ? K('g5') : 0))); // plinth, proud
  for (const z of [-7, 6]) b.fill(-29, 17, z, 28, 17, z, (x) => (pav(x) ? 0 : K('d1'))); // string course, proud
  for (const z of [-7, 6]) b.fill(-29, 32, z, 28, 32, z, (x) => (pav(x) ? 0 : (x + 40) % 2 ? K('d1') : K('d2'))); // cornice
  // quoins at the wings' ends and the gate tower's corners
  for (const x of [-29, 28, -11, 10]) for (const z of [-9, -6, 5, 8]) for (let y = 2; y <= (pav(x) ? 33 : 30); y += 1) {
    if (!b.at(x, y, z) || (y - 2) % 3 === 2) continue;
    b.put(x, y, z, Math.floor((y - 2) / 3) % 2 ? K('d1') : K('d2'));
  }
  // ---- sash windows, front and back, two storeys
  for (const [out, z] of [[1, 5], [-1, -6]]) for (const x0 of [-26, -19, 14, 21]) {
    if (out < 0 && (x0 === -19 || x0 === 14)) continue; // the back has fewer
    sash(b, x0, 5, 10, z, out, 1 + out);
    sash(b, x0, 21, 9, z, out, 3 + out);
  }
  // ---- the parapet: a balustrade on the wings
  for (const z of [-6, 5]) for (let x = -29; x <= 28; x += 1) {
    if (pav(x)) continue;
    b.put(x, 33, z, K('d2')); if ((x + 40) % 2 === 0) b.put(x, 34, z, K('d1')); b.put(x, 35, z, K('d1'));
  }
  for (const x of [-29, 28]) for (let z = -6; z <= 5; z += 1) { b.put(x, 33, z, K('d2')); if (z % 2 === 0) b.put(x, 34, z, K('d1')); b.put(x, 35, z, K('d1')); }
  // ---- the slate roof behind it, chimneys with a pot still warm
  for (let z = -5; z <= 4; z += 1) for (let x = -28; x <= 27; x += 1) {
    if (pav(x)) continue;
    const kk = Math.min(z + 6, 5 - z), top = 33 + Math.min(kk, 5);
    for (let y = 33; y <= top; y += 1) b.put(x, y, z, y < top ? K('gm') : kk % 2 ? tone([K('sl1'), K('sl2'), K('sl3')], Math.floor((x + (kk % 4) * 2) / 3), y, z, 9) : K('sl3'));
    if (z < 0 && noise(x, z, 5, 3) > 0.62) b.put(x, top, z, K('moss'));
  }
  for (const cx of [-22, 20]) {
    b.fill(cx - 1, 33, -3, cx + 2, 44, 0, (x, y, z) => ((y - 33) % 3 === 2 ? K('gm') : y > 41 && hash(x, y, z) < 0.4 ? K('soot') : tone(STONE, x, Math.floor(y / 3), z, 10)));
    b.fill(cx - 2, 45, -4, cx + 3, 45, 1, K('d1'));
    for (const [px, i] of [[cx - 1, 0], [cx + 1, 1]]) { b.put(px, 46, -2, K('clay')); b.put(px, 47, -2, i && cx > 0 ? K('ember') : K('soot')); }
  }
  // ---- the gate tower: rustication up to a gold frieze and a cornice, a pediment with a glowing oculus
  for (const z of [8, -9]) {
    for (let y = 0; y <= 34; y += 1) for (let x = -11; x <= 10; x += 1) {
      const v = voussoir(x, y, 26, 6, 8.6, 9);
      if (v) b.put(x, y, z, v);
      if ((x === -1 || x === 0) && y >= 32 && y <= 34) { b.put(x, y, z + (z > 0 ? 1 : -1), y === 33 ? K('au1') : K('d1')); }
    }
    b.fill(-12, 34, z, 11, 34, z, (x) => frieze(x, 34, 34, z > 0 ? 0 : 2));
    b.fill(-12, 35, z, 11, 36, z, (x, y) => (y === 36 && (x + 40) % 2 ? K('d1') : K('d2')));
    b.fill(-12, 35, z + (z > 0 ? 1 : -1), 11, 35, z + (z > 0 ? 1 : -1), K('d1'));
  }
  for (let y = 37; y <= 45; y += 1) {
    const j = y - 37, x0 = -12 + Math.round(j * 1.4), x1 = 11 - Math.round(j * 1.4);
    if (x0 > x1) break;
    for (let x = x0; x <= x1; x += 1) for (let z = -9; z <= 8; z += 1) {
      const rake = x <= x0 + 1 || x >= x1 - 1;
      const face = z === 8 || z === -9;
      const oc = Math.hypot(x + 0.5, y + 0.5 - 40);
      let id = K('gm');
      if (face) id = rake ? K('d1') : oc <= 2.2 ? (oc < 1.2 ? K('lit2') : K('lit1')) : oc <= 3.1 ? K('d1') : tone([K('d2'), K('g1')], x, y, z, 11);
      else if (rake || y === 45) id = (x + y) % 3 ? K('sl1') : K('sl2');
      b.put(x, y, z, id);
    }
  }
  // the passage: dressed jambs, flags, a lantern hanging from the vault
  for (let y = 0; y <= 25; y += 1) for (let z = -9; z <= 8; z += 1) for (const x of [-7, 6]) if (y % 3 !== 2 && hash(x, y, z) < 0.3) b.put(x, y, z, K('d2'));
  return b;
}
// the lantern hanging in the gate's passage, on its own so it can sway
function gateLantern() {
  const l = box([-2, 27, -2], [1, 31, 1]);
  l.fill(-1, 30, -1, 0, 31, 0, (x, y) => (y === 31 ? C.iron2 : C.iron1));
  l.fill(-2, 27, -2, 1, 29, 1, (x, y, z) => ((x === -2 || x === 1) && (z === -2 || z === 1) ? C.iron1 : y === 29 ? C.iron2 : y === 28 ? K('lit2') : K('lit1')));
  return l.part('lantern', [0, 32, 0]);
}
let rangeBuilt = null;
export function range() {
  return {
    gait: 'still',
    build() { rangeBuilt ??= { parts: { range: rangeGrid().part('range', [0, 0, 0]), lantern: gateLantern() } }; return rangeBuilt; },
    idle({ parts: P, state: { t } }) { P.lantern.rotation.z += 0.06 * Math.sin(t * 1.1); P.lantern.rotation.x += 0.04 * Math.sin(t * 0.8 + 1); },
  };
}

// A self-check: node js/models/acad_trinity.js (the arch is open for Yuuv; the bell clears the belfry)
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const t = tower();
  for (const y of [0, 10, 20, 28]) if (t.at(0, y, 12) || t.at(12, y, 0)) throw new Error(`the passage is blocked at y ${y}`);
  if (!t.at(-12, 10, 14)) throw new Error('a pier is missing');
  const r = rangeGrid();
  for (const y of [0, 15, 27]) if (r.at(0, y, 8) || r.at(-3, y, 0) || r.at(4, y, -9)) throw new Error(`the gate is blocked at y ${y}`);
  const th = 0.42 + 0.045, reach = 4.3 * Math.cos(th) + (BELL_Y - 49) * Math.sin(th); // the lip's corner at the widest swing
  if (reach > 8) throw new Error(`the bell hits the belfry (${reach.toFixed(1)})`);
  console.log('acad_trinity.js ok');
}
