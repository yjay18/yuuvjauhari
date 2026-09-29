// The town's animals, each a rig definition (0.15 a voxel, origin at the feet or on the waterline, facing +z,
// colours prefixed nat_). The flocks and herds are drawn as rig-kit crowds: js/town/nature.js sets `def.m`,
// the member being posed (its own clock and state), before posing each one, and `idle` reads it. The ones
// who live alone (the cats, the dog, the rooster, the rubber duck) are rigs of their own and keep state in ctx.mem.
//
//   duck('drake'|'hen') duckling() rubberDuck() swan() gull() songbird() pigeon() chicken() rooster()
//   sheep() cow() fish() butterfly() bat() cat(coat, pose) dog()
// and two static pieces in the flora's form ({ parts, flex, h, r }, see nat_flora.js): coop() and scarecrow().
//
// Member fields the idles read (all optional): t (its clock), dab (0..1 dabbling), quack (seconds since),
// fly (0..1 wings out), flap (flap rate), look (head turn), graze (0..1 head down), hop (0..1), turn (body yaw
// already in the matrix), neck (swan: 0..1 into the heart), roll (cat), wag (dog).
import { C, colour, hash, noise } from '../kit/voxel-kit.js';
import { box, tone, smooth, clamp01 } from './space.js';

const col = (name, hex, glow = false) => C[name] ?? colour(name, hex, glow);
for (const [n, hex, glow] of [
  ['eye', 0x151515], ['glint', 0xffffff], ['black', 0x1c1c20], ['white', 0xf2eee6],
  // mallards
  ['dkChest', 0x6e3424], ['dkChest2', 0x84402e], ['dkBack', 0x6e685e], ['dkGrey1', 0xb8b4aa], ['dkGrey2', 0xa4a096], ['dkWing', 0x8a8478], ['dkSpec', 0x4652c8],
  ['dkHead', 0x1d6a3c], ['dkHead2', 0x2f8c54], ['dkBill', 0xe6c03a],
  ['hn1', 0x8e6c44], ['hn2', 0xa8885a], ['hn3', 0x6a4c2e], ['hnStripe', 0x4a3422], ['hnBill', 0xd08a3a],
  ['dl1', 0xf2d870], ['dl2', 0xa88a4a], ['dlBill', 0x4a3a2a],
  // the rubber duck, captain of the canal
  ['rb1', 0xffd23f], ['rb2', 0xf2b62a], ['rb3', 0xffe680], ['rbBill', 0xff8b22], ['rbBill2', 0xe0701a], ['cap1', 0x1e2a52], ['cap2', 0x2a3a6c], ['capBadge', 0xf0c24a],
  // swans
  ['sw1', 0xfaf8f2], ['sw2', 0xece8e0], ['sw3', 0xd8d2c6], ['swBill', 0xe8702a],
  // gulls
  ['gu1', 0xf6f6f2], ['gu2', 0x9aa4ae], ['gu3', 0x7e8894], ['guBill', 0xf0c03a], ['guSpot', 0xd8342a], ['guLeg', 0xe8a8a0], ['guEye', 0xe8e070],
  // songbirds, pigeons
  ['sb1', 0xd8cfc0], ['sb2', 0xfff6e8], ['sb3', 0x6a5a4a], ['sbBill', 0x3a3632],
  ['pg1', 0x9aa0ac], ['pg2', 0x868c98], ['pg3', 0xb4b9c4], ['pgBar', 0x4a4e5a], ['pgN1', 0x4f9a7a], ['pgN2', 0x8a5aa8], ['pgLeg', 0xd88a8a], ['pgEye', 0xffa040, true], ['pgBill', 0x2e2a28], ['pgCere', 0xe8e0d8],
  // cats: ginger, black, grey tabby; the eyes shine
  ['cgO1', 0xe0903a], ['cgO2', 0xc26e24], ['cgW', 0xf4ece0], ['cgPink', 0xe79a9a],
  ['cbK1', 0x26262c], ['cbK2', 0x34343c], ['cyG1', 0x9a9aa2], ['cyG2', 0x6e6e78],
  ['catEyeG', 0xa8ff5a, true], ['catEyeA', 0xffc23a, true],
  // the dog
  ['dg1', 0xc8965a], ['dg2', 0xb07e46], ['dg3', 0x8a5e34], ['dgW', 0xf2e8d6], ['dgEar', 0x7a5230], ['dgTongue', 0xe06a7a], ['dgCollar', 0xc8323a], ['dgTag', 0xf0c24a],
  // chickens and their rooster
  ['ch1', 0xf4f0e6], ['ch2', 0xe0d8c6], ['chComb', 0xd8282a], ['chBill', 0xe8a83a], ['chLeg', 0xe8b83a],
  ['rs1', 0x9a3a1e], ['rs2', 0xe0a040], ['rs3', 0x1e2a24], ['rsT1', 0x1e4a34], ['rsT2', 0x2a6a4a],
  // sheep and cows
  ['sh1', 0xf2ecde], ['sh2', 0xe2dac6], ['sh3', 0xd0c6b0], ['shK', 0x2e2826], ['shK2', 0x3e3432], ['shK3', 0x5a4e48], ['shEye', 0xece2c4],
  ['cwK', 0x1e1e22], ['cwW', 0xf2f0e8], ['cwW2', 0xdedbd0], ['cwPink', 0xe8b0a8], ['cwHorn', 0xe8dcc0], ['cwHoof', 0x2a2420], ['cwBell', 0xd4a83e], ['cwStrap', 0x6a3f26],
  // fish, butterflies, bats
  ['fish1', 0x3a5a7a], ['fish2', 0xa8c4d8], ['fish3', 0xe8f0f4], ['fishFin', 0x6a8aa8],
  ['bf1', 0xfaf6ec], ['bf2', 0x2a2430],
  ['bt1', 0x2a2230], ['bt2', 0x3e3246], ['btEye', 0xff5a3a, true],
  // the coop and the scarecrow
  ['cp1', 0x7a5634], ['cp2', 0x8a6440], ['cp3', 0x5e4228], ['cpRoof1', 0x6a4a5a], ['cpRoof2', 0x7a5a6a], ['straw', 0xe0c878], ['wattle1', 0x8a6a44], ['wattle2', 0x6e5234], ['trough', 0x6a6460], ['water', 0x5ab8d8],
  ['sc1', 0x6a4a8a], ['sc2', 0x8a3a3a], ['scHat', 0x4a3a2a], ['pumpkin', 0xe0741e], ['jack', 0xffb347, true],
]) col(`nat_${n}`, hex, glow);
const K = (n) => C[`nat_${n}`];
const mod = (a, n) => ((a % n) + n) % n;
const still = (build, idle, extra = {}) => ({ gait: 'still', build, idle, ...extra });

