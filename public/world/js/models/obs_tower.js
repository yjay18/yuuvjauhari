// The Observatory's tower (research): a round stone tower in coursed lavender
// stone with circuit light in its mortar, arrow slits lit from inside, a door
// painted midnight blue with gold stars, a corbelled gallery with an iron rail,
// and on top a copper dome gone verdigris, split open, turning to follow its
// brass-and-crystal telescope. High over it a holographic star map turns and
// twinkles, and the telescope tracks one constellation across it: a rubber duck
// (the joke; the town's ducks get everywhere). An owl in cyber goggles keeps
// watch from the rail. At the foot, the astronomer's night: a stool, a table with
// a mug of tea going cold, an open notebook of glowing sketches, a basket of
// rolled star charts and one chart unrolled on the flags.
//
// tower() -> rig definition; TOWER holds where things are (model voxels).
// Parts: tower (stone, gallery, props) > dome > scope; map (ring and sky, leaning
// and turning) > twinkA, twinkB, duck; owl > owlHead > owlEyes; banner. ctx.wave() makes the sky answer
// a wave: a shooting star, the duck flares, the owl turns its head right round.
import { C, colour, hash, noise } from '../kit/voxel-kit.js';
import { box, tone, smooth, clamp01 } from './space.js';

const col = (name, hex, glow = false) => C[name] ?? colour(name, hex, glow);
for (const [n, hex, glow] of [
  // stone (a cool lavender grey), dressed stone, mortar, moss
  ['s1', 0xb9b4c4], ['s2', 0xa29db0], ['s3', 0x8c8799], ['s4', 0x747083], ['mortar', 0x39363f], ['q1', 0xd6d1dc], ['q2', 0xc4bece],
  ['moss1', 0x4d6a3a], ['moss2', 0x668747],
  // copper gone verdigris, bronze ribs, a brass highlight
  ['cu1', 0x2c7465], ['cu2', 0x3b8c77], ['cu3', 0x4fa48a], ['cu4', 0x6bbfa2], ['cuOld', 0x8a5a36], ['rib', 0x5a4128], ['brass3', 0xe4bf62],
  // timber, the door's paint
  ['w1', 0x3a2517], ['w2', 0x4f3421], ['w3', 0x6b4a2e], ['w4', 0x86603b], ['door1', 0x1f2a52], ['door2', 0x2b3a6c],
  // glow: circuits, runes, lit windows, the lens
  ['trace', 0x1fd2ea, true], ['via', 0xb6fbff, true], ['rune', 0x9f86ff, true], ['warm', 0xffc764, true], ['warm2', 0xffe6a8, true],
  ['lens1', 0xf4ffff, true], ['lens2', 0x9ff8ff, true], ['lens3', 0x8a7bff, true], ['gold', 0xffd76a, true],
  // the star map
  ['star1', 0xffffff, true], ['star2', 0xd6ecff, true], ['star3', 0x6f9fd0, true], ['line', 0x234f8a, true], ['ring', 0x6ff2ff, true], ['ring2', 0x6a5cc0, true], ['tick', 0x2a7fb0, true],
  ['duck1', 0xffe04a, true], ['duck2', 0xffa82a, true],
  // the owl
  ['owl1', 0x6b5540], ['owl2', 0xa9854f], ['owl3', 0xc9a46a], ['owlBelly', 0xeee3cc], ['owlBar', 0x9a7a52], ['owlDark', 0x3e3024], ['beak', 0xd9a441], ['talon', 0x4a3c30], ['strap', 0x4a2e1c],
  ['goggle', 0x7ff7ff, true], ['goggle2', 0xd8fdff, true],
  // the banner
  ['cloth1', 0x1c2450], ['cloth2', 0x263064], ['cloth3', 0x151b3c], ['fringe', 0xc49c3e],
  // the story at the foot
  ['paper1', 0xece2c8], ['paper2', 0xdccba9], ['ink', 0x3c3a52], ['chart', 0x1c2848], ['chart2', 0x26386a], ['chartStar', 0xcfe8ff, true],
  ['mug', 0xb8453a], ['mug2', 0x96372f], ['tea', 0x4a2a16], ['book1', 0x6e2a36], ['book2', 0x86324a], ['sketch', 0x7ff0ff, true],
]) col(`obs_${n}`, hex, glow);
export const K = (n) => C[`obs_${n}`];
export const STONE = [K('s1'), K('s2'), K('s2'), K('s3'), K('s3'), K('s4')];

// Where things are, in model voxels (the tower's centre on the ground at 0, 0; its door faces +z).
const DOME_Y = 60;
export const TOWER = {
  plinth: 16.6,
  pivot: [0, 63, 0.5], // the telescope's trunnions
  map: [0, 88, 0], mapR: 17, tilt: 0.55, mapYaw: 0.15, // the star map: its centre, radius, and how it leans (the district turns the tower 0.3 more, so it faces the town's camera)
  duck: [8, Math.PI], // the duck constellation on the map: radius, and its angle when the sky is at rest (the town's left, so the telescope shows its side)
  foot: [7, 13, 21, 25], // the story props: x0, z0, x1, z1
  top: 100,
  banner: [-0.3, 13.3, 49], // the banner: its angle round the shaft, how far out, where it hangs from
};
const RAD = (y) => (y < 12 ? 13.3 - (y - 3) * 0.13 : 12.1); // the shaft, battered at its foot
const mod = (a, n) => ((a % n) + n) % n;

