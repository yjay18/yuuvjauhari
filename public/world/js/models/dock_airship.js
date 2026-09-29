// The Sky Docks' fleet (colours dock_). A berth is a timber jetty on a stone pier that hangs into the void, a
// mooring mast at its end, and an airship held by its nose in the mast's collar, streaming straight out. One
// function builds them all, so the fleet shares its grids by size: the envelope is plain fabric that each ship's
// material tints (one grid serves four ships, its livery glow tinted the same way), and the gondola, propeller
// and jetty repeat. A ship's own are its hologram pennant and its one detail.
//
// berth(ship) -> a rig definition whose origin is the jetty's root on the island's rim, facing +z (inland). The
// jetty runs out along -z to a pier head, the collar at (0, -11) holds the ship's nose, and the ship streams out
// along -z (its own +x; `ship.yaw` turns it about the nose). Alive at rest: it bobs and swings on the collar and
// leans in the gusts, the propeller turns, the pennant flies and glitches; ctx.greet() (or act()) is its hello
// when Yuuv comes to the jetty: a toot of steam, the propeller revs, a roll toward him, and its detail joins in.
//   ship = { key, size: 'L' | 'M' | 'S', yaw, tint, glow, lamp, holo: [core, mid, dim], glyph: [7 strings of 7], detail }
//   tint colours the envelope, glow its livery, lamp its glow from inside at night (ctx.mem.bag, set by the district)
//   detail: 'nest' | 'owl' | 'sounding' | 'boosters' | 'net' | 'robot' (the school club's: patched, bunting, clamped)
import { C, colour, hash, noise } from '../kit/voxel-kit.js';
import { box, tone, smooth, clamp01 } from './space.js';

const col = (name, hex, glow = false) => C[name] ?? colour(name, hex, glow);
for (const [n, hex, glow] of [
  // envelope fabric in plain greys (each ship's material tints it), the livery in white glow (tinted too)
  ['bag1', 0xffffff], ['bag2', 0xededed], ['bag3', 0xd4d4d4], ['bag4', 0xb6b6b6], ['bag5', 0x949494], ['bag6', 0x757575], ['trim', 0xffffff, true], ['trim2', 0x8c8c8c, true],
  // the school club's own envelope: mustard, patched in red, blue and cream, stitched
  ['mus1', 0xf6d27a], ['mus2', 0xe8bb52], ['mus3', 0xd6a33c], ['mus4', 0xbf8b2e], ['mus5', 0xa27424], ['mus6', 0x84601c], ['patchR', 0xc44c3e], ['patchB', 0x4c78b4], ['patchC', 0xeee2c4], ['stitch', 0x3a2a1c],
  // timber, rope, fin canvas, copper
  ['w1', 0x3a2517], ['w2', 0x4f3421], ['w3', 0x6b4a2e], ['w4', 0x86603b], ['w5', 0x9d7650],
  ['rope1', 0xa88f6a], ['rope2', 0x86704f], ['fin1', 0xe8dcc2], ['fin2', 0xd2c4a2], ['cu1', 0x3f6f68], ['cu2', 0x57907f],
  ['lit', 0xffc764, true], ['lit2', 0xffe6a8, true],
  // the piers: coursed stone with circuit light in the beds, bands of runes, wet stone, weed and barnacles at the
  // waterline, foam round their feet, crystals grown on their plinths
  ['st1', 0xa9a3aa], ['st2', 0x908a96], ['st3', 0x79747f], ['st4', 0x635f6b], ['mortar', 0x35323b], ['moss', 0x58733c],
  ['trace', 0x1fd2ea, true], ['rune', 0x9f86ff, true], ['crys1', 0xe6fdff, true], ['crys2', 0x6ff2ff, true], ['crys3', 0xa98bff, true],
  ['wet1', 0x4c4a55], ['wet2', 0x3d3b46], ['weed', 0x2f4a2c], ['weed2', 0x3f5e33], ['barn', 0xcfc8b8], ['foam', 0xdff4ff, true], ['foam2', 0x9fd8f0, true],
  // details: an owl, a robot, scrolls, booster flames, fathom beads, a wheel clamp and its ticket, a parking meter, bunting
  ['owl1', 0x7a5a3a], ['owl2', 0x523b28], ['owl3', 0xdccca6], ['owlEye', 0xffb13a, true], ['beak', 0xc8862a],
  ['bot1', 0xc3c7cf], ['bot2', 0x8b8f99], ['bot3', 0x5d616b], ['botPanel', 0xe07a2a], ['visor', 0x7ff4ff, true], ['antTip', 0xff4f7a, true],
  ['paper', 0xf0e6cc], ['paper2', 0xdccfae], ['wax', 0xb3322a], ['ribbon', 0x3a5ab0],
  ['fl1', 0xfff4d8, true], ['fl2', 0xffb347, true], ['fl3', 0xff6a1f, true], ['bead', 0x7cc8ff, true],
  ['clamp', 0xf2c230], ['clamp2', 0x1e1e22], ['ink', 0x3a3040], ['expired', 0xff3a2a, true],
  ['flagR', 0xc8443a], ['flagY', 0xf0c040], ['flagB', 0x4a7ac0],
]) col(`dock_${n}`, hex, glow);
const K = (n) => C[`dock_${n}`];

// ---- sizes (model voxels). The ship's frame: the nose ring at the origin, +x downwind, the envelope's axis on y = z = 0.
const SIZE = {
  L: { len: 46, rad: 8, gx0: 9, gx1: 30, hw: 4, deep: 5, prop: 5, fin: 7 },
  M: { len: 38, rad: 6.5, gx0: 8, gx1: 25, hw: 4, deep: 4, prop: 4, fin: 6 },
  S: { len: 30, rad: 5, gx0: 7, gx1: 20, hw: 3, deep: 3, prop: 4, fin: 5 },
};
// The envelope's profile: a tapered nose to its widest two fifths of the way back, then a long taper to the tail.
// The cross-section is round (as tall as it is wide) all along.
const prof = (t) => (t <= 0 || t >= 1 ? 0 : t < 0.4 ? (1 - ((0.4 - t) / 0.4) ** 2) ** 0.62 : (1 - ((t - 0.4) / 0.6) ** 2) ** 0.75);
export function geo(size) {
  const s = SIZE[size], floor = -(Math.round(s.rad) + 8), r = (x) => s.rad * prof(x / s.len), xm = Math.round(s.len / 2);
  // floor: the gondola's deck; mast: how high the nose rides over the jetty (the deck then sits 3 above the pier head)
  return { ...s, floor, rail: floor + 3, keel: floor - s.deep, yc: floor - 2, mast: 4 - floor, r, xm, ym: Math.ceil(r(xm + 0.5)) + 8, plen: 11 };
}

// A one-voxel line from a to c (model voxels), stepped finely so it never breaks; `sag` droops its middle.
function wire(b, a, c, id, sag = 0) {
  const n = Math.max(2, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]) * 3));
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    b.put(Math.floor(a[0] + (c[0] - a[0]) * t), Math.floor(a[1] + (c[1] - a[1]) * t - sag * 4 * t * (1 - t)), Math.floor(a[2] + (c[2] - a[2]) * t), typeof id === 'function' ? id(t, i) : id);
  }
}

// Every ship part hangs from an empty 'ship' part pivoting on the nose ring.
const SHIP = box([0, 0, 0], [0, 0, 0]);
SHIP.part('ship', [0, 0, 0]);

