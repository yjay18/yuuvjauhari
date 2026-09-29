// The Observatory's four lecterns (research), one per paper. Each is a coursed
// stone lectern with a brass band and a rune cut into its face, a planked desk and
// an open book on it; out of the book pops a little diorama (the 2D site folds its
// research into a pop-up book), and act() folds it flat and pops it up again
// before its own moment:
//   icu          a hospital bed with a crystal heart for a patient; over it a
//                hologram monitor, the ECG's dot running and the heart beating in
//                time, the blood pressure sagging now and then toward the amber
//                line, and the alarm on its post blinking before it gets there
//   negotiation  two robots across a round table, a brass one and a steel one,
//                telescoping their arms to slide a coin back and forth while their
//                speech bubbles pop: an offer, a query, a counter, a deal
//   emoji        a crystal in a brass claw, a ring of emoji orbiting it, each one
//                flipping now and then to the other face it keeps on its back
//   legal        brass scales weighing a bill (a glowing scroll) against the
//                weights, tipping gently, and a gavel that raps when they settle
// lectern(kind) -> rig definition, facing +z; LECTERN holds its footprint (voxels).
import { C, colour, hash } from '../kit/voxel-kit.js';
import { box, tone, smooth, clamp01 } from './space.js';
import { K, STONE } from './obs_tower.js';

const col = (name, hex, glow = false) => C[name] ?? colour(name, hex, glow);
for (const [n, hex, glow] of [
  ['leather', 0x5a2330], ['leather2', 0x74303f], ['page', 0xf0e6ce], ['pageEdge', 0xd9ccb0],
  // the icu
  ['frameW', 0xdfe4ea], ['sheet', 0xeef3f7], ['sheet2', 0xcfdae4], ['blanket', 0x3f8f86], ['blanket2', 0x58a89c],
  ['ecg', 0x5dffb0, true], ['ecgDim', 0x1d7a52, true], ['ecgHot', 0xe6fff0, true], ['grid', 0x0e3a2a, true],
  ['bp', 0xff5a8a, true], ['thresh', 0xffb02e, true], ['heart1', 0xff3a4a, true], ['heart2', 0xff9aa6, true], ['heart3', 0xb81a2e, true],
  ['alarm', 0xff3a22, true], ['alarm2', 0xffd0a0, true],
  // the negotiation
  ['botA2', 0x9a7428], ['steel1', 0x8a93a3], ['steel2', 0x6d7686], ['steel3', 0xb4bcc8],
  ['visor', 0x6ff2ff, true], ['eyeB', 0xff5ad8, true], ['eyeB2', 0xffd0f4, true], ['coin1', 0xffd24a, true], ['coin2', 0xd99a2a, true],
  ['sayA', 0x3fe6ff, true], ['sayA2', 0x0f5a70, true], ['sayB', 0xff5ad8, true], ['sayB2', 0x5a1a52, true], ['glyph', 0xffffff, true], ['line2', 0xd8fdff, true],
  // the emoji
  ['emo1', 0xffd23f, true], ['emo2', 0xe89a1a, true], ['emoInk', 0x3a1a08, true], ['emoRed', 0xff4a5a, true], ['emoBlue', 0x6fc8ff, true], ['emoMad', 0xff7a3a, true],
  ['crys1', 0xf4eeff, true], ['crys2', 0xc0a4ff, true], ['crys3', 0x7a5cff, true], ['crys4', 0x6ff2ff, true],
  // the legal
  ['scroll', 0xf2e4be], ['scroll2', 0xdcc69a], ['scrollInk', 0xffc764, true], ['seal', 0xc8322c], ['gavel1', 0x6a3f22], ['gavel2', 0x8a5a32],
]) col(`obs_${n}`, hex, glow);

export const LECTERN = { foot: [-8, -6, 7, 5] }; // x0, z0, x1, z1 (voxels)
const spring = (tau) => (tau <= 0 ? 0 : 1 - Math.exp(-6 * tau) * Math.cos(10 * tau));
const mod = (a, n) => ((a % n) + n) % n;

