// Voxel Yuuv: about 30 voxels tall at 0.15 (curls included), facing +z.
// A tall mop of round curls, light brown skin, black hoodie with cream
// drawstrings, dark trousers, cream sneakers. Cyber touch: a glowing band on
// his left wrist. Joke: a rubber duck (rubber-duck debugging) nesting in his curls.
//
// Clips: idle (breathes, looks about, blinks), walk or jog (the rig's `moving`),
// wave, point, cheer, poke (a click: "o!", then a smile), laugh:
// `rig.ctx.play(name)`; `act()` cycles them.
//   ctx.mem.pace   1 walks (default), 2 jogs. Stride and cadence each grow with
//                  sqrt(pace), so move him at pace x his walking speed: no skating.
//   ctx.mem.cap    true: a graduation mortarboard on the curls (the duck rides on it).
//   ctx.mem.mouth  'smile' | 'open' | 'o': his face at rest (clips pick their own).
// The mouths are three small parts in one socket, shown by visibility, never re-meshed.
import { C, colour, hash } from '../kit/voxel-kit.js';
import { GAITS } from '../kit/voxel-rig.js';
import { box, tone, smooth, clamp01 } from './space.js';

for (const [n, hex, glow] of [
  ['skin1', 0xc98f62], ['skin2', 0xb87e53], ['skin3', 0xd8a074], ['blush', 0xcf7c67],
  ['mouth', 0x4a1f1a], ['teeth', 0xf7f1e6], ['tongue', 0xd2635c],
  ['white', 0xf5f0e8], ['eye', 0x1a120e], ['shine', 0xffffff, true], ['brow', 0x221409],
  ['hair1', 0x150d08], ['hair2', 0x2e1c10], ['hair3', 0x432918], ['hair4', 0x5f3d22], ['hair5', 0x8a5c34],
  ['hood1', 0x1b1a20], ['hood2', 0x24232b], ['hood3', 0x2e2c36], ['rib', 0x141318], ['lining', 0x3a3844],
  ['string', 0xeee2c4], ['aglet', 0x9b958b],
  ['pant1', 0x2a2f3d], ['pant2', 0x323849], ['pant3', 0x242835], ['seam', 0x1a1d26],
  ['shoe1', 0xeee6d0], ['shoe2', 0xd8cdb2], ['lace', 0xfbf8ef], ['sole1', 0x9a999e], ['sole2', 0x74747a],
  ['band', 0x2ff0ff, true], ['band2', 0xc6fcff, true],
  ['duck1', 0xffd23f], ['duck2', 0xf0b12a], ['duck3', 0xffe680], ['beak', 0xff8a1f], ['beak2', 0xd9650f], ['duckEye', 0x151515],
  ['cap1', 0x191a24], ['cap2', 0x23253a], ['capEdge', 0x3b3f58], ['tassel1', 0xf2c24a], ['tassel2', 0xb8891f],
]) colour(`yuuv_${n}`, hex, glow);

const HOOD = [C.yuuv_hood1, C.yuuv_hood2, C.yuuv_hood2, C.yuuv_hood3];
const PANT = [C.yuuv_pant1, C.yuuv_pant1, C.yuuv_pant2, C.yuuv_pant3];
const SKIN = [C.yuuv_skin1, C.yuuv_skin1, C.yuuv_skin1, C.yuuv_skin3];
const HAIR = [C.yuuv_hair1, C.yuuv_hair2, C.yuuv_hair3, C.yuuv_hair4, C.yuuv_hair5]; // gap, three curl tones, highlight
const MOUTHS = ['smile', 'open', 'o'];
const GEO = { lift: 0 }; // how far the duck climbs when the cap goes on (set by build)

