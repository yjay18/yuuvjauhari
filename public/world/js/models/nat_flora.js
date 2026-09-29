// The town's plants, in code on the town's voxel grid (0.15 a voxel), colours prefixed nat_. Each builder
// returns a flora model for js/town/nature.js to instance or merge:
//   { parts: [{ b: box, night? }], flex(x, y, z), h, r }
// b is a space.js box in model voxels (origin at the foot, +z the front); `night` marks a part whose glowing
// voxels glow only after dark (bioluminescence); flex gives how far (voxels) the wind may carry a point, so
// the town's flora shader sways crowns, bends crops and swings willow fronds without re-meshing; h and r
// are the model's height and reach (voxels), for spacing and picking.
//
//   trees     oak(seed) beech(seed) pine(seed) seaPine(seed) willow(seed) blossom(seed, 'pink'|'white')
//             fruit(seed, 'apple'|'pear', story)
//   the two special trees are rigs: greatTree() (the old tree on the terrace) and lanternTree()
//   hedges    hedge(seed, 'may'|'berry')
//   crops     wheat(seed) lavender(seed) pumpkin(seed) stook(seed) cabbage(seed)
//   small     flowers(seed, colour) wild(seed) tuft(seed, dune) reeds(seed) lily(seed, bloom) fern(seed)
//             mushrooms(seed, kind) log(seed) rock(seed) ivy(seed, roses) crystals(seed)
import { C, colour, hash, noise } from '../kit/voxel-kit.js';
import { box, tone, smooth, clamp01 } from './space.js';

const col = (name, hex, glow = false) => C[name] ?? colour(name, hex, glow);
for (const [n, hex, glow] of [
  // bark: oak, beech, pine, cherry, willow; moss on the north side
  ['bk1', 0x4a3424], ['bk2', 0x5b4130], ['bk3', 0x3a281b], ['bk4', 0x6b5038],
  ['bb1', 0x8e8a82], ['bb2', 0x7a766e], ['bb3', 0xa29e94],
  ['pb1', 0x5e3a26], ['pb2', 0x74482e], ['pb3', 0x4a2c1c],
  ['cb1', 0x4a3036], ['cb2', 0x5e3c40], ['cb3', 0x7a5458],
  ['wb1', 0x5a4c3a], ['wb2', 0x6e5e48], ['wb3', 0x463a2c],
  ['moss1', 0x4f6e32], ['moss2', 0x6a8a3e],
  // leaves, dark underneath to light on top
  ['ok1', 0x28502a], ['ok2', 0x356633], ['ok3', 0x467d3a], ['ok4', 0x5e9444], ['ok5', 0x7aa84e],
  ['be1', 0x3e6e2a], ['be2', 0x4e8434], ['be3', 0x649a3e], ['be4', 0x80b24c],
  ['pn1', 0x173427], ['pn2', 0x1f4230], ['pn3', 0x2a553b], ['pn4', 0x3a6a48],
  ['sp1', 0x244a32], ['sp2', 0x30603c], ['sp3', 0x40744a], ['sp4', 0x58885a],
  ['wl1', 0x55803a], ['wl2', 0x6a9644], ['wl3', 0x84ac52], ['wl4', 0xa2c268],
  ['pk1', 0xc9608e], ['pk2', 0xe284ae], ['pk3', 0xf2a8c6], ['pk4', 0xfbcfe0],
  ['wh1', 0xd5c9ce], ['wh2', 0xe9e0e2], ['wh3', 0xf6f0ef], ['wh4', 0xfffaf8], ['bl1', 0x5e8a3a],
  ['ap1', 0x2f5e2a], ['ap2', 0x3e7432], ['ap3', 0x55893e], ['ap4', 0x6e9e48],
  ['fr1', 0xc8302a], ['fr2', 0xe25a3a], ['pr1', 0xc6c24a], ['pr2', 0xa8b23c], ['stem', 0x4a3a22],
  ['wd1', 0x7a5634], ['wd2', 0x8a6440], ['wd3', 0x5e4228], ['wicker', 0xb08a52], ['wicker2', 0x8e6a3a],
  // hedges: hawthorn in flower, or in berry
  ['hd1', 0x2a5226], ['hd2', 0x366430], ['hd3', 0x467a3a], ['hd4', 0x5a8e44], ['hf', 0xf4efe6], ['hb', 0xb8283a],
  // crops
  ['wt1', 0xcfae52], ['wt2', 0xe2c66c], ['wt3', 0xb8963e], ['wtS', 0x9c9a4c],
  ['lv1', 0x8a6cc8], ['lv2', 0x7458b0], ['lv3', 0xa68ce2], ['lvS', 0x5e7a52],
  ['pm1', 0xe0741e], ['pm2', 0xc25a12], ['pm3', 0xf29236], ['pmS', 0x5a6a2a], ['vl1', 0x3f7430], ['vl2', 0x558c3a],
  ['hy1', 0xd6be6a], ['hy2', 0xc2a652], ['hy3', 0xe8d288], ['twine', 0x8a6a3a],
  ['cab1', 0x5e9a48], ['cab2', 0x86ba62], ['cab3', 0x3f7a36],
  // flowers, grass, dune grass, reeds, lilies, ferns
  ['fR', 0xe0404a], ['fY', 0xf2cd4c], ['fV', 0xa678e0], ['fW', 0xf6f2e8], ['fP', 0xf08ab8], ['fB', 0x5a8ae8], ['fO', 0xf0903a], ['fC', 0xf6d64a],
  ['fs1', 0x3f7a30], ['fs2', 0x528c3a],
  ['gs1', 0x4d7d33], ['gs2', 0x6a9a40], ['gs3', 0x86b04e],
  ['mg1', 0xa6b070], ['mg2', 0xc2c088], ['mg3', 0x8a9a5a],
  ['rd1', 0x5a7a3a], ['rd2', 0x6e8e44], ['rd3', 0x84a050], ['ct1', 0x5a3a22], ['ct2', 0x74502e],
  ['ll1', 0x3a7a3a], ['ll2', 0x4a8e44], ['ll3', 0x2e6632], ['lf1', 0xfbe8ee], ['lf2', 0xf4b8cc],
  ['fn1', 0x3a7030], ['fn2', 0x4e8a3a], ['fn3', 0x68a24a],
  // mushrooms (the glowing ones glow only after dark), logs, rocks
  ['mR', 0xc8302a], ['mW', 0xf4eee0], ['mB', 0x8a5a36], ['mB2', 0xa87a4a], ['mS', 0xeee4cc],
  ['mg', 0x6ff2ff, true], ['mgB', 0x9dff8a, true], ['mgV', 0xb89cff, true], ['mgS', 0xd8fdff, true],
  ['lg1', 0x5a4028], ['lg2', 0x6e5034], ['lg3', 0x46301e], ['lgE', 0xc8a070], ['lgR', 0xa47e52],
  ['rk1', 0x7a766f], ['rk2', 0x686460], ['rk3', 0x8c877e], ['rk4', 0x57534e],
  // ivy and climbing roses
  ['iv1', 0x24482a], ['iv2', 0x2e5a32], ['iv3', 0x3c6e3a], ['ivS', 0x4a3a28], ['ro1', 0xd0303e], ['ro2', 0xf06070], ['ro3', 0xf6e6e0],
  // crystal flowers in a stone bed, always glowing
  ['cf1', 0x6ff2ff, true], ['cf2', 0xb89cff, true], ['cf3', 0xff7ae0, true], ['cf4', 0xe6fdff, true], ['cs1', 0xa29e94], ['cs2', 0x8a867c], ['cs3', 0xbcb6aa],
  // the old tree: bark, glowing veins, crown, the spirit-lights in it, blossom for its magic
  ['gt1', 0x4a3a2e], ['gt2', 0x5c4838], ['gt3', 0x3a2c22], ['gt4', 0x6e5a46],
  ['gv1', 0x6ff2ff, true], ['gv2', 0xb89cff, true], ['gv3', 0xe6fdff, true],
  ['gc1', 0x234a2e], ['gc2', 0x2e5e36], ['gc3', 0x3e7440], ['gc4', 0x55904c], ['gc5', 0x70a858],
  ['gl1', 0xd8fdff, true], ['gl2', 0xfff2b0, true], ['gb1', 0xffb8e0, true], ['gb2', 0xff8ad0, true], ['gb3', 0xfff0f8, true],
  ['door1', 0x6e4a2a], ['door2', 0x5a3a20], ['knob', 0xf0c24a], ['win', 0xffd98a, true],
  ['duck1', 0xffd23f], ['duck2', 0xf2b62a], ['beak', 0xff8b22], ['eye', 0x151515],
  ['rope', 0xb49a6e], ['seat', 0x8a6440],
  // the lantern tree: dark leaves, paper lanterns
  ['lt1', 0x2e4a3e], ['lt2', 0x3a5e48], ['lt3', 0x4c7454], ['ln1', 0xffb347, true], ['ln2', 0xffe0a0, true], ['ln3', 0xff7a3a, true], ['lcap', 0x3a2a1e],
]) col(`nat_${n}`, hex, glow);
export const K = (n) => C[`nat_${n}`];
const TAU = Math.PI * 2;
const pick = (ids, u) => ids[Math.max(0, Math.min(ids.length - 1, Math.floor(u * ids.length)))];

