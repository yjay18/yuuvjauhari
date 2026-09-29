// The Academy's school (colours acad_), after The Mother's International School, Delhi.
//   school()  a two-storey hall in the school's light blue with cream trim: a plinth and an arcaded verandah
//             (seven arches, the middle one wider over the steps, lanterns hanging in the bays, a red oxide
//             floor), an upper storey of windows between deeper blue shutters (a few lit, one the computer
//             room's cyan, one shuttered), and over the entrance the school's emblem, a white dove with raised
//             feathered wings and a small wheel on its chest, glowing softly on a deep blue medallion with a
//             cream rim, ringed with light. A cornice
//             with a line of circuit light under it, a parapet, a small clock tower whose hands go round
//             (a backlit face, a vane on top), a black water tank and the tech club's radio mast on the roof.
//             ctx.chime(): the hands whirl round two hours, the face and the dove's ring flash, motes fly.
//   robot()   a little rover from MINET, the school's technology club: an orange chassis on four wheels, a
//             screen face with green eyes, an antenna with a glowing tip and a claw arm. It trundles round
//             the yard on its own (x, z radii in world units), stopping now and then to look about;
//             ctx.cheer() makes it hop, spin and wave.
// Model voxels, origin at the base centre (voxel column 0 is the middle), front +z.
import { C, colour, hash, noise } from '../kit/voxel-kit.js';
import { box, tone, smooth } from './space.js';

const col = (n, hex, glow = false) => C[n] ?? colour(n, hex, glow);
for (const [n, hex, glow] of [
  ['sb1', 0x96c6ea], ['sb2', 0x88bae2], ['sb3', 0xa8d3f1], ['sb4', 0x7aabd5], ['sbd', 0x6893bd],
  ['cr1', 0xf3ead3], ['cr2', 0xe6dbbe], ['cr3', 0xd2c5a3],
  ['sh1', 0x3669a8], ['sh2', 0x2d5b95], ['sh3', 0x224878],
  ['ver1', 0x5c85b0], ['ver2', 0x4f77a2], ['tile1', 0x9a4a3a], ['tile2', 0x83402f],
  ['door1', 0x5a3a22], ['door2', 0x6e4a2c], ['roof1', 0x74787e], ['roof2', 0x64686e], ['tank', 0x202226], ['tank2', 0x2c2f35],
  ['face', 0xfff3d6, true], ['mark', 0x2a2a32], ['hand', 0x1c1c24],
  ['dove1', 0xf6f8ff, true], ['dove2', 0xe2e4ea], ['dove3', 0xbcc4d4], ['doveEye', 0x1a1a22], ['beak', 0xe89a3a],
  ['wheel', 0x2f63a8], ['hub', 0x9fe0ff, true], ['halo1', 0x7fd8ff, true], ['halo2', 0xd8f6ff, true],
  ['warm1', 0xffc764, true], ['warm2', 0xffe6a8, true], ['cyan', 0x7ff0ff, true], ['glass', 0x223044], ['glass2', 0x2e3f58], ['red', 0xff4a3a, true],
  ['rb1', 0xe36c2e], ['rb2', 0xc95a22], ['rb3', 0xf5904e], ['rbd', 0x8a3a18], ['scr', 0x10191f],
  ['eye', 0x6bff9a, true], ['eye2', 0xd8ffe6, true], ['tip', 0xff5a3c, true], ['tire', 0x26262c], ['rim', 0xa0a0a8],
]) col(`acad_${n}`, hex, glow);
const K = (n) => C[`acad_${n}`];
const PL = [K('sb1'), K('sb1'), K('sb2'), K('sb3')];
const CR = [K('cr1'), K('cr1'), K('cr2')];
const plaster = (x, y, z) => {
  if (y <= 4 && noise(x + z, y * 2, 4, 3) > 0.5 + (y - 2) * 0.06) return hash(x, y, z) < 0.5 ? K('sbd') : K('sb4'); // damp rising off the plinth
  if (noise(x * 0.8 + z, y * 0.22, 3, 5) > 0.74) return K('sb4'); // rain streaks
  return tone(PL, x, y, z, 1);
};
const cream = (x, y, z) => (hash(x, y, z + 11) < 0.07 ? K('cr3') : tone(CR, x, y, z, 2));