// ---------------------------------------------------------------------------------------------
// The lectern: a bevelled foot and step, a coursed column with a rune cut into its face (lit in the paper's
// colour), a riveted brass band, a dressed capital, a planked desk with a brass rim, and the open book.
const SIGIL = ['#..#', '.##.', '####', '.##.', '#..#'];
function lecternGrid(accent) {
  const b = box([-8, 0, -6], [7, 13, 5]);
  b.fill(-8, 0, -6, 7, 0, 5, (x, y, z) => (Math.abs(x + 0.5) + Math.abs(z + 0.5) > 12 ? 0 : x === -8 || x === 7 || z === -6 || z === 5 || Math.abs(x + 0.5) + Math.abs(z + 0.5) > 11 ? (hash(x, z) < 0.3 ? K('q2') : K('q1')) : tone([K('s2'), K('s3'), K('s3'), K('s4')], Math.floor(x / 3), 0, Math.floor(z / 3), 2)));
  b.fill(-6, 1, -5, 5, 1, 4, (x, y, z) => (Math.abs(x + 0.5) + Math.abs(z + 0.5) > 9.5 ? 0 : (x + z) % 5 === 0 ? K('mortar') : tone(STONE, x, 1, z, 3)));
  b.fill(-4, 2, -3, 3, 9, 2, (x, y, z) => {
    const face = z === 2 ? 0 : x === 3 ? 1 : z === -3 ? 2 : x === -4 ? 3 : -1;
    if (face < 0) return K('mortar');
    const along = face % 2 ? z : x, row = y - 2;
    if (row % 3 === 2) return face === 1 && hash(along, y, 3) < 0.4 ? K('trace') : K('mortar');
    const c = Math.floor(row / 3), seg = Math.floor((along + 10 + (c % 2) * 2) / 4);
    return STONE[Math.floor(hash(seg, c, face + 7) * STONE.length)];
  });
  for (let j = 0; j < 5; j += 1) for (let i = 0; i < 4; i += 1) if (SIGIL[j][i] === '#') { b.cut(i - 2, 7 - j, 2); b.put(i - 2, 7 - j, 1, accent); } // cut, lit in the cut
  for (let z = -4; z <= 3; z += 1) for (let x = -5; x <= 4; x += 1) if (x === -5 || x === 4 || z === -4 || z === 3) b.put(x, 9, z, (x + z) % 3 === 0 ? K('brass3') : C.brass2);
  b.fill(-6, 10, -5, 5, 10, 4, (x, y, z) => (x === -6 || x === 5 || z === -5 || z === 4 ? ((x + z) % 2 ? K('q1') : K('q2')) : K('q1')));
  b.fill(-8, 11, -6, 7, 11, 5, (x, y, z) => (x === -8 || x === 7 || z === -6 || z === 5 ? ((x + z) % 4 === 0 ? K('brass3') : C.brass2) : tone([K('w2'), K('w3'), K('w4'), K('w3')], Math.floor((x + 8) / 5), 0, z, 5)));
  // the book: its cover, two blocks of pages written close, a dark gutter, the initial lit
  b.fill(-7, 12, -5, 6, 12, 4, (x, y, z) => (x === -1 || x === 0 ? K('leather') : (x + z) % 5 === 0 ? K('leather2') : K('leather')));
  for (let z = -4; z <= 3; z += 1) for (let x = -6; x <= 5; x += 1) {
    if (x === -1 || x === 0) continue;
    const edge = z === -4 || z === 3 || x === -6 || x === 5;
    const written = !edge && (z + 10) % 2 === 1 && hash(x, z, 9) > 0.3;
    b.put(x, 13, z, edge ? K('pageEdge') : written ? K('ink') : K('page'));
  }
  b.put(-5, 13, -3, accent); b.put(-4, 13, -3, accent);
  return b;
}

// Its own copy of the glow material for each named part, so each can brighten and dim on its own.
function ownGlow(ctx, names) {
  return names.map((n) => {
    const m = new ctx.THREE.MeshBasicMaterial({ vertexColors: true });
    ctx.parts[n].traverse((o) => { if (o.isMesh && o.material.isMeshBasicMaterial && o.parent?.parent === ctx.parts[n]) o.material = m; });
    return m;
  });
}
const pattern = (b, rows, map, [x0, y0, z]) => rows.forEach((row, j) => [...row].forEach((c, i) => { if (map[c]) b.put(x0 + i, y0 - j, z, map[c]); }));

