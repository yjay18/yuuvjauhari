// Cyber props, to place anywhere: data orbs, clouds, slung cables with glowing
// beads, holographic signs and rune stones. Each export returns a rig definition
// for kit.rig(key, def): deterministic, meshed once, alive at rest in its idle
// (bob, turn, flicker; never re-meshed), origin at its base centre, facing +z,
// 0.15 a voxel like everything else.
//
//   dataOrb(variant)          'cyan' | 'magenta' | 'amber': a lattice orb over an emitter, bits in orbit
//   cloud(seed, size = 1)     soft puffs in three tones on a flat underside, drifting (night just darkens it)
//   cable(a, b, sag, beads)   a cable slung between two points (model voxels), glowing beads twinkling in a chase
//   holoSign(glyph, colours)  a hologram (7 strings of 7) over a projector post; colours [core, mid, dim]
//   runeStone(seed)           a knee-high standing stone, a rune carved in each face, glowing in turn
import { C, colour, hash, noise } from '../kit/voxel-kit.js';
import { box, tone } from './space.js';

const col = (name, hex, glow = false) => C[name] ?? colour(name, hex, glow);
for (const [n, hex, glow] of [
  ['st1', 0x9a948a], ['st2', 0x857f76], ['st3', 0xaea89c], ['st4', 0x6c675f],
  ['cloud1', 0xffffff], ['cloud2', 0xedf2f9], ['cloud3', 0xd3e1f0], ['cloud4', 0xb9cce2],
  ['wire1', 0x1c1c22], ['wire2', 0x2c2c36], ['socket', 0x4a4a55],
  ['bead1', 0xffc764, true], ['bead2', 0xff5ad8, true], ['bead3', 0x6ff2ff, true],
  ['rs1', 0x7f7c88], ['rs2', 0x6c6975], ['rs3', 0x9a96a2], ['rs4', 0x57545f], ['crack', 0x2f2d36],
  ['lichen1', 0x9aa65e], ['lichen2', 0xc4b86a], ['moss1', 0x4f6a35], ['moss2', 0x6a8a44],
  ['rune1', 0x9b87ff, true], ['rune2', 0x6ff2ff, true], ['rune3', 0xe6fdff, true],
]) col(`fx_${n}`, hex, glow);
const K = (n) => C[`fx_${n}`];

// A one-voxel wire along a curve p(t), t 0..1, stepped finely so it never breaks
// (a rope of radius 0.5 skips voxels whenever a sample falls between their centres).
function wire(b, p, len, id) {
  const n = Math.max(2, Math.ceil(len * 3));
  for (let i = 0; i <= n; i += 1) { const [x, y, z] = p(i / n).map(Math.floor); b.put(x, y, z, id); }
}
const through = (pts) => (t) => { const f = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), u = f - i; return pts[i].map((v, k) => v + (pts[i + 1][k] - v) * u); };

// Its own copy of the glow material for each named part, so each can brighten and dim on its own.
function ownGlow(ctx, names) {
  return names.map((n) => {
    const m = new ctx.THREE.MeshBasicMaterial({ vertexColors: true });
    ctx.parts[n].traverse((o) => { if (o.isMesh && o.material.isMeshBasicMaterial) o.material = m; });
    return m;
  });
}

// ---------------------------------------------------------------------------------------------
// A data orb: an icosahedral cage (dark struts with data glowing along them, glowing nodes) round a
// white-hot core girdled by a spinning ring, three bits in tilted orbits, bobbing over a stone emitter.
const ORB = { cyan: [0xf4ffff, 0xa6f7ff, 0x3fd8ff, 0x1a86b8], magenta: [0xfff0fb, 0xffa3ea, 0xff4fd8, 0x9c2493], amber: [0xfffbe8, 0xffe08a, 0xffae3f, 0xc0621a] };
const PHI = (1 + Math.sqrt(5)) / 2;
const ICO = [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]];

