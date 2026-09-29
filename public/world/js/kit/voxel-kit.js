// Voxel kit: a shared palette (named colours, some glowing), grids, and the
// shapes that keep coming up. Render-free and deterministic: build with
// `hash`, never Math.random, so the same call always gives the same model.
//
// Scale: at VOXEL = 0.15 world units, a unit-sized cell is about 7 voxels
// across and a 2.5-unit character about 17 voxels tall. That is fine enough
// for window frames, mortar lines and eyes that glow, and coarse enough to
// stay cheap. Keep one voxel size across a whole scene.

import { linearPalette } from "./voxel-mesher.js";

export const VOXEL = 0.15;

// --- the palette -----------------------------------------------------------
const HEX = [0];
export const GLOWS = new Set();
export const C = {};
export const PALETTE = [[0, 0, 0]];

// Adds a named colour and returns its id. Give each file its own name prefix
// (`hero_`, `tower_`) so two files never fight over a name. Glowing colours are
// meshed apart and drawn unlit: flames, runes, lit windows, eyes.
export function colour(name, hex, glow = false) {
  if (C[name]) throw new Error(`colour ${name} twice`);
  C[name] = HEX.length;
  HEX.push(hex);
  PALETTE.push(linearPalette([hex])[0]);
  if (glow) GLOWS.add(C[name]);
  if (HEX.length > 65000) throw new Error("the palette is full");
  return C[name];
}
// A small base palette: stone, metal, wood, cloth, nature, light. Extend per project.
for (const [name, hex, glow] of [
  ["stone1", 0xc4bdb0], ["stone2", 0xa39c90], ["stone3", 0x847e74], ["stone4", 0x66615a], ["mortar", 0x4a4640],
  ["iron1", 0x2a2624], ["iron2", 0x413b36], ["iron3", 0x6a6158],
  ["brass1", 0x8a6a26], ["brass2", 0xc49c3e], ["gold", 0xf0c24a],
  ["wood1", 0x4f3422], ["wood2", 0x76502f], ["wood3", 0x9d7a50], ["leather", 0x6a3f26],
  ["cloth1", 0x862826], ["cloth2", 0xb33c34], ["cloth3", 0x3f6b74],
  ["leaf1", 0x2e5224], ["leaf2", 0x437033], ["leaf3", 0x5e9140], ["bark", 0x4c3826],
  ["skin1", 0xeebc98], ["skin2", 0xd6a080], ["bone", 0xeee2c6], ["dark", 0x1b1918],
  ["ember", 0x8e2410, true], ["fire1", 0xd4401a, true], ["fire2", 0xff7424, true], ["fire3", 0xffac38, true], ["fire4", 0xffe070, true], ["hot", 0xfff5d6, true],
  ["volt1", 0x3569e0, true], ["volt2", 0x7cc6ff, true], ["volt3", 0xdcf4ff, true],
  ["rune", 0xffc44a, true], ["lamp", 0xffe8b0, true], ["eye", 0xff3a22, true],
]) colour(name, hex, glow);
export const isGlow = (id) => GLOWS.has(id);