// ---------------------------------------------------------------------------------------------
// icu: a hospital bed, a crystal heart for a patient, and a hologram monitor on a post.
const ECG = [0, 0, 1, 0, -1, 4, -2, 0, 1, 1, 0]; // x -5..5 over the baseline: P, Q, R, S, T
const BP = [0, 2, 3, 2, 1, 1, 0, 2, 3, 2, 1]; // two beats of arterial pressure
const HEART = ['.#.#.', '#####', '.###.', '..#..'];
function icuParts() {
  const bed = box([-8, 14, -5], [5, 39, 3]);
  for (const [x, z] of [[-5, -2], [-5, 2], [4, -2], [4, 2]]) { bed.put(x, 14, z, C.iron3); bed.put(x, 15, z, K('frameW')); } // legs on castors
  bed.fill(-5, 16, -2, 4, 16, 2, (x, y, z) => (z === -2 || z === 2 || x === -5 || x === 4 ? K('frameW') : K('sheet2')));
  bed.fill(-4, 17, -1, 3, 17, 1, (x, y, z) => (hash(x, z) < 0.3 ? K('sheet2') : K('sheet')));
  bed.fill(-4, 18, -1, -3, 18, 1, K('sheet'));
  bed.fill(-1, 17, -2, 3, 18, 2, (x, y, z) => (y === 17 && Math.abs(z) < 2 ? 0 : x === -1 ? K('sheet') : (x + z) % 3 ? K('blanket') : K('blanket2')));
  for (let y = 16; y <= 21; y += 1) for (let z = -2; z <= 2; z += 1) if (y === 21 || z % 2 === 0) bed.put(-6, y, z, y === 21 ? K('brass3') : C.brass2); // the headboard
  for (let y = 16; y <= 19; y += 1) for (let z = -2; z <= 2; z += 1) if (y === 19 || z % 2 === 0) bed.put(5, y, z, y === 19 ? K('brass3') : C.brass2); // the foot
  bed.fill(-8, 14, -4, -8, 37, -4, (x, y) => (y % 6 === 0 ? C.brass2 : C.iron2)); // the monitor's post
  bed.fill(-7, 37, -4, -5, 37, -4, C.iron2); bed.put(-8, 38, -4, C.iron3); // its arm and the alarm's base
  bed.fill(-8, 14, -5, -7, 14, -3, C.iron1);
  // the monitor: a lit frame, a faint grid, the ECG, the amber line the pressure must stay above
  const ecg = box([-6, 22, -4], [6, 36, -4]);
  for (let y = 22; y <= 36; y += 1) for (let x = -6; x <= 6; x += 1) {
    const edge = x === -6 || x === 6 || y === 22 || y === 36, corner = (x === -6 || x === 6) && (y === 22 || y === 36);
    if (corner) ecg.put(x, y, -4, K('ecgHot'));
    else if (edge) ecg.put(x, y, -4, K('ecgDim'));
    else if (x % 3 === 0 && y % 3 === 0) ecg.put(x, y, -4, K('grid'));
  }
  for (let i = 0; i < ECG.length; i += 1) {
    const x = i - 5, h = ECG[i], p = i ? ECG[i - 1] : h;
    for (let y = Math.min(h, p); y <= Math.max(h, p); y += 1) ecg.put(x, 31 + y, -4, K('ecg'));
  }
  for (let x = -5; x <= 5; x += 2) ecg.put(x, 24, -4, K('thresh'));
  const bp = box([-5, 22, -4], [5, 29, -4]);
  for (let i = 0; i < BP.length; i += 1) {
    const x = i - 5, h = BP[i], p = i ? BP[i - 1] : h;
    for (let y = Math.min(h, p); y <= Math.max(h, p); y += 1) bp.put(x, 25 + y, -4, K('bp'));
  }
  const dot = box([-1, 30, -4], [0, 31, -3]);
  dot.fill(-1, 30, -3, 0, 31, -3, K('ecgHot'));
  const heart = box([-2, 19, -1], [2, 22, 0]); // the patient, resting on the blanket
  pattern(heart, HEART, { '#': K('heart1') }, [-2, 22, 0]); // (x -2..2)
  pattern(heart, HEART, { '#': K('heart3') }, [-2, 22, -1]);
  heart.put(-1, 22, 0, K('heart2')); heart.put(-2, 21, 0, K('heart2'));
  const alarm = box([-9, 39, -5], [-7, 40, -3]);
  alarm.fill(-9, 39, -5, -7, 39, -3, (x, y, z) => (x === -8 && z === -4 ? K('alarm2') : K('alarm')));
  alarm.put(-8, 40, -4, K('alarm'));
  const root = bed.part('bed', [0, 14, 0]);
  return {
    bed: root,
    ecg: ecg.part('ecg', [0, 22, -4], bed),
    bp: bp.part('bp', [0, 25, -4], bed),
    dot: dot.part('dot', [-0.5, 30.5, -3.5], bed),
    heart: heart.part('heart', [0.5, 20.5, 0], bed),
    alarm: alarm.part('alarm', [-7.5, 39, -3.5], bed),
  };
}
function icuIdle(ctx) {
  const { parts: P, state: { t }, mem } = ctx;
  const beat = 1.25, u = mod(t, beat) / beat, x = -5 + u * 10; // the dot sweeps once a beat
  const i = Math.min(ECG.length - 1, Math.floor(u * 10)), f = u * 10 - i, h = ECG[i] + (ECG[Math.min(ECG.length - 1, i + 1)] - ECG[i]) * f;
  P.dot.position.x += x + 0.5;
  P.dot.position.y += h;
  const pulse = Math.max(0, 1 - Math.abs(u - 0.5) * 7); // as it crosses the R wave
  P.heart.scale.setScalar(1 + 0.22 * pulse + 0.03 * Math.sin(t * 2));
  P.heart.rotation.y = 0.3 * Math.sin(t * 0.7);
  // every so often the pressure sags toward the amber line; the alarm blinks from the moment it starts to fall
  const s = t - mem.sagAt, sag = s < 0 || s > 5 ? 0 : s < 1.8 ? smooth(s / 1.8) : s < 3.4 ? 1 : 1 - smooth((s - 3.4) / 1.6);
  P.bp.position.y -= 2.2 * sag;
  P.alarm.scale.setScalar(s >= 0 && s < 4 && mod(s, 0.4) < 0.22 ? 1.15 : 0);
  if (t > mem.sagAt + 9) mem.sagAt = t + 1.5 + hash(Math.floor(t), 4) * 2;
  mem.glow[0].color.setScalar(0.75 + 0.35 * pulse);
}

