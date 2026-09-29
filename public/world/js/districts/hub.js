// Gate Square: the arrival square just inside the town's sea gate, where Yuuv starts. Visitors come up the
// Harbour Stair and through the gate onto a round piazza of ringed cobbles: straight ahead a stepped stone
// plinth runs with circuit light, runes on its faces, and an iron frame holds a hologram of his monogram (the
// name itself is HTML, over it); at the plinth's foot the joke, a basin of glowing plasma where three rubber
// ducks bob, one in a crown (rubber-duck debugging, and the cousin of the one in his pocket); by the gate a
// notice board with pinned papers and one glowing note, for the new arrival; plasma lamps round the square
// with cables of beads slung from the plinth's frame, trees in the corners, rune stones either side of the
// gate. Streets leave the square for the Workshop Quarter (west, along the canal), the Market (north) and
// the Sky Docks (east).
import { C, colour, hash } from '../kit/voxel-kit.js';
import { box, tone } from '../models/space.js';
import { lampDef, festoon, LAMP_ORB } from '../models/island.js';
import { tree } from '../models/props.js';

for (const [n, hex, glow] of [
  ['s1', 0xc4bcae], ['s2', 0xa9a295], ['s3', 0x918a7e], ['s4', 0x777267], ['mortar', 0x3f3b37], ['q1', 0xd8d0c0],
  ['trace', 0x1fd2ea, true], ['via', 0xb6fbff, true], ['rune', 0x9f86ff, true], ['rune2', 0x6ff2ff, true],
  ['h1', 0xe6fdff, true], ['h2', 0x3fe6ff, true], ['h3', 0x1a8fb0, true], ['hm', 0xffc764, true],
  ['crys1', 0xe6fdff, true], ['crys2', 0x6ff2ff, true], ['crys3', 0xa98bff, true],
  ['plasma1', 0x2ad6ee, true], ['plasma2', 0x7ff4ff, true], ['plasma3', 0x1a9fc0, true],
  ['duck1', 0xffd23f], ['duck2', 0xf2b62a], ['beak', 0xff8b22], ['eye', 0x151515], ['crown', 0xf0c24a], ['jewel', 0xff5ad8, true],
  ['plank1', 0x7a5634], ['plank2', 0x8a6440], ['plank3', 0x6b4a2c], ['shingle1', 0x4a3a5c], ['shingle2', 0x5a4870],
  ['paper1', 0xece2c8], ['paper2', 0xdcd0b2], ['ink', 0x4a4038], ['wax', 0xb3322a], ['pin', 0xd8d8e0], ['note', 0x6ff2ff, true], ['note2', 0xd8fdff, true],
]) colour(`hub_${n}`, hex, glow);
const K = (n) => C[`hub_${n}`];
const STONE = [K('s1'), K('s2'), K('s2'), K('s3'), K('s3'), K('s4')];
const mod = (a, n) => ((a % n) + n) % n;

