// The Academy (education): a small academic quarter, two landmarks facing a shared quad.
// Trinity College Dublin's Campanile stands on the path in from the bridge, a granite range with a gate
// tower behind it; The Mother's International School's light blue hall stands across the quad, its MINET
// robot trundling round the yard. The quad: lawns round a cobbled cross with clipped box hedges at its
// corners, two lamps, benches. A screen by each landmark plays the 2D site's painted clip of it.
// Yuuv wears his mortarboard while he is here. At each landmark he looks up and points, it answers (the
// bell rings out a ripple of light; the clock chimes, the dove's ring flashes and the robot spins), then
// he cheers, throws his cap up and catches it, and turns round to us.
// Stories at the foot: a stack of books with an apple and a satchel at the Campanile's steps; a
// chalkboard of glowing formula squiggles in the school yard, a school bag, marigolds along the verandah.
// Two ways in: through the range's gate from the north, and from the Grand Stair's street on the east, between
// two granite gate piers with gold lanterns on their caps and a clipped hedge running on from each, and a path
// down the yard's side into the quad.
// The joke: one of the Campanile's four statues is dressed for graduation, in a black hoodie and a
// mortarboard, diploma raised in a cheer.
import { C, colour, hash } from '../kit/voxel-kit.js';
import { box, tone, smooth, clamp01 } from '../models/space.js';
import { lampDef, LAMP_ORB } from '../models/island.js';
import { tree } from '../models/props.js';
import { campanile, range, CAMPANILE } from '../models/acad_trinity.js';
import { school, robot } from '../models/acad_school.js';

const col = (n, hex, glow = false) => C[n] ?? colour(n, hex, glow);
for (const [n, hex, glow] of [
  ['hedge1', 0x2c5424], ['hedge2', 0x3b6b2c], ['hedge3', 0x4f8336],
  ['seat1', 0x8a6440], ['seat2', 0x9c7650], ['seat3', 0x6f4f32],
  ['bk1', 0x8e2a26], ['bk2', 0x2f5a3a], ['bk3', 0x2c4a7a], ['bk4', 0xb08a3a], ['bk5', 0x5a2a4a], ['pages', 0xefe6cf], ['gilt', 0xd9b24a],
  ['apple', 0xc8322c], ['apple2', 0xe0503a], ['leaf', 0x5e9140],
  ['sat1', 0x7a4a2a], ['sat2', 0x6a3f26], ['sat3', 0x8e5a34], ['buckle', 0xd9b24a],
  ['slate', 0x22332b], ['slate2', 0x2a3d33], ['chalk', 0xe8fff0, true], ['chalk2', 0x9ff8ff, true], ['chalk3', 0xffe6a8, true],
  ['bag1', 0x3669a8], ['bag2', 0x2d5b95], ['zip', 0xe6dbbe],
  ['pot1', 0x9a5a3c], ['pot2', 0x86492f], ['mari1', 0xff9a1f], ['mari2', 0xffc23a], ['mstem', 0x437033],
  ['fr1', 0xdcd7cc], ['fr2', 0xcac5b9], ['frg', 0x3d3b39], ['fgold', 0xffc764, true], ['fgold2', 0xfff0b8, true],
  ['blue1', 0x3669a8], ['blue2', 0x2d5b95], ['cream', 0xf3ead3], ['cream2', 0xe6dbbe], ['back', 0x16181f],
]) col(`acad_${n}`, hex, glow);
const K = (n) => C[`acad_${n}`];

// Where things stand (island units; the quad's small things in voxels).
const V = 0.15;
const TRIN = [-5.7, 1.8]; // the Campanile, on the path in from the bridge
const RANGE = [-5.7, -4.8]; // the range behind it, its gate on the same line
const SCHOOL = [5.4, -1.5]; // the school hall
const ROBOT = [7.3, 2.3]; // the middle of the robot's round
const CROSS = [-3, 50]; // voxels: the middle of the quad
const LAMPS = [[0.9, 5.2]]; // in the gap between the landmarks as the camera sees them
const TREES = [[-11.8, -1.5, 1], [9.9, 6.2, 2], [10.8, -4.8, 1]]; // the Quarter's trees (same keys, shared meshes); one by the east gate
const SCREENS = { trinity: [-8.6, 5.9, 0.62], mothers: [1.5, 2.2, 0.28] }; // x, z, turn
const BENCHES = [[18, 64], [-24, 64]]; // voxels, both looking back at the landmarks
const CHALK = [58, 24]; // voxels: the chalkboard's left leg, its foot (in the yard, clear of the way in from the east gate)
const GATE = [[80, 3], [79, 24]]; // voxels: the east gate's two piers, either side of where the street comes in
const clip = (item) => (item?.media ? `../reel/${item.media.mp4}` : null);
const poster = (item) => (item?.media?.poster ? `../reel/${item.media.poster}` : null);