// ---------------------------------------------------------------------------------------------
// negotiation: two robots across a round table, a coin between them, speech bubbles that pop.
const GLYPHS = {
  offer: ['#...#', '...#.', '..#..', '.#...', '#...#'], // %
  query: ['.###.', '#...#', '..##.', '.....', '..#..'], // ?
  counter: ['..#..', '..#..', '..#..', '.....', '..#..'], // !
  deal: ['.....', '....#', '...#.', '#.#..', '.#...'], // a tick
};
function bubble(glyph, [fg, bg], left, [cx, y0, z]) {
  const b = box([cx - 4, y0, z], [cx + 4, y0 + 9, z]);
  for (let y = 2; y <= 9; y += 1) for (let x = -4; x <= 4; x += 1) {
    const edge = x === -4 || x === 4 || y === 2 || y === 9, corner = (x === -4 || x === 4) && (y === 2 || y === 9);
    if (corner) continue;
    b.put(cx + x, y0 + y, z, edge ? fg : (x + y) % 2 ? bg : 0);
  }
  pattern(b, glyph, { '#': K('glyph') }, [cx - 2, y0 + 8, z]);
  const tx = cx + (left ? 2 : -2); // the tail points down toward whoever is speaking
  b.put(tx, y0 + 1, z, fg); b.put(tx + (left ? 1 : -1), y0, z, fg);
  return b;
}
const SAYS = [['sayA0', 'offer', true], ['sayB1', 'query', false], ['sayA2', 'counter', true], ['sayB3', 'deal', false]]; // in turn: A offers, B queries, A counters, B agrees
function negotiationParts() {
  const table = box([-4, 14, -4], [3, 19, 3]);
  table.fill(-1, 14, -1, 0, 17, 0, (x, y) => (y === 14 ? C.iron2 : K('w1')));
  for (let z = -4; z <= 3; z += 1) for (let x = -4; x <= 3; x += 1) {
    const r = Math.hypot(x + 0.5, z + 0.5);
    if (r > 3.9) continue;
    table.put(x, 18, z, r > 3.1 ? (hash(x, z) < 0.3 ? K('brass3') : C.brass2) : x === -1 || x === 0 ? K('line2') : tone([K('w3'), K('w4')], x, 0, z, 9)); // a lit line down the middle
  }
  // the brass robot: knightly, riveted, a red plume, a visor that wraps round its face, a lit core in its chest
  const botA = box([-10, 14, -3], [-4, 29, 2]);
  for (const x of [-8, -6]) { botA.fill(x, 14, -1, x, 16, 0, (xx, y) => (y === 14 ? C.iron2 : y === 15 ? C.iron3 : K('botA2'))); botA.put(x + 1, 14, 0, C.iron2); }
  botA.fill(-9, 17, -2, -5, 21, 1, (x, y, z) => ((x + y + z) % 6 === 0 ? K('brass3') : y === 17 ? K('botA2') : x === -9 || z === -2 ? K('botA2') : C.brass2));
  for (const [x, y, z] of [[-7, 19, 1], [-7, 20, 1], [-6, 19, 1], [-5, 19, 0], [-5, 20, 0]]) botA.put(x, y, z, K('visor')); // its core
  botA.fill(-9, 22, -2, -5, 26, 1, (x, y, z) => ((y === 24 || y === 25) && (x === -5 || z === 1) ? K('visor') : y === 26 || y === 22 ? K('botA2') : (x + y) % 5 === 0 ? K('brass3') : C.brass2));
  botA.fill(-8, 27, -1, -6, 27, 0, C.iron2); botA.fill(-8, 28, -1, -6, 29, -1, (x, y) => (y === 29 && x === -8 ? 0 : C.cloth2)); botA.put(-9, 28, -1, C.cloth1); // the plume
  // the steel robot: squat and round, one big eye, a grille for a mouth, a light on its aerial
  const botB = box([3, 14, -4], [11, 28, 3]);
  for (const x of [5, 8]) botB.fill(x, 14, -1, x + 1, 14, 1, C.iron2);
  botB.egg(7, 18.4, 0, 3.2, 3.4, 3, (x, y, z) => (y === 18 ? K('steel2') : hash(x, y, z) < 0.22 ? K('steel3') : K('steel1')));
  botB.egg(7, 23.4, 0, 2.7, 2.3, 2.6, (x, y, z) => (y >= 24 ? K('steel3') : K('steel1')));
  for (let y = 22; y <= 24; y += 1) for (let z = -1; z <= 1; z += 1) botB.put(4, y, z, y === 23 && z === 0 ? K('eyeB2') : K('eyeB')); // the eye, facing its rival
  botB.put(5, 23, 2, K('eyeB')); botB.put(5, 22, 2, K('eyeB')); // and round toward us
  for (let z = -1; z <= 1; z += 1) botB.put(4, 19, z, (z + 2) % 2 ? C.iron1 : C.iron3); // the grille
  botB.fill(7, 26, 0, 7, 27, 0, C.iron2); botB.put(7, 28, 0, K('eyeB'));
  // arms that telescope out to push the coin, and the coin
  const armA = box([-6, 19, 2], [-3, 19, 2]);
  armA.fill(-6, 19, 2, -4, 19, 2, (x) => (x === -4 ? K('brass3') : C.iron2)); armA.put(-3, 19, 2, K('botA2'));
  const armB = box([2, 19, 2], [5, 19, 2]);
  armB.fill(3, 19, 2, 5, 19, 2, (x) => (x === 3 ? K('steel3') : C.iron2)); armB.put(2, 19, 2, K('steel2'));
  const coin = box([-2, 19, -2], [1, 19, 1]);
  for (let z = -2; z <= 1; z += 1) for (let x = -2; x <= 1; x += 1) if (Math.abs(x + 0.5) + Math.abs(z + 0.5) < 3) coin.put(x, 19, z, Math.abs(x + 0.5) + Math.abs(z + 0.5) > 1.5 ? K('coin2') : K('coin1'));
  const parts = { table: table.part('table', [0, 14, 0]) };
  const hang = (b, name, at) => { parts[name] = b.part(name, at, table); };
  hang(botA, 'botA', [-6.5, 14, 0]); hang(botB, 'botB', [7, 14, 0]);
  hang(armA, 'armA', [-4.5, 19.5, 2.5]); hang(armB, 'armB', [3.5, 19.5, 2.5]);
  hang(coin, 'coin', [-0.5, 19, -0.5]);
  for (const [n, g, left] of SAYS) {
    const at = [left ? -7 : 7, left ? 30 : 29, 1];
    hang(bubble(GLYPHS[g], left ? [K('sayA'), K('sayA2')] : [K('sayB'), K('sayB2')], left, at), n, [at[0] + 0.5, at[1], at[2] + 0.5]);
  }
  return parts;
}
const CYCLE = 3.2; // each turn: pop a bubble, then push the coin across
function negotiationIdle(ctx) {
  const { parts: P, state: { t }, mem } = ctx;
  const T = t - mem.t0, turn = Math.floor(T / CYCLE), u = T - turn * CYCLE, who = mod(turn, 4);
  const aTurn = who % 2 === 0;
  // the speaker's bubble pops (overshoots, holds, shrinks away); the others are hidden (no draw call)
  SAYS.forEach(([n], k) => {
    const s = k === who ? (u < 0.35 ? spring(u * 1.6) : u < 1.9 ? 1 : 1 - smooth((u - 1.9) / 0.3)) : 0;
    P[n].scale.setScalar(Math.max(0, s));
    P[n].position.y += 0.4 * Math.sin(t * 3 + k);
  });
  // then the speaker's arm telescopes out and slides the coin over to the other side
  const push = smooth((u - 1.1) / 0.8), back = 1 - smooth((u - 2.1) / 0.5);
  const reach = u > 1.1 ? Math.min(push, back) : 0;
  P.armA.position.x += aTurn ? 3.4 * reach : 0;
  P.armB.position.x -= aTurn ? 0 : 3.4 * reach;
  const from = aTurn ? -2 : 2, x = from + (aTurn ? 4 : -4) * push; // the coin rests where it was last pushed
  P.coin.position.x += x;
  P.coin.position.y += u > 1.3 && u < 1.9 ? 0.25 * Math.sin((u - 1.3) / 0.6 * Math.PI) : 0;
  P.coin.rotation.y = push * Math.PI * (aTurn ? 1 : -1);
  // speaking bobs you; listening tilts your head
  P.botA.position.y += aTurn && u < 1.9 ? 0.35 * Math.abs(Math.sin(u * 9)) : 0;
  P.botB.position.y += !aTurn && u < 1.9 ? 0.35 * Math.abs(Math.sin(u * 9)) : 0;
  P.botA.rotation.set(0, -0.45, !aTurn ? 0.06 * Math.sin(t * 2) : 0); // each turned a little toward us, the listener's head on one side
  P.botB.rotation.set(0, 0.45, aTurn ? 0.08 * Math.sin(t * 2.3) : 0);
  if (who === 3 && u > 0.2 && u < 0.25 && !mem.dealt) { mem.dealt = true; ctx.burst({ x: 0, y: 24 * ctx.voxel, z: 0.2 }, 12, 1.4, [0xffe08a, 0xff5ad8], 0.05, 0.7); }
  if (u > 0.5) mem.dealt = false;
}