// ---- the plinth: base, step, a coursed body with circuit light and runes, cornice, an iron frame
const RUNES = [
  ['.###.', '#.#.#', '#####', '#.#.#', '.###.'],
  ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  ['..#..', '.###.', '#.#.#', '..#..', '..#..'],
  ['#####', '#...#', '#.#.#', '#...#', '#####'],
];
function plinth() {
  const b = box([-12, 0, -12], [11, 42, 11]);
  b.fill(-12, 0, -12, 11, 1, 11, (x, y, z) => (Math.abs(x + 0.5) + Math.abs(z + 0.5) > 21 ? 0 : y === 1 && (Math.abs(x + 0.5) > 11 || Math.abs(z + 0.5) > 11) ? K('s4') : tone([K('s3'), K('s4'), K('s3')], Math.floor(x / 4), y, Math.floor(z / 4), 1)));
  b.fill(-10, 2, -10, 9, 2, 9, (x, y, z) => (Math.abs(x + 0.5) + Math.abs(z + 0.5) > 18 ? 0 : (x + z) % 6 === 0 ? K('mortar') : tone(STONE, Math.floor(x / 3), 2, Math.floor(z / 3), 2)));
  // the body: courses of three over mortar, quoins at the corners, circuit light in the joints
  b.fill(-8, 3, -8, 7, 13, 7, (x, y, z) => {
    const face = z === 7 ? 0 : x === 7 ? 1 : z === -8 ? 2 : x === -8 ? 3 : -1;
    if (face < 0) return K('mortar');
    const along = face % 2 ? z : x, row = y - 3, c = Math.floor(row / 3), bed = row % 3 === 2;
    const corner = Math.min(along + 8, 7 - along);
    // a rune on each face, inset and glowing
    const ri = along + 2, rj = 11 - y;
    if (ri >= 0 && ri < 5 && rj >= 0 && rj < 5) return RUNES[face][rj][ri] === '#' ? (face % 2 ? K('rune') : K('rune2')) : K('mortar');
    if (bed) return hash(c, along, face) < 0.28 ? (hash(c, along + 1, face) < 0.2 ? K('via') : K('trace')) : K('mortar');
    if (corner < (c % 2 ? 3 : 2)) return K('q1');
    const seg = along + 40 + (c % 2) * 2;
    if (seg % 4 === 0) return hash(c, along, face + 9) < 0.25 ? K('trace') : K('mortar');
    return STONE[Math.floor(hash(Math.floor(seg / 4), c, face) * STONE.length)];
  });
  for (let y = 4; y <= 10; y += 1) for (const [x, z] of [[-8, 1], [7, 1], [1, -8], [1, 7]]) if (hash(x, y, z) < 0.3) b.put(x, y, z, K('trace'));
  // cornice with a glowing lip, then the top slab
  b.fill(-9, 14, -9, 8, 14, 8, (x, y, z) => (Math.abs(x + 0.5) === 8.5 || Math.abs(z + 0.5) === 8.5 ? ((x + z) % 3 ? K('h2') : K('h3')) : K('q1')));
  b.fill(-8, 15, -8, 7, 15, 7, (x, y, z) => tone([K('s2'), K('s3')], x, y, z, 3));
  // the frame: two uprights with brass collars, a crossbar, crystal finials
  for (const x of [-9, 8]) {
    b.fill(x, 15, -1, x, 36, 0, (xx, y) => (y % 7 === 0 ? C.brass2 : y % 7 === 1 ? C.iron3 : C.iron1));
    b.fill(x, 37, -1, x, 38, 0, K('crys2')); b.put(x, 39, -1, K('crys1')); b.put(x, 39, 0, K('crys3'));
  }
  b.fill(-8, 36, -1, 7, 36, 0, (x) => (x % 3 === 0 ? C.iron3 : C.iron2));
  for (const x of [-4, 3]) { b.put(x, 35, 0, C.iron2); b.put(x, 34, 0, C.iron3); } // hangers
  // the emitter: an iron trough on the slab that throws the hologram up
  b.fill(-7, 16, -1, 6, 16, 0, (x) => (x % 2 ? C.iron2 : K('h2')));
  return b;
}
// The hologram: the monogram YJ in two 5 x 7 glyphs, a bright border, see-through scanlines.
const Y = ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'];
const J = ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'];
function sign() {
  const b = box([-7, 18, 0], [6, 33, 0]);
  for (let y = 18; y <= 33; y += 1) for (let x = -7; x <= 6; x += 1) {
    const gj = 30 - y, border = x === -7 || x === 6 || y === 33 || y === 20;
    const g = gj >= 0 && gj < 7 && ((x >= -6 && x <= -2 && Y[gj][x + 6] === '#') || (x >= 1 && x <= 5 && J[gj][x - 1] === '#'));
    if (y < 20) { if ((x + y) % 2 === 0) b.put(x, y, 0, K('h2')); continue; } // a fringe
    if (g) b.put(x, y, 0, (x + y) % 4 ? K('h1') : K('hm'));
    else if (border) b.put(x, y, 0, K('h2'));
    else if (y % 2 === 0 && hash(x, y, 7) > 0.3) b.put(x, y, 0, K('h3'));
  }
  return b.part('sign', [-0.5, 26, 0.5]);
}
function scan() { const b = box([-6, 21, 1], [5, 21, 1]); b.fill(-6, 21, 1, 5, 21, 1, (x) => (x % 3 === 0 ? 0 : K('h1'))); return b.part('scan', [-0.5, 21.5, 1.5]); }
function topCrystal() {
  const b = box([-2, 38, -2], [1, 44, 1]);
  for (let y = 38; y <= 44; y += 1) { const r = y < 41 ? (y - 37) * 0.55 : (45 - y) * 0.5; b.egg(-0.5 + 0.5, y + 0.5, -0.5 + 0.5, Math.max(0.5, r), 0.5, Math.max(0.5, r), y > 42 ? K('crys1') : (y % 2 ? K('crys2') : K('crys3'))); }
  return b.part('gem', [0, 41, 0]);
}
const monument = {
  gait: 'still',
  build: () => ({ parts: { plinth: plinth().part('plinth', [0, 0, 0]), sign: sign(), scan: scan(), gem: topCrystal() } }),
  idle({ parts: P, state: { t } }) {
    P.sign.rotation.y += 0.32 * Math.sin(t * 0.45);
    P.sign.scale.x = hash(Math.floor(t * 14), 3) < 0.015 ? 0 : 1 + 0.01 * Math.sin(t * 37); // the odd glitch
    P.scan.rotation.y += 0.32 * Math.sin(t * 0.45);
    P.scan.position.y += (t * 4.5) % 12;
    P.gem.rotation.y += t * 0.8;
    P.gem.position.y += Math.sin(t * 1.4) * 0.8;
  },
};