// ---- pieces trees share ------------------------------------------------------------------------
// Sway: nothing below y0, the full `amp` (voxels) from y1 up.
const sway = (y0, y1, amp) => (x, y) => amp * smooth((y - y0) / (y1 - y0));

// A trunk: a tapering column (flared at the foot) whose axis may bend, bark in vertical fissures.
function trunk(b, h, r0, r1, bark, seed, bend = () => [0, 0]) {
  for (let y = 0; y <= h; y += 1) {
    const t = y / h, [cx, cz] = bend(t), r = r0 + (r1 - r0) * t + (y < 3 ? (3 - y) * 0.4 : 0);
    for (let z = Math.floor(cz - r - 1); z <= Math.ceil(cz + r); z += 1) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r); x += 1) {
      if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > r) continue;
      const a = Math.atan2(z + 0.5 - cz, x + 0.5 - cx), fis = Math.floor((a / TAU + 0.5) * 9 + hash(Math.floor(y / 4), seed) * 0.5);
      b.put(x, y, z, y < 6 && z < cz - 0.5 && hash(x, y, z + seed) < 0.45 ? K('moss1') : bark[(fis + (hash(fis, Math.floor(y / 3), seed) < 0.3 ? 1 : 0)) % bark.length]);
    }
  }
}
// Roots spreading over the ground from the trunk's foot.
function roots(b, seed, n, len, id) {
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * TAU + hash(seed, i, 7) * 0.8;
    b.rope([[Math.cos(a) * 0.8, 1.2, Math.sin(a) * 0.8], [Math.cos(a) * len, 0.2, Math.sin(a) * len]], 0.9, 0.55, id);
  }
}
// A crown of leaf clusters (eggs), shaded dark underneath to light on top in patches, a ragged skin. Only the
// outer skin is bitten, so no hidden hollows cost faces.
function crown(b, blobs, tones, seed, lo, hi, bite = 0.035) {
  for (const [cx, cy, cz, rx, ry, rz = rx] of blobs) {
    b.egg(cx, cy, cz, rx, ry, rz, (x, y, z) => {
      const s = (y - lo) / (hi - lo) + (noise(x + y * 0.5, z - y * 0.3, 4.2, seed) - 0.5) * 0.5 + (x + z) * 0.012;
      return pick(tones, s);
    }, (x, y, z) => {
      const k = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + ((z + 0.5 - cz) / rz) ** 2;
      return k < 0.72 || hash(x, y, z + seed * 7) > bite;
    });
  }
}
const around = (seed, n, i, d0, d1) => { const a = (i / n) * TAU + hash(seed, i, 1) * 0.9, d = d0 + hash(seed, i, 2) * (d1 - d0); return [Math.cos(a) * d, Math.sin(a) * d]; };

// ---- trees ---------------------------------------------------------------------------------------
const OAK = [K('ok1'), K('ok2'), K('ok3'), K('ok4'), K('ok5')];
export function oak(seed = 1) {
  const H = 9 + Math.floor(hash(seed, 1) * 3);
  const b = box([-14, 0, -14], [13, H + 17, 13]);
  trunk(b, H + 2, 1.35, 0.95, [K('bk1'), K('bk2'), K('bk1'), K('bk3')], seed);
  roots(b, seed, 4, 4.2, K('bk3'));
  const blobs = [[0, H + 9, 0, 6, 4.4]];
  for (let i = 0; i < 5; i += 1) { const [x, z] = around(seed, 5, i, 4.8, 6.2); blobs.push([x, H + 4.8 + hash(seed, i, 3) * 3, z, 4.3 + hash(seed, i, 4) * 1.2, 3.4]); }
  for (const [x, y, z] of blobs.slice(1, 4)) b.rope([[0, H - 1, 0], [x * 0.55, y - 2.5, z * 0.55]], 1.1, 0.6, K('bk2'));
  crown(b, blobs, OAK, seed, H + 1, H + 14);
  if (seed % 3 === 1) { // a nest box on the trunk, for the songbirds
    b.fill(-1, H - 4, 1, 0, H - 2, 2, (x, y) => (y === H - 2 ? K('wd3') : K('wd2'))); b.put(-1, H - 3, 3, K('bk3')); b.put(0, H - 1, 1, K('wd3'));
  }
  return { parts: [{ b }], flex: sway(H - 3, H + 14, 1.5), h: H + 14, r: 11 };
}

const BEECH = [K('be1'), K('be2'), K('be3'), K('be4')];
export function beech(seed = 1) {
  const H = 12 + Math.floor(hash(seed, 1) * 3);
  const b = box([-12, 0, -12], [11, H + 19, 11]);
  trunk(b, H + 4, 1.2, 0.8, [K('bb1'), K('bb2'), K('bb1'), K('bb3')], seed);
  roots(b, seed, 3, 3.4, K('bb2'));
  const blobs = [[0, H + 5, 0, 5.4, 4.2], [0, H + 10, 0, 5, 4], [0.5, H + 14.5, -0.4, 3.4, 2.8]];
  for (let i = 0; i < 3; i += 1) { const [x, z] = around(seed, 3, i, 3.6, 4.6); blobs.push([x, H + 6 + hash(seed, i, 5) * 4, z, 3.6, 3.2]); }
  crown(b, blobs, BEECH, seed, H + 1, H + 17);
  return { parts: [{ b }], flex: sway(H - 2, H + 17, 1.4), h: H + 17, r: 9 };
}

