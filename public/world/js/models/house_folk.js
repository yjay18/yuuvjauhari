// The townsfolk (colours house_folk_): chibi like Yuuv (big heads on small bodies, about 24 voxels to the top of
// the head), faces with eyes that blink, each with a short idle and a joke.
//   guard()      kettle helm, a tabard in the town's blue with a circuit trim, a halberd whose blade is crystal.
//                Joke: a daisy tucked in the helm. ctx.salute().
//   baker()      a tall toque, a floury apron, a moustache, a baguette under the arm. Joke: a floury handprint on
//                the apron. ctx.catch() (a loaf comes flying out of the oven).
//   fisher()     a yellow oilskin and sou'wester, sat with a rod, a bobber on the water. Joke: a gull stands on
//                the hat and will not leave. ctx.bite() (a fish on the line; it flops on the planks).
//   lamplighter() a little brass robot with a lantern for a head and a lighter on a pole. Joke: a tiny top hat.
//                ctx.tip() (tips the hat).
//   villager(k)  0 a woman with a basket of glowing data-apples, 1 an old man with a cane, 2 a courier with a
//                parcel and a tiny drone over one shoulder. ctx.hello().
//   resident(k)  leans out of a door to wave: a grandma in curlers with a mug, or a man in a nightcap.
//   patron(k)    sits at the tavern's table with a mug. ctx.cheer() (mugs up, clink, foam).
// Model voxels, standing at the origin facing +z.
import { C, colour, hash } from '../kit/voxel-kit.js';
import { box, tone, smooth, clamp01 } from './space.js';

const K = {};
for (const [n, hex, glow] of [
  ['skin1', 0xf0c49c], ['skin2', 0xd9a67e], ['skin3', 0xc98f62], ['skin4', 0x8f5a3a], ['skin5', 0xb07a50], ['blush', 0xe0907a],
  ['eye', 0x1a1410], ['white', 0xf6f1e8], ['shine', 0xffffff, true], ['mouth', 0x5a2a22], ['brow', 0x3a2618],
  ['hairW', 0xe8e4dc], ['hairG', 0xb0aaa0], ['hairB', 0x3a2618], ['hairR', 0xa8502a], ['hairK', 0x1a1412],
  ['blue1', 0x2f4f8e], ['blue2', 0x3d64a8], ['trim', 0x1fd2ea, true], ['steel1', 0x8a8f98], ['steel2', 0xb4b9c2], ['steel3', 0x5f646c],
  ['white1', 0xf3efe6], ['white2', 0xdcd6ca], ['flour', 0xfaf6ec], ['bread', 0xc8843a], ['crust', 0x9a5a22],
  ['oil1', 0xf2c230], ['oil2', 0xd9a820], ['oil3', 0xb88a18], ['gull1', 0xf4f2ee], ['gull2', 0xb8bcc4], ['beak', 0xf2b830], ['boot', 0x2a2622],
  ['brass1', 0xb8862e], ['brass2', 0xdcae4e], ['brass3', 0x8a6420], ['lampEye', 0xffe8a0, true], ['flame', 0xffb347, true], ['flame2', 0xfff0c0, true], ['hat', 0x1c1a1e], ['hat2', 0x3a3040],
  ['dress1', 0x8e3a4a], ['dress2', 0xa84a5a], ['scarf', 0x3f7a6a], ['basket', 0xa47a44], ['basket2', 0x7a5630], ['apple', 0xff5a6a, true], ['apple2', 0x6ff2ff, true],
  ['coat1', 0x5a4a3a], ['coat2', 0x6e5c48], ['cane', 0x4a3020], ['vest', 0x2f6a5a], ['vest2', 0x3f8a74], ['parcel', 0xc9a26a], ['string', 0xece2c8], ['drone', 0x3a3f4a], ['droneEye', 0x7ff0ff, true],
  ['shawl', 0x7a4a8e], ['shawl2', 0x9a62ae], ['curler', 0xff8ad8], ['mug', 0x7a5236], ['mug2', 0x9a6a46], ['foam', 0xfaf6ec], ['tea', 0x8a5a2a],
  ['night', 0x3f5aa8], ['night2', 0xf2ece0], ['pompom', 0xf2ece0],
  ['shirt1', 0xc8b89a], ['shirt2', 0x8a9a6a], ['shirt3', 0x9a6a8a], ['pants', 0x3a3a48], ['pants2', 0x4a4a5a], ['apron', 0x7a5a3a],
  ['daisy', 0xf6f4ee], ['daisyC', 0xf2c84a], ['fish1', 0x9fb4c8], ['fish2', 0xd8e4ee], ['fishFin', 0xf29a4a], ['rod', 0x6a4a2a], ['line', 0xd8d8d0], ['bob', 0xff4a3a],
]) K[n] = C[`house_folk_${n}`] ?? colour(`house_folk_${n}`, hex, glow);
const IR = [C.iron1, C.iron2, C.iron3];