// ---- the quad's small things, one grid in island voxels: box hedges, benches, the books and satchel at the
// Campanile's steps, the chalkboard and a school bag, marigolds along the verandah
function quadGrid() {
  const b = box([-60, 0, -2], [80, 16, 70]);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { // clipped box hedges round the cross
    const cx = CROSS[0] + sx * 10, cz = CROSS[1] + sz * 9;
    for (let y = 0; y <= 3; y += 1) for (let z = -2; z <= 2; z += 1) for (let x = -2; x <= 2; x += 1) {
      if ((Math.abs(x) === 2 && Math.abs(z) === 2) || (y === 3 && (Math.abs(x) === 2 || Math.abs(z) === 2))) continue;
      b.put(cx + x, y, cz + z, y === 3 || hash(x, y, z + cx) > 0.72 ? K('hedge3') : y === 0 ? K('hedge1') : tone([K('hedge1'), K('hedge2'), K('hedge2')], x, y, z, cx));
    }
  }
  // benches: timber slats on iron ends (bench-local voxels facing +z, turned by quarter turns)
  const bench = (ox, oz, turn) => {
    const P = (x, y, z, id) => { const [X, Z] = [[x, z], [z, -x], [-x, -z], [-z, x]][turn]; b.put(X + ox, y, Z + oz, id); };
    for (const x of [-6, 5]) for (let y = 0; y <= 8; y += 1) for (const z of [-2, 1]) if (y <= 4 || z === -2) P(x, y, z, y === 4 ? C.iron3 : C.iron2);
    for (let x = -7; x <= 6; x += 1) {
      for (let z = -2; z <= 2; z += 1) P(x, 4, z, z === 0 ? K('seat3') : tone([K('seat1'), K('seat2')], x, 4, z, 2));
      P(x, 6, -3, K('seat1')); P(x, 8, -3, K('seat2'));
    }
  };
  for (const [x, z] of BENCHES) bench(x, z, 2);
  // at the Campanile's front steps: a stack of books with an apple on it, one lying open, a satchel
  const [bx, bz] = [-53, 31];
  [[0, 3, 'bk1'], [1, 2, 'bk3'], [0, 3, 'bk2'], [1, 2, 'bk4'], [0, 3, 'bk5']].forEach(([x0, w, c], i) => {
    for (let x = x0; x <= x0 + w; x += 1) for (let z = 0; z <= 2; z += 1) b.put(bx + x, i, bz + z, z === 2 && x > x0 && x < x0 + w ? K('pages') : x === x0 && i === 3 ? K('gilt') : K(c));
  });
  b.put(bx + 1, 5, bz + 1, K('apple')); b.put(bx + 2, 5, bz + 1, K('apple2')); b.put(bx + 1, 6, bz + 1, K('apple')); b.put(bx + 1, 7, bz + 1, K('leaf'));
  for (let x = 5; x <= 8; x += 1) b.put(bx + x, 0, bz + 1, x < 7 ? K('bk3') : K('pages')); // one lying open, face down
  for (let y = 0; y <= 4; y += 1) for (let x = -5; x <= -2; x += 1) for (let z = 0; z <= 2; z += 1) {
    if (z === 0 && y < 4) continue;
    b.put(bx + x, y, bz + z, y === 4 || (z === 2 && y >= 2) ? (x === -4 && y === 3 ? K('buckle') : K('sat2')) : tone([K('sat1'), K('sat3')], x, y, z, 5));
  }
  for (const [x, y] of [[-5, 5], [-4, 6], [-3, 6], [-2, 5]]) b.put(bx + x, y, bz + 1, K('sat2')); // the strap
  // marigolds in clay pots along the verandah
  for (const px of [11, 19, 28, 44, 52, 60]) {
    for (let y = 0; y <= 2; y += 1) for (let z = 1; z <= 3; z += 1) for (let x = px - 1; x <= px + 1; x += 1) b.put(x, y, z, y === 2 ? K('pot1') : K('pot2'));
    for (let z = 0; z <= 4; z += 1) for (let x = px - 2; x <= px + 2; x += 1) {
      const r = Math.hypot(x - px, z - 2);
      if (r > 2.3) continue;
      b.put(x, 3, z, hash(x, z, 3) < 0.45 ? K('mstem') : hash(x, z, 4) < 0.5 ? K('mari1') : K('mari2'));
      if (r < 1.3) b.put(x, 4, z, hash(x, z, 5) < 0.5 ? K('mari1') : K('mari2'));
    }
  }
  // the chalkboard on its easel, glowing marks that are sums and not words: a curve on axes, a root, triangles
  const SQUIG = [
    '#.........', '#...##....', '#..#..#...', '#.#....#..', '##......#.', '#########.', '..........',
    '...#......', '#.#.#####.', '.#........', '..........', '.#....#...', '#.#..#.#..', '###.#####.',
  ];
  const [cx0, cz0] = CHALK;
  for (let y = 0; y <= 17; y += 1) {
    const zb = cz0 - Math.floor((y * 3) / 17); // the board leans back
    for (let x = cx0; x <= cx0 + 11; x += 1) {
      const leg = x === cx0 || x === cx0 + 11;
      if (y <= 2 && !leg) continue;
      const edge = leg || y === 3 || y === 17;
      const gi = x - cx0 - 1, gj = 16 - y;
      const mark = !edge && SQUIG[gj]?.[gi] === '#';
      b.put(x, y, zb, edge ? (y === 17 ? C.wood3 : C.wood2) : mark ? (gj >= 11 ? K('chalk2') : gj >= 7 ? K('chalk3') : K('chalk')) : (x + y) % 5 ? K('slate') : K('slate2'));
    }
    if (y <= 15) for (const x of [cx0, cx0 + 11]) b.put(x, y, cz0 - 4 + Math.floor((y * 3) / 17), C.wood1); // the back legs
  }
  b.put(cx0 + 2, 3, cz0 + 1, K('chalk')); b.put(cx0 + 3, 3, cz0 + 1, K('chalk2')); // chalk on the ledge
  for (let y = 0; y <= 5; y += 1) for (let x = cx0 + 4; x <= cx0 + 7; x += 1) for (let z = cz0 + 3; z <= cz0 + 5; z += 1) { // a school bag
    if (y === 5 && (x === cx0 + 4 || x === cx0 + 7)) continue;
    b.put(x, y, z, z === cz0 + 5 && y >= 1 && y <= 3 && x > cx0 + 4 && x < cx0 + 7 ? (y === 3 ? K('zip') : K('bag2')) : tone([K('bag1'), K('bag1'), K('bag2')], x, y, z, 6));
  }
  b.put(cx0 + 5, 6, cz0 + 4, K('bag2')); b.put(cx0 + 6, 6, cz0 + 4, K('bag2'));
  return b;
}
const quad = { gait: 'still', build: () => ({ parts: { quad: quadGrid().part('quad', [0, 0, 0]) } }) };