// The arcade's openings (x0..x1): the middle one wider, its arch taller; all spring at y 16.
const BAYS = [[-31, -26], [-23, -18], [-15, -10], [-5, 5], [10, 15], [18, 23], [26, 31]];
const SPRING = 16;
const bayOf = ([x0, x1]) => ({ c: (x0 + x1 + 1) / 2, half: (x1 - x0 + 1) / 2 });
const inArch = (x, y, bay) => { const { c, half } = bayOf(bay); return Math.abs(x + 0.5 - c) <= half && (y < SPRING || (x + 0.5 - c) ** 2 + (y + 0.5 - SPRING) ** 2 <= half * half); };
export const SCHOOL = { x0: -35, x1: 35, z0: -11, z1: 12 };

// The dove, relative to the medallion's centre (dx right, dy up, voxels): wings raised either side of the
// head (coverts along the leading edge, long flight feathers with ragged tips along the trailing one), a round
// body with the wheel on its chest, a small head with dark eyes and a beak, a fanned tail.
function dove(dx, dy) {
  const ax = Math.abs(dx);
  if (dy >= 2 && dy <= 4 && ax <= 1 && !(dy === 4 && ax === 1)) return dy === 3 && ax === 1 ? K('doveEye') : dy === 2 && dx === 0 ? K('beak') : K('dove1');
  const r = Math.hypot(dx / 2.5, (dy + 1.6) / 3.3);
  if (r <= 1) {
    const w = Math.hypot(dx, dy + 1.4);
    if (w <= 0.7) return K('hub');
    if (w <= 1.7) return K('wheel');
    return dx > 0 && r > 0.72 ? K('dove2') : K('dove1');
  }
  if (dy <= -4 && dy >= -7 && ax <= 0.5 + (-4 - dy) * 0.75) return (dx + 10) % 2 ? K('dove3') : K('dove1'); // the tail
  const [sx, sy, tx, ty] = [1.8, -0.8, 4.4, 6.6]; // shoulder to wingtip
  const len = Math.hypot(tx - sx, ty - sy), ux = (tx - sx) / len, uy = (ty - sy) / len;
  const px = ax - sx, py = dy - sy, along = px * ux + py * uy, off = px * uy - py * ux, t = along / len;
  if (t < -0.1 || t > 1.08 || (t < 0 && off > 1)) return 0;
  const win = 1.1 - 0.5 * t, wout = 3.9 - 2.2 * t + Math.abs(((along * 0.8) % 1) - 0.5);
  if (off < -win || off > wout) return 0;
  if (off > wout - 1.5) return Math.floor(along * 0.8) % 2 ? K('dove3') : K('dove2');
  return off < -0.2 ? K('dove1') : Math.floor(along) % 2 ? K('dove1') : K('dove2');
}