// ---- a person from parts: legs (hip pivots), a body, arms (shoulder pivots), a head (neck pivot) with blinking eyes
// o: { skin, hair, top: [two tones], bottom: [two], shoe, sit, face(head), extra(parts), hat(head), apron(body), arm(side, b) }
function person(o) {
  const skin = o.skin ?? K.skin1, top = o.top ?? [K.shirt1, K.shirt1], bottom = o.bottom ?? [K.pants, K.pants2], shoe = o.shoe ?? K.boot;
  const parts = {}, boxes = {};
  // legs: y 0..6, feet forward
  for (const side of [1, -1]) {
    const [a, b] = side > 0 ? [0, 2] : [-3, -1];
    const leg = box([a, 0, -1], [b, 7, 3]);
    if (o.sit) { // sat: the thigh forward, the shin down
      leg.fill(a, 5, -1, b, 7, 5, (x, y, z) => tone(bottom, x, y, z, 3));
      leg.fill(a, 0, 4, b, 4, 6, (x, y, z) => (y <= 1 ? shoe : tone(bottom, x, y, z, 4)));
    } else {
      leg.fill(a, 2, -1, b, 7, 1, (x, y, z) => tone(bottom, x, y, z, 3));
      leg.fill(a, 0, -1, b, 1, 2, (x, y, z) => (y === 0 ? K.boot : shoe));
    }
    parts[side > 0 ? 'legL' : 'legR'] = leg.part(side > 0 ? 'legL' : 'legR', [side > 0 ? 1 : -2, 7, 0]);
    boxes[side > 0 ? 'legL' : 'legR'] = leg;
  }
  // the body: y 8..14, a belt, whatever it wears
  const body = box([-5, 7, -3], [4, 15, 3]);
  body.fill(-4, 8, -2, 3, 14, 2, (x, y, z) => (y === 8 ? (o.belt ?? K.apron) : (y === 14 && (x <= -3 || x >= 2)) ? top[1] : tone(top, x, y, z, 5)));
  if (o.body) o.body(body);
  parts.body = body.part('body', [0, 8, 0]);
  boxes.body = body;
  // arms: 2 x 2, hands of skin
  for (const side of [1, -1]) {
    const x0 = side > 0 ? 4 : -6, arm = box([x0 - 1, 6, -2], [x0 + 2, 14, 3]);
    arm.fill(x0, 8, -1, x0 + 1, 14, 0, (x, y, z) => (y === 14 ? top[1] : tone(top, x, y, z, 6)));
    arm.fill(x0, 7, -1, x0 + 1, 7, 0, skin);
    if (o.arm) o.arm(side, arm, x0);
    parts[side > 0 ? 'armL' : 'armR'] = arm.part(side > 0 ? 'armL' : 'armR', [x0 + 1, 14, -0.5], body);
    boxes[side > 0 ? 'armL' : 'armR'] = arm;
  }
  // the head: 10 wide, a face at z 3, a nose one proud, cheeks, hair round the back and top
  const head = box([-7, 14, -6], [6, 30, 6]);
  head.fill(-5, 15, -4, 4, 23, 3, (x, y, z) => tone([skin, skin, o.skin2 ?? K.skin2], x, y, z, 7));
  for (const x of [-5, 4]) for (const z of [-4, 3]) for (let y = 15; y <= 23; y += 1) head.cut(x, y, z);
  head.put(-1, 18, 4, o.skin2 ?? K.skin2); head.put(0, 18, 4, o.skin2 ?? K.skin2);
  head.put(-4, 17, 3, K.blush); head.put(3, 17, 3, K.blush);
  head.put(-2, 16, 3, K.mouth); head.put(-1, 16, 3, K.mouth); head.put(0, 16, 3, K.mouth); head.put(1, 16, 3, K.mouth); head.put(-3, 17, 3, K.mouth); head.put(2, 17, 3, K.mouth);
  for (const x of [-3, -2, 1, 2]) head.cut(x, 19, 3);
  head.fill(-4, 21, 3, -2, 21, 3, o.brow ?? K.brow); head.fill(1, 21, 3, 3, 21, 3, o.brow ?? K.brow);
  if (o.hair) for (let y = 17; y <= 24; y += 1) for (let z = -5; z <= 3; z += 1) for (let x = -6; x <= 5; x += 1) {
    const inHead = x >= -5 && x <= 4 && z >= -4 && z <= 3 && y <= 23;
    if (inHead && !(z < 0 || y >= 23 || (y >= 21 && (x <= -5 || x >= 4)))) continue;
    if (!inHead && (x < -6 || x > 5 || z < -5)) continue;
    if (z >= 1 && y <= 22) continue;
    if (Math.hypot((x + 0.5) / 6, (y - 20) / 4.6, (z + 0.8) / 5) <= 1.05) head.put(x, y, z, hash(x, y, z) < 0.3 ? (o.hair2 ?? o.hair) : o.hair);
  }
  if (o.face) o.face(head);
  if (o.hat) o.hat(head);
  parts.head = head.part('head', [0, 15, 0], body);
  boxes.head = head;
  const eyes = box([-3, 19, 3], [2, 19, 3]);
  for (const x of [-3, -2, 1, 2]) eyes.put(x, 19, 3, x === -2 || x === 1 ? K.eye : K.white);
  parts.eyes = eyes.part('eyes', [-0.5, 19.5, 3.5], head);
  return { parts, boxes };
}
// The idle every person shares: breathing, a blink on its own timer, a look about now and then.
function alive(ctx, seed) {
  const { parts: P, state: { t } } = ctx;
  P.body.scale.y = 1 + 0.015 * Math.sin(t * 1.9 + seed);
  const bl = (t + seed * 0.7) % 3.7;
  P.eyes.scale.y = bl < 0.12 ? 0.1 : 1;
  P.head.rotation.y += 0.25 * Math.sin(t * 0.37 + seed) * smooth((Math.sin(t * 0.21 + seed * 2) + 0.3) * 2);
  P.head.rotation.z += 0.04 * Math.sin(t * 0.8 + seed);
}
// A timed move: 0 before, rising to 1 over `rise`, held, and back to 0 over `fall` by `len`.
const pulse = (u, rise, len, fall = rise) => (u < 0 || u > len ? 0 : Math.min(1, smooth(u / rise), smooth((len - u) / fall)));