const PINE = [K('pn1'), K('pn2'), K('pn3'), K('pn4')];
export function pine(seed = 1) {
  const H = 25 + Math.floor(hash(seed, 1) * 6);
  const b = box([-9, 0, -9], [8, H + 3, 8]);
  trunk(b, H, 1.1, 0.45, [K('pb1'), K('pb2'), K('pb1'), K('pb3')], seed);
  // tiers of boughs, each a shallow cone with lobed tips, drooping at the rim
  for (let y0 = 5, i = 0; y0 < H - 2; y0 += 3.6, i += 1) {
    const R = 1.6 + 6.2 * (1 - (y0 - 5) / (H - 4)) ** 0.85, yb = Math.round(y0);
    for (let dy = -1; dy <= 3; dy += 1) for (let z = -9; z <= 8; z += 1) for (let x = -9; x <= 8; x += 1) {
      const a = Math.atan2(z + 0.5, x + 0.5), d = Math.hypot(x + 0.5, z + 0.5), lobe = R * (0.8 + 0.2 * Math.sin(a * 7 + seed + i * 2.1));
      const rr = dy < 0 ? lobe : lobe * (1 - dy / 3.8);
      if (dy < 0 ? d > lobe || d < lobe - 1.3 : d > rr) continue;
      const shade = dy < 0 ? 0 : dy + (d > rr - 1.2 && dy >= 2 ? 1 : 0) - 1;
      b.put(x, yb + dy, z, PINE[Math.max(0, Math.min(3, shade))]);
    }
  }
  b.fill(-1, H, -1, 0, H + 2, 0, (x, y) => (y === H + 2 ? K('pn4') : K('pn3')));
  return { parts: [{ b }], flex: sway(4, H + 2, 1.3), h: H + 2, r: 8 };
}

// A pine the sea wind has bent: the trunk leans away along +x, a flat umbrella of needles on top.
const SEA = [K('sp1'), K('sp2'), K('sp3'), K('sp4')];
export function seaPine(seed = 1) {
  const H = 14 + Math.floor(hash(seed, 1) * 3), L = 5 + hash(seed, 2) * 2;
  const b = box([-8, 0, -9], [17, H + 6, 8]);
  trunk(b, H, 1.25, 0.7, [K('pb1'), K('pb2'), K('pb3')], seed, (t) => [L * t * t, 0.6 * Math.sin(t * 3 + seed)]);
  b.rope([[L * 0.45, H * 0.62, 0], [L * 0.1 - 1, H * 0.8, 2.5], [L * 0.1 - 2.5, H * 0.9, 3.2]], 0.7, 0.5, K('pb2'));
  roots(b, seed, 3, 3.2, K('pb3'));
  crown(b, [[L + 0.5, H + 2, 0, 7.5, 2.1, 6], [L - 3.5, H + 1, 1.5, 4.4, 1.9, 4], [L + 4, H + 1.5, -1.8, 4.2, 1.7, 3.6], [L * 0.1 - 2.5, H * 0.9 + 1.2, 3.2, 3, 1.4, 2.6]], SEA, seed, H - 1, H + 4, 0.05);
  return { parts: [{ b }], flex: sway(3, H + 3, 1.2), h: H + 4, r: 10 };
}

// A weeping willow: a gnarled trunk, limbs arching out, and curtains of fronds falling from them in a fountain
// nearly to the ground; the fronds swing in the wind.
const WILLOW = [K('wl1'), K('wl2'), K('wl3'), K('wl4')];
export function willow(seed = 1) {
  const H = 8 + Math.floor(hash(seed, 1) * 2), top = H + 12;
  const b = box([-11, 0, -11], [10, top + 2, 10]);
  trunk(b, H + 1, 1.8, 1.2, [K('wb1'), K('wb2'), K('wb1'), K('wb3')], seed);
  roots(b, seed, 4, 3.8, K('wb3'));
  const tips = [];
  for (let i = 0; i < 5; i += 1) { const [x, z] = around(seed, 5, i, 4.6, 6); const y = H + 6.5 + hash(seed, i, 3) * 2; b.rope([[0, H, 0], [x * 0.45, y + 1.2, z * 0.45], [x, y, z]], 0.9, 0.5, K('wb2')); tips.push([x, y, z]); }
  crown(b, [[0, H + 9.5, 0, 4.6, 2.6], ...tips.map(([x, y, z]) => [x * 0.72, y + 0.8, z * 0.72, 3.1, 1.7])], WILLOW, seed, H + 5, top, 0.03);
  for (let i = 0; i < 96; i += 1) { // the fronds, hanging from the crown's rim and falling a little outward
    const a = hash(i, seed, 11) * TAU, rr = 2.6 + hash(i, seed, 12) * 5.2;
    const ys = Math.round(H + 9.5 - Math.max(0, rr - 3) * 0.6), ye = 1 + Math.floor(hash(i, seed, 13) * 4 + Math.max(0, 5 - rr) * 0.9);
    for (let y = ye; y <= ys; y += 1) {
      const out = rr + (ys - y) * 0.09, x = Math.round(Math.cos(a) * out - 0.5), z = Math.round(Math.sin(a) * out - 0.5);
      b.put(x, y, z, y === ye ? K('wl4') : i % 3 ? K('wl2') : K('wl3'));
    }
  }
  return {
    parts: [{ b }],
    flex: (x, y, z) => { const r = Math.hypot(x, z); return 1 * smooth((y - 4) / (top - 4)) + (r > 2.5 && y < H + 8 ? 1.5 * clamp01((H + 8 - y) / (H + 4)) * clamp01((r - 2.5) / 2) : 0); },
    h: top, r: 10,
  };
}

// Cherry blossom: a dark banded trunk, spreading limbs, a wide low crown in pink or white, petals fallen round it.
export function blossom(seed = 1, kind = 'pink') {
  const T = kind === 'pink' ? [K('pk1'), K('pk2'), K('pk3'), K('pk4')] : [K('wh1'), K('wh2'), K('wh3'), K('wh4')];
  const H = 6 + Math.floor(hash(seed, 1) * 2);
  const b = box([-12, 0, -12], [11, H + 13, 11]);
  trunk(b, H + 1, 1.3, 0.95, [K('cb1'), K('cb2'), K('cb1')], seed, (t) => [0.8 * Math.sin(t * 2 + seed), 0.5 * Math.cos(t * 2.5 + seed)]);
  for (let y = 1; y < H; y += 3) for (let x = -2; x <= 1; x += 1) for (let z = -2; z <= 1; z += 1) if (b.at(x, y, z) && hash(x, y, z) < 0.6) b.put(x, y, z, K('cb3')); // lenticels
  const blobs = [[0, H + 8, 0, 5, 2.9]];
  for (let i = 0; i < 5; i += 1) {
    const [x, z] = around(seed, 5, i, 4.4, 6.4), y = H + 5 + hash(seed, i, 6) * 2;
    b.rope([[0, H, 0], [x * 0.5, y - 1.5, z * 0.5], [x * 0.8, y - 0.8, z * 0.8]], 0.9, 0.5, K('cb2'));
    blobs.push([x, y, z, 4 + hash(seed, i, 4), 2.6, 3.8 + hash(seed, i, 5)]);
  }
  crown(b, blobs, T, seed, H + 3, H + 11, 0.09);
  for (let z = -11; z <= 10; z += 1) for (let x = -11; x <= 10; x += 1) { // green leaves peeping through, petals fallen
    const d = Math.hypot(x + 0.5, z + 0.5);
    if (d > 2.4 && d < 10 && hash(x, z, seed + 40) < 0.2 * (1 - d / 11)) b.put(x, 0, z, T[2 + (hash(x, z, 3) < 0.5 ? 1 : 0)]);
  }
  for (let i = 0; i < 26; i += 1) { const x = Math.floor((hash(i, seed, 20) - 0.5) * 16), y = H + 5 + Math.floor(hash(i, seed, 21) * 6), z = Math.floor((hash(i, seed, 22) - 0.5) * 16); if (b.at(x, y, z)) b.put(x, y, z, K('bl1')); }
  return { parts: [{ b }], flex: sway(H - 2, H + 11, 1.2), h: H + 11, r: 10 };
}