function build() {
  // ---- body: torso, hood, collar, drawstrings (pivot at the hips, y 8)
  const body = box([-5, 8, -4], [4, 14, 5]);
  body.fill(-4, 8, -2, 3, 12, 1, (x, y, z) => {
    if (y === 8) return x % 2 ? C.yuuv_rib : C.yuuv_hood1; // ribbed hem
    if ((x === -4 || x === 3) && z === -1) return C.yuuv_rib; // side seams
    if (y === 12 && (x <= -3 || x >= 2)) return C.yuuv_hood3; // shoulders catch the light
    if (z === 1 && (x === -3 || x === 2) && y <= 11) return C.yuuv_hood1; // folds
    return tone(HOOD, x, y, z, 1);
  });
  // kangaroo pocket, one voxel proud, stitched edge
  body.fill(-3, 9, 2, 2, 10, 2, (x, y) => (x === -3 || x === 2 || y === 10 ? C.yuuv_hood3 : C.yuuv_hood2));
  // hood lying on the back, a lighter lining at its edge
  for (const [y, a, b2] of [[12, -3, 2], [11, -3, 2], [10, -2, 1], [9, -1, 0]]) {
    for (let x = a; x <= b2; x += 1) body.put(x, y, -3, x === a || x === b2 || y === 9 ? C.yuuv_lining : tone(HOOD, x, y, 9, 2));
  }
  // collar: the hood bunched round the neck, lumpy
  for (let z = -4; z <= 3; z += 1) for (let x = -5; x <= 4; x += 1) {
    const ox = (x + 0.5) / 4.3, oz = (z + 0.5 + 0.5) / 3.1;
    const ix = (x + 0.5) / 2.2, iz = (z + 0.5 + 0.2) / 1.7;
    if (ox * ox + oz * oz <= 1) {
      if (ix * ix + iz * iz > 1) { if (hash(x, z, 5) > 0.08 || z < 0) body.put(x, 13, z, tone(HOOD, x, 13, z, 3)); }
      else body.put(x, 13, z, C.yuuv_skin2); // neck
    }
  }
  for (let x = -3; x <= 2; x += 1) {
    body.put(x, 14, -3, tone(HOOD, x, 14, 3, 4));
    if (x > -3 && x < 2 && hash(x, 4) > 0.3) body.put(x, 14, -4, C.yuuv_hood3);
    body.put(x, 13, -4, tone(HOOD, x, 13, -4, 4));
  }
  // drawstrings: out of the collar, down the chest, metal tips
  for (const x of [-3, 2]) { body.put(x, 13, 2, C.yuuv_string); body.put(x, 12, 2, C.yuuv_string); body.put(x, 11, 2, C.yuuv_aglet); }

  // ---- head (pivot at the neck): 10 wide, the face on z = 3
  const head = box([-9, 14, -9], [8, 33, 8]);
  head.fill(-5, 14, -3, 4, 22, 3, (x, y, z) => tone(SKIN, x, y, z, 5));
  for (const x of [-5, 4]) for (const z of [-3, 3]) for (let y = 14; y <= 22; y += 1) head.cut(x, y, z); // round the edges
  for (let x = -4; x <= 3; x += 1) { head.cut(x, 14, 3); head.put(x, 14, 2, C.yuuv_skin2); } // chin tucks under
  head.put(-1, 17, 4, C.yuuv_skin2); head.put(0, 17, 4, C.yuuv_skin2); // a nose, one voxel proud
  head.put(-4, 17, 3, C.yuuv_blush); head.put(3, 17, 3, C.yuuv_blush);
  // sockets: the eyes and the three mouths are their own parts, set into the face
  for (const x of [-4, -3, -2, 1, 2, 3]) for (const y of [18, 19]) head.cut(x, y, 3);
  for (let x = -3; x <= 2; x += 1) for (const y of [15, 16]) head.cut(x, y, 3);

  // ---- hair: a tall mop of round curls. Each curl is a ball shaded on its own
  // (lit on top, dark below), the gaps between them darkest, so it reads as
  // curls from far off and not as a bowl. Never over the face.
  const face = (x, y, z) => (z >= 1 && y <= 22 && x >= -5 && x <= 4) || (z >= 5 && y <= 24 && x >= -5 && x <= 4); // the fringe overhangs by one
  const hairOk = (x, y, z) => !face(x, y, z) && (y >= 19 || (y >= 15 && z <= -2) || (y >= 17 && (x <= -6 || x >= 5)));
  const E = [0, 23.2, -0.3, 5.0, 5.4, 5.1]; // the mop's core: centre, radii
  const curls = [];
  const N = 36;
  for (let i = 0; i < N; i += 1) {
    const dy = 1 - ((i + 0.5) / N) * 2, rad = Math.sqrt(1 - dy * dy), th = i * 2.39996;
    const d = [Math.cos(th) * rad, dy, Math.sin(th) * rad];
    if (dy < -0.32 || (d[2] > 0.45 && dy < 0.32)) continue; // not under the chin, not over the face
    const r = 2.0 + hash(i, 7) * 0.8, out = hash(i, 5) * 0.7 - 0.2; // proud of the core by 2 to 3
    curls.push({ c: [0, 1, 2].map((k) => E[k] + d[k] * (E[k + 3] + out)), r, t: 1 + Math.floor(hash(i, 3) * 3) });
  }
  for (const [x, y, z, r] of [
    [-4.2, 24.0, 3.1, 1.9], [-1.5, 25.2, 3.4, 2.1], [1.4, 24.4, 3.5, 1.8], [4.1, 24.9, 2.8, 2.0], // a fringe spilling over the brow
    [-6.7, 21.0, 1.2, 1.8], [6.7, 21.0, 1.2, 1.8], [-7.1, 19.0, -1.4, 1.7], [7.1, 19.0, -1.4, 1.7], // over the ears
    [-3.3, 16.9, -4.6, 1.8], [0, 16.3, -5.0, 1.9], [3.3, 16.9, -4.6, 1.8], // the nape
  ]) curls.push({ c: [x, y, z], r, t: 1 + Math.floor(hash(Math.round(x * 10), Math.round(y * 10), 11) * 3) });
  const L = [0.25, 0.88, 0.4]; // light from above and in front
  for (let y = 15; y <= 33; y += 1) for (let z = -9; z <= 8; z += 1) for (let x = -9; x <= 8; x += 1) {
    if (!hairOk(x, y, z)) continue;
    const p = [x + 0.5, y + 0.5, z + 0.5];
    let best = null, bk = 1;
    for (const q of curls) { const k = Math.hypot(p[0] - q.c[0], p[1] - q.c[1], p[2] - q.c[2]) / q.r; if (k <= bk) { bk = k; best = q; } }
    if (!best) {
      if (((p[0] - E[0]) / E[3]) ** 2 + ((p[1] - E[1]) / E[4]) ** 2 + ((p[2] - E[2]) / E[5]) ** 2 <= 1) head.put(x, y, z, hash(x, y, z) < 0.75 ? HAIR[0] : HAIR[1]);
      continue;
    }
    const n = p.map((v, k) => v - best.c[k]), len = Math.hypot(...n) || 1;
    const lit = (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / len;
    head.put(x, y, z, HAIR[best.t + (lit > 0.4 ? 1 : lit < -0.02 ? -1 : 0)]);
  }
  for (const x of [-6, 5]) for (const [y, z, id] of [[16, 0, C.yuuv_skin2], [17, 0, C.yuuv_skin2], [16, 1, C.yuuv_skin1], [17, 1, C.yuuv_skin1]]) head.put(x, y, z, id); // ears
  const top = (x0, x1, z0, z1) => { let m = 0; for (let x = x0; x <= x1; x += 1) for (let z = z0; z <= z1; z += 1) for (let y = 33; y > m; y -= 1) if (HAIR.includes(head.at(x, y, z))) { m = y; break; } return m; };

  // ---- the face's moving parts: eyes (a white, a dark pupil, a glint that glows), brows, three mouths
  const eyes = box([-4, 18, 3], [3, 19, 3]);
  for (const y of [18, 19]) {
    eyes.put(-4, y, 3, C.yuuv_white); eyes.put(3, y, 3, C.yuuv_white);
    for (const x of [-3, -2, 1, 2]) eyes.put(x, y, 3, C.yuuv_eye);
  }
  eyes.put(-2, 19, 3, C.yuuv_shine); eyes.put(1, 19, 3, C.yuuv_shine);
  const brow = (x0) => { const b = box([x0, 21, 4], [x0 + 2, 21, 4]); b.fill(x0, 21, 4, x0 + 2, 21, 4, C.yuuv_brow); return b; };
  const browR = brow(-4), browL = brow(1);
  const mouth = (rows) => {
    const m = box([-3, 15, 3], [2, 16, 3]);
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      const x = i - 3, y = 16 - j;
      m.put(x, y, 3, { m: C.yuuv_mouth, t: C.yuuv_teeth, r: C.yuuv_tongue }[ch] ?? tone(SKIN, x, y, 3, 5));
    }));
    return m;
  };
  const smile = mouth(['.m..m.', '..mm..']), open = mouth(['mttttm', '.mrrm.']), oh = mouth(['..mm..', '..mm..']);

  // ---- the duck, nesting in the curls a little off centre: a round body, a head, an orange bill, dot eyes, a tail
  const s = top(-1, 2, -2, 1);
  const duck = box([-3, s - 1, -6], [5, s + 9, 7]);
  duck.egg(1, s + 1.9, -0.6, 2.7, 2.1, 3.4, (x, y, z) => (y >= s + 3 ? C.yuuv_duck3 : y === s + 2 && (x === -2 || x === 3) && z < 1 ? C.yuuv_duck2 : y <= s ? C.yuuv_duck2 : C.yuuv_duck1));
  duck.egg(1, s + 5.2, 1.4, 2.1, 2.0, 2.0, (x, y) => (y >= s + 6 ? C.yuuv_duck3 : C.yuuv_duck1));
  for (const x of [0, 1]) { duck.put(x, s + 3, -4, C.yuuv_duck1); duck.put(x, s + 4, -4, C.yuuv_duck3); duck.put(x, s + 5, -5, C.yuuv_duck3); } // tail flick
  for (const x of [0, 1]) { duck.put(x, s + 4, 4, C.yuuv_beak); duck.put(x, s + 4, 5, C.yuuv_beak); duck.put(x, s + 3, 4, C.yuuv_beak2); } // bill
  duck.put(-1, s + 5, 2, C.yuuv_duckEye); duck.put(2, s + 5, 2, C.yuuv_duckEye);

  // ---- a graduation mortarboard, hidden until ctx.mem.cap: a skullcap in the curls, the board, a button, a tassel
  const T = top(-6, 5, -6, 5) + 1;
  const cap = box([-8, T - 3, -8], [7, T + 1, 7]);
  cap.egg(0, T - 0.6, 0, 4.6, 2.4, 4.6, (x, y, z) => ((x + z) % 3 === 0 ? C.yuuv_cap2 : C.yuuv_cap1), (x, y) => y < T);
  cap.fill(-7, T, -7, 6, T, 6, (x, y, z) => (x === -7 || x === 6 || z === -7 || z === 6 ? C.yuuv_capEdge : (x - z + 40) % 6 === 0 ? C.yuuv_cap2 : C.yuuv_cap1));
  cap.fill(-1, T + 1, -1, 0, T + 1, 0, C.yuuv_tassel2);
  for (const [x, z] of [[1, 1], [2, 2], [3, 2], [4, 3], [5, 4], [6, 4]]) cap.put(x, T + 1, z, C.yuuv_tassel1); // the cord, over to the right edge
  const tassel = box([6, T - 7, 3], [8, T + 1, 5]);
  tassel.fill(7, T - 2, 4, 7, T + 1, 4, C.yuuv_tassel1);
  tassel.put(7, T - 3, 4, C.yuuv_tassel2);
  tassel.fill(7, T - 6, 4, 8, T - 4, 5, (x, y, z) => ((x + y + z) % 3 ? C.yuuv_tassel1 : C.yuuv_tassel2));
  GEO.lift = T + 1 - s;

  // ---- arms: upper (shoulder pivot) and fore (elbow pivot); left is +x
  const arm = (side) => {
    const [a, b2] = side > 0 ? [4, 5] : [-6, -5];
    const outer = side > 0 ? 5 : -6;
    const upper = box([a, 10, -1], [b2, 12, 1]);
    upper.fill(a, 10, -1, b2, 12, 1, (x, y, z) => (y === 12 ? C.yuuv_hood3 : x === outer && z === 0 ? C.yuuv_rib : tone(HOOD, x, y, z, 8)));
    const fore = box([a, 6, -1], [b2, 9, 1]);
    fore.fill(a, 9, -1, b2, 9, 1, (x, y, z) => tone(HOOD, x, y, z, 9));
    fore.fill(a, 8, -1, b2, 8, 1, (x, y, z) => (side > 0 ? (x === outer && z === 0 ? C.yuuv_band2 : C.yuuv_band) : (x + z) % 2 ? C.yuuv_rib : C.yuuv_hood1));
    fore.fill(a, 6, -1, b2, 7, 0, (x, y) => (y === 7 ? C.yuuv_skin1 : C.yuuv_skin2));
    fore.put(side > 0 ? a : b2, 7, 1, C.yuuv_skin1); // thumb
    return [upper, fore];
  };
  const [armL, foreL] = arm(1);
  const [armR, foreR] = arm(-1);

  // ---- legs: thigh (hip pivot) and shin with its sneaker (knee pivot)
  const leg = (side) => {
    const [a, b2] = side > 0 ? [0, 2] : [-3, -1];
    const outer = side > 0 ? 2 : -3;
    const thigh = box([a, 4, -1], [b2, 7, 1]);
    thigh.fill(a, 4, -1, b2, 7, 1, (x, y, z) => (x === outer && z === 0 ? C.yuuv_seam : z === 1 && x === a + 1 ? C.yuuv_pant3 : tone(PANT, x, y, z, 11)));
    const shin = box([a, 0, -1], [b2, 3, 3]);
    shin.fill(a, 2, -1, b2, 3, 1, (x, y, z) => (y === 2 ? C.yuuv_pant3 : x === outer && z === 0 ? C.yuuv_seam : tone(PANT, x, y, z, 12)));
    shin.fill(a, 0, -1, b2, 0, 3, (x, y, z) => (z === 3 || x === outer ? C.yuuv_sole2 : C.yuuv_sole1));
    shin.fill(a, 1, -1, b2, 1, 3, (x, y, z) => (z === 3 || z === -1 ? C.yuuv_shoe2 : C.yuuv_shoe1));
    shin.put(a + 1, 1, 2, C.yuuv_lace); shin.put(a + 1, 2, 2, C.yuuv_shoe1); // laces, tongue
    shin.put(outer, 1, 1, C.yuuv_shoe2); // side panel
    return [thigh, shin];
  };
  const [legL, shinL] = leg(1);
  const [legR, shinR] = leg(-1);

  return {
    parts: {
      body: body.part('body', [0, 8, 0]),
      head: head.part('head', [0, 14, 0.5], body),
      eyes: eyes.part('eyes', [0, 19, 3.5], head),
      browL: browL.part('browL', [2.5, 21.5, 4.5], head),
      browR: browR.part('browR', [-2.5, 21.5, 4.5], head),
      mouthSmile: smile.part('mouthSmile', [0, 16, 3.5], head),
      mouthOpen: open.part('mouthOpen', [0, 16, 3.5], head),
      mouthO: oh.part('mouthO', [0, 16, 3.5], head),
      duck: duck.part('duck', [1, s, -0.6], head),
      cap: cap.part('cap', [0, T, 0], head),
      tassel: tassel.part('tassel', [7.5, T + 1, 4.5], cap),
      armL: armL.part('armL', [5, 13, 0.5], body),
      foreL: foreL.part('foreL', [5, 10, 0.5], armL),
      armR: armR.part('armR', [-5, 13, 0.5], body),
      foreR: foreR.part('foreR', [-5, 10, 0.5], armR),
      legL: legL.part('legL', [1.5, 8, 0.5]),
      shinL: shinL.part('shinL', [1.5, 4, 0.5], legL),
      legR: legR.part('legR', [-1.5, 8, 0.5]),
      shinR: shinR.part('shinR', [-1.5, 4, 0.5], legR),
    },
  };
}