// ---- the gate guard ------------------------------------------------------------------------------------------------------
export function guard() {
  return {
    gait: 'still',
    build() {
      const { parts, boxes } = person({
        skin: K.skin3, skin2: K.skin5, top: [K.blue1, K.blue2], bottom: [K.steel3, K.steel1], shoe: K.boot, belt: K.brass3,
        body: (b) => { // the tabard over mail: the town's blue with a glowing trim and a crest
          b.fill(-4, 9, 2, 3, 14, 2, (x, y) => (x === -4 || x === 3 || y === 9 ? K.trim : y === 12 && Math.abs(x + 0.5) < 1.5 ? K.white1 : (x + y) % 5 === 0 ? K.blue2 : K.blue1));
          b.fill(-4, 9, -2, 3, 13, -2, (x, y) => (y % 2 ? K.steel1 : K.steel3));
        },
        face: (h) => { h.fill(-4, 17, 3, 3, 17, 3, (x) => (x === -1 || x === 0 ? K.skin5 : 0)); h.fill(-3, 16, 4, 2, 16, 4, K.hairB); }, // a stern moustache
        hat: (h) => { // a kettle helm with a wide brim, a daisy tucked in its band
          for (let y = 22; y <= 27; y += 1) for (let z = -6; z <= 5; z += 1) for (let x = -7; x <= 6; x += 1) {
            const r = Math.hypot((x + 0.5) / 5.6, (z + 0.5) / 4.9);
            if (y === 22 ? r <= 1.28 && r > 0.8 : r <= 1.02 - (y - 23) * 0.13) h.put(x, y, z, y === 22 ? K.steel3 : y === 23 ? K.steel3 : (x + z) % 4 === 0 ? K.steel2 : K.steel1);
          }
          h.put(4, 24, 3, K.daisy); h.put(5, 24, 3, K.daisy); h.put(4, 25, 3, K.daisy); h.put(5, 23, 3, K.daisy); h.put(5, 24, 2, K.daisyC);
        },
        arm: (side, a, x0) => { if (side > 0) { a.fill(x0, 5, 1, x0 + 1, 7, 2, IR[1]); } },
      });
      // the halberd: a staff in the left hand (the right is for saluting), a crystal blade and a spike
      const hal = box([3, 0, 0], [8, 40, 2]);
      hal.fill(5, 0, 1, 5, 36, 1, (x, y) => (y % 9 === 0 ? IR[2] : K.cane));
      hal.fill(6, 29, 1, 7, 35, 1, (x, y) => (x === 7 && (y === 29 || y === 35) ? 0 : x === 7 ? K.shine : K.trim)); hal.fill(3, 32, 1, 4, 33, 1, IR[1]);
      hal.fill(5, 37, 1, 5, 40, 1, (x, y) => (y === 40 ? K.shine : K.trim));
      parts.halberd = hal.part('halberd', [5, 7, 1], boxes.armL);
      return { parts };
    },
    setup(ctx) { ctx.mem.salute = -9; ctx.salute = () => { ctx.mem.salute = ctx.state.t; }; },
    idle(ctx) {
      const { parts: P, state: { t }, mem } = ctx;
      alive(ctx, 1.3);
      const s = pulse(t - mem.salute, 0.25, 1.8, 0.4);
      P.armR.rotation.x -= 2.6 * s; P.armR.rotation.z -= 0.5 * s; // right hand up to the brim
      P.body.rotation.x -= 0.05 * s;
      const stamp = pulse(t - mem.salute - 1.9, 0.1, 0.3);
      P.legL.rotation.x -= 0.5 * stamp;
      P.halberd.rotation.z += 0.03 * Math.sin(t * 0.7); // shifts his grip
      P.body.rotation.z += 0.02 * Math.sin(t * 0.5);
    },
  };
}