// An orchard tree: a short trunk, a round crown hung with apples or pears, windfalls at its foot. `story` adds a
// ladder against the crown and a basket of the picked fruit.
const APPLE = [K('ap1'), K('ap2'), K('ap3'), K('ap4')];
export function fruit(seed = 1, kind = 'apple', story = false) {
  const H = 5 + Math.floor(hash(seed, 1) * 2), F = kind === 'apple' ? [K('fr1'), K('fr2')] : [K('pr1'), K('pr2')];
  const b = box([-9, 0, -9], [9, H + 12, 8]);
  trunk(b, H + 1, 1.15, 0.85, [K('bk1'), K('bk2'), K('bk4')], seed);
  const blobs = [[0, H + 5.5, 0, 5.4, 4]];
  for (let i = 0; i < 4; i += 1) { const [x, z] = around(seed, 4, i, 3.2, 4.2); blobs.push([x, H + 3.5 + hash(seed, i, 3) * 2, z, 3.6, 2.8]); b.rope([[0, H - 1, 0], [x * 0.6, H + 3, z * 0.6]], 0.8, 0.5, K('bk2')); }
  crown(b, blobs, APPLE, seed, H + 1, H + 10);
  let n = 0;
  for (let i = 0; i < 300 && n < 16; i += 1) { // fruit hanging under the crown's skin
    const a = hash(i, seed, 30) * TAU, u = hash(i, seed, 31) * 1.1 - 0.7, [bx, by, bz, br, bry] = blobs[i % blobs.length];
    const x = Math.floor(bx + Math.cos(a) * br * Math.sqrt(1 - u * u) * 1.02), y = Math.floor(by + u * bry), z = Math.floor(bz + Math.sin(a) * br * Math.sqrt(1 - u * u) * 1.02);
    if (!b.at(x, y + 1, z) && !b.at(x, y, z)) continue;
    b.put(x, y, z, F[n % 2]); if (kind === 'pear') b.put(x, y - 1, z, F[0]); else if (n % 3 === 0) b.put(x, y + 1, z, K('stem'));
    n += 1;
  }
  for (const [x, z] of [[3, 2], [-2, 4], [4, -3]]) b.put(x, 0, z, F[1]); // windfalls
  if (story) {
    for (let y = 0; y <= H + 5; y += 1) { const x = 6 - Math.round(y * 0.22); b.put(x, y, 3, K('wd2')); b.put(x, y, 0, K('wd2')); if (y % 3 === 1) { b.put(x, y, 1, K('wd1')); b.put(x, y, 2, K('wd1')); } }
    b.fill(-6, 0, 3, -3, 2, 6, (x, y, z) => (y === 2 && x > -6 && x < -3 && z > 3 && z < 6 ? F[(x + z) % 2] : (x + y) % 2 ? K('wicker') : K('wicker2')));
    b.put(-5, 3, 4, F[0]); b.put(-4, 3, 5, F[1]);
  }
  return { parts: [{ b }], flex: sway(H - 1, H + 10, 1), h: H + 10, r: 8 };
}

// ---- hedges and crops ------------------------------------------------------------------------------
// A length of hawthorn hedge (x 0..11, rooted in a low bank), lumpy on top, in flower or in berry.
const HEDGE = [K('hd1'), K('hd2'), K('hd3'), K('hd4')];
export function hedge(seed = 1, kind = 'may') {
  const b = box([-6, 0, -3], [5, 8, 2]);
  for (let x = -6; x <= 5; x += 1) {
    const top = 5 + Math.round(noise(x, seed * 5, 3, seed) * 2.6);
    for (let z = -3; z <= 2; z += 1) {
      const edge = z === -3 || z === 2, h = edge ? top - 1 - (hash(x, z, seed) < 0.4 ? 1 : 0) : top;
      for (let y = 0; y <= h; y += 1) {
        const s = y / 8 + (noise(x, y + z, 2, seed) - 0.5) * 0.5;
        let id = pick(HEDGE, s);
        if (y >= 2 && (edge || y === h) && hash(x, y, z + seed) < 0.1) id = kind === 'may' ? K('hf') : K('hb');
        if (y === 0 && edge) id = K('bk3');
        b.put(x, y, z, id);
      }
    }
  }
  return { parts: [{ b }], flex: sway(2, 8, 0.4), h: 8, r: 6 };
}

// Wheat: a row of stalks (x 0..7) with heavy ears, for fields' crop rows.
export function wheat(seed = 1) {
  const b = box([0, 0, 0], [7, 8, 0]);
  for (let x = 0; x <= 7; x += 1) {
    const h = 4 + Math.round(hash(x, seed, 1) * 1.6);
    for (let y = 0; y < h; y += 1) b.put(x, y, 0, K('wtS'));
    b.put(x, h, 0, hash(x, seed, 2) < 0.5 ? K('wt1') : K('wt3')); b.put(x, h + 1, 0, hash(x, seed, 3) < 0.6 ? K('wt2') : K('wt1'));
  }
  return { parts: [{ b }], flex: sway(0, 7, 2.2), h: 7, r: 4 };
}
// Lavender: a round grey-green bush under a haze of purple spikes.
export function lavender(seed = 1) {
  const b = box([-3, 0, -2], [2, 5, 1]);
  b.egg(0, 1.3, 0, 2.6, 1.6, 1.9, K('lvS'));
  b.egg(0, 3.1, 0, 2.3, 1.3, 1.6, (x, y, z) => (y >= 4 ? K('lv3') : (x + z) % 2 ? K('lv1') : K('lv2')));
  for (const [x, z] of [[-2, 0], [1, -1], [0, 0], [-1, 1], [1, 1]]) if (hash(x, z, seed) < 0.6) b.put(x, 5, z, K('lv1'));
  return { parts: [{ b }], flex: sway(1, 5, 0.9), h: 5, r: 3 };
}
// A pumpkin on its vine: ribbed, a stalk, a big leaf and a curl of vine.
export function pumpkin(seed = 1) {
  const big = hash(seed, 1) < 0.35;
  const b = box([-5, 0, -4], [4, 5, 4]);
  const rx = big ? 2.6 : 2, ry = big ? 2 : 1.6;
  b.egg(0, ry, 0, rx, ry, rx * 0.9, (x, y, z) => (Math.abs(x + 0.5) < 0.6 || Math.abs(z + 0.5) < 0.6 ? K('pm2') : y > ry * 1.5 ? K('pm3') : K('pm1')));
  b.put(0, Math.ceil(ry * 2), 0, K('pmS')); b.put(-1, Math.ceil(ry * 2), 0, K('pmS'));
  for (let x = -5; x <= -2; x += 1) for (let z = 1; z <= 3; z += 1) if (Math.hypot(x + 3.5, z - 2) < 1.9) b.put(x, 0, z, hash(x, z) < 0.5 ? K('vl1') : K('vl2'));
  for (let i = 0; i < 5; i += 1) b.put(2 + i, 0, -2 - (i > 2 ? 1 : 0), K('vl1'));
  return { parts: [{ b }], flex: sway(0, 4, 0.2), h: 5, r: 4 };
}
// A stook: sheaves of cut wheat stood up together, tied round the middle.
export function stook(seed = 1) {
  const b = box([-3, 0, -3], [2, 7, 2]);
  for (let y = 0; y <= 7; y += 1) {
    const r = y < 5 ? 2.6 - y * 0.25 : 1.1 - (y - 5) * 0.3;
    for (let z = -3; z <= 2; z += 1) for (let x = -3; x <= 2; x += 1) if (Math.hypot(x + 0.5, z + 0.5) <= r) b.put(x, y, z, y === 3 ? K('twine') : y > 5 ? K('hy3') : tone([K('hy1'), K('hy2'), K('hy1')], x, y, z, seed));
  }
  return { parts: [{ b }], flex: sway(3, 7, 0.3), h: 7, r: 3 };
}
// A cabbage: pale heart, dark outer leaves curling out.
export function cabbage(seed = 1) {
  const b = box([-2, 0, -2], [1, 3, 1]);
  b.egg(0, 1.3, 0, 1.8, 1.3, 1.8, (x, y) => (y >= 2 ? K('cab2') : K('cab1')));
  for (const [x, z] of [[-2, -2], [1, -2], [-2, 1], [1, 1]]) if (hash(x, z, seed) < 0.7) b.put(x, 0, z, K('cab3'));
  return { parts: [{ b }], flex: sway(0, 3, 0.15), h: 3, r: 2 };
}