// ---------------------------------------------------------------------------------------------
// The tower: plinth, shaft, door, slits, string courses, a rune band, the gallery, the drum, the props.
function towerGrid() {
  const b = box([-17, 0, -17], [22, 59, 26]);
  // ---- a round plinth in three steps of big slabs, a lighter nosing on each
  for (let y = 0; y <= 2; y += 1) {
    const R = TOWER.plinth - y;
    for (let z = -17; z <= 16; z += 1) for (let x = -17; x <= 16; x += 1) {
      const r = Math.hypot(x + 0.5, z + 0.5);
      if (r > R) continue;
      const a = Math.atan2(x + 0.5, z + 0.5), ring = Math.floor(r / 2.6);
      const segs = Math.max(6, Math.round((Math.PI * 2 * (ring * 2.6 + 1.3)) / 4.2)), u = mod((a / (Math.PI * 2) + 0.5) * segs + ring * 0.5, 1);
      const joint = r % 2.6 < 0.45 || u < 0.1;
      let id;
      if (r > R - 1) id = hash(x, y, z) < 0.3 ? K('q2') : K('q1');
      else if (joint) id = a > -0.9 && a < 0.9 && noise(x, z, 4, 3) > 0.64 ? K('trace') : K('mortar');
      else id = tone([K('s2'), K('s3'), K('s3'), K('s4')], ring, Math.floor(u * 10), Math.floor((a + 4) * segs), 1 + y);
      if (y === 0 && r > R - 1 && Math.abs(a) > 1.9 && noise(x, z, 3, 5) > 0.55) id = hash(x, z) < 0.5 ? K('moss1') : K('moss2');
      b.put(x, y, z, id);
    }
  }
  // ---- the shaft: courses of three over mortar, stones staggered, circuit light in the beds, moss at the back
  const T = (c, s, front) => hash(c * 31, Math.floor(s / 7), 5) < (front ? 0.12 : 0.05);
  for (let y = 3; y <= 58; y += 1) {
    const R = RAD(y);
    for (let z = -14; z <= 13; z += 1) for (let x = -14; x <= 13; x += 1) {
      const px = x + 0.5, pz = z + 0.5, r = Math.hypot(px, pz);
      if (r > R) continue;
      if (r < R - 1.8) { b.put(x, y, z, K('mortar')); continue; }
      const a = Math.atan2(px, pz), along = Math.floor((a + Math.PI) * 12.1);
      const row = y - 3, c = Math.floor(row / 3), bed = row % 3 === 2, s = along + (c % 2) * 3 + c;
      const front = Math.abs(a) < 1.3;
      let id;
      if (bed) id = T(c, s, front) ? (mod(s, 7) === 3 ? K('via') : K('trace')) : K('mortar');
      else if (mod(s, 5) === 0) id = T(c, s, front) && T(c - 1, s, front) ? K('trace') : K('mortar');
      else {
        id = STONE[Math.floor(hash(Math.floor(s / 5), c, 11) * STONE.length)];
        if (hash(x, y, z) < 0.09) id = STONE[Math.min(STONE.length - 1, STONE.indexOf(id) + 2)]; // weathered
        if (y < 9 && Math.abs(a) > 1.7 && noise(along, y * 2, 3.5, 2) > 0.48) id = hash(x, y, z) < 0.5 ? K('moss1') : K('moss2');
      }
      b.put(x, y, z, id);
    }
  }
  // ---- string courses of dressed stone, one voxel proud, a via now and then
  for (const y of [23, 39]) for (let z = -14; z <= 13; z += 1) for (let x = -14; x <= 13; x += 1) {
    const r = Math.hypot(x + 0.5, z + 0.5);
    if (r > 12.1 && r <= 13.2) b.put(x, y, z, hash(x, y, z) < 0.06 ? K('via') : hash(x, z, y) < 0.35 ? K('q2') : K('q1'));
  }
  // ---- a brass band with runes glowing in it
  for (const y of [46, 47]) for (let z = -14; z <= 13; z += 1) for (let x = -14; x <= 13; x += 1) {
    const r = Math.hypot(x + 0.5, z + 0.5);
    if (r <= 12.1 || r > 13.1) continue;
    const along = mod(Math.floor((Math.atan2(x + 0.5, z + 0.5) + Math.PI) * 12.6), 9);
    b.put(x, y, z, along === 4 || (along === 3 && y === 46) || (along === 5 && y === 47) ? K('rune') : along === 0 ? C.brass1 : hash(x, y, z) < 0.2 ? K('brass3') : C.brass2);
  }
  // ---- arrow slits climbing round with the stair inside: carved, lit, dressed jambs
  for (const [a0, y0] of [[0.95, 14], [-1.05, 27], [0.45, 41], [2.4, 20], [-2.3, 34]]) {
    for (let y = y0 - 1; y <= y0 + 7; y += 1) for (let z = -14; z <= 13; z += 1) for (let x = -14; x <= 13; x += 1) {
      const px = x + 0.5, pz = z + 0.5, r = Math.hypot(px, pz);
      const da = Math.atan2(px, pz) - a0, w = da * 12.1; // arc distance from the slit's centre line
      if (Math.abs(w) > 2.6 || r > 12.1 || r < 8.5) continue;
      const inSlit = Math.abs(w) <= 0.9 && y >= y0 && y <= y0 + 5 + (Math.abs(w) < 0.5 ? 1 : 0);
      if (inSlit) { if (r > 9.8) b.cut(x, y, z); else if (r > 8.8) b.put(x, y, z, y === y0 + 5 || hash(x, y, z) < 0.3 ? K('warm2') : K('warm')); }
      else if (r > 10.4 && (y === y0 - 1 || y === y0 + 7 || Math.abs(w) > 1.5)) b.put(x, y, z, (y + Math.floor(w + 3)) % 2 ? K('q1') : K('q2'));
    }
  }
  // ---- the door: an arch of voussoirs with a rune keystone, a planked leaf painted midnight blue with gold stars
  const inArch = (px, y) => Math.abs(px) <= 3.5 && (y <= 16 || px * px + (y + 0.5 - 17) ** 2 <= 3.6 * 3.6);
  for (let y = 3; y <= 24; y += 1) for (let z = 6; z <= 14; z += 1) for (let x = -7; x <= 6; x += 1) {
    const px = x + 0.5, pz = z + 0.5, r = Math.hypot(px, pz);
    if (r > 12.1) continue;
    if (inArch(px, y)) {
      if (r > 10.1) b.cut(x, y, z);
      else if (r > 9.1) {
        const plank = Math.floor((x + 4) / 2), star = [[-3, 8], [1, 11], [-1, 14], [2, 6], [-2, 18]].some(([sx, sy]) => sx === x && sy === y);
        b.put(x, y, z, star ? K('gold') : (x + 4) % 2 === 0 && x > -4 ? K('door1') : tone([K('door2'), K('door2'), K('door1')], plank, Math.floor(y / 4), 0, 6));
      }
      continue;
    }
    if (r <= 10.3) continue;
    const d = Math.hypot(px, y + 0.5 - 17);
    if (y >= 17 && d <= 5.6) {
      const v = Math.floor(((Math.atan2(y + 0.5 - 17, px) / Math.PI) * 9));
      b.put(x, y, z, v === 4 && d > 4.4 ? K('rune') : mod(Math.atan2(y + 0.5 - 17, px) / Math.PI * 9, 1) < 0.14 ? K('mortar') : v % 2 ? K('q1') : K('q2'));
    } else if (Math.abs(px) <= 5 && y <= 16) b.put(x, y, z, (y - 3) % 3 === 2 ? K('mortar') : Math.floor((y - 3) / 3) % 2 ? K('q1') : K('q2'));
  }
  // straps, a ring handle, a round grille lit from inside, a glowing crack under the leaf
  for (const y of [6, 13]) for (let x = -4; x <= 1; x += 1) b.put(x, y, 10, x % 2 ? C.iron3 : C.iron2);
  b.put(2, 10, 10, C.iron3); b.put(2, 9, 10, C.brass2);
  for (const [x, y, id] of [[-1, 16, 'warm'], [0, 16, 'warm2'], [-1, 17, 'warm2'], [0, 17, 'warm'], [-2, 16, 'iron'], [1, 16, 'iron'], [-1, 15, 'iron'], [0, 18, 'iron'], [-2, 17, 'iron'], [1, 17, 'iron'], [-1, 18, 'iron'], [0, 15, 'iron']]) b.put(x, y, 10, id === 'iron' ? C.iron2 : K(id));
  for (let x = -4; x <= 3; x += 1) b.put(x, 3, 10, K('warm'));
  // ---- the gallery: corbels, a slab floor, iron posts and rail with brass caps, a bead of light on some posts
  for (let z = -17; z <= 16; z += 1) for (let x = -17; x <= 16; x += 1) {
    const px = x + 0.5, pz = z + 0.5, r = Math.hypot(px, pz), along = mod(Math.floor((Math.atan2(px, pz) + Math.PI) * 13.5), 4);
    if (r > 12.1 && r <= 13.2 && along < 2) b.put(x, 50, z, K('q2'));
    if (r > 12.1 && r <= 14.2 && along < 2) b.put(x, 51, z, K('q1'));
    if (r > 12.1 && r <= 15.2) b.put(x, 52, z, r > 14.3 ? (hash(x, z) < 0.3 ? K('q2') : K('q1')) : tone([K('s2'), K('s3')], Math.floor(x / 3), 52, Math.floor(z / 3), 7));
    if (r > 14.1 && r <= 15.1) {
      const post = mod(Math.floor((Math.atan2(px, pz) + Math.PI) * 14.6), 6) === 0;
      if (post) { b.put(x, 53, z, C.iron2); b.put(x, 54, z, C.iron1); b.put(x, 55, z, C.iron2); b.put(x, 57, z, hash(x, z, 3) < 0.35 ? K('via') : C.brass2); }
      b.put(x, 56, z, post ? C.brass2 : C.iron1);
    }
  }
  // ---- the drum the dome turns on: stone, four round lit ports, a riveted brass track
  for (let y = 53; y <= 59; y += 1) for (let z = -13; z <= 12; z += 1) for (let x = -13; x <= 12; x += 1) {
    const px = x + 0.5, pz = z + 0.5, r = Math.hypot(px, pz);
    if (r > 11.6) { if (y === 59 && r <= 12.6) b.put(x, y, z, hash(x, z) < 0.18 ? C.brass1 : mod(x + z, 4) === 0 ? K('brass3') : C.brass2); continue; }
    if (r < 9.8) { b.put(x, y, z, y === 59 ? tone([K('w2'), K('w3')], Math.floor(x / 2), 0, z, 3) : K('mortar')); continue; }
    const a = Math.atan2(px, pz), port = [0.8, 2.37, -0.77, -2.35].some((q) => Math.hypot((a - q) * 11.6, y + 0.5 - 56) < 1.6);
    b.put(x, y, z, port ? (r > 10.8 ? K('warm') : K('warm2')) : y === 53 || y === 58 ? K('q2') : (y - 53) % 3 === 2 ? K('mortar') : STONE[Math.floor(hash(Math.floor(((a + 4) * 11.6 + (y > 55 ? 2 : 0)) / 4), y > 55 ? 1 : 0, 13) * STONE.length)]);
  }
  story(b);
  return b;
}

