// A workshop for a thing Yuuv shipped: coursed stone below with circuit light
// in the mortar, a jettied timber storey, a tiled roof with a chimney that
// vents neon smoke and a rune-dish, a hologram banner with the product's glyph,
// a crystal lantern by the door and, set in a carved stone frame, a SCREEN that
// plays the product's real clip (a THREE.VideoTexture, drawn unlit).
// It arrives flat-packed in a low crate (a third of its height, the product's
// glyph on the lid). `act()` (or ctx.reveal()) lets the sides fall open and the
// lid fly off, then the shop springs up out of it like a pop-up book: storey,
// storey, roof, each overshooting and settling; then the screen, banner, dish and
// chimney smoke come on. All on the rig's clock; nothing is re-meshed.
// Parts: yard (props, always there), body (ground storey; the screen hangs on it)
// > upper > roof, each springing out of the one below.
//
// workshop(product) -> rig definition. product = { key, video, roof: [lip, 1, 2, 3],
// paint: [dark, light], holo: [core, mid, dim], glyph: [7 strings of 7], props: [...], open }
// Model voxels: x -35..34, z -19..23, front (+z) faces the path; door at x -15.
import { C, colour, hash, noise } from '../kit/voxel-kit.js';
import { box, tone, smooth, clamp01 } from './space.js';

const col = (name, hex, glow = false) => C[name] ?? colour(name, hex, glow);
for (const [n, hex, glow] of [
  ['s1', 0xbdb5a6], ['s2', 0xa59e90], ['s3', 0x8d877b], ['s4', 0x757066], ['mortar', 0x3f3b37], ['q1', 0xd3cbbb], ['q2', 0xc3baa7],
  ['moss1', 0x546e38], ['moss2', 0x6d8c45], ['soot', 0x3a3634],
  ['trace', 0x1fd2ea, true], ['via', 0xb6fbff, true], ['rune', 0x8f7bff, true],
  ['w1', 0x3a2517], ['w2', 0x4f3421], ['w3', 0x6b4a2e], ['w4', 0x86603b],
  ['p1', 0xe7d9bc], ['p2', 0xdccba9], ['p3', 0xcdbb97], ['stain', 0xb7a17c],
  ['lit', 0xffc764, true], ['lit2', 0xffe6a8, true], ['mon', 0x7ff0ff, true], ['void', 0x0f0e13],
  ['cable1', 0x1c1c22], ['cable2', 0x2a2a33], ['pulse', 0xd8fdff, true],
  ['crys1', 0xe6fdff, true], ['crys2', 0x6ff2ff, true], ['crys3', 0xa98bff, true],
  ['smoke1', 0x7d64d8, true], ['smoke2', 0xb58cff, true], ['ember', 0xff4fd8, true],
  ['cw1', 0xb28a57], ['cw2', 0xa07644], ['cw3', 0xc39a63], ['cw4', 0x8a6238], ['batten', 0x6f4c2c], ['stencil', 0x2b221c],
  ['stencilRed', 0x9b2c22], ['strap', 0x4b4b54], ['rivet', 0x9a9aa2], ['label', 0xe9dcbf],
  ['cat1', 0xdc8c3c], ['cat2', 0xc97a30], ['catStripe', 0x93511f], ['catWhite', 0xf3e7d4], ['catNose', 0xe79a9a], ['catEye', 0xb8ff6a, true],
  ['pcb', 0x1f6b3a], ['pcbGlow', 0x6bff9a, true], ['chip', 0x18181c], ['tip', 0xff8a3a, true],
  ['red', 0xc8322c], ['white', 0xf4efe6], ['corn1', 0xfff2c4], ['corn2', 0xf2d488], ['glass', 0xbfe9f2], ['brassD', 0x7a5a1e],
  ['clay', 0x9a5a3c], ['flowerR', 0xd8434a], ['flowerV', 0x9a5bd6], ['flowerY', 0xf2c84a],
  ['rope1', 0xa88f6a], ['rope2', 0x86704f], ['weed', 0x2f4a2c], ['wet', 0x5c5850],
]) col(`shop_${n}`, hex, glow);

const K = (n) => C[`shop_${n}`];
const STONE = [K('s1'), K('s2'), K('s2'), K('s3'), K('s3'), K('s4')];
const WOOD = [K('w1'), K('w2'), K('w2'), K('w3')];
const PLASTER = [K('p1'), K('p1'), K('p2'), K('p3')];
const CRATE = [K('cw1'), K('cw2'), K('cw3'), K('cw4')];

export const PRODUCTS = {
  kinoir: {
    key: 'kinoir', video: '../reel/media/kinoir.mp4',
    roof: [0x2e3746, 0x3e4a5c, 0x4b586c, 0x5a687c], paint: [0x6e1d22, 0x962f33], holo: [0xfff3d0, 0xffb347, 0xd9772a],
    glyph: ['.#####.', '#.#.#.#', '##...##', '#..#..#', '##...##', '#.#.#.#', '.#####.'], // a film reel
    props: ['popcorn'],
  },
  leadfinder: {
    key: 'leadfinder', video: '../reel/media/leadfinder.mp4',
    roof: [0x6e3524, 0x8e4a32, 0xa35a3c, 0xb86a48], paint: [0x24483a, 0x3d7560], holo: [0xe8fff4, 0x5dffb0, 0x2fae7a],
    glyph: ['..###..', '.#.#.#.', '#..#..#', '#######', '#..#..#', '.#.#.#.', '..###..'], // a crosshair
    props: ['magnifier'],
  },
};

// Where things are, in model voxels: the world walks, frames and collides with these.
export const INFO = {
  door: [-15, 21], // stand here to knock (clear of the crate)
  standoff: [-35, 31], // off the crate's corner: no falling side lands here
  focus: [0, 24, 2], // middle of the building (once it has sprung up; the crate is 19 high)
  blocks: [[-27, -17, 26, 16], [27, -13, 35, 9], [27, 15, 35, 24], [-37, 17, -29, 24]], // x0, z0, x1, z1: crate and shop, bench, reel, parts crate
};

const glyphAt = (glyph) => (i, j) => glyph[j]?.[i] === '#';

// A ground-standing roof h: 1:1 pitch from the eaves (z -14 and 13) up to the ridge.
const roofTop = (z) => 37 + Math.min(z + 14, 13 - z);