// ---- small things ----------------------------------------------------------------------------------
const PETALS = { R: 'fR', Y: 'fY', V: 'fV', W: 'fW', P: 'fP', B: 'fB', O: 'fO' };
// A clump of garden flowers: stems of 3 to 5 voxels, each with a head of petals round a golden eye.
export function flowers(seed = 1, c = 'R') {
  const b = box([-3, 0, -3], [3, 6, 3]), P = K(PETALS[c]);
  for (let i = 0; i < 5; i += 1) {
    const x = Math.round((hash(i, seed, 1) - 0.5) * 4), z = Math.round((hash(i, seed, 2) - 0.5) * 4), h = 2 + Math.floor(hash(i, seed, 3) * 3);
    for (let y = 0; y < h; y += 1) b.put(x, y, z, y === 1 && i % 2 ? K('fs2') : K('fs1'));
    if (hash(i, seed, 4) < 0.5) b.put(x + 1, 1, z, K('fs2'));
    b.put(x, h, z, i === 0 ? K('fC') : P);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (hash(i, dx + 3, dz + 5) < 0.8) b.put(x + dx, h, z + dz, P);
  }
  return { parts: [{ b }], flex: sway(0, 6, 0.9), h: 6, r: 3 };
}
// Wildflowers: poppies, cornflowers, daisies and buttercups on slender stems, in a loose drift.
export function wild(seed = 1) {
  const b = box([-4, 0, -4], [4, 4, 4]), heads = [K('fR'), K('fB'), K('fW'), K('fY'), K('fR'), K('fW')];
  for (let i = 0; i < 9; i += 1) {
    const x = Math.round((hash(i, seed, 1) - 0.5) * 7), z = Math.round((hash(i, seed, 2) - 0.5) * 7), h = 1 + Math.floor(hash(i, seed, 3) * 2.4);
    for (let y = 0; y < h; y += 1) b.put(x, y, z, K('fs1'));
    const c = heads[Math.floor(hash(i, seed, 4) * heads.length)];
    b.put(x, h, z, c === K('fW') && hash(i, seed, 5) < 0.5 ? K('fC') : c);
    if (hash(i, seed, 6) < 0.4) b.put(x + 1, h, z, c);
  }
  for (let i = 0; i < 6; i += 1) { const x = Math.round((hash(i, seed, 7) - 0.5) * 8), z = Math.round((hash(i, seed, 8) - 0.5) * 8); b.put(x, 0, z, K('gs2')); if (i % 2) b.put(x, 1, z, K('gs3')); }
  return { parts: [{ b }], flex: sway(0, 4, 0.8), h: 4, r: 4 };
}
// A tuft of grass, or of pale marram on the dunes.
export function tuft(seed = 1, dune = false) {
  const b = box([-2, 0, -2], [2, 6, 2]), T = dune ? [K('mg1'), K('mg2'), K('mg3')] : [K('gs1'), K('gs2'), K('gs3')];
  for (let i = 0; i < 6; i += 1) {
    const x = Math.round((hash(i, seed, 1) - 0.5) * 3), z = Math.round((hash(i, seed, 2) - 0.5) * 3), h = 2 + Math.floor(hash(i, seed, 3) * (dune ? 4 : 3));
    const lean = hash(i, seed, 4) < 0.5 ? 1 : -1;
    for (let y = 0; y < h; y += 1) b.put(x + (y > 2 ? lean : 0), y, z, T[(y + i) % T.length]);
  }
  return { parts: [{ b }], flex: sway(0, 6, 1.1), h: 6, r: 2 };
}
// Reeds and rushes in the shallows: tall stems, some with a brown cattail.
export function reeds(seed = 1) {
  const b = box([-3, 0, -3], [3, 13, 3]);
  for (let i = 0; i < 7; i += 1) {
    const x = Math.round((hash(i, seed, 1) - 0.5) * 5), z = Math.round((hash(i, seed, 2) - 0.5) * 5), h = 6 + Math.floor(hash(i, seed, 3) * 6);
    const cat = hash(i, seed, 4) < 0.4;
    for (let y = 0; y < h; y += 1) b.put(x, y, z, cat && y >= h - 3 && y < h - 1 ? (y === h - 2 ? K('ct2') : K('ct1')) : [K('rd1'), K('rd2'), K('rd3')][Math.floor((y + i * 2) / 3) % 3]);
    if (!cat && hash(i, seed, 5) < 0.5) b.put(x + 1, h - 2, z, K('rd3'));
  }
  return { parts: [{ b }], flex: sway(0, 12, 1.8), h: 12, r: 3 };
}
// A lily pad with its notch, and sometimes a flower on it.
export function lily(seed = 1, bloom = false) {
  const b = box([-3, 0, -3], [2, 2, 2]), r = 2.1 + hash(seed, 1) * 0.6, notch = hash(seed, 2) * TAU;
  for (let z = -3; z <= 2; z += 1) for (let x = -3; x <= 2; x += 1) {
    const d = Math.hypot(x + 0.5, z + 0.5), a = Math.atan2(z + 0.5, x + 0.5);
    if (d > r || (d > 0.6 && Math.abs(Math.atan2(Math.sin(a - notch), Math.cos(a - notch))) < 0.35)) continue;
    b.put(x, 0, z, d < 1 ? K('ll3') : hash(x, z, seed) < 0.3 ? K('ll1') : K('ll2'));
  }
  if (bloom) { for (const [x, z] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) b.put(x, 1, z, K('fC')); for (const [x, z] of [[-2, -1], [1, -1], [-2, 0], [1, 0], [-1, -2], [0, -2], [-1, 1], [0, 1]]) b.put(x, 1, z, hash(x, z, seed) < 0.5 ? K('lf1') : K('lf2')); b.put(-1, 2, -1, K('lf1')); b.put(0, 2, 0, K('lf1')); }
  return { parts: [{ b }], flex: sway(0, 2, 0.15), h: 2, r: 3 };
}
// A fern: fronds arching out from a crown, leaflets along them.
export function fern(seed = 1) {
  const b = box([-7, 0, -7], [6, 6, 6]);
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * TAU + hash(i, seed) * 0.6, L = 4.5 + hash(i, seed, 1) * 2, px = -Math.sin(a), pz = Math.cos(a);
    for (let s = 0; s <= L; s += 1) {
      const x = Math.round(Math.cos(a) * s - 0.5), z = Math.round(Math.sin(a) * s - 0.5), y = Math.max(0, Math.round(1 + s * 0.9 - s * s * 0.1));
      b.put(x, y, z, s > L - 1.5 ? K('fn3') : K('fn2'));
      if (s >= 1 && s < L - 1) { b.put(x + Math.round(px), y, z + Math.round(pz), K('fn1')); b.put(x - Math.round(px), y, z - Math.round(pz), K('fn2')); }
    }
  }
  return { parts: [{ b }], flex: (x, y, z) => 0.6 * clamp01(Math.hypot(x, z) / 5), h: 5, r: 7 };
}
// Mushrooms: a red fly agaric with white spots, a cluster of brown caps, or a ring of caps that glow after dark.
export function mushrooms(seed = 1, kind = 'red') {
  const b = box([-4, 0, -4], [3, 6, 3]);
  if (kind === 'glow') {
    const g = box([-4, 0, -4], [3, 6, 3]), caps = [K('mg'), K('mgB'), K('mgV')], c = caps[seed % 3];
    for (let i = 0; i < 5; i += 1) {
      const x = Math.round((hash(i, seed, 1) - 0.5) * 5), z = Math.round((hash(i, seed, 2) - 0.5) * 5), h = 1 + Math.floor(hash(i, seed, 3) * 3);
      for (let y = 0; y < h; y += 1) b.put(x, y, z, K('mS'));
      g.put(x, h, z, i === 0 ? K('mgS') : c);
      if (h > 1) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.put(x + dx, h, z + dz, c);
    }
    return { parts: [{ b }, { b: g, night: true }], flex: sway(0, 5, 0.2), h: 5, r: 3 };
  }
  const n = kind === 'red' ? 1 : 3;
  for (let i = 0; i < n; i += 1) {
    const x = i ? Math.round((hash(i, seed, 1) - 0.5) * 5) : 0, z = i ? Math.round((hash(i, seed, 2) - 0.5) * 5) : 0, h = kind === 'red' ? 3 : 1 + Math.floor(hash(i, seed, 3) * 2), r = kind === 'red' ? 2.1 : 1.3;
    for (let y = 0; y < h; y += 1) b.put(x, y, z, K('mS'));
    for (let dz = -3; dz <= 2; dz += 1) for (let dx = -3; dx <= 2; dx += 1) {
      const d = Math.hypot(dx + 0.5, dz + 0.5);
      if (d > r) continue;
      const cap = kind === 'red' ? (hash(dx, dz, seed) < 0.18 ? K('mW') : K('mR')) : d < 0.8 ? K('mB2') : K('mB');
      b.put(x + dx, h, z + dz, cap); if (d < r * 0.55) b.put(x + dx, h + 1, z + dz, cap === K('mW') ? K('mR') : cap);
    }
  }
  return { parts: [{ b }], flex: sway(0, 5, 0.1), h: 5, r: 3 };
}
// A fallen log: bark, moss along its top, the end grain in rings, bracket fungi down one side.
export function log(seed = 1) {
  const L = 16 + Math.floor(hash(seed, 1) * 5), r = 2.4 + hash(seed, 2) * 0.5;
  const b = box([-11, 0, -4], [10, 6, 3]);
  for (let x = -Math.floor(L / 2); x < Math.ceil(L / 2); x += 1) for (let y = 0; y <= 5; y += 1) for (let z = -4; z <= 3; z += 1) {
    const d = Math.hypot(y + 0.5 - r, z + 0.5);
    if (d > r) continue;
    const end = x === -Math.floor(L / 2) || x === Math.ceil(L / 2) - 1;
    b.put(x, y, z, end ? (Math.floor(d * 1.6) % 2 ? K('lgR') : K('lgE')) : y >= r * 1.5 && noise(x, z, 3, seed) > 0.45 ? K('moss1') : tone([K('lg1'), K('lg2'), K('lg1'), K('lg3')], Math.floor(x / 3), y, z, seed));
  }
  for (const x of [-3, -2, 2]) { b.put(x, 2, Math.ceil(r), K('mB2')); b.put(x + 1, 2, Math.ceil(r), K('mB')); }
  return { parts: [{ b }], flex: () => 0, h: 5, r: 10 };
}
// A boulder with a cap of moss and a tuft of fern.
export function rock(seed = 1) {
  const b = box([-5, 0, -4], [4, 5, 3]);
  const rx = 3.5 + hash(seed, 1) * 1.2, ry = 2.2 + hash(seed, 2) * 1.4;
  b.egg(0, ry * 0.6, 0, rx, ry, rx * 0.8, (x, y, z) => (y >= ry * 0.9 && noise(x, z, 2.5, seed) > 0.4 ? (hash(x, y, z) < 0.5 ? K('moss1') : K('moss2')) : tone([K('rk1'), K('rk2'), K('rk3'), K('rk1'), K('rk4')], Math.floor(x / 2), y, Math.floor(z / 2), seed)));
  b.put(1, Math.ceil(ry * 1.6), 0, K('fn2')); b.put(2, Math.ceil(ry * 1.6), 0, K('fn3'));
  return { parts: [{ b }], flex: (x, y) => (y > ry * 1.5 ? 0.3 : 0), h: 5, r: 5 };
}
// Ivy (or a climbing rose) as a sheet one voxel thick (x -8..7, z 0): stems from the ground, spreading up.
export function ivy(seed = 1, roses = false) {
  const b = box([-9, 0, 0], [8, 26, 0]);
  const tall = 14 + hash(seed, 1) * 10;
  for (let x = -9; x <= 8; x += 1) {
    const h = Math.round(tall * (0.35 + 0.65 * noise(x, seed, 4, seed)) * (1 - Math.abs(x + 0.5) / 12));
    for (let y = 0; y <= h; y += 1) {
      const n = noise(x, y, 2.4, seed + 3);
      if (y > 2 && n < 0.3) continue;
      let id = y < 3 && hash(x, seed) < 0.5 ? K('ivS') : pick([K('iv1'), K('iv2'), K('iv3')], n * 1.1 - 0.1 + y / 60);
      if (roses && y > 3 && hash(x, y, seed) < 0.12) id = pick([K('ro1'), K('ro2'), K('ro1'), K('ro3')], hash(x, y, seed + 1));
      b.put(x, y, 0, id);
    }
  }
  return { parts: [{ b }], flex: (x, y) => 0.15 * clamp01(y / 20), h: 26, r: 9 };
}
// A bed of crystal flowers in a kerb of dressed stone: glowing stems of cyan, violet, pink and white crystal.
export function crystals(seed = 1) {
  const b = box([-8, 0, -6], [7, 8, 5]);
  for (let z = -6; z <= 5; z += 1) for (let x = -8; x <= 7; x += 1) {
    const kerb = x === -8 || x === 7 || z === -6 || z === 5;
    b.put(x, 0, z, kerb ? tone([K('cs1'), K('cs2'), K('cs3')], x, 0, z, seed) : K('lg3'));
    if (kerb) b.put(x, 1, z, (x + z) % 3 === 0 ? K('cs3') : K('cs1'));
  }
  const cs = [K('cf1'), K('cf2'), K('cf3'), K('cf4')];
  for (let i = 0; i < 16; i += 1) {
    const x = -6 + Math.floor(hash(i, seed, 1) * 13), z = -4 + Math.floor(hash(i, seed, 2) * 9), h = 2 + Math.floor(hash(i, seed, 3) * 4), c = cs[i % 3];
    for (let y = 1; y <= h; y += 1) b.put(x, y, z, y === h ? K('cf4') : c);
    if (h > 3) { b.put(x + 1, h - 1, z, c); b.put(x - 1, h - 1, z, c); b.put(x, h - 1, z + 1, c); }
  }
  return { parts: [{ b }], flex: sway(1, 7, 0.4), h: 7, r: 8 };
}