// ---- the duck basin: a round stone rim round a pool of plasma, three rubber ducks on it
function basin() {
  const b = box([-11, 0, -11], [10, 3, 10]);
  for (let z = -11; z <= 10; z += 1) for (let x = -11; x <= 10; x += 1) {
    const r = Math.hypot(x + 0.5, z + 0.5);
    if (r > 10.6) continue;
    if (r > 8.4) { for (let y = 0; y <= 2; y += 1) b.put(x, y, z, y === 2 ? (hash(x, z, 4) < 0.5 ? K('q1') : K('s2')) : tone(STONE, x, y, z, 5)); continue; }
    b.put(x, 0, z, K('s4'));
    const sw = Math.sin(Math.atan2(z + 0.5, x + 0.5) * 3 + r * 1.1);
    b.put(x, 1, z, sw > 0.6 ? K('plasma2') : sw < -0.6 ? K('plasma3') : K('plasma1'));
  }
  b.fill(-1, 1, -1, 0, 2, 0, (x, y) => (y === 2 ? K('plasma2') : K('s3'))); // a bubbler in the middle
  return b;
}
function duck(name, crowned) {
  const b = box([-2, 0, -2], [1, 5, 2]);
  b.egg(-0.5 + 0.5, 1.2, 0, 1.9, 1.3, 2.3, (x, y, z) => (y >= 2 && (x + z) % 2 ? K('duck2') : K('duck1')));
  b.egg(0, 3.1, 0.9, 1.2, 1.1, 1.2, K('duck1'));
  b.put(-1, 3, 1, K('eye')); b.put(0, 3, 1, K('eye'));
  b.put(-1, 3, 2, K('beak')); b.put(0, 3, 2, K('beak')); b.put(0, 2, 2, K('beak'));
  b.put(0, 1, -2, K('duck2')); // the tail
  if (crowned) { for (const [x, z] of [[-1, 0], [0, 0], [-1, 1], [0, 1]]) b.put(x, 4, z, K('crown')); b.put(-1, 5, 0, K('crown')); b.put(0, 5, 1, K('crown')); b.put(0, 5, 0, K('jewel')); }
  return b.part(name, [0, 0, 0]);
}
const DUCKS = [[0, 5.2], [2.1, 4.4], [4.2, 5.6]]; // start angle, orbit radius (voxels)
const ducks = {
  gait: 'still',
  build: () => ({ parts: { basin: basin().part('basin', [0, 0, 0]), duckA: duck('duckA', false), duckB: duck('duckB', false), duckC: duck('duckC', true) } }),
  setup(ctx) { ctx.mem.spin = -10; },
  idle(ctx) {
    const { parts: P, state: { t }, mem } = ctx;
    const hurry = Math.max(0, 1 - (t - mem.spin) / 2.5); // clicked: a quick lap
    ['duckA', 'duckB', 'duckC'].forEach((n, i) => {
      const [a0, r] = DUCKS[i], a = a0 + t * (0.25 + 1.6 * hurry) * (i === 1 ? -1 : 1);
      const d = P[n];
      d.position.set(Math.cos(a) * r, 1.6 + 0.25 * Math.sin(t * 2.3 + i * 2), Math.sin(a) * r);
      d.rotation.y = -a + (i === 1 ? Math.PI : 0);
      d.rotation.z = 0.12 * Math.sin(t * 1.9 + i);
      d.rotation.x = 0.08 * Math.sin(t * 2.6 + i * 1.3);
    });
  },
  act(ctx) { ctx.mem.spin = ctx.state.t; ctx.burst({ x: 0, y: 0.4, z: 0 }, 14, 1.6, [0xd8fdff, 0x2ad6ee], 0.06, 0.7); },
};

