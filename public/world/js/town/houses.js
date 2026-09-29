// The town's houses, street props and townsfolk: the `houses` layer (see DISTRICTS.md, "Layers").
//
// Every lot in the plan gets a house from a few designs (js/models/house_build.js): each design is meshed once
// near and once at half the fineness for the far view, mirrored for variety, and stamped with
// instanced meshes, each house with its own plaster, roof and trim tints and its own windows lit or dark. One
// material does it all in one draw call a design: the ground's per-voxel tone, glowing parts unlit, lamps that
// light at night, and windows that glow warm (a few flicking on and off as the evening goes). Each frame the
// stamps are culled to the view one by one, near ones drawn in full and far ones plain, and small props only
// near. Smoke puffs from the chimneys near the camera; boats bob in the harbour and on the canal; a guard, a
// baker, a fisher, a lamplighter and a few villagers go about their business. Clicking things makes small
// moments happen: doors open and a resident waves, the tavern cheers, the windmill spins up, and so on.
import { design, FLAG, TRADES, HP } from '../models/house_build.js';
import * as PR from '../models/house_props.js';
import * as FOLK from '../models/house_folk.js';
import { meshBox } from '../kit/voxel-mesher.js';
import { GLOWS, PALETTE, hash } from '../kit/voxel-kit.js';
import { STREETS, GATES, PLOTS, toSeg } from './plan.js';

// ---- the material: Lambert with vertex colours, plus the house tints, glow, lamps and windows -------------------------
// Per vertex `flag` (FLAG in house_build.js); per instance iWall, iRoof, iTrim (tints) and iLit (a mask of lit windows).
function houseMaterial(THREE) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  const U = m.userData.uniforms = { uNight: { value: 1 }, uWarm: { value: new THREE.Color(0xff9a3c) }, uWarm2: { value: new THREE.Color(0xffd27e) }, uCool: { value: new THREE.Color(0x8fe6ff) } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float flag;
attribute vec3 iWall;
attribute vec3 iRoof;
attribute vec3 iTrim;
attribute float iLit;
varying vec3 vTint;
varying float vKind;
varying float vWin;
varying float vLitW;
varying float vSeed;
varying vec3 vCell;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vKind = flag;
vTint = flag > 1.5 && flag < 2.5 ? iWall : flag > 2.5 && flag < 3.5 ? iRoof : flag > 3.5 && flag < 4.5 ? iTrim : vec3(1.0);
vWin = flag > 15.5 ? flag - 16.0 : -1.0;
vLitW = vWin >= 0.0 ? mod(floor(iLit / exp2(vWin) + 0.001), 2.0) : 0.0;
vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
vCell = floor(position - normal * 0.5) + floor(vSeed * 97.0);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uNight;
uniform vec3 uWarm;
uniform vec3 uWarm2;
uniform vec3 uCool;
varying vec3 vTint;
varying float vKind;
varying float vWin;
varying float vLitW;
varying float vSeed;
varying vec3 vCell;
float hcell(vec3 c) { return fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float hv = hcell(vCell);
float lit1 = vKind > 0.5 && vKind < 1.5 ? 1.0 : 0.0;
diffuseColor.rgb *= vTint * mix(1.0 + (hv - 0.5) * 0.14, 1.0, lit1);`)
      .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;', `vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
float gk = lit1 + (vKind > 4.5 && vKind < 5.5 ? uNight : 0.0);
vec3 gc = diffuseColor.rgb;
if (vWin >= 0.0) {
  float wh = fract(sin(vWin * 91.7 + vSeed * 311.3) * 43758.5453);
  gc = (wh < 0.1 ? uCool : mix(uWarm, uWarm2, wh)) * (0.78 + 0.4 * hv);
  gk = vLitW * uNight;
}
outgoingLight = mix(outgoingLight, gc, gk);`);
  };
  m.customProgramCacheKey = () => 'town-houses';
  return m;
}
// Smoke: see-through, its colour and fade per puff (iWall, iLit).
function smokeMaterial(THREE) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 iWall;\nattribute vec3 iRoof;\nattribute vec3 iTrim;\nattribute float iLit;\nattribute float flag;\nvarying vec3 vTint;\nvarying float vA;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTint = iWall; vA = iLit;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTint;\nvarying float vA;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vTint; diffuseColor.a *= vA;');
  };
  m.customProgramCacheKey = () => 'town-smoke';
  return m;
}

// ---- the far version of a grid: half the fineness, each 2 x 2 x 2 block the colour most of it shows (a window or a
// glow wins, then roofs, then walls and timber by count, the dark inside last), so a far house costs a quarter
const RANK = (id) => { const f = FLAG.get(id); return f >= 16 ? 5 : f === 1 || GLOWS.has(id) ? 4 : f === 3 ? 3 : id === DARK ? 1 : 2; };
const DARK = HP.void;
function halve(b) {
  const g = b.g, sx = Math.ceil(g.sx / 2), sy = Math.ceil(g.sy / 2), sz = Math.ceil(g.sz / 2), data = new Uint16Array(sx * sy * sz);
  const ids = new Uint16Array(8), n = new Uint8Array(8);
  for (let y = 0; y < sy; y += 1) for (let z = 0; z < sz; z += 1) for (let x = 0; x < sx; x += 1) {
    let k = 0, filled = 0;
    for (let dy = 0; dy < 2; dy += 1) for (let dz = 0; dz < 2; dz += 1) for (let dx = 0; dx < 2; dx += 1) {
      const X = x * 2 + dx, Y = y * 2 + dy, Z = z * 2 + dz;
      if (X >= g.sx || Y >= g.sy || Z >= g.sz) continue;
      const id = g.data[X + g.sx * (Z + g.sz * Y)];
      if (!id) continue;
      filled += 1;
      let j = 0;
      while (j < k && ids[j] !== id) j += 1;
      if (j === k) { ids[k] = id; n[k] = 0; k += 1; }
      n[j] += 1;
    }
    if (filled < 3) continue;
    let best = 0;
    for (let j = 1; j < k; j += 1) { const a = RANK(ids[j]), r = RANK(ids[best]); if (a > r || (a === r && n[j] > n[best])) best = j; }
    data[x + sx * (z + sz * y)] = ids[best];
  }
  return { g: { data, sx, sy, sz, palette: PALETTE, glow: GLOWS }, o: b.o, scale: 2 };
}

// Townsfolk in one draw call each: a rig's parts merged into one geometry, each vertex carried by its part's matrix
// (uParts, set each frame from the rig's own animated parts), glowing voxels unlit.
function folkMaterial(THREE, n) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.userData.parts = Array.from({ length: n }, () => new THREE.Matrix4());
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uParts = { value: m.userData.parts };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform mat4 uParts[${n}];\nattribute float part;\nattribute float flag;\nvarying float vGlow;`)
      .replace('#include <beginnormal_vertex>', 'mat4 partM = uParts[int(part + 0.5)];\nvec3 objectNormal = normalize(mat3(partM) * vec3(normal));')
      .replace('#include <begin_vertex>', 'vec3 transformed = (partM * vec4(position, 1.0)).xyz;\nvGlow = flag;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;', 'vec3 outgoingLight = mix(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance, diffuseColor.rgb, vGlow);');
  };
  m.customProgramCacheKey = () => `town-folk-${n}`;
  return m;
}
function flatten(THREE, r) {
  const parts = [], meshes = [];
  r.group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) meshes.push(o); });
  let nv = 0, ni = 0;
  for (const m of meshes) { nv += m.geometry.getAttribute('position').count; ni += m.geometry.getIndex().count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Uint8Array(nv * 3), flag = new Uint8Array(nv), part = new Uint8Array(nv), idx = new Uint32Array(ni);
  let v = 0, e = 0;
  for (const m of meshes) {
    let k = parts.findIndex((q) => q.parent === m.parent);
    if (k < 0) { k = parts.length; parts.push(m); }
    const g = m.geometry, n = g.getAttribute('position').count;
    pos.set(g.getAttribute('position').array, v * 3); nor.set(g.getAttribute('normal').array, v * 3); col.set(g.getAttribute('color').array, v * 3);
    flag.fill(m.material.isMeshBasicMaterial ? 1 : 0, v, v + n); part.fill(k, v, v + n);
    const gi = g.getIndex().array;
    for (let i = 0; i < gi.length; i += 1) idx[e + i] = gi[i] + v;
    v += n; e += gi.length;
    m.visible = false; // the rig still animates its parts; this one mesh draws them
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true)); geo.setAttribute('flag', new THREE.BufferAttribute(flag, 1)); geo.setAttribute('part', new THREE.BufferAttribute(part, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2.5, 0), 5);
  const mat = folkMaterial(THREE, Math.max(1, parts.length)), mesh = new THREE.Mesh(geo, mat);
  r.group.add(mesh);
  const inv = new THREE.Matrix4();
  return () => { r.group.updateMatrixWorld(true); inv.copy(r.group.matrixWorld).invert(); parts.forEach((p, i) => mat.userData.parts[i].multiplyMatrices(inv, p.matrixWorld)); };
}

