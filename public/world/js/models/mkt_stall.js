// The Market's stalls and carts, and the wares on their counters.
//
//   stallFrame(), stallCloth()  a timber booth under a sloping striped awning, in two grids:
//                               the timber, cream canvas, trim and lights (one crowd for every
//                               stall), and the coloured stripes and drape (a second crowd,
//                               tinted per stall with instanceColor). Front +z.
//   cartFrame(), cartCloth()    the same for a hand cart on two spoked wheels under a canopy.
//   goods(id, look, kind)       what one stall sells: the repo's object on its counter (a base
//                               and one moving part) and a hologram price tag with the repo's
//                               glyph, swinging on a thread from the stall's iron arm.
//   STALL, CART                 anchors in model voxels: where the ware sits, where the tag
//                               hangs, where the lantern string ties on, where Yuuv stands.
// All deterministic (hash, never Math.random), 0.15 a voxel, colours prefixed mkt_.
import { C, colour, hash, noise } from '../kit/voxel-kit.js';
import { box, tone, smooth, clamp01 } from './space.js';

const col = (name, hex, glow = false) => C[name] ?? colour(name, hex, glow);
for (const [n, hex, glow] of [
  // timber from shadow to worn edge, counter boards
  ['w1', 0x3a2616], ['w2', 0x55381f], ['w3', 0x6e4a2a], ['w4', 0x8a6238], ['w5', 0xa27a4c],
  ['top1', 0x7b5634], ['top2', 0x8b6540], ['top3', 0x9a7550],
  // canvas: the cream stripes, and the greys the tinted stripes are drawn in (the tint multiplies them)
  ['cv1', 0xf2e9d6], ['cv2', 0xe6dcc4], ['cv3', 0xd6c9ad], ['cvStain', 0xb8a47e],
  ['tw1', 0xffffff], ['tw2', 0xe8e8e8], ['tw3', 0xcfcfcf], ['tw4', 0xa9a9a9],
  // crates, sacks, rope, glass and lights
  ['cw1', 0xb28a57], ['cw2', 0xa07644], ['cw3', 0xc39a63], ['batten', 0x6f4c2c],
  ['sack1', 0xb49a6e], ['sack2', 0xa08658], ['sack3', 0x8a7148], ['rope', 0x6b5a3a],
  ['trace', 0x1fd2ea, true], ['via', 0xb6fbff, true],
  ['lamp1', 0xfff3d0, true], ['lamp2', 0xffc764, true], ['lamp3', 0xff9a3c, true],
  ['pot1', 0xff5ad8, true], ['pot2', 0x6ff2ff, true], ['pot3', 0xffc764, true], ['pot4', 0x7dff9a, true], ['cork', 0x9a7a52],
  ['tyre', 0x2e2a28], ['basket1', 0xc9a26a], ['basket2', 0xa9824e],
  // the wares
  ['maskG', 0xf2c84a], ['maskG2', 0xd9a92f], ['maskL', 0xc9b8e6], ['maskL2', 0xa996cc], ['maskS', 0xcfd6de], ['maskS2', 0xa9b2bc],
  ['mouth', 0x3a2020], ['velvet', 0x3a1f4a], ['velvet2', 0x4a2a5e], ['ribbonR', 0xc8323a], ['ribbonB', 0x3a6ec8],
  ['eyeG', 0xffe08a, true], ['eyeV', 0xd8a8ff, true], ['eyeC', 0x6ff2ff, true], ['tear', 0x9ff8ff, true],
  ['slate1', 0x2c3038], ['slate2', 0x363b45], ['slate3', 0x23262d],
  ['nc1', 0xfff0ff, true], ['nc2', 0xff7ae0, true], ['nc3', 0xb04ad8, true], ['glint', 0xe8fbff, true],
  ['tagR', 0xd8434a], ['tagB', 0x3a86c8], ['tagG', 0x4fae52], ['tagY', 0xf2b62a], ['tagW', 0xf4efe6], ['ink', 0x2a2420], ['smile', 0x3a2a10],
  ['cover1', 0x6e1d22], ['cover2', 0x8a2a2c], ['page1', 0xf3ead2], ['page2', 0xe4d8b8], ['pageEdge', 0xcdbf9c],
  ['illum', 0xc8323a], ['gold', 0xf0c24a], ['runeP', 0xffb86a, true],
  ['drag1', 0x3f9a45], ['drag2', 0x2f7a37], ['dragBelly', 0xe8c860], ['dragWing', 0xc8423a], ['dragEye', 0xffd23f, true], ['flame', 0xff8a3a, true],
  ['rack1', 0x1c1d22], ['rack2', 0x2a2c33], ['rack3', 0x3a3d46], ['ledG', 0x5dff8a, true], ['ledA', 0xffb347, true], ['ledC', 0x6ff2ff, true],
  ['cl1', 0xffffff], ['cl2', 0xeaf1fa], ['cl3', 0xcfdcee], ['data', 0x9ff8ff, true],
  ['scr1', 0x5dff8a, true], ['scr2', 0x6ff2ff, true], ['scr3', 0xff6ad8, true], ['scr4', 0xffc764, true], ['scrDark', 0x0f1a1c], ['key1', 0x2a2c33], ['key2', 0x4a4e58],
  ['jar', 0xbff6ff, true], ['jar2', 0x7fe8ff, true], ['brain1', 0xe89ab0], ['brain2', 0xd07896], ['brain3', 0xb85c7c], ['spark', 0xfff27a, true],
  ['ivory', 0xefe6d0], ['ivory2', 0xd9cdb2], ['ebony', 0x2a2226], ['ebony2', 0x3c3236], ['walnut', 0x5a3a22], ['knightEye', 0x6ff2ff, true],
  ['chrome1', 0xd6dde4], ['chrome2', 0x9aa4ae], ['chrome3', 0x5d6670], ['onAir', 0xff4a3a, true],
  ['saffron', 0xff9a33, true], ['waveW', 0xf6fbff, true], ['waveG', 0x3fdc6a, true],
  ['cam1', 0x1e1c1e], ['cam2', 0x2c292b], ['lensGlass', 0x7fdcff, true], ['flash', 0xf6fbff, true], ['rec', 0xff3a3a, true],
  ['faceBox', 0x5dff8a, true], ['faceDim', 0x2fae6a, true],
  ['turf1', 0x4d7d33], ['turf2', 0x5f8f3c], ['path', 0xafa899],
  ['hA', 0xe8dcc0], ['hB', 0xc9b48a], ['hC', 0xd8c8e8], ['roofA', 0xb84a3a], ['roofB', 0x3a6ea8], ['roofC', 0x3f8a4a], ['win', 0xffc764, true], ['door', 0x4a3020],
  ['tinyHood', 0x1b1a20], ['tinyHair', 0x2e1c10], ['tinySkin', 0xc98f62], ['tinyBand', 0x2ff0ff, true],
]) col(`mkt_${n}`, hex, glow);
const K = (n) => C[`mkt_${n}`];

const PLANK = [K('w2'), K('w3'), K('w3'), K('w4')];
const TOP = [K('top1'), K('top2'), K('top2'), K('top3')];
// Canvas: a tone per stripe and pair of rows (weathered panels, and they mesh cheaply), stains in patches.
const band3 = (x) => Math.floor((x + 30) / 3);
const CREAM = (x, y, z) => (noise(x + 40, z + y, 4, 3) > 0.72 ? K('cvStain') : [K('cv1'), K('cv1'), K('cv2'), K('cv3')][Math.floor(hash(band3(x), y, Math.floor((z + 30) / 2) + 5) * 4)]);
const TINT = (x, y, z) => (noise(x, z + y, 4, 9) > 0.74 ? K('tw3') : [K('tw1'), K('tw1'), K('tw1'), K('tw2')][Math.floor(hash(band3(x), y, Math.floor((z + 30) / 2) + 7) * 4)]);
const mod = (a, n) => ((a % n) + n) % n;