// ---- the east gate, in island voxels: two granite piers in courses (circuit light in some joints, damp at the foot)
// under dressed caps and gold lanterns, a clipped hedge running on from each (north to the school's line, south
// along the rim)
function gateGrid() {
  const b = box([74, 0, -14], [84, 30, 38]);
  const G = [K('g1'), K('g2'), K('g2'), K('g3'), K('g4')];
  for (const [px, pz] of GATE) {
    b.fill(px - 3, 0, pz - 3, px + 2, 1, pz + 2, (x, y, z) => (y === 1 && Math.min(x - px + 3, px + 2 - x, z - pz + 3, pz + 2 - z) === 0 ? K('d2') : tone([K('g4'), K('g5'), K('damp')], x, y, z, 21)));
    b.fill(px - 2, 2, pz - 2, px + 1, 19, pz + 1, (x, y, z) => {
      const row = y - 2, along = x + z, c = Math.floor(row / 3);
      if (row % 3 === 2) return hash(Math.floor((along + c * 3 + 40) / 3), c, 5) < 0.25 ? K('trace') : K('gj');
      if ((along + 40 + (c % 2) * 2) % 4 === 0) return K('gj');
      return y < 5 && hash(x, y, z) < 0.3 ? K('damp') : G[Math.floor(hash(Math.floor((along + 40 + (c % 2) * 2) / 4), c, 23) * G.length)];
    });
    b.fill(px - 3, 20, pz - 3, px + 2, 20, pz + 2, (x, y, z) => ((x + z) % 5 === 0 ? K('d2') : K('d1'))); // the cap: a dressed slab
    b.fill(px - 2, 21, pz - 2, px + 1, 21, pz + 1, K('d2'));
    b.fill(px - 1, 22, pz - 1, px, 22, pz, K('d1'));
    // the lantern: an iron cage, a gold light in it, a brass cap and finial
    for (let y = 23; y <= 27; y += 1) for (let z = pz - 2; z <= pz + 1; z += 1) for (let x = px - 2; x <= px + 1; x += 1) {
      const edge = (x === px - 2 || x === px + 1) && (z === pz - 2 || z === pz + 1);
      if (y === 23 || y === 27) b.put(x, y, z, y === 27 ? C.brass2 : C.iron2);
      else if (edge) b.put(x, y, z, C.iron1);
      else if (x > px - 2 && x < px + 1 && z > pz - 2 && z < pz + 1) b.put(x, y, z, y === 25 ? K('fgold2') : K('fgold'));
    }
    b.put(px - 1, 28, pz - 1, C.brass1); b.put(px - 1, 29, pz - 1, K('fgold2'));
  }
  // the hedges, clipped, a crown along the top, the ends rounded
  for (const [x0, za, zb] of [[80, -12, GATE[0][1] - 4], [79, GATE[1][1] + 3, 35]]) for (let z = za; z <= zb; z += 1) for (let x = x0 - 1; x <= x0 + 1; x += 1) for (let y = 0; y <= 4; y += 1) {
    if (y === 4 && (x !== x0 || z === za || z === zb)) continue;
    b.put(x, y, z, y >= 3 && hash(x, y, z) > 0.55 ? K('hedge3') : y === 0 ? K('hedge1') : tone([K('hedge1'), K('hedge2'), K('hedge2')], x, y, z, 7));
  }
  return b;
}
const gate = { gait: 'still', build: () => ({ parts: { gate: gateGrid().part('gate', [0, 0, 0]) } }) };