// ---- ducks -----------------------------------------------------------------------------------------
// A mallard on the water (y 0 the waterline): drake in his green hood and white collar, or the mottled hen.
// Parts: body, head (on the body, pivot at the neck). Member: dab (tail up, head under), quack, look.
export function duck(kind = 'drake') {
  const D = kind === 'drake';
  const build = () => {
    const body = box([-3, -1, -5], [2, 4, 3]);
    body.egg(0, 1.2, -0.6, 2.4, 1.7, 3.4, (x, y, z) => {
      if (z >= 1 && y <= 2) return D ? (hash(x, y, z) < 0.3 ? K('dkChest2') : K('dkChest')) : K('hn2');
      if (Math.abs(x + 0.5) >= 1.6 && y >= 1 && y <= 2 && z <= -1 && z >= -3) return z === -2 ? K('dkSpec') : D ? K('dkWing') : K('hn3');
      if (y >= 2) return D ? K('dkBack') : tone([K('hn1'), K('hn3'), K('hn1')], x, y, z, 3);
      return D ? (hash(x, y, z) < 0.4 ? K('dkGrey2') : K('dkGrey1')) : tone([K('hn1'), K('hn2'), K('hn3')], x, y, z, 5);
    });
    body.fill(-1, 1, -5, 0, 2, -5, (x, y) => (D ? (y === 1 ? K('black') : K('white')) : K('hn3')));
    if (D) { body.put(-1, 3, -4, K('black')); body.put(-1, 4, -3, K('black')); } // his curl
    const head = box([-2, 2, 0], [1, 7, 5]);
    head.fill(-1, 2, 1, 0, 3, 2, (x, y) => (D ? (y === 3 ? K('white') : K('dkChest')) : K('hn2')));
    head.egg(0, 4.6, 2.3, 1.6, 1.25, 1.5, (x, y, z) => (D ? (y >= 5 && hash(x, y, z) < 0.5 ? K('dkHead2') : K('dkHead')) : y === 5 && z >= 2 ? K('hnStripe') : K('hn1')));
    head.fill(-1, 4, 4, 0, 4, 5, (x, y, z) => (z === 5 && D ? K('dkBill') : D ? K('dkBill') : K('hnBill')));
    head.put(-2, 5, 3, K('eye')); head.put(1, 5, 3, K('eye'));
    return { parts: { body: body.part('body', [0, 0, 0]), head: head.part('head', [-0.5, 2.5, 1.5], body) } };
  };
  return still(build, function idle(ctx) {
    const m = this.m || {}, { parts: P, pose } = ctx, t = m.t ?? ctx.state.t, s = m.seed || 0;
    const dab = m.dab || 0, q = m.quack ?? 9;
    pose.position.y += 0.03 * Math.sin(t * 2.2 + s) - 0.06 * dab;
    pose.rotation.z += 0.05 * Math.sin(t * 1.7 + s);
    pose.rotation.x += 1.35 * dab + 0.05 * Math.sin(t * 2.2 + s + 1);
    const bounce = q < 0.5 ? Math.sin((q / 0.5) * Math.PI) : 0;
    pose.position.y += 0.12 * bounce;
    P.head.rotation.y += (m.look || 0) + 0.35 * Math.sin(t * 0.43 + s * 3) * (1 - dab);
    P.head.rotation.x += 0.7 * dab - 0.5 * bounce + (q < 0.9 ? 0.15 * Math.sin(q * 30) * (1 - q / 0.9) : 0);
  });
}
// A duckling: fluff and a bill, bobbing along behind its mother.
export function duckling() {
  return still(() => {
    const b = box([-2, -1, -3], [1, 3, 2]);
    b.egg(0, 0.9, -0.3, 1.4, 1.1, 1.7, (x, y) => (y >= 1 ? K('dl2') : K('dl1')));
    b.egg(0, 2.2, 1, 1.1, 1, 1.05, (x, y) => (y >= 3 ? K('dl2') : K('dl1')));
    b.put(-1, 2, 2, K('dlBill')); b.put(0, 2, 2, K('dlBill')); b.put(-2, 2, 1, K('eye')); b.put(1, 2, 1, K('eye'));
    return { parts: { body: b.part('body', [0, 0, 0]) } };
  }, function idle(ctx) { const m = this.m || {}, t = m.t ?? ctx.state.t; ctx.pose.position.y += 0.02 * Math.sin(t * 3.1 + (m.seed || 0)); ctx.pose.rotation.z += 0.08 * Math.sin(t * 2.3 + (m.seed || 0)); });
}
// The rubber duck: the town's running joke, captain of the canal in a navy cap with a gold badge. It cannot
// paddle, so it turns slowly as it drifts along with the flock. ctx.mem.squeak: the time it was squeezed.
export function rubberDuck() {
  return {
    gait: 'still',
    build() {
      const b = box([-4, -1, -5], [3, 9, 5]);
      b.egg(0, 1.5, -0.4, 2.7, 1.9, 3.3, (x, y, z) => (y >= 3 ? K('rb2') : y === 0 ? K('rb2') : K('rb1')));
      b.fill(-1, 3, -5, 0, 4, -4, K('rb1')); b.put(-1, 5, -5, K('rb3')); b.put(0, 5, -5, K('rb3')); // the tail up
      b.egg(0, 4.9, 1.3, 2, 1.9, 1.9, (x, y, z) => (y >= 6 && z <= 1 ? K('rb3') : K('rb1')));
      b.fill(-2, 3, 3, 1, 4, 4, (x, y, z) => (y === 3 && z === 4 ? K('rbBill2') : K('rbBill'))); // the bill, a grin
      for (const x of [-3, 2]) { b.put(x, 5, 2, K('eye')); b.put(x, 6, 2, K('glint')); }
      for (const x of [-3, 2]) b.put(x, 2, -1, K('rb2')); // a wing, just
      b.fill(-2, 7, 0, 1, 7, 2, K('cap1')); b.fill(-2, 7, 3, 1, 7, 3, K('cap2')); b.fill(-1, 8, 0, 0, 8, 2, K('cap1')); b.put(-1, 8, 2, K('capBadge')); b.put(0, 8, 2, K('capBadge'));
      return { parts: { duck: b.part('duck', [0, 0, 0]) } };
    },
    setup(ctx) { ctx.mem.squeak = -10; },
    idle(ctx) {
      const { parts: P, state: { t }, mem } = ctx, q = t - mem.squeak;
      P.duck.rotation.z += 0.07 * Math.sin(t * 1.9); P.duck.rotation.x += 0.05 * Math.sin(t * 2.4 + 1);
      P.duck.position.y += 0.4 * Math.sin(t * 2.1);
      const sq = q < 0.6 ? Math.sin((q / 0.6) * Math.PI) : 0;
      P.duck.scale.set(1 + 0.18 * sq, 1 - 0.25 * sq + (q > 0.3 && q < 0.8 ? 0.15 * Math.sin(((q - 0.3) / 0.5) * Math.PI) : 0), 1 + 0.18 * sq);
    },
  };
}