// ---------------------------------------------------------------------------------------------
// emoji: a crystal in a brass claw and six emoji orbiting it, each with a second face on its back.
const FACES = {
  happy: ['.......', '..#.#..', '..#.#..', '.......', '.#...#.', '..###..', '.......'],
  sad: ['.......', '.#...#.', '..#.#..', '.b.....', '.b###..', '.#...#.', '.......'],
  surprised: ['.......', '.##.##.', '.##.##.', '.......', '...#...', '..#.#..', '...#...'],
  hearts: ['.......', 'r.r.r.r', 'rrr.rrr', '.r...r.', '.#...#.', '..###..', '.......'],
  laugh: ['.......', '.#...#.', '..#.#..', '.#...#.', '.......', '.#####.', '..#r#..'],
  wink: ['.......', '..#....', '..#.##.', '.......', '.#...#.', '..###..', '.......'],
  angry: ['.......', '.#...#.', '..#.#..', '.......', '..###..', '.#...#.', '.......'],
  meh: ['.......', '.......', '.##.##.', '.......', '.......', '.#####.', '.......'],
};
const TOKENS = [['happy', 'sad'], ['hearts', 'angry'], ['surprised', 'meh'], ['wink', 'sad'], ['laugh', 'surprised'], ['happy', 'angry']];
function token(front, back) {
  const b = box([-3, 18, -1], [3, 24, 0]);
  const put = (rows, x, y, z, rim, mad) => {
    const c = rows[3 - (y - 21)][x + 3];
    b.put(x, y, z, c === '#' ? K('emoInk') : c === 'r' ? K('emoRed') : c === 'b' ? K('emoBlue') : rim ? K('emo2') : mad ? K('emoMad') : K('emo1'));
  };
  for (let j = 0; j < 7; j += 1) for (let i = 0; i < 7; i += 1) {
    const r = Math.hypot(i - 3, j - 3);
    if (r > 3.4) continue;
    const x = i - 3, y = 21 + 3 - j, rim = r > 2.7;
    put(FACES[front], x, y, 0, rim, front === 'angry');
    const bx = -x; // the back face reads from behind
    const c = FACES[back][j][i];
    b.put(bx, y, -1, c === '#' ? K('emoInk') : c === 'r' ? K('emoRed') : c === 'b' ? K('emoBlue') : rim ? K('emo2') : back === 'angry' ? K('emoMad') : K('emo1'));
  }
  return b;
}
function emojiParts() {
  const socket = box([-4, 14, -4], [3, 18, 3]);
  for (let z = -4; z <= 3; z += 1) for (let x = -4; x <= 3; x += 1) {
    const r = Math.hypot(x + 0.5, z + 0.5), a = Math.atan2(x + 0.5, z + 0.5);
    if (r <= 3.7) socket.put(x, 14, z, r > 3 ? (hash(x, z) < 0.4 ? K('q2') : K('q1')) : tone([K('s2'), K('s3')], x, 14, z, 4));
    if (r <= 2.9) socket.put(x, 15, z, r > 2 ? (mod(Math.floor((a + 4) * 3), 2) ? K('crys2') : C.brass2) : C.brass1);
  }
  for (const [x, z] of [[-3, -3], [2, -3], [-3, 2], [2, 2]]) { socket.put(x, 16, z, K('brass3')); socket.put(x, 17, z, C.brass2); socket.put(x + (x < 0 ? 1 : -1), 18, z + (z < 0 ? 1 : -1), K('brass3')); } // the claw
  const crystal = box([-3, 15, -3], [2, 29, 2]);
  for (let y = 15; y <= 29; y += 1) {
    const R = y < 25 ? 2.4 : 2.4 * (29.6 - y) / 4.6;
    for (let z = -3; z <= 2; z += 1) for (let x = -3; x <= 2; x += 1) {
      const r = Math.hypot(x + 0.5, z + 0.5);
      if (r > R) continue;
      const facet = mod(Math.floor((Math.atan2(x + 0.5, z + 0.5) + Math.PI) / (Math.PI / 3)), 2);
      crystal.put(x, y, z, y >= 27 ? K('crys1') : hash(x, y, z) < 0.08 ? K('crys4') : r < 1.2 ? K('crys1') : facet ? K('crys2') : K('crys3'));
    }
  }
  const parts = { socket: socket.part('socket', [0, 14, 0]) };
  parts.crystal = crystal.part('crystal', [0, 21, 0], socket);
  TOKENS.forEach(([f, b], k) => { parts[`e${k}`] = token(f, b).part(`e${k}`, [0.5, 21.5, 0], socket); });
  return parts;
}
function emojiIdle(ctx) {
  const { parts: P, state: { t }, mem } = ctx;
  P.crystal.rotation.y = t * 0.6;
  P.crystal.scale.set(1 + 0.05 * Math.sin(t * 2.2), 1 + 0.03 * Math.sin(t * 2.2 + 1), 1 + 0.05 * Math.sin(t * 2.2));
  const all = mem.bonus ? mem.bonus - 1 + smooth((t - mem.allAt) / 0.6) : 0;
  for (let k = 0; k < 6; k += 1) {
    const a = t * 0.45 + (k * Math.PI) / 3, e = P[`e${k}`];
    const T = t + k * 1.37, n = Math.floor(T / 6.5), f = clamp01((T - n * 6.5) / 0.6); // each flips now and then, in turn
    e.position.x += Math.cos(a) * 7.6;
    e.position.z += Math.sin(a) * 7.6;
    e.position.y += 0.7 * Math.sin(t * 1.3 + k) + 1.4 * Math.sin(Math.PI * f) + 1.2 * Math.sin(Math.PI * clamp01((t - mem.allAt) / 0.6));
    e.rotation.y = Math.PI / 2 - a + Math.PI * (n + smooth(f) + all); // it faces outward, or shows its back
    e.rotation.z = 0.12 * Math.sin(t * 1.7 + k * 2);
  }
}

