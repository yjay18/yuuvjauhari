// Small props any district can use (colours prefixed prop_):
//   tree(seed, { h, r, fruit })  a round-crowned tree: a tapering trunk on roots, two
//                                 limbs, a crown of leaf clusters shaded dark below and
//                                 light on top, a few glowing data-fruit; the crown sways.
//   bench()                       a timber bench on iron legs, for a story at the foot.
// Each returns a rig definition standing at its own origin, facing +z.
import { C, colour, hash, noise } from '../kit/voxel-kit.js';
import { box, tone } from './space.js';

for (const [n, hex, glow] of [
  ['bark1', 0x4a3424], ['bark2', 0x5b4130], ['bark3', 0x3a281b], ['moss', 0x55703a],
  ['leaf1', 0x2c5424], ['leaf2', 0x3b6b2c], ['leaf3', 0x4f8336], ['leaf4', 0x6a9c44], ['leaf5', 0x86b050],
  ['fruit1', 0x6ff2ff, true], ['fruit2', 0xffc764, true], ['fruit3', 0xff7ad9, true],
  ['seat1', 0x8a6440], ['seat2', 0x9c7650], ['seat3', 0x6f4f32],
]) colour(`prop_${n}`, hex, glow);
const K = (n) => C[`prop_${n}`];

export function tree(seed = 1, { h = 17, r = 7.5, fruit = 2 } = {}) {
  const top = Math.round(h);
  function build() {
    const trunk = box([-4, 0, -4], [3, top + 2, 3]);
    for (let y = 0; y <= top; y += 1) {
      const rr = 1.7 - (y / top) * 0.8 + (y < 2 ? 0.6 : 0);
      for (let z = -3; z <= 2; z += 1) for (let x = -3; x <= 2; x += 1) {
        if (Math.hypot(x + 0.5, z + 0.5) > rr) continue;
        const moss = y < 5 && z < 0 && hash(x, y, z + seed) < 0.4;
        trunk.put(x, y, z, moss ? K('moss') : tone([K('bark1'), K('bark2'), K('bark1'), K('bark3')], x, Math.floor(y / 2), z, seed));
      }
    }
    for (const [dx, dz] of [[1, 0.3], [-0.7, 0.9], [-0.4, -1]]) trunk.rope([[dx * 1.2, 0.5, dz * 1.2], [dx * 3, 0, dz * 3]], 0.8, 0.5, K('bark3')); // roots
    // the crown: clusters of leaves on two limbs, shaded by height, ragged at the edge
    const crown = box([-12, top - 6, -12], [11, top + 14, 11]);
    const blobs = [[0, top + 5, 0, r], [r * 0.55, top + 2.5, r * 0.25, r * 0.7], [-r * 0.5, top + 3, -r * 0.3, r * 0.72], [r * 0.1, top + 3, -r * 0.6, r * 0.62], [-r * 0.25, top + 2, r * 0.55, r * 0.6]];
    for (const [bx, , bz] of blobs.slice(1, 3)) trunk.rope([[0, top - 3, 0], [bx * 0.7, top + 1, bz * 0.7]], 0.9, 0.6, K('bark2'));
    const L = [K('leaf1'), K('leaf2'), K('leaf3'), K('leaf4'), K('leaf5')];
    for (const [bx, by, bz, br] of blobs) {
      crown.egg(bx, by, bz, br, br * 0.72, br, (x, y, z) => {
        const shade = (y - (top - 1)) / (r * 1.6) + (noise(x, z, 3, seed) - 0.5) * 0.5 + (x + z > 0 ? 0.08 : -0.05);
        return L[Math.max(0, Math.min(4, Math.floor(shade * 4.2)))];
      }, (x, y, z) => hash(x, y, z + seed * 7) > 0.08);
    }
    // glowing data-fruit on the crown's skin
    let n = 0;
    for (let i = 0; i < 400 && n < fruit + 3; i += 1) {
      const a = hash(i, seed, 1) * Math.PI * 2, u = hash(i, seed, 2) * 0.9 - 0.3;
      const [bx, by, bz, br] = blobs[i % blobs.length];
      const x = Math.floor(bx + Math.cos(a) * br * Math.sqrt(1 - u * u)), y = Math.floor(by + u * br * 0.72), z = Math.floor(bz + Math.sin(a) * br * Math.sqrt(1 - u * u));
      if (crown.at(x, y, z)) { crown.put(x, y - 1, z, [K('fruit1'), K('fruit2'), K('fruit3')][(seed + n) % 3]); n += 1; }
    }
    return { parts: { trunk: trunk.part('trunk', [0, 0, 0]), crown: crown.part('crown', [0, top - 2, 0]) } };
  }
  return {
    gait: 'still',
    build,
    idle({ parts: P, state: { t } }) {
      P.crown.rotation.z += 0.025 * Math.sin(t * 0.9 + seed);
      P.crown.rotation.x += 0.02 * Math.sin(t * 0.7 + seed * 2);
    },
  };
}

export function bench() {
  return {
    gait: 'still',
    build() {
      const b = box([-7, 0, -3], [6, 9, 2]);
      for (const x of [-6, 5]) { b.fill(x, 0, -2, x, 3, -2, C.iron2); b.fill(x, 0, 1, x, 3, 1, C.iron2); b.fill(x, 4, -2, x, 8, -2, C.iron1); }
      b.fill(-7, 4, -2, 6, 4, 2, (x, y, z) => (z === 0 ? K('seat3') : tone([K('seat1'), K('seat2')], x, y, z, 2)));
      b.fill(-7, 7, -3, 6, 8, -3, (x, y) => (y === 8 ? K('seat2') : K('seat1')));
      return { parts: { bench: b.part('bench', [0, 0, 0]) } };
    },
  };
}