// ---- the notice board: two posts, a planked board under a little shingle roof, papers pinned up
function boardGrid() {
  const b = box([-8, 0, -3], [7, 24, 2]);
  for (const x of [-7, 6]) b.fill(x, 0, -1, x, 20, 0, (xx, y, z) => (y === 0 ? K('s3') : y % 6 === 0 ? C.iron2 : tone([C.wood1, C.wood2], xx, y, z, 3)));
  b.fill(-6, 7, 0, 5, 17, 0, (x, y) => tone([K('plank1'), K('plank2'), K('plank3')], Math.floor((x + 6) / 2), Math.floor(y / 6), 0, 4));
  b.fill(-6, 6, 0, 5, 6, 1, C.wood1); b.fill(-6, 18, 0, 5, 18, 1, C.wood1);
  for (let x = -8; x <= 7; x += 1) for (let z = -3; z <= 2; z += 1) { const y = 22 - Math.abs(z + 0.5) + 0.5; b.put(x, Math.floor(y), z, (x + Math.floor(y)) % 3 ? K('shingle1') : K('shingle2')); b.put(x, Math.floor(y) - 1, z, z === -3 || z === 2 ? C.wood1 : 0); }
  // papers with lines of writing, pins, a wax seal
  const paper = (x0, y0, w, h, seal) => {
    for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) {
      const line = (y0 + h - 1 - y) % 2 === 1 && x > x0 && x < x0 + w - 1 && y > y0 && hash(x, y, 13) > 0.25;
      b.put(x, y, 1, line ? K('ink') : hash(x, y) < 0.3 ? K('paper2') : K('paper1'));
    }
    b.put(x0 + Math.floor(w / 2), y0 + h - 1, 2, K('pin'));
    if (seal) b.put(x0 + w - 2, y0 + 1, 2, K('wax'));
  };
  paper(-5, 11, 4, 6, false); paper(0, 12, 5, 5, true); paper(-4, 8, 3, 3, false);
  // one note is a hologram: a glowing card with a pulsing dot
  b.fill(1, 8, 1, 4, 10, 1, (x, y) => (x === 1 || x === 4 || y === 8 || y === 10 ? K('note') : K('note2')));
  return b;
}
function blink() { const b = box([2, 9, 2], [3, 9, 2]); b.fill(2, 9, 2, 3, 9, 2, K('note2')); return b.part('blink', [3, 9.5, 2.5]); }
const board = {
  gait: 'still',
  build: () => ({ parts: { board: boardGrid().part('board', [0, 0, 0]), blink: blink() } }),
  idle({ parts: P, state: { t } }) { P.blink.scale.setScalar((t * 1.4) % 1 < 0.55 ? 1 : 0); },
};