// ---- a grid as one geometry: solid and glowing faces together, each vertex flagged (Proxy on the palette tells which
// colour each quad the mesher emits is), optionally mirrored across x
function meshOf(b) {
  const g = b.g, seq = [];
  const pal = new Proxy(g.palette, { get(t, k) { if (typeof k === 'string') { const c = k.charCodeAt(0); if (c >= 48 && c <= 57) seq.push(+k); } return t[k]; } });
  // mesh only the box the voxels fill (a grid is sized for the tallest house; a cottage uses half of it)
  let x0 = g.sx, y0 = g.sy, z0 = g.sz, x1 = -1, y1 = -1, z1 = -1;
  for (let y = 0, n = 0; y < g.sy; y += 1) for (let z = 0; z < g.sz; z += 1) for (let x = 0; x < g.sx; x += 1, n += 1) {
    if (!g.data[n]) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const m = meshBox({ data: g.data, sx: g.sx, sy: g.sy, sz: g.sz, palette: pal, glow: g.glow }, x0, y0, z0, x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1);
  for (const part of [m.opaque, m.glow]) for (let i = 0; i < part.positions.length; i += 3) { part.positions[i] += x0; part.positions[i + 1] += y0; part.positions[i + 2] += z0; }
  const ids = [[], []];
  for (const id of seq) ids[GLOWS.has(id) ? 1 : 0].push(id);
  return { parts: [[m.opaque, ids[0]], [m.glow, ids[1]]], o: b.o, scale: b.scale || 1 };
}
function geometryOf(THREE, b, mirror = false) {
  const { parts, o, scale } = b.parts ? b : meshOf(b);
  let nv = 0, ni = 0;
  for (const [p] of parts) { nv += p.positions.length / 3; ni += p.indices.length; }
  if (!nv) return null;
  const pos = new Int16Array(nv * 3), nor = new Int8Array(nv * 3), col = new Uint8Array(nv * 3), flag = new Uint8Array(nv), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const [ox, oy, oz] = o, sx = mirror ? -1 : 1, k2 = scale;
  let v = 0, e = 0;
  for (const [p, list] of parts) {
    const n = p.positions.length / 3;
    for (let q = 0; q < n; q += 1) {
      const a = (v + q) * 3, s = q * 3;
      pos[a] = sx * (p.positions[s] * k2 + ox); pos[a + 1] = p.positions[s + 1] * k2 + oy; pos[a + 2] = p.positions[s + 2] * k2 + oz;
      nor[a] = sx * p.normals[s] * 127; nor[a + 1] = p.normals[s + 1] * 127; nor[a + 2] = p.normals[s + 2] * 127;
      const id = list[q >> 2];
      flag[v + q] = FLAG.get(id) ?? (GLOWS.has(id) ? 1 : 0);
    }
    col.set(p.colours, v * 3);
    for (let q = 0; q < p.indices.length; q += 3) {
      idx[e + q] = p.indices[q] + v;
      idx[e + q + 1] = p.indices[q + (mirror ? 2 : 1)] + v;
      idx[e + q + 2] = p.indices[q + (mirror ? 1 : 2)] + v;
    }
    v += n; e += p.indices.length;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
  geo.setAttribute('flag', new THREE.BufferAttribute(flag, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

// Several such geometries as one.
function mergeGeos(THREE, list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.getAttribute('position').count; ni += g.getIndex().count; }
  const out = {}, names = [['position', Int16Array, 3, false], ['normal', Int8Array, 3, true], ['color', Uint8Array, 3, true], ['flag', Uint8Array, 1, false]];
  for (const [n, T, k] of names) out[n] = new T(nv * k);
  const idx = new Uint32Array(ni);
  let v = 0, e = 0;
  for (const g of list) {
    for (const [n, , k] of names) out[n].set(g.getAttribute(n).array, v * k);
    const gi = g.getIndex().array;
    for (let i = 0; i < gi.length; i += 1) idx[e + i] = gi[i] + v;
    v += g.getAttribute('position').count; e += gi.length;
  }
  const geo = new THREE.BufferGeometry();
  for (const [n, , k, norm] of names) geo.setAttribute(n, new THREE.BufferAttribute(out[n], k, norm));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

// ---- tints (each house its own): plaster, roofs, paint on shutters and doors
const WALLS = [0xfff4e2, 0xffffff, 0xffe2b0, 0xffd4c0, 0xe6f2d8, 0xdce8ff, 0xf0e2ff, 0xfff0c2, 0xffd8d2, 0xf2e8d8];
const ROOF_LOW = [0xd26a40, 0xbc5634, 0xe07c46, 0xa44c32, 0xb8603e, 0x94503c, 0xc87252, 0xd88a50];
const ROOF_UP = [0x5e6e8c, 0x505e7a, 0x6c7c9a, 0x44526c, 0x5e7e8e, 0x6a6a86];
const ROOF_SEA = [0x3e3a38, 0x6e3e2e, 0x34424e, 0x4e4640];
const BOARDS = [0xc4503e, 0x4a6ea8, 0x4f8a5a, 0xe0ac52, 0x5a5a5e, 0xf0ead8]; // harbour sheds: red, blue, green, ochre, tar, white
const TRIMS = [0x3f8a50, 0x3a6aa8, 0xb03c32, 0x2a8a8a, 0xd09a3a, 0x7a3a70, 0x5a6a7a, 0x1f4a6a, 0x9a5a2a];

export default {
  build(env) {
    const { THREE, V, R } = env;
    const lots = R.lots;
    const group = new THREE.Group();
    group.name = 'houses';
    const mat = houseMaterial(THREE), smokeMat = smokeMaterial(THREE);
    const col = (hex) => new THREE.Color(hex);
    const WHITE = col(0xffffff);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    const targets = [];
    let clock = 0;

    // ---- kinds (one geometry, near and far) and the items stamped from them ----------------------------------------------
    const kinds = [];
    function kind(key, near, far = null, o = {}) {
      const g0 = near || far, k = { key, geo: [near, far], items: [], small: Boolean(o.small), dynamic: Boolean(o.dynamic), mat: o.mat || mat, meshes: [], shown: [[], []], r: g0.boundingSphere.radius, c: g0.boundingSphere.center.clone(), later: o.later || null };
      kinds.push(k);
      return k;
    }
    function item(k, matrix, o = {}) {
      const it = { k, m: matrix.clone(), wall: o.wall || WHITE, roof: o.roof || WHITE, trim: o.trim || WHITE, lit: o.lit ?? 0, c: new THREE.Vector3(), r: 0, hidden: false, anim: o.anim || null, data: o.data || null };
      it.c.copy(k.c).applyMatrix4(it.m);
      it.r = k.r * it.m.getMaxScaleOnAxis();
      k.items.push(it);
      return it;
    }
    const place = (x, y, z, ry = 0, s = V) => M.compose(P3.set(x, y, z), Q.setFromAxisAngle(Y, ry), S3.set(s, s, s)).clone();

    // ---- which design stands on each lot: the shops by the squares, the harbourmaster at the stair's foot, a few yards
    const hub = PLOTS.hub.c, market = PLOTS.more.c;
    const byDist = (p) => (a, b) => Math.hypot(a.c[0] - p[0], a.c[1] - p[1]) - Math.hypot(b.c[0] - p[0], b.c[1] - p[1]);
    // The shops: on lower-town street fronts near the two squares, fronts turned to the camera where it can be, a few
    // houses apart; the tavern on a wide two-storey lot (it sits back under its jetty).
    const LOOK = 0.45; // the town's camera yaw
    const shopOk = (l) => l.kind === 'house' && l.zone === 'lower' && l.row === 1 && l.size[0] >= 24 && l.size[1] >= 22 && l.street !== 'more'; // (the Market's stalls would hide a shop that faces them)
    const shops = new Map();
    const tradeOrder = ['tavern', 'bakery', 'smithy', 'apothecary', 'tailor', 'bookbinder', 'lampmaker'];
    const score = (l, near) => Math.hypot(l.c[0] - near[0], l.c[1] - near[1]) + (Math.cos(l.face - LOOK) > 0.15 ? 0 : 30);
    for (const [i, t] of tradeOrder.entries()) {
      const near = i % 2 ? market : hub;
      const cand = lots.filter((l) => shopOk(l) && !shops.has(l) && (t !== 'tavern' || (l.size[0] >= 28 && l.storeys > 1)) && [...shops.keys()].every((o) => Math.hypot(o.c[0] - l.c[0], o.c[1] - l.c[1]) > 6)).sort((a, b) => score(a, near) - score(b, near))[0];
      if (cand) shops.set(cand, t);
    }
    const piers = lots.filter((l) => l.kind === 'pier');
    const master = piers.slice().sort((a, b) => b.c[0] - a.c[0])[0];
    const yards = new Set(lots.filter((l) => l.kind === 'house' && l.size[0] === 22 && l.size[1] === 20).sort(byDist(market)).slice(0, 2));
    const specOf = (l) => {
      if (l.kind === 'pier') return l === master ? { kind: 'master', zone: 'harbour', size: l.size, storeys: 2, seed: 7 } : { kind: 'pier', zone: 'harbour', size: l.size, storeys: l.storeys, seed: 3 };
      if (l.kind !== 'house') return { kind: l.kind, size: l.size, storeys: l.storeys, drop: l.drop, water: l.water, seed: 5 };
      const t = shops.get(l);
      return { kind: 'house', zone: l.zone === 'upper' ? 'upper' : 'lower', size: l.size, storeys: l.storeys, trade: t, seed: t ? 11 + tradeOrder.indexOf(t) : l.zone === 'upper' ? 2 : 1 };
    };
    const keyOf = (s) => (s.trade ? `shop:${s.trade}` : s.kind === 'house' ? `${s.zone}:${s.size.join('x')}:${s.storeys}` : s.kind === 'pier' ? `pier:${s.size.join('x')}` : s.kind === 'master' ? 'master' : `${s.kind}:${s.size.join('x')}:${s.drop}:${s.water ?? 0}`);

    // ---- designs, meshed once each (with a mirrored twin where there are several of it)
    const uses = new Map();
    const houseLots = lots.filter((l) => !yards.has(l));
    for (const l of houseLots) { const s = specOf(l), k = keyOf(s); if (!uses.has(k)) uses.set(k, { spec: s, lots: [] }); uses.get(k).lots.push(l); }
    // Each design is meshed at half the fineness now (all the overview needs) and in full later: the first time one of
    // its houses comes near the camera, or a little at a time once the town is up (`later`); a mirrored twin shares its faces.
    const designs = new Map();
    for (const [key, u] of uses) {
      const near = design(u.spec), many = u.lots.length > 1, mf = meshOf(halve(near.b));
      const d = { key, spec: u.spec, info: near.info, kinds: [] };
      const full = { grid: near.b, mn: null }, later = (mirror) => () => geometryOf(THREE, full.mn ||= meshOf(full.grid), mirror);
      for (const mirror of many ? [false, true] : [false]) d.kinds.push(kind(`${key}${mirror ? ':m' : ''}`, null, geometryOf(THREE, mf, mirror), { later: later(mirror) }));
      designs.set(key, d);
    }

    // ---- the houses on their lots
    const houses = [];
    const pickC = (list, h) => col(list[Math.floor(h * list.length) % list.length]);
    houseLots.forEach((l) => {
      const li = lots.indexOf(l), s = specOf(l), d = designs.get(keyOf(s)), mirror = d.kinds.length > 1 && hash(li, 17, 3) < 0.5;
      const k = d.kinds[mirror ? 1 : 0], m = place(l.c[0], l.y * V, l.c[1], l.face);
      const h = (n) => hash(li, n, 29);
      const roof = s.kind === 'pier' || s.kind === 'master' ? ROOF_SEA : s.zone === 'upper' ? ROOF_UP : s.kind === 'windmill' ? [0x8a5a3a] : ROOF_LOW;
      let lit = 0;
      const nw = Math.min(16, d.info.windows || 0);
      for (let w = 0; w < nw; w += 1) if (hash(li, w, 31) < (s.trade ? 0.85 : 0.6)) lit |= 1 << w;
      const sea = s.kind === 'pier' || s.kind === 'master';
      const it = item(k, m, { wall: sea ? col(BOARDS[(piers.indexOf(l) * 2 + 1) % BOARDS.length]) : pickC(WALLS, h(1)), roof: pickC(roof, h(2)), trim: pickC(sea ? [0xf0ead8, 0x2a3a4a] : TRIMS, h(3)), lit, data: { lot: l, li, info: d.info, mirror, spec: s } });
      houses.push(it);
    });
    // model voxels of a house to world
    const toWorld = (it, [x, y, z], out = new THREE.Vector3()) => out.set(it.data.mirror ? -x : x, y, z).applyMatrix4(it.m);
    // at night a soft warm bloom before each lit house, so the town glows from afar (one cloud of points)
    const bloom = (() => {
      const lit = houses.filter((it) => it.data.info.front !== undefined && it.data.spec.kind !== 'windmill');
      const pos = new Float32Array(lit.length * 3);
      lit.forEach((it, i) => { const p = toWorld(it, [0, 14, (it.data.info.front ?? 0) + 8]); pos.set([p.x, p.y, p.z], i * 3); });
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d'), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), color: 0xffa650, size: 2.6, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }));
      pts.name = 'house-bloom';
      group.add(pts);
      return pts;
    })();

    // ---- props, stamped the same way: their own kinds, small ones only near ----------------------------------------------
    const propKind = (key, b, o = {}) => kind(key, geometryOf(THREE, b), null, o);
    const K = {
      barrel: propKind('barrel', PR.barrel(), { small: true }), crate: propKind('crate', PR.crate(0), { small: true }), crate2: propKind('crate2', PR.crate(1), { small: true }),
      bench: propKind('bench', PR.bench(), { small: true }), well: propKind('well', PR.well()), bucket: propKind('bucket', PR.bucket(), { small: true, dynamic: true }),
      cart: propKind('cart', PR.handcart(), { small: true }), planter: propKind('planter', PR.planter(1), { small: true }), board: propKind('board', PR.noticeBoard(), { small: true }),
      bollard: propKind('bollard', PR.bollard(), { small: true }), coil: propKind('coil', PR.ropeCoil(), { small: true }), crane: propKind('crane', PR.crane()), hook: propKind('hook', PR.hook(), { dynamic: true }),
      boats: [0, 1, 2, 3].map((i) => propKind(`boat${i}`, PR.rowingBoat(i), { dynamic: true })), fishing: propKind('fishing', PR.fishingBoat(), { dynamic: true }),
      puff: propKind('puff', PR.puff(), { dynamic: true, mat: smokeMat }),
      doors: Object.fromEntries(['lower', 'upper', 'pier'].flatMap((s) => { const m = meshOf(PR.doorLeaf(s)); return [[s, kind(`door:${s}`, geometryOf(THREE, m), null, { small: true, dynamic: true })], [`${s}:m`, kind(`door:${s}:m`, geometryOf(THREE, m, true), null, { small: true, dynamic: true })]]; })),
      signs: Object.fromEntries(Object.keys(TRADES).map((t) => [t, propKind(`sign:${t}`, PR.sign(t), { small: true, dynamic: true })])),
      sails: propKind('sails', PR.sails(), { dynamic: true }), wheel: propKind('wheel', PR.waterWheel(), { dynamic: true }),
      hoist: propKind('hoist', PR.hoistCrate(), { dynamic: true }), rope: propKind('rope', PR.ropeBit(), { dynamic: true }), dish: propKind('dish', PR.dish(), { dynamic: true }),
      table: propKind('table', PR.tavernTable(), { small: true }),
    };
    // a prop at a house's model voxel [x, y, z], turned by the house and `ry` more
    const atHouse = (it, [x, y, z], ry = 0) => { const p = toWorld(it, [x, y, z]); const face = it.data.lot.face; return place(p.x, p.y, p.z, face + (it.data.mirror ? -ry : ry)); };
    const front = (it) => it.data.info.door; // { at, w, h, face, out, hinge }

    // doors: every house's leaf in its doorway (open ones swing out)
    const doors = [];
    for (const it of houses) {
      const dd = front(it);
      if (!dd || dd.barn || dd.face !== 'front') continue;
      const style = it.data.spec.kind === 'pier' || it.data.spec.kind === 'master' ? 'pier' : it.data.spec.zone === 'upper' ? 'upper' : 'lower';
      const hx = it.data.mirror ? -dd.hinge[0] : dd.hinge[0], y0 = dd.at[1], hz = dd.hinge[1];
      const base = it.m.clone().multiply(new THREE.Matrix4().makeTranslation(hx, y0, hz));
      const d = { it, base, t0: -99, style };
      d.item = item(K.doors[it.data.mirror ? `${style}:m` : style], base, { trim: it.trim, anim: () => {
        const u = clock - d.t0, a = u < 0 || u > 3.6 ? 0 : Math.min(1, u / 0.35, (3.6 - u) / 0.45) * 1.7;
        d.item.m.copy(d.base).multiply(M.makeRotationY(it.data.mirror ? a : -a));
      } });
      doors.push(d);
    }

    // shops: the hanging sign swinging on its bracket, a lantern's light, the trade's props
    const shopItems = houses.filter((it) => it.data.spec.trade);
    for (const it of shopItems) {
      const t = it.data.spec.trade, s = it.data.info.sign;
      if (s) {
        const ph = hash(it.data.li, 5) * 6;
        const base = atHouse(it, s, Math.PI / 2);
        const sg = item(K.signs[t], base, { anim: () => { sg.m.copy(base).multiply(M.makeRotationX(0.1 * Math.sin(clock * 1.3 + ph) + 0.04 * Math.sin(clock * 3.1 + ph))); } });
      }
      const tr = it.data.info.terrace, ln = it.data.info.lantern;
      const p = tr ? toWorld(it, [0, 17, tr.z0 + 4]) : ln ? toWorld(it, [ln[0], 14, ln[1]]) : toWorld(it, [front(it).at[0], 14, front(it).at[2] + 5]);
      env.light([p.x, p.y, p.z], t === 'smithy' || t === 'bakery' ? 0xff8a3a : 0xffc070, tr ? 6 : 2.5, tr ? 7 : 6);
      const glow = new THREE.Object3D(); glow.position.copy(p); group.add(glow);
      env.halo(glow, [0, 0, 0], 1.6, 0xffc070, 0.9); // the lantern's bloom at night
    }
    const tavern = shopItems.find((it) => it.data.spec.trade === 'tavern');
    const bakery = shopItems.find((it) => it.data.spec.trade === 'bakery');

    // props at the house fronts: barrels and crates by some doors, planters, a bench; the tavern's table under its jetty
    for (const it of houses) {
      const dd = front(it), sp = it.data.spec;
      if (!dd || sp.kind !== 'house') continue;
      const li = it.data.li, zf = (it.data.info.front ?? dd.at[2]) + 2, side = dd.at[0] > 0 ? -1 : 1;
      const r = hash(li, 71);
      if (sp.trade === 'tavern' && it.data.info.terrace) {
        const tr = it.data.info.terrace;
        item(K.table, atHouse(it, [side * 7, 0, tr.z0 + 4]));
        item(K.barrel, atHouse(it, [-side * 9, 0, tr.z1 - 1]));
        item(K.barrel, atHouse(it, [-side * 12, 0, tr.z1 - 1], 0.6));
      } else if (sp.trade) {
        item(r < 0.5 ? K.crate2 : K.barrel, atHouse(it, [dd.at[0] + side * 7, 0, zf], r * 3));
        item(K.planter, atHouse(it, [dd.at[0] - side * 7, 0, zf]));
      } else if (r < 0.35) item(K.barrel, atHouse(it, [dd.at[0] + side * 7, 0, zf], r * 5));
      else if (r < 0.5) item(K.planter, atHouse(it, [dd.at[0] + side * 8, 0, zf]));
      else if (r < 0.58) item(K.bench, atHouse(it, [dd.at[0] + side * 11, 0, zf + 1]));
    }
    // the yards: a well on the green, a bench, a notice board, a cart, planters
    const wells = [];
    [...yards].forEach((l, i) => {
      const m = place(l.c[0], l.y * V, l.c[1], l.face), yit = { m, data: { mirror: false, lot: l } };
      const w = item(K.well, m.clone());
      const bk = item(K.bucket, atHouse(yit, [-1, 6, 0]), { anim: () => {} });
      wells.push({ w, bk, base: atHouse(yit, [-1, 6, 0]), t0: -99, top: new THREE.Vector3().setFromMatrixPosition(m) });
      item(K.bench, atHouse(yit, [0, 0, 9]));
      item(i ? K.cart : K.board, atHouse(yit, [i ? -9 : 9, 0, i ? 2 : -3], i ? 0.5 : -1.2));
      item(K.planter, atHouse(yit, [-8, 0, -7], 0.3)); item(K.planter, atHouse(yit, [8, 0, 7], -0.2));
    });

    // the harbour: bollards and rope on the piers' decks, a crane on the warehouse's, a hoist, boats on the water
    const hoists = [];
    let crane = null;
    for (const it of houses.filter((h) => h.data.spec.kind === 'pier' || h.data.spec.kind === 'master')) {
      const [W, D] = it.data.spec.size;
      for (const x of [-W / 2 + 1, W / 2 - 2]) item(K.bollard, atHouse(it, [x, 1, D / 2 - 2]));
      item(K.coil, atHouse(it, [W / 2 - 5, 1, D / 2 - 2]));
      item(K.crate, atHouse(it, [-W / 2 + 4, 1, D / 2 - 2], 0.4));
      if (it.data.info.hoist) { // a crate on the hoist's rope, halfway up; a click winds it up to the top door and down again
        const [hx, hz, hy] = it.data.info.hoist, base = atHouse(it, [hx, hy, hz]);
        const h = { base, t0: -99, it };
        const len = () => { const u = clock - h.t0; return 20 - 14 * (u < 0 || u > 6 ? 0 : Math.min(1, u / 2, (6 - u) / 2)); };
        h.item = item(K.hoist, base, { anim: () => { h.item.m.copy(h.base).multiply(M.makeTranslation(0, -len(), 0)).multiply(M.makeRotationY(0.12 * Math.sin(clock * 1.7))); } });
        h.rope = item(K.rope, base, { anim: () => { const L = len(); h.rope.m.copy(h.base).multiply(M.makeTranslation(-0.5, -L, -0.5)).multiply(M.makeScale(1, L, 1)); } });
        hoists.push(h);
      }
      if (it.data.spec.size[0] === 30 && !crane) {
        const base = atHouse(it, [W / 2 - 4, 1, -D / 2 + 4], -Math.PI / 2);
        crane = { base, t0: -99, it };
        crane.item = item(K.crane, base, { anim: () => { const u = clock - crane.t0, a = u < 0 || u > 6 ? 0 : Math.sin((u / 6) * Math.PI) * 1.4; crane.item.m.copy(crane.base).multiply(M.makeRotationY(a)); } });
        crane.hook = item(K.hook, base, { anim: () => { crane.hook.m.copy(crane.item.m).multiply(M.makeTranslation(-0.5, 33, 24)).multiply(M.makeRotationZ(0.05 * Math.sin(clock * 1.4))); } });
      }
    }
    // boats: rowing boats between and before the piers, a fishing boat off the harbourmaster's, more along the canal
    const boats = [];
    const boat = (k, x, y, z, ry, ph) => { const b = { k, x, y, z, ry, ph, t0: -99 }; b.item = item(k, place(x, y, z, ry), { anim: () => {
      const u = clock - b.t0, kick = u > 0 && u < 3 ? Math.exp(-u * 1.2) * Math.sin(u * 7) : 0;
      b.item.m.compose(P3.set(b.x, b.y + 0.035 * Math.sin(clock * 1.3 + ph) - 0.02, b.z), Q.setFromEuler(E.set(0.03 * Math.sin(clock * 0.9 + ph), b.ry + 0.05 * Math.sin(clock * 0.4 + ph), 0.05 * Math.sin(clock * 1.1 + ph * 2) + 0.25 * kick)), S3.set(V, V, V));
    } }); boats.push(b); return b; };
    // a spot on open water for a hull `len` long turned ry: nudged out from the shore until all of it floats
    const SEA = env.plan.KIND.SEA, RIV = env.plan.KIND.RIVER;
    const underPier = (x, z) => piers.some((l) => { const dx = x - l.c[0], dz = z - l.c[1], c = Math.cos(l.face), s = Math.sin(l.face); return Math.abs(dx * c - dz * s) < l.w / 2 + 0.3 && Math.abs(dx * s + dz * c) < l.d / 2 + 0.3; });
    const afloat = (x, z, ry, len, wid, water = SEA) => { for (let a = -len / 2; a <= len / 2; a += 0.3) for (let b = -wid / 2; b <= wid / 2; b += 0.3) { const px = x + Math.sin(ry) * a + Math.cos(ry) * b, pz = z + Math.cos(ry) * a - Math.sin(ry) * b; if (env.plan.kindAt(px, pz) !== water || underPier(px, pz)) return false; } return true; };
    const moor = (x, z, ry, len, wid, dz = 0.4) => { for (let k = 0; k < 30; k += 1, z += dz) if (afloat(x, z, ry, len, wid)) return [x, z]; return null; };
    const pierXs = piers.map((l) => l.c[0]).sort((a, b) => a - b);
    const harbour = [[pierXs[1] - 2.3, 1.25], [pierXs[2] + 0.4, -0.35], [pierXs[0] - 3, 1.5]];
    harbour.forEach(([x, ry], i) => { const at = Number.isFinite(x) && moor(x, 28.5, ry, 3.8, 1.8); if (at) boat(K.boats[i % 4], at[0], 0, at[1], ry, i * 1.7); });
    if (master) { const at = moor(master.c[0] - 0.5, master.c[1] + master.d / 2 + 1.8, Math.PI / 2 + 0.12, 7.6, 2.8); if (at) boat(K.fishing, at[0], 0, at[1], Math.PI / 2 + 0.12, 0.4); }
    for (const [i, x] of [-52, -40, -29].entries()) { // along the canal by the Workshop Quarter, against its south wall
      const z = 18.6 + 0.62, ry = Math.PI / 2 + (i % 2 ? 0.05 : -0.04);
      if (afloat(x, z, ry, 3.4, 1.4, RIV)) boat(K.boats[(i + 1) % 4], x, 42 * V, z, ry, 2 + i);
    }
    // the windmill's sails and the watermill's wheel
    const mills = [];
    for (const it of houses) {
      if (it.data.spec.kind === 'windmill') {
        const base = atHouse(it, it.data.info.hub);
        const w = { it, base, speed: 0.35, boost: 0 };
        w.item = item(K.sails, base, { anim: (dt) => { w.a = (w.a || 0) + (w.speed + w.boost) * dt; w.boost = Math.max(0, w.boost - dt * 0.8); w.item.m.copy(w.base).multiply(M.makeRotationZ(w.a)); } });
        mills.push(w);
      }
      if (it.data.spec.kind === 'watermill') {
        const [x, y, z] = it.data.info.wheel, base = atHouse(it, [x, y, z], Math.PI / 2);
        const w = { it, base, speed: 0.6, boost: 0 };
        w.item = item(K.wheel, base, { anim: (dt) => { w.a = (w.a || 0) - (w.speed + w.boost) * dt; w.boost = Math.max(0, w.boost - dt * 0.6); w.item.m.copy(w.base).multiply(M.makeRotationZ(w.a)); } });
        mills.push(w);
      }
    }
    // the brass dish on one upper-town roof: the tallest by the Academy
    const dishHouse = houses.filter((it) => it.data.spec.zone === 'upper' && it.data.spec.kind === 'house' && it.data.info.ridge).map((it) => it.data.lot).sort((a, b) => b.storeys - a.storeys || byDist(PLOTS.education.c)(a, b)).map((l) => houses.find((it) => it.data.lot === l))[0];
    let dish = null;
    if (dishHouse) { const base = atHouse(dishHouse, dishHouse.data.info.ridge); dish = { base, t0: -99, it: dishHouse }; dish.item = item(K.dish, base, { anim: () => { const u = clock - dish.t0, spin = u > 0 && u < 3 ? (1 - u / 3) * 9 : 0; dish.a = (dish.a || 0) + (0.3 + spin) / 60; dish.item.m.copy(dish.base).multiply(M.makeRotationY(dish.a)); } }); }

    // ---- cables and washing: sagging lines between houses, meshed together in voxels (one draw call for all) ------------
    // A cable between two roofs across a street, glowing beads along it; washing across a yard between two rows.
    const strands = [], strandAt = [];
    const strand = (A, B, sag, deco) => {
      strandAt.push({ deco, at: A.clone().lerp(B, 0.5).toArray().map((v) => +v.toFixed(2)) });
      const a = A.clone().divideScalar(V), b = B.clone().divideScalar(V), L = a.distanceTo(b), n = Math.ceil(L * 1.6);
      const lo = new THREE.Vector3(Math.min(a.x, b.x) - 6, Math.min(a.y, b.y) - sag - 12, Math.min(a.z, b.z) - 6).floor(), hi = new THREE.Vector3(Math.max(a.x, b.x) + 6, Math.max(a.y, b.y) + 4, Math.max(a.z, b.z) + 6).ceil();
      const bx = PR.boxOf([lo.x, lo.y, lo.z], [hi.x, hi.y, hi.z]);
      for (let i = 0; i <= n; i += 1) {
        const t = i / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t);
        bx.put(Math.floor(x), Math.floor(y), Math.floor(z), deco === 'cable' ? (i % 9 === 4 ? HP.via : i % 9 === 5 ? HP.trace : C_IRON) : HP.rope);
        if (deco === 'wash' && i % 7 === 3 && t > 0.1 && t < 0.9) PR.hang(bx, Math.floor(x), Math.floor(y) - 1, Math.floor(z), Math.floor(hash(i, Math.floor(a.x), 5) * 6), b.x - a.x, b.z - a.z);
      }
      strands.push(geometryOf(THREE, bx));
    };
    const C_IRON = HP.bdj;
    { // cables: houses facing each other across a street, their fronts' eaves joined
      const fronts = houses.filter((it) => it.data.spec.kind === 'house' && it.data.lot.row === 1 && it.data.info.eave);
      const used = new Set();
      for (const a of fronts) for (const b of fronts) {
        if (a === b || used.has(a) || used.has(b) || a.data.lot.street !== b.data.lot.street || strands.length >= 6) continue;
        if (Math.cos(a.data.lot.face - b.data.lot.face) > -0.8) continue; // facing each other
        const pa = toWorld(a, [0, a.data.info.eave - 2, a.data.info.upFront + 1]), pb = toWorld(b, [0, b.data.info.eave - 2, b.data.info.upFront + 1]);
        const d = Math.hypot(pa.x - pb.x, pa.z - pb.z);
        if (d < 3 || d > 7.5 || Math.abs(pa.y - pb.y) > 2) continue;
        strand(pa, pb, 5 + d, 'cable'); used.add(a); used.add(b);
      }
    }
    { // washing: from a row's back wall to the front of the house behind it
      let k = 0;
      for (const b of houses.filter((it) => it.data.lot.row >= 2 && it.data.spec.kind === 'house' && it.data.info.eave)) {
        if (k >= 10) break;
        const a = houses.find((it) => it !== b && it.data.lot.street === b.data.lot.street && it.data.lot.row === b.data.lot.row - 1 && Math.abs(Math.cos(it.data.lot.face - b.data.lot.face) - 1) < 0.01 && Math.hypot(it.data.lot.c[0] - b.data.lot.c[0], it.data.lot.c[1] - b.data.lot.c[1]) < (it.data.lot.d + b.data.lot.d) / 2 + 2.2);
        if (!a || !a.data.info.back) continue;
        const pa = toWorld(a, [-2, 17, a.data.info.back - 1]), pb = toWorld(b, [-2, 17, b.data.info.upFront + 1]);
        if (pa.distanceTo(pb) < 1 || pa.distanceTo(pb) > 3.5) continue;
        strand(pa, pb, 4, 'wash'); k += 1;
      }
    }
    if (strands.length) {
      const g = mergeGeos(THREE, strands.filter(Boolean));
      item(kind('strands', g, null), new THREE.Matrix4().makeScale(V, V, V));
    }

    // ---- chimney smoke: puffs rise, drift and fade from the chimneys near the camera; a click blows a ring ----------------
    const chimneys = [];
    for (const it of houses) for (const c of it.data.info.chimneys || []) {
      const p = toWorld(it, c), neon = hash(it.data.li, 91) < 0.12;
      chimneys.push({ p, it, ph: hash(it.data.li, c[0] + 50, 7) * 10, neon, big: -99 });
    }
    const PUFFS = 3, puffCol = [col(0xd8d4cc), col(0x9a98a8)], neonCol = col(0xc49aff);
    const puffItems = [];
    for (let i = 0; i < chimneys.length * PUFFS; i += 1) puffItems.push(item(K.puff, place(0, -99, 0), { lit: 0 }));
    const RING = 12, ringItems = Array.from({ length: RING }, () => item(K.puff, place(0, -99, 0), { lit: 0 })); // a smoke ring: puffs in a circle, spreading
    let ringAt = null, ringT = -99;

    const hitGeo = new THREE.BoxGeometry(1, 1, 1), hitMat = new THREE.MeshBasicMaterial({ visible: false }); // click boxes, never drawn
    // ---- townsfolk: rigs of their own, drawn only when near --------------------------------------------------------------
    const folk = [];
    const addFolk = (key, def, at, ry, o = {}) => {
      const r = env.kit.rig(`house:${key}`, def);
      r.group.position.set(at[0], at[1], at[2]);
      r.group.rotation.y = ry;
      group.add(r.group);
      const f = { r, key, route: o.route || null, u: 0, dir: 1, pause: 0, label: o.label, moving: false, at: new THREE.Vector3(...at), pose: flatten(THREE, r) };
      f.hit = new THREE.Mesh(hitGeo, hitMat); f.hit.scale.set(1.3, 3.4, 1.3); f.hit.position.y = 1.7; r.group.add(f.hit); // what a click finds
      folk.push(f);
      return f;
    };
    // the gate guard: on the Harbour Stair's landing just outside the sea gate, at its edge, looking down to the harbour
    const gate = GATES.find((g) => g.street === 'harbour-stair');
    let guard = null;
    if (gate) {
      const s = STREETS.find((q) => q.id === 'harbour-stair');
      let best = null;
      for (let g = 1; g < s.pts.length; g += 1) { const q = toSeg(gate.at[0], gate.at[1], s.pts[g - 1][0], s.pts[g - 1][1], s.pts[g][0], s.pts[g][1]); if (!best || q.d < best.d) best = { ...q, g }; }
      const [a, b] = [s.pts[best.g - 1], s.pts[best.g]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      const gx = best.x + ux * 1.3 + uz * (s.w / 2 - 0.35), gz = best.z + uz * 1.3 - ux * (s.w / 2 - 0.35);
      guard = addFolk('guard', FOLK.guard(), [gx, env.groundAt(gx, gz), gz], Math.atan2(ux, uz) + 0.9, { label: 'Gate guard' });
      guard.spot = [best.x + ux * 1.9 - uz * 0.3, best.z + uz * 1.9 + ux * 0.3]; // in front of him on the stair
    }
    // the baker at the bakery's door
    let baker = null;
    if (bakery) {
      const dd = front(bakery), sd = dd.at[0] > 0 ? -1 : 1, p = toWorld(bakery, [dd.at[0] + sd * 9, 0, (bakery.data.info.front ?? dd.at[2]) + 3]);
      baker = addFolk('baker', FOLK.baker(), [p.x, p.y, p.z], bakery.data.lot.face + sd * 0.5, { label: 'Baker' });
      if (bakery.data.info.oven) baker.oven = toWorld(bakery, bakery.data.info.oven);
    }
    // the fisher on a boathouse's deck over the water, legs over the edge
    let fisher = null;
    const fisherPier = houses.find((it) => it.data.spec.kind === 'pier' && it.data.spec.size[0] === 26);
    if (fisherPier) {
      const [W, D] = fisherPier.data.spec.size, p = toWorld(fisherPier, [W / 4, 1 - 5, -D / 2 + 1]);
      fisher = addFolk('fisher', FOLK.fisher(), [p.x, p.y, p.z], fisherPier.data.lot.face + Math.PI, { label: 'Fisher' });
      fisher.r.ctx.mem.water = Math.round(-p.y / V);
    }
    // the lamplighter's round, and the villagers' strolls: short stretches of street, walked at one side
    // a route: points a..b of a street, walked `off` to one side of its middle (a polyline, there and back)
    const stretch = (id, a, b, off) => {
      const s = STREETS.find((q) => q.id === id);
      if (!s) return null;
      const pts = s.pts.slice(a, b + 1).map((p, i, arr) => { const A = arr[Math.max(0, i - 1)], B = arr[Math.min(arr.length - 1, i + 1)], L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1; return [p[0] - ((B[1] - A[1]) / L) * off, p[1] + ((B[0] - A[0]) / L) * off]; });
      const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
      return { pts, lens, len: lens.reduce((x, y) => x + y, 0) };
    };
    const lamplighter = addFolk('lamplighter', FOLK.lamplighter(), [0, 0, 0], 0, { label: 'Lamplighter', route: stretch('harbour-row', 0, 1, 0.8) });
    lamplighter.dusk = true;
    const strollers = [
      addFolk('villager0', FOLK.villager(0), [0, 0, 0], 0, { label: 'Apple seller', route: stretch('guild-row', 0, 2, -0.85) }),
      addFolk('villager1', FOLK.villager(1), [0, 0, 0], 0, { label: 'Old man', route: stretch('upper-street', 2, 4, 0.85) }),
      addFolk('villager2', FOLK.villager(2), [0, 0, 0], 0, { label: 'Courier', route: stretch('bridge-street', 3, 5, -0.9) }),
    ];
    // the tavern's patrons at their table, and a resident who comes to the door when you knock
    const patrons = [];
    if (tavern && tavern.data.info.terrace) {
      const tr = tavern.data.info.terrace, dd = front(tavern), side = dd.at[0] > 0 ? -1 : 1;
      for (const [k, dx] of [[0, -4], [1, 3]]) { // side by side on the bench, facing the street
        const p = toWorld(tavern, [side * 7 + dx, -2, tr.z0 + 1]);
        patrons.push(addFolk(`patron${k}`, FOLK.patron(k), [p.x, p.y, p.z], tavern.data.lot.face + (k ? -0.25 : 0.25), { label: 'The Tavern' }));
      }
    }
    const residents = [0, 1].map((k) => { const f = addFolk(`resident${k}`, FOLK.resident(k), [0, -99, 0], 0); f.r.group.visible = false; f.r.group.rotation.order = 'YXZ'; f.idle = true; return f; }); // (YXZ: leans out along the way it faces)
    for (const f of folk) { f.r.update(0, false); f.pose(); }

    // ---- targets: houses (a knock at the door), chimneys, shops, folk, the harbour and the mills -------------------------
    const hitbox = (m, [x0, y0, z0], [x1, y1, z1]) => {
      const h = new THREE.Mesh(hitGeo, hitMat);
      h.matrixAutoUpdate = false; h.frustumCulled = false; // never drawn: skip the renderer's test too
      h.matrix.copy(m).multiply(new THREE.Matrix4().compose(P3.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), Q.identity(), S3.set(x1 - x0, y1 - y0, z1 - z0)));
      group.add(h);
      return h;
    };
    const say = { house: 'Timber house', cottage: 'Cottage', upper: 'Townhouse', pier: 'Boathouse', loft: 'Net loft', store: 'Warehouse', master: 'Harbourmaster', farm: 'Farmhouse', barn: 'Barn', windmill: 'Windmill', watermill: 'Watermill' };
    const labelOf = (it) => {
      const s = it.data.spec;
      if (s.trade) return TRADES[s.trade].label;
      if (s.kind === 'master') return say.master;
      if (s.kind === 'pier') return s.size[0] === 22 ? say.loft : s.size[0] === 30 ? say.store : say.pier;
      if (s.kind !== 'house') return say[s.kind];
      return s.zone === 'upper' ? say.upper : s.storeys === 1 ? say.cottage : say.house;
    };
    let doorBusy = null;
    const knock = (d) => {
      if (doorBusy && clock - doorBusy.t0 < 3.8) return;
      d.t0 = clock; doorBusy = d;
      const res = residents[hash(d.it.data.li, 3) < 0.5 ? 0 : 1], dd = front(d.it), inside = toWorld(d.it, [dd.at[0], dd.at[1], dd.at[2] - 3]);
      res.r.group.position.copy(inside);
      res.r.group.rotation.y = d.it.data.lot.face;
      res.show = { t0: clock + 0.3, from: inside.clone(), dir: new THREE.Vector3(Math.sin(d.it.data.lot.face), 0, Math.cos(d.it.data.lot.face)) };
    };
    for (const it of houses) {
      const s = it.data.spec, [W, D] = s.size, top = it.data.info.top ?? 60, dd = front(it);
      const box = hitbox(it.m, [-W / 2 + 1, s.drop ? -s.drop : 0, -D / 2 + 1], [W / 2 - 1, Math.min(top, 70), D / 2 - 1]);
      const door = dd && doors.find((q) => q.it === it);
      const doorW = dd ? toWorld(it, [dd.at[0], 0, dd.at[2]]) : null, out = [Math.sin(it.data.lot.face), Math.cos(it.data.lot.face)];
      const spot = doorW && s.kind !== 'windmill' && s.kind !== 'watermill' ? [doorW.x + out[0] * 1.1, doorW.z + out[1] * 1.1] : null; // the mills are out in the fields: they answer from afar
      const tr = s.trade;
      targets.push({
        object: box, label: labelOf(it), spot, focus: () => (doorW ? doorW.clone().setY(doorW.y + 1.6) : it.c),
        on(yuuv) {
          if (doorW) env.face([doorW.x, doorW.z]);
          if (tr === 'tavern') { for (const p of patrons) p.r.ctx.cheer(); env.after(0.5, () => yuuv.play('cheer')); if (door) knock(door); return; }
          if (tr === 'bakery' && baker) { bakeLoaf(); return; }
          if (s.kind === 'windmill') { for (const w of mills) if (w.it === it) w.boost = 3.2; yuuv.play('point'); return; }
          if (s.kind === 'watermill') { for (const w of mills) if (w.it === it) w.boost = 2.4; yuuv.play('point'); return; }
          const h = hoists.find((q) => q.it === it);
          if (h) { h.t0 = clock; yuuv.play('point'); return; }
          if (door) { knock(door); env.after(0.9, () => yuuv.play('wave')); }
          else yuuv.play('point');
        },
      });
      for (const c of chimneys.filter((q) => q.it === it)) {
        const hb = hitbox(new THREE.Matrix4().makeTranslation(c.p.x, c.p.y, c.p.z), [-0.45, -1.1, -0.45], [0.45, 0.4, 0.45]);
        targets.push({ object: hb, label: 'Chimney', focus: () => c.p.clone().setY(c.p.y + 1), on(yuuv) { c.big = clock; ringAt = c.p.clone(); ringT = clock; yuuv.play('point'); } });
      }
    }
    const bakeLoaf = () => { if (!baker) return; if (baker.oven) baker.r.ctx.mem.oven = baker.r.group.worldToLocal(baker.oven.clone()).divideScalar(V).toArray(); baker.r.ctx.catch(); env.after(1.6, () => env.yuuv.ctx?.play?.('cheer')); };
    const folkTarget = (f, on, spot) => f && targets.push({ object: f.hit, label: f.label, spot, on, focus: () => f.at.clone().setY(f.at.y + 2) });
    folkTarget(guard, (yuuv) => { guard.r.ctx.salute(); env.face([guard.at.x, guard.at.z]); env.after(0.4, () => yuuv.play('wave')); }, guard?.spot);
    const beside = (f, k = 1.3) => f && [f.at.x + Math.cos(f.r.group.rotation.y) * k + Math.sin(f.r.group.rotation.y) * 0.5, f.at.z - Math.sin(f.r.group.rotation.y) * k + Math.cos(f.r.group.rotation.y) * 0.5]; // at someone's elbow
    folkTarget(baker, (yuuv) => { env.face([baker.at.x, baker.at.z]); bakeLoaf(); yuuv.play('point'); }, beside(baker));
    folkTarget(fisher, (yuuv) => { fisher.r.ctx.bite(); env.after(1.2, () => yuuv.play('laugh')); });
    folkTarget(lamplighter, (yuuv) => { lamplighter.r.ctx.tip(); yuuv.play('wave'); });
    for (const f of strollers) folkTarget(f, (yuuv) => { f.r.ctx.hello(); f.pause = Math.max(f.pause, 2.2); yuuv.play('wave'); });
    for (const p of patrons) folkTarget(p, (yuuv) => { for (const q of patrons) q.r.ctx.cheer(); yuuv.play('cheer'); });
    for (const b of boats) targets.push({ object: hitbox(b.item.m, [-6, -3, -14], [6, b.k === K.fishing ? 40 : 5, 14]), label: b.k === K.fishing ? 'Fishing boat' : 'Rowing boat', on(yuuv) { b.t0 = clock; yuuv.play('point'); } });
    for (const w of wells) targets.push({ object: hitbox(w.w.m, [-6, 0, -6], [6, 23, 6]), label: 'Well', on(yuuv) { w.t0 = clock; yuuv.play('point'); } });
    if (crane) targets.push({ object: hitbox(crane.base, [-4, 0, -4], [4, 36, 26]), label: 'Harbour crane', on(yuuv) { crane.t0 = clock; yuuv.play('point'); } });
    if (dish) targets.push({ object: hitbox(dish.base, [-7, 0, -7], [7, 15, 7]), label: 'Brass dish', on(yuuv) { dish.t0 = clock; yuuv.play('point'); } });

    // ---- each frame: animate what moves, cull and pick near or far for every stamp, write what changed -------------------
    const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sph = new THREE.Sphere(), lastPV = new THREE.Matrix4();
    const instance = (k, lod) => {
      const g = k.geo[lod];
      {
        const n = k.items.length, geo = new THREE.BufferGeometry();
        for (const a of ['position', 'normal', 'color', 'flag']) geo.setAttribute(a, g.getAttribute(a));
        geo.setIndex(g.getIndex());
        geo.boundingSphere = g.boundingSphere;
        const at = (size) => new THREE.InstancedBufferAttribute(new Float32Array(n * size), size).setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('iWall', at(3)); geo.setAttribute('iRoof', at(3)); geo.setAttribute('iTrim', at(3)); geo.setAttribute('iLit', at(1));
        const im = new THREE.InstancedMesh(geo, k.mat, n);
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.frustumCulled = false;
        im.count = 0;
        im.name = `${k.key}${lod ? ':far' : ''}`;
        if (k.mat === smokeMat) im.renderOrder = 2;
        group.add(im);
        k.meshes[lod] = im;
      }
    };
    for (const k of kinds) k.geo.forEach((g, lod) => g && instance(k, lod));
    // the full meshes still to build: one a frame when a house wants it near, one now and then while idle
    const pending = kinds.filter((k) => k.later);
    let wanted = null, idleAt = 0;
    const finish = (k) => { k.geo[0] = k.later(); k.later = null; instance(k, 0); pending.splice(pending.indexOf(k), 1); k.dirty = true; };
    function write(k, lod, list) {
      const im = k.meshes[lod];
      if (!im) return;
      const old = k.shown[lod];
      if (!k.dynamic && !k.dirty && old.length === list.length && old.every((v, i) => v === list[i])) return;
      const g = im.geometry, w = g.getAttribute('iWall').array, r = g.getAttribute('iRoof').array, t = g.getAttribute('iTrim').array, l = g.getAttribute('iLit').array;
      list.forEach((it, i) => {
        im.setMatrixAt(i, it.m);
        w[i * 3] = it.wall.r; w[i * 3 + 1] = it.wall.g; w[i * 3 + 2] = it.wall.b;
        r[i * 3] = it.roof.r; r[i * 3 + 1] = it.roof.g; r[i * 3 + 2] = it.roof.b;
        t[i * 3] = it.trim.r; t[i * 3 + 1] = it.trim.g; t[i * 3 + 2] = it.trim.b;
        l[i] = it.lit;
      });
      im.count = list.length;
      im.instanceMatrix.needsUpdate = true;
      for (const a of ['iWall', 'iRoof', 'iTrim', 'iLit']) g.getAttribute(a).needsUpdate = true;
      k.shown[lod] = list;
    }
    const tgt = new THREE.Vector3();
    function sync(force) {
      const cam = env.cam(), camera = env.camera, fit = cam.fit;
      camera.updateMatrixWorld();
      pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const moved = force || !pv.equals(lastPV);
      lastPV.copy(pv);
      frustum.setFromProjectionMatrix(pv);
      // full detail and small things near the camera: whatever is nearer to it than what it looks at, and a margin beyond
      tgt.copy(camera.position);
      const toTarget = tgt.distanceTo(cam.target), nearR = fit < 28 ? toTarget + fit * 0.3 + 2 : -1, smallR = fit < 24 ? toTarget + fit * 0.8 + 4 : -1;
      for (const k of kinds) {
        if (!moved && !k.dynamic && !k.dirty) continue;
        const s0 = [], s1 = [];
        for (const it of k.items) {
          if (it.hidden) continue;
          const d = it.c.distanceTo(tgt);
          if (k.small && d > smallR) continue;
          sph.center.copy(it.c); sph.radius = it.r;
          if (!frustum.intersectsSphere(sph)) continue;
          if (k.geo[1] && d > nearR) s1.push(it);
          else if (k.later) { s1.push(it); wanted ||= k; } // near, but its full mesh isn't built yet: far until it is
          else s0.push(it);
        }
        write(k, 0, s0); write(k, 1, s1);
        k.dirty = false;
      }
    }

    // windows going on and off through the evening: now and then one house near the camera changes a window
    let flickAt = 0;
    const flick = () => {
      const cam = env.cam(), near = houses.filter((it) => it.data.info.windows > 0 && it.c.distanceTo(cam.target) < Math.max(20, cam.fit * 1.5));
      if (!near.length) return;
      const it = near[Math.floor(hash(Math.floor(clock * 7), 3, 1) * near.length)], w = Math.floor(hash(Math.floor(clock * 5), 9, 2) * Math.min(16, it.data.info.windows));
      it.lit ^= 1 << w;
      it.k.dirty = true;
    };

    const tmp = new THREE.Vector3();
    const cost = { ms: 0, n: 0 };
    function update(dt, t, night) {
      const t0 = performance.now();
      tick(dt, t, night);
      cost.ms += performance.now() - t0; cost.n += 1;
    }
    function tick(dt, t, night) {
      clock = t;
      mat.userData.uniforms.uNight.value = night;
      bloom.material.opacity = 0.45 * night;
      bloom.material.size = Math.min(7, Math.max(1.8, env.cam().fit * 0.1)); // a few pixels wide however far the camera is
      bloom.material.depthTest = env.cam().fit < 30; // from afar it shows over the eaves; near, walls hide it
      bloom.visible = night > 0.02;
      const cam = env.cam(), fit = cam.fit;
      // what moves: doors, signs, boats, mills, hoists, the crane, the dish, the well's bucket
      for (const k of kinds) if (k.dynamic) for (const it of k.items) if (it.anim) it.anim(dt);
      for (const w of wells) { const u = clock - w.t0, down = u < 0 || u > 4 ? 0 : Math.sin((u / 4) * Math.PI); w.bk.m.copy(w.base).multiply(M.makeTranslation(0, -down * 9, 0)); }
      // smoke: three puffs a chimney near the view, rising and fading; the ring after a click
      const far = fit > 40;
      let n = 0;
      for (const c of chimneys) {
        const d = c.p.distanceTo(cam.target);
        const show = d < (far ? 90 : fit * 2.2 + 18);
        for (let i = 0; i < PUFFS; i += 1) {
          const it = puffItems[n++];
          if (!show || (far && i)) { it.hidden = true; continue; } // from afar one puff a chimney is plenty
          const big = clock - c.big < 3 ? 1.6 : 1, life = 5.2, a = ((clock + c.ph + (i * life) / PUFFS) % life) / life;
          it.hidden = false;
          it.m.compose(P3.set(c.p.x + a * 1.1 + Math.sin(a * 5 + c.ph) * 0.15, c.p.y + a * 2.6 * big, c.p.z + a * 0.4), Q.setFromAxisAngle(Y, a * 2 + c.ph), S3.setScalar(V * (0.5 + a * 2) * big));
          it.c.set(it.m.elements[12], it.m.elements[13], it.m.elements[14]); it.r = 0.6;
          it.wall = c.neon ? neonCol : puffCol[night > 0.5 ? 1 : 0];
          it.lit = (0.3 + 0.25 * night) * Math.sin(Math.PI * a) ** 1.2 * (far ? 0.8 : 1); // a light haze by day, thicker against the night
        }
      }
      {
        const u = clock - ringT, on = ringAt && u < 3.4;
        ringItems.forEach((it, i) => {
          it.hidden = !on;
          if (!on) return;
          const a = (i / RING) * Math.PI * 2 + u * 0.6, r = 0.35 + u * 0.55, k = 1 - u / 3.4;
          it.m.compose(tmp.set(ringAt.x + Math.cos(a) * r, ringAt.y + 0.3 + u * 1.2, ringAt.z + Math.sin(a) * r), Q.setFromAxisAngle(Y, a), S3.setScalar(V * (0.45 + u * 0.25)));
          it.c.setFromMatrixPosition(it.m); it.r = 0.6;
          it.wall = puffCol[night > 0.5 ? 1 : 0]; it.lit = 0.8 * k * Math.min(1, u * 4);
        });
      }
      // townsfolk: only near the camera (and not at all from the overview); strollers walk their stretches
      const folkOn = fit < 30;
      for (const f of folk) {
        if (f.idle) { // a resident: out of sight until a door is knocked on
          const s = f.show;
          if (!s || clock < s.t0 || clock > s.t0 + 3.4) { f.r.group.visible = false; continue; }
          const u = clock - s.t0, out = Math.min(1, u / 0.4, (3.4 - u) / 0.4);
          f.r.group.visible = true;
          f.r.group.position.copy(s.from).addScaledVector(s.dir, out * 0.45);
          f.r.group.rotation.x = 0.18 * out;
          f.r.update(dt, false); f.pose();
          continue;
        }
        const near = folkOn && f.at.distanceTo(cam.target) < fit * 2.5 + 12;
        f.r.group.visible = near;
        let moving = false;
        if (f.route) {
          const on = !f.dusk || night > 0.3, R0 = f.route;
          if (f.pause > 0) f.pause -= dt;
          else if (on) {
            f.u += (f.dir * (f.dusk ? 0.75 : 0.9) * dt) / R0.len;
            if (f.u >= 1 || f.u <= 0) { f.u = Math.max(0, Math.min(1, f.u)); f.dir = -f.dir; f.pause = 1.5 + hash(Math.floor(clock), f.key.length) * 2; }
            moving = f.pause <= 0;
          }
          let s = f.u * R0.len, g = 0;
          while (g < R0.lens.length - 1 && s > R0.lens[g]) { s -= R0.lens[g]; g += 1; }
          const A = R0.pts[g], B = R0.pts[g + 1], k = Math.min(1, s / R0.lens[g]), x = A[0] + (B[0] - A[0]) * k, z = A[1] + (B[1] - A[1]) * k;
          f.at.set(x, env.groundAt(x, z), z);
          f.r.group.position.copy(f.at);
          const head = Math.atan2((B[0] - A[0]) * f.dir, (B[1] - A[1]) * f.dir);
          f.r.group.rotation.y += Math.atan2(Math.sin(head - f.r.group.rotation.y), Math.cos(head - f.r.group.rotation.y)) * Math.min(1, dt * 6);
        }
        if (near) { f.r.update(dt, moving); f.pose(); }
      }
      if (night > 0.2 && t - flickAt > 0.9) { flickAt = t; flick(); }
      if (wanted) { finish(wanted); wanted = null; } else if (pending.length && t - idleAt > 0.35 && t > 3) { idleAt = t; finish(pending[0]); }
      sync(false);
    }
    // a seam for headless checks: where things are (world units), and each target's label and centre
    if (typeof window !== 'undefined') window.__houses = {
      where: () => ({
        shops: shopItems.map((it) => ({ trade: it.data.spec.trade, at: it.c.toArray().map((v) => +v.toFixed(2)), door: (() => { const d = front(it); const p = toWorld(it, [d.at[0], 0, d.at[2]]); return p.toArray().map((v) => +v.toFixed(2)); })(), face: it.data.lot.face })),
        folk: folk.filter((f) => !f.idle).map((f) => ({ key: f.key, at: f.at.toArray().map((v) => +v.toFixed(2)) })),
        boats: boats.map((b) => [b.x, b.y, b.z].map((v) => +v.toFixed(2))),
        special: houses.filter((it) => it.data.spec.kind !== 'house').map((it) => ({ kind: it.data.spec.kind, size: it.data.spec.size, at: it.c.toArray().map((v) => +v.toFixed(2)) })),
        wells: wells.map((w) => w.top.toArray().map((v) => +v.toFixed(2))),
        crane: crane && new THREE.Vector3().setFromMatrixPosition(crane.base).toArray().map((v) => +v.toFixed(2)),
        dish: dish && new THREE.Vector3().setFromMatrixPosition(dish.base).toArray().map((v) => +v.toFixed(2)),
        cost: +(cost.ms / Math.max(1, cost.n)).toFixed(3),
        counts: { houses: houses.length, kinds: kinds.length, targets: targets.length, chimneys: chimneys.length, strands: strands.length },
        strands: strandAt,
      }),
      targets: () => targets.map((t) => { const b = new THREE.Box3().setFromObject(t.object); const c = b.getCenter(new THREE.Vector3()); return { label: t.label, at: c.toArray().map((v) => +v.toFixed(2)), focus: (t.focus?.() || c).toArray().map((v) => +v.toFixed(2)), spot: t.spot || null }; }),
      // a camera view onto a point that no house stands in front of: yaws round `yaw`, pitches up from `pitch`
      view(at, fit = 4, yaw = 0.45, pitch = 0.32) {
        const p = new THREE.Vector3(...at), unit = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
        const boxes = group.children.filter((o) => o.isMesh && o.material === hitMat && o.scale.x !== 0).concat(env.plan.LAMPS.map((l) => ({ matrix: new THREE.Matrix4().compose(new THREE.Vector3(l.at[0], (l.y + 13) * V, l.at[1]), Q.identity(), new THREE.Vector3(0.5, 27 * V, 0.5)) }))); // street lamps stand in the way too
        const ray = new THREE.Ray(), inv = new THREE.Matrix4(), hit = new THREE.Vector3(), d = fit * 3.7;
        const clear = (yw, pt) => {
          const dir = new THREE.Vector3(Math.sin(yw) * Math.cos(pt), Math.sin(pt), Math.cos(yw) * Math.cos(pt));
          for (const b of boxes) {
            inv.copy(b.matrix).invert();
            ray.set(p.clone().addScaledVector(dir, 0.6), dir).applyMatrix4(inv);
            if (unit.containsPoint(ray.origin)) continue; // the thing itself
            if (ray.intersectBox(unit, hit) && hit.applyMatrix4(b.matrix).distanceTo(p) < d) return false;
          }
          return true;
        };
        for (const pt of [pitch, pitch + 0.15, pitch + 0.3, pitch + 0.45]) for (const dy of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2, 1.6, -1.6, 2.2, -2.2, 3.1]) if (clear(yaw + dy, pt)) return { target: at, yaw: yaw + dy, pitch: pt, fit };
        return { target: at, yaw, pitch: 1.1, fit };
      },
    };
    return { group, update, targets };
  },
};