// ---- swans ------------------------------------------------------------------------------------------
// A mute swan on the river: arched wings, an S of a neck, an orange bill with its black knob. Parts: body,
// neck (on the body, pivot at its base). Member: neck (0..1, curved down toward its mate: the heart), look.
export function swan() {
  const build = () => {
    const body = box([-4, -1, -8], [3, 6, 4]);
    const W = (x, y, z) => (y >= 2 && mod(y + z, 3) === 0 ? K('sw3') : hash(x, y, z) < 0.35 ? K('sw2') : K('sw1'));
    body.egg(0, 1.6, -1, 3, 2.2, 5, W);
    for (const s of [-1, 1]) body.egg(s * 1.7 - 0.5 + 0.5, 3.2, -2.2, 1.5, 1.4, 3.2, W);
    body.fill(-1, 3, -7, 0, 4, -6, K('sw2')); body.put(-1, 5, -7, K('sw1')); body.put(0, 5, -7, K('sw1'));
    const neck = box([-2, 2, 0], [1, 14, 8]);
    neck.rope([[-0.0, 3, 2.6], [0, 6, 4.3], [0, 9, 3.3], [0, 11.2, 3.6]], 1.05, 0.8, K('sw1'));
    neck.egg(0, 11.7, 4.3, 1.15, 1.05, 1.6, K('sw1'));
    neck.fill(-1, 11, 6, 0, 11, 7, K('swBill')); neck.put(-1, 12, 5, K('black')); neck.put(0, 12, 5, K('black'));
    neck.put(-2, 12, 4, K('eye')); neck.put(1, 12, 4, K('eye')); neck.put(-2, 11, 5, K('black')); neck.put(1, 11, 5, K('black'));
    return { parts: { body: body.part('body', [0, 0, 0]), neck: neck.part('neck', [-0.5, 3, 2.5], body) } };
  };
  return still(build, function idle(ctx) {
    const m = this.m || {}, { parts: P, pose } = ctx, t = m.t ?? ctx.state.t, s = m.seed || 0, h = m.neck || 0;
    pose.position.y += 0.025 * Math.sin(t * 1.3 + s);
    pose.rotation.z += 0.03 * Math.sin(t * 0.9 + s);
    P.neck.rotation.x += 0.12 * Math.sin(t * 0.5 + s) + 0.55 * h;
    P.neck.rotation.y += (m.look || 0) * (1 - h) + 0.2 * Math.sin(t * 0.31 + s) * (1 - h);
    P.neck.rotation.z += 0.25 * h * (m.side || 1);
  });
}

// ---- birds that fly -----------------------------------------------------------------------------------
// Wings are flat slabs on shoulder pivots: spread and flapping (rotation about z), or folded back along the
// body (rotation about y). Member: fly (0 folded .. 1 spread), flap (radians of beat), bank (roll).
function wings(ctx, m, t, spread = 1.45, droop = 0.25) {
  const { parts: P } = ctx, f = m.fly ?? 0, beat = f * (m.beat ?? Math.sin(t * (m.rate || 11) + (m.seed || 0)) * 0.9);
  P.wingL.rotation.z += beat + 0.12 * f; P.wingR.rotation.z -= beat + 0.12 * f;
  P.wingL.rotation.y -= spread * (1 - f); P.wingR.rotation.y += spread * (1 - f);
  P.wingL.rotation.z -= droop * (1 - f); P.wingR.rotation.z += droop * (1 - f);
}
function slab(x0, x1, y, z0, z1, id) { const b = box([Math.min(x0, x1), y, z0], [Math.max(x0, x1), y, z1]); b.fill(Math.min(x0, x1), y, z0, Math.max(x0, x1), y, z1, id); return b; }

