// The Market's square: its fountain, the lantern strings over it, the cat, the gardener robot
// and the clutter of a market day. Each export returns a rig definition, origin at its base
// centre, facing +z, 0.15 a voxel, colours prefixed mkt_.
//
//   fountain()        a coursed basin of glowing water, four spouts, an upper bowl, and a
//                     crystal riding a jet of water over it
//   wires(list)       every lantern string in one grid: [[a, b, sag], ...] in the rig's voxels
//   lanternDef        one lantern (a crowd member, hung from its hook): its crystal is white,
//                     so a tint per instance gives each its colour
//   cat()             a grey tabby sitting up, tail going; act() is a hello (tail up, hearts)
//   greens()          the joke: a greengrocer's barrow of GitHub contribution squares, and the
//                     robot who keeps it, in a straw hat, watering them so they grow
//   gate(a, b)        the market gate: two banner posts and the wire between them for a string of lanterns
//   clutter(spots)    crates, sacks and barrels at [kind, x, z, seed] (the rig's voxels)
import { C, colour, hash, noise } from '../kit/voxel-kit.js';
import { box, tone, smooth, clamp01 } from './space.js';

const col = (name, hex, glow = false) => C[name] ?? colour(name, hex, glow);
for (const [n, hex, glow] of [
  ['fs1', 0xbdb5a6], ['fs2', 0xa59e90], ['fs3', 0x8d877b], ['fs4', 0x757066], ['fmortar', 0x3f3b37], ['cope1', 0xd8d0c0], ['cope2', 0xc6bda9], ['poolBed', 0x2a3a48],
  ['ftrace', 0x1fd2ea, true], ['fvia', 0xb6fbff, true], ['fspout', 0x6ff2ff, true],
  ['wa1', 0xd8fdff, true], ['wa2', 0x7ff4ff, true], ['wa3', 0x2ad6ee, true], ['wa4', 0x1a9fc0, true], ['wa5', 0x13789a, true],
  ['xc1', 0xf4ffff, true], ['xc2', 0xa6f7ff, true], ['xc3', 0x6ff2ff, true], ['xc4', 0xb89cff, true],
  ['lw1', 0xffffff, true], ['lw2', 0xd6d6d6, true],
  ['gcat1', 0x8e8e96], ['gcat2', 0x777780], ['gcatS', 0x4c4c55], ['gcatW', 0xf2eee6], ['gcatNose', 0xe79a9a], ['gcatEye', 0xb8ff6a, true],
  ['gh0', 0x1f252d], ['gh1', 0x0e4429], ['gh2', 0x006d32], ['gh3', 0x26a641, true], ['gh4', 0x39d353, true],
  ['bw1', 0x5a3b24], ['bw2', 0x6e4a2a], ['bw3', 0x8a6238], ['tray', 0x2e2018],
  ['bot1', 0xc49c3e], ['bot2', 0xa57f2c], ['bot3', 0x7a5a1e], ['copper', 0xb8683a], ['copper2', 0x94502a], ['botEye', 0x6ff2ff, true], ['botDial', 0xffc764, true],
  ['apron', 0x3f6b3a], ['apron2', 0x335a30], ['straw1', 0xe8c878], ['straw2', 0xcfae5a], ['hatBand', 0xc8323a],
  ['can1', 0x4f8a5a], ['can2', 0x3a6e46], ['holoG', 0x5dffa0, true], ['holoG2', 0x2fae6a, true],
  ['barrel1', 0x6e4a2a], ['barrel2', 0x5a3b24], ['barrel3', 0x86603b], ['hoop', 0x3a3634],
  ['crys1', 0xe6fdff, true], ['crys2', 0xff7ae0, true], ['crys3', 0x6ff2ff, true],
  ['cw1', 0xb28a57], ['cw2', 0xa07644], ['cw3', 0xc39a63], ['batten', 0x6f4c2c], ['sk1', 0xb49a6e], ['sk2', 0xa08658], ['sk3', 0x8a7148], ['rope', 0x6b5a3a],
  ['apple', 0xc8323a], ['apple2', 0xe0503a], ['pear', 0xb8c84a], ['leaf', 0x4f8336],
  ['banR', 0xb8323a], ['banT', 0x1f8a8a], ['banC', 0xefe3c4], ['banC2', 0xd9ccaa], ['coin', 0xffc764, true], ['coin2', 0xfff0b8, true],
]) col(`mkt_${n}`, hex, glow);
const K = (n) => C[`mkt_${n}`];
const STONE = [K('fs1'), K('fs2'), K('fs2'), K('fs3'), K('fs3'), K('fs4')];
const mod = (a, n) => ((a % n) + n) % n;