// ---- a screen for the 2D site's painted clip, 16 x 10 voxels in a frame on two posts, facing +z.
// 'stone': granite posts with brass bands, a dressed frame with gold at its corners, a slate roof;
// 'wood': a blue easel with a cream frame, a crest and a ledge of chalk.
const SW = 16, SH = 10, SY = 13; // the screen's size and the height of its middle (voxels)
function frame(style) {
  const stone = style === 'stone';
  return {
    gait: 'still',
    build() {
      const b = box([-13, 0, -3], [12, 24, 2]);
      for (const x0 of [-11, 9]) {
        b.fill(x0 - 1, 0, -2, x0 + 2, 1, 1, stone ? (x, y, z) => tone([K('fr2'), C.stone3], x, y, z, 1) : C.wood1);
        b.fill(x0, 2, -1, x0 + 1, stone ? 21 : 19, 0, (x, y, z) => (stone ? (y % 6 === 0 ? C.brass2 : tone([K('fr1'), K('fr2')], x, Math.floor(y / 3), z, 2)) : y % 5 === 0 ? K('cream2') : K('blue2')));
      }
      const [x0, x1, y0, y1] = [-SW / 2 - 2, SW / 2 + 1, SY - SH / 2 - 2, SY + SH / 2 + 1];
      for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
        const ring = Math.min(x - x0, x1 - x, y - y0, y1 - y);
        if (ring > 1) { b.put(x, y, -1, K('back')); continue; }
        const corner = (x - x0 <= 1 || x1 - x <= 1) && (y - y0 <= 1 || y1 - y <= 1);
        let id;
        if (stone) id = ring === 1 ? (corner ? K('fgold2') : (x + y) % 9 === 0 ? K('fgold') : K('frg')) : tone([K('fr1'), K('fr2')], x, y, 0, 3);
        else id = ring === 1 ? K('cream') : (x + y) % 4 === 0 ? K('blue2') : K('blue1');
        b.put(x, y, 0, id);
      }
      if (stone) { // a lintel and a little slate roof
        b.fill(x0 - 2, y1 + 1, -1, x1 + 2, y1 + 2, 0, (x, y) => (y === y1 + 2 ? K('fr1') : K('fr2')));
        for (let z = -3; z <= 2; z += 1) for (let x = x0 - 3; x <= x1 + 3; x += 1) { const y = y1 + 5 - Math.abs(z + 0.5) + 0.5; b.put(x, Math.floor(y), z, (x + Math.floor(y)) % 3 ? C.iron2 : C.iron1); }
      } else { // a crest, a ledge with chalk on it
        b.fill(-3, y1 + 1, 0, 2, y1 + 2, 0, (x, y) => (y === y1 + 2 && (x === -3 || x === 2) ? 0 : K('cream')));
        b.put(-1, y1 + 2, 0, K('blue1')); b.put(0, y1 + 2, 0, K('blue1'));
        b.fill(x0, y0 - 1, 0, x1, y0 - 1, 2, K('cream2'));
        b.put(-5, y0, 1, K('chalk')); b.put(4, y0, 2, K('chalk2'));
      }
      return { parts: { frame: b.part('frame', [0, 0, 0]) } };
    },
  };
}