function hall() {
  const b = box([-36, 0, -12], [36, 79, 12]);
  // ---- the plinth, steps up to the middle arch, the verandah's red oxide floor
  b.fill(-35, 0, -11, 35, 1, 10, (x, y, z) => (z === 10 || z === -11 || Math.abs(x) === 35 ? (y === 1 ? K('cr2') : K('cr3')) : K('cr3')));
  b.fill(-6, 0, 11, 6, 0, 12, (x, y, z) => (z === 12 ? K('cr3') : K('cr2')));
  b.fill(-6, 1, 11, 6, 1, 11, K('cr2'));
  b.fill(-34, 1, 3, 34, 1, 7, (x, y, z) => (Math.floor((x + 40) / 2) + Math.floor(z / 2)) % 2 ? K('tile1') : K('tile2'));
  // ---- the rooms behind (z -10..2) and the upper storey over the verandah
  b.fill(-34, 2, -10, 34, 47, 2, plaster);
  b.fill(-34, 25, 3, 34, 47, 9, plaster);
  // ---- the arcade: piers and spandrels in front (z 8..9), the verandah open behind them, closed at the ends
  for (let y = 2; y <= 24; y += 1) for (let x = -34; x <= 34; x += 1) {
    const end = Math.abs(x) >= 32;
    for (let z = 3; z <= 9; z += 1) {
      if (!end && z < 8) continue;
      if (!end && BAYS.some((bay) => inArch(x, y, bay))) continue;
      b.put(x, y, z, plaster(x, y, z));
    }
  }
  // the verandah's inner wall in shade, a door behind every arch with a lit fanlight, lanterns hanging in the bays
  b.fill(-31, 2, 2, 31, 24, 2, (x, y, z) => tone([K('ver1'), K('ver1'), K('ver2')], x, y, z, 3));
  BAYS.forEach((bay, i) => {
    const { c, half } = bayOf(bay), mid = i === 3, w = mid ? 3 : 2, h = mid ? 13 : 11;
    for (let y = 2; y <= h + 3; y += 1) for (let x = Math.floor(c - w); x < Math.ceil(c + w); x += 1) {
      const edge = x === Math.floor(c - w) || x === Math.ceil(c + w) - 1;
      if (y <= h) b.put(x, y, 2, edge ? K('cr2') : (x + 40) % 2 ? K('door1') : K('door2'));
      else b.put(x, y, 2, y === h + 3 || edge ? K('cr2') : (x + y) % 3 ? K('warm1') : K('warm2'));
    }
    const lx = Math.floor(c - 0.5);
    b.fill(lx, 11, 5, lx + 1, 24, 6, (x, y, z) => (y >= 11 && y <= 13 ? (y === 12 ? K('warm2') : (x + z) % 2 ? K('warm1') : C.iron2) : y === 14 ? C.iron2 : x === lx && z === 5 ? C.iron1 : 0));
    // cream archivolt and keystone on the face, cream imposts on the piers
    for (let y = SPRING - 1; y <= SPRING + half + 2; y += 1) for (let x = Math.floor(c - half - 2); x <= Math.ceil(c + half + 1); x += 1) {
      const r = Math.hypot(x + 0.5 - c, y + 0.5 - SPRING);
      if (y >= SPRING && r > half && r <= half + 1.15) b.put(x, y, 9, cream(x, y, 9));
      if (y >= SPRING - 1 && y <= SPRING - 0 && (Math.abs(x + 0.5 - c) > half && Math.abs(x + 0.5 - c) <= half + 1.5)) b.put(x, y, 10, K('cr1'));
    }
    const top = Math.floor(SPRING + half);
    for (let x = Math.floor(c - 1); x <= Math.ceil(c) - (mid ? 0 : 0); x += 1) { b.put(x, top, 10, K('cr1')); b.put(x, top + 1, 10, K('cr1')); }
  });
  // ---- a string course between the storeys, windows with shutters above the side arches
  b.fill(-35, 25, 10, 35, 26, 10, (x, y, z) => (y === 26 ? K('cr1') : cream(x, y, z)));
  BAYS.forEach((bay, i) => {
    if (i === 3) return;
    const [x0, x1] = bay, r = hash(x0, 7), shut = i === 5, room = r < 0.35 ? 'dark' : i === 1 || i === 4 ? 'cyan' : 'warm';
    for (let y = 30; y <= 39; y += 1) for (let x = x0; x <= x1; x += 1) {
      const side = x === x0 || x === x1;
      if (shut || side) { b.put(x, y, 10, y === 30 || y === 39 || (shut && (x === x0 || x === x1)) ? K('sh2') : y % 2 ? K('sh1') : K('sh3')); continue; }
      const frame = x === x0 + 1 || x === x1 - 1 || y === 30 || y === 39 || y === 35;
      if (frame) { b.put(x, y, 9, K('cr1')); continue; }
      b.cut(x, y, 9);
      b.put(x, y, 8, room === 'dark' ? ((x + y) % 3 ? K('glass') : K('glass2')) : room === 'cyan' ? (y > 35 ? K('cyan') : K('glass2')) : (x + y) % 4 ? K('warm1') : K('warm2'));
    }
    b.fill(x0, 29, 10, x1, 29, 10, K('cr1'));
    b.fill(x0, 40, 10, x1, 40, 10, K('cr1'));
    b.fill(x0 + 1, 41, 9, x1 - 1, 41, 9, K('cr2'));
    for (let y = 26; y >= 22; y -= 1) if (hash(x0, y, 3) < 0.5) b.put(x0 + 3, y - 20, 9, K('sb4')); // a streak under the sill
  });
  // ---- the emblem over the entrance: a cream medallion, a deeper blue rim, the dove standing proud of it
  for (let y = 27; y <= 45; y += 1) for (let x = -9; x <= 9; x += 1) {
    const r = Math.hypot(x, y - 36);
    if (r <= 7.3) b.put(x, y, 10, hash(x, y, 5) < 0.3 ? K('sh2') : K('sh1'));
    else if (r <= 8.3) b.put(x, y, 10, (x + y) % 5 === 0 ? K('cr2') : K('cr1'));
    const d = r <= 7.3 ? dove(x, y - 36) : 0;
    if (d) b.put(x, y, 11, d);
  }
  // ---- a line of circuit light under the cornice, the cornice, the parapet and its coping
  b.fill(-34, 44, 10, 34, 44, 10, (x) => (hash(Math.floor((x + 40) / 5), 44) < 0.6 ? ((x + 40) % 5 === 0 ? K('halo2') : K('halo1')) : K('cr2')));
  b.fill(-35, 45, -11, 35, 45, 10, (x, y, z) => cream(x, y, z));
  b.fill(-36, 46, -12, 36, 46, 11, (x, y, z) => (z === 11 || z === -12 || Math.abs(x) === 36 ? ((x + 40) % 2 ? K('cr1') : 0) : K('cr1')));
  b.fill(-36, 47, -12, 36, 47, 11, (x, y, z) => (z === 11 || z === -12 || Math.abs(x) === 36 ? K('cr1') : Math.abs(x) <= 33 && z >= -9 && z <= 8 ? tone([K('roof1'), K('roof2')], Math.floor(x / 3), 47, Math.floor(z / 3), 6) : K('cr2')));
  for (let y = 48; y <= 51; y += 1) for (let z = -11; z <= 10; z += 1) for (let x = -35; x <= 35; x += 1) {
    const edge = z >= 9 || z <= -10 || Math.abs(x) >= 34;
    if (!edge) continue;
    b.put(x, y, z, y === 51 ? K('cr1') : y === 49 && z >= 9 && (x + 40) % 4 === 0 ? K('cr2') : plaster(x, y, z));
  }
  // ---- the clock tower: blue with cream quoins, a cornice, a stepped cap, a rod for the vane
  for (let y = 48; y <= 66; y += 1) for (let z = -2; z <= 7; z += 1) for (let x = -7; x <= 7; x += 1) {
    const cornerX = Math.abs(x) === 7, cornerZ = z === -2 || z === 7;
    let id = plaster(x, y, z);
    if ((cornerX || cornerZ) && (cornerX ? Math.abs(z - 2.5) >= 3.5 - (Math.floor((y - 48) / 3) % 2 ? 2 : 1) : Math.abs(x) >= 7 - (Math.floor((y - 48) / 3) % 2 ? 2 : 1))) id = (y - 48) % 3 === 2 ? K('cr3') : K('cr1');
    if (y === 51) id = K('cr2');
    b.put(x, y, z, id);
  }
  for (let x = -7; x <= 7; x += 1) for (let y = 52; y <= 66; y += 1) { const r = Math.hypot(x, y - 59); if (r > 5.3 && r <= 6.5) b.put(x, y, 8, (Math.round(Math.atan2(y - 59, x) * 6) + 60) % 2 ? K('cr1') : C.brass2); }
  b.fill(-8, 67, -3, 8, 67, 8, (x, y, z) => cream(x, y, z));
  b.fill(-8, 68, -3, 8, 68, 8, (x, y, z) => (Math.abs(x) === 8 || z === -3 || z === 8 ? ((x + z) % 2 ? K('cr1') : K('cr2')) : K('cr2')));
  b.fill(-6, 69, -1, 6, 69, 6, K('cr1'));
  b.fill(-4, 70, 0, 4, 70, 5, K('cr2'));
  b.fill(-2, 71, 1, 2, 71, 4, K('cr1'));
  b.fill(0, 72, 2, 0, 75, 2, (x, y) => (y === 75 ? C.brass2 : C.iron2));
  // ---- on the roof: a black water tank on its stand, the club's radio mast
  for (let y = 48; y <= 53; y += 1) for (let z = -9; z <= -2; z += 1) for (let x = -28; x <= -21; x += 1) {
    const r = Math.hypot(x + 0.5 + 24, z + 0.5 + 5.5);
    if (y === 48) { if ((x === -27 || x === -22) && (z === -8 || z === -3)) b.put(x, y, z, C.iron2); continue; }
    if (r <= 3.4) b.put(x, y, z, y === 53 ? (r < 1.2 ? K('tank2') : K('tank')) : (y + Math.round(Math.atan2(z + 5, x + 24) * 3)) % 4 === 0 ? K('tank2') : K('tank'));
  }
  b.fill(24, 48, -6, 24, 61, -6, (x, y) => (y % 4 === 0 ? C.iron3 : C.iron1));
  for (const [y, w] of [[54, 2], [58, 1]]) b.fill(24 - w, y, -6, 24 + w, y, -6, C.iron2);
  b.fill(22, 48, -8, 26, 48, -4, (x, y, z) => ((x + z) % 2 ? C.iron2 : 0));
  return b;
}