// The school club's patches, on the envelope's (x, gore) surface: x0, x1, g0, g1 (gore 9 faces +z, 6 is the top).
const PATCHES = [[6, 9, 8.6, 9.9, 'patchC'], [10, 14, 7.4, 9.0, 'patchR'], [13, 17, 5.3, 6.5, 'patchB'], [17, 21, 8.7, 10.3, 'patchB'], [22, 25, 6.3, 7.7, 'patchC']];

// ---------------------------------------------------------------------------------------------
// The envelope (bag: fabric plus livery, both tinted per ship) and everything else of the ship that holds still
// on it (hull: the gondola, rigging, harness, fins, engine, ramp, masts), for one size.
function buildShip(size) {
  const G = geo(size), { len, rad, gx0, gx1, hw, deep, floor, rail, keel, yc, fin, r, xm, ym } = G;
  const S = size === 'S', L = size === 'L';
  const R = Math.ceil(rad + fin + 2), top = L ? 24 : ym + 3;
  const lo = [-3, keel - 1, -R], hi = [len + 3, top, R - 1];
  const hull = box(lo, hi), bag = box(lo, hi);
  const F = S ? [1, 2, 3, 4, 5, 6].map((i) => K(`mus${i}`)) : [1, 2, 3, 4, 5, 6].map((i) => K(`bag${i}`)); // crown to belly
  const ringX = Math.round(0.6 * len), stripe = [Math.round(0.1 * len), Math.round(0.66 * len)];

  // ---- the envelope: gores and their seams, a weave, a darker belly and weathered streaks (and the club's patches,
  // stitched); a circuit stripe down each side with vias where it breaks, and a ring of runes round it
  for (let x = 3; x <= len - 3; x += 1) {
    const rr = r(x + 0.5), ri = Math.ceil(rr);
    for (let y = -ri; y < ri; y += 1) for (let z = -ri; z < ri; z += 1) {
      const dy = y + 0.5, dz = z + 0.5, d = Math.hypot(dy, dz);
      if (d > rr) continue;
      const skin = d > rr - 1.2, phi = Math.atan2(dz, dy);
      const seg = Math.floor((x + 2) / 6), on = hash(seg, 7, size.charCodeAt(0)) > 0.2;
      if (skin && x === ringX) { bag.put(x, y, z, Math.floor((phi / Math.PI + 1) * 12) % 3 ? K('trim') : K('trim2')); continue; }
      if (skin && Math.abs(dz) > 2 && x >= stripe[0] && x <= stripe[1]) {
        if (Math.abs(dy) < 1 && on) { bag.put(x, y, z, K('trim')); continue; }
        if ((x + 2) % 6 === 5 && on && dy === (seg % 2 ? 1.5 : -1.5)) { bag.put(x, y, z, K('trim2')); continue; } // a via
      }
      const g = (phi / (2 * Math.PI) + 0.5) * 12, gi = Math.floor(g), f = g - gi;
      const pt = S && skin && PATCHES.find(([x0, x1, g0, g1]) => x >= x0 && x <= x1 && g >= g0 && g <= g1);
      let id;
      if (pt) id = x === pt[0] || x === pt[1] || g - pt[2] < 0.22 || pt[3] - g < 0.22 ? ((x + y + z) % 2 ? K('stitch') : K(pt[4])) : K(pt[4]);
      else {
        // shaded by height so the curve reads: a pale crown, darkening flanks, a deep belly; darker again where the
        // nose and tail turn away; gore seams and weathered streaks a step darker, dithered at every band's edge
        const u = x / len, hh = dy / rr + (hash(x, y, z + 7) - 0.5) * 0.22;
        let band = hh > 0.72 ? 0 : hh > 0.38 ? 1 : hh > 0.02 ? 2 : hh > -0.36 ? 3 : hh > -0.72 ? 4 : 5;
        if (u < 0.08 || u > 0.9) band += 1;
        if (f < 0.1 || (hh > 0.2 && noise(x, gi * 7, 5, 11) > 0.76)) band += 1;
        id = F[Math.min(5, band)];
      }
      bag.put(x, y, z, id);
    }
  }
  // the nose cone and the mooring ring; a brass cap on the tail
  for (let x = 0; x <= 2; x += 1) { const rr = Math.max(1.2, r(x + 0.5)), ri = Math.ceil(rr); for (let y = -ri; y < ri; y += 1) for (let z = -ri; z < ri; z += 1) if (Math.hypot(y + 0.5, z + 0.5) <= rr) hull.put(x, y, z, x === 1 ? C.brass1 : (y + z) % 3 === 0 ? C.brass1 : C.brass2); }
  hull.fill(-1, -1, -1, -1, 0, 0, C.iron2);
  for (const [y, z] of [[-2, -1], [-2, 0], [1, -1], [1, 0], [-1, -2], [0, -2], [-1, 1], [0, 1]]) hull.put(-2, y, z, C.iron3);
  for (let x = len - 2; x <= len; x += 1) { const rr = Math.max(0.8, r(Math.min(len - 0.3, x + 0.5))), ri = Math.ceil(rr); for (let y = -ri; y < ri; y += 1) for (let z = -ri; z < ri; z += 1) if (Math.hypot(y + 0.5, z + 0.5) <= rr) hull.put(x, y, z, x === len ? C.iron2 : C.brass1); }

  // ---- the harness: brass rings on the envelope's lower flanks where the rigging takes hold
  const bands = [0.2, 0.44, 0.68].map((k) => Math.round(k * len));
  for (const xb of bands) for (const s of [-1, 1]) {
    const rr = r(xb + 0.5) + 0.5, y = Math.floor(-rr * 0.77), z = Math.floor(s * rr * 0.64);
    hull.put(xb, y, z, C.brass2); hull.put(xb - 1, y, z, C.brass1); hull.put(xb + 1, y, z, C.brass1);
  }
  // ---- rigging: rope from the gondola's rail up to the brass rings, criss-crossed (the school club dresses its lines in bunting)
  const railX = [gx0 + 1, Math.round(gx0 + (gx1 - gx0) * 0.35), Math.round(gx0 + (gx1 - gx0) * 0.65), gx1 - 1];
  const FLAGS = [K('flagR'), K('flagY'), K('flagB'), K('patchC')];
  for (const s of [-1, 1]) for (const xr of railX) for (const xb of bands) {
    if (Math.abs(xr - xb) > 8) continue;
    const rr = r(xb + 0.5) + 0.6, a = [xr + 0.5, rail + 1.5, s * (hw - 0.5)], c = [xb + 0.5, -rr * 0.77, s * rr * 0.64];
    wire(hull, a, c, (t, i) => (i % 4 < 2 ? K('rope1') : K('rope2')));
    if (S && s > 0) for (let k = 1; k < 5; k += 1) { const t = k / 5, p = a.map((v, j) => Math.floor(v + (c[j] - v) * t)); hull.put(p[0], p[1] - 1, p[2], FLAGS[(k + xr) % 4]); hull.put(p[0] + 1, p[1] - 1, p[2], FLAGS[(k + xr) % 4]); hull.put(p[0], p[1] - 2, p[2], FLAGS[(k + xr) % 4]); }
  }

  // ---- tail fins: canvas on timber spars, the edge a line of livery light
  const xs = Math.round(0.7 * len), rise = 0.16 * len;
  for (let x = xs; x <= len + 1; x += 1) {
    const rr = r(Math.min(len - 0.2, x + 0.5));
    for (const [dy, dz, k] of [[1, 0, 1], [-1, 0, 0.55], [0, 1, 0.6], [0, -1, 0.6]]) {
      const h = fin * k * Math.min(1, (x - xs + 1) / rise), q1 = Math.floor(rr + h);
      for (let q = Math.floor(rr); q <= q1; q += 1) for (const w of [-1, 0]) {
        const y = dy ? (dy > 0 ? q : -q - 1) : w, z = dz ? (dz > 0 ? q : -q - 1) : w;
        if (Math.hypot(y + 0.5, z + 0.5) <= rr + 0.2) continue;
        if (q === q1 || x === len + 1) { bag.put(x, y, z, q === q1 && x === len + 1 ? K('trim') : K('trim2')); continue; }
        hull.put(x, y, z, (x - xs) % 4 === 0 || q === q1 - 1 ? K('w2') : hash(x, q, w + dy * 3) < 0.3 ? K('fin2') : K('fin1'));
      }
    }
  }

  // ---- the gondola: a barge of planked strakes on a keel, a brass rubbing strake at the deck, a bulwark capped by a rail
  // with brass knobs, round lit portholes, a livery circuit along its flanks; its bow is a drawbridge
  const circuitY = floor - (L ? 4 : 3);
  for (let x = gx0; x <= gx1; x += 1) for (let y = keel; y <= rail; y += 1) {
    const below = floor - y, rake = Math.max(0, below - 1);
    if (x < gx0 + rake) continue; // the bow's foot is set back
    let w = hw - Math.max(0, below - 1) * ((hw - 1) / Math.max(1, deep - 1));
    const sx = x - (gx1 - 3);
    if (sx > 0) w *= Math.sqrt(Math.max(0.12, 1 - (sx / 4.6) ** 2)); // a rounded stern
    for (let z = -hw; z < hw; z += 1) {
      const dz = Math.abs(z + 0.5);
      if (dz > w) continue;
      const skin = dz > w - 1 || x === gx1 || (sx > 0 && dz > w - 1.6);
      let id;
      if (y > floor) {
        if (!skin) continue; // open deck above the floor
        if (y === rail) id = x % 4 === 0 ? C.brass2 : K('w4');
        else id = tone([K('w3'), K('w4'), K('w4')], Math.floor((x + y * 3) / 7), y, z, 3);
      } else if (y === floor) id = skin ? (x % 2 ? C.brass1 : C.brass2) : hash(z, Math.floor(x / 6), 2) < 0.5 ? K('w4') : K('w5');
      else if (y === keel) id = x % 3 ? C.iron2 : K('w1');
      else {
        const strake = Math.floor((y - keel) / 2);
        id = (x + strake * 3) % 8 === 0 ? K('w2') : [K('w3'), K('w4'), K('w4'), K('w5')][Math.floor(hash(strake, Math.floor((x + strake * 3) / 8), 4) * 4)];
        if (skin && y === circuitY && hash(Math.floor((x + 1) / 5), 3) > 0.25) { bag.put(x, y, z, K('trim')); continue; }
      }
      hull.put(x, y, z, id);
    }
    if (x % 4 === 0) for (const z of [-hw, hw - 1]) if (hull.at(x, rail, z)) hull.put(x, rail + 1, z, C.brass2); // knobs on the rail posts
  }
  // portholes: a lit glass in a brass ring, down both flanks
  const outer = (x, y, s) => { for (let z = s > 0 ? hw - 1 : -hw; Math.abs(z + 0.5) >= 0; z -= s) { if (hull.at(x, y, z) || bag.at(x, y, z)) return z; if (Math.abs(z) > hw + 1) return null; } return null; };
  for (let x = gx0 + 3; x <= gx1 - 4; x += 3) for (const s of [-1, 1]) {
    const z = outer(x, floor - 2, s);
    if (z === null) continue;
    hull.put(x, floor - 2, z, K('lit'));
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const zz = outer(x + dx, floor - 2 + dy, s); if (zz !== null) hull.put(x + dx, floor - 2 + dy, zz, C.brass2); }
  }
  // the drawbridge: bow posts, a lintel with pulleys, the ramp lowered to the pier head on two chains, a lantern on a hook
  for (const z of [-hw, hw - 1]) hull.fill(gx0, floor + 1, z, gx0, rail + 2, z, (x, y) => (y % 2 ? C.iron2 : C.iron1));
  hull.fill(gx0, rail + 2, -hw, gx0, rail + 2, hw - 1, (x, y, z) => (z === -hw || z === hw - 1 ? C.brass2 : K('w1')));
  const rl = gx0 - 3; // the ramp's length: its tip lands clear of the mast
  for (let x = gx0 - 1; x >= gx0 - rl; x -= 1) {
    const y = floor - Math.round(((gx0 - 1 - x) * 3) / Math.max(1, rl - 1));
    for (let z = -2; z <= 1; z += 1) hull.put(x, y, z, x === gx0 - rl ? C.brass2 : z === -2 || z === 1 ? (x % 2 ? C.iron2 : K('w2')) : x % 2 ? K('w4') : K('w5'));
  }
  for (const z of [-2, 1]) wire(hull, [gx0 - rl + 0.5, floor - 2.5, z + 0.5], [gx0 + 0.5, rail + 2.5, z < 0 ? -hw + 0.5 : hw - 0.5], (t, i) => (i % 2 ? C.iron3 : C.iron1));
  hull.put(gx0 - 1, rail + 2, hw - 1, C.iron2); hull.put(gx0 - 1, rail + 1, hw - 1, K('lit')); hull.put(gx0 - 1, rail, hw - 1, C.iron2);
  // the wheelhouse astern: planked, lit windows both sides, a door forward, a copper roof, a stovepipe and the whistle
  if (!S) {
    const c0 = gx1 - 9, c1 = gx1 - 3, h = L ? 5 : 4;
    for (let x = c0; x <= c1; x += 1) for (let y = floor + 1; y <= floor + h; y += 1) for (let z = -3; z <= 2; z += 1) {
      if (!(x === c0 || x === c1 || z === -3 || z === 2)) continue;
      const corner = (x === c0 || x === c1) && (z === -3 || z === 2);
      const win = (z === -3 || z === 2) && y >= floor + h - 2 && y < floor + h && (x - c0) % 3 !== 0;
      const door = x === c0 && z >= -1 && z <= 0 && y <= floor + h - 1;
      hull.put(x, y, z, corner ? K('w1') : win ? K('lit2') : door ? (y === floor + 2 && z === 0 ? C.brass2 : K('w2')) : x % 2 ? K('w3') : K('w4'));
    }
    for (let x = c0 - 1; x <= c1 + 1; x += 1) for (let z = -4; z <= 3; z += 1) hull.put(x, floor + h + 1 + (z === -1 || z === 0 ? 1 : 0), z, (x + z) % 3 ? K('cu1') : K('cu2'));
    hull.fill(c1 - 1, floor + h + 2, -3, c1 - 1, floor + h + 4, -3, C.iron1); hull.put(c1 - 1, floor + h + 5, -3, C.brass2);
    hull.fill(c0, floor + h + 3, 2, c0, floor + h + 4, 2, C.brass2);
  } else hull.fill(gx1 - 2, rail + 1, 1, gx1 - 2, rail + 3, 1, C.brass2); // the school club's whistle, on the stern post
  // the engine: a brass drum astern, iron cooling rings, its core a ring of livery light, the shaft out to the propeller
  for (let x = gx1 - 1; x <= gx1 + 4; x += 1) for (let y = yc - 4; y <= yc + 3; y += 1) for (let z = -4; z <= 3; z += 1) {
    const d = Math.hypot(y + 0.5 - yc, z + 0.5);
    if (x === gx1 + 4) { if (d < 0.8) hull.put(x, y, z, C.iron3); continue; }
    const ringX2 = x === gx1 || x === gx1 + 2;
    if (d > (ringX2 ? 3.2 : 2.6)) continue;
    if (x === gx1 + 3) { if (d > 0.8 && d < 2) bag.put(x, y, z, K('trim')); else hull.put(x, y, z, C.iron2); continue; }
    if (x === gx1 + 1 && d > 1.8 && Math.floor((Math.atan2(z + 0.5, y + 0.5 - yc) / Math.PI + 1) * 3) % 2) { bag.put(x, y, z, K('trim2')); continue; }
    hull.put(x, y, z, ringX2 ? C.iron2 : (y + z) % 3 ? C.brass2 : C.brass1);
  }
  // the pennant's mast and yard on top, amidships
  const t0 = Math.floor(Math.sqrt(Math.max(0, r(xm + 0.5) ** 2 - 0.25)) - 0.5) + 1;
  hull.fill(xm, t0, 0, xm, ym, 0, (x, y) => (y % 3 ? C.iron1 : C.iron2));
  hull.put(xm, ym + 1, 0, C.brass2); hull.fill(xm + 1, ym, 0, xm + 3, ym, 0, C.iron2);
  // the flagship's crow's nest: a mast forward on top, a basket of staves with a brass rim
  if (L) {
    const x0 = 17, rr = r(x0 + 0.5), n0 = Math.floor(Math.sqrt(rr * rr - 0.25) - 0.5) + 1;
    hull.fill(x0 - 1, n0, -1, x0, 17, 0, (x, y) => (y % 5 === 0 ? C.brass2 : K('w2')));
    for (let y = 18; y <= 21; y += 1) for (let z = -4; z <= 3; z += 1) for (let x = x0 - 4; x <= x0 + 3; x += 1) {
      const d = Math.hypot(x + 0.5 - x0, z + 0.5);
      if (d > 3.2 || (y > 18 && d < 2.2)) continue;
      hull.put(x, y, z, y === 21 ? C.brass2 : y === 18 ? K('w2') : Math.floor((Math.atan2(z + 0.5, x + 0.5 - x0) / Math.PI + 1) * 6) % 2 ? K('w3') : K('w4'));
    }
  }
  // the school club's lookout deck on the envelope, forward: planks on brass posts, a rail round it (its robot stands here)
  if (S) {
    for (let x = 5; x <= 11; x += 1) for (let z = -2; z <= 1; z += 1) {
      const y0 = Math.floor(Math.sqrt(Math.max(0, r(x + 0.5) ** 2 - (z + 0.5) ** 2)) - 0.5) + 1;
      for (let y = y0; y < 6; y += 1) if ((x === 5 || x === 11) && (z === -2 || z === 1)) hull.put(x, y, z, C.brass1);
      hull.put(x, 6, z, (x + z) % 2 ? K('w4') : K('w5'));
      if (x === 5 || x === 11 || z === -2 || z === 1) { if ((x + z) % 2 === 0) hull.put(x, 7, z, C.brass2); hull.put(x, 8, z, C.brass2); }
    }
  }
  // the bag wins wherever the two meet
  for (let i = 0; i < bag.g.data.length; i += 1) if (bag.g.data[i]) hull.g.data[i] = 0;
  return { G, hull, bag };
}