// ---- the story at the foot: a stool, a table with a mug and a notebook, a basket of charts, one unrolled
function story(b) {
  // a round table on a pedestal leg
  for (let z = 15; z <= 20; z += 1) for (let x = 9; x <= 14; x += 1) if (Math.hypot(x - 11.5, z - 17.5) <= 3) b.put(x, 7, z, Math.hypot(x - 11.5, z - 17.5) > 2.3 ? K('w2') : tone([K('w3'), K('w4'), K('w3')], x, 7, z, 2));
  b.fill(11, 1, 17, 12, 6, 18, (x, y) => (y === 3 ? C.iron2 : K('w1')));
  b.fill(10, 0, 16, 13, 0, 19, (x, y, z) => ((x === 10 || x === 13) && (z === 16 || z === 19) ? 0 : C.iron1));
  // the mug (tea gone cold, a handle) and the notebook, open, sketches of the sky glowing on its pages
  b.fill(9, 8, 16, 10, 10, 17, (x, y, z) => (y === 10 && x === 9 && z === 16 ? K('tea') : y === 10 ? K('mug2') : K('mug')));
  b.put(8, 9, 16, K('mug')); b.put(8, 9, 17, K('mug2'));
  b.fill(11, 8, 17, 14, 8, 20, (x, y, z) => (z === 17 || z === 20 || x === 11 || x === 14 ? K('book1') : 0));
  for (let z = 18; z <= 19; z += 1) for (let x = 11; x <= 14; x += 1) b.put(x, 8, z, x === 12 || x === 13 ? (x === 12 && z === 18 ? K('sketch') : K('paper1')) : K('paper2'));
  b.put(13, 8, 19, K('sketch')); b.put(12, 8, 19, K('ink'));
  b.put(14, 8, 16, K('w4')); b.put(13, 8, 16, C.iron2); // a pencil
  // a three-legged stool, a cushion
  for (const [x, z] of [[17, 15], [19, 15], [18, 17]]) b.fill(x, 0, z, x, 4, z, K('w1'));
  for (let z = 14; z <= 17; z += 1) for (let x = 16; x <= 19; x += 1) if (Math.hypot(x - 17.5, z - 15.5) <= 2.2) b.put(x, 5, z, (x + z) % 3 ? K('door2') : K('door1'));
  // a wicker basket of rolled charts, one unrolled on the ground, its stars glowing, a brass weight on its corner
  for (let y = 0; y <= 4; y += 1) for (let z = 20; z <= 24; z += 1) for (let x = 15; x <= 19; x += 1) {
    const r = Math.hypot(x - 17, z - 22);
    if (r <= 2.4 && (r > 1.5 || y === 0)) b.put(x, y, z, (x + y + z) % 2 ? K('w3') : K('w4'));
  }
  for (const [x, z, h] of [[16, 21, 9], [17, 22, 8], [18, 21, 7], [17, 23, 7], [18, 23, 6]]) for (let y = 1; y <= h; y += 1) b.put(x, y, z, y === h ? K('paper2') : (x + z) % 2 ? K('chart') : K('paper1'));
  for (let z = 19; z <= 25; z += 1) for (let x = 7; x <= 14; x += 1) {
    if (x > 12 && z < 21) continue;
    const edge = x === 7 || x === 14 || z === 25 || (z === 19 && x <= 12);
    b.put(x, 0, z, edge ? K('chart2') : hash(x, z, 17) < 0.14 ? K('chartStar') : (x + z) % 5 === 0 ? K('chart2') : K('chart'));
  }
  b.fill(7, 1, 19, 12, 1, 19, K('paper2')); // the curl where it wants to roll up again
  b.put(14, 1, 25, C.brass2);
}