// ---------------------------------------------------------------------------------------------
function buildShop(p) {
  const k = p.key;
  const R = p.roof.map((hex, i) => col(`shop_${k}_roof${i}`, hex));
  const [paint1, paint2] = p.paint.map((hex, i) => col(`shop_${k}_paint${i}`, hex));
  const [holo1, holo2, holo3] = p.holo.map((hex, i) => col(`shop_${k}_holo${i}`, hex, true));
  const G = glyphAt(p.glyph);
  const b = box([-36, 0, -19], [35, 55, 24]);

  // ---- plinth and step
  b.fill(-23, 0, -12, 22, 0, 11, (x, y, z) => ((x + 60) % 6 === 0 || (z + 60) % 5 === 0 ? K('mortar') : tone([K('s3'), K('s4'), K('s3')], Math.floor(x / 6), 0, Math.floor(z / 5), 3)));
  b.fill(-20, 0, 12, -9, 0, 14, (x, y, z) => (Math.abs(x + 14.5) < 3 && z < 14 ? K('s4') : tone(STONE, x, 0, z, 4)));

  // ---- the stone storey: coursed stone, quoins, and circuit light running in the mortar
  const dens = (c, a, face) => (face === 1 && a > -12 && a < 22 && c < 8 ? 0.45 : 0.16);
  const T = (c, a, face) => c >= 0 && hash(c * 13 + face * 101, Math.floor((a + c * 7 + 200) / 6), 17) < dens(c, a, face);
  b.fill(-22, 1, -11, 21, 24, 10, (x, y, z) => {
    const front = z === 10, back = z === -11, left = x === -22, right = x === 21;
    if (!(front || back || left || right)) return K('mortar');
    const face = front ? 1 : back ? 2 : left ? 3 : 4;
    const along = front || back ? x : z;
    const row = y - 1, c = Math.floor(row / 3), bed = row % 3 === 2;
    const corner = front || back ? Math.min(x + 22, 21 - x) : Math.min(z + 11, 10 - z);
    const qLen = (c % 2 ? 4 : 2) + (front || back ? 0 : c % 2 ? -2 : 2);
    if (corner === 0 && (front || back) && (left || right) && hash(x, y, z) < 0.12) return 0; // chipped corners
    if (bed) {
      if (corner > qLen && T(c, along, face)) return (along + c * 7 + 200) % 6 === 5 && !T(c, along + 1, face) ? K('via') : K('trace');
      return K('mortar');
    }
    if (corner < qLen) return c % 2 ? K('q1') : K('q2');
    if (corner === qLen) return K('mortar');
    const seg = along + 60 + c * 3 + (c % 2) * 2;
    if (seg % 5 === 0) return T(c, along, face) && T(c - 1, along, face) ? K('trace') : K('mortar');
    if (y <= 3 && noise(along + face * 40, y * 2, 3.5) > (front ? 0.6 : 0.46)) return hash(x, y, z) < 0.5 ? K('moss1') : K('moss2');
    const t = STONE[Math.floor(hash(Math.floor(seg / 5), c, face) * STONE.length)];
    return hash(x, y, z + 3) < 0.1 ? STONE[Math.min(STONE.length - 1, STONE.indexOf(t) + 1)] : t;
  });

  // ---- the door: an arch of voussoirs, jambs proud, a painted plank leaf with iron straps
  const inArch = (x, y, r = 3.5) => x >= -18 && x <= -12 && (y <= 18 || (x + 15) ** 2 + (y + 0.5 - 18.5) ** 2 <= r * r);
  for (let y = 1; y <= 24; y += 1) for (let x = -21; x <= -9; x += 1) {
    if (inArch(x, y)) {
      b.cut(x, y, 10);
      const plank = Math.floor((x + 18) / 2);
      b.put(x, y, 9, (x + 18) % 2 === 0 && x !== -18 ? paint1 : tone([paint2, paint2, paint1], plank, Math.floor(y / 5), 1, 5));
      continue;
    }
    const r = Math.hypot(x + 15, y + 0.5 - 18.5);
    if (y >= 18 && r <= 5.4) {
      const a = Math.atan2(y + 0.5 - 18.5, x + 15);
      const v = Math.floor((a / Math.PI) * 7);
      const id = v === 3 && r > 4.2 && r < 5 ? K('via') : (a / Math.PI) * 7 - v < 0.12 ? K('mortar') : v % 2 ? K('q1') : K('q2');
      b.put(x, y, 10, id); b.put(x, y, 11, id);
    } else if ((x === -19 || x === -11) && y <= 18) {
      const id = Math.floor((y - 1) / 3) % 2 ? K('q1') : K('q2');
      b.put(x, y, 10, (y - 1) % 3 === 2 ? K('mortar') : id); b.put(x, y, 11, (y - 1) % 3 === 2 ? K('mortar') : id);
    }
  }
  for (const y of [4, 14]) for (let x = -18; x <= -13; x += 1) b.put(x, y, 10, x % 2 ? K('rivet') : K('strap')); // strap hinges
  b.put(-12, 9, 10, K('rivet')); b.put(-12, 8, 10, K('strap')); // ring handle

  // ---- the screen: opening, a three-band carved frame with a glowing inlay, corner runes, sill, crest
  for (let y = 5; y <= 18; y += 1) for (let x = -5; x <= 16; x += 1) { b.cut(x, y, 10); b.put(x, y, 9, K('void')); }
  for (let y = 2; y <= 21; y += 1) for (let x = -8; x <= 19; x += 1) {
    const ring = Math.min(x + 8, 19 - x, y - 2, 21 - y); // 0 outer .. 2 inner
    if (ring > 2) continue;
    const cornerBlock = (x <= -6 || x >= 17) && (y <= 4 || y >= 19);
    let id;
    if (cornerBlock) id = ring === 1 && (x === -7 || x === 18) && (y === 3 || y === 20) ? holo2 : K('q1');
    else if (ring === 0) id = tone([K('s3'), K('s4')], x, y, 0, 6);
    else if (ring === 1) id = (x + y) % 5 === 0 ? K('mortar') : K('trace');
    else id = (x + y) % 3 === 0 ? K('s2') : K('q1');
    b.put(x, y, 10, id); b.put(x, y, 11, id);
    if (ring === 2 && !cornerBlock) b.put(x, y, 12, (x + y) % 3 === 0 ? K('q2') : K('q1')); // the bead, proud again
  }
  b.fill(-10, 1, 11, 21, 1, 13, (x, y, z) => (z === 13 ? K('q1') : tone(STONE, x, y, z, 7)));
  b.fill(1, 22, 10, 10, 24, 11, (x, y, z) => (x === 1 || x === 10 || y === 24 ? K('q2') : K('q1')));
  b.fill(3, 23, 12, 8, 23, 12, (x) => (x === 5 || x === 6 ? holo1 : holo2)); b.put(5, 24, 12, holo2); b.put(6, 22, 12, holo2); // crest rune

  // ---- the jettied timber storey: posts, rails, braces, plaster, lit windows
  const postsFB = [-23, -22, -20, -12, -8, 7, 11, 19, 21, 22];
  const postsLR = [-12, -11, -4, 3, 10, 11];
  b.fill(-23, 25, -12, 22, 36, 11, (x, y, z) => {
    const front = z === 11, back = z === -12, left = x === -23, right = x === 22;
    if (!(front || back || left || right)) return K('w1');
    const along = front || back ? x : z, up = y - 25;
    if (up === 0 || up === 11) return hash(x, y, z) < 0.25 ? K('w2') : K('w1');
    const posts = front || back ? postsFB : postsLR;
    if (posts.includes(along)) return tone(WOOD, x, Math.floor(y / 3), z, 8);
    if (up === 5) return K('w2');
    const prev = Math.max(...posts.filter((q) => q < along)), next = Math.min(...posts.filter((q) => q > along));
    const wdt = next - prev - 1, i = along - prev - 1;
    if (wdt >= 3 && wdt <= 8 && up < 5 && (i === up - 1 || wdt - 1 - i === up - 1) && (front ? along < -8 || along > 7 : true)) return K('w2'); // braces
    if (up > 5 && wdt > 4 && (i === 10 - up || wdt - 1 - i === 10 - up) && !front) return K('w2');
    if (left && along > -10 && along < -6 && up > 6 && up < 9) return (x + y + z) % 2 ? K('w3') : K('w4'); // plaster fallen off: wattle
    if (up <= 2 && noise(along + (front ? 0 : 50), up, 3) > 0.62) return K('stain');
    return tone(PLASTER, x, y, z, 9);
  });
  for (let x = -22; x <= 21; x += 4) b.put(x, 24, 11, K('w2')); // joist ends under the jetty
  for (let z = -11; z <= 10; z += 4) { b.put(-23, 24, z, K('w2')); b.put(22, 24, z, K('w2')); }
  const windowAt = (x0, y0, z, face, cyanPane) => {
    for (let j = 0; j < 7; j += 1) for (let i = 0; i < 7; i += 1) {
      const edge = i === 0 || j === 0 || i === 6 || j === 6, bar = i === 3 || j === 3;
      const pane = !edge && !bar;
      const lit = pane && cyanPane(i, j) ? K('mon') : (i + j) % 4 === 0 ? K('lit2') : K('lit');
      const [x, y] = [x0 + i, y0 + j];
      if (face === 'z') { b.put(x, y, z, pane ? 0 : edge ? paint2 : paint1); if (pane) { b.cut(x, y, z); b.put(x, y, z - Math.sign(z), lit); } }
      else { b.put(z, y, x, pane ? 0 : edge ? paint2 : paint1); if (pane) { b.cut(z, y, x); b.put(z - Math.sign(z), y, x, lit); } }
    }
  };
  windowAt(-19, 28, 11, 'z', (i, j) => i > 3 && j < 3);
  windowAt(12, 28, 11, 'z', (i, j) => i < 3 && j > 3);
  windowAt(-3, 28, -12, 'z', () => false);
  windowAt(-3, 28, 22, 'x', (i, j) => i > 3 && j > 3);
  b.fill(-20, 27, 12, -12, 27, 12, K('w2')); // sills
  b.fill(11, 26, 12, 19, 27, 13, (x, y, z) => (y === 27 && z === 13 ? K('w3') : K('w1'))); // window box
  for (let x = 11; x <= 19; x += 1) for (const z of [12, 13]) {
    const r = hash(x, z, 41);
    b.put(x, 28, z, r < 0.3 ? K('flowerR') : r < 0.5 ? K('flowerV') : r < 0.62 ? K('flowerY') : C.leaf3);
    if (r > 0.75) b.put(x, 29, z, C.leaf2);
  }

  // ---- roof: tile courses, a ridge, bargeboards, gable timber with a round lit window, moss
  for (let z = -14; z <= 13; z += 1) for (let x = -24; x <= 23; x += 1) {
    const top = roofTop(z), kk = Math.min(z + 14, 13 - z);
    const over = x === -24 || x === 23 || z < -12 || z > 11;
    for (let y = over ? top - 1 : 37; y <= top; y += 1) {
      let id;
      if (x === -24 || x === 23) id = y === top ? (kk % 3 === 0 ? K('w3') : K('w2')) : K('w1');
      else if (y < top) id = kk === 0 ? K('w1') : (x === -23 || x === 22) ? gable(x, y, z) : K('w1');
      else {
        const course = Math.floor(kk / 2), colm = Math.floor((x + 24 + (course % 2) * 2) / 4);
        id = kk % 2 === 0 ? R[0] : R[1 + Math.floor(hash(course, colm, z < 0 ? 5 : 6) * 3)];
        if (z < 0 && noise(x, z, 6) > 0.56) id = hash(x, z) < 0.6 ? K('moss1') : K('moss2');
        else if (z > 0 && kk < 6 && x < -10 && noise(x + 30, z, 4) > 0.64) id = K('moss2');
        else if (hash(x, z, 77) < 0.012) id = C.iron1; // a slipped tile
      }
      b.put(x, y, z, id);
    }
  }
  function gable(x, y, z) {
    const zz = z + 0.5 + 0.5;
    if (Math.hypot(zz, y + 0.5 - 43) < 2.2) return Math.hypot(zz, y + 0.5 - 43) < 1.3 ? K('mon') : K('w1');
    if (z === -1 || z === 0 || y === 37 || Math.abs(z + 0.5) === 7.5) return K('w2');
    return tone(PLASTER, x, y, z, 10);
  }
  b.fill(-24, 51, -1, 23, 51, 0, (x) => (x % 3 === 0 ? R[0] : R[2])); // ridge
  b.fill(-25, 50, -1, -25, 51, 0, C.iron2);
  for (const [y, z, id] of [[52, -1, 'crys2'], [52, 0, 'crys3'], [53, -1, 'crys2'], [53, 0, 'crys2'], [54, -1, 'crys1'], [55, -1, 'crys1']]) b.put(-25, y, z, K(id)); // crystal finial
  b.fill(24, 50, -1, 24, 53, -1, C.iron3); // iron spike

  // ---- chimney: coursed, capped, a pot with a neon ember deep inside
  b.fill(-16, 38, -8, -12, 51, -4, (x, y, z) => {
    const along = x === -16 || x === -12 ? z : x;
    if ((y - 38) % 3 === 2) return K('mortar');
    if (y > 48 && hash(x, y, z) < 0.5) return K('soot');
    return STONE[Math.floor(hash(Math.floor((along + 40 + Math.floor((y - 38) / 3) * 2) / 3), Math.floor((y - 38) / 3), 9) * STONE.length)];
  });
  b.fill(-17, 52, -9, -11, 52, -3, (x, y, z) => (x === -17 || x === -11 || z === -9 || z === -3 ? tone([K('s3'), K('s4'), K('soot')], x, y, z, 13) : K('soot')));
  b.fill(-15, 53, -7, -13, 56, -5, (x, y, z) => (x === -14 && z === -6 ? (y === 53 ? K('ember') : 0) : y === 56 ? K('soot') : y === 54 ? C.iron2 : hash(x, y, z) < 0.3 ? C.brass1 : K('clay')));

  // ---- lantern: an iron arm and a cage by the door (the crystal is its own part)
  b.put(-21, 17, 11, C.iron2); b.put(-21, 17, 12, C.iron2); b.put(-21, 17, 13, C.iron2); b.put(-21, 16, 11, C.iron2);
  b.fill(-22, 10, 12, -20, 10, 14, C.iron2);
  b.fill(-22, 15, 12, -20, 15, 14, C.iron2);
  b.put(-21, 16, 13, C.iron1);
  for (const [x, z] of [[-22, 12], [-20, 12], [-22, 14], [-20, 14]]) b.fill(x, 11, z, x, 14, z, C.iron1);

  // ---- hologram emitter under the eaves
  b.fill(-7, 35, 12, 6, 35, 13, (x, y, z) => (z === 13 && (x === -5 || x === 0 || x === 4) ? holo2 : C.iron2));
  b.put(-7, 35, 11, C.iron1); b.put(6, 35, 11, C.iron1);

  // ---- cable from the screen up the corner and over the tiles to the dish
  b.rope(CABLE, 0.55, 0.55, (x, y, z) => ((x + y + z) % 5 === 0 ? K('cable2') : K('cable1')));
  for (const [x, y, z] of [[19, 22, 11], [21, 29, 12], [22, 34, 12]]) { b.put(x, y, z, C.iron3); b.put(x, y + 1, z, C.iron3); }

  // ---- the story at the foot: a workbench and pegboard, a cable reel with the cat, a crate of parts
  b.fill(28, 7, -11, 33, 7, 7, (x, y, z) => (z === -11 || z === 7 ? K('w1') : tone([K('w3'), K('w4'), K('w3')], x, 0, 0, 11)));
  for (const [x, z] of [[28, -11], [33, -11], [28, 7], [33, 7]]) b.fill(x, 0, z, x, 6, z, K('w1'));
  b.fill(28, 2, -10, 28, 2, 6, K('w2')); b.fill(33, 2, -10, 33, 2, 6, K('w2'));
  b.fill(29, 3, -9, 32, 3, 5, (x, y, z) => ((x + z) % 3 ? K('w2') : K('w3'))); // low shelf
  b.fill(30, 4, -8, 32, 5, -5, (x, y, z) => (y === 5 && z === -7 ? C.iron3 : K('stencilRed'))); // toolbox on the shelf
  b.fill(29, 8, -10, 32, 9, -9, C.iron2); b.fill(30, 8, -10, 31, 9, -10, C.iron3); b.fill(34, 9, -10, 35, 9, -10, C.iron3); // vise
  b.fill(30, 8, -6, 30, 8, -3, K('w4')); b.fill(29, 8, -2, 31, 9, -2, C.iron2); // hammer
  b.fill(29, 8, 0, 29, 8, 2, K('stencilRed')); b.put(29, 8, 3, C.iron3); b.put(29, 8, 4, K('tip')); // soldering iron
  b.fill(31, 8, -1, 33, 8, 1, (x, y, z) => (x === 32 && z === 0 ? K('chip') : (x + z) % 2 ? K('pcbGlow') : K('pcb'))); // a board
  b.fill(22, 9, -9, 22, 18, 5, (x, y, z) => ((y + z) % 2 === 0 && y % 2 ? K('w1') : K('w4'))); // pegboard
  b.fill(23, 11, -7, 23, 16, -7, C.iron3); b.fill(23, 16, -8, 23, 16, -6, C.iron3); // wrench
  b.fill(23, 11, -3, 23, 15, 0, (x, y, z) => (z === -3 ? K('w2') : y > 13 ? C.iron3 : 0)); // saw
  b.rope([[23, 13, 3], [23, 11, 2], [23, 11, 4], [23, 13, 3]], 0.6, 0.6, K('cable1'));
  if (p.props.includes('popcorn')) {
    b.fill(29, 8, 4, 31, 11, 6, (x, y, z) => (x === 30 && z === 5 && y < 11 ? K('corn1') : (x + z) % 2 ? K('red') : K('white')));
    for (const [x, y, z] of [[30, 12, 5], [29, 12, 5], [30, 12, 4], [31, 12, 6], [30, 13, 5], [29, 12, 6]]) b.put(x, y, z, hash(x, y, z) < 0.5 ? K('corn1') : K('corn2'));
    b.put(32, 8, 6, K('corn1')); b.put(33, 8, 3, K('corn2'));
  }
  if (p.props.includes('magnifier')) {
    for (let a = 0; a < 20; a += 1) b.put(30 + Math.round(Math.cos(a * 0.314) * 2), 11 + Math.round(Math.sin(a * 0.314) * 2), 4, C.brass2);
    b.fill(29, 10, 4, 31, 12, 4, K('glass')); b.put(30, 11, 4, C.brass2);
    b.fill(30, 8, 4, 30, 8, 4, K('brassD')); b.rope([[30, 8, 4], [30, 8.5, 6]], 0.5, 0.5, K('w1'));
  }
  // cable reel on its side, wound, one glowing strand
  for (let z = 15; z <= 24; z += 1) for (let y = 0; y <= 8; y += 1) {
    const r = Math.hypot(y + 0.5 - 4.2, z + 0.5 - 19.5);
    for (const x of [28, 33]) if (r <= 4.2) b.put(x, y, z, r > 3.4 ? K('w1') : Math.abs(((Math.atan2(y - 3.7, z - 19) + 6.3) % 1.05) - 0.5) < 0.15 ? K('w1') : K('w3'));
    for (let x = 29; x <= 32; x += 1) if (r <= 3.2) b.put(x, y, z, r > 1.6 ? (x === 31 ? K('trace') : (Math.round(r * 3) + x) % 2 ? K('cable1') : K('cable2')) : K('w3'));
  }
  b.rope([[30, 1, 16], [27, 0.6, 14], [23, 0.6, 12.5], [21.5, 1.5, 11.5]], 0.55, 0.55, K('cable1'));
  b.put(22, 2, 11, K('via'));
  // crate of parts: planks, gears, crystal shards
  b.fill(-35, 0, 18, -30, 4, 23, (x, y, z) => {
    const wall = x === -35 || x === -30 || z === 18 || z === 23;
    if (!wall) return y < 4 ? K('void') : 0;
    if (y === 2 || (x === -35 || x === -30) && (z === 18 || z === 23)) return K('batten');
    return tone(CRATE, x, Math.floor(y / 2), z, 12);
  });
  for (let a = 0; a < 16; a += 1) { const an = (a / 16) * Math.PI * 2, rr = a % 2 ? 2.2 : 1.6; b.put(-33 + Math.round(Math.cos(an) * rr), 5 + Math.round(Math.sin(an) * rr) + 1, 20, C.brass2); }
  b.put(-33, 6, 20, C.brass1);
  b.fill(-31, 4, 21, -31, 6, 21, K('crys2')); b.put(-32, 5, 22, K('crys3')); b.put(-34, 4, 22, K('crys2'));
  b.rope([[-34, 4.5, 19], [-32, 5, 19], [-31, 4.5, 19.5]], 0.55, 0.55, K('cable2'));
  for (let a = 0; a < 14; a += 1) { const an = (a / 14) * Math.PI * 2, rr = a % 2 ? 2 : 1.4; b.put(-37 + 1 + Math.round(Math.cos(an) * rr * 0.4), 2 + Math.round(Math.sin(an) * rr), 21 + Math.round(Math.cos(an) * rr), C.brass1); }

  return b;
}