// A herring gull: white, a grey mantle, black wingtips with white mirrors, a yellow bill with its red spot,
// and a stern pale eye under a grey brow. Parts: body, wingL, wingR.
export function gull() {
  const build = () => {
    const body = box([-2, 0, -5], [1, 6, 5]);
    body.egg(0, 3.1, -0.2, 1.6, 1.5, 3.1, (x, y, z) => (y >= 4 && z < 1 ? K('gu2') : K('gu1')));
    body.fill(-1, 3, -5, 0, 3, -4, K('gu1'));
    body.egg(0, 4.6, 2.5, 1.35, 1.3, 1.35, K('gu1'));
    body.fill(-1, 4, 4, 0, 4, 5, (x, y, z) => (z === 5 ? K('guSpot') : K('guBill')));
    for (const x of [-2, 1]) { body.put(x, 5, 3, K('guEye')); body.put(x, 6, 3, K('gu2')); }
    for (const x of [-1, 0]) body.fill(x, 0, 0, x, 1, 0, K('guLeg'));
    const wing = (s) => {
      const b = box([Math.min(s, s * 8), 3, -2], [Math.max(s, s * 8), 3, 1]);
      for (let i = 1; i <= 8; i += 1) for (let z = -2; z <= 1; z += 1) {
        if (i > 6 && z === -2) continue;
        b.put(s * i, 3, z, i >= 7 ? (i === 8 && z === 0 ? K('gu1') : K('black')) : z === 1 ? K('gu1') : K('gu2'));
      }
      return b;
    };
    return { parts: { body: body.part('body', [0, 0, 0]), wingL: wing(1).part('wingL', [1, 3.5, 0]), wingR: wing(-1).part('wingR', [-1, 3.5, 0]) } };
  };
  return still(build, function idle(ctx) {
    const m = this.m || {}, t = m.t ?? ctx.state.t, { pose } = ctx;
    wings(ctx, m, t, 1.5, 0.2);
    pose.rotation.z += m.bank || 0;
    pose.rotation.x += (m.pitch || 0) - 0.6 * (m.squawk || 0);
  });
}
// A songbird (the flock is tinted per bird): brown back, pale breast, a dark bill. Parts: body, wingL, wingR.
export function songbird() {
  const build = () => {
    const body = box([-2, 0, -3], [1, 3, 3]);
    body.egg(0, 1.3, 0, 1.1, 1.05, 1.7, (x, y, z) => (z >= 0 && y <= 1 ? K('sb2') : K('sb1')));
    body.put(-1, 1, -2, K('sb3')); body.put(0, 1, -2, K('sb3')); body.put(0, 1, -3, K('sb3'));
    body.put(0, 1, 2, K('sbBill')); body.put(-1, 2, 1, K('eye')); body.put(0, 2, 1, K('eye'));
    return { parts: { body: body.part('body', [0, 0, 0]), wingL: slab(1, 3, 1, -1, 0, K('sb3')).part('wingL', [0.5, 1.5, 0]), wingR: slab(-2, -4, 1, -1, 0, K('sb3')).part('wingR', [-1.5, 1.5, 0]) } };
  };
  return still(build, function idle(ctx) { const m = this.m || {}; wings(ctx, m, m.t ?? ctx.state.t, 1.3, 0.1); ctx.pose.rotation.z += m.bank || 0; });
}
// A town pigeon: grey, dark wing bars, a green and violet neck, orange eyes, pink feet. Parts: body, head (on
// the body), wingL, wingR. Member: walk (the head bobs), peck, fly.
export function pigeon() {
  const build = () => {
    const body = box([-3, 0, -5], [2, 5, 3]);
    body.egg(0, 2.3, -0.6, 1.8, 1.7, 2.7, (x, y, z) => (z >= 1 && y <= 2 ? K('pg3') : y >= 3 && z < 0 ? K('pg2') : K('pg1')));
    body.fill(-1, 2, -5, 0, 2, -3, (x, y, z) => (z === -5 ? K('pgBar') : K('pg2')));
    for (const x of [-1, 0]) { body.put(x, 0, 0, K('pgLeg')); body.put(x, 0, 1, K('pgLeg')); }
    const head = box([-2, 3, -1], [1, 7, 4]);
    head.fill(-1, 3, 0, 0, 4, 1, (x, y) => (y === 3 ? K('pgN2') : K('pgN1')));
    head.egg(0, 5.3, 1.4, 1.25, 1.15, 1.35, K('pg3'));
    head.put(-1, 5, 3, K('pgBill')); head.put(0, 5, 3, K('pgBill')); head.put(-1, 6, 2, K('pgCere')); head.put(0, 6, 2, K('pgCere'));
    head.put(-2, 5, 1, K('pgEye')); head.put(1, 5, 1, K('pgEye'));
    const wing = (s) => { const b = box([Math.min(s, s * 6), 3, -2], [Math.max(s, s * 6), 3, 1]); for (let i = 1; i <= 6; i += 1) for (let z = -2; z <= 1; z += 1) b.put(s * i, 3, z, i >= 6 ? K('pgBar') : (i === 3 || i === 4) && z <= -1 ? K('pgBar') : K('pg2')); return b; };
    return { parts: { body: body.part('body', [0, 0, 0]), head: head.part('head', [-0.5, 3.5, 0.5], body), wingL: wing(1).part('wingL', [1, 3.4, 0]), wingR: wing(-1).part('wingR', [-1, 3.4, 0]) } };
  };
  return still(build, function idle(ctx) {
    const m = this.m || {}, t = m.t ?? ctx.state.t, { parts: P, pose } = ctx, s = m.seed || 0;
    wings(ctx, m, t, 1.5, 0.15);
    const walk = (m.walk || 0) * (1 - (m.fly || 0)), bob = Math.sin(t * 9 + s);
    P.head.position.z += walk * 0.9 * bob;
    const peck = m.peck || 0;
    P.head.rotation.x += 1.1 * peck;
    pose.rotation.x += 0.35 * peck + (m.pitch || 0);
    pose.rotation.z += m.bank || 0;
    P.head.rotation.y += 0.4 * Math.sin(t * 0.7 + s * 2) * (1 - walk);
    pose.scale.setScalar(1 + (m.coo || 0) * 0.12);
  });
}