// ---------------------------------------------------------------------------------------------
// The dome: a hemisphere of verdigris plates between bronze ribs, split front to back past the top,
// brass shutter rails either side of the slit, a riveted skirt, timber inside; the telescope's fork stands in it.
function domeGrid() {
  const b = box([-14, DOME_Y, -14], [13, DOME_Y + 14, 13]);
  for (let y = DOME_Y; y <= DOME_Y + 14; y += 1) for (let z = -14; z <= 13; z += 1) for (let x = -14; x <= 13; x += 1) {
    const px = x + 0.5, py = y + 0.5 - DOME_Y, pz = z + 0.5, d = Math.hypot(px, py, pz);
    const rail = Math.abs(px) > 4.2 && Math.abs(px) <= 5.6 && pz > -5;
    if (d > (rail ? 13.6 : 12.6) || d <= 10.9) continue;
    if (Math.abs(px) <= 4.2 && pz > -3.5) continue; // the slit
    if (y <= DOME_Y + 1 && d > 12) { const k = mod(Math.floor((Math.atan2(px, pz) + 4) * 12.6), 5); b.put(x, y, z, k === 0 ? (y === DOME_Y + 1 ? K('via') : K('brass3')) : C.brass1); continue; } // the skirt, its rivets alight
    if (rail) { b.put(x, y, z, d > 12.6 ? (mod(y, 4) === 0 ? K('brass3') : C.brass2) : C.iron2); continue; }
    if (d <= 11.7) { b.put(x, y, z, y === DOME_Y + 2 && mod(x + z, 3) === 0 ? K('warm') : tone([K('w1'), K('w2')], x, Math.floor(y / 2), z, 4)); continue; } // timber inside, a ring of little lamps
    const az = Math.atan2(px, pz), el = Math.atan2(py, Math.hypot(px, pz));
    const rib = Math.abs(mod((az / Math.PI) * 6, 1) - 0.5) > 0.44, seam = mod(el * 12, 1) < 0.12;
    const panel = hash(Math.floor(mod((az / Math.PI) * 6, 12)), Math.floor(el * 12), 21);
    let id = rib ? K('rib') : seam ? K('cu1') : [K('cu2'), K('cu3'), K('cu3'), K('cu4')][Math.floor(panel * 4)];
    if (!rib && hash(x, y, z) < 0.12) id = hash(x, z, y) < 0.5 ? K('cu1') : K('cu4'); // speckle
    if (!rib && !seam && noise(Math.floor(az * 30), y, 3, 7) > 0.74) id = K('cuOld'); // bare copper where the patina wore through
    b.put(x, y, z, id);
  }
  // the fork: two iron cheeks on a turntable, the trunnion bearings in brass
  for (const x of [-5, 4]) { b.fill(x, DOME_Y, -1, x, DOME_Y + 3, 0, C.iron2); b.put(x, DOME_Y + 3, -1, C.brass2); b.put(x, DOME_Y + 3, 0, K('brass3')); }
  b.fill(-5, DOME_Y, -2, 4, DOME_Y, 1, (x, y, z) => ((x + z) % 3 ? C.iron1 : C.iron3));
  // a crystal knob at the slit's far end
  b.fill(-1, DOME_Y + 12, -5, 0, DOME_Y + 12, -4, K('lens2')); b.put(-1, DOME_Y + 13, -5, K('lens1'));
  return b;
}