function schoolParts() {
  const face = box([-6, 53, 8], [6, 65, 8]);
  for (let y = 53; y <= 65; y += 1) for (let x = -6; x <= 6; x += 1) {
    const r = Math.hypot(x, y - 59);
    if (r > 5.3) continue;
    const a = Math.atan2(y - 59, x), h = Math.round((a / (Math.PI * 2)) * 12);
    const mark = r > 3.9 && r <= 5.1 && Math.abs(a - (h * Math.PI * 2) / 12) * r < 0.55;
    face.put(x, y, 8, mark ? K('mark') : K('face'));
  }
  const hour = box([0, 59, 9], [0, 62, 9]);
  hour.fill(0, 59, 9, 0, 62, 9, K('hand'));
  const minute = box([0, 58, 10], [0, 64, 10]);
  minute.fill(0, 58, 10, 0, 64, 10, (x, y) => (y === 59 ? C.brass2 : K('hand')));
  const ring = box([-9, 26, 10], [9, 46, 10]);
  for (let y = 26; y <= 46; y += 1) for (let x = -9; x <= 9; x += 1) { const r = Math.hypot(x, y - 36); if (r > 8.3 && r <= 9.2) ring.put(x, y, 10, (x + y) % 3 ? K('halo1') : K('halo2')); }
  const blink = box([24, 62, -6], [24, 62, -6]);
  blink.put(24, 62, -6, K('red'));
  const vane = box([-3, 76, 2], [3, 78, 2]);
  vane.fill(-3, 76, 2, 3, 76, 2, (x) => (x === 0 ? C.iron2 : C.brass2));
  vane.fill(-3, 77, 2, -2, 77, 2, C.brass2); vane.put(3, 77, 2, C.brass1); vane.put(-3, 78, 2, C.brass2);
  vane.put(0, 77, 2, K('halo2')); vane.put(0, 78, 2, K('halo1'));
  return {
    hall: hall().part('hall', [0, 0, 0]),
    face: face.part('face', [0.5, 59.5, 8.5]),
    hour: hour.part('hour', [0.5, 59.5, 9.5]),
    minute: minute.part('minute', [0.5, 59.5, 10.5]),
    ring: ring.part('ring', [0.5, 36.5, 10.5]),
    blink: blink.part('blink', [24.5, 62.5, -5.5]),
    vane: vane.part('vane', [0.5, 76, 2.5]),
  };
}

