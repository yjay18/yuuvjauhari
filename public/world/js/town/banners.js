// Banners on the town's gatehouses and towers: a brass rod with crystal finials, a cloth in three hanging
// lengths (so it sways as a chain would), a gold border, a glowing sigil and a fringe. One rig posed for every
// banner and stamped into instanced meshes (kit.crowd): two draw calls for all of them, each on its own sway.
//   placeBanners(THREE, kit) -> { group, update(t) }
import { C, colour, hash } from '../kit/voxel-kit.js';
import { box } from '../models/space.js';
import { GATES, TOWERS, WALL, WALL_OUT, towerHeight, raster, V } from './plan.js';

const col = (n, hex, glow = false) => C[`town_ban_${n}`] ?? colour(`town_ban_${n}`, hex, glow);
const K = Object.fromEntries([
  ['red1', 0x8a2a2a], ['red2', 0xa83632], ['red3', 0x6e2020], ['gold', 0xd9ac44], ['gold2', 0xb08a30],
  ['rod', 0xc49c3e], ['rod2', 0x8a6a26], ['sig', 0x6ff2ff, true], ['sig2', 0xd8fdff, true], ['fin', 0x9b7bff, true],
].map(([n, hex, glow]) => [n, col(n, hex, glow)]));
const SIGIL = ['...#...', '..###..', '.#.#.#.', '#######', '.#.#.#.', '..###..', '...#...']; // a crystal in a compass

function cloth(y0, y1, withSigil, fringe) {
  const b = box([-4, y0, 0], [4, y1, 0]);
  for (let y = y0; y <= y1; y += 1) for (let x = -4; x <= 4; x += 1) {
    if (fringe && y === y0 && (x + 4) % 2) continue;
    const border = Math.abs(x) === 4 || (fringe && y === y0 + 1);
    const gi = x + 3, gj = y1 - 1 - y;
    if (withSigil && gi >= 0 && gi < 7 && gj >= 0 && gj < 7 && SIGIL[gj][gi] === '#') b.put(x, y, 0, gj === 3 && gi === 3 ? K.sig2 : K.sig);
    else b.put(x, y, 0, border ? (hash(x, y, 3) < 0.5 ? K.gold : K.gold2) : [K.red1, K.red2, K.red1, K.red3][Math.floor(hash(x >> 1, y >> 2, 5) * 4)]);
  }
  return b;
}
export const bannerDef = {
  gait: 'still',
  build() {
    const rod = box([-6, 0, 0], [6, 1, 1]);
    rod.fill(-5, 0, 0, 5, 0, 0, (x) => (x % 3 === 0 ? K.rod2 : K.rod));
    for (const x of [-6, 6]) { rod.put(x, 0, 0, K.fin); rod.put(x, 1, 0, K.fin); }
    const top = cloth(-7, -1, false, false), mid = cloth(-15, -8, true, false), low = cloth(-22, -16, false, true);
    top.part('top', [0, -0.5, 0.5]);
    return { parts: { rod: rod.part('rod', [0, 0, 0.5]), top: top.part('top', [0, -0.5, 0.5]), mid: mid.part('mid', [0, -7.5, 0.5], top), low: low.part('low', [0, -15.5, 0.5], mid) } };
  },
  idle({ parts: P, state: { t } }) {
    P.top.rotation.x = 0.1 * Math.sin(t * 1.3);
    P.mid.rotation.x = 0.14 * Math.sin(t * 1.3 - 0.7);
    P.low.rotation.x = 0.2 * Math.sin(t * 1.3 - 1.4);
    P.low.rotation.z = 0.06 * Math.sin(t * 0.9);
  },
};

// Where the banners hang: either side of every gatehouse's outer arch, and on the town-facing face of every
// other tower (the sea wall's on its outer face, which the town's camera sees).
export function bannerSpots() {
  const R = raster(), spots = [], ground = (x, z) => R.base[(Math.floor(z / V) - R.k0) * R.nx + (Math.floor(x / V) - R.i0)];
  for (const g of GATES) {
    if (g.river) continue;
    const ax = Math.sin(g.dir), az = Math.cos(g.dir), side = WALL_OUT[g.wall];
    const nx = -az * side, nz = ax * side, out = (WALL.thick * V) / 2 + 0.02, y = (ground(g.at[0], g.at[1]) + WALL.gate - 3) * V; // outward
    for (const s of [-1, 1]) spots.push({ at: [g.at[0] + ax * s * (g.w / 2 + 0.75) + nx * out, y, g.at[1] + az * s * (g.w / 2 + 0.75) + nz * out], face: Math.atan2(nx, nz) });
  }
  TOWERS.forEach((t, i) => {
    if (t.kind === 'gate' || (t.kind === 'land' && i % 2)) return;
    const half = Math.round(t.r / V) * V + 0.02, toward = t.kind === 'sea' ? [0, 1] : [-10 - t.at[0], -20 - t.at[1]];
    const [nx, nz] = Math.abs(toward[0]) > Math.abs(toward[1]) ? [Math.sign(toward[0]), 0] : [0, Math.sign(toward[1])];
    spots.push({ at: [t.at[0] + nx * half, (ground(t.at[0], t.at[1]) + towerHeight(t) - 6) * V, t.at[1] + nz * half], face: Math.atan2(nx, nz) });
  });
  return spots;
}

export function placeBanners(THREE, kit) {
  const spots = bannerSpots(), crowd = kit.crowd('town:banner', bannerDef, spots.length), group = new THREE.Group();
  group.name = 'town-banners';
  for (const m of crowd.meshes) { m.castShadow = false; group.add(m); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const update = (t) => {
    spots.forEach((s, i) => { m4.compose(p.set(...s.at), q.setFromAxisAngle(up, s.face), one); crowd.pose(i, m4, t + i * 1.7, 0, false); });
    crowd.count(spots.length);
  };
  update(0);
  return { group, update, count: spots.length };
}