// ---------------------------------------------------------------------------------------------
// legal: brass scales with a bill on one pan and weights on the other, and a gavel on its block.
function panGrid(cx, load) {
  const x0 = Math.floor(cx) - 4, x1 = Math.ceil(cx) + 4;
  const b = box([x0, 17, -3], [x1, 28, 4]);
  const hook = [cx, 28, 0.5];
  for (const a of [Math.PI / 2, Math.PI * 7 / 6, Math.PI * 11 / 6]) { // three chains from the hook to the rim
    const rim = [cx + Math.cos(a) * 2.5, 21.5, 0.5 + Math.sin(a) * 2.5];
    for (let i = 0; i <= 14; i += 1) { const f = i / 14; b.put(Math.floor(hook[0] + (rim[0] - hook[0]) * f), Math.floor(hook[1] + (rim[1] - hook[1]) * f), Math.floor(hook[2] + (rim[2] - hook[2]) * f), i % 2 ? C.iron3 : C.iron2); }
  }
  for (let z = -3; z <= 4; z += 1) for (let x = x0; x <= x1; x += 1) {
    const r = Math.hypot(x + 0.5 - cx, z - 0.5);
    if (r <= 2.3) b.put(x, 20, z, C.brass1);
    else if (r <= 3.3) b.put(x, 21, z, mod(Math.floor(Math.atan2(z - 0.5, x + 0.5 - cx) * 3 + 10), 4) === 0 ? K('scrollInk') : hash(x, z) < 0.35 ? K('brass3') : C.brass2);
  }
  load(b);
  return b;
}
function legalParts() {
  const stand = box([-4, 14, -4], [8, 32, 3]);
  for (let z = -4; z <= 3; z += 1) for (let x = -4; x <= 3; x += 1) {
    const r = Math.hypot(x + 0.5, z + 0.5), a = Math.atan2(x + 0.5, z + 0.5);
    if (r <= 3.4) stand.put(x, 14, z, r > 2.6 ? (hash(x, z) < 0.3 ? K('brass3') : C.brass2) : C.brass1);
    if (r <= 2.5) stand.put(x, 15, z, r > 1.6 ? (mod(Math.floor((a + 4) * 3), 2) ? K('scrollInk') : C.brass2) : K('brass3'));
  }
  stand.fill(-1, 16, -1, 0, 28, 0, (x, y) => (y === 19 || y === 24 ? C.iron2 : y % 2 ? C.brass2 : K('brass3')));
  for (const y of [19, 24]) for (const [x, z] of [[-2, -1], [-2, 0], [1, -1], [1, 0], [-1, -2], [0, -2], [-1, 1], [0, 1]]) stand.put(x, y, z, C.iron2);
  stand.fill(-1, 29, -1, 0, 30, 0, K('brass3')); stand.put(-1, 31, -1, K('scrollInk')); stand.put(0, 31, 0, K('scrollInk')); stand.put(-1, 32, 0, K('scrollInk'));
  for (const [x, y] of [[-3, 25], [-2, 26], [-1, 26], [0, 26], [1, 26], [2, 25]]) stand.put(x, y, 1, x === -1 || x === 0 ? K('ecgHot') : K('scrollInk')); // the dial the needle reads
  stand.fill(4, 14, -2, 5, 15, 1, (x, y, z) => (y === 15 && (z === -2 || z === 1) ? C.brass2 : K('gavel2'))); // the gavel's block
  const beam = box([-9, 25, -1], [8, 30, 1]);
  beam.fill(-8, 29, 0, 7, 29, 0, (x) => (x % 4 === 1 ? K('scrollInk') : x % 2 ? K('brass3') : C.brass2)); // lit studs along it
  for (const x of [-9, 8]) { beam.put(x, 29, 0, K('brass3')); beam.put(x, 30, 0, K('scrollInk')); beam.put(x + (x < 0 ? 1 : -1), 30, 0, K('brass3')); } // scrolled ends, a gem in each
  for (const x of [-8, 7]) beam.put(x, 28, 0, C.iron2); // hooks
  beam.fill(-1, 25, 1, 0, 28, 1, (x, y) => (y === 25 ? K('ecgHot') : K('brass3'))); // the needle
  beam.fill(-1, 29, -1, 0, 29, 1, C.iron3);
  const panL = panGrid(-7.5, (b) => { // the bill: a rolled scroll, its flap over the rim, lines of light on it, a red seal
    for (let x = -10; x <= -6; x += 1) { b.put(x, 22, 0, x === -10 || x === -6 ? K('scroll2') : K('scroll')); b.put(x, 22, 1, K('scroll')); b.put(x, 23, 0, K('scroll2')); }
    for (let y = 18; y <= 22; y += 1) for (let x = -10; x <= -6; x += 1) b.put(x, y, 2 + (y < 21 ? 1 : 0), (y === 21 || y === 19) && x > -10 && x < -6 ? K('scrollInk') : K('scroll'));
    b.put(-8, 18, 3, K('seal')); b.put(-7, 18, 3, K('seal'));
  });
  const panR = panGrid(7.5, (b) => { // the weights
    for (let z = -1; z <= 2; z += 1) for (let x = 5; x <= 9; x += 1) { const r = Math.hypot(x + 0.5 - 7.5, z - 0.5); if (r <= 1.6) { b.put(x, 22, z, C.brass1); b.put(x, 23, z, r > 1 ? K('brass3') : C.brass2); } }
    b.put(7, 24, 0, C.brass2); b.put(7, 25, 0, K('brass3')); b.put(7, 24, 1, C.brass2);
  });
  const gavel = box([3, 16, -3], [9, 17, 2]);
  gavel.fill(4, 16, -2, 5, 17, 1, (x, y, z) => (z === -2 || z === 1 ? K('brass3') : K('gavel1')));
  gavel.fill(6, 16, 0, 9, 16, 0, (x) => (x === 9 ? C.brass2 : K('gavel2')));
  const parts = { stand: stand.part('stand', [0, 14, 0]) };
  parts.beam = beam.part('beam', [0, 29.5, 0.5], stand);
  parts.panL = panL.part('panL', [-7.5, 28.5, 0.5], stand);
  parts.panR = panR.part('panR', [7.5, 28.5, 0.5], stand);
  parts.gavel = gavel.part('gavel', [9.5, 16.5, 0.5], stand);
  return parts;
}
function legalIdle(ctx) {
  const { parts: P, state: { t }, mem } = ctx;
  const d = t - mem.verdictAt; // a verdict: the bill's side goes down and stays a moment
  const decide = d > 0 && d < 5 ? smooth(d / 0.9) * (1 - smooth((d - 3.8) / 1.2)) : 0;
  const th = (0.1 * Math.sin(t * 0.9) + 0.03 * Math.sin(t * 2.3)) * (1 - decide) + 0.3 * decide;
  P.beam.rotation.z = th;
  for (const [n, hx] of [['panL', -7.5], ['panR', 7.5]]) { // the pans hang level from the beam's ends
    const [x, y] = [hx, -1.5];
    P[n].position.x += x * Math.cos(th) - y * Math.sin(th) - x;
    P[n].position.y += x * Math.sin(th) + y * Math.cos(th) - y;
    P[n].rotation.z = 0.04 * Math.sin(t * 1.7 + hx);
  }
  // the gavel raps twice once the scales settle (and now and then on its own)
  const g = d > 1.1 && d < 2.2 ? d - 1.1 : mod(t, 9.5) > 8.4 ? mod(t, 9.5) - 8.4 : -1;
  if (g >= 0) {
    const r = g < 0.55 ? g / 0.55 : (g - 0.55) / 0.55, lift = Math.sin(Math.PI * clamp01(r)) ** 0.6;
    P.gavel.rotation.z = -0.55 * lift;
    const k = g < 0.55 ? 0 : 1;
    if (r > 0.9 && mem.rap !== k + Math.floor(t / 9.5) * 2) { mem.rap = k + Math.floor(t / 9.5) * 2; ctx.burst({ x: 4.5 * ctx.voxel, y: 16 * ctx.voxel, z: 0 }, 8, 1.1, [0xffe6a8, 0xffc764], 0.04, 0.45); }
  }
}