// The telescope, built lying along +z from its trunnions (the part tilts it up): a brass tube in banded
// sections, a glowing seam of circuit along its back, a finder scope, a dew shield round a crystal lens,
// an eyepiece and a counterweight behind.
function scopeGrid() {
  const [ox, oy] = TOWER.pivot, oz = 0; // the tube's axis runs through the pivot; the trunnions are the voxels at z 0
  const b = box([ox - 6, oy - 7, oz - 12], [ox + 5, oy + 7, oz + 27]);
  const BANDS = [-6, 0, 6, 12, 20];
  for (let z = -11; z <= 20; z += 1) for (let y = -6; y <= 6; y += 1) for (let x = -6; x <= 5; x += 1) {
    const r = Math.hypot(x + 0.5, y + 0.5);
    const shield = z >= 13, band = BANDS.includes(z);
    const R = z < -8 ? 1.4 : shield ? 3.9 : 3.2 + (band ? 0.6 : 0);
    if (r > R) continue;
    let id;
    if (z < -8) id = z === -11 ? C.iron3 : C.iron1; // the eyepiece
    else if (shield && r < 3) { if (z === 15) id = r < 1.3 ? K('lens1') : r < 2.2 ? K('lens2') : K('lens3'); else if (z > 15) continue; else id = C.iron1; }
    else if (r < R - 1.1) id = C.iron1;
    else if (band) id = mod(Math.floor(Math.atan2(y + 0.5, x + 0.5) * 4), 2) ? (z === 6 || z === 20 ? K('via') : K('trace')) : mod(Math.floor(Math.atan2(y, x) * 3), 3) === 0 ? K('brass3') : C.iron2; // bands of light, so it reads from any side
    else if (shield) id = hash(x, y, z) < 0.25 ? C.brass1 : C.iron2;
    else if (y >= 2 && Math.abs(x + 0.5) < 0.8 && z > 1 && z < 12) id = z % 3 ? K('trace') : K('via'); // the seam along its back
    else id = hash(x, y, Math.floor(z / 3)) < 0.08 ? C.brass1 : hash(x, y, z) < 0.45 ? K('brass3') : C.brass2;
    b.put(x + ox, y + oy, z + oz, id);
  }
  // trunnions, a counterweight, the finder on two brackets
  for (const x of [-6, -5, 4, 5]) b.put(x + ox, oy, oz, C.iron3);
  b.fill(ox - 2, oy - 6, oz - 7, ox + 1, oy - 4, oz - 3, (x, y, z) => ((x + y + z) % 3 ? C.iron1 : C.iron2));
  for (let z = 2; z <= 10; z += 1) for (let y = 4; y <= 6; y += 1) for (let x = 2; x <= 4; x += 1) {
    const r = Math.hypot(x - 2.5, y - 4.5);
    if (r <= 1.5) b.put(x + ox, y + oy, z + oz, z === 10 ? (r < 0.8 ? K('lens1') : K('lens2')) : z === 2 ? C.iron2 : K('brass3'));
  }
  for (const z of [3, 8]) { b.put(2 + ox, 3 + oy, z + oz, C.iron2); b.put(3 + ox, 3 + oy, z + oz, C.iron2); }
  // its sight line, dashed, fading toward what it is looking at
  for (const [z, id] of [[17, 'lens1'], [18, 'lens2'], [20, 'lens2'], [21, 'tick'], [23, 'tick'], [25, 'line'], [26, 'line']]) b.put(ox - 1, oy - 1, z + oz, K(id)), b.put(ox, oy - 1, z + oz, K(id)), b.put(ox - 1, oy, z + oz, K(id)), b.put(ox, oy, z + oz, K(id));
  return b;
}

// ---------------------------------------------------------------------------------------------
// The star map, lying in its own plane (the part leans it toward the town and turns it): a graduated ring,
// and inside it the sky: dim stars, constellations with their lines, bright stars in two sets that
// twinkle in turn, and the duck, in gold.
const CONST = [ // constellations: points (map voxels, x and z; the duck owns the -x side), then the lines between them by index
  { at: [[-7, -8], [-3.5, -9.5], [0, -8.5], [2.5, -10.5], [5, -8], [7.5, -9.5], [9.5, -6]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 4]] }, // a dipper
  { at: [[-5, 9], [-2.5, 12.5], [0, 9.5], [2.5, 13], [5, 10]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]] }, // a W
  { at: [[6.5, -3.5], [11.5, -3.5], [8.5, 0], [9.5, 0.3], [10.5, 0.6], [7.5, 3.5], [11.5, 3]], lines: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]] }, // a hunter
];
// The duck, facing along +u with its top toward -v, drawn at TOWER.duck upright as the town sees the sky at rest (its top toward the map's far side).
const DUCK = { at: [[-6.3, 0.9], [-3.6, 0], [0, 0.5], [0.9, -3.6], [3.6, -3.2], [5.9, -1.8], [2.7, -1.4], [4.5, 1.4], [0.9, 3.6], [-3.6, 3.6]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 0]], eye: [2.3, -2.2] };
function segment(b, [ax, az], [bx, bz], y, id, gap = 1.2) {
  const n = Math.ceil(Math.hypot(bx - ax, bz - az) * 2.5);
  for (let i = 0; i <= n; i += 1) {
    const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    if (Math.hypot(x - ax, z - az) < gap || Math.hypot(x - bx, z - bz) < gap) continue; // lines stop short of their stars
    b.put(Math.floor(x), y, Math.floor(z), id);
  }
}
const starAt = (b, [x, z], y, id, big) => {
  b.put(Math.floor(x), y, Math.floor(z), id);
  if (big) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.put(Math.floor(x) + dx, y, Math.floor(z) + dz, K('star3'));
};
function mapGrids() {
  const [, Y] = TOWER.map, R = TOWER.mapR;
  const sky = box([-R - 1, Y, -R - 1], [R, Y, R]), ring = sky, twA = box([-R, Y, -R], [R - 1, Y, R - 1]), twB = box([-R, Y, -R], [R - 1, Y, R - 1]);
  const duck = box([-R, Y, -R], [R - 1, Y, R - 1]);
  for (let z = -R - 1; z <= R; z += 1) for (let x = -R - 1; x <= R; x += 1) {
    const r = Math.hypot(x + 0.5, z + 0.5), a = Math.atan2(x + 0.5, z + 0.5);
    if (r > R - 0.5 && r <= R + 0.45) ring.put(x, Y, z, mod(Math.floor((a + Math.PI) * 20), 7) === 0 ? K('star2') : K('ring'));
    else if (r > R - 2 && r <= R - 0.6 && mod(Math.floor((a + Math.PI) * 20), 7) === 0) ring.put(x, Y, z, K('tick'));
    else if (r > R - 1.6 && r <= R - 0.6 && mod(Math.floor((a + Math.PI) * 20), 7) === 3) ring.put(x, Y, z, K('tick'));
  }
  starAt(sky, [0, 0], Y, K('star1'), true); // the pole star
  for (let i = 0; i < 18; i += 1) { // dim field stars (clear of the duck); a few join the twinklers
    const a = hash(i, 3) * Math.PI * 2, r = 2.5 + Math.sqrt(hash(i, 4)) * (R - 5), p = [Math.cos(a) * r, Math.sin(a) * r];
    if (p[0] < -1 && Math.abs(p[1]) < 5.5) continue;
    (i % 4 === 0 ? (i % 8 === 0 ? twA : twB) : sky).put(Math.floor(p[0]), Y, Math.floor(p[1]), i % 3 ? K('star3') : K('star2'));
  }
  CONST.forEach((c, k) => {
    for (const [p, q] of c.lines) segment(sky, c.at[p], c.at[q], Y, K('line'));
    c.at.forEach((p, i) => starAt((i + k) % 2 ? twA : twB, p, Y, i % 3 ? K('star2') : K('star1'), i === 0));
  });
  // the duck: its outline in gold lines, its stars, its eye
  const [dr, da] = TOWER.duck, cx = Math.cos(da) * dr, cz = Math.sin(da) * dr;
  const place = ([u, v]) => [cx + u, cz + v]; // u along x, its top toward -z
  for (const [p, q] of DUCK.lines) segment(duck, place(DUCK.at[p]), place(DUCK.at[q]), Y, K('duck2'), 0.9);
  DUCK.at.forEach((p, i) => starAt(duck, place(p), Y, K('duck1'), i === 3 || i === 5));
  starAt(duck, place(DUCK.eye), Y, K('star1'), false);
  return { sky, twA, twB, duck };
}

