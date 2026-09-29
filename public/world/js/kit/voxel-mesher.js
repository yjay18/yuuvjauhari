// Greedy voxel mesher with per-vertex ambient occlusion. Render-free: it takes
// a grid and returns flat arrays ready for THREE.BufferGeometry.
//
// A grid is { data, sx, sy, sz, palette }:
//   data     Uint16Array (or Uint8Array), index x + sx * (z + sz * y), 0 = air
//   palette  array of [r, g, b] in LINEAR colour (see linearPalette), by id
// Options on the grid:
//   glow     Set of ids to mesh into a third sink, drawn unlit (emissive look)
//   clear    Set of ids that are see-through (glass, water): faces between a
//            clear voxel and a solid one show, clear against clear do not
//
// Ids are packed into 16 bits of the face mask: palettes can hold 65k colours.
// (An 8-bit version of this once rendered every colour past 255 as another
// model's colour. Keep the id wide.)

const AO_LEVEL = [0.45, 0.68, 0.85, 1];

export const linearPalette = (hexes) => hexes.map((hex) => [16, 8, 0].map((shift) => ((hex >> shift) & 255) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)));

class Sink {
  constructor(palette) {
    this.palette = palette;
    this.positions = [];
    this.normals = [];
    this.colours = [];
    this.indices = [];
    this.quads = 0;
  }
  quad(corners, normal, id, ao, back) {
    const base = this.positions.length / 3;
    const rgb = this.palette[id] || [1, 0, 1];
    for (let c = 0; c < 4; c += 1) {
      this.positions.push(corners[c][0], corners[c][1], corners[c][2]);
      this.normals.push(normal[0], normal[1], normal[2]);
      const shade = AO_LEVEL[ao[c]];
      this.colours.push(rgb[0] * shade * 255, rgb[1] * shade * 255, rgb[2] * shade * 255);
    }
    // Flip the diagonal so the darker corners do not smear across the quad.
    const flip = ao[0] + ao[2] > ao[1] + ao[3];
    const order = flip ? [0, 1, 2, 0, 2, 3] : [1, 2, 3, 1, 3, 0];
    if (back) order.reverse();
    for (const o of order) this.indices.push(base + o);
    this.quads += 1;
  }
  pack() {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      colours: new Uint8Array(this.colours),
      indices: this.positions.length / 3 > 65535 ? new Uint32Array(this.indices) : new Uint16Array(this.indices),
      quads: this.quads,
    };
  }
}