// ---------------------------------------------------------------------------------------------
// The fountain: basin radius 13, water at y 2; pedestal to y 9, upper bowl at 10..11, a jet to 13, the
// crystal over it at 18 (kept low: every stall's camera looks across the square past it).
export const FOUNTAIN = { r: 13.5, crystal: 18 };
export function fountain() {
  return {
    gait: 'still',
    build() {
      const b = box([-15, 0, -15], [14, 13, 14]);
      const ang = (x, z) => (Math.atan2(z + 0.5, x + 0.5) / (Math.PI * 2) + 1) % 1;
      for (let z = -15; z <= 14; z += 1) for (let x = -15; x <= 14; x += 1) {
        const r = Math.hypot(x + 0.5, z + 0.5), a = ang(x, z);
        if (r > 14.2) continue;
        if (r > 13.2) { b.put(x, 0, z, tone([K('fs3'), K('fs4')], Math.floor(a * 40), 0, 1, 1)); continue; } // the plinth course
        if (r > 10.6) {
          for (let y = 0; y <= 2; y += 1) {
            const seg = a * 30 + (y % 2) * 0.5, joint = seg % 1 < 0.1 || y === 0;
            b.put(x, y, z, joint && y > 0 ? K('fmortar') : y === 0 ? K('fs4') : STONE[Math.floor(hash(Math.floor(seg), y, 3) * STONE.length)]);
          }
          const groove = r > 11.4 && r < 12.3;
          const s = Math.floor(a * 44);
          b.put(x, 3, z, groove ? (hash(s, 4) < 0.62 ? (hash(s, 5) < 0.2 ? K('fvia') : K('ftrace')) : K('fmortar')) : r > 12.6 ? K('cope2') : K('cope1'));
          continue;
        }
        b.put(x, 0, z, K('fs4'));
        b.put(x, 1, z, K('poolBed'));
      }
      // the pedestal: coursed, a spiral of circuit light up it
      for (let y = 1; y <= 9; y += 1) for (let z = -3; z <= 2; z += 1) for (let x = -3; x <= 2; x += 1) {
        const r = Math.hypot(x + 0.5, z + 0.5);
        if (r > 2.9) continue;
        const a = ang(x, z), spiral = Math.abs(mod(a - y / 9, 1) - 0.5) < 0.07 && r > 2;
        b.put(x, y, z, spiral ? K('ftrace') : y % 3 === 0 ? K('fmortar') : tone(STONE, Math.floor(a * 6 + (y % 2) * 0.5), Math.floor(y / 3), 2, 3));
      }
      // four spouts, fish heads with glowing eyes, each pouring an arc into the basin
      for (let k = 0; k < 4; k += 1) {
        const a = Math.PI / 4 + (k * Math.PI) / 2, dx = Math.cos(a), dz = Math.sin(a);
        for (let s = 2.6; s <= 4.2; s += 0.4) b.egg(dx * s, 7.5, dz * s, 0.9, 0.9, 0.9, K('cope1'));
        b.put(Math.floor(dx * 3.6 - dz * 0.7), 8, Math.floor(dz * 3.6 + dx * 0.7), K('fspout'));
        b.put(Math.floor(dx * 3.6 + dz * 0.7), 8, Math.floor(dz * 3.6 - dx * 0.7), K('fspout'));
        for (let s = 0; s <= 1; s += 0.04) {
          const r = 4.6 + 4.2 * s, y = 7.2 + 1.2 * s - 6 * s * s;
          b.put(Math.floor(dx * r), Math.floor(y), Math.floor(dz * r), s < 0.3 ? K('wa1') : s < 0.7 ? K('wa2') : K('wa3'));
        }
      }
      // the upper bowl on the pedestal, and water spilling over its lip in glowing threads
      for (let z = -6; z <= 5; z += 1) for (let x = -6; x <= 5; x += 1) {
        const r = Math.hypot(x + 0.5, z + 0.5);
        if (r > 5.6) continue;
        b.put(x, 10, z, r > 4.4 ? K('cope2') : tone(STONE, x, 10, z, 4));
        if (r > 4.5) b.put(x, 11, z, hash(x, z, 6) < 0.2 ? K('fvia') : K('cope1'));
        if (r > 5 && hash(x, z, 7) < 0.3) for (let y = 9; y >= 7 + Math.floor(hash(x, z, 8) * 2); y -= 1) b.put(x + Math.sign(x + 0.5), y, z + Math.sign(z + 0.5), y % 2 ? K('wa2') : K('wa3'));
      }
      // a brass nozzle in the bowl's middle and the jet off it that holds the crystal up
      b.fill(-1, 11, -1, 0, 11, 0, K('bot1'));
      b.fill(-1, 12, -1, 0, 13, 0, (x, y, z) => ((x + y + z) % 2 ? K('wa1') : K('wa2')));
      // the water (turns slowly, so its swirl reads as current), the upper bowl's water, the crystal
      const water = box([-11, 2, -11], [10, 2, 10]);
      for (let z = -11; z <= 10; z += 1) for (let x = -11; x <= 10; x += 1) {
        const r = Math.hypot(x + 0.5, z + 0.5);
        if (r > 10.7 || r < 2.6) continue;
        const sw = Math.sin(Math.atan2(z + 0.5, x + 0.5) * 3 + r * 0.9);
        water.put(x, 2, z, r > 10 ? K('wa2') : sw > 0.7 ? K('wa1') : sw > 0.1 ? K('wa3') : sw > -0.6 ? K('wa4') : K('wa5'));
      }
      const upper = box([-5, 11, -5], [4, 11, 4]);
      for (let z = -5; z <= 4; z += 1) for (let x = -5; x <= 4; x += 1) { const r = Math.hypot(x + 0.5, z + 0.5); if (r <= 4.5 && r > 1.1) upper.put(x, 11, z, Math.sin(Math.atan2(z + 0.5, x + 0.5) * 2 + r * 1.4) > 0.3 ? K('wa1') : K('wa3')); }
      const crystal = box([-3, 15, -3], [2, 24, 2]);
      for (let y = 15; y <= 24; y += 1) {
        const k = y < 18 ? (y - 14) / 4 : (25 - y) / 7, r = 0.6 + 2.4 * k;
        for (let z = -3; z <= 2; z += 1) for (let x = -3; x <= 2; x += 1) {
          const d = Math.abs(x + 0.5) + Math.abs(z + 0.5); // a square-cut gem, turned 45 degrees
          if (d <= r) crystal.put(x, y, z, d > r - 0.9 ? (y % 2 ? K('xc3') : K('xc4')) : y > 21 ? K('xc1') : K('xc2'));
        }
      }
      return { parts: {
        basin: b.part('basin', [0, 0, 0]),
        water: water.part('water', [0, 2, 0]),
        upper: upper.part('upper', [0, 11, 0]),
        crystal: crystal.part('crystal', [0, FOUNTAIN.crystal, 0]),
      } };
    },
    idle(ctx) {
      const { parts: P, state: { t }, mem } = ctx;
      P.water.rotation.y += t * 0.22;
      P.upper.rotation.y -= t * 0.5;
      P.crystal.rotation.y += t * 0.7;
      P.crystal.position.y += Math.sin(t * 1.3) * 1.2;
      P.crystal.scale.setScalar(1 + 0.05 * Math.sin(t * 3.1));
      // droplets along the arcs, a sparkle off the crystal now and then
      if (t > (mem.next ?? 0)) {
        const V = ctx.voxel, n = Math.floor(t * 20), k = n % 4, a = Math.PI / 4 + (k * Math.PI) / 2, dx = Math.cos(a), dz = Math.sin(a), s = 0.9 + 0.3 * hash(n, 3);
        ctx.bit(dx * 4.8 * V, 7.6 * V, dz * 4.8 * V, dx * 1.7 * s, 0.55, dz * 1.7 * s, 0.5, 0.05, 0xd8fdff, 0x2ad6ee, { fall: 7.5 });
        if (n % 9 === 0) ctx.bit((hash(n, 5) - 0.5) * 3 * V, (FOUNTAIN.crystal - 2) * V, (hash(n, 6) - 0.5) * 3 * V, 0, 0.35, 0, 1.4, 0.05, 0xf4ffff, 0xb89cff, { drag: 0.4 });
        mem.next = t + 0.05;
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Every lantern string in one grid: a one-voxel wire sagging from a to b (stepped finely so it never breaks).
export function wires(list) {
  let built;
  return {
    gait: 'still',
    build() {
      if (built) return built;
      const lo = [0, 1, 2].map((i) => Math.floor(Math.min(...list.flatMap(([a, b]) => [a[i], b[i]]))) - 2);
      const hi = [0, 1, 2].map((i) => Math.ceil(Math.max(...list.flatMap(([a, b]) => [a[i], b[i]]))) + 2);
      lo[1] -= Math.ceil(Math.max(...list.map((w) => w[2] || 0))) + 2;
      const b = box(lo, hi);
      for (const [p, q, sag = 0] of list) {
        const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) * 3);
        for (let i = 0; i <= n; i += 1) {
          const u = i / n, at = [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u - sag * 4 * u * (1 - u), p[2] + (q[2] - p[2]) * u].map(Math.floor);
          b.put(...at, i % 7 === 0 ? C.iron2 : C.iron1);
        }
        for (const e of [p, q]) b.put(Math.floor(e[0]), Math.floor(e[1]), Math.floor(e[2]), C.brass2);
      }
      built = { parts: { wire: b.part('wire', [0, 0, 0]) } };
      return built;
    },
  };
}
// Where a lantern hangs on a string (voxels): the same curve.
export const along = (p, q, sag, u) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u - sag * 4 * u * (1 - u), p[2] + (q[2] - p[2]) * u];

// One lantern, hung from its hook at the origin: a brass cap, an iron cage, a white crystal (tinted per instance).
export const lanternDef = {
  gait: 'still',
  build() {
    const b = box([-1, -8, -1], [1, 0, 1]);
    b.put(0, 0, 0, C.iron3); b.put(0, -1, 0, C.brass2);
    b.fill(-1, -2, -1, 1, -2, 1, (x, y, z) => (x === 0 && z === 0 ? C.brass2 : (x + z) % 2 ? C.iron2 : C.brass1));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.fill(x, -5, z, x, -3, z, C.iron1);
    b.fill(0, -5, 0, 0, -3, 0, K('lw1'));
    for (const [x, z] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) b.put(x, -4, z, K('lw2'));
    b.fill(-1, -6, -1, 1, -6, 1, (x, y, z) => (x === 0 && z === 0 ? K('lw2') : C.iron2));
    b.put(0, -7, 0, C.brass2);
    return { parts: { lantern: b.part('lantern', [0.5, 0.5, 0.5]) } };
  },
};

// ---------------------------------------------------------------------------------------------
// A grey tabby sitting up (its paws at y 4), looking out; the tail goes.
export function cat() {
  return {
    gait: 'still',
    build() {
      const y0 = 4;
      const b = box([-4, y0, -5], [3, y0 + 13, 4]);
      const fur = (x, y, z) => (mod(y + Math.floor(x / 2), 3) === 0 && z < 1 ? K('gcatS') : hash(x, y, z) < 0.5 ? K('gcat1') : K('gcat2'));
      b.egg(0, y0 + 2.6, -1.2, 3, 2.7, 3, fur); // haunches
      b.egg(0, y0 + 5, 0.4, 2.1, 3.1, 1.9, (x, y, z) => (z >= 1 && y < y0 + 6 ? K('gcatW') : fur(x, y, z))); // chest, a white bib
      b.egg(0, y0 + 9.2, 0.9, 2.6, 2.1, 2.3, (x, y, z) => (y <= y0 + 8 && z >= 2 ? K('gcatW') : mod(x, 2) === 0 && y >= y0 + 10 ? K('gcatS') : K('gcat1'))); // head
      for (const s of [-1, 1]) { const x = s < 0 ? -3 : 2; b.put(x, y0 + 11, 1, K('gcat2')); b.put(x, y0 + 12, 1, K('gcat1')); b.put(x - s * -0, y0 + 11, 2, K('gcatNose')); } // ears
      b.cut(-2, y0 + 9, 3); b.cut(1, y0 + 9, 3);
      b.put(-2, y0 + 9, 2, K('gcatEye')); b.put(1, y0 + 9, 2, K('gcatEye'));
      b.put(-1, y0 + 8, 3, K('gcatNose')); b.put(0, y0 + 8, 3, K('gcatNose'));
      for (const x of [-2, 1]) b.fill(x, y0, 2, x, y0 + 1, 2, K('gcatW')); // front paws
      const tail = box([-4, y0, -6], [5, y0 + 3, 4]);
      tail.rope([[0.5, y0 + 1, -3.5], [2.5, y0 + 0.6, -3], [3.6, y0 + 0.6, -0.8], [3, y0 + 0.8, 1.6], [1.8, y0 + 1.6, 2.8]], 0.7, 0.55, (x, y, z) => (z >= 2 ? K('gcatS') : (x + z) % 3 === 0 ? K('gcatS') : K('gcat2')));
      return { parts: { cat: b.part('cat', [0, y0, 0]), tail: tail.part('tail', [0.5, y0 + 1, -3.5]) } };
    },
    setup(ctx) { ctx.mem.pet = -10; },
    idle(ctx) {
      const { parts: P, state: { t }, mem } = ctx;
      const pet = clamp01(1 - (t - mem.pet) / 3.2); // said hello to: the tail goes up, a quicker swish, a turn his way
      P.cat.scale.set(1, 1 + 0.025 * Math.sin(t * 1.6) + 0.04 * pet, 1);
      P.cat.rotation.y += (0.25 * Math.sin(t * 0.23) + 0.1 * Math.sin(t * 0.61)) * (1 - pet) + 0.35 * pet;
      P.tail.rotation.y += (0.25 + 0.3 * pet) * Math.sin(t * (1.4 + 5 * pet)) + 0.1 * Math.sin(t * 3.3);
      P.tail.rotation.x -= 0.7 * pet;
    },
    // a hello: hearts float up off it
    act(ctx) { ctx.mem.pet = ctx.state.t; const V = ctx.voxel; for (let k = 0; k < 5; k += 1) ctx.bit((k - 2) * 0.6 * V, 17 * V, 1.5 * V, (k - 2) * 0.05, 0.45 + 0.05 * k, 0.05, 1.3, 0.06, 0xff9ad8, 0xff4fd8, { drag: 0.6 }); },
  };
}

// ---------------------------------------------------------------------------------------------
// The greens barrow and its robot. The barrow (front, z -7..7): a slanted tray of contribution
// squares in GitHub's five greens, busier on weekdays, the last weeks all bright; a hologram tag.
// The robot behind it (z -12): a brass barrel on one wheel, a green apron, a copper head with one
// big eye under a straw hat; its right arm holds a watering can over the tray and tips it now and then.
export function greens() {
  return {
    gait: 'still',
    build() {
      const b = box([-13, 0, -17], [12, 31, 9]);
      // ---- the barrow: four legs, a slanted tray with a rim, the squares
      const floor = (z) => 8 + Math.round(((7 - z) * 3) / 14);
      for (const [x, z] of [[-11, -7], [10, -7], [-11, 7], [10, 7]]) b.fill(x, 0, z, x, floor(z) - 1, z, (xx, y) => (y === 0 ? C.iron2 : tone([K('bw1'), K('bw2')], xx, Math.floor(y / 3), z, 1)));
      for (const z of [-7, 7]) b.fill(-11, 4, z, 10, 4, z, K('bw1')); // a stretcher
      for (let z = -7; z <= 7; z += 1) for (let x = -11; x <= 10; x += 1) {
        const y = floor(z), rim = x === -11 || x === 10 || z === -7 || z === 7;
        b.put(x, y, z, rim ? K('bw3') : K('tray'));
        if (rim) b.put(x, y + 1, z, (x + z) % 4 === 0 ? K('bot1') : K('bw2'));
      }
      for (let j = 0; j < 7; j += 1) for (let i = 0; i < 10; i += 1) {
        const x = -10 + 2 * i, z = -6 + 2 * j, r = hash(i, j, 5), weekday = j > 0 && j < 6, recent = i >= 7;
        let lvl = weekday ? (r < 0.15 ? 0 : r < 0.4 ? 1 : r < 0.62 ? 2 : r < 0.84 ? 3 : 4) : r < 0.55 ? 0 : r < 0.85 ? 1 : 2;
        if (recent) lvl = Math.max(lvl, weekday ? 3 : 2) + (hash(i, j, 6) < 0.5 ? 1 : 0);
        lvl = Math.min(4, lvl);
        const id = [K('gh0'), K('gh1'), K('gh2'), K('gh3'), K('gh4')][lvl], y = floor(z) + 1;
        b.put(x, y, z, id);
        if (lvl === 4) b.put(x, y + 1, z, id); // the best ones heaped up
      }
      // the tag: a hologram card on a stick at the front corner, a grid on it
      b.fill(9, floor(6) + 1, 6, 9, floor(6) + 6, 6, K('bw1'));
      for (let y = 0; y < 6; y += 1) for (let x = 0; x < 6; x += 1) {
        const edge = x === 0 || x === 5 || y === 0 || y === 5, dot = x % 2 === 1 && y % 2 === 1 && !edge;
        if (edge || dot) b.put(7 + x, floor(6) + 7 + y, 6, dot || (x + y) % 3 === 0 ? K('holoG') : K('holoG2'));
      }
      // ---- the robot: a wheel, a brass barrel body with bands and rivets, a glowing dial, a green apron
      const bz = -12;
      for (let y = 0; y <= 7; y += 1) for (let z = bz - 4; z <= bz + 3; z += 1) {
        const d = Math.hypot(y - 3.5, z - bz);
        if (d <= 3.8) for (const x of [-1, 0]) b.put(x, y, z, d > 2.9 ? K('hoop') : d < 0.9 ? K('bot1') : (Math.round(Math.atan2(y - 3.5, z - bz) * 1.9) % 2 ? C.iron2 : C.iron3));
      }
      for (const x of [-2, 1]) b.fill(x, 3, bz, x, 9, bz, C.iron2); // the fork
      for (let y = 9; y <= 19; y += 1) for (let z = bz - 4; z <= bz + 3; z += 1) for (let x = -4; x <= 3; x += 1) {
        const r = Math.hypot(x + 0.5, z + 0.5 - bz) - (y === 9 || y === 19 ? 0.6 : 0);
        if (r > 3.6) continue;
        let id = y === 10 || y === 18 ? C.iron2 : mod(Math.floor(Math.atan2(z + 0.5 - bz, x + 0.5) * 4), 3) === 0 && y % 3 === 0 ? K('bot3') : hash(x, y, z) < 0.3 ? K('bot2') : K('bot1');
        if (r > 2.9 && z - bz >= 2 && y >= 11 && y <= 15 && Math.abs(x + 0.5) < 3) id = y === 11 || x === -3 || x === 2 ? K('apron2') : K('apron'); // the apron
        if (r > 2.9 && z - bz >= 2 && y === 17 && Math.abs(x + 0.5) <= 1) id = K('botDial');
        b.put(x, y, z, id);
      }
      b.fill(-1, 12, bz + 4, 0, 13, bz + 4, K('apron2')); // the apron's pocket, a trowel in it
      b.put(-1, 14, bz + 4, C.iron3);
      b.fill(-5, 17, bz - 1, -5, 18, bz, K('bot3')); b.fill(4, 17, bz - 1, 4, 18, bz, K('bot3')); // shoulders
      b.fill(-6, 12, bz, -6, 17, bz, C.iron2); b.fill(-6, 11, bz, -6, 11, bz + 1, K('bot2')); // the left arm, hanging
      b.fill(-1, 20, bz - 1, 0, 20, bz, C.iron3); // the neck
      // ---- the head: a copper dome, one big eye, bolts, a straw hat with a red band, an antenna through it
      const head = box([-5, 21, bz - 5], [4, 32, bz + 4]);
      head.egg(0, 23.6, bz, 3, 2.8, 3, (x, y, z) => (y === 21 ? C.iron2 : (x + y) % 4 === 0 ? K('copper2') : K('copper')));
      head.fill(-1, 23, bz + 3, 0, 24, bz + 3, K('botEye'));
      head.put(-2, 23, bz + 3, C.iron2); head.put(1, 23, bz + 3, C.iron2);
      for (const x of [-4, 3]) head.put(x, 23, bz, K('bot1'));
      for (let z = bz - 5; z <= bz + 4; z += 1) for (let x = -5; x <= 4; x += 1) {
        const r = Math.hypot(x + 0.5, z + 0.5 - bz);
        if (r <= 4.8) head.put(x, 26, z, (x * 3 + z) % 4 === 0 ? K('straw2') : K('straw1'));
        if (r <= 2.6) head.put(x, 27, z, r > 2 ? K('hatBand') : K('straw1'));
        if (r <= 2.2) head.put(x, 28, z, hash(x, z, 3) < 0.3 ? K('straw2') : K('straw1'));
      }
      head.put(-1, 29, bz, C.iron3); head.put(-1, 30, bz, C.iron3); head.put(-1, 31, bz, K('botEye'));
      // ---- the right arm and the watering can, held out over the tray
      const arm = box([2, 14, bz - 2], [9, 25, bz + 13]);
      arm.rope([[5.5, 17.5, bz + 0.5], [5.5, 18.5, bz + 3], [5.5, 19.5, bz + 5]], 0.5, 0.5, C.iron2);
      arm.fill(5, 19, bz + 5, 6, 20, bz + 5, K('bot2')); // the hand
      arm.fill(4, 19, bz + 6, 8, 22, bz + 8, (x, y, z) => (y === 22 && z === bz + 7 ? 0 : (x + y) % 3 === 0 ? K('can2') : K('can1')));
      arm.fill(5, 23, bz + 7, 7, 23, bz + 7, K('can2')); // the handle
      arm.rope([[6, 20.5, bz + 8.5], [6, 21.5, bz + 10.5], [6, 22, bz + 11.5]], 0.5, 0.5, K('can2'));
      arm.fill(5, 21, bz + 11, 7, 23, bz + 11, (x, y) => (x === 6 && y === 22 ? K('bot3') : K('bot1'))); // the rose
      return { parts: {
        base: b.part('base', [0, 0, 0]),
        head: head.part('head', [0, 21, bz]),
        arm: arm.part('arm', [5, 17, bz]),
      } };
    },
    idle(ctx) {
      const { parts: P, state: { t }, mem } = ctx;
      const cycle = t % 6, tip = smooth(clamp01((cycle - 1) / 0.5)) * (1 - smooth(clamp01((cycle - 3.6) / 0.6)));
      P.arm.rotation.x += 0.35 * tip + 0.04 * Math.sin(t * 2);
      P.head.rotation.y += 0.35 * Math.sin(t * 0.4) * (1 - tip) - 0.25 * tip;
      P.head.rotation.x += 0.18 * tip;
      if (tip > 0.8 && t > (mem.next ?? 0)) { // water from the rose, falling on the squares
        const V = ctx.voxel, n = Math.floor(t * 30);
        const rose = ctx.where(P.arm), tipA = 0.35 * tip, fwd = 11 * V, up = 6 * V; // from the shoulder to the rose, tipped
        ctx.bit(rose.x + (1 + (hash(n, 1) - 0.5) * 2) * V, rose.y + up * Math.cos(tipA) - fwd * Math.sin(tipA), rose.z + fwd * Math.cos(tipA) + up * Math.sin(tipA) + (hash(n, 2) - 0.5) * 2 * V, 0, -0.5, 0.2, 0.5, 0.04, 0xd8fdff, 0x6ff2ff, { fall: 5 });
        mem.next = t + 0.04;
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The market gate where a street comes in: two banner posts at a and b (the rig's voxels, on its ground), each a
// banded timber mast on a stone footing, crystals on its brass cap, a long striped pennant down its street face (+z)
// with a glowing coin at its head (the first red and cream, the second teal and cream), and an iron wire slung
// between them for a string of lanterns (hung by the district: along(GATE.ends(a, b)..., u)).
export const GATE = { top: 46, tie: 43, sag: 4, ends: (a, b) => [[a[0], GATE.tie, a[1]], [b[0], GATE.tie, b[1]]] };
export function gate(a, b) {
  let built;
  return {
    gait: 'still',
    build() {
      if (built) return built;
      const [ta, tb] = GATE.ends(a, b);
      const g = box([Math.floor(Math.min(a[0], b[0])) - 4, 0, Math.floor(Math.min(a[1], b[1])) - 4], [Math.ceil(Math.max(a[0], b[0])) + 4, GATE.top + 3, Math.ceil(Math.max(a[1], b[1])) + 4]);
      [a, b].forEach(([x, z], seed) => {
        const X = Math.round(x), Z = Math.round(z), A = seed ? K('banT') : K('banR');
        g.fill(X - 2, 0, Z - 2, X + 1, 1, Z + 1, (xx, y, zz) => (y === 1 && (xx === X - 2 || xx === X + 1 || zz === Z - 2 || zz === Z + 1) ? K('fs4') : tone([K('fs2'), K('fs3')], xx, y, zz, 5)));
        g.fill(X - 1, 2, Z - 1, X, GATE.top - 1, Z, (xx, y) => (y % 12 === 0 ? C.brass2 : Math.floor(y / 3) % 2 ? K('bw1') : K('bw2')));
        g.fill(X - 2, GATE.top, Z - 2, X + 1, GATE.top, Z + 1, (xx, y, zz) => ((xx + zz) % 2 ? C.brass1 : C.brass2)); // a brass cap
        g.put(X - 1, GATE.top + 1, Z - 1, K('crys3')); g.put(X, GATE.top + 1, Z, K('crys1')); g.put(X - 1, GATE.top + 2, Z, K('crys1')); g.put(X, GATE.top + 1, Z - 1, K('crys2'));
        // a long pennant down the post's street face: stripes, a glowing coin near its head, a swallowtail
        for (let y = 20; y <= GATE.top - 3; y += 1) for (let k = -2; k <= 1; k += 1) {
          if (y < 23 && (k === -1 || k === 0 || (y < 21 && (k === -2 || k === 1)))) continue;
          const c = Math.hypot(k + 0.5, y - 37.5);
          g.put(X + k, y, Z + 1, c <= 1.6 ? (y === 37 || y === 38 ? K('coin2') : K('coin')) : y === GATE.top - 3 ? K('bw1') : Math.floor((y - 20) / 3) % 2 ? A : hash(k, y, seed) < 0.3 ? K('banC2') : K('banC'));
        }
      });
      const n = Math.ceil(Math.hypot(tb[0] - ta[0], tb[2] - ta[2]) * 3); // the wire, sagging between the posts
      for (let i = 0; i <= n; i += 1) g.put(...along(ta, tb, GATE.sag, i / n).map(Math.floor), i % 7 === 0 ? C.iron2 : C.iron1);
      built = { parts: { gate: g.part('gate', [0, 0, 0]) } };
      return built;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The clutter of a market day, at [kind, x, z, seed] in the rig's voxels: 'crates', 'sacks', 'barrel',
// 'crystals' (a barrel of glowing shards), 'fruit' (a crate of apples and pears).
export function clutter(spots) {
  let built;
  return {
    gait: 'still',
    build() {
      if (built) return built;
      const lo = [Math.min(...spots.map((s) => s[1])) - 8, 0, Math.min(...spots.map((s) => s[2])) - 8];
      const hi = [Math.max(...spots.map((s) => s[1])) + 8, 16, Math.max(...spots.map((s) => s[2])) + 8];
      const b = box(lo.map(Math.floor), hi.map(Math.ceil));
      const crate = (x0, y0, z0, w, h, d, seed) => b.fill(x0, y0, z0, x0 + w - 1, y0 + h - 1, z0 + d - 1, (x, y, z) => {
        const ex = x === x0 || x === x0 + w - 1, ey = y === y0 || y === y0 + h - 1, ez = z === z0 || z === z0 + d - 1;
        if (!ex && !ey && !ez) return 0;
        if ((ex && ey) || (ey && ez) || (ex && ez)) return hash(x, y, z) < 0.15 ? C.iron2 : K('batten');
        return tone([K('cw1'), K('cw2'), K('cw3'), K('cw1')], Math.floor((x + z) / 3), Math.floor(y / 2), seed, 11);
      });
      const barrel = (cx, cz, seed, fill) => {
        for (let y = 0; y <= 7; y += 1) for (let z = cz - 4; z <= cz + 3; z += 1) for (let x = cx - 4; x <= cx + 3; x += 1) {
          const r = Math.hypot(x + 0.5 - cx, z + 0.5 - cz), R = 3.1 + 0.4 * Math.sin((y / 7) * Math.PI);
          if (r > R) continue;
          if (y === 7 && r < R - 0.8) { if (fill) b.put(x, y, z, hash(x, z, seed) < 0.5 ? K('crys2') : K('crys3')); else b.put(x, y, z, (x + z) % 3 ? K('barrel3') : K('barrel2')); continue; }
          if (r < R - 1) continue;
          const stave = Math.floor((Math.atan2(z + 0.5 - cz, x + 0.5 - cx) + Math.PI) * 2.6);
          b.put(x, y, z, y === 1 || y === 6 ? K('hoop') : tone([K('barrel1'), K('barrel2'), K('barrel3')], stave, 0, seed, 3));
        }
        if (fill) for (const [dx, dy, dz, c] of [[0, 8, 0, 'crys1'], [-1, 8, 1, 'crys2'], [1, 9, 0, 'crys3'], [0, 8, -1, 'crys3']]) b.put(cx + dx, dy, cz + dz, K(c));
      };
      const sack = (cx, cz, seed, h = 6) => {
        b.egg(cx, h * 0.45, cz, 2.2, h * 0.5, 2, (x, y, z) => (hash(x, y, z + seed) < 0.2 ? K('sk3') : (x + y) % 3 ? K('sk1') : K('sk2')));
        b.put(Math.floor(cx), Math.round(h * 0.9), Math.floor(cz), K('rope'));
        b.put(Math.floor(cx), Math.round(h * 0.9) + 1, Math.floor(cz), K('sk2'));
      };
      for (const [kind, x, z, seed] of spots) {
        const X = Math.round(x), Z = Math.round(z);
        if (kind === 'crates') { crate(X - 3, 0, Z - 3, 6, 5, 6, seed); crate(X - 2 + (seed % 2), 5, Z - 2, 5, 4, 5, seed + 1); if (seed % 3 === 0) crate(X + 3, 0, Z - 1, 4, 4, 4, seed + 2); }
        else if (kind === 'sacks') { sack(X, Z, seed); sack(X + 3.5, Z + 1, seed + 1, 5); sack(X + 1.5, Z - 2.5, seed + 2, 5); }
        else if (kind === 'barrel' || kind === 'crystals') barrel(X, Z, seed, kind === 'crystals');
        else if (kind === 'fruit') {
          crate(X - 3, 0, Z - 2, 7, 4, 5, seed);
          for (let dz = -1; dz <= 1; dz += 1) for (let dx = -2; dx <= 2; dx += 1) b.put(X + dx, 4, Z + dz, hash(dx, dz, seed) < 0.6 ? (hash(dx, dz, seed + 1) < 0.5 ? K('apple') : K('apple2')) : K('pear'));
          b.put(X, 5, Z, K('apple')); b.put(X - 1, 5, Z, K('pear')); b.put(X, 6, Z, K('leaf'));
        }
      }
      built = { parts: { clutter: b.part('clutter', [0, 0, 0]) } };
      return built;
    },
  };
}