// Anchors (model voxels). item: the ware's base centre; tag: where its thread hangs; wire: where the
// lantern string ties on; spot: where Yuuv stands to look (x, z); body: the footprint he walks round.
export const STALL = { item: [2.5, 10, 2.5], tag: [-0.5, 58.5, 0.5], wire: [0, 61, -7.5], spot: [-12, 14], body: [-11, -8, 10, 7], lantern: [12, 26, 6] };
export const CART = { item: [1.5, 10, 0], tag: [-0.5, 56.5, 0.5], wire: [0, 59, -5.5], spot: [-15, 9], body: [-10, -13, 9, 6], lantern: [10, 25, 5] };

// ---------------------------------------------------------------------------------------------
// A crate: planks in courses, battens at the edges, iron at the corners.
function crate(b, x0, y0, z0, x1, y1, z1, seed) {
  b.fill(x0, y0, z0, x1, y1, z1, (x, y, z) => {
    const ex = x === x0 || x === x1, ey = y === y0 || y === y1, ez = z === z0 || z === z1;
    if (!ex && !ey && !ez) return 0;
    if ((ex && ey) || (ey && ez) || (ex && ez)) return hash(x, y, z) < 0.15 ? C.iron2 : K('batten');
    return tone([K('cw1'), K('cw2'), K('cw3'), K('cw1')], Math.floor((x + z) / 3), Math.floor(y / 2), seed, 11);
  });
}
// A sack: a lumpy egg of hessian, tied at the neck.
function sack(b, cx, y0, cz, r, h) {
  b.egg(cx, y0 + h * 0.45, cz, r, h * 0.5, r * 0.9, (x, y, z) => (hash(x, y, z) < 0.2 ? K('sack3') : (x + y) % 3 ? K('sack1') : K('sack2')));
  b.fill(Math.floor(cx) - 1, y0 + Math.round(h * 0.9), Math.floor(cz), Math.floor(cx), y0 + Math.round(h * 0.9), Math.floor(cz), K('rope'));
  b.put(Math.floor(cx), y0 + Math.round(h * 0.9) + 1, Math.floor(cz), K('sack2'));
}
// A hanging lantern: a hook, an iron cap, four bars, a crystal that glows.
function lantern(b, x, y, z) {
  b.put(x, y + 5, z, C.iron2);
  b.fill(x - 1, y + 4, z - 1, x + 1, y + 4, z + 1, (xx, yy, zz) => (xx === x && zz === z ? C.brass2 : C.iron2));
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.fill(x + dx, y + 1, z + dz, x + dx, y + 3, z + dz, C.iron1);
  b.fill(x, y + 1, z, x, y + 3, z, (xx, yy) => (yy === y + 2 ? K('lamp1') : K('lamp2')));
  b.put(x - 1, y + 2, z, K('lamp3')); b.put(x + 1, y + 2, z, K('lamp3'));
  b.fill(x - 1, y, z - 1, x + 1, y, z + 1, (xx, yy, zz) => (xx === x && zz === z ? C.iron3 : C.iron2));
}
// The tag's iron arm: a post up the back, a scroll under the arm, a brass knob and a crystal on top.
function tagPost(F, z, y0, top, armTo) {
  F.fill(-1, y0, z, 0, top, z, (x, y) => (y === top ? C.brass2 : y % 8 === 0 ? C.brass2 : y % 8 === 1 ? C.iron3 : C.iron1));
  F.put(-1, top + 1, z, K('lamp1')); F.put(0, top + 1, z, K('lamp2'));
  F.fill(-1, top - 3, z + 1, 0, top - 3, armTo, (x, y, zz) => (zz === armTo ? C.brass2 : C.iron2));
  for (const [y, dz] of [[top - 4, 1], [top - 5, 1], [top - 5, 2], [top - 4, 3]]) F.put(-1, y, z + dz, C.iron2); // a scroll
  F.put(-1, top - 4, armTo, C.iron3); // the eye the thread hangs from
}