// The cable's path in model voxels: screen corner, up the wall, over the eaves, up the tiles to the dish.
const CABLE = [[18, 21, 11.5], [20.5, 24, 12.5], [21.5, 30, 12.5], [22, 35, 12.8], [20, 38.8, 12.8], [17, 45.6, 6.5], [14.5, 50.4, 2.5], [14, 52.4, 1]];

// ---- the crate: low (a third of the shop's height), planked panels with battens and iron corners,
// stencils (this way up, fragile, a label with the product's glyph, a barcode), and a lid with the glyph large
const arrows = (u, v, u0) => { // two 'this way up' arrows, 5 wide and 9 tall
  for (const off of [0, 7]) {
    const du = u - u0 - off, av = v - 3;
    if (du >= 0 && du <= 4 && av >= 0 && av <= 8 && ((av >= 5 && Math.abs(du - 2) <= 8 - av) || (du === 2 && av < 5))) return true;
  }
  return false;
};
const glass = (u, v, u0) => { const gu = u - u0, gv = v - 3; return (gv >= 4 && gv <= 7 && Math.abs(gu) <= Math.max(1, gv - 3)) || (gv >= 0 && gv < 4 && gu === 0) || (gv === -1 && Math.abs(gu) <= 2); };
function panel([x0, y0, z0], [x1, y1, z1], normal, paint) {
  const b = box([x0, y0, z0], [x1, y1, z1]);
  const U = normal[0] ? z1 - z0 + 1 : x1 - x0 + 1, V = y1 - y0 + 1;
  for (let y = y0; y <= y1; y += 1) for (let z = z0; z <= z1; z += 1) for (let x = x0; x <= x1; x += 1) {
    const w = normal[0] ? (normal[0] > 0 ? x - x0 : x1 - x) : normal[2] > 0 ? z - z0 : z1 - z; // 0 inside .. 2 outside
    const u = normal[0] ? (normal[0] > 0 ? z1 - z : z - z0) : normal[2] > 0 ? x - x0 : x1 - x; // along, left to right seen from outside
    const v = y - y0;
    if (w === 2) { // battens proud of the planks: stiles, rails, a middle stile on the long sides, iron at the corners
      if (!(u < 2 || u >= U - 2 || v < 2 || v >= V - 2 || (U > 30 && Math.abs(u - (U - 1) / 2) < 1))) continue;
      const corner = (u < 4 || u >= U - 4) && (v < 4 || v >= V - 4);
      b.put(x, y, z, corner ? ((u + v) % 3 === 1 ? K('rivet') : K('strap')) : (u + 2 * v) % 9 === 0 ? K('rivet') : hash(x, y, z) < 0.3 ? K('cw4') : K('batten'));
      continue;
    }
    if (w === 1 && v % 4 === 3) continue; // a groove between planks
    const plank = Math.floor(v / 4);
    let id = CRATE[Math.floor(hash(plank, Math.floor((u + plank * 5) / 13), 3) * CRATE.length)];
    if (hash(Math.floor(u / 3), v, plank) < 0.07) id = K('cw4');
    if (w === 1) id = paint(u, v, U, hash(x, y, z) < 0.12) ?? id;
    b.put(x, y, z, id);
  }
  return b;
}
const sidePaint = (u, v, U, worn) => (worn ? null : arrows(u, v, 4) ? K('stencil') : glass(u, v, 20) ? K('stencilRed') : null);
const longPaint = (G) => (u, v, U, worn) => {
  const lu = u - (U - 22), lv = v - 3; // a shipping label: a red border, the product's glyph
  if (lu >= 0 && lu <= 10 && lv >= 0 && lv <= 9) return lu === 0 || lu === 10 || lv === 0 || lv === 9 ? K('stencilRed') : G(lu - 2, 8 - lv) ? K('stencil') : K('label');
  const bu = u - (U - 9); // a barcode
  if (bu >= 0 && bu <= 5 && v >= 4 && v <= 11) return hash(bu, 9) < 0.55 && !worn ? K('stencil') : null;
  return sidePaint(u, v, U, worn);
};
function lidPanel(G, [x0, y0, z0], [x1, z1]) {
  const W = x1 - x0 + 1, D = z1 - z0 + 1;
  const b = box([x0, y0, z0], [x1, y0 + 2, z1]);
  for (let z = z0; z <= z1; z += 1) for (let x = x0; x <= x1; x += 1) {
    const u = x - x0, v = z - z0, plank = Math.floor(v / 4);
    const wood = CRATE[Math.floor(hash(plank, Math.floor((u + plank * 7) / 11), 7) * CRATE.length)];
    b.put(x, y0, z, wood);
    // planks with grooves between them, the product's glyph stencilled large (3 voxels a pixel), a little worn
    const gi = Math.floor((u - (W - 21) / 2) / 3), gj = Math.floor((v - (D - 21) / 2) / 3);
    let top = v % 4 === 3 ? 0 : hash(Math.floor(u / 3), v, plank) < 0.06 ? K('cw4') : wood;
    if (top && gi >= 0 && gi < 7 && gj >= 0 && gj < 7 && G(gi, gj) && hash(x, z, 5) > 0.1) top = K('stencil');
    if (top) b.put(x, y0 + 1, z, top);
    // proud on top: a batten frame, two iron straps, rivets
    if (u < 2 || u >= W - 2 || v < 2 || v >= D - 2) b.put(x, y0 + 2, z, (u + v) % 7 === 0 ? K('rivet') : hash(x, z, 4) < 0.3 ? K('cw4') : K('batten'));
    else if (u === 8 || u === 9 || u === W - 10 || u === W - 9) b.put(x, y0 + 2, z, v % 5 === 2 ? K('rivet') : K('strap'));
  }
  return b;
}