export function dataOrb(variant = 'cyan') {
  const key = ORB[variant] ? variant : 'cyan';
  const [heart, inner, mid, rim] = ORB[key].map((hex, i) => col(`fx_orb_${key}${i}`, hex, true));
  const H = 15; // the orb's centre floats this high
  let built;
  return {
    gait: 'still',
    build() {
      if (built) return built;
      // the emitter: a bevelled stone plinth, an iron collar with brass corners, a glowing lens, light at the seams
      const base = box([-4, 0, -4], [3, 3, 3]);
      base.fill(-4, 0, -4, 3, 0, 3, (x, y, z) => (Math.abs(x + 0.5) + Math.abs(z + 0.5) > 6 ? 0 : tone([K('st1'), K('st2'), K('st2'), K('st4')], x, y, z, 1)));
      base.fill(-3, 1, -3, 2, 1, 2, (x, y, z) => (Math.abs(x + 0.5) + Math.abs(z + 0.5) > 4.5 ? 0 : (x + z) % 3 === 0 ? K('st3') : K('st1')));
      base.fill(-2, 2, -2, 1, 2, 1, (x, y, z) => ((x === -2 || x === 1) && (z === -2 || z === 1) ? C.brass2 : C.iron2));
      base.fill(-1, 3, -1, 0, 3, 0, inner);
      for (const [x, z] of [[-3, 0], [2, -1], [0, 2], [-1, -3]]) base.put(x, 1, z, mid);
      // the shell: thirty metal struts flecked with data, twelve glowing nodes
      const R = 6.4, edge = R * 1.0515;
      const V = ICO.map((v) => { const l = Math.hypot(...v); return v.map((c) => (c / l) * R); });
      const shell = box([-8, H - 8, -8], [7, H + 7, 7]);
      for (let i = 0; i < 12; i += 1) for (let k = i + 1; k < 12; k += 1) {
        const [a, b] = [V[i], V[k]];
        if (Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) - edge) > 0.01) continue;
        for (let s = 0; s <= 24; s += 1) {
          const q = a.map((v, j) => v + (b[j] - v) * (s / 24));
          shell.put(Math.floor(q[0]), H + Math.floor(q[1]), Math.floor(q[2]), (s + i) % 6 === 3 ? mid : (s + k) % 3 ? C.iron2 : C.iron3);
        }
      }
      for (const v of V) { shell.egg(v[0], H + v[1], v[2], 1.0, 1.0, 1.0, inner); shell.put(Math.floor(v[0]), H + Math.floor(v[1]), Math.floor(v[2]), heart); }
      const core = box([-4, H - 4, -4], [3, H + 3, 3]);
      core.egg(0, H, 0, 2.8, 2.8, 2.8, (x, y, z) => { const d = Math.hypot(x + 0.5, y + 0.5 - H, z + 0.5); return d < 1.5 ? heart : d < 2.3 ? inner : mid; });
      const ring = box([-5, H, -5], [4, H, 4]);
      for (let z = -5; z <= 4; z += 1) for (let x = -5; x <= 4; x += 1) { const d = Math.hypot(x + 0.5, z + 0.5); if (d > 3.7 && d <= 4.7) ring.put(x, H, z, (x + z) % 4 ? inner : heart); }
      const bits = [0, 1, 2].map((i) => { const b = box([-1, H - 1, -1], [0, H, 0]); b.fill(-1, H - 1, -1, 0, H, 0, (x, y, z) => ((x + y + z + i) % 2 ? inner : mid)); return b; });
      built = { parts: {
        base: base.part('base', [0, 0, 0]),
        shell: shell.part('shell', [0, H, 0]),
        core: core.part('core', [0, H, 0]),
        ring: ring.part('ring', [0, H + 0.5, 0]),
        ...Object.fromEntries(bits.map((b, i) => [`bit${i}`, b.part(`bit${i}`, [0, H, 0])])),
      } };
      return built;
    },
    idle({ parts: P, state: { t } }) {
      const bob = Math.sin(t * 1.5) * 0.8;
      for (const n of ['shell', 'core', 'ring', 'bit0', 'bit1', 'bit2']) P[n].position.y += bob;
      P.shell.rotation.set(0.3 * Math.sin(t * 0.45), t * 0.6, 0.2 * Math.sin(t * 0.37 + 1));
      P.ring.rotation.set(0.5, -t * 2.2, 0.35 * Math.sin(t * 0.6));
      P.core.rotation.set(t * 0.9, -t * 1.4, 0);
      P.core.scale.setScalar(1 + 0.12 * Math.sin(t * 3.3) + 0.04 * Math.sin(t * 11));
      for (let i = 0; i < 3; i += 1) {
        const a = t * (1.5 + i * 0.45) + i * 2.1, tilt = [0.35, -0.8, 1.2][i], r = 9.4 + i * 0.6;
        const w = Math.sin(a) * r, bit = P[`bit${i}`];
        bit.position.x += Math.cos(a) * r; bit.position.y += w * Math.sin(tilt); bit.position.z += w * Math.cos(tilt);
        bit.rotation.set(t * 2.1 + i, t * 1.7, t * 1.3);
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// A cloud: overlapping puffs, bigger in the middle, crowned by smaller ones, cut flat underneath
// (the bottom layer drawn in so the edge rounds off); white on top, pale blue below. Two wisps drift round it.
export function cloud(seed = 0, size = 1) {
  let built;
  return {
    gait: 'still',
    build() {
      if (built) return built;
      const L = Math.round((28 + hash(seed, 1) * 14) * size);
      const n = 4 + Math.floor(hash(seed, 2) * 3);
      const puffs = [];
      for (let i = 0; i < n; i += 1) {
        const f = i / (n - 1), r = (4 + 3.8 * Math.sin(Math.PI * (0.15 + 0.7 * f)) * (0.75 + 0.5 * hash(seed, i, 3))) * size;
        puffs.push([(f - 0.5) * (L - r), r * 0.45, (hash(seed, i, 4) - 0.5) * 6 * size, r]);
      }
      for (let i = 0; i < 3; i += 1) {
        const [x, , z, r] = puffs[1 + Math.floor(hash(seed, i, 5) * (n - 2))];
        puffs.push([x + (hash(seed, i, 6) - 0.5) * r, r * 0.95, z + (hash(seed, i, 7) - 0.5) * 3 * size, r * (0.55 + 0.2 * hash(seed, i, 8))]);
      }
      const inside = (x, y, z, list = puffs) => list.some(([px, py, pz, r]) => ((x + 0.5 - px) / r) ** 2 + ((y + 0.5 - py) / (r * 0.8)) ** 2 + ((z + 0.5 - pz) / (r * 0.9)) ** 2 <= 1);
      const X = Math.ceil(L / 2 + 8 * size), Y = Math.ceil(17 * size), Z = Math.ceil(12 * size);
      let top = 1;
      for (let y = 0; y <= Y; y += 1) for (let z = -Z; z <= Z; z += 1) for (let x = -X; x <= X; x += 1) if (inside(x, y, z)) top = Math.max(top, y);
      const shade = (x, y, z) => {
        const k = y / top, r = hash(x, y, z + seed * 7);
        if (y === 0) return K('cloud4');
        if (k < 0.25) return r < 0.6 ? K('cloud3') : K('cloud4');
        if (k < 0.5) return r < 0.7 ? K('cloud2') : K('cloud3');
        return r < 0.82 ? K('cloud1') : K('cloud2');
      };
      const body = box([-X, 0, -Z], [X, Y, Z]);
      for (let y = 0; y <= Y; y += 1) for (let z = -Z; z <= Z; z += 1) for (let x = -X; x <= X; x += 1) {
        if (!inside(x, y, z)) continue;
        if (y === 0 && ![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => inside(x + dx, 0, z + dz))) continue;
        body.put(x, y, z, shade(x, y, z));
      }
      const wisp = (i) => {
        const r = (2.4 + hash(seed, i, 9)) * size, cx = (i ? 1 : -1) * (L / 2 + 1.5 * size), cy = 3 * size, cz = (hash(seed, i, 10) - 0.5) * 6 * size;
        const w = box([Math.floor(cx - r - 1), 0, Math.floor(cz - r - 1)], [Math.ceil(cx + r + 1), Math.ceil(cy + r + 1), Math.ceil(cz + r + 1)]);
        w.egg(cx, cy, cz, r * 1.3, r * 0.75, r, (x, y, z) => (y + 0.5 > cy + r * 0.2 ? K('cloud1') : hash(x, y, z) < 0.5 ? K('cloud2') : K('cloud3')));
        return w.part(`wisp${i}`, [cx, cy, cz]);
      };
      built = { parts: { body: body.part('body', [0, 0, 0]), wisp0: wisp(0), wisp1: wisp(1) } };
      return built;
    },
    idle({ parts: P, state: { t }, pose }) {
      pose.position.y += 0.12 * Math.sin(t * 0.5 + seed); // world units
      pose.position.x += 0.35 * Math.sin(t * 0.13 + seed * 2); // drifting slowly to and fro
      pose.rotation.y += 0.04 * Math.sin(t * 0.09 + seed);
      P.body.scale.set(1 + 0.012 * Math.sin(t * 0.6), 1 + 0.03 * Math.sin(t * 0.6 + 1), 1 + 0.012 * Math.sin(t * 0.6 + 2)); // breathing
      for (const [i, s] of [[0, 1], [1, -1]]) {
        const w = P[`wisp${i}`];
        w.position.x += s * (0.8 + 0.8 * Math.sin(t * 0.31 + i * 2));
        w.position.y += 0.6 * Math.sin(t * 0.47 + i);
        w.position.z += 1.2 * Math.sin(t * 0.23 + i * 3);
        w.scale.setScalar(1 + 0.08 * Math.sin(t * 0.7 + i));
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// A cable slung between two points (model voxels), sagging `sag` at its middle, with a socket at each end
// and `beads` glowing beads hanging under little caps. The beads twinkle in a chase; the cable sways.
export function cable(a, b, sag = 6, beads = 8) {
  const axis = [0, 1, 2].map((i) => b[i] - a[i]);
  let built;
  return {
    gait: 'still',
    build() {
      if (built) return built;
      const at = (t) => [a[0] + axis[0] * t, a[1] + axis[1] * t - sag * 4 * t * (1 - t), a[2] + axis[2] * t];
      const lo = [0, 1, 2].map((i) => Math.floor(Math.min(a[i], b[i])) - 2), hi = [0, 1, 2].map((i) => Math.ceil(Math.max(a[i], b[i])) + 2);
      lo[1] -= Math.ceil(sag) + 4;
      const line = box(lo, hi);
      wire(line, at, Math.hypot(...axis) + sag, (x, y, z) => ((x + y + z) % 5 ? K('wire1') : K('wire2')));
      for (const e of [a, b]) line.egg(e[0], e[1], e[2], 1.2, 1.2, 1.2, (x, y, z) => ((x + z) % 2 ? K('socket') : C.iron3));
      const groups = [0, 1, 2].map(() => box(lo, hi));
      for (let i = 1; i <= beads; i += 1) {
        const [x, y, z] = at(i / (beads + 1)).map(Math.floor);
        line.put(x, y - 1, z, K('socket'));
        const id = [K('bead1'), K('bead2'), K('bead3')][(i - 1) % 3];
        groups[(i - 1) % 3].put(x, y - 2, z, id); groups[(i - 1) % 3].put(x, y - 3, z, id);
      }
      built = { parts: { wire: line.part('wire', a), ...Object.fromEntries(groups.map((g, k) => [`bead${k}`, g.part(`bead${k}`, a)])) } };
      return built;
    },
    setup(ctx) {
      ctx.mem.glow = ownGlow(ctx, ['bead0', 'bead1', 'bead2']);
      ctx.mem.axis = new ctx.THREE.Vector3(...axis).normalize();
    },
    idle({ parts: P, state: { t }, mem }) {
      mem.glow.forEach((m, k) => m.color.setScalar(0.4 + 0.6 * Math.max(0, Math.sin(t * 3 - k * 2.1)) ** 2));
      const sway = 0.05 * Math.sin(t * 1.3) + 0.02 * Math.sin(t * 3.1);
      for (const n of ['wire', 'bead0', 'bead1', 'bead2']) P[n].rotateOnAxis(mem.axis, sway);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// A holographic sign: a stone footing, an iron post with brass collars and a coiled lead, a projector
// head, and over it a hovering hologram (a lit border, the glyph, see-through scanlines) with a scanline
// sweeping up it and the odd glitch.
export function holoSign(glyph, colours = [0xd8fdff, 0x3fe6ff, 0x1a9fc0]) {
  const [core, mid, dim] = colours.map((hex) => col(`fx_holo_${hex.toString(16)}`, hex, true));
  const G = (i, j) => glyph[j]?.[i] === '#';
  let built;
  return {
    gait: 'still',
    build() {
      if (built) return built;
      const post = box([-3, 0, -3], [2, 13, 2]);
      post.fill(-3, 0, -3, 2, 0, 2, (x, y, z) => ((x === -3 || x === 2) && (z === -3 || z === 2) ? 0 : tone([K('st1'), K('st2'), K('st2'), K('st4')], x, y, z, 3)));
      post.fill(-2, 1, -2, 1, 1, 1, (x, y, z) => ((x === -2 || x === 1) && (z === -2 || z === 1) ? 0 : (x + z) % 3 === 0 ? K('st3') : K('st1')));
      post.fill(-1, 2, -1, 0, 10, 0, (x, y) => (y === 4 || y === 8 ? C.brass2 : y % 3 === 0 ? C.iron2 : C.iron1));
      wire(post, through([[1.3, 10, 0.5], [1.2, 8.5, -0.9], [-0.3, 7, -1.3], [-1.3, 5.5, 0.2], [0.2, 4, 1.4], [1.4, 2.5, 0.4]]), 14, K('wire1')); // a coiled lead
      post.fill(-2, 11, -2, 1, 11, 1, C.iron2);
      post.fill(-2, 12, -2, 1, 12, 1, (x, y, z) => ((x === -2 || x === 1) && (z === -2 || z === 1) ? C.iron3 : dim));
      post.fill(-1, 13, -1, 0, 13, 0, core); // the lens
      // the hologram: 11 wide, hovering over the lens, with a faint beam under it
      const holo = box([-6, 14, 0], [4, 26, 0]);
      for (const [x, y] of [[-1, 14], [0, 14], [-2, 15], [1, 15], [-1, 15]]) holo.put(x, y, 0, dim);
      for (let y = 16; y <= 26; y += 1) for (let x = -6; x <= 4; x += 1) {
        const gi = x + 4, gj = 24 - y;
        const edge = x === -6 || x === 4 || y === 16 || y === 26, corner = (x === -6 || x === 4) && (y === 16 || y === 26);
        if (gi >= 0 && gi < 7 && gj >= 0 && gj < 7 && G(gi, gj)) holo.put(x, y, 0, (gi + gj) % 4 ? core : mid);
        else if (corner) holo.put(x, y, 0, core);
        else if (edge) holo.put(x, y, 0, (x + y) % 5 === 0 ? dim : mid);
        else if (y % 2 === 0 && hash(x, y, 13) > 0.3) holo.put(x, y, 0, dim);
      }
      const scan = box([-5, 17, 1], [3, 17, 1]);
      scan.fill(-5, 17, 1, 3, 17, 1, (x) => (x % 3 === 0 ? 0 : core));
      built = { parts: { post: post.part('post', [0, 0, 0]), holo: holo.part('holo', [-0.5, 14, 0.5]), scan: scan.part('scan', [-0.5, 17.5, 1.5]) } };
      return built;
    },
    idle({ parts: P, state: { t } }) {
      const glitch = hash(Math.floor(t * 12), 7) < 0.04; // now and then it jumps and thins
      const sway = 0.08 * Math.sin(t * 0.8), hover = 0.3 * Math.sin(t * 1.6);
      P.holo.position.x += glitch ? 1.2 : 0;
      P.holo.position.y += hover;
      P.holo.rotation.y += sway;
      P.holo.scale.set(glitch ? 0.9 : 1 + 0.01 * Math.sin(t * 37), 1, 1);
      P.scan.position.y += hover + ((t * 6) % 9);
      P.scan.rotation.y += sway;
      P.scan.visible = !glitch;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// A rune stone: knee-high, rounded and weathered (courses of grey, lichen on its back, moss at the foot,
// a crack), a rune carved into each face with its glow set in the cut. The runes brighten in turn round
// the stone, and now and then a mote of light drifts up off one.
const RUNES = [
  ['#.#', '##.', '#.#', '##.', '#..'], // fehu
  ['#.#', '###', '.#.', '.#.', '.#.'], // algiz
  ['.#.', '#.#', '.#.', '#.#', '#.#'], // othala
  ['##.', '#.#', '##.', '#.#', '#.#'], // raido
  ['#..', '##.', '#.#', '##.', '#..'], // thurisaz
  ['..#', '.#.', '#.#', '.#.', '#..'], // sowilo
];
export function runeStone(seed = 0) {
  const H = 12;
  let built;
  return {
    gait: 'still',
    build() {
      if (built) return built;
      // a menhir: broad at the foot, tapering, leaning a little, one shoulder higher than the other
      const hw = (y) => 4.4 - 1.3 * (y / H) ** 1.5 + 0.5 * (noise(y, seed, 2.5, 3) - 0.5);
      const hd = (y) => 3.0 - 0.6 * (y / H) ** 1.5 + 0.4 * (noise(y, seed + 9, 2.5, 5) - 0.5);
      const lean = (y) => y * 0.08;
      const inStone = (x, y, z) => {
        if (y < 0) return false;
        const cx = x - lean(y);
        const top = H - 0.5 - 0.3 * cx - 3 * (cx / hw(y)) ** 2 - 1.6 * (Math.abs(z) / 3) ** 2 + (hash(x, z, seed + 3) - 0.5) * 0.9; // a domed top, higher on one shoulder, chipped
        return y <= top && (Math.abs(cx) / hw(y)) ** 2.2 + (Math.abs(z) / hd(y)) ** 2.2 <= 1;
      };
      const stone = box([-6, 0, -5], [6, H, 5]);
      for (let y = 0; y <= H; y += 1) for (let z = -5; z <= 5; z += 1) for (let x = -6; x <= 5; x += 1) {
        if (!inStone(x, y, z)) continue;
        const band = Math.floor((y + noise(x, z, 4, seed) * 3) / 2);
        let id = [K('rs1'), K('rs2'), K('rs3'), K('rs1'), K('rs4')][((band % 5) + 5) % 5];
        if (hash(x, y, z + seed) < 0.28) id = hash(x, y, z + seed + 1) < 0.4 ? K('rs2') : K('rs3'); // speckled grain
        if (noise(x + y, z - y, 3, seed + 4) > 0.74) id = K('rs4'); // weathered pits
        if (y > 4 && z < 0 && noise(x + seed, y, 3, 7) > 0.55) id = hash(x, y, z) < 0.5 ? K('lichen1') : K('lichen2');
        if (y <= 1 && noise(x, z + seed, 3, 8) > 0.45) id = hash(x, y, z) < 0.5 ? K('moss1') : K('moss2');
        stone.put(x, y, z, id);
      }
      // a crack down the left side
      for (let y = 4; y <= 9; y += 1) { const z = Math.round(1.5 - (y - 4) * 0.6); for (let x = -6; x <= 0; x += 1) if (stone.at(x, y, z)) { stone.put(x, y, z, K('crack')); break; } }
      // rubble and tufts round the foot
      for (let i = 0; i < 9; i += 1) {
        const a = i * 0.7 + hash(seed, i) * 0.5, r = 4.6 + hash(seed, i, 2) * 1.2, x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r * 0.8);
        if (stone.at(x, 0, z)) continue;
        stone.put(x, 0, z, i % 3 === 0 ? C.leaf2 : tone([K('st1'), K('st2'), K('st4')], x, 0, z, 5));
        if (i % 3 === 0) stone.put(x, 1, z, C.leaf3);
      }
      // the runes: one on each face (front, right, back, left), cut a voxel deep, the glow in the cut
      const faces = [[[0, 0, 1], [1, 0, 0]], [[1, 0, 0], [0, 0, -1]], [[0, 0, -1], [-1, 0, 0]], [[-1, 0, 0], [0, 0, 1]]]; // outward, and rightward seen from outside
      const runes = faces.map(([out, right], k) => {
        const glyph = RUNES[Math.floor(hash(seed, k, 31) * RUNES.length)];
        const r = box([-6, 0, -5], [6, H, 5]);
        for (let j = 0; j < 5; j += 1) for (let i = 0; i < 3; i += 1) {
          if (glyph[j][i] !== '#') continue;
          const y = 7 - j, h = i - 1;
          let [x, z] = [right[0] * h, right[2] * h];
          while (inStone(x + out[0], y, z + out[2])) { x += out[0]; z += out[2]; } // out to the face
          stone.cut(x, y, z); stone.cut(x - out[0], y, z - out[2]);
          r.put(x - out[0], y, z - out[2], K('rune2'));
        }
        return r;
      });
      built = { parts: { stone: stone.part('stone', [0, 0, 0]), ...Object.fromEntries(runes.map((r, k) => [`rune${k}`, r.part(`rune${k}`, [0, 0, 0])])) } };
      return built;
    },
    setup(ctx) { ctx.mem.glow = ownGlow(ctx, ['rune0', 'rune1', 'rune2', 'rune3']); ctx.mem.next = 0.6; },
    idle(ctx) {
      const { state: { t }, mem } = ctx;
      mem.glow.forEach((m, k) => m.color.setScalar(0.45 + 0.65 * Math.max(0, Math.sin(t * 1.4 - (k * Math.PI) / 2)) ** 3 + 0.04 * Math.sin(t * 23 + k)));
      if (t > mem.next) { // a mote of light drifts up off a rune
        const k = Math.floor(hash(Math.floor(t * 10), 3) * 4), [dx, dz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][k], V = ctx.voxel;
        ctx.bit(dx * 3.2 * V, 5.5 * V, dz * 2.4 * V, dx * 0.06, 0.4, dz * 0.06, 1.8, 0.05, 0xe6fdff, 0x9b87ff, { drag: 0.3 });
        mem.next = t + 0.7 + hash(Math.floor(t * 10), 4) * 0.9;
      }
    },
  };
}