// ---------------------------------------------------------------------------------------------
// The stall. Model voxels x -14..11, z -9..10, y 0..51; the counter's front is z 5, the awning's lip z 9.
const yc = (z) => 42 - Math.round(((z + 8) * 6) / 17); // the awning: 42 at the back (z -8), 36 at the front (z 9), clear of Yuuv's curls
function stallGrids() {
  const F = box([-12, 0, -9], [14, 63, 10]);
  const T = box([-12, 0, -9], [14, 63, 10]);
  // ---- deck boards under the keeper's feet
  F.fill(-9, 0, -6, 8, 0, 1, (x, y, z) => (mod(x + z * 3, 7) === 0 ? K('w1') : tone(PLANK, Math.floor((x + z * 3 + 30) / 7), 0, z, 1)));
  // ---- posts: square timber, iron shoes, iron bands, brass caps
  const post = (x0, z0, top) => F.fill(x0, 0, z0, x0 + 1, top, z0 + 1, (x, y, z) => (y <= 1 ? C.iron2 : y === top ? C.brass2 : y % 7 === 3 ? C.iron2 : tone([K('w2'), K('w3'), K('w2'), K('w1')], x, Math.floor(y / 4), z, 3)));
  post(-11, 5, yc(6) - 1); post(9, 5, yc(6) - 1); post(-11, -7, yc(-6) - 1); post(9, -7, yc(-6) - 1);
  // ---- the counter: planked front with straps, sides, a top of boards with a brass lip set with circuit light
  F.fill(-9, 0, 2, 8, 8, 5, (x, y, z) => {
    const front = z === 5, side = x === -9 || x === 8;
    if (!front && !side && y < 8) return 0;
    if (y === 0) return C.iron1;
    if (y === 8) return K('w2');
    if (front) {
      if (y === 2 || y === 7) return mod(x, 4) === 0 ? C.brass2 : C.iron2;
      if (mod(x + 9, 3) === 2) return K('w1');
      const t = tone(PLANK, Math.floor((x + 9) / 3), Math.floor(y / 4), 5, 2);
      return y === 6 && hash(x, 6, 9) < 0.4 ? K('w5') : t;
    }
    return mod(y, 3) === 0 ? K('w1') : tone(PLANK, x, Math.floor(y / 3), z, 4);
  });
  F.fill(-10, 9, -1, 9, 9, 6, (x, y, z) => {
    if (z === 6) return mod(x, 4) === 0 ? K('via') : mod(x, 4) === 2 ? K('trace') : C.brass2;
    if (mod(x + z * 5, 8) === 0) return K('w1');
    return tone(TOP, Math.floor((x + z * 5 + 40) / 8), 0, z, 5);
  });
  // circuit light down the counter's front corners and along the strap
  for (let y = 3; y <= 6; y += 1) { F.put(-9, y, 6, hash(y, 1) < 0.5 ? K('trace') : C.iron2); F.put(8, y, 6, hash(y, 2) < 0.5 ? K('trace') : C.iron2); }
  // ---- side boards and the back wall, a shelf of glowing potions, a lower shelf of jars
  for (const x of [-9, 8]) F.fill(x, 1, -6, x, 7, 1, (xx, y, z) => (y === 7 ? K('w2') : mod(y, 3) === 0 ? K('w1') : tone(PLANK, z, Math.floor(y / 3), xx, 6)));
  F.fill(-9, 1, -6, 8, 16, -6, (x, y, z) => (y === 16 ? K('w2') : mod(y, 3) === 0 ? K('w1') : hash(x, y, 3) < 0.04 ? C.iron2 : tone(PLANK, Math.floor((x + 40 + (Math.floor(y / 3) % 2) * 4) / 8), Math.floor(y / 3), 6, 7)));
  F.fill(-8, 11, -5, 7, 11, -4, (x, y, z) => (z === -4 ? K('w4') : K('w3')));
  for (let x = -8; x <= 6; x += 3) {
    const k = mod(Math.floor(hash(x, 11) * 4), 4), potion = [K('pot1'), K('pot2'), K('pot3'), K('pot4')][k];
    F.fill(x, 12, -5, x + 1, 13, -5, (xx, y) => (y === 13 && xx === x + 1 ? K('lamp1') : potion));
    F.put(x, 14, -5, K('cork')); F.put(x + 1, 14, -5, hash(x, 14) < 0.5 ? K('cork') : C.brass2);
  }
  // ---- inside: a crate with a smaller one on it, a sack, a coil of rope
  crate(F, -8, 1, -5, -4, 5, -2, 1);
  crate(F, -7, 6, -5, -5, 8, -3, 2);
  sack(F, 5.5, 1, -3, 2.3, 7);
  for (let a = 0; a < 12; a += 1) F.put(1 + Math.round(Math.cos(a * 0.52) * 1.6), 1, -3 + Math.round(Math.sin(a * 0.52) * 1.6), K('rope'));
  // ---- brass scales at the counter's left end: a post, a beam, two pans on chains
  F.fill(-8, 10, 3, -6, 10, 4, C.brass1);
  F.fill(-7, 11, 3, -7, 15, 3, (x, y) => (y === 15 ? C.brass2 : C.iron3));
  F.fill(-9, 16, 3, -5, 16, 3, (x) => (x === -7 ? C.brass2 : C.brass1));
  for (const x of [-9, -5]) { F.fill(x, 13, 3, x, 15, 3, C.iron2); F.fill(x - 1, 12, 3, x + 1, 12, 4, C.brass2); }
  F.put(-9, 13, 4, K('lamp2')); // a weight, gleaming
  // ---- the awning: cream and tinted stripes 3 wide, running back to front, rafters under it
  for (let z = -8; z <= 9; z += 1) for (let x = -12; x <= 11; x += 1) {
    if (z === -8 && (x === -1 || x === 0)) continue; // the tag's post goes through here
    const band = Math.floor((x + 12) / 3), tinted = band % 2 === 1, y = yc(z);
    const edge = x === -12 || x === 11;
    const put = (yy, zz) => (tinted ? T.put(x, yy, zz, edge ? K('tw3') : TINT(x, yy, zz)) : F.put(x, yy, zz, edge ? K('cv3') : CREAM(x, yy, zz)));
    put(y, z);
    if (z > -8 && yc(z) < yc(z - 1)) put(yc(z - 1) - 1, z - 1); // close the step underneath
  }
  // rafters and cross beams under it (never where the cloth already is)
  const under = (id) => (x, y, z) => (T.at(x, y, z) || F.at(x, y, z) ? 0 : typeof id === 'function' ? id(x) : id);
  for (let z = -8; z <= 8; z += 1) { for (const x of [-11, 10]) F.put(x, yc(z) - 1, z, under(K('w2'))); if (z % 4 === 0) for (const x of [-1, 0]) F.put(x, yc(z) - 1, z, under(K('w1'))); }
  F.fill(-11, yc(6) - 1, 5, 10, yc(6) - 1, 5, under((x) => (mod(x, 5) === 0 ? C.iron2 : K('w2'))));
  F.fill(-11, yc(-7) - 1, -7, 10, yc(-7) - 1, -7, under(K('w2')));
  // the valance: scallops under the lip, a cream tassel on each coloured one
  for (let x = -12; x <= 11; x += 1) {
    const band = Math.floor((x + 12) / 3), tinted = band % 2 === 1, i = (x + 12) % 3, depth = i === 1 ? 4 : 3, top = yc(9) - 1;
    for (let y = top; y > top - depth; y -= 1) (tinted ? T.put(x, y, 9, y === top ? K('tw2') : TINT(x, y, 9)) : F.put(x, y, 9, y === top ? K('cv2') : CREAM(x, y, 9)));
    if (tinted && i === 1) F.put(x, top - depth, 9, K('cv1'));
  }
  // ---- a curtain across the back, from the back wall up to the awning, in folds
  for (let x = -9; x <= 8; x += 1) for (let y = 17; y < yc(-7) - 1; y += 1) T.put(x, y, -7, mod(x, 3) === 0 ? K('tw3') : mod(x, 3) === 1 ? K('tw1') : K('tw2'));
  // ---- the drape over the counter's front, scalloped, fringed
  for (let x = -7; x <= 6; x += 1) {
    const k = mod(x + 7, 4), bottom = k === 1 || k === 2 ? 3 : 4;
    for (let y = 8; y >= bottom; y -= 1) T.put(x, y, 6, y === 8 ? K('tw3') : mod(x, 2) ? K('tw2') : TINT(x, y, 6));
    if (k === 1) F.put(x, bottom - 1, 6, K('cv1'));
  }
  // ---- a lantern on a bracket off the front-left post
  F.fill(11, 32, 6, 12, 32, 6, C.iron2); F.put(12, 33, 6, C.iron3);
  lantern(F, STALL.lantern[0], STALL.lantern[1], STALL.lantern[2]);
  // ---- the tag's post up the back, its arm reaching forward over the awning
  tagPost(F, -8, 0, 62, 0);
  F.fill(-1, 0, -9, 0, 0, -8, C.iron2); // its foot
  return { F, T };
}

// ---------------------------------------------------------------------------------------------
// The cart. Model voxels x -11..10, z -14..7, y 0..46: wheels either side of a planked bed,
// front legs, handles out the back on a prop, a bolt of cloth in the bed, a striped canopy.
const cy = (x) => 33 + Math.round(3 * (1 - ((x + 0.5) / 9.5) ** 2)); // the canopy's arch, over Yuuv's head
function cartGrids() {
  const F = box([-11, 0, -14], [12, 61, 7]);
  const T = box([-11, 0, -14], [12, 61, 7]);
  // ---- wheels: an iron tyre, eight spokes, a brass hub
  for (const [xa, xb] of [[-10, -9], [8, 9]]) for (let y = 0; y <= 11; y += 1) for (let z = -6; z <= 6; z += 1) {
    const d = Math.hypot(y - 5, z), a = Math.atan2(y - 5, z), s = mod((a / (Math.PI / 4)) + 0.5, 1);
    let id = 0;
    if (d > 4.4 && d <= 5.4) id = hash(y, z, xa) < 0.2 ? C.iron3 : K('tyre');
    else if (d > 3.6 && d <= 4.4) id = K('w2');
    else if (d < 1.4) id = d < 0.7 ? C.iron2 : C.brass2;
    else if (Math.abs(s - 0.5) < 0.16) id = K('w3');
    if (id) for (let x = xa; x <= xb; x += 1) F.put(x, y, z, x === xa || x === xb ? id : 0);
  }
  F.fill(-8, 5, 0, 7, 5, 0, C.iron2); // the axle
  // ---- the bed: boards, a low rim, beams under it
  F.fill(-8, 7, -5, 7, 7, 5, (x, y, z) => (mod(z, 3) === 0 ? K('w1') : tone(PLANK, Math.floor((x + 40) / 6), z, 7, 8)));
  F.fill(-8, 8, -5, 7, 9, 5, (x, y, z) => {
    if (!(x === -8 || x === 7 || z === -5 || z === 5)) return 0;
    if ((x === -8 || x === 7) && (z === -5 || z === 5)) return C.brass2;
    return y === 9 ? K('w4') : tone(PLANK, x + z, 8, 1, 9);
  });
  for (const z of [-4, 4]) F.fill(-8, 6, z, 7, 6, z, K('w1'));
  // ---- legs at the front, handles out the back resting on a prop
  for (const x of [-7, 6]) {
    F.fill(x, 0, 4, x, 6, 4, (xx, y) => (y <= 1 ? C.iron2 : K('w2')));
    F.rope([[x + 0.5, 8.5, -5], [x + 0.5, 7.2, -13.5]], 0.5, 0.5, K('w3'));
    F.fill(x, 0, -12, x, 6, -12, (xx, y) => (y === 0 ? C.iron2 : K('w1')));
  }
  F.fill(-7, 7, -14, 6, 7, -14, (x) => (x === -7 || x === 6 ? K('w3') : K('w4'))); // the grip
  // a basket hung on the right handle, a sack on the bed's back corner
  F.fill(4, 3, -11, 7, 6, -9, (x, y, z) => ((x === 4 || x === 7 || z === -11 || z === -9 || y === 3) ? ((x + y + z) % 2 ? K('basket1') : K('basket2')) : y === 6 ? K('pot4') : 0));
  F.put(5, 7, -10, K('rope')); F.put(6, 7, -10, K('rope'));
  sack(F, -5.5, 10, -3, 1.8, 5);
  // ---- the bolt of cloth in the bed (tinted), folds every third row
  T.fill(-7, 8, -4, 6, 9, 4, (x, y, z) => (y === 9 && mod(z, 3) === 0 ? K('tw3') : y === 8 ? K('tw2') : TINT(x, y, z)));
  // ---- canopy poles and the striped arch, a valance front and back
  for (const [x, z] of [[-8, -5], [7, -5], [-8, 5], [7, 5]]) F.fill(x, 10, z, x, cy(x) - 1, z, (xx, y) => (y === 10 ? C.brass2 : y % 4 === 0 ? C.iron3 : C.iron1));
  const post = (x, z) => z === -6 && (x === -1 || x === 0); // where the tag's post goes up through the canopy
  const cloth = (x, y, z, edge) => {
    if (post(x, z)) return;
    if (Math.floor((x + 9) / 3) % 2) T.put(x, y, z, edge ? K('tw3') : TINT(x, y, z));
    else F.put(x, y, z, edge ? K('cv3') : CREAM(x, y, z));
  };
  for (let x = -9; x <= 8; x += 1) for (let z = -6; z <= 6; z += 1) {
    const edge = z === -6 || z === 6;
    cloth(x, cy(x), z, edge);
    if (x > -9 && cy(x) !== cy(x - 1)) { const hiX = cy(x) > cy(x - 1) ? x : x - 1; cloth(hiX, Math.min(cy(x), cy(x - 1)), z, edge); } // close the step underneath
  }
  for (const z of [-6, 6]) for (let x = -9; x <= 8; x += 1) {
    const tinted = Math.floor((x + 9) / 3) % 2 === 1, i = (x + 9) % 3, depth = i === 1 ? 3 : 2;
    for (let y = cy(x) - 1; y > cy(x) - 1 - depth; y -= 1) cloth(x, y, z, false);
    if (tinted && i === 1 && !post(x, z)) F.put(x, cy(x) - 1 - depth, z, K('cv1'));
  }
  // ---- a lantern off the front-left pole, the tag's post at the back
  F.fill(8, 31, 5, 10, 31, 5, C.iron2); F.put(10, 32, 5, C.iron3);
  lantern(F, CART.lantern[0], CART.lantern[1], CART.lantern[2]);
  tagPost(F, -6, 0, 60, 0);
  return { F, T };
}