// The rig's phase runs at this rate at a walk (idle adds more for a jog); the stride itself is posed in `idle`.
GAITS.yuuv = { rate: 8.6, move() {} };

const DUR = { wave: 2.0, point: 1.7, cheer: 1.5, poke: 1.3, laugh: 1.7 };
const ease = (x) => x * x * (3 - 2 * x);
// Which mouth a clip wears as it plays (u runs 0 to 1).
const MOUTH = {
  wave: (u) => (u > 0.12 && u < 0.32 ? 'open' : 'smile'), // "hi!"
  cheer: (u) => (u < 0.9 ? 'open' : 'smile'),
  poke: (u) => (u < 0.45 ? 'o' : 'smile'),
  laugh: (u, t) => (u < 0.9 && Math.sin(t * 24) > -0.25 ? 'open' : 'smile'), // ha-ha-ha
};

const CLIPS = {
  wave({ parts: p }, e, u, t) {
    p.armR.rotation.z -= 2.7 * e;
    p.armR.rotation.x -= 0.25 * e;
    p.foreR.rotation.z += (-0.2 + 0.55 * Math.sin(t * 12)) * e;
    p.head.rotation.z += 0.12 * e;
    p.body.rotation.y -= 0.12 * e;
    p.eyes.scale.y *= 1 - 0.45 * e; // a smiling squint
    p.browL.position.y += 0.6 * e; p.browR.position.y += 0.6 * e;
  },
  point({ parts: p }, e, u, t) {
    p.armR.rotation.x -= 1.72 * e;
    p.armR.rotation.z -= 0.1 * e;
    p.body.rotation.y -= 0.18 * e;
    p.head.rotation.x -= 0.1 * e;
    p.armL.rotation.z += 0.55 * e; // other hand on his hip
    p.foreL.rotation.z -= 1.35 * e;
    p.foreL.rotation.x -= 0.2 * e;
    p.body.rotation.x -= 0.04 * e * Math.sin(t * 5);
    p.browR.position.y += 1 * e; p.browR.rotation.z -= 0.25 * e; // one brow up: that one
  },
  cheer({ parts: p, pose }, e, u, t) {
    p.armL.rotation.z += 2.75 * e; p.armR.rotation.z -= 2.75 * e;
    p.foreL.rotation.z += 0.3 * Math.sin(t * 15) * e; p.foreR.rotation.z -= 0.3 * Math.sin(t * 15 + 1) * e;
    const hop = Math.sin(Math.PI * clamp01((u - 0.22) / 0.4));
    pose.position.y += 0.55 * hop;
    p.shinL.rotation.x += 0.9 * hop; p.shinR.rotation.x += 0.9 * hop;
    p.legL.rotation.x -= 0.35 * hop; p.legR.rotation.x -= 0.35 * hop;
    const land = Math.sin(Math.PI * clamp01((u - 0.62) / 0.16));
    pose.scale.y *= 1 - 0.08 * land; pose.scale.x *= 1 + 0.05 * land; pose.scale.z *= 1 + 0.05 * land;
    p.duck.position.y += 6 * Math.sin(Math.PI * clamp01((u - 0.3) / 0.45)); // the duck cheers too: a leap and a spin
    p.duck.rotation.y += Math.PI * 2 * smooth((u - 0.3) / 0.45);
    p.tassel.rotation.x -= 1.1 * hop;
    p.eyes.scale.y *= 1 - 0.55 * e;
    p.browL.position.y += 1 * e; p.browR.position.y += 1 * e;
    p.head.rotation.x -= 0.15 * e;
  },
  // A poke: he jumps ("o!"), then smiles it off with a shake of the head.
  poke({ parts: p, pose }, e, u, t) {
    const jolt = smooth(u / 0.05) * (1 - smooth((u - 0.32) / 0.3));
    pose.position.y += 0.3 * Math.sin(Math.PI * clamp01(u / 0.28));
    pose.rotation.x -= 0.12 * jolt;
    p.armL.rotation.z += 0.8 * jolt; p.armR.rotation.z -= 0.8 * jolt;
    p.foreL.rotation.x -= 1.0 * jolt; p.foreR.rotation.x -= 1.0 * jolt;
    p.head.rotation.x -= 0.14 * jolt;
    p.browL.position.y += 1.2 * jolt; p.browR.position.y += 1.2 * jolt;
    p.duck.position.y += 3 * Math.sin(Math.PI * clamp01((u - 0.04) / 0.3)); // the duck jumps too
    const shake = smooth((u - 0.45) / 0.1) * (1 - smooth((u - 0.72) / 0.18));
    p.head.rotation.y += 0.2 * Math.sin((u - 0.45) * 34) * shake;
    p.eyes.scale.y *= 1 - 0.4 * smooth((u - 0.45) / 0.1) * e;
  },
  laugh({ parts: p, pose }, e, u, t) {
    const ha = Math.sin(t * 24);
    p.head.rotation.x -= 0.24 * e;
    p.head.rotation.z += 0.04 * ha * e;
    p.body.rotation.x -= 0.06 * e;
    pose.position.y += 0.05 * Math.abs(ha) * e;
    p.armL.rotation.z += 0.12 * e; p.armR.rotation.z -= 0.12 * e;
    p.foreL.rotation.x -= 1.15 * e; p.foreR.rotation.x -= 1.15 * e; // hands to his middle
    p.foreL.rotation.z -= 0.45 * e; p.foreR.rotation.z += 0.45 * e;
    p.eyes.scale.y *= 1 - 0.62 * e;
    p.browL.position.y += 0.6 * e; p.browR.position.y += 0.6 * e;
    p.duck.rotation.z += 0.2 * ha * e;
  },
};