// ---------------------------------------------------------------------------------------------
const KINDS = {
  icu: { accent: 'ecg', hex: [0xe6fff0, 0x5dffb0], parts: icuParts, root: 'bed', idle: icuIdle, own: ['ecg'], setup: (ctx) => { ctx.mem.sagAt = 3; }, act: (ctx) => { ctx.mem.sagAt = ctx.state.t + 1.2; } },
  negotiation: { accent: 'sayA', hex: [0xd8fdff, 0xff5ad8], parts: negotiationParts, root: 'table', idle: negotiationIdle, setup: (ctx) => { ctx.mem.t0 = 0; }, act: (ctx) => { ctx.after(0.25, () => { ctx.mem.t0 = ctx.state.t + 0.75 - 3 * CYCLE; }); } }, // skip to the deal while it lies folded
  emoji: { accent: 'crys2', hex: [0xfff4c0, 0xffd23f], parts: emojiParts, root: 'socket', idle: emojiIdle, setup: (ctx) => { ctx.mem.bonus = 0; ctx.mem.allAt = -10; }, act: (ctx) => { ctx.mem.bonus += 1; ctx.mem.allAt = ctx.state.t + 1.1; } },
  legal: { accent: 'scrollInk', hex: [0xfff0c8, 0xffc764], parts: legalParts, root: 'stand', idle: legalIdle, setup: (ctx) => { ctx.mem.verdictAt = -10; }, act: (ctx) => { ctx.mem.verdictAt = ctx.state.t + 1; } },
};
const built = {};
export function lectern(kind) {
  const k = KINDS[kind];
  return {
    gait: 'still',
    build() {
      if (!built[kind]) built[kind] = { parts: { base: lecternGrid(K(k.accent)).part('base', [0, 0, 0]), ...k.parts() } };
      return built[kind];
    },
    setup(ctx) {
      ctx.mem.popAt = -10;
      if (k.own) ctx.mem.glow = ownGlow(ctx, k.own);
      k.setup(ctx);
    },
    idle(ctx, dt) {
      const { parts: P, state: { t }, mem } = ctx;
      // the pop-up: folds flat into the book, then springs back up with a little overshoot
      const u = t - mem.popAt;
      if (u < 2) {
        const sy = u < 0.25 ? 1 - 0.95 * smooth(u / 0.25) : 0.05 + 0.95 * spring((u - 0.25) * 1.1);
        const sq = Math.min(1.12, Math.max(0.9, 1 - 0.5 * (sy - 1)));
        P[k.root].scale.set(sq, Math.max(0.02, sy), sq);
        if (u > 0.3 && !mem.popped) { mem.popped = true; ctx.burst({ x: 0, y: 14.5 * ctx.voxel, z: 0 }, 14, 1.8, k.hex, 0.05, 0.7); }
      } else mem.popped = false;
      k.idle(ctx, dt);
    },
    act(ctx) { ctx.mem.popAt = ctx.state.t; k.act(ctx); },
  };
}

// A self-check: node js/models/obs_lecterns.js (every kind builds, its parts are not empty, its pans hang inside their grids)
if (typeof window === 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const count = (g) => g.data.reduce((n, v) => n + (v ? 1 : 0), 0);
  for (const kind of Object.keys(KINDS)) {
    const { parts } = lectern(kind).build();
    for (const [n, p] of Object.entries(parts)) if (!count(p.grid)) throw new Error(`${kind}.${n} is empty`);
    console.log(kind, Object.fromEntries(Object.entries(parts).map(([n, p]) => [n, count(p.grid)])));
  }
  if (Math.abs(spring(3) - 1) > 1e-3) throw new Error('the pop should settle');
  console.log('obs_lecterns.js ok');
}