// ---- the baker ------------------------------------------------------------------------------------------------------------
export function baker() {
  return {
    gait: 'still',
    build() {
      const { parts } = person({
        skin: K.skin1, top: [K.white1, K.white2], bottom: [K.pants2, K.pants], belt: K.white2,
        body: (b) => { // the apron, floury, a handprint on it
          b.fill(-3, 8, 3, 2, 13, 3, (x, y) => (y === 13 && (x === -3 || x === 2) ? 0 : K.flour));
          for (const [x, y] of [[-2, 10], [-1, 10], [-1, 11], [0, 11], [-2, 11], [1, 12], [-1, 12], [-3, 12]]) b.put(x, y, 4, K.bread);
        },
        face: (h) => { h.fill(-3, 17, 4, 2, 17, 4, K.hairB); h.put(-4, 17, 4, K.hairB); h.put(3, 17, 4, K.hairB); h.put(-4, 16, 3, 0); }, // a moustache, curled
        hat: (h) => { // the toque: tall, pleated, a band
          for (let y = 22; y <= 30; y += 1) for (let z = -5; z <= 4; z += 1) for (let x = -6; x <= 5; x += 1) {
            const r = Math.hypot((x + 0.5) / (y === 22 ? 5.4 : 4.6 + (y - 22) * 0.12), (z + 0.5) / (y === 22 ? 4.6 : 4 + (y - 22) * 0.1));
            if (r <= 1) h.put(x, y, z, y === 22 ? K.white2 : (x + z + 40) % 3 === 0 ? K.white2 : K.white1);
          }
        },
        arm: (side, a, x0) => { if (side > 0) { a.fill(x0 - 1, 9, 1, x0 + 2, 10, 2, (x, y, z) => (y === 10 ? K.bread : K.crust)); for (let k = -5; k <= 4; k += 1) a.put(x0 + 1, 10, k, k % 3 ? K.bread : K.crust); } }, // a baguette under the arm
      });
      const loaf = box([-2, 0, -2], [1, 3, 1]);
      loaf.egg(0, 1.6, 0, 2.2, 1.6, 1.8, (x, y) => (y >= 2 ? K.bread : K.crust));
      loaf.put(0, 3, 0, K.flour); loaf.put(-1, 3, 0, K.flour);
      parts.loaf = loaf.part('loaf', [0, 0, 0]);
      return { parts };
    },
    setup(ctx) { ctx.mem.catch = -9; ctx.catch = () => { ctx.mem.catch = ctx.state.t; }; ctx.mem.oven = null; },
    idle(ctx) {
      const { parts: P, state: { t }, mem } = ctx;
      alive(ctx, 2.1);
      P.armR.rotation.x -= 0.3 * Math.max(0, Math.sin(t * 1.3)) * 0.5; // dusts his hands
      const u = t - mem.catch;
      // the loaf: out of the oven's glow (mem.oven, rig space), up in an arc, into his hands
      P.loaf.visible = u > 0 && u < 3.4;
      if (P.loaf.visible && mem.oven) {
        const k = clamp01(u / 1.4), o = mem.oven, hand = [0, 11, 5];
        P.loaf.position.set(o[0] + (hand[0] - o[0]) * k, o[1] + (hand[1] - o[1]) * k + Math.sin(k * Math.PI) * 14, o[2] + (hand[2] - o[2]) * k);
        P.loaf.rotation.x = k * 6.3;
        P.loaf.scale.setScalar(u < 0.3 ? smooth(u / 0.3) : u > 3 ? 1 - smooth((u - 3) / 0.4) : 1);
      }
      const reach = pulse(u - 1, 0.3, 2.2, 0.4);
      P.armL.rotation.x -= 1.3 * reach; P.armR.rotation.x -= 1.3 * reach;
      P.head.rotation.x -= 0.25 * pulse(u, 0.3, 1.2);
    },
  };
}