let stallCache = null, cartCache = null;
const stalls = () => (stallCache ||= stallGrids());
const carts = () => (cartCache ||= cartGrids());
const one = (name, grid) => ({ gait: 'still', build: () => ({ parts: { [name]: grid().part(name, [0, 0, 0]) } }) });
export const stallFrame = () => one('frame', () => stalls().F);
export const stallCloth = () => one('cloth', () => stalls().T);
export const cartFrame = () => one('frame', () => carts().F);
export const cartCloth = () => one('cloth', () => carts().T);

// ---------------------------------------------------------------------------------------------
// The price tag: a thread, a ring, a tag with clipped corners and a punched hole, the glyph, scanlines.
// Drawn in the stall's own model voxels, hanging from `top` (x -0.5, z 0.5).
function tagPart(glyph, [core, mid, dim], topY) {
  const [c1, c2, c3] = [core, mid, dim].map((hex) => col(`mkt_holo_${hex.toString(16)}`, hex, true));
  const y0 = Math.floor(topY) - 16; // the tag's bottom border
  const b = box([-6, y0, 0], [4, Math.floor(topY), 0]);
  for (let y = y0 + 13; y < Math.floor(topY); y += 1) b.put(-1, y, 0, (y + 1) % 2 ? c2 : c3); // the thread, up to the arm's eye
  for (let y = y0; y <= y0 + 12; y += 1) for (let x = -6; x <= 4; x += 1) {
    const top = y === y0 + 12, bottom = y === y0, side = x === -6 || x === 4;
    if (top && (x === -6 || x === 4)) continue; // clipped corners
    if (y === y0 + 10 && x === -1) continue; // the hole
    const gi = x + 4, gj = y0 + 8 - y;
    if (gi >= 0 && gi < 7 && gj >= 0 && gj < 7 && glyph[gj][gi] === '#') b.put(x, y, 0, (gi + gj) % 4 ? c1 : c2);
    else if (top || bottom || side || (y === y0 + 11 && (x === -5 || x === 3))) b.put(x, y, 0, (x + y) % 5 === 0 ? c1 : c2);
    else if (y % 2 === 0 && hash(x, y, 13) > 0.3) b.put(x, y, 0, c3);
  }
  for (const x of [-2, 0]) b.put(x, y0 + 10, 0, c1); // the hole's rim
  return b.part('tag', [-0.5, topY, 0.5]);
}