// Meshes the box [x0, x0 + w) x [y0, y0 + h) x [z0, z0 + d) of the grid.
// Positions are relative to the box origin; neighbour lookups cross the box
// edge, so chunk seams are right. Returns { opaque, glass, glow }.
export function meshBox(grid, x0 = 0, y0 = 0, z0 = 0, w = grid.sx, h = grid.sy, d = grid.sz) {
  const { data, sx, sy, sz } = grid;
  const get = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz ? 0 : data[x + sx * (z + sz * y)]);
  const clearSet = grid.clear || null;
  const isClear = (id) => Boolean(clearSet && clearSet.has(id));
  const visible = (a, b) => a !== 0 && (b === 0 || (isClear(b) && !isClear(a)));
  const opaque = new Sink(grid.palette);
  const glass = new Sink(grid.palette);
  const lit = new Sink(grid.palette);
  const origin = [x0, y0, z0];
  const dims = [w, h, d];
  const x = [0, 0, 0];
  const q = [0, 0, 0];
  const p = [0, 0, 0];
  const du = [0, 0, 0];
  const dv = [0, 0, 0];

  for (let axis = 0; axis < 3; axis += 1) {
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;
    const width = dims[u];
    const height = dims[v];
    const mask = new Int32Array(width * height);
    q[0] = q[1] = q[2] = 0;
    q[axis] = 1;

    // Corner occlusion for the face of `cell` looking along +/- axis: the eight cells round the one in
    // front of the face, read straight from the array (0 outside the grid).
    const Su = axis === 0 ? sx * sz : axis === 1 ? sx : 1; // stride along u
    const Sv = axis === 0 ? sx : axis === 1 ? 1 : sx * sz; // stride along v
    const nu = [sx, sy, sz][u], nv = [sx, sy, sz][v], na = [sx, sy, sz][axis];
    const lvl = (s1, s2, co) => (s1 && s2 ? 0 : 3 - (s1 + s2 + co));
    const ao = (cx, cy, cz, step) => {
      p[0] = cx; p[1] = cy; p[2] = cz;
      p[axis] += step;
      if (p[axis] < 0 || p[axis] >= na) return 255;
      const pu = p[u], pv = p[v], at = p[0] + sx * (p[2] + sz * p[1]);
      const um = pu > 0, up = pu + 1 < nu, vm = pv > 0, vp = pv + 1 < nv;
      const a0 = um && data[at - Su] ? 1 : 0, a1 = up && data[at + Su] ? 1 : 0, b0 = vm && data[at - Sv] ? 1 : 0, b1 = vp && data[at + Sv] ? 1 : 0;
      const mm = um && vm && data[at - Su - Sv] ? 1 : 0, pm = up && vm && data[at + Su - Sv] ? 1 : 0;
      const pp = up && vp && data[at + Su + Sv] ? 1 : 0, mp = um && vp && data[at - Su + Sv] ? 1 : 0;
      return lvl(a0, b0, mm) | (lvl(a1, b0, pm) << 2) | (lvl(a1, b1, pp) << 4) | (lvl(a0, b1, mp) << 6);
    };

    // The scan walks the grid's own array (strides, not lookups): the box lies inside the grid, so only
    // the slice's two cells along `axis` can fall outside it. Same faces as a get() per cell, many times faster.
    const S = [1, sx * sz, sx], size = [sx, sy, sz], c = [0, 0, 0];
    for (x[axis] = -1; x[axis] < dims[axis]; x[axis] += 1) {
      let n = 0;
      const ca = origin[axis] + x[axis], aIn = ca >= 0 && ca < size[axis], bIn = ca + 1 >= 0 && ca + 1 < size[axis];
      for (let j = 0; j < height; j += 1) {
        let at = ca * S[axis] + (origin[v] + j) * S[v] + origin[u] * S[u];
        for (let i = 0; i < width; i += 1, at += S[u]) {
          const a = aIn ? data[at] : 0;
          const b = bIn ? data[at + S[axis]] : 0;
          if (a === b || (!clearSet && a !== 0 && b !== 0)) { mask[n] = 0; n += 1; continue; }
          c[axis] = ca; c[u] = origin[u] + i; c[v] = origin[v] + j;
          if (visible(a, b)) mask[n] = a | (ao(c[0], c[1], c[2], 1) << 16);
          else if (visible(b, a)) mask[n] = b | (ao(c[0] + q[0], c[1] + q[1], c[2] + q[2], -1) << 16) | (1 << 24);
          else mask[n] = 0;
          n += 1;
        }
      }
      n = 0;
      for (let j = 0; j < height; j += 1) {
        for (let i = 0; i < width;) {
          const cell = mask[n];
          if (cell === 0) { i += 1; n += 1; continue; }
          let runW = 1;
          while (i + runW < width && mask[n + runW] === cell) runW += 1;
          let runH = 1;
          outer: for (; j + runH < height; runH += 1) {
            for (let k = 0; k < runW; k += 1) if (mask[n + k + runH * width] !== cell) break outer;
          }
          const id = cell & 0xffff;
          const bits = (cell >> 16) & 255;
          const back = (cell >> 24) & 1;
          const aoCorners = [bits & 3, (bits >> 2) & 3, (bits >> 4) & 3, (bits >> 6) & 3];
          x[u] = i;
          x[v] = j;
          const base = [x[0], x[1], x[2]];
          base[axis] += 1;
          du[0] = du[1] = du[2] = 0;
          dv[0] = dv[1] = dv[2] = 0;
          du[u] = runW;
          dv[v] = runH;
          const corners = [
            [base[0], base[1], base[2]],
            [base[0] + du[0], base[1] + du[1], base[2] + du[2]],
            [base[0] + du[0] + dv[0], base[1] + du[1] + dv[1], base[2] + du[2] + dv[2]],
            [base[0] + dv[0], base[1] + dv[1], base[2] + dv[2]],
          ];
          const normal = [0, 0, 0];
          normal[axis] = back ? -1 : 1;
          const sink = isClear(id) ? glass : grid.glow && grid.glow.has(id) ? lit : opaque;
          sink.quad(corners, normal, id, aoCorners, back);
          for (let l = 0; l < runH; l += 1) for (let k = 0; k < runW; k += 1) mask[n + k + l * width] = 0;
          i += runW;
          n += runW;
        }
      }
    }
  }
  return { opaque: opaque.pack(), glass: glass.pack(), glow: lit.pack() };
}

// A mesh part as a THREE.BufferGeometry, or null if it has no faces.
// `centre` moves the grid so its footprint is centred on x and z with y = 0 at
// its base; `scale` is the size of one voxel in world units.
export function toGeometry(THREE, part, grid, { scale = 1, centre = true } = {}) {
  if (!part.indices.length) return null;
  const g = new THREE.BufferGeometry();
  // Copies: a cached mesh may be shared, and translate/scale mutate in place.
  g.setAttribute("position", new THREE.BufferAttribute(part.positions.slice(), 3));
  g.setAttribute("normal", new THREE.BufferAttribute(part.normals.slice(), 3));
  g.setAttribute("color", new THREE.BufferAttribute(part.colours, 3, true));
  g.setIndex(new THREE.BufferAttribute(part.indices, 1));
  if (centre) g.translate(-grid.sx / 2, 0, -grid.sz / 2);
  g.scale(scale, scale, scale);
  g.computeBoundingSphere();
  return g;
}