// ---- the square: everything placed by hand round the plinth (plot units; +z is the gate and the camera)
const YAW = 0.45; // the town's camera yaw
const RIGHT = [Math.cos(YAW), -Math.sin(YAW)];
const MON = [0, -1.6], POND = [0, 2.3];
const BOARD = [-4.4, 6.3, 0.55]; // by the gate, turned to greet whoever comes through it
const LAMPS = [[-5.6, -4.8], [5.6, -4.8], [-6.1, 3.4], [6.1, 3.4]];
const TREES = [[-7.8, -3.6, 4], [7.7, -3.8, 5], [-7.2, 5.8, 6], [7.4, 5.6, 4]];
const STONES = [[-1.85, 8.1, 7], [1.85, 8.1, 3]];
const ORB = [5.2, -0.4];
const box1 = ([x, z], r = 0.5) => [x - r, z - r, x + r, z + r];
export default {
  id: 'hub',
  title: 'Gate Square',
  island: {
    A: 70, B: 64, seed: 1,
    plazas: [[0, -4, 60]], // the piazza: cobbles in rings round the plinth, a glowing ring near its kerb
    // from the piazza's kerb out to each street
    paths: ({ docks }) => (docks || []).map(([x, z]) => { const r = Math.hypot(x, z + 4); return [[(x / r) * 56, -4 + ((z + 4) / r) * 56], [x, z]]; }),
  },
  build(env) {
    const { V } = env;
    const colliders = [box1(MON, 1.9), box1(POND, 1.7)];
    const mon = env.place('hub:monument', monument, MON);
    const pool = env.place('hub:ducks', ducks, POND);
    const notice = env.place('hub:board', board, [BOARD[0], BOARD[1]], BOARD[2]);
    colliders.push(box1([BOARD[0], BOARD[1]], 1));
    LAMPS.forEach(([x, z]) => {
      const l = env.place('lamp', lampDef, [x, z]);
      env.halo(l.parts.orb, [0, 0, 0], 16, 0x7fe8ff, 1);
      env.light([x, LAMP_ORB * V, z], 0x7fe8ff, 6, 9);
      colliders.push(box1([x, z]));
    });
    // cables slung from the plinth's frame out to the two lamps behind it, beads chasing along them
    const top = ([x, z]) => [(x - MON[0]) / V - 0.5, 31.5, (z - MON[1]) / V - 0.5], frame = (x) => [x < 0 ? -9 : 8, 36, -1 - 0.5 / V];
    const slung = LAMPS.slice(0, 2).map((p) => [frame(p[0]), top(p), 6]);
    const at0 = (p) => [p[0] + MON[0] / V, p[1], p[2] + MON[1] / V];
    if (env.fx?.cable) slung.forEach(([a, b, sag], i) => env.place(`hub:cable${i}`, env.fx.cable(at0(a), at0(b), sag, 7), [0, 0]));
    else env.place('hub:festoons', { gait: 'still', build: () => ({ parts: Object.fromEntries(slung.map(([a, b, sag], i) => [`f${i}`, festoon(at0(a), at0(b), { sag, name: `f${i}` })])) }) }, [0, 0]);
    if (env.fx?.dataOrb) {
      const orb = env.place('orb:magenta', env.fx.dataOrb('magenta'), ORB);
      env.halo(orb.parts.core, [0, 0, 0], 20, 0xff4fd8, 0.9);
      env.light([ORB[0], 2.3, ORB[1]], 0xff5ad8, 4, 6);
      colliders.push(box1(ORB, 0.6));
    }
    if (env.fx?.runeStone) STONES.forEach(([x, z, seed], i) => { env.place(`rune:${seed}`, env.fx.runeStone(seed), [x, z], i ? -0.4 : 0.4); colliders.push(box1([x, z])); });
    TREES.forEach(([x, z, seed]) => { env.place(`tree:${seed}`, tree(seed, { h: 15, r: 6.5 }), [x, z], seed); colliders.push(box1([x, z])); });
    env.halo(mon.parts.sign, [0, 5, 1], 30, 0x3fe6ff, 0.55);
    env.halo(mon.parts.gem, [0, 0, 0], 12, 0xb89cff, 0.9);
    env.halo(pool.parts.basin, [0, 2, 0], 26, 0x2ad6ee, 0.4);
    env.halo(notice.parts.blink, [0, 0, 0], 5, 0x6ff2ff, 0.8);
    env.light([MON[0], 3.9, MON[1] + 0.2], 0x5fe8ff, 5, 8);
    env.light([POND[0], 1.3, POND[1]], 0xffd08a, 3.4, 4.5); // warm over the pond, so the ducks stay yellow at night
    const duckSpot = [POND[0] + RIGHT[0] * 2.4, POND[1] + RIGHT[1] * 2.4], mainSpot = [POND[0] - RIGHT[0] * 2.5, POND[1] - RIGHT[1] * 2.5 + 0.4]; // either side of the pond
    const boardSide = [BOARD[0] + Math.cos(BOARD[2]) * 2.9 + Math.sin(BOARD[2]) * 0.8, BOARD[1] - Math.sin(BOARD[2]) * 2.9 + Math.cos(BOARD[2]) * 0.8];
    return {
      nameplate: [MON[0], 7.4, MON[1]],
      stops: {
        main: { spot: mainSpot, face: 'camera', view: { target: [0, 2.2, -0.6], yaw: YAW, pitch: 0.7, fit: 9.6 }, on: (y) => y.play('wave') },
        // (by the board's east end, the camera from the south-east and high: lower, the sea gate's tower stands in the way)
        board: { spot: boardSide, face: [BOARD[0], BOARD[1]], view: { target: [(BOARD[0] + boardSide[0]) / 2, 1.9, (BOARD[1] + boardSide[1]) / 2], yaw: 0.9, pitch: 0.82, fit: 4.8 }, on: (y) => y.play('point') },
        ducks: { spot: duckSpot, face: POND, view: { target: [POND[0] + 0.4, 1.1, POND[1]], yaw: YAW + 0.25, pitch: 0.62, fit: 3.6 }, on: (y) => { y.play('point'); env.after(0.5, () => pool.act()); } }, // (clear of the sea gate's merlons)
      },
      targets: [
        { object: mon.group, stop: 'main', label: 'The plinth' },
        { object: pool.group, stop: 'ducks', label: 'The duck pond' },
        { object: notice.group, stop: 'board', label: 'Notice board' },
      ],
      colliders,
    };
  },
};