// ---- the fisher, sat on the edge with a rod --------------------------------------------------------------------------------
export function fisher() {
  return {
    gait: 'still',
    build() {
      const { parts, boxes } = person({
        sit: true, skin: K.skin2, skin2: K.skin3, top: [K.oil1, K.oil2], bottom: [K.oil2, K.oil3], shoe: K.boot, belt: K.oil3,
        face: (h) => { h.fill(-4, 15, 4, 3, 17, 4, (x, y) => (y === 17 && Math.abs(x + 0.5) < 2 ? 0 : (x + y) % 3 ? K.hairG : K.hairW)); h.fill(2, 16, 5, 3, 16, 7, (x, y, z) => (z === 7 ? K.flame : K.cane)); h.put(3, 17, 7, K.flame2); }, // a grey beard, a pipe with an ember
        hat: (h) => { // the sou'wester: a wide brim, long at the back
          for (let y = 22; y <= 25; y += 1) for (let z = -7; z <= 5; z += 1) for (let x = -7; x <= 6; x += 1) {
            const r = Math.hypot((x + 0.5) / 6.4, (z + 0.5 + (z < 0 ? 0 : 0)) / (z < 0 ? 6.8 : 5.4));
            if (y === 22 ? r <= 1 && r > 0.7 : r <= 0.82 - (y - 23) * 0.18) h.put(x, y, z, (x + z) % 3 ? K.oil1 : K.oil2);
          }
        },
      });
      // the rod from both hands out over the water, a line down to a bobber (both their own parts), a bucket, the gull on the hat
      const rod = box([-2, 8, 0], [2, 24, 24]);
      for (let k = 0; k <= 21; k += 1) rod.put(0, 10 + Math.floor(k * 0.55), 2 + k, k < 4 ? K.cane : K.rod);
      rod.put(0, 11, 3, IR[1]); rod.put(1, 11, 3, IR[2]);
      parts.rod = rod.part('rod', [0, 10, 2], boxes.body);
      const bob = box([-1, -1, -1], [0, 1, 0]);
      bob.fill(-1, -1, -1, 0, 1, 0, (x, y) => (y === 1 ? K.white1 : K.bob));
      parts.bob = bob.part('bob', [0, 0, 0]);
      const line = box([0, 0, 0], [0, 0, 0]);
      line.put(0, 0, 0, K.line);
      parts.line = line.part('line', [0.5, 0, 0.5]);
      const gull = box([-3, 26, -4], [3, 32, 3]);
      gull.egg(0, 28, -0.5, 1.8, 1.6, 3, (x, y, z) => (y >= 29 && z < 0 ? K.gull2 : K.gull1));
      gull.egg(0, 30.4, 1.6, 1.3, 1.3, 1.4, K.gull1);
      gull.put(0, 30, 3, K.beak); gull.put(-1, 31, 2, K.eye); gull.put(1, 31, 2, K.eye);
      gull.fill(-2, 28, -3, 1, 28, -3, K.gull2);
      parts.gull = gull.part('gull', [0, 26, 0], boxes.head);
      const fish = box([-1, 0, -4], [0, 3, 3]);
      fish.egg(0, 1.5, 0, 1.2, 1.4, 3.4, (x, y, z) => (y >= 2 ? K.fish1 : K.fish2));
      fish.fill(-1, 1, -4, 0, 3, -4, K.fishFin); fish.put(0, 2, 2, K.eye);
      parts.fish = fish.part('fish', [0, 1.5, 0]);
      const bucket = box([7, 0, -3], [11, 5, 1]);
      for (let y = 0; y <= 4; y += 1) for (let z = -3; z <= 1; z += 1) for (let x = 7; x <= 11; x += 1) if (Math.hypot(x - 9, z + 1) <= 2.3) bucket.put(x, y, z, y === 4 ? (Math.hypot(x - 9, z + 1) < 1.4 ? K.fish2 : IR[1]) : y === 1 || y === 3 ? IR[1] : K.cane);
      parts.bucket = bucket.part('bucket', [9, 0, -1]);
      return { parts };
    },
    setup(ctx) { ctx.mem.bite = -9; ctx.bite = () => { ctx.mem.bite = ctx.state.t; }; ctx.mem.water = -6; ctx.mem.tip = [0, 21, 23]; },
    idle(ctx) {
      const { parts: P, state: { t }, mem } = ctx;
      alive(ctx, 3.7);
      const u = t - mem.bite, yank = pulse(u, 0.15, 1.1, 0.5);
      P.rod.rotation.x = -0.08 * Math.sin(t * 0.9) - 0.7 * yank;
      P.armL.rotation.x -= 1.1 + 0.4 * yank; P.armR.rotation.x -= 1.1 + 0.4 * yank;
      // the bobber sits on the water under the rod's tip, nodding; on a bite it goes under, then the fish flies out
      const tip = mem.tip, by = mem.water + 0.5 + 0.4 * Math.sin(t * 2.1) - (u > -0.1 && u < 0.15 ? 2 : 0);
      P.bob.position.set(tip[0], by, tip[2] + 1);
      P.bob.visible = !(u > 0.15 && u < 3);
      P.line.position.set(tip[0], by + 1, tip[2] + 1);
      P.line.scale.y = P.bob.visible ? Math.max(0.01, tip[1] - by - 1 - 12 * yank) : 0.01;
      const fl = u - 0.15;
      P.fish.visible = fl > 0 && fl < 4.2;
      if (P.fish.visible) {
        const k = clamp01(fl / 0.9), land = [5, 2, 7];
        P.fish.position.set(tip[0] + (land[0] - tip[0]) * k, mem.water + (land[1] - mem.water) * k + Math.sin(k * Math.PI) * 16, tip[2] + (land[2] - tip[2]) * k);
        P.fish.rotation.z = fl > 0.9 ? 1.5 * Math.sin(fl * 22) * Math.exp(-(fl - 0.9) * 1.2) : k * 5; // it flops
        P.fish.rotation.y = fl > 0.9 ? 0.4 * Math.sin(fl * 13) : 0;
        P.fish.scale.setScalar(fl > 3.8 ? 1 - smooth((fl - 3.8) / 0.4) : 1);
      }
      // the gull: shuffles, turns its head, flaps once when the fish comes out
      P.gull.rotation.y += 0.5 * Math.sin(t * 0.6) + 0.8 * pulse(fl, 0.2, 1.2);
      P.gull.position.y += 3 * pulse(fl, 0.2, 0.9);
    },
  };
}