// ---- moving parts
function buildParts(p) {
  // the shop in three storeys that spring up in turn (each hangs from the one below), and a yard of props that is always there
  const all = buildShop(p);
  const yard = box([-37, 0, -12], [35, 14, 24]);
  const body = box([-23, 0, -12], [23, 24, 14]);
  const upper = box([-24, 25, -13], [23, 36, 14]);
  const roof = box([-25, 36, -14], [24, 56, 13]);
  for (let y = 0; y < all.g.sy; y += 1) for (let z = 0; z < all.g.sz; z += 1) for (let x = 0; x < all.g.sx; x += 1) {
    const id = all.g.data[x + all.g.sx * (z + all.g.sz * y)];
    if (!id) continue;
    const [mx, my, mz] = [x + all.o[0], y + all.o[1], z + all.o[2]];
    const eave = my === 36 && (mz === -14 || mz === 13); // the roof's lip hangs below the storey's top
    (my <= 14 && (mx >= 24 || mx <= -29 || mz >= 15) ? yard : my <= 24 ? body : my <= 36 && !eave ? upper : roof).put(mx, my, mz, id);
  }
  const [holo1, holo2, holo3] = p.holo.map((hex, i) => C[`shop_${p.key}_holo${i}`]);
  const G = glyphAt(p.glyph);
  // the hologram banner: a lit border, see-through scanlines, the glyph, a swallowtail
  const banner = box([-6, 25, 13], [5, 34, 13]);
  for (let y = 25; y <= 34; y += 1) for (let x = -6; x <= 5; x += 1) {
    const gi = x + 4, gj = 33 - y;
    const edge = x === -6 || x === 5 || y === 34;
    if (y <= 26 && (x === -1 || x === 0 || (y === 25 && x > -4 && x < 3))) continue; // swallowtail
    if (gi >= 0 && gi < 7 && gj >= 0 && gj < 7 && G(gi, gj)) banner.put(x, y, 13, (gi + gj) % 3 ? holo1 : holo2);
    else if (edge) banner.put(x, y, 13, holo2);
    else if (y % 2 === 0 && hash(x, y, 51) > 0.25) banner.put(x, y, 13, holo3);
  }
  const scan = box([-6, 26, 14], [5, 26, 14]);
  scan.fill(-5, 26, 14, 4, 26, 14, (x) => (x % 3 === 0 ? 0 : holo1));

  // the rune-dish: a paraboloid of iron with a ring of runes, a crystal at its focus
  const dish = box([7, 52, -8], [20, 65, 6]);
  dish.fill(12, 52, -2, 15, 52, 1, C.iron1);
  dish.fill(13, 53, -1, 14, 57, 0, (x, y) => (y % 2 ? C.iron2 : C.iron3));
  const c = [13.5, 60, -0.5], n = [0, 0.62, 0.78];
  for (let y = 54; y <= 65; y += 1) for (let z = -8; z <= 6; z += 1) for (let x = 7; x <= 20; x += 1) {
    const v = [x + 0.5 - c[0], y + 0.5 - c[1], z + 0.5 - c[2]];
    const dn = v[0] * n[0] + v[1] * n[1] + v[2] * n[2];
    const rr = Math.hypot(v[0] - dn * n[0], v[1] - dn * n[1], v[2] - dn * n[2]);
    if (rr <= 4.7 && Math.abs(dn - (rr * rr) / 14 + 0.4) < 0.6) dish.put(x, y, z, rr > 3.9 ? (hash(x, y, z) < 0.3 ? C.brass2 : C.iron3) : Math.abs(rr - 2.6) < 0.5 && hash(x, y, z) > 0.25 ? K('rune') : C.iron2);
  }
  const f = c.map((v, i) => v + n[i] * 3.4);
  for (const a of [0, 2.1, 4.2]) dish.rope([[c[0] + Math.cos(a) * 3.9, c[1] - Math.sin(a) * 3.9 * n[2] + 0.9, c[2] + Math.sin(a) * 3.9 * n[1] + 0.5], f], 0.5, 0.5, C.iron1);
  dish.egg(f[0], f[1], f[2], 0.9, 1.3, 0.9, K('crys2'));
  dish.put(Math.floor(f[0]), Math.floor(f[1]), Math.floor(f[2]), K('crys1'));

  // the lantern's crystal: a glowing double pyramid
  const crystal = box([-22, 11, 12], [-20, 14, 14]);
  crystal.put(-21, 11, 13, K('crys3')); crystal.put(-21, 14, 13, K('crys1'));
  for (const y of [12, 13]) { crystal.put(-21, y, 13, K('crys1')); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) crystal.put(-21 + dx, y, 13 + dz, (dx + dz + y) % 2 ? K('crys2') : K('crys3')); }

  // neon smoke: little puffs that rise, drift and shrink
  const puffs = [0, 1, 2, 3].map((i) => { const s = box([-17, 56, -9], [-11, 61, -3]); s.egg(-14, 58.5, -6, 2.6, 2.1, 2.6, i % 2 ? K('smoke1') : K('smoke2')); return s; });
  // a data pulse that runs up the cable
  const pulse = box([17, 20, 11], [18, 21, 12]);
  pulse.fill(17, 20, 11, 18, 21, 12, K('pulse'));

  // the cat: asleep on the reel, curled, tail round the front, one eye not quite shut
  const cat = box([26, 6, 16], [35, 12, 24]);
  cat.egg(30.8, 8.7, 19.6, 3.1, 1.7, 2.0, (x, y, z) => (y <= 7 && z >= 20 ? K('catWhite') : x % 3 === 0 && y >= 9 ? K('catStripe') : hash(x, y, z) < 0.5 ? K('cat1') : K('cat2')), (x) => x >= 29);
  cat.put(28, 7, 21, K('catWhite')); cat.put(29, 7, 21, K('catWhite')); // paws
  const head = box([25, 7, 17], [30, 13, 23]);
  head.egg(27.4, 9.9, 20.2, 1.9, 1.7, 1.8, (x, y, z) => (y <= 9 && z >= 21 ? K('catWhite') : x === 27 && y >= 11 ? K('catStripe') : K('cat1')), (x) => x <= 28);
  for (const x of [26, 28]) { head.put(x, 11, 20, K('cat2')); head.put(x, 12, 20, K('cat1')); head.put(x, 11, 21, K('catNose')); }
  head.put(27, 9, 22, K('catNose'));
  head.cut(26, 10, 21); head.cut(28, 10, 21);
  const eyes = box([26, 10, 21], [28, 10, 21]);
  eyes.put(26, 10, 21, K('catEye')); eyes.put(28, 10, 21, K('catEye'));
  const tail = box([27, 6, 17], [36, 10, 24]);
  tail.rope([[33.5, 8.2, 19.5], [35, 7.8, 21], [34, 7.4, 22.6], [31, 7.4, 23.1], [29, 7.6, 22.8]], 0.75, 0.6, (x, y, z) => (x <= 29 ? K('catWhite') : (x + z) % 3 === 0 ? K('catStripe') : K('cat2')));

  // the crate: four low sides on hinges and a lid
  const front = panel([-26, 0, 13], [25, 15, 15], [0, 0, 1], longPaint(G));
  const back = panel([-26, 0, -16], [25, 15, -14], [0, 0, -1], longPaint(G));
  const left = panel([-26, 0, -13], [-24, 15, 12], [-1, 0, 0], sidePaint);
  const right = panel([23, 0, -13], [25, 15, 12], [1, 0, 0], sidePaint);
  const lid = lidPanel(G, [-27, 16, -17], [26, 16]);

  return {
    yard: yard.part('yard', [0, 0, 0]),
    body: body.part('body', [0, 0, 0]),
    upper: upper.part('upper', [0, 25, 0], body),
    roof: roof.part('roof', [0, 37, 0], upper),
    banner: banner.part('banner', [-0.5, 35, 13.5], upper),
    scan: scan.part('scan', [-0.5, 26.5, 14.5], upper),
    dish: dish.part('dish', [13.5, 52, -0.5], roof),
    crystal: crystal.part('crystal', [-20.5, 13, 13.5], body),
    ...Object.fromEntries(puffs.map((s, i) => [`smoke${i}`, s.part(`smoke${i}`, [-13.5, 58.5, -5.5])])),
    pulse: pulse.part('pulse', [18, 21, 12]),
    cat: cat.part('cat', [30.5, 7, 19.5]),
    catHead: head.part('catHead', [28.5, 8.5, 20], cat),
    catEyes: eyes.part('catEyes', [27.5, 10.5, 21.5], head),
    catTail: tail.part('catTail', [33.5, 8.2, 19.5], cat),
    crateF: front.part('crateF', [0, 0, 16]),
    crateB: back.part('crateB', [0, 0, -16]),
    crateL: left.part('crateL', [-26, 0, 0]),
    crateR: right.part('crateR', [26, 0, 0]),
    lid: lid.part('lid', [0, 16, 0]),
  };
}