// ---- farmyard ------------------------------------------------------------------------------------------
// A hen (tinted per bird: white, buff, brown). Parts: body, head (on the body), wings. Member: peck, flap.
export function chicken() {
  const build = () => {
    const body = box([-3, 0, -4], [2, 6, 3]);
    body.egg(0, 2.8, -0.4, 1.8, 2, 2.3, (x, y, z) => (hash(x, y, z) < 0.3 ? K('ch2') : K('ch1')));
    body.fill(-1, 4, -4, 0, 5, -3, K('ch2')); body.put(-1, 6, -4, K('ch1'));
    for (const x of [-1, 0]) { body.put(x, 0, 0, K('chLeg')); body.put(x, 1, 0, K('chLeg')); body.put(x, 0, 1, K('chLeg')); }
    const head = box([-2, 4, 0], [1, 8, 4]);
    head.egg(0, 5.4, 1.8, 1.05, 1.1, 1.15, K('ch1'));
    head.fill(0, 7, 1, 0, 7, 2, K('chComb')); head.put(0, 8, 1, K('chComb')); head.put(-1, 7, 2, K('chComb'));
    head.put(-1, 5, 3, K('chBill')); head.put(0, 5, 3, K('chBill')); head.put(0, 4, 3, K('chComb'));
    head.put(-2, 6, 2, K('eye')); head.put(1, 6, 2, K('eye'));
    const w = box([-3, 2, -2], [2, 4, 1]); for (const x of [-3, 2]) w.fill(x, 2, -2, x, 4, 1, (xx, y, z) => (y === 4 || z === -2 ? K('ch2') : K('ch1')));
    return { parts: { body: body.part('body', [0, 0, 0]), head: head.part('head', [-0.5, 4.5, 1], body), wings: w.part('wings', [0, 4, 0], body) } };
  };
  return still(build, function idle(ctx) {
    const m = this.m || {}, t = m.t ?? ctx.state.t, { parts: P, pose } = ctx, s = m.seed || 0;
    const peck = m.peck || 0, flap = m.flap || 0;
    P.head.rotation.x += 1.2 * peck; pose.rotation.x += 0.3 * peck;
    P.head.position.z += 0.5 * Math.sin(t * 7 + s) * (m.walk || 0);
    P.head.rotation.y += 0.5 * Math.sin(t * 0.8 + s) * (1 - peck);
    P.wings.scale.set(1 + 0.8 * flap, 1 + 1.4 * flap * Math.abs(Math.sin(t * 24)), 1);
    pose.position.y += (m.hop || 0) * 0.35;
  });
}
// The rooster, on the coop's roof: rust and gold, a green-black sickle tail, a great red comb. He crows at
// dawn (ctx.mem.crow). Parts: body, head, tail.
export function rooster() {
  return {
    gait: 'still',
    build() {
      const body = box([-3, 0, -4], [2, 8, 4]);
      body.egg(0, 3.4, -0.2, 2, 2.3, 2.7, (x, y, z) => (z >= 1 && y <= 3 ? K('rs3') : y >= 4 ? K('rs2') : K('rs1')));
      for (const x of [-1, 0]) { body.fill(x, 0, 0, x, 1, 0, K('chLeg')); body.put(x, 0, 1, K('chLeg')); }
      const head = box([-2, 4, 0], [1, 10, 5]);
      head.fill(-1, 4, 1, 0, 6, 2, K('rs2'));
      head.egg(0, 7, 2.2, 1.15, 1.2, 1.2, K('rs2'));
      head.fill(-1, 8, 1, 0, 9, 3, (x, y, z) => (y === 9 && z === 2 ? 0 : K('chComb'))); head.put(0, 10, 2, K('chComb'));
      head.fill(-1, 5, 3, 0, 6, 3, K('chComb')); head.put(-1, 7, 4, K('chBill')); head.put(0, 7, 4, K('chBill'));
      head.put(-2, 7, 2, K('eye')); head.put(1, 7, 2, K('eye'));
      const tail = box([-2, 3, -9], [1, 11, -3]);
      tail.rope([[-0.5, 4, -3], [-0.5, 9, -5], [-0.5, 10, -7.5], [-0.5, 7, -8.5]], 0.9, 0.6, K('rsT1'));
      tail.rope([[0.5, 4, -3], [0.5, 8, -6], [0.5, 7.5, -8], [0.5, 5.5, -8]], 0.7, 0.5, K('rsT2'));
      return { parts: { body: body.part('body', [0, 0, 0]), head: head.part('head', [-0.5, 5, 1], body), tail: tail.part('tail', [0, 4, -3], body) } };
    },
    setup(ctx) { ctx.mem.crow = -10; },
    idle(ctx) {
      const { parts: P, state: { t }, mem, pose } = ctx, c = t - mem.crow;
      const crow = c > 0 && c < 2.2 ? Math.sin(Math.PI * clamp01(c / 2.2)) : 0;
      P.head.rotation.x -= 0.9 * crow; pose.rotation.x -= 0.35 * crow; pose.scale.set(1, 1 + 0.08 * crow, 1 + 0.06 * crow);
      P.head.rotation.y += 0.6 * Math.sin(t * 0.6) * (1 - crow);
      P.tail.rotation.x += 0.06 * Math.sin(t * 1.1);
    },
  };
}
// Sheep: a woolly body on dark legs, a dark face under a woolly cap. Parts: body, head (on the body).
// Member: graze (0..1 nose to the grass), chew, hop, walk.
export function sheep() {
  const build = () => {
    const body = box([-4, 0, -6], [3, 9, 5]);
    body.egg(0, 5, -0.3, 3.3, 2.9, 4.3, (x, y, z) => pick3([K('sh1'), K('sh2'), K('sh3')], noise(x + y, z, 1.6, 4)), (x, y, z) => {
      const k = ((x + 0.5) / 3.3) ** 2 + ((y + 0.5 - 5) / 2.9) ** 2 + ((z + 0.5 + 0.3) / 4.3) ** 2;
      return k < 0.8 || noise(x * 2 + y, z * 2 - y, 1.3, 9) > 0.35;
    });
    for (const [x, z] of [[-2, -3], [1, -3], [-2, 2], [1, 2]]) body.fill(x, 0, z, x, 2, z, K('shK'));
    body.put(-1, 5, -5, K('sh1')); body.put(0, 5, -5, K('sh2'));
    const head = box([-3, 3, 2], [2, 9, 7]);
    head.egg(0, 5.8, 4.8, 1.4, 1.6, 1.7, (x, y, z) => (y >= 7 ? K('sh1') : z >= 6 && y <= 5 ? K('shK3') : K('shK2')));
    head.fill(-1, 7, 3, 0, 8, 4, (x, y) => (y === 8 ? K('sh2') : K('sh1')));
    head.put(-3, 6, 4, K('shK')); head.put(2, 6, 4, K('shK')); head.put(-2, 6, 5, K('shEye')); head.put(1, 6, 5, K('shEye'));
    return { parts: { body: body.part('body', [0, 0, 0]), head: head.part('head', [-0.5, 5.5, 3], body) } };
  };
  return still(build, function idle(ctx) {
    const m = this.m || {}, t = m.t ?? ctx.state.t, { parts: P, pose } = ctx, s = m.seed || 0, g = m.graze || 0;
    P.head.rotation.x += 0.95 * g + 0.06 * Math.sin(t * 7 + s) * g;
    P.head.rotation.y += 0.35 * Math.sin(t * 0.5 + s) * (1 - g);
    P.head.position.y += 0.15 * Math.sin(t * 5 + s) * (m.chew || 0);
    const hop = m.hop || 0;
    pose.position.y += 0.55 * hop + 0.03 * Math.abs(Math.sin(t * 6)) * (m.walk || 0);
    pose.rotation.x -= 0.3 * hop * Math.cos(Math.PI * clamp01(m.hopU || 0));
    pose.rotation.z += 0.04 * Math.sin(t * 6 + s) * (m.walk || 0);
    pose.scale.set(1, 1 + 0.02 * Math.sin(t * 1.4 + s), 1);
  });
}
const pick3 = (a, u) => a[Math.max(0, Math.min(a.length - 1, Math.floor(u * a.length)))];
// A Friesian cow: black and white in patches, a pink muzzle, short horns, a bell on a strap; the tail swishes.
// Parts: body, head (on the body), tail (on the body). Member: graze, moo (0..1), swish.
export function cow() {
  const build = () => {
    const body = box([-4, 0, -8], [3, 12, 7]);
    const patch = (x, y, z) => (noise(x * 1.2 + y * 0.5, z, 3.2, 21) > 0.56 ? K('cwK') : hash(x, y, z) < 0.25 ? K('cwW2') : K('cwW'));
    body.egg(0, 7.4, -0.3, 3.4, 3.1, 6, patch);
    for (const [x0, z0] of [[-3, -5], [1, -5], [-3, 3], [1, 3]]) body.fill(x0, 0, z0, x0 + 1, 5, z0 + 1, (x, y, z) => (y === 0 ? K('cwHoof') : patch(x, y, z)));
    body.fill(-1, 4, -3, 0, 4, -2, K('cwPink'));
    const head = box([-5, 4, 3], [4, 12, 11]);
    head.egg(0, 8.4, 7.4, 1.9, 2.1, 2.3, (x, y, z) => (x >= 0 && y >= 8 ? K('cwK') : K('cwW')));
    head.fill(-2, 6, 9, 1, 7, 10, (x, y, z) => (z === 10 && y === 7 && (x === -2 || x === 1) ? K('cwK') : K('cwPink')));
    for (const [x, d] of [[-3, -1], [2, 1]]) { head.put(x, 10, 7, K('cwHorn')); head.put(x + d, 11, 7, K('cwHorn')); head.put(x + d, 9, 6, K('cwK')); head.put(x + d * 2, 9, 6, K('cwW')); }
    head.put(-3, 9, 8, K('eye')); head.put(2, 9, 8, K('eye'));
    head.fill(-2, 6, 5, 1, 6, 6, K('cwStrap')); head.fill(-1, 4, 6, 0, 5, 7, (x, y) => (y === 4 ? K('cwStrap') : K('cwBell')));
    const tail = box([-1, 2, -9], [0, 10, -6]);
    tail.rope([[-0.5, 9.5, -6.3], [-0.5, 7, -7], [-0.5, 4, -7.2]], 0.6, 0.5, K('cwW')); tail.fill(-1, 2, -8, 0, 3, -7, K('cwK'));
    return { parts: { body: body.part('body', [0, 0, 0]), head: head.part('head', [-0.5, 8.5, 5], body), tail: tail.part('tail', [-0.5, 9.5, -6.3], body) } };
  };
  return still(build, function idle(ctx) {
    const m = this.m || {}, t = m.t ?? ctx.state.t, { parts: P, pose } = ctx, s = m.seed || 0, g = m.graze || 0, moo = m.moo || 0;
    P.head.rotation.x += 0.8 * g - 0.45 * moo + 0.05 * Math.sin(t * 5 + s) * g;
    P.head.rotation.y += 0.3 * Math.sin(t * 0.35 + s) * (1 - g);
    P.head.rotation.z += 0.12 * Math.sin(t * 9) * moo;
    P.tail.rotation.z += 0.25 * Math.sin(t * 1.7 + s) + 0.6 * Math.sin(t * 9) * (m.swish || 0);
    pose.position.y += 0.02 * Math.abs(Math.sin(t * 4)) * (m.walk || 0);
  });
}
// A little hen house on legs with a ramp, a nesting box, a wattle run round it (x -16..15, z -12..11), a trough
// and a sack of grain.
export const COOP = { run: [16, 12], house: [-14, -4, -10, -3], ridge: [-9, 17, -6.5] };
export function coop() {
  const b = box([-16, 0, -12], [15, 17, 11]);
  for (let x = -16; x <= 15; x += 1) for (let z = -12; z <= 11; z += 1) { // wattle hurdles, a gap for the gate
    const edge = x === -16 || x === 15 || z === -12 || z === 11;
    if (!edge || (z === 11 && x > -3 && x < 2)) continue;
    const post = (x + z) % 6 === 0;
    for (let y = 0; y <= (post ? 5 : 4); y += 1) b.put(x, y, z, post ? K('cp3') : (y + Math.floor((x + z) / 2)) % 2 ? K('wattle1') : K('wattle2'));
  }
  for (const [x, z] of [[-14, -10], [-4, -10], [-14, -3], [-4, -3]]) b.fill(x, 0, z, x, 4, z, K('cp3'));
  b.fill(-14, 5, -10, -4, 11, -3, (x, y, z) => (x === -14 || x === -4 || z === -10 || z === -3 ? (y === 5 || y === 11 ? K('cp3') : x % 3 === 0 || z % 3 === 0 ? K('cp1') : K('cp2')) : 0));
  for (let y = 12; y <= 16; y += 1) { const w = 16 - y; b.fill(-15, y, -7 - w - 1, -3, y, -6 + w, (x, yy, z) => (z === -7 - w - 1 || z === -6 + w ? ((x + yy) % 2 ? K('cpRoof1') : K('cpRoof2')) : 0)); }
  b.fill(-15, 16, -8, -3, 16, -6, K('cp3'));
  b.fill(-10, 6, -3, -8, 9, -3, (x, y) => (y === 9 ? K('cp3') : K('black'))); // the doorway
  for (let i = 0; i < 5; i += 1) b.fill(-10, 5 - i, -2 + i, -8, 5 - i, -2 + i, (x) => (x % 2 ? K('cp1') : K('cp3'))); // the ramp
  b.fill(-3, 6, -9, -1, 9, -5, (x, y, z) => (y === 9 ? K('cpRoof1') : x === -1 || z === -9 || z === -5 ? K('cp2') : K('straw'))); // a nesting box
  b.put(-2, 9, -7, K('white')); // an egg in it
  b.fill(4, 0, 5, 10, 1, 6, (x, y, z) => (y === 1 && x > 4 && x < 10 ? K('water') : K('trough')));
  b.egg(-12, 1.6, 7, 1.8, 1.9, 1.6, K('wicker2')); b.fill(-13, 3, 7, -11, 3, 7, K('twine'));
  for (let i = 0; i < 24; i += 1) { const x = -15 + Math.floor(hash(i, 3) * 30), z = -11 + Math.floor(hash(i, 4) * 22); if (!b.at(x, 0, z)) b.put(x, 0, z, i % 3 ? K('straw') : K('chLeg')); }
  return { parts: [{ b }], flex: () => 0, h: 17, r: 17 };
}
// A scarecrow in the wheat: a cross of poles, a patched coat, straw at the cuffs, and a pumpkin head that
// glows after dark like a lantern.
export function scarecrow() {
  const b = box([-7, 0, -2], [6, 24, 2]), head = box([-3, 17, -2], [2, 22, 2]);
  b.fill(-1, 0, 0, 0, 19, 0, K('cp3')); b.fill(-7, 15, 0, 6, 15, 0, K('cp3'));
  b.fill(-4, 8, -1, 3, 15, 1, (x, y, z) => ((x + y) % 5 === 0 ? K('sc2') : K('sc1')));
  for (const x of [-7, -6, 5, 6]) b.fill(x, 14, -1, x, 15, 1, (xx, y) => (xx === -7 || xx === 6 ? K('straw') : K('sc1')));
  b.fill(-2, 5, -1, 1, 7, 1, K('straw'));
  head.egg(0, 19.5, 0, 2.6, 2.2, 2.4, (x, y, z) => ((x + 2) % 2 ? K('pumpkin') : K('cpRoof1')));
  for (const [x, y] of [[-2, 20], [1, 20], [-1, 18], [0, 18]]) head.put(x, y, 2, K('jack'));
  b.fill(-3, 22, -2, 2, 22, 2, K('scHat')); b.fill(-2, 23, -1, 1, 24, 1, K('scHat'));
  return { parts: [{ b }, { b: head, night: true }], flex: (x, y) => 0.25 * clamp01((y - 12) / 12), h: 24, r: 7 };
}