// ---------------------------------------------------------------------------------------------
// The wares. Each draws in its own voxels (origin at its base centre on the counter, front +z)
// and returns { item, sub? }: a base, and one part that moves (a child of the base).
const at0 = [0, 0, 0];
const ITEMS = {
  // three theatre masks on a turntable: comedy, tragedy, and a robot's: switchable personas
  personaforge() {
    const base = box([-4, 0, -4], [3, 4, 3]);
    base.fill(-4, 0, -4, 3, 0, 3, (x, y, z) => (Math.abs(x + 0.5) + Math.abs(z + 0.5) > 6 ? 0 : tone([K('w3'), K('w4'), K('w3')], x, 0, z, 2)));
    base.fill(-1, 1, -1, 0, 3, 0, (x, y) => (y === 2 ? C.brass2 : C.brass1));
    base.fill(-3, 4, -3, 2, 4, 2, (x, y, z) => (Math.hypot(x + 0.5, z + 0.5) > 3.3 ? 0 : Math.hypot(x + 0.5, z + 0.5) > 2.4 ? C.brass2 : C.iron2));
    const sub = box([-5, 5, -5], [4, 13, 4]);
    sub.fill(-3, 5, -3, 2, 11, 2, (x, y, z) => ((x + y + z) % 3 ? K('velvet') : K('velvet2')));
    const M = {
      comedy: [K('maskG'), K('maskG2'), K('eyeG'), ['.oooo.', 'oooooo', 'oeooeo', 'oooooo', 'moooom', '.mmmm.', '..oo..']],
      tragedy: [K('maskL'), K('maskL2'), K('eyeV'), ['.oooo.', 'oooooo', 'oeooeo', 'otoooo', '.mmmm.', 'moooom', '..oo..']],
      robot: [K('maskS'), K('maskS2'), K('eyeC'), ['.oooo.', 'oooooo', 'ovvvvo', 'oooooo', 'omomom', '.oooo.', '..oo..']],
    };
    const face = ([c1, c2, eye, rows], put) => rows.forEach((row, j) => [...row].forEach((ch, i) => {
      const y = 11 - j;
      const id = { o: (i + j) % 4 === 0 ? c2 : c1, m: K('mouth'), e: eye, v: K('eyeC'), t: K('tear') }[ch];
      if (id) put(i, y, id);
    }));
    face(M.comedy, (i, y, id) => sub.put(-3 + i, y, 3, id)); // front: x -3..2 at z 3
    face(M.tragedy, (i, y, id) => sub.put(-4, y, 2 - i, id)); // left side
    face(M.robot, (i, y, id) => sub.put(3, y, -3 + i, id)); // right side
    sub.put(3, 12, -1, C.iron3); sub.put(3, 13, -1, K('eyeC')); // the robot's antenna
    sub.fill(-3, 12, -3, 2, 12, 2, (x, y, z) => (hash(x, z, 3) < 0.5 ? K('velvet2') : 0));
    sub.rope([[-3, 11, 3], [-4.5, 9, 3.6], [-4.8, 7, 3.2]], 0.5, 0.5, K('ribbonR')); // ribbons off the masks
    sub.rope([[-4, 11, -2], [-4.6, 9, -3.6], [-4.2, 7, -4.4]], 0.5, 0.5, K('ribbonB'));
    const item = base.part('item', at0);
    return { item, sub: sub.part('sub', [0, 5, 0], base) };
  },
  // a brass magnifier on a stand, sweeping over a glowing neuron laid on a slate
  lora() {
    const base = box([-6, 0, -4], [5, 11, 3]);
    base.fill(-6, 0, -4, 5, 0, 3, (x, y, z) => (x === -6 || x === 5 || z === -4 || z === 3 ? C.brass1 : tone([K('slate1'), K('slate2'), K('slate3')], x, 0, z, 4)));
    // (the magnifier's lens is the moving part: a brass ring tilted to the viewer, glints in the glass)
    base.fill(-3, 1, -1, -2, 2, 0, (x, y) => (y === 2 ? K('nc2') : K('nc1'))); // the soma
    base.put(-3, 2, -1, K('nc1'));
    for (const pts of [[[-3, -1], [-4, -2], [-5, -3]], [[-3, 0], [-5, 1], [-5, 2]], [[-2, 0], [-2, 2]], [[-3, -1], [-3, -3]], [[-1, -1], [1, -1], [3, 0], [4, 0]], [[3, 0], [4, 2]], [[3, 0], [4, -2]]]) {
      for (let k = 1; k < pts.length; k += 1) {
        const [a, c] = [pts[k - 1], pts[k]], n = Math.max(Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1]));
        for (let s = 0; s <= n; s += 1) base.put(Math.round(a[0] + ((c[0] - a[0]) * s) / n), 1, Math.round(a[1] + ((c[1] - a[1]) * s) / n), k === pts.length - 1 && s === n ? K('nc1') : s % 2 ? K('nc3') : K('nc2'));
      }
    }
    base.fill(4, 1, -3, 4, 10, -3, (x, y) => (y % 3 === 0 ? C.brass2 : C.iron3)); // the stand
    const sub = box([-6, 4, -4], [5, 11, 3]);
    sub.rope([[4, 10, -3], [2.2, 9.2, -1.8], [1.3, 8.6, -1]], 0.5, 0.5, C.brass1); // the arm, from the stand to the ring
    for (let a = 0; a < 48; a += 1) { const t = (a / 48) * Math.PI * 2; sub.put(Math.floor(-1.5 + Math.cos(t) * 3), Math.floor(7.5 + Math.sin(t) * 2.2), Math.floor(-0.5 - Math.sin(t) * 2.1), a % 8 === 0 ? C.brass1 : C.brass2); }
    sub.put(-3, 8, -1, K('glint')); sub.put(-2, 9, -2, K('glint'));
    const item = base.part('item', at0);
    return { item, sub: sub.part('sub', [4.5, 10, -2.5], base) };
  },
  // three big name tags in three colours on strings from a brass spike, a grinning emoji leaning on the block
  polyner() {
    const base = box([-6, 0, -2], [5, 13, 3]);
    base.fill(-5, 0, -2, 4, 1, 1, (x, y, z) => (y === 1 && (x === -5 || x === 4 || z === 1) ? K('top3') : tone([K('w3'), K('w4')], x, y, z, 5)));
    base.fill(-1, 2, -1, 0, 12, -1, (x, y) => (y === 12 ? C.brass2 : y % 3 === 0 ? C.brass1 : C.iron3));
    base.put(-1, 13, -1, C.brass2);
    // the emoji: a round yellow face leaning on the block's front, black eyes, a grin
    base.fill(-3, 1, 2, 1, 5, 2, (x, y) => ((x === -3 || x === 1) && (y === 1 || y === 5) ? 0 : K('tagY')));
    for (const [x, y] of [[-2, 4], [0, 4], [-3, 3], [1, 3], [-2, 2], [-1, 2], [0, 2]]) base.put(x, y, 3, K('smile'));
    const sub = box([-7, 1, -3], [6, 12, 2]);
    // a tag: five wide, seven tall, clipped top corners, a punched hole, a coloured head, white with lines of writing
    const tag = (x0, y0, z, c) => {
      for (let j = 0; j < 7; j += 1) for (let i = 0; i < 5; i += 1) {
        const top = j === 6;
        if (top && (i === 0 || i === 4)) continue;
        if (j === 5 && i === 2) continue; // the hole
        const x = x0 + i, y = y0 + j;
        sub.put(x, y, z, j >= 4 ? c : j === 0 ? c : (j === 1 || j === 3) && i > 0 && i < 4 ? K('ink') : K('tagW'));
      }
      sub.rope([[x0 + 2.5, y0 + 5.5, z + 0.5], [-0.5, 11.5, -0.5]], 0.5, 0.5, K('ink'));
    };
    tag(-7, 3, 0, K('tagR')); tag(-2, 2, 1, K('tagB')); tag(2, 4, -1, K('tagG'));
    const item = base.part('item', at0);
    return { item, sub: sub.part('sub', [-0.5, 11.5, -0.5], base) };
  },
  // an open adventure book; a small dragon climbs out of the fold
  storymode() {
    const base = box([-7, 0, -4], [6, 3, 6]);
    base.fill(-7, 0, -4, 6, 0, 4, (x, y, z) => (x === -7 || x === 6 || z === -4 || z === 4 ? K('cover1') : K('cover2')));
    base.fill(-6, 1, -3, 5, 2, 3, (x, y, z) => {
      const gutter = x === -1 || x === 0;
      if (gutter && y === 2) return 0;
      if (y === 1) return z === 3 || z === -3 || x === -6 || x === 5 ? K('pageEdge') : K('page2');
      const lx = x < 0 ? x + 6 : x; // 0..4 across each page
      const line = mod(z, 2) === 0 && lx > 0 && lx < 5 && hash(x, z, 3) > 0.25;
      if (x < 0 && lx <= 1 && z >= 1) return z === 3 ? K('gold') : K('illum'); // the illuminated capital
      if (x > 0 && Math.hypot(x - 2.5, z + 0.5) < 2.2) return Math.hypot(x - 2.5, z + 0.5) > 1.4 ? K('runeP') : K('page1'); // a summoning circle
      return line ? K('ink') : K('page1');
    });
    base.fill(-1, 1, -3, 0, 1, 3, K('pageEdge'));
    base.fill(2, 0, 5, 2, 0, 6, K('ribbonR')); base.put(2, 1, 4, K('ribbonR')); // the bookmark, over the edge
    const sub = box([-3, -3, -3], [2, 8, 3]);
    sub.egg(0, 1.5, 0, 1.6, 2, 1.8, (x, y, z) => (z >= 1 && y <= 2 ? K('dragBelly') : (x + y) % 3 ? K('drag1') : K('drag2')));
    sub.egg(0, 4.6, 1.2, 1.3, 1.2, 1.5, (x, y, z) => (y <= 4 && z >= 2 ? K('dragBelly') : K('drag1')));
    sub.put(-1, 5, 2, K('dragEye')); sub.put(0, 5, 2, K('dragEye'));
    sub.fill(-1, 4, 3, 0, 4, 3, K('drag2')); // snout
    sub.put(-1, 6, 0, K('dragBelly')); sub.put(0, 6, 0, K('dragBelly')); // horns
    for (const s of [-1, 1]) for (const [dy, dz] of [[0, 0], [1, 0], [1, -1], [2, -1]]) sub.put(s < 0 ? -2 - dy % 2 : 1 + dy % 2, 2 + dy, -1 + dz, K('dragWing'));
    sub.rope([[0, -0.5, -1.5], [0.5, -2, -2.5], [-0.5, -2.5, -2]], 0.5, 0.5, K('drag2'));
    const item = base.part('item', at0);
    return { item, sub: sub.part('sub', [0, 1, 0], base) };
  },
  // a server rack, lights blinking in its bays; a little cloud hovers over it, data trickling down
  cloudbuilder() {
    const base = box([-4, 0, -3], [3, 10, 2]);
    base.fill(-3, 0, -2, 2, 9, 1, (x, y, z) => {
      if (y === 0 || y === 9) return C.brass1;
      if (z === 1) {
        if (x === -3 || x === 2) return y % 2 ? C.brass2 : C.iron3;
        if (y % 2 === 0) return K('rack1');
        const r = hash(x, y, 4);
        return r < 0.22 ? K('ledG') : r < 0.34 ? K('ledA') : r < 0.44 ? K('ledC') : (x + y) % 2 ? K('rack2') : K('rack3');
      }
      return tone([K('rack1'), K('rack2')], x, y, z, 2);
    });
    const sub = box([-5, 10, -3], [5, 17, 2]);
    for (const [x, y, z, r] of [[-2, 14, 0, 2.2], [1, 14.6, -0.4, 2.5], [3, 13.8, 0, 1.8], [-0.4, 15.8, -0.2, 1.7]]) sub.egg(x, y, z, r, r * 0.8, r * 0.85, (xx, yy) => (yy <= 13 ? K('cl3') : yy <= 14 ? K('cl2') : K('cl1')));
    for (const [x, y] of [[0, 10], [-1, 11]]) sub.put(x, y, 0, K('data')); // data trickling down to the rack
    const item = base.part('item', at0);
    return { item, sub: sub.part('sub', [0, 14, 0], base) };
  },
  // a console with four small screens on arms: agents at work side by side
  jemdash() {
    const base = box([-6, 0, -4], [5, 12, 3]);
    base.fill(-5, 0, 0, 4, 2, 3, (x, y, z) => {
      if (y > 2 - Math.floor(z / 2)) return 0; // a sloped deck
      if (y === 2 - Math.floor(z / 2) && z > 0 && x > -5 && x < 4) return hash(x, z, 6) < 0.18 ? K('scr2') : (x + z) % 2 ? K('key1') : K('key2');
      return tone([K('rack2'), K('rack3')], x, y, z, 3);
    });
    base.fill(-1, 0, -3, 0, 10, -3, (x, y) => (y % 4 === 0 ? C.brass2 : C.iron2));
    const screen = (x0, y0, c) => {
      base.fill(x0, y0, -2, x0 + 3, y0 + 2, -2, (x, y) => (x === x0 || x === x0 + 3 || y === y0 || y === y0 + 2 ? C.iron1 : K('scrDark')));
      base.put(x0 + 1, y0 + 1, -2, c); if (hash(x0, y0) < 0.6) base.put(x0 + 2, y0 + 1, -2, c);
      base.fill(x0, y0 + 3, -2, x0 + 3, y0 + 3, -2, C.iron2);
    };
    screen(-5, 4, K('scr1')); screen(1, 4, K('scr2')); screen(-5, 8, K('scr3')); screen(1, 8, K('scr4'));
    base.fill(-2, 5, -3, 1, 5, -3, C.iron3); base.fill(-2, 9, -3, 1, 9, -3, C.iron3);
    const sub = box([-5, 4, -1], [4, 10, -1]);
    for (const [x, y, c] of [[-3, 5, K('scr1')], [3, 5, K('scr2')], [-3, 9, K('scr3')], [3, 9, K('scr4')]]) sub.put(x, y, -1, c);
    const item = base.part('item', at0);
    return { item, sub: sub.part('sub', [0, 7, -0.5], base) };
  },
  // a brain in a jar of light: brass base and lid, glowing glass, wires out of the top
  mlmodule() {
    const base = box([-4, 0, -4], [3, 14, 3]);
    base.fill(-4, 0, -4, 3, 1, 3, (x, y, z) => { const d = Math.hypot(x + 0.5, z + 0.5); return d > 3.8 ? 0 : y === 1 && d < 3 ? K('jar2') : d > 3.1 ? C.brass2 : C.brass1; });
    for (let y = 2; y <= 10; y += 1) for (let a = 0; a < 8; a += 1) { const t = (a / 8) * Math.PI * 2 + 0.2; if ((a + y) % 3 !== 0 || y === 2 || y === 10) base.put(Math.floor(Math.cos(t) * 3.1), y, Math.floor(Math.sin(t) * 3.1), y === 2 || y === 10 ? K('jar2') : K('jar')); }
    base.fill(-4, 11, -4, 3, 11, 3, (x, y, z) => { const d = Math.hypot(x + 0.5, z + 0.5); return d > 3.6 ? 0 : d > 2.8 ? C.brass2 : C.brass1; });
    base.fill(-1, 12, -1, 0, 12, 0, C.brass2); base.put(-1, 13, -1, K('spark'));
    base.rope([[1, 12, 1], [2.5, 13, 2], [3.5, 12, 2.8]], 0.5, 0.5, K('rack1'));
    const sub = box([-3, 3, -3], [2, 9, 2]);
    sub.egg(-0.5 + 0.5, 6.2, 0, 2.5, 2, 2.6, (x, y, z) => {
      if (x === -1 || x === 0) return y > 6 && z > -2 ? K('brain3') : K('brain2'); // the groove between the halves
      const n = noise(x * 2 + z, y * 2 - z, 1.6, 3);
      return n > 0.62 ? K('brain3') : n > 0.4 ? K('brain2') : K('brain1');
    });
    for (const [x, y, z] of [[1, 8, 1], [-2, 7, -1], [2, 6, -2]]) sub.put(x, y, z, K('spark'));
    sub.fill(-1, 3, 0, 0, 4, 0, K('brain3'));
    const item = base.part('item', at0);
    return { item, sub: sub.part('sub', [0, 6, 0], base) };
  },
  // a chessboard with a knight on it; the knight hops its L now and then; a pawn lies fallen
  chess() {
    const base = box([-5, 0, -5], [6, 1, 4]);
    base.fill(-5, 0, -5, 4, 1, 4, (x, y, z) => {
      if (x === -5 || x === 4 || z === -5 || z === 4) return y === 1 ? K('walnut') : C.brass1;
      return y === 0 ? K('walnut') : mod(x + z, 2) ? K('ebony2') : K('ivory');
    });
    base.fill(5, 0, 1, 6, 0, 1, K('ivory')); base.put(6, 0, 2, K('ivory2')); base.put(5, 1, 1, K('ivory2')); // a fallen pawn
    const sub = box([-2, 2, -2], [1, 11, 2]);
    sub.egg(0, 2.6, 0, 1.9, 0.7, 1.9, (x, y, z) => (y === 2 ? K('ebony') : K('ebony2')));
    sub.fill(-1, 3, -1, 0, 5, 0, K('ebony'));
    sub.fill(-1, 6, -2, 0, 9, 0, (x, y, z) => (z === -2 && y >= 7 ? K('gold') : K('ebony2'))); // the neck, a gold mane
    sub.fill(-1, 8, 1, 0, 9, 2, K('ebony')); // the muzzle, reaching forward
    sub.put(-1, 10, -1, K('ebony2')); sub.put(0, 10, -1, K('ebony2')); sub.put(-1, 11, -1, K('ebony')); // ears
    sub.put(-1, 9, 0, K('knightEye')); sub.put(0, 9, 0, K('knightEye'));
    sub.put(-1, 7, 1, K('ebony')); sub.put(0, 7, 1, K('ebony2'));
    const item = base.part('item', at0);
    return { item, sub: sub.part('sub', [0, 2, 0], base) };
  },
  // a ribbon microphone on its stand; sound waves ripple off it in saffron, white and green
  hindi() {
    const base = box([-3, 0, -3], [2, 13, 2]);
    base.fill(-3, 0, -3, 2, 0, 2, (x, y, z) => (Math.hypot(x + 0.5, z + 0.5) > 2.9 ? 0 : Math.hypot(x + 0.5, z + 0.5) > 2 ? K('chrome2') : K('chrome3')));
    base.fill(-1, 1, -1, 0, 4, 0, (x, y) => (y === 4 ? K('chrome1') : K('chrome2')));
    base.fill(-3, 5, -1, 2, 5, 0, K('chrome3')); for (const x of [-3, 2]) base.fill(x, 6, -1, x, 9, 0, K('chrome2')); // the yoke
    base.fill(-2, 6, -2, 1, 12, 1, (x, y, z) => {
      const round = (x === -2 || x === 1) && (z === -2 || z === 1);
      if (round && (y === 6 || y === 12)) return 0;
      if (y === 9) return C.brass2;
      return y % 2 ? K('chrome1') : K('chrome3');
    });
    base.put(-1, 9, 2, K('onAir'));
    const sub = box([2, 3, 0], [11, 15, 0]);
    [[3.2, K('saffron')], [5.2, K('waveW')], [7.2, K('waveG')]].forEach(([r, c]) => {
      for (let a = -0.9; a <= 0.9; a += 0.08) sub.put(Math.floor(-0.5 + Math.cos(a) * r), Math.floor(9 + Math.sin(a) * r), 0, c);
    });
    const item = base.part('item', at0);
    return { item, sub: sub.part('sub', [0, 9, 0.5], base) };
  },
  // a box camera on a tripod; a face-detection frame hangs in the air before its lens
  facereg() {
    const base = box([-4, 0, -3], [3, 12, 4]);
    for (const [x, z] of [[-3, -2], [2, -2], [-1, 2]]) base.rope([[x + 0.5, 0, z + 0.5], [-0.5 + 0.5, 4.5, 0]], 0.5, 0.5, C.iron2);
    base.fill(-3, 5, -2, 2, 9, 1, (x, y, z) => (y === 5 || y === 9 ? K('cam2') : hash(x, y, z) < 0.3 ? K('cam2') : K('cam1')));
    base.fill(-2, 6, 2, 1, 8, 3, (x, y, z) => { const d = Math.hypot(x + 0.5, y - 7); return d > 1.8 ? 0 : z === 3 && d < 1 ? K('lensGlass') : C.brass2; });
    base.put(-1, 7, 4, K('lensGlass'));
    base.fill(1, 10, -1, 2, 11, 0, (x, y) => (y === 11 ? K('flash') : K('chrome2')));
    base.put(-3, 9, 1, K('rec'));
    base.rope([[-3, 8, -1], [-4, 6.5, -1], [-3.5, 5, -0.5]], 0.5, 0.5, K('w1')); // strap
    const sub = box([-5, 3, 6], [4, 12, 6]);
    for (let y = 3; y <= 12; y += 1) for (let x = -5; x <= 4; x += 1) {
      const cx = Math.min(x + 5, 4 - x), cy2 = Math.min(y - 3, 12 - y);
      if ((cx === 0 && cy2 <= 2) || (cy2 === 0 && cx <= 2)) sub.put(x, y, 6, K('faceBox'));
    }
    sub.put(-2, 9, 6, K('faceDim')); sub.put(1, 9, 6, K('faceDim'));
    for (const [x, y] of [[-2, 6], [-1, 5], [0, 5], [1, 6]]) sub.put(x, y, 6, K('faceDim'));
    const item = base.part('item', at0);
    return { item, sub: sub.part('sub', [0, 8, 6.5], base) };
  },
  // the old side-scrolling portfolio: a strip of street with three tiny houses; a tiny Yuuv walks it
  town() {
    const base = box([-7, 0, -2], [6, 11, 2]);
    base.fill(-7, 0, -2, 6, 0, 2, (x, y, z) => (z === 2 ? K('path') : (x + z) % 3 ? K('turf1') : K('turf2')));
    const house = (x0, x1, h, wall, roof) => {
      base.fill(x0, 1, -2, x1, h, 0, (x, y, z) => (z === 0 && y <= 2 && x === x0 + 1 ? K('door') : z === 0 && y === h - 1 && x === x1 - 1 ? K('win') : z === 0 && y === 3 && x === x1 - 1 && h > 5 ? K('win') : wall));
      for (let k = 0; x0 - 1 + k <= x1 + 1 - k; k += 1) base.fill(x0 - 1 + k, h + 1 + k, -2, x1 + 1 - k, h + 1 + k, 0, (x) => (x === x0 - 1 + k || x === x1 + 1 - k ? roof : (x + k) % 3 ? roof : C.iron3));
    };
    house(-6, -3, 5, K('hA'), K('roofA')); house(-1, 2, 7, K('hC'), K('roofB')); house(4, 6, 4, K('hB'), K('roofC'));
    base.fill(3, 1, 1, 3, 4, 1, C.iron2); base.put(3, 5, 1, K('win')); // a tiny lamp
    const sub = box([-1, 1, 1], [0, 5, 2]);
    sub.fill(-1, 1, 1, 0, 1, 1, K('tinyHood')); sub.fill(-1, 2, 1, 0, 3, 1, (x, y) => (y === 2 && x === 0 ? K('tinyBand') : K('tinyHood')));
    sub.fill(-1, 4, 1, 0, 4, 1, K('tinySkin')); sub.fill(-1, 5, 1, 0, 5, 1, K('tinyHair')); sub.put(0, 5, 2, K('tinyHair'));
    const item = base.part('item', at0);
    return { item, sub: sub.part('sub', [0, 1, 1.5], base) };
  },
};