// The propeller: four timber blades with brass tips on an iron hub, pitched. The school club's has a wheel clamp on a
// blade, black and yellow, padlocked, and a parking ticket tied to it.
function buildProp(size, clamp) {
  const { gx1, yc, prop: P } = geo(size), x0 = gx1 + 5;
  const b = box([x0, yc - P - 2, -P - 2], [x0 + 3, yc + P + 1, P + 1]);
  for (let y = yc - P - 1; y <= yc + P; y += 1) for (let z = -P - 1; z <= P; z += 1) {
    const dy = y + 0.5 - yc, dz = z + 0.5, rr = Math.hypot(dy, dz);
    if (rr > P + 0.4) continue;
    if (rr < 1.2) { b.put(x0, y, z, C.iron2); b.put(x0 + 1, y, z, C.iron3); b.put(x0 + 2, y, z, C.brass2); continue; }
    const a = Math.atan2(dz, dy), k = ((((a - Math.PI / 4) % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2)) - Math.PI / 4;
    const off = rr * Math.sin(k), wdt = 1.3 - 0.45 * (rr / P);
    if (Math.abs(off) > wdt) continue;
    const tip = rr > P - 1.1, id = tip ? C.brass2 : hash(y, z, 5) < 0.3 ? K('w4') : K('w3');
    b.put(x0 + 1, y, z, id);
    b.put(off > 0 ? x0 : x0 + 2, y, z, tip ? C.brass1 : K('w2'));
  }
  if (clamp) { // a yellow wheel clamp across two blades, striped, padlocked, the ticket hanging off it
    for (let k = -3; k <= 3; k += 1) for (const dx of [0, 2]) b.put(x0 + dx, yc + k, k < -1 || k > 0 ? (k % 2 ? 1 : -2) : -2, Math.abs(k) % 2 ? K('clamp') : K('clamp2'));
    b.fill(x0 + 1, yc - 1, -3, x0 + 1, yc, -2, K('clamp'));
    b.fill(x0 + 3, yc - 2, -2, x0 + 3, yc - 1, -1, (x, y, z) => (y === yc - 1 && z === -1 ? C.brass2 : C.iron3)); // the padlock
    b.fill(x0 + 3, yc - 6, -1, x0 + 3, yc - 3, 1, (x, y, z) => (y === yc - 4 && z === 0 ? K('ink') : y === yc - 5 && z !== 0 ? K('ink') : K('paper'))); // the ticket
  }
  return b.part('prop', [x0 + 1.5, yc, 0], SHIP);
}

// The pennant: a hologram swallowtail flying from the yard, the ship's glyph at its hoist, a few scanlines.
function buildSail(size, glyph, holo) {
  const { xm, ym, plen } = geo(size), x0 = xm + 1;
  const [core, mid, dim] = holo.map((hex) => col(`dock_holo_${hex.toString(16)}`, hex, true));
  const Gl = (i, j) => glyph[j]?.[i] === '#';
  const b = box([x0, ym - 8, 0], [x0 + plen - 1, ym - 1, 0]);
  for (let u = 0; u < plen; u += 1) {
    const low = u < 8 ? 7 : 7 - (u - 7); // the fly end tapers
    for (let v = 0; v <= low; v += 1) {
      if (u >= plen - 2 && v > 1 && v < low) continue; // the swallowtail
      const x = x0 + u, y = ym - 1 - v;
      if (u >= 1 && u <= 7 && v >= 1 && Gl(u - 1, v - 1)) b.put(x, y, 0, (u * 3 + v) % 5 ? mid : core);
      else if (u === 0 || v === 0 || u === plen - 1) b.put(x, y, 0, (u + v) % 3 === 0 ? mid : dim);
      else if (v === low || (v % 2 === 1 && hash(u, v, 13) > 0.55)) b.put(x, y, 0, dim);
    }
  }
  return b.part('sail', [x0 - 0.5, ym - 0.5, 0.5], SHIP);
}

// ---- each ship's one detail (in the ship's frame, hanging from the ship)
const DETAIL = {
  // the flagship's lookout: a brass spyglass on a swivel in the crow's nest, a lantern on the other side
  nest() {
    const b = box([13, 19, -5], [21, 24, 5]);
    b.fill(16, 19, -1, 17, 22, 0, C.iron2);
    for (let z = -3; z <= 4; z += 1) b.put(16, 23, z, z === 4 ? C.brass1 : z === -3 ? C.iron1 : z % 3 === 0 ? C.brass1 : C.brass2);
    b.put(17, 23, 4, C.brass1); b.put(16, 24, 4, C.brass1);
    b.fill(18, 22, -2, 18, 23, -2, C.iron2); b.put(19, 23, -2, C.iron2); b.put(19, 22, -2, K('lit'));
    return { extra: b.part('extra', [17, 21, 0], SHIP) };
  },
  // an owl on a brass perch on the envelope, forward, looking ahead: a barred cream breast, wings folded in feathered
  // rows, a pale face with two big lamp eyes and a hooked beak, ear tufts
  owl(G) {
    const x0 = 8, top = Math.floor(Math.sqrt(G.r(x0 + 0.5) ** 2 - 0.25) - 0.5) + 1, y0 = top + 2, b = box([x0 - 3, top, -3], [x0 + 1, y0 + 10, 2]);
    b.fill(x0 - 1, top, -1, x0, y0 - 1, 0, (x, y) => (y === y0 - 1 ? C.brass1 : C.brass2)); // the perch
    for (let y = y0; y <= y0 + 10; y += 1) for (let z = -3; z <= 2; z += 1) for (let x = x0 - 2; x <= x0 + 1; x += 1) {
      const front = x === x0 - 2, side = z === -3 || z === 2, corner = (x === x0 - 2 || x === x0 + 1) && side;
      let id = 0;
      if (y === y0) id = front && !side ? K('beak') : 0; // talons
      else if (y <= y0 + 5) { if (corner && (y === y0 + 1 || y === y0 + 5)) continue; id = front && !side ? ((y + (z & 1)) % 2 ? K('owl3') : K('owl1')) : side ? ((x + y) % 2 ? K('owl2') : K('owl1')) : K('owl2'); }
      else if (y <= y0 + 9) {
        if (corner && y === y0 + 9) continue;
        const eye = front && (y === y0 + 7 || y === y0 + 8) && (z <= -2 || z >= 1);
        id = eye ? (y === y0 + 7 && (z === -2 || z === 1) ? K('ink') : K('owlEye')) : front ? K('owl3') : (x + y + z) % 3 ? K('owl1') : K('owl2');
      } else id = x === x0 - 1 && side ? K('owl2') : 0; // ear tufts
      if (id) b.put(x, y, z, id);
    }
    b.fill(x0 - 3, y0 + 6, -1, x0 - 3, y0 + 7, 0, (x, y, z) => (y === y0 + 6 && z === 0 ? C.brass1 : K('beak')));
    return { extra: b.part('extra', [x0 - 0.5, top, 0], SHIP) };
  },
  // a sounding line over the side: a davit and pulley, the line marked each fathom with a glowing bead, the lead below
  sounding(G) {
    const { gx0, rail, hw } = G, px = gx0 + 6, py = rail + 3, pz = hw + 2;
    const b = box([px - 2, py - 42, hw - 1], [px + 2, py + 1, pz + 2]);
    wire(b, [px + 0.5, rail + 0.5, hw - 0.5], [px + 0.5, py + 0.5, hw + 0.5], C.iron2);
    b.fill(px, py, hw, px, py, pz, C.iron2); b.fill(px, py, pz, px + 1, py, pz, C.brass2);
    for (let y = py - 1; y >= py - 33; y -= 1) {
      const mark = (py - y) % 6 === 0;
      b.fill(px, y, pz, px + 1, y, pz, mark ? K('bead') : y % 2 ? K('rope1') : K('rope2'));
      if (mark) { b.put(px, y, pz + 1, K('bead')); b.put(px + 1, y, pz + 1, K('bead')); }
    }
    b.fill(px, py - 36, pz - 1, px + 1, py - 34, pz + 1, (x, y, z) => (y === py - 34 ? C.brass1 : (x + z) % 2 ? C.iron2 : C.brass1));
    b.fill(px, py - 37, pz, px + 1, py - 37, pz, C.iron2); b.fill(px, py - 38, pz, px + 1, py - 38, pz, K('bead'));
    return { extra: b.part('extra', [px + 1, py + 0.5, pz + 0.5], SHIP) };
  },
  // twin rocket boosters strapped to the gondola's flanks, red-nosed, plasma flickering from their nozzles
  boosters(G) {
    const { gx1, yc, hw } = G, x0 = gx1 - 11, x1 = gx1 - 3;
    const b = box([x0 - 1, yc - 3, -hw - 4], [x1 + 6, yc + 2, hw + 3]);
    for (const s of [-1, 1]) {
      const zc = s * (hw + 1.2);
      for (let x = x0 - 1; x <= x1 + 6; x += 1) for (let y = yc - 3; y <= yc + 2; y += 1) for (let z = -hw - 4; z <= hw + 3; z += 1) {
        const d = Math.hypot(y + 0.5 - yc, z + 0.5 - zc);
        if (x < x0) { if (d < 0.9) b.put(x, y, z, K('flagR')); }
        else if (x <= x1) { if (d <= 1.7) b.put(x, y, z, x === x0 ? K('flagR') : x === x0 + 2 || x === x1 - 1 ? C.iron2 : (y + z) % 3 ? C.brass2 : C.brass1); }
        else if (x <= x1 + 1) { if (d <= 2 && d > 0.7) b.put(x, y, z, C.iron2); }
        else { const rf = 1.5 - (x - x1 - 2) * 0.32; if (d <= rf) b.put(x, y, z, d < rf * 0.45 ? K('fl1') : d < rf * 0.8 ? K('fl2') : K('fl3')); }
      }
      for (const x of [x0 + 2, x1 - 1]) wire(b, [x + 0.5, yc + 0.5, s * (hw - 1)], [x + 0.5, yc + 0.5, zc], C.iron1);
    }
    return { extra: b.part('extra', [(x0 + x1) / 2, yc, 0], SHIP) };
  },
  // a cargo net slung over the gondola's side from two davits, bulging with bundled scrolls, wax-sealed and ribboned
  net(G) {
    const { gx0, gx1, rail, floor, hw } = G, cx = Math.round((gx0 + gx1) / 2) - 1, cy = floor - 3, cz = hw + 3;
    const b = box([cx - 7, cy - 6, hw - 1], [cx + 6, rail + 3, cz + 5]);
    for (const dx of [-4, 4]) { wire(b, [cx + dx + 0.5, rail + 0.5, hw - 0.5], [cx + dx + 0.5, rail + 2.5, cz + 0.5], C.iron2); wire(b, [cx + dx + 0.5, rail + 2.5, cz + 0.5], [cx + dx * 0.6 + 0.5, cy + 3.5, cz + 0.5], K('rope2')); }
    b.egg(cx, cy, cz, 5.2, 4, 3.4, (x, y, z) => {
      const shell = ((x + 0.5 - cx) / 4.2) ** 2 + ((y + 0.5 - cy) / 3) ** 2 + ((z + 0.5 - cz) / 2.4) ** 2 > 1;
      if (shell && ((x + y + 300) % 3 === 0 || (x - y + 300) % 3 === 0)) return (x + z) % 2 ? K('rope1') : K('rope2');
      const hsh = hash(x, y, z);
      return hsh < 0.1 ? K('wax') : hsh < 0.2 ? K('ribbon') : (x + y) % 2 ? K('paper') : K('paper2');
    }, (x, y, z) => z > hw);
    return { extra: b.part('extra', [cx + 0.5, rail + 2.5, cz + 0.5], SHIP) };
  },
  // the school club's robot on its lookout deck: treads, a boxy body with an orange panel, a head with a visor and an
  // antenna with a light, one arm with a spanner; it looks about, and turns to wave the spanner for a hello
  robot() {
    const y0 = 7, x0 = 6;
    const b = box([x0, y0, -2], [x0 + 4, y0 + 7, 0]);
    for (const z of [-2, 0]) for (let x = x0; x <= x0 + 4; x += 1) b.put(x, y0, z, x % 2 ? C.iron1 : C.iron2);
    b.fill(x0, y0, -1, x0 + 4, y0, -1, K('bot3'));
    b.fill(x0 + 1, y0 + 1, -2, x0 + 3, y0 + 3, 0, (x, y, z) => (x === x0 + 3 && y === y0 + 2 && z === -1 ? K('visor') : x === x0 + 3 && z === -1 ? K('botPanel') : (x + y + z) % 4 === 0 ? K('bot2') : K('bot1')));
    b.fill(x0 + 1, y0 + 4, -2, x0 + 3, y0 + 5, 0, (x, y, z) => (x === x0 + 3 && y === y0 + 4 ? K('visor') : y === y0 + 5 ? K('bot2') : K('bot1')));
    b.put(x0 + 2, y0 + 6, -1, C.iron2); b.put(x0 + 2, y0 + 7, -1, K('antTip'));
    const arm = box([x0 + 1, y0, 1], [x0 + 6, y0 + 3, 1]);
    arm.fill(x0 + 2, y0 + 1, 1, x0 + 2, y0 + 3, 1, (x, y) => (y === y0 + 1 ? C.iron3 : K('bot2')));
    arm.fill(x0 + 3, y0 + 1, 1, x0 + 5, y0 + 1, 1, C.iron3); arm.put(x0 + 6, y0 + 1, 1, C.iron2); // a spanner
    const bot = b.part('extra', [x0 + 2.5, y0, -0.5], SHIP);
    return { extra: bot, arm: arm.part('arm', [x0 + 2.5, y0 + 3.5, 1], b) };
  },
};

// ---- the jetty: a planked walkway from a stone sill on the rim, a pier head on a tall stone pier that stands in the sea
// at the foot of the cliff, `drop` voxels below (coursed, battered out toward its foot, circuit light in its beds, two
// bands of runes, timber ties anchored into the cliff, a plinth of wet stone at the waterline with weed, barnacles,
// crystals and a ring of foam), knee braces, bollards with rope coiled round, a rope rail, a lantern, and the mooring
// mast: a banded post at the far corner, an arm to the brass collar that holds the nose, a beacon.
// The school club's berth has a parking meter.
function buildJetty(size, meter, drop) {
  const H = geo(size).mast, D = drop, j = box([-7, -D - 3, -18], [7, H + 6, 7]);
  const WOOD = [K('w3'), K('w4'), K('w3'), K('w5')];
  for (let z = -5; z <= 5; z += 1) for (let x = -3; x <= 2; x += 1) {
    const edge = x === -3 || x === 2;
    j.put(x, 0, z, edge ? K('w2') : hash(x, z, 2) < 0.1 ? K('w2') : WOOD[Math.floor(hash(z, 1, 3) * 4)]);
    if (edge || z % 3 === 0) j.put(x, -1, z, K('w1'));
  }
  j.fill(-4, 0, 6, 3, 0, 6, (x, y, z) => tone([K('st1'), K('st2'), K('st3')], x, y, z, 2));
  for (let z = -16; z <= -6; z += 1) for (let x = -5; x <= 4; x += 1) {
    const edge = x === -5 || x === 4 || z === -16 || z === -6;
    j.put(x, 0, z, edge ? K('w2') : hash(x, z, 4) < 0.1 ? K('w2') : WOOD[Math.floor(hash(x, 2, 5) * 4)]);
    if (edge) j.put(x, -1, z, K('w1'));
  }
  // the mast: a stout banded post at the pier head's far corner with a ladder up it, stayed by two shrouds; an arm
  // reaches from its top to the brass collar that holds the ship's nose, and a crystal beacon burns over the collar
  for (let y = 1; y <= H + 1; y += 1) for (const [x, z] of [[-5, -12], [-4, -12], [-5, -11], [-4, -11]]) j.put(x, y, z, y % 5 === 0 ? C.brass2 : (x + z + Math.floor(y / 2)) % 3 === 0 ? K('w2') : K('w1'));
  for (let y = 2; y < H - 1; y += 2) { j.put(-6, y, -12, K('w4')); j.put(-6, y, -11, K('w4')); }
  for (const z of [-16, -6]) wire(j, [-5.5, 1.5, z + 0.5], [-4.5, H - 1.5, z < -11 ? -12 : -10.5], (t, i) => (i % 3 ? K('rope1') : K('rope2')));
  j.fill(-5, H + 2, -12, -4, H + 2, -11, C.iron2);
  j.fill(-3, H + 1, -12, -2, H + 1, -11, (x) => (x === -3 ? C.brass1 : K('w2'))); // the arm
  for (let y = H - 1; y <= H + 2; y += 1) for (let z = -15; z <= -7; z += 1) for (let x = -4; x <= 3; x += 1) {
    const d = Math.hypot(x + 0.5, z + 11.5);
    if (y <= H + 1 ? d > 1.6 && d <= 2.9 : d <= 2.2) j.put(x, y, z, y === H + 2 ? (d > 1.4 ? C.brass2 : C.iron2) : y === H + 1 ? C.iron2 : (x + z) % 3 ? C.brass2 : C.brass1);
  }
  j.fill(-1, H + 3, -12, 0, H + 4, -11, (x, y, z) => ((x + y + z) % 2 ? K('crys2') : K('crys3'))); j.put(-1, H + 5, -12, K('crys1')); j.put(0, H + 5, -11, K('crys1'));
  // the pier: from the pier head down to the water (at y -D), battered out toward its foot, on a plinth at the waterline
  const tide = -D + 8; // below this the stone is wet
  for (let y = -1; y >= -D - 2; y -= 1) {
    const k = (-1 - y) / D, foot = y <= -D + 2, rp = foot ? 5.3 : k < 0.5 ? 3.9 : k < 0.8 ? 4.4 : 4.9; // battered in two steps
    const course = Math.floor((-y - 1) / 3), bed = (-y - 1) % 3 === 2;
    for (let z = -17; z <= -6; z += 1) for (let x = -6; x <= 5; x += 1) {
      const dx = x + 0.5, dz = z + 11.5, d = Math.hypot(dx, dz);
      if (d > rp) continue;
      const u = (Math.atan2(dz, dx) / (2 * Math.PI) + 0.5) * 10 + course * 0.5, seg = Math.floor(u);
      let id;
      if (d < rp - 1.3) id = K('mortar');
      else if (foot) id = y === -D + 2 ? (hash(x, z, 5) < 0.18 ? K('barn') : (x + z) % 4 ? K('st4') : K('mortar')) : hash(x, y, z) < 0.4 ? K('weed') : K('wet2');
      else if (y < tide) id = bed ? K('wet2') : hash(seg, 5) < 0.12 * (tide - y) ? K('weed2') : y === -D + 3 && hash(x, z, 3) < 0.3 ? K('barn') : K('wet1'); // the tide line: weed hanging in streaks, barnacles at the water
      else if (y === -10 || y === -11 || y === -D + 16 || y === -D + 17) id = seg % 3 ? K('rune') : K('mortar'); // two bands of runes
      else if (bed) id = hash(course, seg, 3) < 0.18 ? K('trace') : K('mortar');
      else if (u - seg < 0.1) id = K('mortar');
      else id = [K('st1'), K('st2'), K('st3'), K('st4')][Math.floor(hash(course, seg, 9) * 4)];
      if (y >= -2 && !bed && hash(x, y, z) < 0.3) id = K('moss');
      j.put(x, y, z, id);
    }
  }
  // foam round its foot on the water, crystals grown on the plinth, timber ties from the column into the cliff face
  for (let z = -18; z <= -5; z += 1) for (let x = -7; x <= 6; x += 1) {
    const d = Math.hypot(x + 0.5, z + 11.5), a = Math.floor((Math.atan2(z + 11.5, x + 0.5) / Math.PI + 1) * 5);
    if (d > 5.3 && d <= 6.6 && (d < 6 || a % 2)) j.put(x, -D, z, d < 6 ? K('foam') : K('foam2'));
  }
  for (const a of [0.7, 2.6, 4.4]) {
    const cx = Math.floor(-0.5 + Math.cos(a) * 4.2), cz = Math.floor(-11.5 + Math.sin(a) * 4.2), h = 2 + Math.floor(hash(cx, cz, 9) * 3);
    for (let y = 0; y < h; y += 1) { j.put(cx, -D + 3 + y, cz, y === h - 1 ? K('crys1') : y % 2 ? K('crys3') : K('crys2')); if (y < h - 2) j.put(cx + 1, -D + 3 + y, cz, K('crys2')); }
  }
  for (const y0 of [-14, -D + 22]) for (let z = -7; z <= 1; z += 1) for (let x = -1; x <= 0; x += 1) for (const y of [y0, y0 + 1]) j.put(x, y, z, z === -6 || z === -2 ? C.iron2 : (x + y + z) % 3 ? K('w2') : K('w1'));
  for (const [a, c] of [[[-3.3, -9, -11.5], [-5.5, -1.5, -11.5]], [[3.3, -9, -11.5], [4.5, -1.5, -11.5]], [[0.5, -9, -8.2], [0.5, -1.5, -3]]]) wire(j, a, c, K('w1'));
  // bollards with rope coiled round their feet, a rope rail on posts, a lantern at the jetty's foot
  for (const x of [-4, 3]) {
    j.fill(x, 1, -7, x, 2, -7, C.iron1); j.put(x, 3, -7, C.brass2);
    for (const [dx, dz] of [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]) j.put(x + dx, 1, -7 + dz, (dx + dz + 2) % 2 ? K('rope1') : K('rope2'));
  }
  for (const x of [-3, 2]) {
    for (const z of [5, 1, -3]) j.fill(x, 1, z, x, 4, z, K('w1'));
    wire(j, [x + 0.5, 4.5, 5.5], [x + 0.5, 4.5, 1.5], K('rope1'), 1.1); wire(j, [x + 0.5, 4.5, 1.5], [x + 0.5, 4.5, -2.5], K('rope2'), 1.1);
  }
  j.fill(3, 1, 5, 3, 10, 5, (x, y) => (y === 10 ? C.iron2 : K('w1'))); j.put(4, 10, 5, C.iron2); // a lantern at the jetty's foot
  j.put(4, 9, 5, C.iron2); j.put(4, 8, 5, K('lit2')); j.put(4, 7, 5, K('lit')); j.put(4, 6, 5, C.iron2);
  if (meter) { // the parking meter by the school club's berth: an iron post, a brass head with a coin slot, a window (its flag blinks)
    j.fill(-5, 0, 3, -5, 5, 3, C.iron2); j.fill(-6, 6, 3, -4, 8, 3, (x, y) => (y === 8 ? C.brass1 : C.brass2));
    j.put(-5, 9, 3, C.brass1); j.put(-5, 8, 4, C.iron1); j.put(-4, 7, 4, C.brass1); j.put(-6, 7, 4, C.brass1);
  }
  return j;
}

// Built once per size (and the school club's once): every berth of a size shares these grids.
const GRIDS = {};
function gridsOf(size, drop) {
  const key = `${size}:${drop}`;
  if (!GRIDS[key]) {
    const { G, hull, bag } = buildShip(size), S = size === 'S';
    GRIDS[key] = { G, hull: hull.part('hull', [0, 0, 0], SHIP), bag: bag.part('bag', [0, 0, 0], SHIP), prop: buildProp(size, S), jetty: buildJetty(size, S, drop).part('jetty', [0, 0, 0]) };
  }
  return GRIDS[key];
}

// Where things are on a berth (model voxels, berth frame unless said): the mast's nose point, the lantern, and in the
// ship's frame its middle, its centre from keel to pennant (for views) and its engine (for a halo).
export function berthInfo(size) {
  const G = geo(size);
  return { nose: [0, G.mast, -11], lantern: [4.5, 7.5, 5.5], mid: [G.len * 0.5, G.floor * 0.35, 0], centre: [G.len * 0.5, (G.keel + G.ym) / 2, 0], engine: [G.gx1 + 3.5, G.yc, 0], len: G.len, mast: G.mast, meter: [-4.5, 7.5, 4.5] };
}

// ship.drop: voxels from the berth's ground down to the water, where its pier stands (46 on the Sky Docks' cliff)
export function berth(ship) {
  const { size, yaw = Math.PI / 2, tint = 0xffffff, glow = 0xffffff, lamp = tint, holo, glyph, detail, drop = 46 } = ship;
  const G = geo(size);
  let built;
  return {
    gait: 'still',
    build() {
      if (built) return built;
      const g = gridsOf(size, drop);
      const parts = { jetty: g.jetty, ship: { grid: SHIP.g, at: [0, G.mast, -11], pivot: [0, 0, 0] }, bag: g.bag, hull: g.hull, prop: g.prop, sail: buildSail(size, glyph, holo), ...(DETAIL[detail]?.(G) || {}) };
      if (detail === 'robot') { const m = box([-5, 7, 4], [-5, 7, 4]); m.put(-5, 7, 4, K('expired')); parts.blink = m.part('blink', [-4.5, 7.5, 4.5]); }
      built = { parts };
      return built;
    },
    setup(ctx) {
      const { THREE, parts: P, mem } = ctx;
      P.ship.rotation.order = 'YXZ';
      // this ship's colours: its material tints the shared envelope, and the livery glow with it
      const solid = new THREE.MeshLambertMaterial({ vertexColors: true, color: tint }), shine = new THREE.MeshBasicMaterial({ vertexColors: true, color: glow });
      P.bag.traverse((o) => { if (o.isMesh) o.material = o.material.isMeshBasicMaterial ? shine : solid; });
      mem.bag = solid; mem.tint = new THREE.Color(lamp); // the district lights the envelope from inside at night
      if (P.extra && (detail === 'boosters' || detail === 'robot')) { // their own glow, to flicker and blink
        mem.flame = new THREE.MeshBasicMaterial({ vertexColors: true });
        P.extra.traverse((o) => { if (o.isMesh && o.material.isMeshBasicMaterial && o.parent.parent === P.extra) o.material = mem.flame; });
      }
      mem.ph = hash(ship.key.length, ship.key.charCodeAt(0), 3) * 6.28;
      mem.n = ship.key.charCodeAt(1);
      mem.greetAt = -100;
      mem.spin = mem.ph;
      mem.look = 0;
      // the whistle, for the toot of steam
      mem.whistle = new THREE.Object3D();
      mem.whistle.position.set(size === 'S' ? G.gx1 - 1.5 : G.gx1 - 8.5, size === 'S' ? G.rail + 4 : G.floor + (size === 'L' ? 5 : 4) + 5, size === 'S' ? 1.5 : 2.5);
      P.hull.add(mem.whistle);
      ctx.greet = () => {
        mem.greetAt = ctx.state.t;
        const at = ctx.where(mem.whistle);
        // a toot of steam, blown out from under the envelope toward the ship's show side (+x in the berth)
        for (let k = 0; k < 16; k += 1) ctx.after(k * 0.04, () => ctx.bit(at.x, at.y, at.z, 1.2 + (k % 4) * 0.2, 0.4 + (k % 3) * 0.2, ((k * 7) % 5 - 2) * 0.12, 0.8, 0.09, 0xffffff, 0xcfe6ff, { drag: 1.4 }));
      };
    },
    idle(ctx, dt) {
      const { parts: P, state: { t }, mem } = ctx;
      const g = t - mem.greetAt, hello = g >= 0 && g < 4 ? Math.sin(Math.PI * Math.min(1, g / 4)) : 0;
      // a gust now and then: the ship swings off the wind, leans on its mooring and settles back
      const tt = t + mem.ph * 5, gk = Math.floor(tt / 8.5), gu = tt - gk * 8.5, gust = hash(gk, mem.n, 5) < 0.6 ? Math.sin(Math.PI * clamp01(gu / 2.8)) ** 2 : 0;
      P.ship.rotation.y = yaw + 0.035 * Math.sin(t * 0.31 + mem.ph) + 0.012 * Math.sin(t * 0.83 + mem.ph * 2) + 0.06 * gust;
      P.ship.rotation.z = 0.022 * Math.sin(t * 0.7 + mem.ph) - 0.025 * gust + 0.018 * hello * Math.sin(g * 4); // the bob: the tail rises and falls
      P.ship.rotation.x = 0.018 * Math.sin(t * 0.53 + mem.ph * 3) + 0.03 * gust - 0.05 * hello; // a roll, and toward the jetty to say hello
      // the propeller idles, revving for a hello; the school club's is clamped, and strains against it every few seconds
      if (detail === 'robot') { const k = (t + mem.ph) % 2.6; P.prop.rotation.x = k < 0.5 ? 0.16 * Math.sin((k / 0.5) * Math.PI) * (1 + hello) : 0; }
      else { mem.spin += dt * (2.2 + 11 * hello); P.prop.rotation.x = mem.spin; }
      // the pennant flies, flutters and glitches
      P.sail.rotation.y = 0.14 * Math.sin(t * 2.3 + mem.ph) + 0.05 * Math.sin(t * 5.7) + 0.12 * gust;
      P.sail.rotation.x = 0.04 * Math.sin(t * 3.1 + mem.ph);
      P.sail.scale.set(hash(Math.floor(t * 12), mem.n) < 0.012 ? 0 : 1 + 0.2 * hello, 1 + 0.03 * Math.sin(t * 4.3) + 0.12 * hello, 1);
      const X = P.extra;
      if (detail === 'nest') { // the lookout sweeps the sky, and swings round to the jetty for a hello
        const k = Math.floor(t / 3.2), want = hello > 0 ? -1.9 : (hash(k, 11) - 0.5) * 3.4;
        mem.look += (want - mem.look) * Math.min(1, dt * 1.6);
        X.rotation.y = mem.look;
      } else if (detail === 'owl') { // turns in jerks, the way owls do, mostly toward the viewer's side; faces the jetty and bobs for a hello
        const k = Math.floor(t / 2.3), want = hello > 0 ? 0 : [1.1, 0.4, 1.5, 0.9, -0.3][Math.floor(hash(k, 13) * 5)];
        mem.look += (want - mem.look) * Math.min(1, dt * 9);
        X.rotation.y = mem.look;
        X.scale.y = 1 - 0.1 * hello * Math.abs(Math.sin(g * 9));
      } else if (detail === 'sounding' || detail === 'net') { // swings under the ship like a pendulum
        X.rotation.z = 0.05 * Math.sin(t * 1.15 + mem.ph) + 0.05 * gust;
        X.rotation.x = 0.04 * Math.sin(t * 0.83 + 1) + 0.08 * hello * Math.sin(g * 3);
      } else if (detail === 'boosters') { // the plasma flickers and the tubes shudder; they flare for a hello
        mem.flame.color.setScalar(0.72 + 0.2 * Math.sin(t * 31) + 0.12 * Math.sin(t * 17 + 1) + 0.5 * hello);
        X.position.y += 0.12 * Math.sin(t * 43) * (0.4 + hello);
      } else if (detail === 'robot') { // looks about the harbour; turns out to wave its spanner for a hello; its visor blinks
        const turn = smooth(g / 0.5) * (1 - smooth((g - 3.4) / 0.5)) * (g >= 0 ? 1 : 0);
        const k = Math.floor(t / 2.7), look = [0, 0.7, -0.5, 1.4, 0.2][Math.floor(hash(k, 19) * 5)];
        mem.look += (look - mem.look) * Math.min(1, dt * 4);
        X.rotation.y = mem.look * (1 - turn) - Math.PI / 2 * turn;
        P.arm.rotation.z = 0.25 * Math.sin(t * 2.1) * (1 - turn);
        P.arm.rotation.x = -turn * (2.3 + 0.35 * Math.sin(g * 13));
        mem.flame.color.setScalar(hash(Math.floor(t * 3), 17) < 0.1 ? 0.25 : 1);
        P.blink.scale.setScalar((t % 1.2) < 0.6 ? 1 : 0);
      }
    },
    act(ctx) { ctx.greet(); },
  };
}

// A self-check: node js/models/dock_airship.js (every size builds; bag and hull never share a voxel; the ramp's
// tip lands on the pier head's deck; the gondola hangs clear beyond the pier head)
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  for (const size of ['L', 'M', 'S']) {
    const { G, hull, bag } = buildShip(size);
    let both = 0, n = 0;
    for (let i = 0; i < bag.g.data.length; i += 1) { if (bag.g.data[i] && hull.g.data[i]) both += 1; if (hull.g.data[i]) n += 1; }
    if (both) throw new Error(`${size}: bag and hull overlap at ${both} voxels`);
    const tipY = G.floor - 3 + G.mast; // the ramp's tip in the berth frame
    if (tipY !== 1) throw new Error(`${size}: the ramp's tip is at ${tipY}, not on the deck`);
    const tipZ = -11 - 3, bowZ = -11 - G.gx0; // the ship points out along the berth's -z from the collar at z -11
    if (tipZ < -16 || tipZ > -6) throw new Error(`${size}: the ramp's tip misses the pier head`);
    if (bowZ >= -16) throw new Error(`${size}: the gondola would sit on the pier head`);
    console.log(size, 'hull voxels', n, 'mast', G.mast, 'floor', G.floor);
  }
  for (const d of Object.keys(DETAIL)) DETAIL[d](geo(d === 'nest' ? 'L' : d === 'robot' ? 'S' : 'M'));
  const j = buildJetty('M', false, 46); // the pier is stone all the way from its head down into the water
  for (let y = -1; y >= -47; y -= 1) if (!j.at(-1, y, -12)) throw new Error(`the pier stops at ${y}, over the water`);
  console.log('dock_airship.js ok');
}