let schoolBuilt = null;
export function school() {
  return {
    gait: 'still',
    build() { schoolBuilt ??= { parts: schoolParts() }; return schoolBuilt; },
    setup(ctx) {
      const { mem, state, parts, THREE } = ctx;
      mem.chimeAt = -100;
      ctx.chime = () => { mem.chimeAt = state.t; mem.flew = false; };
      mem.glow = ['face', 'ring'].map((n) => {
        const m = new THREE.MeshBasicMaterial({ vertexColors: true });
        parts[n].traverse((o) => { if (o.isMesh && o.material.isMeshBasicMaterial) o.material = m; });
        return m;
      });
    },
    idle(ctx) {
      const { parts: P, state: { t }, mem } = ctx;
      const u = t - mem.chimeAt, whirl = u >= 0 ? smooth(u / 1.8) : 0;
      // the hands: the minute hand round in a minute, the hour hand twelve times slower; a chime sends them round two hours
      const m = (t / 60) * Math.PI * 2 + 1.2 + whirl * Math.PI * 4, h = (t / 720) * Math.PI * 2 + 5.3 + (whirl * Math.PI) / 3;
      P.minute.rotation.z -= m;
      P.hour.rotation.z -= h;
      const flash = u >= 0 && u < 2.5 ? Math.exp(-2 * u) * (0.5 + 0.5 * Math.cos(u * 18)) : 0;
      mem.glow[0].color.setScalar(0.86 + 0.14 * flash);
      mem.glow[1].color.setScalar(0.55 + 0.25 * Math.sin(t * 1.7) ** 2 + 0.45 * flash);
      if (u > 0.3 && !mem.flew) { mem.flew = true; ctx.burst({ x: 0.08, y: 59.5 * ctx.voxel, z: 10 * ctx.voxel }, 20, 1.6, [0xfff3d6, 0x7fd8ff], 0.06, 1.2); }
      P.ring.scale.setScalar(1 + 0.05 * flash);
      P.blink.scale.setScalar((t % 1.7) < 0.22 || ((t % 1.7) > 0.45 && (t % 1.7) < 0.6) ? 1 : 0); // the mast light blinks twice
      P.vane.rotation.y += 0.6 * Math.sin(t * 0.31) + 0.25 * Math.sin(t * 0.83 + 1);
    },
    act(ctx) { ctx.chime(); },
  };
}