// ---- in the water and the air ---------------------------------------------------------------------------
// A silver fish (it only shows when it leaps). One part.
export function fish() {
  return still(() => {
    const b = box([-1, -2, -5], [0, 2, 3]);
    b.egg(-0.5 + 0.5, 0, -0.5, 0.95, 1.4, 3.1, (x, y) => (y >= 1 ? K('fish1') : y <= -1 ? K('fish3') : K('fish2')));
    b.fill(-1, -2, -5, 0, 2, -5, (x, y) => (Math.abs(y) === 2 ? K('fishFin') : y === 0 ? 0 : K('fish1'))); b.fill(-1, -1, -4, 0, 1, -4, K('fishFin'));
    b.put(-1, 2, 0, K('fishFin')); b.put(-1, 2, -1, K('fishFin'));
    b.put(-1, 0, 2, K('eye')); b.put(0, 0, 2, K('eye'));
    return { parts: { fish: b.part('fish', [0, 0, 0]) } };
  }, function idle(ctx) { const m = this.m || {}; ctx.parts.fish.rotation.y += 0.35 * Math.sin((m.t ?? ctx.state.t) * 18); });
}
// A butterfly: a dark body, white wings the flock tints (orange, blue, lemon, white). Parts: body, wingL, wingR.
export function butterfly() {
  const wing = (s) => { const b = box([Math.min(s, s * 3), 0, -2], [Math.max(s, s * 3), 0, 2]); for (let i = 1; i <= 3; i += 1) for (let z = -2; z <= 2; z += 1) if (!(i === 3 && Math.abs(z) === 2) && !(i === 1 && z === 0)) b.put(s * i, 0, z, (i === 3 && z === 0) || (i === 2 && z === 2) ? K('bf2') : K('bf1')); return b; };
  return still(() => {
    const b = box([-1, 0, -2], [0, 1, 2]); b.fill(0, 0, -2, 0, 0, 1, K('bf2')); b.put(0, 1, 2, K('bf2'));
    return { parts: { body: b.part('body', [0.5, 0.5, 0]), wingL: wing(1).part('wingL', [1, 0.5, 0]), wingR: wing(-1).part('wingR', [0, 0.5, 0]) } };
  }, function idle(ctx) { const m = this.m || {}, f = Math.sin((m.t ?? ctx.state.t) * 19 + (m.seed || 0)) * 0.9 + 0.35; ctx.parts.wingL.rotation.z += f; ctx.parts.wingR.rotation.z -= f; });
}
// A bat: dark membranes on finger bones, pricked ears, eyes like embers. Parts: body, wingL, wingR.
export function bat() {
  const wing = (s) => { const b = box([Math.min(s, s * 5), 0, -2], [Math.max(s, s * 5), 0, 1]); for (let i = 1; i <= 5; i += 1) for (let z = -2; z <= 1; z += 1) if (!(z === -2 && (i === 2 || i === 4)) && !(z === 1 && i === 5)) b.put(s * i, 0, z, z === 1 || i % 2 === 1 ? K('bt1') : K('bt2')); return b; };
  return still(() => {
    const b = box([-2, -1, -2], [1, 2, 2]); b.egg(0, 0.4, 0, 1, 1, 1.5, K('bt1'));
    b.put(-1, 2, 0, K('bt1')); b.put(0, 2, 0, K('bt1')); b.put(-1, 1, 1, K('btEye')); b.put(0, 1, 1, K('btEye'));
    return { parts: { body: b.part('body', [0, 0, 0]), wingL: wing(1).part('wingL', [0.5, 0.5, 0]), wingR: wing(-1).part('wingR', [-0.5, 0.5, 0]) } };
  }, function idle(ctx) { const m = this.m || {}; wings(ctx, { ...m, fly: 1, rate: 17 }, m.t ?? ctx.state.t); });
}