// ---- the lamplighter: a brass robot with a lantern head and a lighter on a pole ---------------------------------------------
export function lamplighter() {
  return {
    gait: 'walk',
    build() {
      const parts = {}, arms = {};
      for (const side of [1, -1]) { const leg = box([side > 0 ? 0 : -2, 0, -1], [side > 0 ? 1 : -1, 7, 2]); leg.fill(side > 0 ? 0 : -2, 0, -1, side > 0 ? 1 : -1, 7, 0, (x, y) => (y === 0 ? K.brass3 : y % 3 === 0 ? K.brass2 : K.brass1)); leg.fill(side > 0 ? 0 : -2, 0, 1, side > 0 ? 1 : -1, 0, 2, K.brass3); parts[side > 0 ? 'legL' : 'legR'] = leg.part(side > 0 ? 'legL' : 'legR', [side > 0 ? 1 : -1, 7, 0]); }
      const body = box([-4, 7, -3], [3, 15, 3]);
      body.egg(0, 11, 0, 3.6, 3.8, 3, (x, y, z) => (y === 11 ? K.brass3 : z >= 2 && y === 12 && Math.abs(x + 0.5) < 2 ? K.lampEye : (x + y + z) % 5 === 0 ? K.brass2 : K.brass1));
      body.put(-1, 9, 3, IR[2]); body.put(0, 9, 3, IR[2]); // rivets
      parts.body = body.part('body', [0, 8, 0]);
      for (const side of [1, -1]) { const x0 = side > 0 ? 3 : -5, arm = box([x0, 6, -1], [x0 + 1, 14, 1]); arm.fill(x0, 7, 0, x0 + 1, 13, 0, (x, y) => (y === 7 ? K.brass3 : K.brass1)); parts[side > 0 ? 'armL' : 'armR'] = arm.part(side > 0 ? 'armL' : 'armR', [x0 + 1, 13, 0], body); arms[side] = arm; }
      // the head: a lantern, a glowing eye behind its glass, a tiny top hat
      const head = box([-4, 15, -4], [3, 29, 3]);
      head.fill(-3, 15, -3, 2, 15, 2, K.brass3);
      head.fill(-3, 16, -3, 2, 21, 2, (x, y, z) => ((x === -3 || x === 2) && (z === -3 || z === 2) ? K.brass2 : y === 16 || y === 21 ? K.brass1 : (x + z) % 2 ? K.lampEye : K.flame));
      head.fill(-2, 18, 3, 1, 19, 3, (x) => (x === -2 || x === 1 ? K.eye : K.shine));
      head.fill(-3, 22, -3, 2, 22, 2, K.brass1); head.fill(-2, 23, -2, 1, 23, 1, K.brass2);
      head.fill(-3, 24, -3, 2, 24, 2, K.hat); head.fill(-2, 25, -2, 1, 28, 1, (x, y) => (y === 25 ? K.curler : K.hat));
      parts.head = head.part('head', [0, 15, 0], body);
      const pole = box([-6, 0, -1], [-4, 32, 1]);
      pole.fill(-5, 0, 0, -5, 28, 0, (x, y) => (y % 7 === 0 ? K.brass2 : K.cane));
      pole.fill(-6, 29, -1, -4, 30, 1, K.flame); pole.put(-5, 31, 0, K.flame2); pole.put(-5, 32, 0, K.flame);
      parts.pole = pole.part('pole', [-5, 7, 0], arms[-1]);
      return { parts };
    },
    setup(ctx) { ctx.mem.tip = -9; ctx.tip = () => { ctx.mem.tip = ctx.state.t; }; },
    idle(ctx) {
      const { parts: P, state: { t, moving }, mem } = ctx;
      P.head.rotation.y += 0.3 * Math.sin(t * 0.8) * (moving ? 0.3 : 1);
      P.pole.scale.y = 1;
      const u = pulse(t - mem.tip, 0.2, 1.4, 0.3);
      P.armL.rotation.x -= 2.8 * u; P.armL.rotation.z += 0.4 * u; P.head.rotation.x -= 0.15 * u;
      P.body.position.y += moving ? 0 : 0.3 * Math.sin(t * 3); // hums on the spot
    },
  };
}