// ---------------------------------------------------------------------------------------------
// The robot: x -5..4 across its wheels, z -4..5, 16 high at the antenna's tip.
function robotParts() {
  const body = box([-4, 3, -3], [3, 14, 5]);
  for (let y = 3; y <= 10; y += 1) for (let z = -3; z <= 3; z += 1) for (let x = -4; x <= 3; x += 1) {
    const corner = (x === -4 || x === 3) && (z === -3 || z === 3);
    if (corner && (y === 3 || y === 10)) continue;
    let id = y === 10 ? K('rb3') : y === 6 ? K('rbd') : tone([K('rb1'), K('rb1'), K('rb2')], x, y, z, 4);
    if ((x === -4 || x === 3) && y >= 7 && y <= 9 && z >= -1 && z <= 1) id = (y + z) % 2 ? K('rbd') : K('rb2'); // side vents
    if (z === -3 && y >= 7 && y <= 8 && Math.abs(x + 0.5) < 2) id = y === 8 ? K('eye') : K('rbd'); // a status light on its back
    body.put(x, y, z, id);
  }
  for (let y = 4; y <= 9; y += 1) for (let x = -3; x <= 2; x += 1) body.put(x, y, 4, x === -3 || x === 2 || y === 4 || y === 9 ? K('rbd') : K('scr')); // the screen face
  for (const [x, y] of [[-3, 9], [2, 9], [-3, 4], [2, 4]]) body.put(x, y, 4, K('rim')); // bolts
  body.fill(-1, 11, -1, 0, 11, 0, C.iron2); body.fill(-1, 12, -1, -1, 14, -1, (x, y) => (y === 13 ? C.brass2 : C.iron3));
  const eyes = box([-2, 6, 5], [1, 8, 5]);
  for (const x of [-2, 1]) { eyes.put(x, 7, 5, K('eye')); eyes.put(x, 8, 5, K('eye2')); }
  eyes.put(-1, 6, 5, K('eye')); eyes.put(0, 6, 5, K('eye'));
  const tip = box([-1, 15, -1], [-1, 16, -1]);
  tip.fill(-1, 15, -1, -1, 16, -1, (x, y) => (y === 16 ? K('eye2') : K('tip')));
  const arm = box([4, 3, -1], [5, 8, 2]);
  arm.fill(4, 6, 0, 4, 8, 0, K('rbd')); arm.fill(4, 5, 0, 5, 5, 1, C.iron3); arm.put(5, 4, 0, C.iron2); arm.put(5, 4, 1, C.iron2); arm.put(4, 4, 1, C.iron2);
  const wheels = (zc, name) => {
    const w = box([-5, 0, Math.floor(zc - 2.4)], [4, 5, Math.ceil(zc + 2.4)]);
    for (let y = 0; y <= 5; y += 1) for (let z = Math.floor(zc - 2.4); z <= Math.ceil(zc + 2.4); z += 1) {
      const r = Math.hypot(y + 0.5 - 2.5, z + 0.5 - zc);
      if (r > 2.4) continue;
      for (const x of [-5, 4]) w.put(x, y, z, r <= 1 ? K('rim') : Math.abs(y + 0.5 - 2.5) < 0.6 && r < 2 ? C.iron2 : (Math.round(Math.atan2(y - 2, z - zc) * 3) + 12) % 2 ? K('tire') : C.iron1);
    }
    return w.part(name, [0, 2.5, zc]);
  };
  return {
    body: body.part('body', [0, 3, 0]),
    eyes: eyes.part('eyes', [-0.5, 7, 5.5]),
    tip: tip.part('tip', [-0.5, 15, -0.5]),
    arm: arm.part('arm', [4.5, 8.5, 0.5]),
    wheelsF: wheels(3, 'wheelsF'),
    wheelsB: wheels(-2, 'wheelsB'),
  };
}
let robotBuilt = null;
export function robot(rx = 1.6, rz = 0.7) {
  return {
    gait: 'still',
    build() { robotBuilt ??= { parts: robotParts() }; return robotBuilt; },
    setup(ctx) { ctx.mem.cheerAt = -100; ctx.cheer = () => { ctx.mem.cheerAt = ctx.state.t; ctx.mem.burst = false; }; },
    idle(ctx) {
      const { parts: P, state: { t }, mem, pose, voxel: V } = ctx;
      // round the oval, seven seconds on, a second and a half stopped to look about
      const cyc = 8.5, run = 7, k = Math.floor(t / cyc), f = t - k * cyc, going = f < run;
      const s = ((k * run + Math.min(f, run)) / 13) * Math.PI * 2;
      const x = rx * Math.cos(s), z = rz * Math.sin(s);
      pose.position.x += x; pose.position.z += z;
      pose.rotation.y += Math.atan2(-rx * Math.sin(s), rz * Math.cos(s));
      const roll = (s * (rx + rz)) / 2 / (2.4 * V); // wheel turns for the distance covered
      P.wheelsF.rotation.x += roll; P.wheelsB.rotation.x += roll;
      P.body.position.y += going ? 0.25 * Math.abs(Math.sin(t * 13)) : 0;
      P.body.rotation.z += going ? 0.02 * Math.sin(t * 9) : 0;
      const look = going ? 0 : Math.sin((f - run) * 4) * 0.9;
      P.eyes.position.x += look;
      P.eyes.scale.y = (t % 3.3) < 0.12 ? 0.2 : 1; // it blinks
      P.tip.scale.setScalar(0.8 + 0.35 * Math.max(0, Math.sin(t * 5)));
      P.arm.rotation.x += going ? -0.2 + 0.1 * Math.sin(t * 3) : -0.6 + 0.3 * Math.sin(t * 5);
      // a cheer: a hop, a spin, the arm up and waving, sparks off the antenna
      const u = t - mem.cheerAt;
      if (u >= 0 && u < 1.6) {
        const e = smooth(u / 0.2) * (1 - smooth((u - 1.3) / 0.3));
        pose.position.y += 0.3 * Math.max(0, Math.sin((u / 0.45) * Math.PI)) * (u < 0.9 ? 1 : 0);
        pose.rotation.y += Math.PI * 2 * smooth(u / 1.1);
        P.arm.rotation.z += 2.4 * e; P.arm.rotation.x += 0.5 * Math.sin(u * 18) * e;
        P.tip.scale.setScalar(1.6 * e + 0.8);
        if (u > 0.2 && !mem.burst) { mem.burst = true; ctx.burst({ x: pose.position.x, y: 2.5, z: pose.position.z }, 16, 1.8, [0xff9a5a, 0x6bff9a], 0.06, 0.9); }
      }
    },
    act(ctx) { ctx.cheer(); },
  };
}