// ---- the cats and the dog ------------------------------------------------------------------------------
const COATS = {
  ginger: { a: 'cgO1', b: 'cgO2', eye: 'catEyeG', bib: true },
  black: { a: 'cbK1', b: 'cbK2', eye: 'catEyeA', bib: true },
  grey: { a: 'cyG1', b: 'cyG2', eye: 'catEyeG', bib: false },
};
// A cat sitting up (pose 'sit') or curled in a loaf ('loaf'), its eyes shining. Parts: body, head (on the
// body), tail. ctx.mem.pet: when it was fussed over (hearts, then it rolls on its back, paws up).
export function cat(coat = 'ginger', pose = 'sit') {
  const c = COATS[coat] || COATS.ginger, A = K(c.a), B = K(c.b), W = K('cgW');
  const fur = (x, y, z) => (mod(y + Math.floor(x / 2), 3) === 0 && z < 1 ? B : A);
  const loaf = pose === 'loaf';
  return {
    gait: 'still',
    build() {
      const body = box([-5, 0, -6], [4, 10, 5]);
      if (loaf) {
        body.egg(0, 2.2, -0.4, 3.1, 2.3, 4, (x, y, z) => (c.bib && z >= 2 && y <= 2 ? W : fur(x, y, z)));
        for (const x of [-2, 1]) body.fill(x, 0, 3, x, 0, 4, c.bib ? W : A);
      } else {
        body.egg(0, 2.6, -1.2, 3, 2.7, 3, fur);
        body.egg(0, 5, 0.4, 2.1, 3.1, 1.9, (x, y, z) => (c.bib && z >= 1 && y < 6 ? W : fur(x, y, z)));
        for (const x of [-2, 1]) body.fill(x, 0, 2, x, 1, 2, c.bib ? W : A);
      }
      const hy = loaf ? 4.2 : 9.2, hz = loaf ? 3.3 : 0.9;
      const head = box([-4, Math.floor(hy - 3), Math.floor(hz - 3)], [3, Math.ceil(hy + 4), Math.ceil(hz + 3)]);
      head.egg(0, hy, hz, 2.6, 2.1, 2.3, (x, y, z) => (c.bib && y <= hy - 1 && z >= hz + 1 ? W : mod(x, 2) === 0 && y >= hy + 1 ? B : A));
      for (const x of [-3, 2]) { head.put(x, Math.round(hy + 2), Math.round(hz), A); head.put(x, Math.round(hy + 3), Math.round(hz), B); head.put(x, Math.round(hy + 2), Math.round(hz) + 1, K('cgPink')); }
      const ey = Math.round(hy), ez = Math.round(hz + 1.1);
      head.cut(-2, ey, ez + 1); head.cut(1, ey, ez + 1);
      head.put(-2, ey, ez, K(c.eye)); head.put(1, ey, ez, K(c.eye));
      head.put(-1, ey - 1, ez + 1, K('cgPink')); head.put(0, ey - 1, ez + 1, K('cgPink'));
      const tail = box([-5, 0, -7], [5, 4, 5]);
      tail.rope([[0.5, 1, -3.8], [2.5, 0.6, -3.2], [3.6, 0.6, -0.8], [3, 0.8, 1.6], [1.8, 1.4, 2.8]], 0.75, 0.55, (x, y, z) => (z >= 2 ? B : (x + z) % 3 === 0 ? B : A));
      return { parts: { body: body.part('body', [0, 0, 0]), head: head.part('head', [-0.5, hy - 1.5, hz - 0.5], body), tail: tail.part('tail', [0.5, 1, -3.8], body) } };
    },
    setup(ctx) { ctx.mem.pet = -20; },
    idle(ctx) {
      const { parts: P, state: { t }, mem, pose } = ctx, u = t - mem.pet;
      // fussed over: a purr and hearts, then over onto its back, paws up, and back up again
      // (the roll turns about its foot, so it is lifted by half its width to lie on its side, not in the ground)
      const roll = u > 0.7 && u < 4.2 ? smooth((u - 0.7) / 0.45) * (1 - smooth((u - 3.6) / 0.6)) : 0;
      const wriggle = roll > 0.9 ? 0.12 * Math.sin((u - 1.2) * 9) : 0;
      pose.rotation.z += (Math.PI / 2) * roll + wriggle;
      pose.position.y += 3.4 * ctx.voxel * roll;
      P.head.rotation.x += 0.2 * Math.sin(t * 0.37) * (1 - roll) - 0.4 * roll;
      P.head.rotation.y += (0.45 * Math.sin(t * 0.23) + 0.15 * Math.sin(t * 0.71)) * (1 - roll) + 0.3 * Math.sin(u * 5) * roll;
      P.tail.rotation.y += 0.28 * Math.sin(t * (1.3 + 2 * roll)) + 0.08 * Math.sin(t * 3.7);
      P.tail.rotation.x -= 0.4 * roll;
      const purr = u > 0 && u < 4.5 ? 0.02 * Math.sin(t * 60) : 0;
      P.body.scale.set(1 + purr, 1 + 0.025 * Math.sin(t * 1.6) + purr, 1);
    },
  };
}
// A scruffy terrier: tan with a darker saddle, a white chest, floppy ears, a red collar with a brass tag, a
// tongue out, a curl of a tail. Parts: body, head, tail (on the body), legL, legR (back), armL, armR (front).
// ctx.mem: sit (0..1), lie (0..1), wag (0..1), spin (seconds since a spin began), bark (seconds since).
export function dog() {
  return {
    gait: 'walk',
    build() {
      const body = box([-4, 3, -7], [3, 11, 6]);
      body.egg(0, 6.6, -0.2, 2.5, 2.2, 4.8, (x, y, z) => (z >= 2 && y <= 6 ? K('dgW') : y >= 8 ? K('dg3') : hash(x, y, z) < 0.35 ? K('dg2') : K('dg1')));
      body.fill(-1, 7, 3, 0, 9, 5, K('dg1'));
      body.fill(-2, 8, 4, 1, 8, 5, K('dgCollar')); body.put(-1, 7, 6, K('dgTag'));
      const head = box([-4, 7, 3], [3, 14, 11]);
      head.egg(0, 10.6, 5.6, 2.2, 2.1, 2.2, (x, y, z) => (y >= 12 ? K('dg3') : K('dg1')));
      head.fill(-1, 9, 7, 0, 10, 9, (x, y, z) => (z === 9 && y === 10 ? K('black') : K('dgW')));
      head.put(-1, 8, 8, K('dgTongue')); head.put(0, 8, 8, K('dgTongue')); head.put(0, 7, 8, K('dgTongue'));
      for (const x of [-3, 2]) { head.fill(x, 10, 4, x, 12, 5, K('dgEar')); head.put(x < 0 ? x - 1 : x + 1, 10, 4, K('dgEar')); }
      head.put(-2, 11, 7, K('eye')); head.put(1, 11, 7, K('eye')); head.put(-2, 12, 7, K('glint')); head.put(1, 12, 7, K('glint'));
      const tail = box([-1, 7, -9], [0, 13, -4]);
      tail.rope([[-0.5, 8, -4.6], [-0.5, 10.5, -6.2], [-0.5, 12, -5.4]], 0.7, 0.55, (x, y) => (y >= 12 ? K('dgW') : K('dg1')));
      const leg = (x, z, name) => { const b = box([x, 0, z], [x + 1, 5, z + 1]); b.fill(x, 0, z, x + 1, 5, z + 1, (xx, y) => (y === 0 ? K('dgW') : y <= 1 && z > 0 ? K('dgW') : K('dg2'))); return b.part(name, [x + 1, 5, z + 1]); };
      return { parts: {
        body: body.part('body', [0, 5, 0]), head: head.part('head', [-0.5, 8.5, 4], body), tail: tail.part('tail', [-0.5, 8, -4.6], body),
        legL: leg(0, -4, 'legL'), legR: leg(-2, -4, 'legR'), armL: leg(0, 2, 'armL'), armR: leg(-2, 2, 'armR'),
      } };
    },
    setup(ctx) { Object.assign(ctx.mem, { sit: 0, lie: 1, wag: 0.3, spin: -10, bark: -10 }); },
    idle(ctx) {
      const { parts: P, state: { t }, mem, pose } = ctx;
      const sit = mem.sit, lie = mem.lie, V = ctx.voxel;
      // lying: legs out in front and tucked behind; sitting: haunches down, chest up
      P.armL.rotation.x -= 1.45 * lie; P.armR.rotation.x -= 1.45 * lie;
      P.legL.rotation.x -= 1.3 * lie + 1.1 * sit; P.legR.rotation.x -= 1.3 * lie + 1.1 * sit;
      pose.position.y -= (4 * lie + 1.6 * sit) * V;
      pose.rotation.x -= 0.45 * sit;
      pose.position.z -= 0.8 * sit * V;
      P.head.rotation.x += 0.35 * sit + 0.08 * Math.sin(t * 1.3) - 0.25 * lie * (0.5 + 0.5 * Math.sin(t * 0.4));
      P.head.rotation.y += 0.35 * Math.sin(t * 0.29) * (1 - (mem.run || 0));
      // the tail: wagging, faster when happy
      P.tail.rotation.y += (0.3 + 0.6 * mem.wag) * Math.sin(t * (6 + 12 * mem.wag));
      // a bark: head up and a jolt
      const b = t - mem.bark, bk = b > 0 && b < 0.35 ? Math.sin((b / 0.35) * Math.PI) : 0;
      P.head.rotation.x -= 0.5 * bk; pose.position.y += bk * 0.12;
    },
  };
}