// ---- villagers strolling their streets ----------------------------------------------------------------------------------------
export function villager(k = 0) {
  return {
    gait: 'walk',
    build() {
      const { parts } = k === 0 ? person({
        skin: K.skin4, skin2: K.skin3, top: [K.dress1, K.dress2], bottom: [K.dress2, K.dress1], shoe: K.boot, belt: K.dress1, hair: K.hairK, hair2: K.hairB,
        hat: (h) => { for (let x = -6; x <= 5; x += 1) for (let z = -5; z <= 2; z += 1) for (let y = 22; y <= 25; y += 1) if (Math.hypot((x + 0.5) / 6, (y - 21) / 4.6, (z + 1) / 4.6) <= 1 && (y >= 23 || z < 1)) h.put(x, y, z, (x + y) % 3 ? K.scarf : K.vest2); },
        arm: (side, a, x0) => { if (side < 0) { a.fill(x0 - 1, 3, -1, x0 + 2, 6, 3, (x, y, z) => (y === 6 ? ((x + z) % 2 ? K.apple : K.apple2) : (x + y) % 2 ? K.basket : K.basket2)); a.fill(x0, 7, 1, x0 + 1, 8, 1, K.basket2); } },
      }) : k === 1 ? person({
        skin: K.skin1, top: [K.coat1, K.coat2], bottom: [K.pants, K.pants2], belt: K.coat1, hair: K.hairW, brow: K.hairW,
        face: (h) => { h.fill(-4, 14, 3, 3, 16, 4, (x, y) => (y === 16 && Math.abs(x + 0.5) < 2 ? K.mouth : K.hairW)); h.fill(-3, 19, 4, -2, 19, 4, IR[2]); h.fill(1, 19, 4, 2, 19, 4, IR[2]); h.fill(-1, 19, 4, 0, 19, 4, IR[1]); }, // a long white beard, spectacles
        arm: (side, a, x0) => { if (side > 0) a.fill(x0, -1, 2, x0, 7, 2, (x, y) => (y === 7 ? K.cane : y < 0 ? IR[1] : K.cane)); }, // a cane
      }) : person({
        skin: K.skin5, skin2: K.skin4, top: [K.vest, K.vest2], bottom: [K.pants2, K.pants], belt: IR[1], hair: K.hairR, hair2: K.hairB,
        body: (b) => { b.fill(-4, 9, -3, 3, 13, -3, K.parcel); b.fill(-4, 11, -3, 3, 11, -3, K.string); },
        arm: (side, a, x0) => { if (side > 0) a.fill(x0 - 1, 6, 1, x0 + 2, 9, 3, (x, y, z) => (y === 8 || x === x0 ? K.string : K.parcel)); },
      });
      if (k === 2) { const d = box([-3, 0, -3], [2, 3, 2]); d.fill(-1, 1, -1, 0, 2, 0, K.drone); d.put(-1, 1, 1, K.droneEye); d.put(0, 1, 1, K.droneEye); for (const [x, z] of [[-3, -3], [2, -3], [-3, 2], [2, 2]]) { d.put(x, 3, z, K.steel2); d.put(x, 2, z, K.steel3); } d.fill(-2, 2, -2, 1, 2, 1, (x, y, z) => (Math.abs(x + 0.5) + Math.abs(z + 0.5) === 3 ? K.steel3 : 0)); parts.drone = d.part('drone', [0, 1, 0]); }
      return { parts };
    },
    setup(ctx) { ctx.mem.hello = -9; ctx.hello = () => { ctx.mem.hello = ctx.state.t; }; },
    idle(ctx) {
      const { parts: P, state: { t }, mem } = ctx;
      alive(ctx, 4 + k);
      const u = pulse(t - mem.hello, 0.2, 1.8, 0.3);
      P.armL.rotation.x -= 2.7 * u; P.armL.rotation.z += 0.3 * Math.sin((t - mem.hello) * 12) * u;
      P.body.position.y += 1.2 * pulse(t - mem.hello - 0.1, 0.12, 0.35);
      if (P.drone) { P.drone.position.set(9 + Math.sin(t * 1.3) * 2, 27 + Math.sin(t * 3.1) * 1.2, -2 + Math.cos(t * 1.1) * 2); P.drone.rotation.y = t * 2; }
    },
  };
}