export default {
  id: 'education',
  title: 'Academy',
  lede: 'Two schools, one quad.',
  island: {
    A: 90, B: 80, seed: 4,
    paths: ({ dock, docks }) => [
      [[-72, CROSS[1]], [68, CROSS[1]]], // the quad's cross
      [[CROSS[0], 32], [CROSS[0], 80]],
      [[-38, 26], [-38, CROSS[1]]], // up to the Campanile
      [[36, 3], [36, CROSS[1]]], // up to the school
      [...(dock ? [dock] : []), [-38, -54], [-38, -14]], // in from the north, through the range's gate
      ...(docks && docks[1] ? [[docks[1], [74, 15], [73, 34], [68, CROSS[1]]]] : []), // in at the east gate, down the yard's side to the quad
    ],
    plazas: [[-38, 12, 27], [CROSS[0], CROSS[1], 9]],
    flags: [[2, 3, 70, 28]], // the school yard
    theme: { seamGlow: 0xc98a2a, seamHot: 0xffe08a },
  },
  build(env, chapter) {
    const { THREE } = env;
    const item = (id) => chapter.items.find((it) => it.id === id);
    const stops = {}, targets = [], colliders = [], screens = [];
    const small = []; // details too small to see from the whole town's view: hidden unless the Academy has the focus
    const box1 = ([x, z], r) => [x - r, z - r, x + r, z + r];

    // ---- Trinity: the Campanile and the range behind it
    const camp = env.place('acad:campanile', campanile(), TRIN);
    const rng = env.place('acad:range', range(), RANGE);
    env.halo(camp.parts.bell, [0, -4.5, 0], 15, 0xffc764, 1);
    env.halo(camp.parts.crystal, [0, 0, 0], 9, 0xb89cff, 0.9);
    small.push(env.halo(camp.parts.tower, [0, 31, 0], 18, 0xffc764, 0.35), env.halo(rng.parts.lantern, [0, -3.5, 0], 9, 0xffc764, 0.6)); // the rune ring under the crossing, the lantern in the gate
    small.push(camp.parts.clapper, camp.parts.tassel, rng.parts.lantern);
    const bellLight = env.light([TRIN[0], CAMPANILE.bellY * V, TRIN[1]], 0xffc764, 5, 8);
    env.light([TRIN[0], CAMPANILE.lanternY * V, TRIN[1]], 0xb89cff, 3, 6);
    env.light([RANGE[0], 4.4, RANGE[1]], 0xffc764, 3, 5);
    env.light([TRIN[0], 3.8, TRIN[1]], 0xffc764, 3, 6); // under the crossing
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { // the four piers (the passages stay open)
      const [a, c] = sx < 0 ? [-19, -8] : [8, 19], [e, f] = sz < 0 ? [-19, -8] : [8, 19];
      colliders.push([TRIN[0] + a * V, TRIN[1] + e * V, TRIN[0] + c * V, TRIN[1] + f * V]);
    }
    colliders.push([RANGE[0] - 30 * V, RANGE[1] - 10 * V, RANGE[0] - 6 * V, RANGE[1] + 9 * V], [RANGE[0] + 6 * V, RANGE[1] - 10 * V, RANGE[0] + 30 * V, RANGE[1] + 9 * V]);

    // ---- the school and its robot
    const hall = env.place('acad:school', school(), SCHOOL);
    const bot = env.place('acad:robot', robot(1.35, 0.7), ROBOT);
    env.halo(hall.parts.face, [0, 0, 0.6], 16, 0xfff0c8, 0.55);
    env.halo(hall.parts.ring, [0, 0, 0.5], 22, 0x7fd8ff, 0.45);
    env.halo(hall.parts.hall, [0.5, 13, 7], 44, 0xffc764, 0.3); // the lanterns along the verandah
    small.push(env.halo(hall.parts.blink, [0, 0, 0], 5, 0xff4a3a, 0.8), hall.parts.hour, hall.parts.minute, hall.parts.vane, hall.parts.blink, bot.group);
    env.halo(bot.parts.tip, [0, 1, 0], 5, 0xff5a3c, 0.8);
    env.light([SCHOOL[0], 2.2, SCHOOL[1] + 1.2], 0xffc764, 4, 7);
    env.light([SCHOOL[0], 8.9, SCHOOL[1] + 1.8], 0xfff0c8, 3, 6);
    colliders.push([SCHOOL[0] - 36 * V, SCHOOL[1] - 12 * V, SCHOOL[0] + 36 * V, SCHOOL[1] + 13 * V]);

    // ---- the quad: its small things, lamps, trees
    small.push(env.place('acad:quad', quad, [0, 0]).group);
    for (const [x, z] of BENCHES) colliders.push([(x - 7) * V, (z - 3) * V, (x + 8) * V, (z + 4) * V]);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) colliders.push(box1([(CROSS[0] + sx * 10) * V, (CROSS[1] + sz * 9) * V], 0.35));
    colliders.push([CHALK[0] * V, (CHALK[1] - 5) * V, (CHALK[0] + 12) * V, (CHALK[1] + 6) * V], [-59 * V, 30 * V, -44 * V, 34 * V]);
    for (const [x, z] of LAMPS) {
      const l = env.place('lamp', lampDef, [x, z]);
      env.halo(l.parts.orb, [0, 0, 0], 16, 0x7fe8ff, 1);
      env.light([x, LAMP_ORB * V, z], 0x7fe8ff, 6, 9);
      colliders.push(box1([x, z], 0.5));
    }
    TREES.forEach(([x, z, seed], i) => { env.place(`tree:${seed}`, tree(seed), [x, z], seed + i * 2.1); colliders.push(box1([x, z], 0.45)); });
    // ---- the east gate: its piers and hedge (seen from the street, so always drawn), its lanterns' light
    env.place('acad:gate', gate, [0, 0]);
    for (const [x, z] of GATE) { colliders.push(box1([(x - 0.5) * V, (z - 0.5) * V], 0.45)); env.light([(x - 0.5) * V, 3.8, (z - 0.5) * V], 0xffc764, 3, 5); }
    colliders.push([78.5 * V, -12 * V, 81.5 * V, (GATE[0][1] - 3) * V], [77.5 * V, (GATE[1][1] + 3) * V, 80.5 * V, 36 * V]); // the hedges

    // ---- a screen by each landmark, playing the 2D site's painted clip of it
    for (const [id, style] of [['trinity', 'stone'], ['mothers', 'wood']]) {
      const [x, z, ry] = SCREENS[id], url = clip(item(id)), still = poster(item(id));
      const f = env.place(`acad:screen:${style}`, frame(style), [x, z], ry);
      const idle = new THREE.MeshBasicMaterial({ color: 0x0d1822 });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), idle);
      plane.position.set(0, SY, 0.55);
      f.parts.frame.add(plane);
      const tex = url ? env.videoTexture(url, plane) : null;
      const live = tex ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : null;
      screens.push({ plane, tex, idle, live, still });
      small.push(plane, env.halo(f.parts.frame, [0, SY, 2], 22, 0x9fcfff, 0.3));
      colliders.push(box1([x, z], 0.8));
      if (item(id)) targets.push({ object: f.group, stop: id, label: item(id).title });
    }

    // the core casts shadows only for the district it is looking at: that is the signal to show the small things
    let probe = null;
    camp.group.traverse((o) => { if (!probe && o.isMesh && o.userData.caster) probe = o; });

    // ---- Yuuv: his cap goes up with a cheer and comes down again (the core poses him first, then this runs)
    const Y = env.yuuv, YP = Y.parts;
    const lift = YP.cap.userData.home.y - YP.duck.userData.home.y + 1; // how far the duck sits up on the board
    let toss = null;
    // at a landmark: it answers, he points up at it, cheers and throws his cap, then turns round to us
    const visit = (answer) => (y) => {
      answer();
      y.play('point');
      env.after(0.9, () => { y.play('cheer'); toss = y.mem.clip?.t0 ?? null; });
      env.after(2.6, () => env.face('camera'));
    };
    // the views look over the upper town's houses round the plot, through the gaps between them: the quad from the
    // south-south-west, the Campanile from a little higher, the school from the south-east (with the east gate)
    stops.main = { spot: [0.35, 7.2], face: 'camera', view: { target: [-0.4, 2.8, 1.8], yaw: 0.1, pitch: 0.7, fit: 12.4 }, on: (y) => y.play('wave') };
    if (item('trinity')) {
      stops.trinity = {
        spot: [-2.9, 5.5], face: TRIN,
        view: { target: [-5.0, 5.7, 3.0], yaw: 0.45, pitch: 0.55, fit: 9.2 },
        on: visit(() => camp.ctx.ring()),
      };
      targets.push({ object: camp.group, stop: 'trinity', label: item('trinity').title }, { object: rng.group, stop: 'trinity', label: item('trinity').title });
    }
    if (item('mothers')) {
      stops.mothers = {
        spot: [4.4, 2.4], face: SCHOOL,
        view: { target: [4.9, 3.2, 0.6], yaw: 0.72, pitch: 0.36, fit: 7.6 },
        on: visit(() => { hall.ctx.chime(); env.after(0.3, () => bot.ctx.cheer()); }),
      };
      targets.push({ object: hall.group, stop: 'mothers', label: item('mothers').title }, { object: bot.group, stop: 'mothers', label: item('mothers').title });
    }

    return {
      stops, targets, colliders,
      enter: (y) => {
        y.mem.cap = true;
        // the screens show the clip's painted still until the clip itself has frames (fetched on the first visit)
        for (const s of screens) if (s.still && !s.idle.map) new THREE.TextureLoader().load(s.still, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; Object.assign(s.idle, { map: tex, toneMapped: false }); s.idle.color.set(0xffffff); s.idle.needsUpdate = true; });
      },
      leave: (y) => { y.mem.cap = false; },
      update() {
        const near = !probe || probe.castShadow;
        for (const o of small) o.visible = near;
        // his cap: up and back with a flip and a twirl, the duck dropping into his curls while it is away
        const cl = Y.ctx.mem.clip;
        if (toss !== null && cl && cl.name === 'cheer' && cl.t0 === toss && YP.cap.visible) {
          const s = clamp01(((Y.state.t - cl.t0) / cl.dur - 0.16) / 0.7);
          if (s > 0 && s < 1) {
            YP.cap.position.y += 13 * 4 * s * (1 - s);
            YP.cap.position.z -= 3 * Math.sin(Math.PI * s);
            YP.cap.rotation.x -= Math.PI * 2 * smooth(s);
            YP.cap.rotation.y += Math.PI * 2 * s;
            YP.duck.position.y -= lift * Math.min(1, s * 6, (1 - s) * 6);
          }
        }
        // the bell's light swells as it rings
        const u = camp.state.t - camp.ctx.mem.rungAt;
        bellLight.power = 5 + (u >= 0 && u < 2 ? 9 * (1 - u / 2) : 0);
        // the screens: the painted still (or dark glass) until the clip has frames, then the clip
        for (const s of screens) s.plane.material = s.tex && s.tex.image && s.tex.image.readyState >= 2 ? s.live : s.idle;
      },
      panel: (stop) => (stop === 'main' ? '<p class="hint">Click the Campanile or the school and Yuuv walks you there.</p>' : null),
    };
  },
};