const built = new Map();
// name, hinge axis, which way it falls, and outward on the ground (x, z)
const PANELS = [['crateF', 'x', 1, [0, 1]], ['crateR', 'z', -1, [1, 0]], ['crateB', 'x', -1, [0, -1]], ['crateL', 'z', 1, [-1, 0]]];
// A spring from folded (0) to standing (1): overshoots by about a sixth and settles inside a second.
const spring = (tau) => (tau <= 0 ? 0 : 1 - Math.exp(-6 * tau) * Math.cos(10 * tau));

export function workshop(product) {
  const p = { props: [], open: false, ...product };
  return {
    gait: 'still',
    info: INFO,
    build() {
      if (!built.has(p.key)) built.set(p.key, { parts: buildParts(p) });
      return built.get(p.key);
    },
    setup(ctx) {
      const { THREE, mem, state, parts } = ctx;
      mem.revealAt = p.open ? -100 : null;
      ctx.reveal = () => { mem.revealAt = state.t; };
      ctx.revealed = () => mem.revealAt !== null;
      // the screen: the product's clip, unlit, in the stone frame
      if (typeof document !== 'undefined' && p.video) {
        const video = document.createElement('video');
        Object.assign(video, { src: p.video, muted: true, loop: true, playsInline: true, autoplay: true, preload: 'auto' });
        video.setAttribute('playsinline', '');
        video.play().catch(() => {});
        const map = new THREE.VideoTexture(video);
        map.colorSpace = THREE.SRGBColorSpace;
        mem.video = video;
        mem.screen = new THREE.Mesh(new THREE.PlaneGeometry(22, 14), new THREE.MeshBasicMaterial({ map, toneMapped: false }));
      } else {
        mem.screen = new THREE.Mesh(new THREE.PlaneGeometry(22, 14), new THREE.MeshBasicMaterial({ color: 0x1b2a38 }));
      }
      mem.screen.position.set(6, 12, 10.15);
      // neon smoke is a haze, not blocks: each puff gets its own see-through material
      mem.smoke = [0, 1, 2, 3].map((i) => {
        const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
        parts[`smoke${i}`].traverse((o) => { if (o.isMesh) { o.material = m; o.castShadow = false; } });
        return m;
      });
      parts.body.add(mem.screen);
      // cable path relative to the pulse's home
      mem.cable = CABLE.map(([x, y, z]) => new THREE.Vector3(x - 18, y - 21, z - 12));
      mem.lens = mem.cable.slice(1).map((q, i) => q.distanceTo(mem.cable[i]));
      mem.total = mem.lens.reduce((a, l) => a + l, 0);
    },
    idle(ctx, dt) {
      const { parts: P, state, mem } = ctx;
      const t = state.t, V = ctx.voxel;
      const u = mem.revealAt === null ? -1 : t - mem.revealAt;
      const on = (a) => (u < 0 ? 0 : clamp01((u - a) / 0.35));
      if (u < 0.2 || !mem.fired) mem.fired = {};
      const once = (k) => u < 3 && !mem.fired[k] && (mem.fired[k] = true); // one-shot effects of this reveal

      // ---- the crate: it rattles now and then (something inside wants out), then falls open
      const crated = u < 2.6;
      for (const [n] of PANELS) P[n].visible = crated;
      P.lid.visible = crated;
      if (u < 0) {
        const j = t % 4.2, jolt = j < 0.3 ? Math.sin((j / 0.3) * Math.PI) : 0;
        for (const [n, ax, s] of PANELS) P[n].rotation[ax] += s * 0.02 * jolt * Math.sin(t * 50);
        P.lid.position.y += jolt * 0.8;
      } else if (crated) {
        const shake = u < 0.55 ? (0.01 + u * 0.05) * Math.sin(u * 70) : 0;
        PANELS.forEach(([n, ax, s, out], i) => {
          const d = 0.55 + i * 0.07, fu = clamp01((u - d) / 0.45);
          let th = (Math.PI / 2) * fu * fu;
          const bu = (u - d - 0.45) / 0.22;
          if (bu > 0 && bu < 1) th -= 0.1 * Math.sin(Math.PI * bu); // a bounce as it lands
          P[n].rotation[ax] += s * (th + shake * (i % 2 ? 1 : -1));
          P[n].scale.setScalar(Math.max(0.001, 1 - smooth((u - 1.9 - i * 0.06) / 0.4))); // then folds away into the ground
          if (fu >= 1 && once(n)) {
            const at = P[n].position.clone().multiplyScalar(V);
            ctx.ring({ x: at.x + out[0] * 8 * V, y: 0.05, z: at.z + out[1] * 8 * V }, 1.8, [0xd8c7a4, 0x6a5a44], 0.6, 22);
          }
        });
        // the lid bumps, then flies off tumbling and is gone
        const lu = clamp01((u - 0.4) / 1.1);
        P.lid.position.y += (u < 0.4 ? Math.abs(Math.sin(u * 40)) * 0.8 : 0) + (1 - (1 - lu) ** 2) * 36;
        P.lid.position.z -= lu * lu * 28;
        P.lid.rotation.x -= lu * 2.2; P.lid.rotation.z += lu * 0.7;
        P.lid.scale.setScalar(Math.max(0.001, 1 - smooth((lu - 0.35) / 0.65)));
        if (u >= 0.4 && once('lid')) ctx.burst({ x: 0, y: 17 * V, z: 0 }, 16, 3, [0xc39a63, 0x6f4c2c], 0.09, 0.7);
      }

      // ---- the shop springs up out of it like a pop-up book: each storey from folded flat to standing with a
      // little overshoot, the one above following through on top of it, the roof last with a wobble
      for (const [n, a] of [['body', 1.05], ['upper', 1.22], ['roof', 1.38]]) {
        const tau = u - a, sy = spring(tau), sq = Math.min(1.1, Math.max(0.9, 1 - 0.5 * (sy - 1))); // squash and stretch
        P[n].visible = tau > 0;
        P[n].scale.set(sq, Math.max(0.001, sy), sq);
        if (n === 'roof' && tau > 0) P.roof.rotation.z += 0.05 * Math.exp(-4 * tau) * Math.sin(13 * tau);
      }
      if (u >= 1.05 && once('pop')) ctx.ring({ x: 0, y: 0.05, z: 0 }, 4.2, [0xe8dcc0, 0x7a6a50], 0.7, 36);
      if (u >= 1.8 && once('tada')) ctx.burst({ x: 0, y: 8.2, z: 0 }, 24, 2.8, [0x7ff7ff, 0xff4fd8], 0.07, 1.1);

      // ---- then it boots up: the screen (a CRT line opening), the banner flickers on, the dish pops up, smoke and data start
      const scr = on(1.55);
      mem.screen.visible = scr > 0;
      mem.screen.scale.set(Math.max(0.001, Math.min(1, scr * 2.4)), scr < 0.45 ? 0.02 : smooth((scr - 0.45) / 0.55), 1);
      const bon = on(1.75);
      const flick = bon > 0 && bon < 1 ? (hash(Math.floor(t * 30), 5) > 0.45 ? 1 : 0) : bon;
      const drop = hash(Math.floor(t * 12), 9) < 0.015 ? 0 : 1; // the odd glitch
      P.banner.scale.set(Math.max(0.001, flick * drop * (1 + 0.012 * Math.sin(t * 37))), Math.max(0.001, flick * drop), 1);
      P.banner.rotation.y += 0.04 * Math.sin(t * 0.9);
      P.scan.scale.setScalar(Math.max(0.001, flick * drop));
      P.scan.position.y += ((t * 5.5) % 9);
      P.scan.rotation.y += 0.04 * Math.sin(t * 0.9);
      const d = on(1.9);
      const back = d < 1 ? 1 + 2.2 * (d - 1) ** 3 + 1.2 * (d - 1) ** 2 : 1; // ease out, a little overshoot
      P.dish.scale.setScalar(Math.max(0.001, back));
      P.dish.rotation.y += t * 0.45 + 0.15 * Math.sin(t * 1.3);
      const ch = on(2.25); // chimney smoke, once the roof has settled
      for (let i = 0; i < 4; i += 1) {
        const v = ((t + i * 0.85) % 3.4) / 3.4;
        const sm = P[`smoke${i}`];
        sm.position.x += Math.sin(v * 3 + i) * 1.4 + v * 3;
        sm.position.y += v * 14 - 3;
        sm.position.z += v * 2;
        sm.scale.setScalar(0.35 + 0.9 * v);
        sm.rotation.y += v * 1.5 + i;
        mem.smoke[i].opacity = 0.55 * ch * Math.sin(Math.PI * v) ** 1.5;
        sm.visible = ch > 0;
      }
      const pu = ((t * 1.1) % 2.6) / 1.6;
      P.pulse.visible = pu < 1 && on(2.45) > 0;
      if (P.pulse.visible) {
        let along = pu * mem.total, i = 0;
        while (i < mem.lens.length - 1 && along > mem.lens[i]) { along -= mem.lens[i]; i += 1; }
        const a = mem.cable[i], b2 = mem.cable[i + 1];
        P.pulse.position.add(a.clone().lerp(b2, Math.min(1, along / mem.lens[i])));
        P.pulse.scale.setScalar(on(2.45));
      }

      // ---- lantern crystal: turns, bobs, breathes
      P.crystal.rotation.y += t * 1.2;
      P.crystal.position.y += Math.sin(t * 2) * 0.25;
      P.crystal.scale.setScalar(1 + 0.06 * Math.sin(t * 5.3));

      // ---- the cat: breathes, swishes, wakes when the crate goes
      P.cat.scale.set(1, 1 + 0.04 * Math.sin(t * 1.7), 1 + 0.02 * Math.sin(t * 1.7));
      P.catTail.rotation.y += 0.22 * Math.sin(t * 1.3) + 0.08 * Math.sin(t * 3.1);
      const awake = u >= 0 && u < 4.5 ? smooth(u / 0.3) * (1 - smooth((u - 3.6) / 0.9)) : 0;
      P.catHead.rotation.x -= 0.35 * awake;
      P.catHead.rotation.y -= 0.7 * awake;
      P.catHead.rotation.z += 0.08 * Math.sin(t * 0.7) * (1 - awake);
      P.catEyes.scale.y = 0.2 + 0.8 * awake;
      P.catTail.scale.setScalar(1 + 0.25 * awake);
    },
    act(ctx) { ctx.reveal(); },
  };
}