export const yuuv = {
  gait: 'yuuv',
  build,
  setup(ctx) {
    ctx.mem.n = 0;
    ctx.mem.blinkAt = 1.5;
    ctx.play = (name) => {
      if (!CLIPS[name]) return;
      ctx.mem.clip = { name, t0: ctx.state.t, dur: DUR[name] };
      if (name === 'cheer') ctx.after(0.55, () => {
        const at = ctx.where(ctx.parts.duck);
        at.y += 0.4;
        ctx.burst(at, 18, 2.6, [0x7ff7ff, 0xff4fd8], 0.07, 0.9);
      });
    };
    ctx.busy = () => Boolean(ctx.mem.clip);
  },
  idle(ctx, dt) {
    const { parts: p, state, mem, pose } = ctx;
    const t = state.t;
    mem.w = (mem.w ?? 0) + ((state.moving ? 1 : 0) - (mem.w ?? 0)) * Math.min(1, dt * 7);
    const w = ease(mem.w), r = 1 - w;
    // pace: stride and cadence each grow with its square root, so ground speed goes as pace
    const goal = Math.min(2.5, Math.max(0.5, mem.pace ?? 1));
    mem.pz = (mem.pz ?? goal) + (goal - (mem.pz ?? goal)) * Math.min(1, dt * 4);
    const f = Math.sqrt(mem.pz), j = clamp01(mem.pz - 1); // j: 0 a walk, 1 a jog
    if (state.moving) state.phase += dt * GAITS.yuuv.rate * (f - 1);

    // ---- walk or jog: hips, knees, counter-swinging arms; a jog leans in, bends its arms, and bounces off the ground
    const ph = state.phase, s = Math.sin(ph), c = Math.cos(ph);
    const leg = 0.62 * f * w, knee = (1 + 0.8 * j) * w, arm = (0.6 + 0.35 * j) * w;
    p.legL.rotation.x -= leg * s; p.legR.rotation.x += leg * s;
    p.shinL.rotation.x += knee * Math.max(0, c) ** 1.5; p.shinR.rotation.x += knee * Math.max(0, -c) ** 1.5;
    p.armL.rotation.x += arm * s; p.armR.rotation.x -= arm * s;
    p.foreL.rotation.x -= ((0.25 + 0.5 * Math.max(0, -s)) * (1 - j) + (1.3 + 0.25 * s) * j) * w;
    p.foreR.rotation.x -= ((0.25 + 0.5 * Math.max(0, s)) * (1 - j) + (1.3 - 0.25 * s) * j) * w;
    p.armL.rotation.z += (0.07 + 0.06 * j) * w; p.armR.rotation.z -= (0.07 + 0.06 * j) * w;
    pose.position.y += ((1 - Math.abs(s)) * 0.08 * (1 - j) + Math.abs(s) * 0.24 * j) * w;
    p.body.rotation.y += (0.1 + 0.05 * j) * s * w; p.head.rotation.y -= 0.08 * s * w;
    p.body.rotation.x += (0.06 + 0.1 * j) * w; pose.rotation.x += 0.1 * j * w;
    p.head.rotation.x -= 0.12 * j * w;
    pose.rotation.z += 0.025 * s * w;

    // ---- idle: breath, weight shift, look about, blink
    const breath = Math.sin(t * 2.1);
    p.body.scale.set(1 + 0.012 * breath, 1 + 0.02 * breath, 1 + 0.012 * breath);
    p.armL.rotation.z += (0.05 + 0.02 * breath) * r; p.armR.rotation.z -= (0.05 + 0.02 * breath) * r;
    p.foreL.rotation.x -= 0.12 * r; p.foreR.rotation.x -= 0.12 * r;
    pose.rotation.z += 0.014 * Math.sin(t * 0.55) * r;
    if (!(t < mem.lookUntil)) {
      mem.k = (mem.k || 0) + 1;
      mem.lookUntil = t + 1.6 + hash(mem.k, 1) * 2.6;
      mem.look = hash(mem.k, 2) < 0.3 ? 0 : (hash(mem.k, 3) - 0.5) * 1.3;
      mem.tilt = (hash(mem.k, 4) - 0.5) * 0.18;
    }
    const clipOn = mem.clip ? 1 : 0;
    const k = 1 - Math.exp(-dt * 5);
    mem.yaw = (mem.yaw || 0) + ((mem.look || 0) * r * (1 - clipOn) - (mem.yaw || 0)) * k;
    mem.tl = (mem.tl || 0) + ((mem.tilt || 0) * r * (1 - clipOn) - (mem.tl || 0)) * k;
    p.head.rotation.y += mem.yaw; p.head.rotation.z += mem.tl;
    p.body.rotation.y += mem.yaw * 0.15;
    if (t > mem.blinkAt) {
      if (t > mem.blinkAt + 0.13) { mem.b = (mem.b || 0) + 1; mem.blinkAt = t + (hash(mem.b, 9) < 0.2 ? 0.25 : 1.8 + hash(mem.b, 8) * 3.2); }
      else p.eyes.scale.y = 0.12;
    }

    // ---- the duck rides the curls: bobs on them, rocks with his step, has a look round now and then
    p.duck.position.y += 0.25 * Math.sin(t * 2.4) * r + Math.abs(s) * (0.6 + 0.9 * j) * w;
    p.duck.rotation.z += 0.07 * Math.sin(t * 1.9) + 0.2 * s * w;
    p.duck.rotation.x += 0.05 * Math.sin(t * 2.4 + 1) - 0.15 * j * w;
    const dk = Math.floor(t / 5.5), du = t - dk * 5.5;
    if (hash(dk, 21) < 0.7 && du < 1.4) p.duck.rotation.y += Math.sin((du / 1.4) * Math.PI * 2) * 0.7;
    p.duck.rotation.y += 0.85; // sat sideways, so it shows its profile

    // ---- the mortarboard: worn a little askew, the tassel swings; the duck rides on the board
    p.cap.visible = Boolean(mem.cap);
    if (mem.cap) {
      p.duck.position.y += GEO.lift;
      p.cap.rotation.z -= 0.07; p.cap.rotation.x -= 0.05;
      p.tassel.rotation.x += 0.16 * Math.sin(t * 2.2) - 0.3 * Math.abs(s) * w - 0.2 * j * w;
      p.tassel.rotation.z += 0.1 * Math.sin(t * 1.7 + 1) + 0.3 * s * w;
    }

    // ---- clips on top, and the mouth they call for
    let mouth = mem.mouth;
    const cl = mem.clip;
    if (cl) {
      const u = (t - cl.t0) / cl.dur;
      if (u >= 1) mem.clip = null;
      else {
        CLIPS[cl.name](ctx, smooth(u / 0.16) * (1 - smooth((u - 0.82) / 0.18)), u, t);
        mouth = MOUTH[cl.name]?.(u, t) ?? mouth;
      }
    }
    if (!MOUTHS.includes(mouth)) mouth = 'smile';
    p.mouthSmile.visible = mouth === 'smile'; p.mouthOpen.visible = mouth === 'open'; p.mouthO.visible = mouth === 'o';
  },
  act(ctx) {
    ctx.play(['wave', 'point', 'cheer', 'poke', 'laugh'][ctx.mem.n++ % 5]);
  },
};