// Each ware's life on the counter (P.item, P.sub), and a livelier one while Yuuv holds it (h, 0 to 1).
const LIFE = {
  personaforge(P, t, h) { P.sub.rotation.y += t * (0.55 + 2.2 * h); },
  lora(P, t, h) { P.sub.rotation.y += 0.45 * Math.sin(t * (0.8 + 1.4 * h)); P.sub.position.y += 0.3 * Math.sin(t * 1.3); },
  polyner(P, t, h) { P.sub.rotation.x += (0.16 + 0.25 * h) * Math.sin(t * (1.7 + 2 * h)); P.sub.rotation.z += 0.05 * Math.sin(t * 1.1); },
  storymode(P, t, h) {
    const up = Math.max(h, clamp01(Math.sin(t * 0.8) * 1.6 - 0.2));
    P.sub.position.y += -3.2 * (1 - up);
    P.sub.scale.setScalar(Math.max(0.001, 0.55 + 0.45 * up));
    P.sub.rotation.y += 0.5 * Math.sin(t * 1.3) * up;
    P.sub.rotation.z += 0.12 * Math.sin(t * 5) * h;
  },
  cloudbuilder(P, t, h) { P.sub.position.y += 0.7 * Math.sin(t * (1.2 + h)) + 1.5 * h; P.sub.position.x += 0.6 * Math.sin(t * 0.5); P.sub.rotation.y += 0.1 * Math.sin(t * 0.4); },
  jemdash(P, t, h) { P.sub.scale.setScalar(((t * (1.8 + 4 * h)) % 1) < 0.55 ? 1 : 0); },
  mlmodule(P, t, h) { P.sub.position.y += 0.5 * Math.sin(t * 1.4); P.sub.rotation.y += t * (0.35 + 1.5 * h); P.sub.scale.setScalar(1 + (0.05 + 0.06 * h) * Math.sin(t * (3 + 3 * h))); },
  chess(P, t, h) {
    const period = h > 0.5 ? 1.2 : 3.4, u = (t % period) / period, hop = clamp01((u - 0.55) / 0.3), leg = Math.floor(t / period) % 2;
    const s = smooth(hop), to = leg ? [0, 0] : [2, 1], from = leg ? [2, 1] : [0, 0];
    P.sub.position.x += from[0] + (to[0] - from[0]) * s;
    P.sub.position.z += from[1] + (to[1] - from[1]) * s;
    P.sub.position.y += 4 * Math.sin(Math.PI * hop);
    P.sub.rotation.y += 0.3 * Math.sin(Math.PI * hop);
  },
  hindi(P, t, h) { const u = (t * (0.9 + 1.5 * h)) % 1; P.sub.scale.setScalar(0.55 + 0.6 * u); P.sub.visible = u < 0.9; },
  facereg(P, t, h) { const lock = 1 + 0.18 * (1 - smooth(((t * 0.5) % 1) / 0.35)); P.sub.scale.setScalar(lock + 0.02 * Math.sin(t * 9)); P.sub.visible = hash(Math.floor(t * 10), 7) > 0.04; P.sub.rotation.y += 0.15 * Math.sin(t * 0.7); },
  town(P, t, h) {
    const x = 5 * Math.sin(t * (0.45 + 0.6 * h)), dir = Math.cos(t * (0.45 + 0.6 * h));
    P.sub.position.x += x; P.sub.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    P.sub.position.y += 0.35 * Math.abs(Math.sin(t * 9));
  },
};