// A self-check: node js/models/acad_school.js (the arcade is open, the dove is there, the wheels clear each other)
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const h = hall();
  for (const bay of BAYS) { const { c } = bayOf(bay); if (h.at(Math.floor(c), 8, 9) || h.at(Math.floor(c), 8, 5)) throw new Error(`arch ${bay} is closed`); }
  if (!h.at(-34, 10, 9) || !h.at(0, 30, 5) || !h.at(-8, 10, 9)) throw new Error('the walls are missing');
  let n = 0; for (let y = -8; y <= 8; y += 1) for (let x = -8; x <= 8; x += 1) if (dove(x, y) && Math.hypot(x, y) <= 7.3) n += 1;
  if (n < 80) throw new Error(`the dove is too small (${n})`);
  const p = robotParts(), gz = (pt) => { const zs = []; for (let z = 0; z < pt.grid.sz; z += 1) for (let y = 0; y < pt.grid.sy; y += 1) for (let x = 0; x < pt.grid.sx; x += 1) if (pt.grid.data[x + pt.grid.sx * (z + pt.grid.sz * y)]) zs.push(z + pt.at[2] - pt.pivot[2]); return zs; };
  if (Math.min(...gz(p.wheelsF)) <= Math.max(...gz(p.wheelsB))) throw new Error('the wheels overlap');
  console.log('acad_school.js ok', n, 'dove voxels');
}