// The banner: midnight cloth on an iron rod with brass finials, a gold border, a crescent moon and a star
// worked in gold thread (alight at night), a swallowtail; it hangs flat against the shaft and stirs.
function bannerGrid() {
  const W = 3, L = 20;
  const b = box([-W - 2, -L, -1], [W + 2, 1, 0]);
  b.fill(-W - 1, 0, -1, W + 1, 0, -1, (x) => (x % 2 ? C.iron2 : C.iron1));
  for (const x of [-W - 2, W + 2]) { b.put(x, 0, -1, C.brass2); b.put(x, 1, -1, K('brass3')); }
  for (let y = -L; y <= -1; y += 1) for (let x = -W; x <= W; x += 1) {
    const v = -y;
    if (v > L - 4 && Math.abs(x) < v - (L - 4)) continue; // the swallowtail
    const moon = Math.hypot(x, v - 6.5) <= 2.6 && Math.hypot(x - 1.1, v - 5.9) > 2.1;
    const star = (Math.abs(x) + Math.abs(v - 12.5) <= 1.5) || (Math.abs(x) === 1 && Math.abs(v - 12.5) === 1);
    let id;
    if (Math.abs(x) === W || v === 1) id = hash(x, v, 5) < 0.25 ? K('brass3') : K('fringe');
    else if (moon || star) id = K('gold');
    else if (v === 9 || v === 16) id = (x + v) % 2 ? K('fringe') : K('cloth3'); // stitched bands
    else id = tone([K('cloth1'), K('cloth2'), K('cloth1'), K('cloth3')], x, Math.floor(v / 2), 0, 3);
    b.put(x, y, 0, id);
  }
  return b;
}

// ---------------------------------------------------------------------------------------------
// The owl: round and barred, wings folded, talons round the rail, tail over it; a head with ear tufts
// and a hooked beak under brass goggles whose lenses glow (and blink).
export const OWL = { a: -0.62, r: 14.8, y: 57 };
function owlGrids() {
  const body = box([-5, 0, -5], [4, 10, 4]);
  body.egg(0, 4.6, 0, 4.1, 4.8, 3.6, (x, y, z) => {
    if (z >= 1 && Math.abs(x + 0.5) < 2.9 && y < 8) return hash(x, y, z) < 0.12 ? K('owlBar') : K('owlBelly'); // a pale, speckled breast
    const wing = Math.abs(x + 0.5) > 2.9;
    if (wing) return (y + z) % 3 === 0 ? K('owl1') : hash(x, y, z) < 0.2 ? K('owlBelly') : K('owl3'); // folded wings, flecked
    return tone([K('owl2'), K('owl3'), K('owl3')], x, y, z, 5);
  });
  for (const x of [-2, 1]) { body.put(x, 0, 2, K('talon')); body.put(x, 0, 3, K('beak')); body.put(x, 0, -1, K('talon')); } // talons round the rail
  body.fill(-1, 0, -5, 0, 3, -4, (x, y) => (y % 2 ? K('owl1') : K('owl3'))); // the tail over the back of the rail
  const head = box([-5, 8, -4], [4, 17, 4]);
  head.egg(0, 12, 0, 4.2, 3.6, 3.5, (x, y, z) => (z >= 2 ? K('owlBelly') : tone([K('owl2'), K('owl3'), K('owl3')], x, y, z, 8)));
  for (let y = 9; y <= 15; y += 1) for (let x = -4; x <= 3; x += 1) { // the heart-shaped face, rimmed in tan
    const u = Math.abs(x + 0.5), v = y - 12;
    if (u > 3.4 || (v > 2 && u < 1.2 - (v - 2.5)) ) continue;
    const rim = u > 2.6 || v <= -3 || (v >= 2 && u > 1.8);
    if (rim) head.put(x, y, 3, K('owl3'));
  }
  head.put(-1, 11, 4, K('beak')); head.put(0, 11, 4, K('beak')); head.put(-1, 10, 4, K('beak')); head.put(0, 10, 3, K('beak'));
  for (let x = -5; x <= 4; x += 1) head.put(x, 13, x < -3 || x > 2 ? 0 : -4, K('strap')); // the goggles' strap round the back
  for (const cx of [-2.4, 1.4]) for (let y = 11; y <= 15; y += 1) for (let x = -5; x <= 4; x += 1) {
    const r = Math.hypot(x + 0.5 - cx, y + 0.5 - 13.2);
    if (r > 1.45 && r <= 2.3) head.put(x, y, 4, hash(x, y) < 0.35 ? K('brass3') : C.brass2); // rims
  }
  head.put(-1, 13, 4, C.brass2); head.put(0, 13, 4, C.brass2); // the bridge
  const eyes = box([-5, 11, 4], [4, 15, 4]);
  for (const cx of [-2.4, 1.4]) for (let y = 11; y <= 15; y += 1) for (let x = -5; x <= 4; x += 1) {
    const r = Math.hypot(x + 0.5 - cx, y + 0.5 - 13.2);
    if (r <= 1.45) eyes.put(x, y, 4, r < 0.7 ? K('goggle2') : K('goggle'));
  }
  return { body, head, eyes };
}