// ---- the old tree on the terrace (a rig) ---------------------------------------------------------------
// A great oak older than the walls: a trunk you could live in (someone does: a round door in its hollow
// with a lit window, and a rubber duck keeping watch on the lowest bough), buttress roots over the terrace,
// veins of old magic glowing up its bark in four bands, lanterns and a rope swing on its limbs, a crown of
// deep greens with spirit-lights twinkling in it, and a blossom that stays folded away until it is woken.
// Parts: trunk, veins0..3 (glowing bands, bottom to top), crown, sparks (the spirit-lights), bloom, swing.
export const GREAT = { h: 62, r: 30, swing: [11, 25, 8], door: [0, 0, 6] };
export function greatTree() {
  const seed = 7;
  const trunkB = box([-18, 0, -18], [17, 36, 17]), crownB = box([-30, 24, -30], [29, 64, 29]);
  const veins = [0, 1, 2, 3].map((i) => box([-18, 0, -18], [17, 36, 17]));
  const bark = [K('gt1'), K('gt2'), K('gt1'), K('gt3'), K('gt4')];
  const H = 24;
  for (let y = 0; y <= H + 4; y += 1) {
    const t = y / (H + 4), r = 5.2 - 1.8 * t + (y < 6 ? (6 - y) ** 1.6 * 0.35 : 0), cx = Math.sin(t * 2.2) * 1.2, cz = -Math.sin(t * 1.4) * 0.8;
    for (let z = -12; z <= 11; z += 1) for (let x = -12; x <= 11; x += 1) {
      const a = Math.atan2(z + 0.5 - cz, x + 0.5 - cx), rr = r * (1 + 0.12 * Math.sin(a * 5 + y * 0.15)); // fluted
      const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
      if (d > rr) continue;
      if (d < rr - 2.2 && y > 0) continue; // hollow inside (only the skin is drawn)
      const hollow = z > 1 && Math.abs(x + 0.5 - cx) < 2.6 && y < 9 - Math.abs(x + 0.5 - cx) * 0.7; // the hollow at its foot
      if (hollow && y > 0) continue;
      trunkB.put(x, y, z, y < 7 && z < 0 && noise(x, y, 3, seed) > 0.5 ? K('moss1') : bark[Math.floor((a / TAU + 0.5) * 11 + Math.floor(y / 5) * 0.37) % bark.length]);
    }
  }
  // buttress roots: long, snaking over the ground
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * TAU + 0.3, L = 10 + hash(i, seed) * 5;
    trunkB.rope([[Math.cos(a) * 3.5, 4, Math.sin(a) * 3.5], [Math.cos(a) * 7, 1.5, Math.sin(a) * 7], [Math.cos(a + 0.2) * L, 0.3, Math.sin(a + 0.2) * L]], 2.2, 0.7, bark[i % 4]);
  }
  // the door in the hollow: round-topped planks, a brass knob, a lit window above; a step of moss
  for (let y = 0; y <= 6; y += 1) for (let x = -2; x <= 1; x += 1) if (y < 5 || Math.abs(x + 0.5) < 1.2) trunkB.put(x, y, 3, y === 3 && x === 1 ? K('knob') : x % 2 ? K('door1') : K('door2'));
  trunkB.put(-1, 5, 3, K('win')); trunkB.put(0, 5, 3, K('win'));
  trunkB.fill(-2, 0, 4, 1, 0, 5, K('moss2'));
  // four great limbs, and the branches off them up into the crown
  const limbs = [[1, 0.6], [2.4, 0.5], [3.9, 0.7], [5.3, 0.55]];
  for (const [a, rise] of limbs) {
    const end = [Math.cos(a) * 17, H + 12 + rise * 6, Math.sin(a) * 17];
    trunkB.rope([[Math.cos(a) * 2, H - 2, Math.sin(a) * 2], [Math.cos(a) * 8, H + 4, Math.sin(a) * 8], [Math.cos(a) * 12, H + 8, Math.sin(a) * 12]], 2.6, 1.6, bark[1]);
    crownB.rope([[Math.cos(a) * 12, H + 8, Math.sin(a) * 12], end], 1.6, 0.8, bark[0]);
  }
  // veins of old magic: five lines spiralling up the bark, in four bands that can light in turn
  for (let v = 0; v < 5; v += 1) for (let y = 0.5; y < H + 3; y += 0.2) {
    const t = y / (H + 4), r = 5.2 - 1.8 * t + (y < 6 ? (6 - y) ** 1.6 * 0.35 : 0), cx = Math.sin(t * 2.2) * 1.2, cz = -Math.sin(t * 1.4) * 0.8;
    const a = (v / 5) * TAU + y * 0.09 + Math.sin(y * 0.4 + v) * 0.25, rr = r * (1 + 0.12 * Math.sin(a * 5 + y * 0.15)) + 0.2;
    const x = Math.floor(cx + Math.cos(a) * rr), z = Math.floor(cz + Math.sin(a) * rr), yy = Math.floor(y);
    if (z > 1 && Math.abs(x + 0.5 - cx) < 2.6 && yy < 9) continue; // not across the hollow
    veins[Math.min(3, Math.floor(yy / 7))].put(x, yy, z, (yy + v) % 9 === 0 ? K('gv3') : v % 2 ? K('gv1') : K('gv2'));
    trunkB.cut(x, yy, z); // (never two meshes in one voxel)
  }
  // the crown: great clusters, deep underneath and bright on top
  const G = [K('gc1'), K('gc2'), K('gc3'), K('gc4'), K('gc5')];
  const blobs = [[0, H + 27, 0, 14, 9]];
  for (let i = 0; i < 7; i += 1) { const a = (i / 7) * TAU + 0.4, d = 14 + hash(i, seed, 2) * 4; blobs.push([Math.cos(a) * d, H + 17 + hash(i, seed, 3) * 7, Math.sin(a) * d, 9 + hash(i, seed, 4) * 3, 6.5]); }
  crown(crownB, blobs, G, seed, H + 10, H + 36, 0.05);
  // spirit-lights and blossom: shells just proud of the crown's skin
  const sparks = box([-30, 24, -30], [29, 64, 29]), bloom = box([-30, 24, -30], [29, 64, 29]);
  for (let i = 0; i < 1400; i += 1) {
    const [bx, by, bz, br, bry] = blobs[i % blobs.length], a = hash(i, 5, 1) * TAU, u = hash(i, 5, 2) * 1.6 - 0.6, s = Math.sqrt(Math.max(0, 1 - u * u));
    const x = Math.floor(bx + Math.cos(a) * br * s * 1.04), y = Math.floor(by + u * bry * 1.04), z = Math.floor(bz + Math.sin(a) * br * s * 1.04);
    if (crownB.at(x, y, z)) continue;
    if (i % 9 === 0) sparks.put(x, y, z, i % 2 ? K('gl1') : K('gl2'));
    else if (hash(i, 5, 3) < 0.55) bloom.put(x, y, z, pick([K('gb1'), K('gb2'), K('gb3')], hash(i, 5, 4)));
  }
  // the rubber duck on the lowest bough
  const [dx, dy, dz] = [Math.cos(1) * 9, H + 5, Math.sin(1) * 9].map(Math.round);
  const duck = (x, y, z, id) => trunkB.put(dx + x, dy + y, dz + z, id);
  for (const [x, y, z] of [[0, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 1], [0, 1, 0], [1, 1, 0], [0, 1, 1], [1, 1, 1], [0, 0, -1], [1, 0, -1]]) duck(x, y, z, K('duck1'));
  duck(0, 2, 1, K('duck1')); duck(1, 2, 1, K('duck1')); duck(0, 3, 1, K('duck2')); duck(1, 3, 1, K('duck1')); duck(0, 2, 2, K('beak')); duck(1, 2, 2, K('beak'));
  duck(0, 3, 2, K('eye')); duck(1, 3, 2, K('eye')); duck(0, 1, -1, K('duck2'));
  // lanterns on short chains under the limbs (part of the trunk; they glow)
  for (const [a, d] of [[2.4, 10], [3.9, 9], [5.3, 11]]) {
    const x = Math.round(Math.cos(a) * d), z = Math.round(Math.sin(a) * d), y = H + 3;
    trunkB.put(x, y + 2, z, C.iron2); trunkB.put(x, y + 1, z, C.iron2);
    trunkB.fill(x - 1, y - 3, z - 1, x, y, z, (xx, yy) => (yy === y ? C.iron1 : yy === y - 3 ? C.iron2 : K('win')));
  }
  // the swing: two ropes from the first limb, a plank seat (its own part, so it can swing)
  const [sx, sy, sz] = GREAT.swing, swing = box([sx - 3, 4, sz - 1], [sx + 2, sy, sz]);
  for (let y = 5; y < sy; y += 1) { swing.put(sx - 2, y, sz, K('rope')); swing.put(sx + 1, y, sz, K('rope')); }
  swing.fill(sx - 3, 4, sz - 1, sx + 2, 4, sz, (x) => (x % 2 ? K('seat') : K('wd1')));
  return {
    gait: 'still',
    build() {
      const parts = { trunk: trunkB.part('trunk', [0, 0, 0]), crown: crownB.part('crown', [0, H + 4, 0]) };
      veins.forEach((v, i) => { parts[`veins${i}`] = v.part(`veins${i}`, [0, 0, 0]); });
      parts.sparks = sparks.part('sparks', [0, H + 4, 0], crownB);
      parts.bloom = bloom.part('bloom', [0, H + 4, 0], crownB);
      parts.swing = swing.part('swing', [sx, sy, sz]);
      return { parts };
    },
    setup(ctx) { ctx.mem.woke = -100; },
    idle(ctx) {
      const { parts: P, state: { t }, mem } = ctx, w = t - mem.woke;
      P.crown.rotation.z += 0.012 * Math.sin(t * 0.7) + 0.02 * Math.exp(-((w - 2.2) ** 2) * 2);
      P.crown.rotation.x += 0.01 * Math.sin(t * 0.53 + 1);
      P.swing.rotation.x += 0.12 * Math.sin(t * 1.3) + 0.35 * Math.sin(w * 2.6) * Math.exp(-Math.max(0, w) * 0.25) * (w > 0 ? 1 : 0);
      // woken: the blossom opens over the crown for a few seconds, then folds away
      const open = w > 1.4 ? smooth((w - 1.4) / 1.2) * (1 - smooth((w - 8) / 2)) : 0;
      P.bloom.scale.setScalar(open > 0.01 ? 0.9 + 0.1 * open : 0);
      P.sparks.scale.setScalar(1 + 0.02 * Math.sin(t * 2.1));
      mem.open = open;
    },
  };
}