// ---------------------------------------------------------------------------------------------
// goods(id, look, kind): the ware and its price tag, standing in its stall's (or cart's) own voxels.
// look = { glyph: 7 strings of 7, holo: [core, mid, dim] }. ctx.mem.held (0..1) livens the ware.
export function goods(id, look, kind = 'stall') {
  const A = kind === 'cart' ? CART : STALL;
  const seed = [...id].reduce((s, c) => s + c.charCodeAt(0), 0);
  return {
    gait: 'still',
    build() {
      const it = (ITEMS[id] || ITEMS.town)();
      return { parts: { item: { ...it.item, at: it.item.at.map((v, i) => v + A.item[i]) }, sub: it.sub, tag: tagPart(look.glyph, look.holo, A.tag[1]) } };
    },
    setup(ctx) {
      // an invisible box over the whole stall, so a click or a hover anywhere on it finds this stall
      const [x0, z0, x1, z1] = A.body;
      const pick = new ctx.THREE.Mesh(new ctx.THREE.BoxGeometry(x1 - x0 + 2, 48, z1 - z0 + 4), new ctx.THREE.MeshBasicMaterial({ visible: false }));
      pick.position.set((x0 + x1 + 1) / 2, 24, (z0 + z1 + 1) / 2 + 1);
      ctx.model.add(pick);
      ctx.mem.held = 0;
    },
    idle(ctx) {
      const { parts: P, state: { t }, mem } = ctx;
      const glitch = hash(Math.floor(t * 12), seed) < 0.02;
      P.tag.rotation.z += 0.07 * Math.sin(t * 1.25 + seed);
      P.tag.rotation.x += 0.05 * Math.sin(t * 0.9 + seed * 2);
      P.tag.rotation.y += 0.3 * Math.sin(t * 0.4 + seed);
      P.tag.scale.set(glitch ? 0 : 1 + 0.01 * Math.sin(t * 37), 1, 1);
      LIFE[id]?.(P, t + seed, mem.held);
      // a bubble up the jar, a puff of flame from the dragon, a flash from the camera
      if (id === 'mlmodule' && t > (mem.next ?? 0)) {
        const V = ctx.voxel, a = hash(Math.floor(t * 3), 1) * 6.3, r = hash(Math.floor(t * 3), 2) * 1.8, at = ctx.where(P.item);
        ctx.bit(at.x + Math.cos(a) * r * V, at.y + 3 * V, at.z + Math.sin(a) * r * V, 0, 0.55, 0, 1.1, 0.045, 0xe6fdff, 0x6ff2ff, { drag: 0.2 });
        mem.next = t + 0.3 + hash(Math.floor(t * 3), 3) * 0.3;
      }
      if (id === 'storymode' && mem.held > 0.9 && t > (mem.next ?? 0)) {
        const at = ctx.where(P.sub);
        ctx.burst({ x: at.x, y: at.y + 0.8, z: at.z }, 8, 0.9, [0xffe08a, 0xff4a1a], 0.05, 0.45);
        mem.next = t + 1.1;
      }
      if (id === 'facereg' && mem.held > 0.9 && !mem.flashed) {
        mem.flashed = true;
        const at = ctx.where(P.item);
        ctx.burst({ x: at.x, y: at.y + 1.6, z: at.z }, 14, 1.4, [0xffffff, 0xbfe9ff], 0.05, 0.35);
      }
      if (mem.held < 0.1) mem.flashed = false;
    },
  };
}