// ---------------------------------------------------------------------------------------------
let built;
function buildParts() {
  const tower = towerGrid(), dome = domeGrid(), scope = scopeGrid();
  const { sky, twA, twB, duck } = mapGrids();
  const [mx, my, mz] = TOWER.map;
  const o = owlGrids();
  const ox = Math.sin(OWL.a) * OWL.r, oz = Math.cos(OWL.a) * OWL.r;
  const domePart = dome.part('dome', [0, DOME_Y, 0]);
  const [ba, br, by] = TOWER.banner;
  const mapPart = sky.part('map', [mx, my, mz]);
  const owlPart = o.body.part('owl', [0, 0, 0]);
  const headPart = o.head.part('owlHead', [0, 9.5, 0], o.body);
  return {
    tower: tower.part('tower', [0, 0, 0]),
    dome: domePart,
    scope: scope.part('scope', TOWER.pivot, dome),
    map: mapPart,
    twinkA: twA.part('twinkA', [mx, my, mz], sky),
    twinkB: twB.part('twinkB', [mx, my, mz], sky),
    duck: duck.part('duck', [mx, my, mz], sky),
    owl: { ...owlPart, at: [ox, OWL.y, oz] },
    owlHead: headPart,
    owlEyes: o.eyes.part('owlEyes', [0, 13.2, 4.5], o.head),
    banner: { ...bannerGrid().part('banner', [0, 0.5, -0.5]), at: [Math.sin(ba) * br, by, Math.cos(ba) * br] },
  };
}

// Its own copy of the glow material for each named part, so each can brighten and dim on its own.
function ownGlow(ctx, names) {
  return names.map((n) => {
    const m = new ctx.THREE.MeshBasicMaterial({ vertexColors: true });
    ctx.parts[n].traverse((o) => { if (o.isMesh && o.material.isMeshBasicMaterial) o.material = m; });
    return m;
  });
}
// The sky's turn: slow, and slower still while the duck is on the town's side, so the telescope mostly faces it.
const skyTurn = (t) => { const p = t * 0.07; return p - 0.62 * Math.sin(p); };

export function tower() {
  return {
    gait: 'still',
    info: TOWER,
    build() { if (!built) built = { parts: buildParts() }; return built; },
    setup(ctx) {
      const { THREE, parts: P, mem } = ctx;
      mem.up = new THREE.Vector3(0, 1, 0);
      P.banner.rotation.order = 'YXZ';
      mem.lean = new THREE.Quaternion().setFromEuler(new THREE.Euler(TOWER.tilt, TOWER.mapYaw, 0, 'YXZ'));
      mem.turn = new THREE.Quaternion();
      mem.glow = ownGlow(ctx, ['twinkA', 'twinkB', 'duck']);
      mem.v = new THREE.Vector3();
      mem.e = new THREE.Euler(TOWER.tilt, TOWER.mapYaw, 0, 'YXZ');
      mem.az = null; mem.el = 1.1;
      mem.waveAt = -10; mem.spinAt = -10; mem.steamAt = 0;
      // the sky answers a wave: a shooting star across the map, the duck flares, the owl turns its head right round
      ctx.wave = () => { mem.waveAt = ctx.state.t; mem.spinAt = ctx.state.t + 0.5; };
    },
    idle(ctx, dt) {
      const { parts: P, state: { t }, mem } = ctx;
      const V = ctx.voxel;
      // ---- the star map leans toward the town and turns; its stars twinkle in two sets; the duck glows warm
      const spin = skyTurn(t);
      P.map.quaternion.copy(mem.lean).multiply(mem.turn.setFromAxisAngle(mem.up, spin));
      P.map.position.y += 0.6 * Math.sin(t * 0.5);
      const w = t - mem.waveAt, flare = w > 0.6 && w < 3.2 ? Math.sin(Math.PI * (w - 0.6) / 2.6) : 0;
      mem.glow[0].color.setScalar(0.35 + 0.65 * Math.max(0, Math.sin(t * 1.9)) ** 2 + 0.05 * Math.sin(t * 17));
      mem.glow[1].color.setScalar(0.35 + 0.65 * Math.max(0, Math.sin(t * 1.9 + 2.2)) ** 2 + 0.05 * Math.sin(t * 13));
      mem.glow[2].color.setScalar(0.8 + 0.2 * Math.sin(t * 2.4) + 0.9 * flare);
      P.duck.scale.setScalar(1 + 0.08 * flare);
      // ---- the banner stirs
      P.banner.rotation.set(0.05 + 0.04 * Math.sin(t * 1.1) + 0.015 * Math.sin(t * 2.9), TOWER.banner[0], 0.02 * Math.sin(t * 0.8));
      // ---- the telescope tracks the duck: where it is on the turned, leaning map, as seen from the trunnions
      const [dr, da] = TOWER.duck;
      mem.v.set(Math.cos(da) * dr, 0, Math.sin(da) * dr).applyAxisAngle(mem.up, spin).applyEuler(mem.e);
      const dx = mem.v.x + TOWER.map[0] - TOWER.pivot[0], dy = mem.v.y + TOWER.map[1] - TOWER.pivot[1], dz = mem.v.z + TOWER.map[2] - TOWER.pivot[2];
      const az = Math.atan2(dx, dz), el = Math.atan2(dy, Math.hypot(dx, dz));
      if (mem.az === null) mem.az = az;
      const k = 1 - Math.exp(-dt * 1.6);
      mem.az += Math.atan2(Math.sin(az - mem.az), Math.cos(az - mem.az)) * k;
      mem.el += (el - mem.el) * k;
      P.dome.rotation.y = mem.az;
      P.scope.rotation.x = -mem.el + 0.012 * Math.sin(t * 7) * clamp01(1 - Math.abs(az - mem.az) * 4); // a fine hunt as it settles
      // ---- the owl: holds a look, then snaps its head to the next; blinks its goggles; a full turn when asked
      const look = Math.floor(t / 2.7), lu = t - look * 2.7;
      const from = (hash(look, 5) - 0.5) * 2.4, to = (hash(look + 1, 5) - 0.5) * 2.4;
      let head = from + (to - from) * smooth(lu / 0.25);
      const sp = t - mem.spinAt;
      if (sp > 0 && sp < 1.4) head += Math.PI * 2 * smooth(sp / 1.4);
      P.owlHead.rotation.y = head + 0.4;
      P.owlHead.rotation.z = 0.12 * Math.sin(t * 0.8) + (hash(look, 9) < 0.3 ? 0.25 * smooth(lu / 0.3) : 0); // the odd quizzical tilt
      P.owl.rotation.y = OWL.a + 0.3;
      P.owl.scale.set(1 + 0.03 * Math.sin(t * 1.3), 1 + 0.04 * Math.sin(t * 1.3), 1 + 0.03 * Math.sin(t * 1.3)); // breathing
      const blink = mod(t, 4.3) < 0.14 || (mod(t, 4.3) > 0.3 && mod(t, 4.3) < 0.4);
      P.owlEyes.scale.y = blink ? 0.1 : 1;
      // ---- a wave: a shooting star streaks over the map
      if (w > 0.35 && w < 0.4 && !mem.shot) {
        mem.shot = true;
        const s = (a, h) => [Math.sin(a) * 30 * V, (TOWER.map[1] + h) * V, Math.cos(a) * 30 * V];
        const [x0, y0, z0] = s(-0.9, 14), [x1, y1, z1] = s(1.7, 4);
        for (let i = 0; i < 16; i += 1) ctx.bit(x0, y0, z0, (x1 - x0) / 1.1 * (1 - i * 0.025), (y1 - y0) / 1.1 - i * 0.04, (z1 - z0) / 1.1, 1.15 - i * 0.04, 0.26 - i * 0.013, i < 3 ? 0xffffff : 0xd6ecff, 0x6ff2ff);
      }
      if (w > 1.1 && w < 1.15 && !mem.spark) { // the duck, spotted, flares gold
        mem.spark = true;
        ctx.burst({ x: (mem.v.x + TOWER.map[0]) * V, y: (mem.v.y + TOWER.map[1]) * V, z: (mem.v.z + TOWER.map[2]) * V }, 22, 2.2, [0xfff4b0, 0xffb02e], 0.1, 1.1);
      }
      if (w > 1.5) mem.spark = false;
      if (w > 1) mem.shot = false;
      // ---- tea going cold: a wisp now and then
      if (t > mem.steamAt) {
        mem.steamAt = t + 0.9 + hash(Math.floor(t * 10), 2) * 0.8;
        ctx.bit(9.5 * V, 10.6 * V, 16.5 * V, 0.03, 0.28, 0.02, 2.2, 0.05, 0xf4f1ea, 0x9aa0b8, { grow: 1.6 });
      }
    },
    act(ctx) { ctx.wave(); },
  };
}