// ---- the lantern tree (a rig) ---------------------------------------------------------------------------
// A small twisted tree whose fruit are paper lanterns, warm amber, each on its own cord. Parts: tree, lanterns
// (they swing together), sky (one lantern that can rise off into the night).
export function lanternTree() {
  const seed = 11, H = 8;
  const tree = box([-11, 0, -11], [10, H + 12, 10]), lan = box([-11, H - 2, -11], [10, H + 10, 10]);
  trunk(tree, H + 1, 1.4, 0.9, [K('cb1'), K('cb2'), K('bk3')], seed, (t) => [Math.sin(t * 3) * 1.2, Math.cos(t * 2) * 0.6]);
  roots(tree, seed, 4, 4, K('cb1'));
  const blobs = [[0, H + 7, 0, 5, 3]];
  for (let i = 0; i < 5; i += 1) { const [x, z] = around(seed, 5, i, 4.5, 6); const y = H + 4 + hash(seed, i, 3) * 2; tree.rope([[0, H, 0], [x * 0.8, y - 1, z * 0.8]], 0.8, 0.5, K('cb2')); blobs.push([x, y, z, 3.4, 2.4]); }
  crown(tree, blobs, [K('lt1'), K('lt2'), K('lt3')], seed, H + 2, H + 10, 0.1);
  const L = [];
  for (let i = 0; i < 12; i += 1) {
    const [bx, by, bz] = blobs[1 + (i % 5)], a = hash(i, seed, 8) * TAU, x = Math.round(bx + Math.cos(a) * 2.2), z = Math.round(bz + Math.sin(a) * 2.2), y = Math.round(by - 3 - hash(i, seed, 9) * 2);
    L.push([x, y, z]);
    if (i === 4) continue; // the one that flies (its own part)
    lan.put(x, y + 3, z, K('lcap')); lan.put(x, y + 4, z, C.iron2);
    lan.fill(x - 1, y, z - 1, x, y + 2, z, (xx, yy) => (yy === y + 1 ? K('ln2') : (xx + yy) % 2 ? K('ln1') : K('ln3')));
  }
  const [fx, fy, fz] = L[4], sky = box([fx - 1, fy, fz - 1], [fx, fy + 3, fz]);
  sky.fill(fx - 1, fy, fz - 1, fx, fy + 2, fz, (xx, yy) => (yy === fy + 1 ? K('ln2') : K('ln1'))); sky.put(fx, fy + 3, fz, K('lcap'));
  return {
    gait: 'still',
    lanterns: L,
    build: () => ({ parts: { tree: tree.part('tree', [0, 0, 0]), lanterns: lan.part('lanterns', [0, H + 8, 0]), sky: sky.part('sky', [fx, fy, fz]) } }),
    setup(ctx) { ctx.mem.lit = -100; },
    idle(ctx) {
      const { parts: P, state: { t }, mem } = ctx, u = t - mem.lit;
      P.lanterns.rotation.z += 0.04 * Math.sin(t * 1.1); P.lanterns.rotation.x += 0.03 * Math.sin(t * 0.8 + 1);
      P.tree.rotation.z += 0.008 * Math.sin(t * 0.9);
      // lit: the lanterns flare, and one lantern slips its cord and rises into the sky; a new one grows back
      if (u > 0.8 && u < 14) { const k = u - 0.8; P.sky.position.y += k * k * 1.4 + k * 6; P.sky.position.x += Math.sin(k * 1.3) * 3 * k; P.sky.rotation.y = k; P.sky.scale.setScalar(Math.max(0.001, 1 - smooth((k - 9) / 4))); }
      else if (u >= 14 && u < 16) P.sky.scale.setScalar(Math.max(0.001, smooth((u - 14) / 2)));
      mem.flare = u > 0 && u < 3 ? Math.sin(Math.PI * clamp01(u / 3)) : 0;
    },
  };
}
