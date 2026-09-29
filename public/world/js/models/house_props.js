// Street props and moving parts for the town's houses (colours house_, shared with house_build.js). Each returns
// a grid (a `box` in model voxels, origin at its base middle, front +z) for the house layer to stamp many times:
//   barrel, crate, bench, well (+ bucket), handcart, planter, notice board, bollard, rope coil, crane (+ hook),
//   rowing boat, fishing boat, a smoke puff, door leaves, hanging signs (one per trade), windmill sails, water wheel,
//   a hoisted crate (+ its rope), a brass dish, washing to hang on a line, a tavern table.
import { C, hash } from '../kit/voxel-kit.js';
import { box } from './space.js';
import { HP as P, GLYPHS } from './house_build.js';

const T = (x, y, z, k = 0) => hash(x + k * 13, y + k * 7, z);
const woodT = (x, y, z, k) => [P.t2, P.t3, P.t3, P.tlight][Math.floor(T(x, y, z, k) * 4)];

export function barrel() {
  const b = box([-3, 0, -3], [2, 6, 2]);
  for (let y = 0; y <= 6; y += 1) {
    const r = 2.3 + 0.35 * Math.sin((y / 6) * Math.PI);
    for (let z = -3; z <= 2; z += 1) for (let x = -3; x <= 2; x += 1) {
      const d = Math.hypot(x + 0.5, z + 0.5);
      if (d > r) continue;
      if (y === 6) { b.put(x, y, z, d > r - 1 ? C.iron2 : (x + z) % 2 ? P.t3 : P.t2); continue; }
      b.put(x, y, z, y === 1 || y === 4 ? C.iron2 : (Math.floor(Math.atan2(z + 0.5, x + 0.5) * 2.5) + 9) % 2 ? P.t3 : P.tlight);
    }
  }
  return b;
}
export function crate(k = 0) {
  const b = box([-3, 0, -3], [2, 4, 2]);
  b.fill(-3, 0, -3, 2, 4, 2, (x, y, z) => {
    const edge = (x === -3 || x === 2) + (z === -3 || z === 2) + (y === 0 || y === 4) >= 2;
    return edge ? P.t1 : y === 2 ? P.t2 : woodT(x, y, z, k + 3);
  });
  if (k % 2) { b.put(-1, 5, 0, P.bread); b.put(0, 5, -1, P.crust); b.put(0, 5, 0, P.fy); } // something in it
  return b;
}
export function bench() {
  const b = box([-7, 0, -2], [6, 8, 2]);
  for (const x of [-6, 5]) { b.fill(x, 0, -1, x, 3, 1, C.iron2); b.fill(x, 4, -2, x, 7, -2, C.iron1); }
  b.fill(-7, 4, -1, 6, 4, 2, (x, y, z) => (z === 0 ? P.t2 : woodT(x, y, z, 1)));
  b.fill(-7, 6, -2, 6, 7, -2, (x, y) => (y === 7 ? P.tlight : P.t3));
  return b;
}
// The well: a round stone kerb, glowing water deep in it, a timber frame under a little shingle roof, a winch.
export function well() {
  const b = box([-6, 0, -6], [5, 24, 5]);
  for (let y = 0; y <= 5; y += 1) for (let z = -6; z <= 5; z += 1) for (let x = -6; x <= 5; x += 1) {
    const d = Math.hypot(x + 0.5, z + 0.5);
    if (d > 5.6) continue;
    if (d > 3.8) b.put(x, y, z, y === 5 ? P.q1 : y % 2 ? (hash(x, z, y) < 0.5 ? P.s2 : P.s3) : P.mortar);
    else if (y === 2) b.put(x, y, z, (x + z) % 3 ? P.crys2 : P.rune2);
  }
  for (const x of [-5, 4]) b.fill(x, 6, 0, x, 18, 0, (xx, y) => (y % 5 === 0 ? C.iron2 : P.t1));
  b.fill(-4, 13, 0, 3, 13, 0, (x) => (x % 2 ? P.t2 : P.t3)); // the winch drum
  b.put(4, 13, 1, C.iron2); b.put(4, 12, 2, C.iron2); b.put(4, 11, 2, C.iron1); // its crank
  for (let z = -6; z <= 5; z += 1) for (let x = -7; x <= 6; x += 1) { const y = 22 - Math.floor(Math.abs(z + 0.5) * 0.8); b.put(x, y, z, x === -7 || x === 6 ? P.t1 : (x + y) % 3 ? P.r1 : P.r2); b.put(x, y - 1, z, P.t1); }
  b.fill(-1, 6, 0, -1, 12, 0, P.rope);
  return b;
}
export function bucket() {
  const b = box([-2, 0, -2], [1, 4, 1]);
  for (let y = 0; y <= 3; y += 1) for (let z = -2; z <= 1; z += 1) for (let x = -2; x <= 1; x += 1) if (Math.hypot(x + 0.5, z + 0.5) <= 2.1) b.put(x, y, z, y === 1 || y === 3 ? C.iron2 : P.t3);
  b.put(-1, 4, -1, C.iron1); b.put(0, 4, 0, C.iron1);
  return b;
}
export function handcart() {
  const b = box([-9, 0, -6], [8, 10, 5]);
  b.fill(-6, 4, -4, 5, 4, 3, (x, y, z) => woodT(x, y, z, 5));
  for (const z of [-4, 3]) b.fill(-6, 5, z, 5, 7, z, (x, y) => (y === 7 ? P.t1 : P.t3));
  for (const x of [-6, 5]) b.fill(x, 5, -4, x, 7, 3, (xx, y) => (y === 7 ? P.t1 : P.t3));
  for (const z of [-5, 4]) for (let y = 0; y <= 6; y += 1) for (let x = -3; x <= 2; x += 1) { const d = Math.hypot(x + 0.5, y - 3); if (d <= 3.2 && (d > 2.4 || x === 0 || y === 3)) b.put(x, y, z, d > 2.4 ? C.iron2 : P.t2); }
  for (const z of [-3, 2]) for (let x = 6; x <= 8; x += 1) b.put(x, 4 - (x - 6), z, P.t2);
  b.fill(-4, 5, -2, -1, 8, 1, (x, y, z) => (y === 8 ? P.sack : P.sack2)); b.fill(0, 5, -3, 3, 7, 0, (x, y, z) => ((x + y) % 2 ? P.fr : P.lf2)); // sacks, apples
  return b;
}
export function planter(k = 0) {
  const b = box([-4, 0, -2], [3, 6, 1]);
  b.fill(-4, 0, -2, 3, 2, 1, (x, y, z) => (y === 2 ? P.clay2 : P.clay));
  for (let z = -1; z <= 0; z += 1) for (let x = -3; x <= 2; x += 1) {
    const r = hash(x, z, k);
    b.put(x, 3, z, P.lf2);
    if (r < 0.7) b.put(x, 4, z, [P.fr, P.fy, P.fp, P.fw, P.fv][Math.floor(r * 7) % 5]);
    if (r < 0.25) b.put(x, 5, z, P.lf1);
  }
  return b;
}
// A notice board: two posts, planks under a shingle roof, papers pinned up, one glowing note.
export function noticeBoard() {
  const b = box([-7, 0, -2], [6, 22, 2]);
  for (const x of [-6, 5]) b.fill(x, 0, 0, x, 18, 0, (xx, y) => (y % 6 === 0 ? C.iron2 : P.t1));
  b.fill(-5, 6, 0, 4, 15, 0, (x, y) => ((x + 9) % 3 === 0 ? P.t2 : P.t3));
  for (let x = -7; x <= 6; x += 1) for (let z = -2; z <= 2; z += 1) { const y = 20 - Math.abs(z); b.put(x, y, z, (x + y) % 3 ? P.r1 : P.r2); b.put(x, y - 1, z, P.t1); }
  const paper = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) b.put(x, y, 1, (y - y0) % 2 && x > x0 && x < x0 + w - 1 ? P.lead : P.page); b.put(x0 + (w >> 1), y0 + h - 1, 2, P.ringR); };
  paper(-4, 9, 4, 5); paper(1, 10, 3, 4);
  b.fill(0, 7, 1, 3, 8, 1, (x, y) => (x === 0 || x === 3 ? P.holo2 : P.holo1));
  return b;
}
export function bollard() {
  const b = box([-1, 0, -1], [1, 4, 1]);
  for (let y = 0; y <= 4; y += 1) for (let z = -1; z <= 1; z += 1) for (let x = -1; x <= 1; x += 1) if (y >= 3 || Math.abs(x) + Math.abs(z) < 2) b.put(x, y, z, y === 4 ? C.brass2 : y === 3 ? C.iron1 : C.iron2);
  return b;
}
export function ropeCoil() {
  const b = box([-3, 0, -3], [2, 2, 2]);
  for (let y = 0; y <= 1; y += 1) for (let z = -3; z <= 2; z += 1) for (let x = -3; x <= 2; x += 1) { const d = Math.hypot(x + 0.5, z + 0.5); if (d <= 2.9 - y * 0.6 && d > 0.8) b.put(x, y, z, Math.floor(d * 2) % 2 ? P.rope : P.sack2); }
  return b;
}
// The harbour crane: a post on a stone foot, a raked jib with braces, a treadwheel-less winch; the hook is its own part.
export function crane() {
  const b = box([-4, 0, -4], [3, 36, 26]);
  b.fill(-4, 0, -4, 3, 2, 3, (x, y, z) => (y === 2 ? P.q1 : hash(x, y, z) < 0.5 ? P.s2 : P.s3));
  b.fill(-1, 3, -1, 0, 34, 0, (x, y) => (y % 8 === 0 ? C.iron2 : P.t1));
  for (let k = 0; k <= 24; k += 1) { const y = 32 + Math.floor(k * 0.12); b.put(-1, y, k, P.t1); b.put(0, y, k, P.t2); b.put(-1, y + 1, k, k % 6 === 0 ? C.iron2 : P.t2); }
  for (let k = 0; k <= 12; k += 1) b.put(-1, 20 + k, Math.floor(k * 0.9) + 1, P.t2); // a brace
  b.fill(-3, 8, -1, 2, 10, 0, (x, y) => (y === 9 ? P.rope : C.iron2)); // the winch
  for (let y = 10; y <= 33; y += 1) b.put(1, y, 0, P.rope);
  return b;
}
export function hook() { // hangs from the jib's end: rope, an iron hook and a net of crates
  const b = box([-3, -16, -3], [2, 0, 2]);
  for (let y = -8; y <= 0; y += 1) b.put(0, y, 0, P.rope);
  b.put(0, -9, 0, C.iron2); b.put(1, -10, 0, C.iron2); b.put(1, -11, 0, C.iron1);
  b.fill(-3, -16, -3, 2, -12, 2, (x, y, z) => ((x + y + z) % 3 === 0 ? P.net : (x === -3 || x === 2) && (z === -3 || z === 2) ? P.t1 : woodT(x, y, z, 9)));
  return b;
}
// Boats float with y 0 on the waterline: a clinker hull in planks, thwarts, oars shipped along the sides.
export function rowingBoat(k = 0) {
  const b = box([-5, -3, -12], [4, 4, 11]);
  const paint = [P.cl2, P.aw2, P.aw4, P.ringW][k % 4];
  for (let z = -12; z <= 11; z += 1) {
    const t = (z + 0.5) / 12, half = 4.3 * Math.sqrt(Math.max(0, 1 - t ** 4)) * (t > 0 ? 1 - 0.35 * t * t : 1);
    for (let y = -3; y <= 2; y += 1) {
      const w = half * (0.55 + 0.45 * ((y + 3) / 5));
      for (let x = -5; x <= 4; x += 1) {
        const d = Math.abs(x + 0.5);
        if (d > w) continue;
        const skin = d > w - 1.1 || y === -3;
        if (!skin) { if (y === -2) b.put(x, y, z, P.t3); continue; }
        b.put(x, y, z, y === 2 ? P.t1 : y === 1 ? paint : y <= -1 ? P.tar2 : (y + 9) % 2 ? P.t3 : P.tlight);
      }
    }
  }
  for (const z of [-5, 1, 6]) b.fill(-3, 0, z, 2, 0, z, P.t2);
  for (const x of [-4, 3]) for (let z = -8; z <= 6; z += 1) b.put(x, 3, z, z > 4 ? P.t2 : P.tlight);
  return b;
}
export function fishingBoat() {
  const b = box([-8, -4, -24], [7, 44, 23]);
  for (let z = -24; z <= 23; z += 1) {
    const t = (z + 0.5) / 24, half = 7.4 * Math.sqrt(Math.max(0, 1 - Math.abs(t) ** 3.2)) * (t > 0 ? 1 - 0.3 * t * t : 1);
    for (let y = -4; y <= 4; y += 1) {
      const w = half * (0.5 + 0.5 * ((y + 4) / 8));
      for (let x = -8; x <= 7; x += 1) {
        const d = Math.abs(x + 0.5);
        if (d > w) continue;
        const skin = d > w - 1.1 || y === -4;
        if (!skin) { if (y === 2) b.put(x, y, z, (z + 40) % 3 ? P.tlight : P.t3); continue; }
        b.put(x, y, z, y >= 3 ? (y === 4 ? P.t1 : P.aw3) : y <= 0 ? (y < -2 ? P.aw2 : P.tar2) : P.ringW);
      }
    }
  }
  // the wheelhouse, a lamp on it; a mast with a furled sail and a lamp at its head; nets and fish boxes aft
  b.fill(-4, 3, -14, 3, 12, -6, (x, y, z) => (y === 12 ? P.r2 : (y >= 7 && y <= 9 && (x === -4 || x === 3 || z === -6)) ? P.glass : (x + y) % 5 === 0 ? P.t1 : P.aw1));
  b.put(0, 13, -10, P.lamp); b.put(0, 14, -10, P.lamp2);
  b.fill(0, 3, 4, 0, 42, 4, (x, y) => (y % 9 === 0 ? C.iron2 : P.t1));
  for (let y = 16; y <= 36; y += 1) b.fill(-1, y, 5, 0, y, 5, (y + 1) % 4 ? P.aw1 : P.rope);
  b.put(0, 43, 4, P.lamp); b.put(0, 44, 4, P.lamp2);
  for (let k = 0; k < 20; k += 1) b.put(0, 42 - k * 2, 5 + k, P.rope);
  b.fill(-5, 3, 12, -1, 5, 17, (x, y, z) => ((x + z) % 2 ? P.net : P.rope));
  b.fill(1, 3, 13, 5, 5, 16, (x, y, z) => (y === 5 ? ((x + z) % 2 ? P.lead : P.glass) : P.t3));
  return b;
}
export function puff() { const b = box([-3, 0, -3], [2, 5, 2]); b.egg(0, 3, 0, 2.9, 2.9, 2.9, P.barn); return b; } // a round puff of voxels
// Door leaves, hinged at x 0 and swinging on their own: planks with strap hinges and a ring; panels and a knocker; boards.
export function doorLeaf(style = 'lower') {
  const h = style === 'upper' ? 19 : 18, b = box([0, 0, -1], [7, h - 1, 0]);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < 8; x += 1) {
    if (style === 'upper' && y >= h - 4 && Math.hypot(x + 0.5 - 4, y + 0.5 - (h - 4)) > 4) continue;
    const id = style === 'upper' ? (x === 0 || x === 7 || y === 0 || y === 8 || (y > 8 && x === 3) ? P.k3 : (x === 1 || x === 6 || y === 1 || y === 7) && y < 9 ? P.k2 : P.k1) : style === 'pier' ? ((x + y) % 6 === 0 ? P.t1 : x % 2 ? P.tar3 : P.tar2) : x % 2 ? P.k1 : P.k2;
    b.put(x, y, 0, id);
    b.put(x, y, -1, P.t2);
  }
  if (style !== 'upper') for (const y of [3, 13]) for (let x = 0; x < 6; x += 1) b.put(x, y, 0, x % 2 ? C.iron3 : C.iron2);
  b.put(6, 9, 0, style === 'upper' ? C.brass2 : C.iron3); b.put(6, 8, 0, C.iron2);
  return b;
}
// A hanging sign: a board on two rings (the bracket is the house's) with the trade's glyph as a hologram over it.
export function sign(trade) {
  const G = GLYPHS[trade], b = box([-5, -12, -1], [4, 0, 1]);
  b.put(-3, 0, 0, C.iron2); b.put(2, 0, 0, C.iron2); b.put(-3, -1, 0, C.iron1); b.put(2, -1, 0, C.iron1);
  b.fill(-5, -9, 0, 4, -2, 0, (x, y) => (x === -5 || x === 4 || y === -2 || y === -9 ? P.t1 : (x + y) % 5 === 0 ? P.t2 : P.t3));
  for (const z of [-1, 1]) G.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') b.put(i - 3, -3 - j, z, (i + j) % 3 ? P.holo1 : P.holo2); else if ((i + j) % 2 === 0) b.put(i - 3, -3 - j, z, P.holo3); }));
  for (const x of [-4, 3]) b.put(x, -10, 0, P.holo2);
  b.put(-1, -11, 0, P.holo2); b.put(0, -11, 0, P.holo2);
  return b;
}
// The windmill's sails: four lattice sails with their cloth, round a hub (the axle along z).
export function sails() {
  const b = box([-34, -34, -2], [33, 33, 2]);
  b.fill(-2, -2, -2, 1, 1, 2, (x, y, z) => (z === 2 ? C.brass2 : C.iron2));
  for (let a = 0; a < 4; a += 1) {
    const c = Math.cos((a * Math.PI) / 2 + 0.3), s = Math.sin((a * Math.PI) / 2 + 0.3);
    for (let r = 2; r <= 33; r += 0.5) { b.put(Math.round(c * r - 0.5), Math.round(s * r - 0.5), 0, P.t1); }
    for (let r = 7; r <= 32; r += 1) for (let w = 1; w <= 6; w += 1) {
      const x = Math.round(c * r - s * w - 0.5), y = Math.round(s * r + c * w - 0.5);
      b.put(x, y, 0, r % 5 === 0 || w === 6 ? P.t2 : (w + r) % 2 ? P.aw1 : P.cl6);
    }
  }
  return b;
}
export function waterWheel() {
  const b = box([-11, -11, -3], [10, 10, 2]);
  for (let y = -11; y <= 10; y += 1) for (let x = -11; x <= 10; x += 1) {
    const d = Math.hypot(x + 0.5, y + 0.5), a = Math.atan2(y + 0.5, x + 0.5);
    for (const z of [-3, 2]) if ((d <= 10.5 && d > 9.2) || (d <= 9.2 && Math.abs(Math.sin(a * 4)) < 0.12 && d > 1.5)) b.put(x, y, z, d > 9.2 ? P.t1 : P.t2);
    if (d <= 10.8 && d > 8.2 && Math.abs(Math.sin(a * 8)) < 0.2) for (let z = -2; z <= 1; z += 1) b.put(x, y, z, P.t3);
  }
  b.fill(-1, -1, -3, 0, 0, 2, C.iron2);
  return b;
}
export function hoistCrate() { // a crate in a rope sling (the rope up to the pulley is its own part)
  const b = box([-3, -6, -3], [2, 0, 2]);
  b.fill(-3, -6, -3, 2, -1, 2, (x, y, z) => ((x === -3 || x === 2) && (z === -3 || z === 2) ? P.t1 : y === -1 ? P.rope : woodT(x, y, z, 11)));
  b.put(0, 0, 0, P.rope);
  return b;
}
export function ropeBit() { const b = box([0, 0, 0], [0, 0, 0]); b.put(0, 0, 0, P.rope); return b; }
// The brass dish on one roof: a paraboloid on a turning mount, a crystal at its focus.
export function dish() {
  const b = box([-7, 0, -7], [6, 14, 6]);
  b.fill(-1, 0, -1, 0, 5, 0, (x, y) => (y % 2 ? C.iron2 : C.brass1));
  for (let y = 5; y <= 13; y += 1) for (let z = -7; z <= 6; z += 1) for (let x = -7; x <= 6; x += 1) {
    const rr = Math.hypot(x + 0.5, y - 9.5), dz = (rr * rr) / 14;
    if (rr <= 5.6 && Math.abs(z + 0.5 + 2 - dz) < 0.7) b.put(x, y, z, rr > 4.8 ? C.brass2 : Math.abs(rr - 2.8) < 0.5 ? P.rune : C.brass1);
  }
  b.fill(-1, 9, 1, 0, 10, 2, P.crys2); b.put(0, 10, 3, P.crys1);
  return b;
}
// A box to draw into by hand (the house layer's cables and washing lines).
export const boxOf = (a, b) => box(a, b);
// One thing pegged on a washing line at x, y, z (the line running along dx, dz): a sheet, a shirt, trousers, socks.
export function hang(b, x, y, z, k, dx, dz) {
  const c = [P.cl1, P.cl2, P.cl6, P.cl3, P.cl4, P.aw1][k % 6], along = Math.abs(dx) > Math.abs(dz), L = Math.hypot(dx, dz) || 1;
  const w = k % 3 === 0 ? 5 : 3, h = k % 3 === 0 ? 7 : k % 3 === 1 ? 5 : 6;
  for (let i = 0; i < w; i += 1) for (let j = 0; j < h; j += 1) {
    if (k % 3 === 2 && i === 1 && j > 1) continue; // trouser legs
    if (k % 3 === 1 && j > 2 && (i === 0 || i === w - 1)) continue; // a shirt's body under its sleeves
    const u = i - (w >> 1), px = along ? x + Math.round((u * dx) / L) : x + Math.round((u * dx) / L), pz = along ? z + Math.round((u * dz) / L) : z + Math.round((u * dz) / L);
    b.put(px, y - j, pz, j === 0 ? C.iron3 : (i + j) % 5 === 0 && k % 3 === 0 ? P.fw : c);
  }
}
// The tavern's trestle table along its front, a bench behind it (the drinkers face the street), mugs and a loaf.
export function tavernTable() {
  const b = box([-9, 0, -5], [8, 7, 2]);
  b.fill(-8, 6, -1, 7, 6, 1, (x, y, z) => woodT(x, y, z, 21));
  for (const x of [-7, 6]) b.fill(x, 0, 0, x, 5, 0, P.t1);
  b.fill(-8, 3, -4, 7, 3, -3, (x, y, z) => woodT(x, y, z, 22));
  for (const x of [-7, 6]) b.fill(x, 0, -4, x, 2, -4, P.t1);
  b.put(-1, 7, 0, P.bread); b.put(0, 7, 0, P.crust); b.fill(4, 7, 0, 4, 8, 0, P.t3); b.put(4, 9, 0, P.flour);
  return b;
}