// ---------------------------------------------------------------------------------------------
// The garden orrery on the lawn before the door: a stone foot, a fluted column with a brass band, a dashed
// ring of light for the planets' path, a sun on a rod, and two planets on brass arms going round at their
// own speeds (the outer one ringed, a little moon over it).
export function orrery() {
  let made;
  return {
    gait: 'still',
    build() {
      if (made) return made;
      const base = box([-7, 0, -7], [6, 11, 6]);
      base.fill(-4, 0, -4, 3, 0, 3, (x, y, z) => (Math.hypot(x + 0.5, z + 0.5) > 4.2 ? 0 : Math.hypot(x + 0.5, z + 0.5) > 3.3 ? (hash(x, z) < 0.3 ? K('q2') : K('q1')) : tone(STONE, x, 0, z, 6)));
      for (let y = 1; y <= 6; y += 1) for (let z = -2; z <= 1; z += 1) for (let x = -2; x <= 1; x += 1) {
        const r = Math.hypot(x + 0.5, z + 0.5);
        if (r > 1.9) continue;
        base.put(x, y, z, y === 4 ? C.brass2 : y === 6 ? K('q1') : (x + z) % 2 ? K('s2') : K('s3')); // fluted, banded, capped
      }
      for (let z = -7; z <= 6; z += 1) for (let x = -7; x <= 6; x += 1) { // the planets' path, dashed light on four brass spokes
        const r = Math.hypot(x + 0.5, z + 0.5), a = Math.atan2(x + 0.5, z + 0.5);
        if (r > 6 && r <= 6.9 && mod(Math.floor((a + Math.PI) * 5), 2) === 0) base.put(x, 7, z, K('ring2'));
        if (r <= 6.3 && r > 1.4 && (Math.abs(x + 0.5) < 0.6 || Math.abs(z + 0.5) < 0.6)) base.put(x, 6, z, C.brass1);
      }
      base.fill(-1, 7, -1, 0, 8, 0, K('brass3'));
      base.egg(0, 10, 0, 1.7, 1.7, 1.7, (x, y, z) => (Math.hypot(x + 0.5, y + 0.5 - 10, z + 0.5) < 1 ? C.hot : C.fire4)); // the sun
      const inner = box([-4, 8, -1], [3, 9, 0]); // a small blue world close in
      inner.fill(0, 8, -1, 2, 8, -1, C.brass2);
      inner.fill(2, 8, -1, 3, 9, 0, (x, y, z) => ((x + y + z) % 3 ? K('ring') : K('lens1')));
      const outer = box([-7, 7, -1], [0, 11, 1]); // a ringed violet world further out, its moon
      outer.fill(-5, 9, 0, -1, 9, 0, C.brass2);
      outer.egg(-5.5, 9.5, 0.5, 1.4, 1.4, 1.4, (x, y) => (y === 9 ? K('rune') : K('lens3')));
      for (const [x, z] of [[-7, 0], [-4, 0], [-6, -1], [-5, 1], [-6, 1], [-5, -1]]) outer.put(x, 9, z, K('gold'));
      outer.put(-6, 11, 0, K('star2'));
      made = { parts: { base: base.part('base', [0, 0, 0]), inner: inner.part('inner', [0, 8.5, 0]), outer: outer.part('outer', [0, 9.5, 0.5]) } };
      return made;
    },
    idle({ parts: P, state: { t } }) {
      P.inner.rotation.y = t * 0.9;
      P.outer.rotation.y = -1.3 + t * 0.35;
      P.outer.position.y += 0.3 * Math.sin(t * 0.7);
    },
  };
}

// A self-check: node js/models/obs_tower.js (the parts build, the sky turns forward, the duck sits on the map)
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const { parts } = tower().build();
  const count = (g) => g.data.reduce((n, v) => n + (v ? 1 : 0), 0);
  for (const [n, p] of Object.entries(parts)) if (!count(p.grid)) throw new Error(`${n} is empty`);
  for (let t = 0; t < 200; t += 0.5) if (skyTurn(t + 0.5) <= skyTurn(t)) throw new Error('the sky turned back');
  const [dr, da] = TOWER.duck, far = Math.max(...DUCK.at.map(([u, v]) => Math.hypot(Math.cos(da) * dr + u, Math.sin(da) * dr + v)));
  if (far > TOWER.mapR - 2) throw new Error(`the duck runs into the map's ring (${far.toFixed(1)})`);
  console.log('obs_tower.js ok', Object.fromEntries(Object.entries(parts).map(([n, p]) => [n, count(p.grid)])));
}