// --- grids ---------------------------------------------------------------------
// Two bytes a voxel: a shared palette easily passes 255 colours.
export function grid(sx, sy, sz) {
  return { data: new Uint16Array(sx * sy * sz), sx, sy, sz, palette: PALETTE, glow: GLOWS };
}
export const inside = (g, x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < g.sx && y < g.sy && z < g.sz;
// `set` ignores id 0 on purpose (a colour function may return 0 for "leave
// it"), so carving is `clear`. Calling set(..., 0) to cut a slit does nothing.
export function set(g, x, y, z, id) {
  if (id && inside(g, x, y, z)) g.data[x + g.sx * (z + g.sz * y)] = id;
}
export function clear(g, x, y, z) {
  if (inside(g, x, y, z)) g.data[x + g.sx * (z + g.sz * y)] = 0;
}
export const voxelAt = (g, x, y, z) => (inside(g, x, y, z) ? g.data[x + g.sx * (z + g.sz * y)] : 0);
// An id or a function (x, y, z) => id: shapes accept either, so any shape can be patterned.
export const colourOf = (id, x, y, z) => (typeof id === "function" ? id(x, y, z) : id);

// --- randomness that repeats ---------------------------------------------------
export const hash = (a, b = 0, c = 0) => {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// Smooth value noise, 0..1: for patches (moss, dry grass, a drift of flowers).
export function noise(x, z, scale, seed = 0) {
  const fx = x / scale, fz = z / scale, ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = fx - ix, tz = fz - iz, sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed), c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
// Pick from tones by a hash: the cheapest way to make a surface look made.
export const speckle = (tones, seed = 0) => (x, y, z) => tones[Math.floor(hash(x + seed, y, z) * tones.length)];

// --- shapes --------------------------------------------------------------------
export function block(g, x0, y0, z0, w, h, d, id) {
  for (let y = y0; y < y0 + h; y += 1) for (let z = z0; z < z0 + d; z += 1) for (let x = x0; x < x0 + w; x += 1) set(g, x, y, z, colourOf(id, x, y, z));
}
// Every voxel of layer y whose centre lies within r of (cx, cz), further out than r0.
export function disc(g, cx, cz, y, r, id, r0 = -1) {
  for (let z = 0; z < g.sz; z += 1) for (let x = 0; x < g.sx; x += 1) {
    const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
    if (d <= r && d > r0) set(g, x, y, z, colourOf(id, x, y, z));
  }
}
// A round column; `radius` may be a function of y (a taper, a swell, a batter).
export function column(g, cx, cz, y0, y1, radius, id) {
  for (let y = y0; y <= y1; y += 1) disc(g, cx, cz, y, typeof radius === "function" ? radius(y) : radius, id);
}
export function ball(g, cx, cy, cz, r, id) {
  egg(g, cx, cy, cz, r, r, r, id);
}
// An ellipsoid: bodies, heads, bushes, clouds, bellies. Most organic shapes are eggs.
export function egg(g, cx, cy, cz, rx, ry, rz, id) {
  for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(g.sy - 1, Math.ceil(cy + ry)); y += 1) {
    for (let z = Math.max(0, Math.floor(cz - rz)); z <= Math.min(g.sz - 1, Math.ceil(cz + rz)); z += 1) {
      for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(g.sx - 1, Math.ceil(cx + rx)); x += 1) {
        const k = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + ((z + 0.5 - cz) / rz) ** 2;
        if (k <= 1) set(g, x, y, z, colourOf(id, x, y, z));
      }
    }
  }
}
// A tapering rope along a polyline of [x, y, z] points: limbs, tails, tentacles, branches, cables.
export function rope(g, points, r0, r1, id) {
  let total = 0;
  const lens = [];
  for (let k = 1; k < points.length; k += 1) { const l = Math.hypot(...points[k].map((v, i) => v - points[k - 1][i])); lens.push(l); total += l; }
  let walked = 0;
  for (let k = 1; k < points.length; k += 1) {
    const [a, b] = [points[k - 1], points[k]];
    const steps = Math.max(1, Math.ceil(lens[k - 1] * 2));
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const at = a.map((v, i) => v + (b[i] - v) * t);
      const r = r0 + (r1 - r0) * ((walked + lens[k - 1] * t) / (total || 1));
      ball(g, at[0], at[1], at[2], Math.max(0.5, r), id);
    }
    walked += lens[k - 1];
  }
}
// A square slab with its corners cut back by `bevel`.
export function slab(g, x0, z0, w, y, id, bevel = 1) {
  for (let z = z0; z < z0 + w; z += 1) for (let x = x0; x < x0 + w; x += 1) {
    const ex = Math.min(x - x0, x0 + w - 1 - x);
    const ez = Math.min(z - z0, z0 + w - 1 - z);
    if (ex + ez >= bevel) set(g, x, y, z, colourOf(id, x, y, z));
  }
}
// A cylinder lying along z, axis at (cx, cy).
export function tube(g, cx, cy, z0, z1, r, id) {
  for (let z = z0; z <= z1; z += 1) for (let y = 0; y < g.sy; y += 1) for (let x = 0; x < g.sx; x += 1) {
    if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) set(g, x, y, z, colourOf(id, x, y, z));
  }
}
// A disc standing up, facing along z: wheels, shields, clock faces, portholes.
export function disc2z(g, cx, cy, z, r, id) {
  for (let y = 0; y < g.sy; y += 1) for (let x = 0; x < g.sx; x += 1) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) set(g, x, y, z, colourOf(id, x, y, z));
}
// Coursed stone round a centre: courses over mortar lines, each stone its own shade.
export const masonry = (cx, cz, tones = [C.stone1, C.stone2, C.stone3], mortar = C.mortar, around = 9) => (x, y, z) => {
  if (y % 3 === 0) return mortar;
  const course = Math.floor(y / 3);
  const a = Math.atan2(z + 0.5 - cz, x + 0.5 - cx) / (Math.PI * 2) + 0.5;
  return tones[Math.floor(hash(course, Math.floor(a * around + (course % 2) * 0.5)) * tones.length)];
};
// Brick coursing on a flat wall (stretcher bond).
export const bricks = (tones, mortar, w = 4) => (x, y, z) => {
  if (y % 3 === 2) return mortar;
  const course = Math.floor(y / 3);
  const along = x + z + (course % 2) * (w / 2);
  if (along % w === 0) return mortar;
  return tones[Math.floor(hash(Math.floor(along / w), course) * tones.length)];
};
// The outermost voxel of a round layer at an angle: where a crack, a vein or a window goes.
export function surface(cx, cz, y, r, angle) {
  return [Math.floor(cx + Math.cos(angle) * (r - 0.35)), y, Math.floor(cz + Math.sin(angle) * (r - 0.35))];
}
// Copy one grid into another at an offset (non-zero voxels only): assemble a model from parts.
export function stamp(into, from, ox, oy, oz) {
  for (let y = 0; y < from.sy; y += 1) for (let z = 0; z < from.sz; z += 1) for (let x = 0; x < from.sx; x += 1) {
    const id = from.data[x + from.sx * (z + from.sz * y)];
    if (id) set(into, x + ox, y + oy, z + oz, id);
  }
}
// A flame of voxels `h` high on a base of radius r: dark at the rim, white at the heart.
export function flameGrid(r = 3.1, h = 9) {
  const w = Math.ceil(r * 2) + 1;
  const g = grid(w, h + 1, w);
  const c = w / 2;
  for (let y = 0; y <= h; y += 1) {
    const k = y / h;
    const rr = r * (1 - k) ** 0.8 + 0.35;
    disc(g, c, c, y, rr, (x, yy, z) => {
      const heat = (1 - Math.hypot(x + 0.5 - c, z + 0.5 - c) / rr) * 0.7 + k * 0.6;
      return heat > 0.95 ? C.hot : heat > 0.72 ? C.fire4 : heat > 0.5 ? C.fire3 : heat > 0.28 ? C.fire2 : C.fire1;
    });
  }
  return g;
}
// A glowing ball, white at the heart and coloured out to the rim: shots, orbs, suns.
export function glowBall(r, [heart, inner, mid, rim]) {
  const w = Math.ceil(r * 2) + 1;
  const g = grid(w, w, w);
  const c = w / 2;
  ball(g, c, c, c, r, (x, y, z) => {
    const d = Math.hypot(x + 0.5 - c, y + 0.5 - c, z + 0.5 - c) / r;
    return d < 0.45 ? heart : d < 0.7 ? inner : d < 0.88 ? mid : rim;
  });
  return g;
}
// A flat ring (a halo, a shockwave, a rim of foam).
export function flatRing(R, t, id) {
  const w = Math.ceil((R + t) * 2) + 1;
  const g = grid(w, 1, w);
  disc(g, w / 2, w / 2, 0, R + t / 2, id, R - t / 2);
  return g;
}
