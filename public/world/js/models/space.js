// A part grid addressed in model voxels: give its inclusive bounds, draw in
// model coordinates, then turn it into a rig part with its pivot in model voxels.
// (The rig takes a child's `at` relative to its parent's grid, so `part` converts.)
import { grid, set, clear, voxelAt, hash } from '../kit/voxel-kit.js';

export function box([x0, y0, z0], [x1, y1, z1]) {
  if (![x0, y0, z0, x1, y1, z1].every(Number.isInteger)) throw new Error('box bounds must be whole voxels');
  const g = grid(x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1);
  const o = [x0, y0, z0];
  const b = {
    g, o,
    put: (x, y, z, id) => set(g, x - x0, y - y0, z - z0, typeof id === 'function' ? id(x, y, z) : id),
    cut: (x, y, z) => clear(g, x - x0, y - y0, z - z0),
    at: (x, y, z) => voxelAt(g, x - x0, y - y0, z - z0),
    fill(xa, ya, za, xb, yb, zb, id) {
      for (let y = ya; y <= yb; y += 1) for (let z = za; z <= zb; z += 1) for (let x = xa; x <= xb; x += 1) b.put(x, y, z, id);
    },
    // Every voxel whose centre lies inside the ellipsoid.
    egg(cx, cy, cz, rx, ry, rz, id, keep = () => true) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z += 1) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + ((z + 0.5 - cz) / rz) ** 2 <= 1 && keep(x, y, z)) b.put(x, y, z, id);
      }
    },
    // A tapering rope through [x, y, z] points (model voxels).
    rope(points, r0, r1, id) {
      let total = 0;
      const lens = points.slice(1).map((p, k) => { const l = Math.hypot(...p.map((v, i) => v - points[k][i])); total += l; return l; });
      let walked = 0;
      lens.forEach((len, k) => {
        const [a, c] = [points[k], points[k + 1]];
        const steps = Math.max(1, Math.ceil(len * 2));
        for (let s = 0; s <= steps; s += 1) {
          const t = s / steps;
          const p = a.map((v, i) => v + (c[i] - v) * t);
          const r = Math.max(0.5, r0 + (r1 - r0) * ((walked + len * t) / (total || 1)));
          b.egg(p[0], p[1], p[2], r, r, r, id);
        }
        walked += len;
      });
    },
    part(name, pivot, parent) {
      b.name = name;
      b.pivotModel = pivot;
      b.pivotGrid = pivot.map((v, i) => v - o[i]);
      const at = parent ? pivot.map((v, i) => v - parent.pivotModel[i] + parent.pivotGrid[i]) : pivot;
      return { grid: g, at, pivot: b.pivotGrid, parent: parent?.name };
    },
  };
  return b;
}

// Pick one of `tones` by a repeatable hash of a voxel (and a seed).
export const tone = (tones, x, y, z, seed = 0) => tones[Math.floor(hash(x + seed * 1013, y + seed * 7, z) * tones.length)];
export const smooth = (u) => { const t = Math.max(0, Math.min(1, u)); return t * t * (3 - 2 * t); };
export const clamp01 = (u) => Math.max(0, Math.min(1, u));