// ---------------------------------------------------------------------------------------------
// The quay on the quarter's canal front, where what the workshops make is shipped: dressed coping stones along the
// canal's edge with circuit light in their joints, iron mooring rings on the wall, a water stair down to the canal,
// bollards with rope coiled at their feet; a timber jib crane with one product's crate on its hook, over a punt moored
// alongside and loaded with more (their glyphs glowing), a pole along its gunwale and a lantern at its stern. The punt
// bobs on the canal and the crate sways and turns on its hook.
// quay({ edge, x0, x1, crane, punt, stair, bollards, glyphs }) -> a rig definition drawn in the plot's own voxels
// (place it at the plot's centre, unturned): edge(x) is the first canal column's z at x (null where the plot misses
// the canal), x0..x1 the stretch it runs, crane / punt / stair their x, bollards their xs, glyphs [{ glyph, hex }] for
// the crates (the first hangs on the hook). QUAY.water: the canal's surface under the quay (voxels).
export const QUAY = { water: -4 };
export function quay({ edge, x0, x1, crane: cx, punt: px, stair: sx, bollards = [], glyphs = [] }) {
  const W = QUAY.water, E = (x) => edge(Math.max(x0, Math.min(x1, x)));
  const zc = E(cx) - 5, pz = E(px) + 6; // the crane's turntable, the punt's middle
  const glowOf = ({ hex }) => col(`shop_glyph_${hex.toString(16)}`, hex, true);
  // a crate of planks with battens and iron corners, a glyph glowing on its front and side
  const crate = (b, xa, ya, za, n, g) => {
    const G = g ? glyphAt(g.glyph) : () => false, lit = g ? glowOf(g) : 0;
    b.fill(xa, ya, za, xa + n - 1, ya + n - 1, za + n - 1, (x, y, z) => {
      const u = x - xa, v = y - ya, w = z - za, edges = [u === 0 || u === n - 1, v === 0 || v === n - 1, w === 0 || w === n - 1].filter(Boolean).length;
      if (edges >= 2) return edges === 3 ? C.iron3 : C.iron2;
      if (w === n - 1 && G(u - 1, n - 2 - v)) return lit;
      if (u === n - 1 && G(n - 2 - w, n - 2 - v)) return lit;
      return v === 1 || v === n - 2 ? K('batten') : CRATE[Math.floor(hash(Math.floor((u + w) / 3), v >> 1, 9) * CRATE.length)];
    });
  };
  let built;
  return {
    gait: 'still',
    build() {
      if (built) return built;
      // ---- the quay: coping, rings, the water stair, bollards, the crane's plinth, the punt's mooring line
      let z0 = Infinity, z1 = -Infinity;
      for (let x = x0; x <= x1; x += 1) { const e = edge(x); if (e !== null) { z0 = Math.min(z0, e); z1 = Math.max(z1, e); } }
      const b = box([x0 - 1, W - 6, z0 - 8], [x1 + 1, 31, z1 + 5]);
      for (let x = x0; x <= x1; x += 1) {
        const e = edge(x);
        if (e === null) continue;
        const stair = x >= sx && x <= sx + 5, stone = Math.floor((x + 400) / 6);
        for (let z = e - 3; z <= e; z += 1) {
          if (stair && z === e) continue;
          const joint = (x + 400) % 6 === 0;
          b.put(x, 0, z, joint ? (hash(stone, 3) < 0.35 ? K('trace') : K('mortar')) : z === e ? K('s4') : hash(x, z, 4) < 0.06 ? K('moss1') : tone([K('q1'), K('q2'), K('s1')], stone, 0, z, 11));
        }
        for (let y = W; y < 0; y += 1) if (hash(x, y, 8) < 0.5 && y < W + 2) b.put(x, y, e, K('weed')); // weed at the waterline
        if ((x + 400) % 26 === 13 && !stair) for (const [dx, dy] of [[-1, -2], [0, -1], [1, -2], [-1, -3], [1, -3], [0, -4]]) b.put(x + dx, dy, e, dy === -1 ? C.iron2 : C.iron1); // a mooring ring
        if (stair) for (let k = 0; k <= 3; k += 1) for (let y = W - 5; y <= -1 - k; y += 1) b.put(x, y, e + k, y === -1 - k ? (x === sx || x === sx + 5 ? K('s4') : K('q1')) : y < W ? K('wet') : tone([K('s2'), K('s3')], x, y, k, 12));
      }
      for (const bx of bollards) {
        const e = E(bx);
        b.fill(bx, 1, e - 2, bx + 1, 3, e - 1, (x, y) => (y === 3 ? C.iron3 : C.iron1));
        b.fill(bx, 4, e - 2, bx + 1, 4, e - 1, C.brass2);
        for (const [dx, dz] of [[-1, 0], [-1, 1], [2, 0], [2, 1], [0, -1], [1, -1]]) b.put(bx + dx, 1, e - 2 + dz, (dx + dz) % 2 ? K('rope1') : K('rope2')); // rope coiled at its foot
      }
      b.fill(cx - 3, 1, zc - 3, cx + 2, 1, zc + 2, (x, y, z) => (x === cx - 3 || x === cx + 2 || z === zc - 3 || z === zc + 2 ? K('s3') : K('q2')));
      const moor = bollards.reduce((m, q) => (Math.abs(q - (px - 18)) < Math.abs(m - (px - 18)) ? q : m), bollards[0] ?? px - 20);
      b.rope([[moor + 1, 3.5, E(moor) - 1], [(moor + px - 18) / 2 + 1, -1.5, (E(moor) + pz - 3) / 2], [px - 17.5, W + 3, pz - 2.5]], 0.5, 0.5, K('rope1'));

      // ---- the crane (in the quay's grid, its jib straight out over the punt's stern): a turntable, a banded post, the
      // jib with a counterweight, a brace, a brass pulley at its tip
      for (let z = zc - 2; z <= zc + 1; z += 1) for (let x = cx - 2; x <= cx + 1; x += 1) b.put(x, 2, z, (x + z) % 2 ? C.iron2 : C.iron3);
      b.fill(cx - 1, 3, zc - 1, cx, 28, zc, (x, y, z) => (y % 6 === 0 ? C.iron2 : tone(WOOD, x, y >> 1, z, 13)));
      b.fill(cx - 1, 29, zc - 6, cx, 30, zc + 14, (x, y, z) => (z % 5 === 0 ? C.iron2 : y === 30 ? K('w3') : K('w2')));
      b.fill(cx - 2, 24, zc - 6, cx + 1, 28, zc - 4, (x, y, z) => (y === 28 ? C.iron2 : tone([K('s3'), K('s4')], x, y, z, 14))); // the counterweight
      b.rope([[cx - 0.5, 19, zc + 1], [cx - 0.5, 28.5, zc + 9]], 0.6, 0.6, K('w1')); // the brace
      for (const [dy, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { b.put(cx - 1, 28 + dy, zc + 13 + dz, dy || dz ? C.brass2 : C.iron3); b.put(cx, 28 + dy, zc + 13 + dz, dy || dz ? C.brass2 : C.iron3); }

      // ---- on its hook: a rope from the pulley, an iron hook, four slings, and the first crate
      const hk = box([cx - 6, 1, zc + 8], [cx + 5, 27, zc + 19]);
      hk.fill(cx - 1, 15, zc + 13, cx - 1, 27, zc + 13, (x, y) => (y % 3 ? K('rope1') : K('rope2')));
      for (const [y, dz] of [[14, 0], [13, 0], [12, 0], [12, 1], [13, 2]]) hk.put(cx - 1, y, zc + 13 + dz, C.iron3);
      for (const [ax, az] of [[cx - 4, zc + 10], [cx + 2, zc + 10], [cx - 4, zc + 16], [cx + 2, zc + 16]]) hk.rope([[cx - 0.5, 12, zc + 13.5], [ax + 0.5, 10.5, az + 0.5]], 0.5, 0.5, K('rope2'));
      crate(hk, cx - 5, 2, zc + 9, 9, glyphs[0]);

      // ---- the punt: square raked ends, planked sides under a dark gunwale, floorboards, a raised stern deck, two
      // crates, a sack and a coil of rope at the bow, the pole along its side, a lantern on the stern post
      const pb = box([px - 22, W - 2, pz - 6], [px + 22, W + 11, pz + 6]);
      for (let x = px - 18; x <= px + 17; x += 1) {
        const rake = Math.max(0, Math.abs(x - px + 0.5) - 15), bottom = W - 1 + Math.round(rake); // the swims rake up at the ends
        for (let z = pz - 5; z <= pz + 5; z += 1) {
          const side = z === pz - 5 || z === pz + 5 || x === px - 18 || x === px + 17;
          for (let y = bottom; y <= W + 2; y += 1) {
            if (!side && y > bottom && !(y === W && rake === 0) && !(y === W + 1 && x >= px + 13)) continue;
            const id = y === W + 2 ? (side ? K('w1') : 0) : side ? tone([K('w2'), K('w3'), K('w3')], x >> 2, y, z, 15) : (x + 400) % 3 === 0 ? K('w2') : K('w4');
            if (id) pb.put(x, y, z, id);
          }
        }
      }
      crate(pb, px - 13, W + 1, pz - 4, 9, glyphs[1]);
      crate(pb, px - 2, W + 1, pz - 4, 9, glyphs[2]);
      pb.egg(px + 10, W + 2.4, pz + 1, 1.8, 1.3, 1.6, (x, y, z) => (hash(x, y, z) < 0.4 ? K('label') : K('cw1'))); // a sack
      for (let z = pz - 2; z <= pz + 2; z += 1) for (let x = px - 17; x <= px - 15; x += 1) if ((x + z) % 2 === 0 || z === pz) pb.put(x, W + 1, z, z % 2 ? K('rope1') : K('rope2'));
      pb.fill(px - 21, W + 3, pz + 5, px + 21, W + 3, pz + 5, (x) => (x % 7 === 0 ? K('w1') : K('w3'))); // the pole
      pb.fill(px + 15, W + 2, pz - 4, px + 15, W + 7, pz - 4, C.iron2);
      pb.fill(px + 15, W + 8, pz - 4, px + 15, W + 9, pz - 4, (x, y) => (y === W + 8 ? K('lit') : K('lit2')));
      pb.put(px + 15, W + 10, pz - 4, C.iron3);
      pb.put(px - 18, W + 2, pz - 2, C.iron3); // the bow ring

      built = { parts: {
        quay: b.part('quay', [0, 0, 0]),
        hook: hk.part('hook', [cx - 0.5, 28, zc + 13.5], b),
        punt: pb.part('punt', [px, W, pz]),
      } };
      return built;
    },
    idle({ parts: P, state: { t } }) {
      P.hook.rotation.z += 0.05 * Math.sin(t * 1.4);
      P.hook.rotation.x += 0.04 * Math.sin(t * 1.1 + 0.6);
      P.hook.rotation.y += 0.3 * Math.sin(t * 0.37);
      P.punt.position.y += 0.22 * Math.sin(t * 1.15);
      P.punt.rotation.z += 0.018 * Math.sin(t * 0.8);
      P.punt.rotation.x += 0.012 * Math.sin(t * 1.3 + 1);
    },
  };
}

// A self-check: node js/models/workshop.js (the storeys and yard hold every voxel of the shop; the spring overshoots and settles)
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const count = (g) => g.data.reduce((n, v) => n + (v ? 1 : 0), 0);
  for (const p of Object.values(PRODUCTS)) {
    const whole = count(buildShop({ props: [], ...p }).g), parts = buildParts({ props: [], ...p });
    const split = ['yard', 'body', 'upper', 'roof'].reduce((n, k) => n + count(parts[k].grid), 0);
    if (split !== whole) throw new Error(`${p.key}: the split lost ${whole - split} voxels`);
  }
  if (spring(0.3) < 1.1 || Math.abs(spring(3) - 1) > 1e-3) throw new Error('the spring should overshoot and settle');
  console.log('workshop.js ok');
}