// The price tag's glyph for each ware (7 x 7), and its colours: [core, mid, dim].
export const LOOKS = {
  personaforge: { tint: 0x8a4fd8, holo: [0xf3e6ff, 0xc08cff, 0x7a4ac0], glyph: ['.#####.', '#.....#', '#.#.#.#', '#.....#', '##...##', '#.###.#', '.#####.'] },
  lora: { tint: 0x1fa3a0, holo: [0xe0fffb, 0x5ff5e6, 0x1f9f95], glyph: ['.###...', '#...#..', '#.#.#..', '#...#..', '.###...', '....##.', '.....##'] },
  polyner: { tint: 0xf0a030, holo: [0xfff4d8, 0xffc85a, 0xc4851f], glyph: ['..####.', '.#....#', '#..#..#', '#.....#', '#.###.#', '#.....#', '#######'] },
  storymode: { tint: 0xc8323a, holo: [0xffe8e0, 0xff6a5a, 0xb8302a], glyph: ['.......', '##...##', '#.#.#.#', '#..#..#', '#..#..#', '#..#..#', '###.###'] },
  cloudbuilder: { tint: 0x3a8ee0, holo: [0xe8f4ff, 0x7cc8ff, 0x3a82c4], glyph: ['.......', '...##..', '.##..#.', '#.....#', '#.....#', '.#####.', '.......'] },
  jemdash: { tint: 0x2fae5a, holo: [0xe8fff0, 0x5dffa0, 0x2fae6a], glyph: ['###.###', '#.#.#.#', '###.###', '.......', '###.###', '#.#.#.#', '###.###'] },
  mlmodule: { tint: 0xd23c8e, holo: [0xffe6f6, 0xff6ac8, 0xb83090], glyph: ['.##.##.', '#..#..#', '#.#.#.#', '#..#..#', '.#.#.#.', '..#.#..', '...#...'] },
  chess: { tint: 0x2c2c34, holo: [0xffffff, 0xd8e0ff, 0x8890b8], glyph: ['...##..', '..####.', '.##.##.', '###..#.', '..###..', '.####..', '######.'] },
  hindi: { tint: 0xff7f24, holo: [0xfff0dc, 0xffa640, 0xc86a1a], glyph: ['..#..#.', '.##...#', '###.#.#', '###.#.#', '###.#.#', '.##...#', '..#..#.'] },
  facereg: { tint: 0x4450c8, holo: [0xe8ecff, 0x8f9cff, 0x4a54c0], glyph: ['##...##', '#.....#', '..#.#..', '.......', '..###..', '#.....#', '##...##'] },
  town: { tint: 0xe8645a, holo: [0xffece6, 0xff8a70, 0xc0503a], glyph: ['...#...', '..###..', '.#####.', '#######', '.#.#.#.', '.#.#.#.', '.#####.'] },
};

// A self-check: node js/models/mkt_stall.js (every ware builds, its parts sit inside their stall, the cloth and frame never share a voxel)
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const count = (g) => g.data.reduce((n, v) => n + (v ? 1 : 0), 0);
  for (const [name, { F, T }] of [['stall', stallGrids()], ['cart', cartGrids()]]) {
    let clash = 0;
    for (let i = 0; i < F.g.data.length; i += 1) if (F.g.data[i] && T.g.data[i]) clash += 1;
    if (clash) throw new Error(`${name}: frame and cloth overlap in ${clash} voxels`);
    console.log(name, 'frame', count(F.g), 'cloth', count(T.g));
  }
  for (const id of Object.keys(ITEMS)) {
    for (const kind of ['stall', 'cart']) {
      const d = goods(id, LOOKS[id], kind).build();
      for (const [n, p] of Object.entries(d.parts)) if (!count(p.grid)) throw new Error(`${id}.${n} is empty`);
    }
  }
  console.log('mkt_stall.js ok:', Object.keys(ITEMS).length, 'wares');
}