// ---- a resident at the door, and the tavern's patrons -------------------------------------------------------------------------
export function resident(k = 0) {
  return {
    gait: 'still',
    build() {
      const { parts } = k === 0 ? person({
        skin: K.skin1, top: [K.shawl, K.shawl2], bottom: [K.dress1, K.dress2], hair: K.hairG, hair2: K.hairW,
        hat: (h) => { for (const [x, z] of [[-4, 0], [-1, -1], [2, 0], [-3, -3], [1, -3], [4, -2]]) { h.put(x, 24, z, K.curler); h.put(x, 25, z, K.curler); } h.fill(-3, 19, 4, 2, 19, 4, (x) => (x === -1 || x === 0 ? IR[1] : x === -3 || x === 2 ? IR[2] : 0)); }, // curlers, spectacles
        arm: (side, a, x0) => { if (side < 0) { a.fill(x0, 5, 1, x0 + 1, 8, 2, K.mug); a.put(x0, 9, 1, K.tea); } },
      }) : person({
        skin: K.skin3, skin2: K.skin5, top: [K.night, K.night2], bottom: [K.night, K.night2],
        hat: (h) => { for (let y = 22; y <= 29; y += 1) for (let z = -5; z <= 4; z += 1) for (let x = -6; x <= 5; x += 1) { const r = Math.hypot((x + 0.5 + (y - 22) * 0.6) / (5.4 - (y - 22) * 0.55), (z + 0.5) / (4.6 - (y - 22) * 0.45)); if (r <= 1) h.put(x, y, z, (y + x) % 3 ? K.night : K.night2); } h.fill(-7, 28, -1, -6, 29, 0, K.pompom); }, // a nightcap
        arm: (side, a, x0) => { if (side < 0) { a.fill(x0, 5, 1, x0 + 1, 6, 1, K.white1); a.put(x0, 7, 1, K.flame); } }, // a candle
      });
      return { parts };
    },
    idle(ctx) {
      const { parts: P, state: { t } } = ctx;
      alive(ctx, 5 + k);
      P.armL.rotation.x -= 2.6; P.armL.rotation.z += 0.35 * Math.sin(t * 10); // waving
    },
  };
}
export function patron(k = 0) {
  return {
    gait: 'still',
    build() {
      const { parts } = person({
        sit: true, skin: k ? K.skin3 : K.skin1, skin2: k ? K.skin5 : K.skin2, top: k ? [K.shirt2, K.vest] : [K.shirt3, K.shirt1], bottom: [K.pants, K.pants2], hair: k ? K.hairK : K.hairR,
        arm: (side, a, x0) => { if (side > 0) { a.fill(x0, 5, 2, x0 + 1, 8, 3, (x, y) => (y === 8 ? K.foam : K.mug)); a.put(x0 + 2, 6, 2, K.mug2); } },
      });
      return { parts };
    },
    setup(ctx) { ctx.mem.cheer = -9; ctx.cheer = () => { ctx.mem.cheer = ctx.state.t; }; },
    idle(ctx) {
      const { parts: P, state: { t }, mem } = ctx;
      alive(ctx, 7 + k);
      const u = t - mem.cheer, up = pulse(u, 0.25, 1.6, 0.4), clink = pulse(u - 0.35, 0.1, 0.35);
      P.armL.rotation.x -= 0.9 + 1.6 * up + 0.2 * Math.sin(t * 0.6 + k);
      P.armL.rotation.z += (k ? 0.5 : -0.5) * clink; // mugs to the middle: clink
      P.armR.rotation.x -= 2.8 * up * (k ? 1 : 0.2);
      P.body.position.y += 1.5 * pulse(u, 0.15, 0.5);
      P.head.rotation.x -= 0.3 * up;
    },
  };
}
