// The town's nature: its plants and its animals, one layer over the whole island (see DISTRICTS.md, layers).
//
// Flora is built from js/models/nat_flora.js. Trees, hedges and ivy are instanced, one draw call a variant,
// and always drawn; the small growing things (flowers, crops, reeds, lilies, ferns, mushrooms, logs, rocks,
// dune grass) are merged into one mesh per 16-unit tile and drawn only near what the camera looks at. All of it
// shares one material: Lambert with the town's per-voxel tone, glow faces drawn unlit (some only after dark),
// and the wind in its vertex shader (a sway by height, a ripple running across the fields, and a gust that
// rings out from wherever something was clicked). Nothing is re-meshed after it is built.
//
// Fauna comes from js/models/nat_fauna.js: flocks and herds as rig-kit crowds (a few draw calls a kind),
// the cats, the dog, the rooster and the rubber duck as rigs of their own. Only what is near and on screen is
// posed; the rest waits. Fliers (gulls over the harbour, the songbirds' swoop, bats at night) show from afar.
//
// Everything reads the plan's raster at build time (lots included), so it keeps off streets, plots, lots,
// walls and water (the water plants aside) however the town is laid out.
//
// Clicks go through the layer's targets: invisible boxes (never drawn) that follow the animals and answer only
// while the camera is close and the thing is shown. window.__nature is a seam for headless checks (stats(),
// targets, the flocks' state, wake() for the old tree).
import { hash, noise, grid } from '../kit/voxel-kit.js';
import { meshBox } from '../kit/voxel-mesher.js';
import { ZONES, RIVER, WALLS, TOWERS, GATES, PLOTS, LEVEL, chaikin, toSeg, edgeOf } from './plan.js';
import * as F from '../models/nat_flora.js';
import * as A from '../models/nat_fauna.js';

const NEAR = 26; // fit under which the small things show
const PICK = 30; // fit under which plants and animals answer a click
const TILE = 16; // units a side of a merged tile of small plants
const TAU = Math.PI * 2;
const smooth = (u) => { const t = Math.max(0, Math.min(1, u)); return t * t * (3 - 2 * t); };
const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

export default { build };

function build(env) {
  const { THREE, kit, V, R } = env;
  const { KIND } = env.plan;
  const group = new THREE.Group();
  group.name = 'nature';
  const U = { uTime: { value: 0 }, uNight: { value: 1 }, uWind: { value: new THREE.Vector2(0.83, 0.56) }, uGust: { value: new THREE.Vector4(0, 0, -99, 0) } };
  const mat = floraMaterial(THREE, U);
  const stats = { trees: 0, plants: 0, tiles: 0 };

  // ---- the ground under everything ------------------------------------------------------------------
  const { nx, nz, i0, k0 } = R;
  const cell = (x, z) => { const i = Math.floor(x / V) - i0, k = Math.floor(z / V) - k0; return i < 0 || k < 0 || i >= nx || k >= nz ? -1 : k * nx + i; };
  const kindAt = (x, z) => { const n = cell(x, z); return n < 0 ? KIND.SEA : R.kind[n]; };
  const topAt = (x, z) => { const n = cell(x, z); return n < 0 ? 0 : R.top[n]; }; // voxels
  const shoreAt = (x, z) => { const n = cell(x, z); return n < 0 || !R.shore ? 0 : R.shore[n] * V; };
  const inTown = (x, z) => { const n = cell(x, z); return n >= 0 && R.town[n] === 1; };
  const lots = (R.lots || []).map((l) => ({ x: l.c[0], z: l.c[1], c: Math.cos(l.face), s: Math.sin(l.face), w: l.w / 2, d: l.d / 2 }));
  const onLot = (x, z, m = 0) => lots.some((l) => { const dx = x - l.x, dz = z - l.z; if (Math.abs(dx) > 8 || Math.abs(dz) > 8) return false; const a = dx * l.c - dz * l.s, b = dx * l.s + dz * l.c; return Math.abs(a) < l.w + m && Math.abs(b) < l.d + m; });
  const riverD = (x, z) => { let d = Infinity; for (let s = 1; s < RIVER.length; s += 1) d = Math.min(d, toSeg(x, z, RIVER[s - 1][0], RIVER[s - 1][1], RIVER[s][0], RIVER[s][1]).d); return d; };
  const HARD = new Set([KIND.STREET, KIND.STAIR, KIND.GATE, KIND.BRIDGE, KIND.QUAY, KIND.PLOT, KIND.LOT, KIND.WALL, KIND.TOWER]);
  const SOIL = new Set([KIND.LAND, KIND.MEADOW, KIND.GARDEN, KIND.TOWN, KIND.ORCHARD]);
  const GRASS = new Set([KIND.LAND, KIND.MEADOW, KIND.GARDEN, KIND.ORCHARD]);
  const keep = []; // [x, z, r]: kept clear of trees (pastures, the farmyard, the old tree)
  const kept = (x, z, r = 0) => keep.some(([a, b, q]) => Math.hypot(x - a, z - b) < q + r);
  const clearView = (x, z, r, far = 7) => { for (let d = r; d <= far; d += 1.5) keep.push([x + Math.sin(0.45) * d, z + Math.cos(0.45) * d, r * 0.8 + d * 0.15]); };
  // Can something of trunk radius rt and crown radius rc stand here (on `soil`, flat under its foot, nothing hard
  // or much higher under its crown, off every lot)?
  function room(x, z, rt, rc, soil = SOIL) {
    const n = cell(x, z);
    if (n < 0 || !soil.has(R.kind[n])) return false;
    const h = R.top[n];
    for (let a = 0; a < 8; a += 1) {
      const c = Math.cos((a * TAU) / 8), s = Math.sin((a * TAU) / 8);
      const m = cell(x + c * rt, z + s * rt);
      if (m < 0 || !soil.has(R.kind[m]) || Math.abs(R.top[m] - h) > 1) return false;
      for (const f of [0.55, 1]) { const q = cell(x + c * rc * f, z + s * rc * f); if (q < 0) continue; if (HARD.has(R.kind[q]) || R.top[q] > h + (f < 1 ? 6 : 14)) return false; }
    }
    return !onLot(x, z, rc * 0.7);
  }

  // A parapet near (ax, az): the edge of walkable ground (or a wall's walk) where the land drops away, which the
  // ground paints two voxels high. Returns [x, z, y on top of it (units), the angle out over the drop].
  const EDGED = new Set([KIND.STREET, KIND.STAIR, KIND.QUAY, KIND.TOWN]);
  function parapet(ax, az, rmax, kinds = EDGED) {
    for (let r = 0; r <= rmax; r += 0.15) for (let a = 0; a < TAU; a += r ? 0.15 / r : 7) {
      const n = cell(ax + Math.cos(a) * r, az + Math.sin(a) * r);
      if (n < 0 || !kinds.has(R.kind[n])) continue;
      for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const m = n + dk * nx + di;
        if (m < 0 || m >= nx * nz || R.kind[m] === KIND.RIVER || R.top[m] >= R.top[n] - 5) continue;
        const i = n % nx, k = Math.floor(n / nx);
        return [(i + i0 + 0.5) * V, (k + k0 + 0.5) * V, (R.top[n] + 2) * V, Math.atan2(di, dk)];
      }
    }
    return null;
  }

  // ---- models to geometry (each variant meshed once) ---------------------------------------------------
  const arrays = new Map(), models = new Map();
  function arraysOf(key, make, f = 1) {
    const id = f > 1 ? `${key}~${f}` : key;
    if (arrays.has(id)) return arrays.get(id);
    if (!models.has(key)) models.set(key, make());
    const model = models.get(key), sinks = [];
    let nv = 0, ni = 0;
    for (const p of model.parts) {
      const { opaque, glow } = meshBox(f > 1 ? coarsen(p.b.g, f) : p.b.g);
      for (const [s, g] of [[opaque, 0], [glow, p.night ? 128 : 255]]) if (s.indices.length) { sinks.push({ s, g, o: p.b.o }); nv += s.positions.length / 3; ni += s.indices.length; }
    }
    const pos = new Float32Array(nv * 3), nor = new Int8Array(nv * 3), col = new Uint8Array(nv * 3), glow = new Uint8Array(nv), flex = new Float32Array(nv), idx = new Uint32Array(ni);
    let v = 0, e = 0;
    for (const { s, g, o } of sinks) {
      const n = s.positions.length / 3;
      for (let q = 0; q < n; q += 1) {
        const x = s.positions[q * 3] * f + o[0], y = s.positions[q * 3 + 1] * f + o[1], z = s.positions[q * 3 + 2] * f + o[2];
        pos[(v + q) * 3] = x; pos[(v + q) * 3 + 1] = y; pos[(v + q) * 3 + 2] = z;
        for (let c = 0; c < 3; c += 1) nor[(v + q) * 3 + c] = s.normals[q * 3 + c] * 127;
        flex[v + q] = model.flex(x, y, z);
      }
      col.set(s.colours, v * 3); glow.fill(g, v, v + n);
      for (let q = 0; q < s.indices.length; q += 1) idx[e + q] = s.indices[q] + v;
      v += n; e += s.indices.length;
    }
    const a = { pos, nor, col, glow, flex, idx, nv, tris: ni / 3, h: model.h, r: model.r };
    arrays.set(id, a);
    return a;
  }
  // A grid at half the fineness (each 2 x 2 x 2 block its commonest colour when enough of it is filled): the far
  // version of a tree, for when a voxel is smaller than a pixel.
  function coarsen(g, f) {
    const out = grid(Math.ceil(g.sx / f), Math.ceil(g.sy / f), Math.ceil(g.sz / f)), seen = new Map();
    for (let y = 0; y < out.sy; y += 1) for (let z = 0; z < out.sz; z += 1) for (let x = 0; x < out.sx; x += 1) {
      seen.clear(); let n = 0, best = 0, bestN = 0;
      for (let b = 0; b < f; b += 1) for (let c = 0; c < f; c += 1) for (let a = 0; a < f; a += 1) {
        const X = x * f + a, Y = y * f + b, Z = z * f + c;
        if (X >= g.sx || Y >= g.sy || Z >= g.sz) continue;
        const id = g.data[X + g.sx * (Z + g.sz * Y)];
        if (!id) continue;
        n += 1; const k = (seen.get(id) || 0) + 1; seen.set(id, k); if (k > bestN) { bestN = k; best = id; }
      }
      if (n >= 3) out.data[x + out.sx * (z + out.sz * y)] = best;
    }
    return out;
  }
  function geometry(a) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(a.nor, 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(a.col, 3, true));
    g.setAttribute('glow', new THREE.BufferAttribute(a.glow, 1, true));
    g.setAttribute('flex', new THREE.BufferAttribute(a.flex, 1));
    g.setIndex(new THREE.BufferAttribute(a.nv > 65535 ? a.idx : new Uint16Array(a.idx), 1));
    g.computeBoundingSphere();
    return g;
  }
  // Instances of one variant: [{ x, y, z, ry, s, tint }] (world units; y the ground under it). Two meshes: the
  // fine one for the instances near what the camera looks at, the coarse one for the rest; the instances are
  // sorted between them only when the camera has moved on (see relod()).
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), C3 = new THREE.Color();
  const instanced = [];
  function instance(key, make, list) {
    if (!list.length) return null;
    const fine = arraysOf(key, make), coarse = arraysOf(key, make, 2), n = list.length;
    const mats = new Float32Array(n * 16), cols = new Float32Array(n * 3);
    list.forEach((p, i) => {
      M4.compose(P3.set(p.x, p.y, p.z), Q.setFromEuler(E.set(p.rx || 0, p.ry || 0, p.rz || 0)), S3.setScalar(V * (p.s || 1))).toArray(mats, i * 16);
      cols.set(p.tint || [1, 1, 1], i * 3);
    });
    const mk = (a, tag) => {
      const mesh = new THREE.InstancedMesh(geometry(a), mat, n);
      mesh.instanceMatrix.array.set(mats); mesh.instanceColor = new THREE.InstancedBufferAttribute(cols.slice(), 3);
      mesh.computeBoundingSphere(); mesh.frustumCulled = tag === 'far';
      mesh.name = `nat:${key}:${tag}`; mesh.matrixAutoUpdate = false;
      group.add(mesh);
      return mesh;
    };
    const lod = { near: mk(fine, 'near'), far: mk(coarse, 'far'), mats, cols, xz: list.map((p) => [p.x, p.z]), fineTris: fine.tris, coarseTris: coarse.tris };
    lod.near.count = 0; lod.near.visible = false;
    instanced.push(lod);
    return lod;
  }
  // Sort each variant's instances between its fine and coarse mesh: fine within `r` of (x, z).
  function relod(x, z, r) {
    for (const l of instanced) {
      let nn = 0, nf = 0;
      const nm = l.near.instanceMatrix.array, fm = l.far.instanceMatrix.array, nc = l.near.instanceColor.array, fc = l.far.instanceColor.array;
      l.xz.forEach(([px, pz], i) => {
        const src = l.mats.subarray(i * 16, i * 16 + 16), col = l.cols.subarray(i * 3, i * 3 + 3);
        if (Math.abs(px - x) < r && Math.abs(pz - z) < r) { nm.set(src, nn * 16); nc.set(col, nn * 3); nn += 1; } else { fm.set(src, nf * 16); fc.set(col, nf * 3); nf += 1; }
      });
      l.near.count = nn; l.far.count = nf; l.near.visible = nn > 0; l.far.visible = nf > 0;
      for (const m of [l.near, l.far]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    }
  }
  let lodAt = null;

  // ---- small plants, merged per tile --------------------------------------------------------------------
  const tiles = new Map(), sown = {};
  // One small plant at world (x, z) on ground y (voxels), turned a quarter turn `q` times (so its voxels stay on
  // the town's grid).
  function sow(key, make, x, z, y, q = 0) {
    const a = arraysOf(key, make), tx = Math.floor(x / TILE), tz = Math.floor(z / TILE), id = `${tx},${tz}`;
    let t = tiles.get(id);
    if (!t) tiles.set(id, (t = { ox: Math.round((tx * TILE) / V), oz: Math.round((tz * TILE) / V), cx: (tx + 0.5) * TILE, cz: (tz + 0.5) * TILE, items: [], nv: 0, ni: 0 }));
    t.items.push([a, Math.round(x / V) - t.ox, Math.round(y), Math.round(z / V) - t.oz, q & 3]);
    sown[key] = (sown[key] || 0) + a.tris;
    t.nv += a.nv; t.ni += a.idx.length;
    stats.plants += 1;
  }
  const tileMeshes = [];
  function buildTiles() {
    for (const t of tiles.values()) {
      const pos = new Float32Array(t.nv * 3), nor = new Int8Array(t.nv * 3), col = new Uint8Array(t.nv * 3), glow = new Uint8Array(t.nv), flex = new Float32Array(t.nv), idx = t.nv > 65535 ? new Uint32Array(t.ni) : new Uint16Array(t.ni);
      let v = 0, e = 0;
      for (const [a, ox, oy, oz, q] of t.items) {
        const cq = [1, 0, -1, 0][q], sq = [0, 1, 0, -1][q];
        for (let p = 0; p < a.nv; p += 1) {
          const x = a.pos[p * 3], z = a.pos[p * 3 + 2], nx0 = a.nor[p * 3], nz0 = a.nor[p * 3 + 2], w = (v + p) * 3;
          pos[w] = x * cq + z * sq + ox; pos[w + 1] = a.pos[p * 3 + 1] + oy; pos[w + 2] = -x * sq + z * cq + oz;
          nor[w] = nx0 * cq + nz0 * sq; nor[w + 1] = a.nor[p * 3 + 1]; nor[w + 2] = -nx0 * sq + nz0 * cq;
        }
        col.set(a.col, v * 3); glow.set(a.glow, v); flex.set(a.flex, v);
        for (let p = 0; p < a.idx.length; p += 1) idx[e + p] = a.idx[p] + v;
        v += a.nv; e += a.idx.length;
      }
      const g = geometry({ pos, nor, col, glow, flex, idx, nv: t.nv });
      const mesh = new THREE.Mesh(g, mat);
      mesh.position.set(t.ox * V, 0, t.oz * V); mesh.scale.setScalar(V);
      mesh.updateMatrix(); mesh.matrixAutoUpdate = false;
      mesh.visible = false;
      mesh.name = 'nat:tile';
      group.add(mesh);
      tileMeshes.push({ mesh, cx: t.cx, cz: t.cz, tris: t.ni / 3 });
      stats.tiles += 1;
    }
  }

  // ---- effects: bits (leaves, petals, spray, sparks) from one pool; hearts and notes; rings on the water ----
  const fxRig = kit.rig('nat:fx', { gait: 'still', build: () => ({ parts: {} }) });
  group.add(fxRig.group);
  const fx = fxRig.ctx;
  const icons = iconPools(THREE, group, V);
  const rings = ringPool(THREE, group, V);

  // ---- picking: invisible boxes (never drawn, never in the scene) that stand in for things to click --------
  const pickGeo = new THREE.BoxGeometry(1, 1, 1), pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const targets = [], near = []; // near: targets that answer only when the camera is close
  let lastHit = null;
  function target(label, [x, y, z], [sx, sy, sz], on, { spot = null, always = false } = {}) {
    const object = new THREE.Mesh(pickGeo, pickMat);
    object.position.set(x, y, z); object.scale.set(sx, sy, sz); object.updateMatrixWorld();
    object.visible = always;
    const t = { object, label, on: (yu, e) => { lastHit = label; on(yu, e); } };
    // walk over first only from nearby; from afar the thing answers at once (the camera stays where it is)
    if (spot) Object.defineProperty(t, 'spot', { enumerable: true, get: () => (Math.hypot(yuuvAt().x - spot[0], yuuvAt().z - spot[1]) < 9 ? spot : undefined) });
    targets.push(t);
    if (!always) near.push(object);
    return t;
  }
  const yuuvAt = () => env.yuuv.group.position;
  const react = (yu, [x, z], clip = 'point') => { if (Number.isFinite(x) && Number.isFinite(z)) env.face([x, z]); yu.play(clip); };
  const gust = (x, z, k = 1) => { U.uGust.value.set(x, z, U.uTime.value, k); };

  // ================================================================================================
  // FLORA
  // ================================================================================================
  const tt = performance.now();
  // ---- the special places first, so everything else keeps clear of them
  const findSpot = (ax, az, rmax, test) => { for (let r = 0; r <= rmax; r += 0.4) for (let a = 0; a < TAU; a += r ? 0.4 / r : 7) { const x = ax + Math.cos(a) * r, z = az + Math.sin(a) * r; if (test(x, z)) return [x, z]; } return null; };
  // the old tree at the corner of the woods, on the terrace over the south-west cliffs
  const greatAt = findSpot(-76, 24.6, 5, (x, z) => room(x, z, 1, 3.2, GRASS) && riverD(x, z) > 3.2);
  let great = null;
  if (greatAt) {
    const [gx, gz] = greatAt, def = F.greatTree(), r = kit.rig('nat:great', def);
    r.group.position.set(gx, topAt(gx, gz) * V, gz); r.group.rotation.y = 0.45;
    group.add(r.group);
    const veins = [0, 1, 2, 3].map((i) => ownGlow(THREE, r.parts[`veins${i}`]));
    const sparks = ownGlow(THREE, r.parts.sparks), bloom = ownGlow(THREE, r.parts.bloom);
    great = { r, x: gx, z: gz, y: topAt(gx, gz) * V, veins, sparks, bloom, woke: -100 };
    keep.push([gx, gz, 3.6]);
    clearView(gx, gz, 3, 9);
    env.halo(r.parts.trunk, [0, 5.5, 3.6], 7, 0xffd98a, 0.8); // the lit window in its hollow
    env.halo(r.parts.crown, [0, 3, 0], 60, 0x6ff2ff, 0.12); // the crown's own faint light
    target('The old tree', [gx, great.y + 6.8, gz], [7.2, 5.2, 7.2], (yu) => wakeTree(yu), { always: true });
    target('The old tree', [gx, great.y + 2.4, gz], [2.2, 3.6, 2.2], (yu) => wakeTree(yu), { always: true });
  }
  // the lantern tree on the headland, over the harbour
  const lanternAt = findSpot(26.5, 19.2, 4, (x, z) => room(x, z, 0.6, 1.3) && !inTown(x, z));
  let lantern = null;
  if (lanternAt) {
    const [lx, lz] = lanternAt, def = F.lanternTree(), r = kit.rig('nat:lantern', def);
    r.group.position.set(lx, topAt(lx, lz) * V, lz); r.group.rotation.y = 0.5; r.group.scale.setScalar(1.3);
    group.add(r.group);
    lantern = { r, x: lx, z: lz, y: topAt(lx, lz) * V, lamps: ownGlow(THREE, r.parts.lanterns), sky: ownGlow(THREE, r.parts.sky) };
    env.halo(r.parts.lanterns, [0, -4, 0], 26, 0xffb347, 0.55);
    keep.push([lx, lz, 2.4]);
    clearView(lx, lz, 1.8, 6);
    env.light([lx, lantern.y + 1.6, lz], 0xffb347, 2.2, 5);
    target('Lantern tree', [lx, lantern.y + 1.6, lz], [3, 2.8, 3], (yu) => {
      react(yu, [lx, lz], 'cheer');
      r.ctx.mem.lit = r.state.t;
      for (let k = 0; k < 14; k += 1) fx.bit(lx + (hash(k, 3) - 0.5) * 2, lantern.y + 1.2 + hash(k, 4) * 1.4, lz + (hash(k, 5) - 0.5) * 2, (hash(k, 6) - 0.5) * 0.4, 0.5 + hash(k, 7) * 0.5, (hash(k, 8) - 0.5) * 0.4, 1.6, 0.05, 0xfff0b0, 0xff7a3a, { drag: 0.5 });
    }, { spot: [lx - 1.5, lz + 2.2] });
  }
  // the farmyard (a coop, its run, the hens and their rooster), by the woods and the river
  // (turned a quarter: its run is 3.6 wide in x and 4.8 deep in z)
  const coopAt = findSpot(-74, 12.5, 9, (x, z) => { for (const [a, b] of [[0, 0], [-1.9, -2.5], [1.9, -2.5], [-1.9, 2.5], [1.9, 2.5], [0, -2.5], [0, 2.5], [-1.9, 0], [1.9, 0]]) { const n = cell(x + a, z + b); if (n < 0 || !GRASS.has(R.kind[n]) || Math.abs(R.top[n] - topAt(x, z)) > 1) return false; } return !onLot(x, z, 2.2) && riverD(x, z) > 3; });
  if (coopAt) { keep.push([coopAt[0], coopAt[1], 3.4]); clearView(coopAt[0], coopAt[1], 2.2, 6); }
  // pastures: the sheep on the north-west slope, the cows by the farm in the north-east
  const pasture = (ax, az, rmax, n) => {
    const at = findSpot(ax, az, 6, (x, z) => GRASS.has(kindAt(x, z)) && !onLot(x, z, 1.5));
    if (!at) return null;
    const h = topAt(...at), spots = [];
    for (let z = at[1] - rmax; z <= at[1] + rmax; z += 0.5) for (let x = at[0] - rmax; x <= at[0] + rmax; x += 0.5) {
      if (Math.hypot(x - at[0], z - at[1]) > rmax || topAt(x, z) !== h || !GRASS.has(kindAt(x, z)) || onLot(x, z, 1)) continue;
      if (topAt(x + 0.7, z) !== h || topAt(x - 0.7, z) !== h || topAt(x, z + 0.7) !== h || topAt(x, z - 0.7) !== h) continue;
      spots.push([x, z]);
    }
    if (spots.length < n) return null;
    keep.push([at[0], at[1], rmax]);
    return { at, y: h * V, spots };
  };
  const sheepField = pasture(-66, -52, 6.5, 30), cowField = pasture(27.5, -42, 5.5, 20);

  // ---- trees by place ----------------------------------------------------------------------------------
  const KINDS = {
    oak: { v: [[1, (s) => F.oak(s)], [5, (s) => F.oak(s)]], leaf: [0x6a9c44, 0x2e5a26] },
    beech: { v: [[3, (s) => F.beech(s)]], leaf: [0x93c05a, 0x4e8434] },
    pine: { v: [[4, (s) => F.pine(s)]], leaf: [0x3a6a48, 0x173427], cone: true },
    seapine: { v: [[2, (s) => F.seaPine(s)]], leaf: [0x58885a, 0x244a32], cone: true },
    willow: { v: [[1, (s) => F.willow(s)]], leaf: [0xa2c268, 0x6a9644] },
    pink: { v: [[2, (s) => F.blossom(s, 'pink')]], leaf: [0xfbcfe0, 0xe284ae], petals: true },
    white: { v: [[3, (s) => F.blossom(s, 'white')]], leaf: [0xfffaf8, 0xe9e0e2], petals: true },
    apple: { v: [[1, (s) => F.fruit(s, 'apple')]], leaf: [0x6e9e48, 0x3e7432], fruit: 0xd83a2a },
    pear: { v: [[3, (s) => F.fruit(s, 'pear')]], leaf: [0x6e9e48, 0x3e7432], fruit: 0xc6c24a },
    picking: { v: [[5, (s) => F.fruit(s, 'apple', true)]], leaf: [0x6e9e48, 0x3e7432], fruit: 0xd83a2a },
  };
  const LABEL = { oak: 'Oak', beech: 'Beech', pine: 'Pine', seapine: 'Sea pine', willow: 'Willow', pink: 'Cherry blossom', white: 'White blossom', apple: 'Apple tree', pear: 'Pear tree', picking: 'Apple tree' };
  const trees = [], treeGrid = new Map();
  const gkey = (x, z) => `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
  const spaced = (x, z, cr, k) => { for (let a = -2; a <= 2; a += 1) for (let b = -2; b <= 2; b += 1) for (const o of treeGrid.get(`${Math.floor(x / 4) + a},${Math.floor(z / 4) + b}`) || []) if (Math.hypot(o.x - x, o.z - z) < (o.cr + cr) * k) return false; return true; };
  function plant(sp, x, z, seedIx, ry, s, dense) {
    const K = KINDS[sp], [seed, make] = K.v[seedIx % K.v.length], a = arraysOf(`${sp}:${seed}`, () => make(seed));
    const cr = a.r * V * s * 0.8;
    if (!spaced(x, z, cr, dense ? 0.62 : 0.95)) return null;
    const t = { sp, key: `${sp}:${seed}`, make: () => make(seed), x, z, y: topAt(x, z) * V, ry, s, cr, h: a.h * V * s };
    trees.push(t);
    const k = gkey(x, z); if (!treeGrid.has(k)) treeGrid.set(k, []); treeGrid.get(k).push(t);
    return t;
  }
  // orchards: rows of apples and pears along each orchard's long side, one tree with a ladder and a basket
  let story = false;
  ZONES.forEach((zn, zi) => {
    if (zn.kind !== 'orchard') return;
    const poly = chaikin(zn.poly, 2);
    let best = 0, ux = 1, uz = 0;
    for (let i = 0; i < zn.poly.length; i += 1) { const [ax, az] = zn.poly[i], [bx, bz] = zn.poly[(i + 1) % zn.poly.length], L = Math.hypot(bx - ax, bz - az); if (L > best) { best = L; ux = (bx - ax) / L; uz = (bz - az) / L; } }
    const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2, span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
    for (let v = -span; v <= span; v += 2.5) for (let u = -span; u <= span; u += 2.3) {
      const x = cx + ux * u - uz * v, z = cz + uz * u + ux * v;
      if (kindAt(x, z) !== KIND.ORCHARD || !room(x, z, 0.5, 1.1, GRASS) || kept(x, z, 1)) continue;
      const row = Math.round(v / 2.5), sp = !story && hash(zi, row, Math.round(u)) < 0.2 ? 'picking' : Math.abs(row) % 2 ? 'pear' : 'apple';
      if (plant(sp, x, z, 0, Math.atan2(ux, uz) + (hash(Math.round(x * 10), Math.round(z * 10), 3) - 0.5) * 0.6, 0.95 + hash(Math.round(x), Math.round(z), 4) * 0.12, true) && sp === 'picking') story = true;
    }
  });
  // everywhere else, by what the ground is: woods and clumps, pines on the heights and cliff tops, sea pines
  // bent on the headland, willows along the river, blossom in the upper town's gardens, oaks and fruit below
  function species(x, z, k, h, u) {
    if (k === KIND.TOWN) {
      if (h >= LEVEL.top) return null;
      if (riverD(x, z) < 3.4) return ['willow', 0.3]; // along the canal
      if (h >= LEVEL.mid) return [u < 0.45 ? 'pink' : u < 0.72 ? 'white' : 'beech', 0.5];
      return [u < 0.35 ? 'oak' : u < 0.6 ? 'apple' : u < 0.8 ? 'beech' : 'pink', 0.4];
    }
    if (!GRASS.has(k) || k === KIND.ORCHARD || inTown(x, z)) return null;
    if (riverD(x, z) < 3.6) return ['willow', 0.3];
    if (k === KIND.GARDEN) return [u < 0.5 ? 'oak' : u < 0.8 ? 'beech' : 'pine', 0.95];
    const shore = shoreAt(x, z);
    if (((x > 14 && z > 12) || x > 38) && shore < 7) return ['seapine', 0.6];
    if (h >= 70 || (shore < 4.5 && h >= 24)) return ['pine', 0.5];
    if (noise(x, z, 8, 77) > 0.52) return [u < 0.5 ? 'oak' : u < 0.82 ? 'beech' : 'pine', 0.92];
    return [u < 0.55 ? 'oak' : u < 0.85 ? 'beech' : 'pine', k === KIND.MEADOW ? 0.16 : 0.13];
  }
  for (let gz = -98, iz = 0; gz < 50; gz += 1.6, iz += 1) for (let gx = -94, ix = 0; gx < 54; gx += 1.6, ix += 1) {
    const x = gx + (hash(ix, iz, 1) - 0.5) * 1.4, z = gz + (hash(ix, iz, 2) - 0.5) * 1.4, k = kindAt(x, z);
    if (!SOIL.has(k)) continue;
    const pick = species(x, z, k, topAt(x, z), hash(ix, iz, 4));
    if (!pick || hash(ix, iz, 3) > pick[1] || kept(x, z, 1.2)) continue;
    const [sp] = pick, a = arraysOf(`${sp}:${KINDS[sp].v[0][0]}`, () => KINDS[sp].v[0][1](KINDS[sp].v[0][0]));
    if (!room(x, z, 0.55, a.r * V * 0.75)) continue;
    let ry = hash(ix, iz, 5) * TAU;
    if (sp === 'seapine') { // lean away from the sea: down the slope of the distance to it
      const gxs = shoreAt(x + 1, z) - shoreAt(x - 1, z), gzs = shoreAt(x, z + 1) - shoreAt(x, z - 1);
      if (gxs || gzs) ry = Math.atan2(-gzs, gxs);
    }
    plant(sp, x, z, ix + iz, ry, 0.9 + hash(ix, iz, 6) * 0.2, pick[1] > 0.45);
  }
  // draw them: one instanced mesh a variant; a gentle tint per tree
  const byKey = new Map();
  for (const t of trees) { if (!byKey.has(t.key)) byKey.set(t.key, []); byKey.get(t.key).push(t); }
  for (const [key, list] of byKey) {
    instance(key, list[0].make, list.map((t) => { const u = hash(Math.round(t.x * 7), Math.round(t.z * 7), 9); return { x: t.x, y: t.y, z: t.z, ry: t.ry, s: t.s, tint: [0.92 + u * 0.14, 0.94 + u * 0.1, 0.92 + (1 - u) * 0.1] }; }));
  }
  stats.trees = trees.length;
  // a tree answers a click: a breath of wind out from it, leaves (or petals, or a cone, or a windfall) coming down
  for (const t of trees) {
    const w = t.sp === 'pine' ? t.cr * 1.2 : t.cr * 1.8;
    target(LABEL[t.sp], [t.x, t.y + t.h * 0.62, t.z], [w, t.h * 0.66, w], (yu) => {
      react(yu, [t.x, t.z]);
      gust(t.x, t.z, 1);
      // they start at the crown's skin (not inside it) and drift off with the wind as they fall; a few leaves turn gold
      const K = KINDS[t.sp], n = K.petals ? 28 : 22;
      for (let i = 0; i < n; i += 1) {
        const a = hash(i, 7) * TAU, r = t.cr * (1.3 + hash(i, 8) * 0.3), y = t.y + t.h * (0.35 + hash(i, 9) * 0.4); // (cr is 0.8 of the crown's reach)
        const c0 = !K.petals && i % 3 === 0 ? 0xe0a83a : K.leaf[i % 2];
        fx.bit(t.x + Math.cos(a) * r, y, t.z + Math.sin(a) * r, Math.cos(a) * 0.35 + 0.45, -0.2, Math.sin(a) * 0.35 + 0.3, K.petals ? 4.2 : 3.4, K.petals ? 0.1 : 0.12, c0, K.leaf[(i + 1) % 2], { fall: K.petals ? 0.18 : 0.45, drag: 0.9, grow: 0.001 }); // (grow: keeps its size)
      }
      if (K.cone || K.fruit) { const fall = t.h * 0.5, life = Math.sqrt((2 * fall) / 9.8); fx.bit(t.x + 0.4, t.y + fall, t.z + 0.3, 0, 0, 0, life, 0.1, K.fruit || 0x6e4a2a, K.fruit || 0x5a3a20, { fall: 9.8 }); }
    });
  }
  const treeTargets = targets.length;

  // ---- hedgerows round the fields, with a gap for a gate now and then --------------------------------------
  const hedges = [];
  ZONES.forEach((zn, zi) => {
    if (zn.kind !== 'field') return;
    const poly = chaikin(zn.poly, 2);
    for (let i = 0; i < poly.length; i += 1) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length], L = Math.hypot(bx - ax, bz - az);
      for (let u = 0.9; u < L - 0.5; u += 1.75) {
        const x = ax + ((bx - ax) * u) / L, z = az + ((bz - az) * u) / L, dx = (bx - ax) / L, dz = (bz - az) / L;
        if (hash(zi, i, Math.round(u * 3)) < 0.1) continue;
        const ends = [[x - dx * 0.8, z - dz * 0.8], [x + dx * 0.8, z + dz * 0.8]], h = topAt(x, z);
        if (![[x, z], ...ends].every(([px, pz]) => { const k = kindAt(px, pz); return (GRASS.has(k) || k === KIND.FIELD) && topAt(px, pz) === h && !onLot(px, pz, 0.6); })) continue;
        if (kept(x, z, 0.3) || riverD(x, z) < 2.4) continue;
        hedges.push({ x, y: h * V, z, ry: Math.atan2(-dz, dx), s: 1, v: hash(zi, i, 7) < 0.5 ? 0 : 1 });
      }
    }
  });
  instance('hedge:may', () => F.hedge(1, 'may'), hedges.filter((h) => h.v === 0));
  instance('hedge:berry', () => F.hedge(2, 'berry'), hedges.filter((h) => h.v === 1));

  // ---- ivy and climbing roses up stretches of the walls (on the ground at the wall's foot, facing out from it)
  const ivies = [[], [], []];
  WALLS.forEach((w, wi) => {
    for (let i = 1; i < w.pts.length; i += 1) {
      const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L;
      for (let u = 2.5; u < L - 2.5; u += 3.1) {
        const x = ax + dx * u, z = az + dz * u, side = hash(wi, i, Math.round(u)) < 0.5 ? 1 : -1, sx = -dz * side, sz = dx * side;
        if (hash(wi * 7 + i, Math.round(u * 2), 5) > (w.kind === 'land' ? 0.34 : 0.22)) continue;
        if (TOWERS.some((t) => Math.hypot(t.at[0] - x, t.at[1] - z) < t.r + 2.2) || GATES.some((g) => Math.hypot(g.at[0] - x, g.at[1] - z) < g.w / 2 + 3)) continue;
        const fx0 = x + sx * 1.02, fz0 = z + sz * 1.02, gxp = x + sx * 1.5, gzp = z + sz * 1.5, k = kindAt(gxp, gzp);
        if (!(k === KIND.TOWN || GRASS.has(k)) || onLot(gxp, gzp, 0.3) || kindAt(fx0 - sx * 0.2, fz0 - sz * 0.2) !== KIND.WALL) continue;
        const inside = inTown(gxp, gzp), v = inside && hash(wi, i, 9) < 0.45 ? 2 : 0;
        ivies[v].push({ x: fx0, y: topAt(gxp, gzp) * V, z: fz0, ry: Math.atan2(sx, sz), s: 1 });
      }
    }
  });
  // moss and creeper draping down the sea cliff either side of the waterfall, kept green by its spray (the ivy
  // sheet hung upside down from the cliff's lip, so its ragged edge trails below)
  {
    const [lx, lz] = RIVER[RIVER.length - 1].slice(0, 2), top = LEVEL.low * V - 0.2;
    for (const dx of [-2.9, -5.2, 2.6, 4.9]) {
      const x = lx + dx;
      if (TOWERS.some((t) => Math.hypot(t.at[0] - x, t.at[1] - lz) < t.r + 3.2)) continue; // (not over a tower's roof)
      let z = lz - 3;
      while (z < lz + 6 && kindAt(x, z) !== KIND.SEA && topAt(x, z) > 2) z += 0.05;
      if (z < lz + 6) ivies[0].push({ x, y: top, z: z + 0.03, ry: 0, rz: Math.PI, s: 1 });
    }
  }
  instance('ivy:1', () => F.ivy(1), ivies[0]); instance('ivy:rose', () => F.ivy(3, true), ivies[2]);

  // ---- the small growing things ----------------------------------------------------------------------------
  const FLOWER = { pW: 'W', pY: 'Y', pV: 'V', pR: 'R' };
  const flowerKey = (c, s) => [`fl:${c}:${s}`, () => F.flowers(s, c)];
  // the town's gardens: flower beds and kitchen rows where the ground is painted for them (the same rules as
  // js/town/ground.js), a tuft on the lawns
  for (let k = 0; k < nz; k += 1) for (let i = 0; i < nx; i += 1) {
    const n = k * nx + i;
    if (R.kind[n] !== KIND.TOWN) continue;
    const x = i + i0, z = k + k0, g = noise(x, z, 10, 31), wx = (x + 0.5) * V, wz = (z + 0.5) * V;
    if (g > 0.64) {
      const u = hash(x >> 5, z >> 5, 2) < 0.5 ? x : z, v = u === x ? z : x;
      if (((u % 3) + 3) % 3 !== 1 || ((v % 5) + 5) % 5 !== 0) continue;
      const crop = ['cab', 'cab', 'lav', 'wheat', 'cab'][Math.min(4, Math.floor(hash(x >> 4, z >> 4, 3) * 5))];
      if (onLot(wx, wz, 0.2)) continue;
      if (crop === 'cab') sow(`cab:${(x + z) & 1}`, () => F.cabbage((x + z) & 1), wx, wz, R.top[n], (x * 7 + z) & 3);
      else if (crop === 'lav' && v % 10 === 0) sow('lav:1', () => F.lavender(1), wx, wz, R.top[n], u === x ? 1 : 0);
      else if (crop === 'wheat' && v % 8 === 0) sow('wheat:1', () => F.wheat(1), wx, wz, R.top[n], u === x ? 1 : 0);
    } else if (g < 0.24) {
      if (hash(x, z, 91) > 0.08 || onLot(wx, wz, 0.3)) continue;
      const c = ['pW', 'pY', 'pV', 'pR', null, null][Math.min(5, Math.floor(noise(x, z, 7, 5) * 6))];
      if (c) sow(...flowerKey(FLOWER[c], (x + z) & 1), wx, wz, R.top[n], (x + 3 * z) & 3);
    } else if (hash(x, z, 92) < 0.0035 && !onLot(wx, wz, 0.3)) sow(`tuft:${x & 1}`, () => F.tuft(x & 1), wx, wz, R.top[n], z & 3);
  }
  // crops in the fields: wheat on some, a pumpkin patch, stooks on the mown one, lavender where it is painted.
  // Rows follow the ground's own (js/town/ground.js: rows every 3 voxels, hay in bands of 6).
  const CROPS = { 1: 'lavender', 5: 'wheat', 7: 'stooks', 8: 'wheat', 10: 'pumpkins' };
  const fields = [];
  ZONES.forEach((zn, zi) => {
    const crop = CROPS[zi];
    if (!crop) return;
    const dirX = hash(zi, 9) < 0.5;
    let sx = 0, sz = 0, cnt = 0, bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
    for (const [px, pz] of zn.poly) { bx0 = Math.min(bx0, px); bx1 = Math.max(bx1, px); bz0 = Math.min(bz0, pz); bz1 = Math.max(bz1, pz); }
    for (let z = Math.floor(bz0 / V); z <= bz1 / V; z += 1) for (let x = Math.floor(bx0 / V); x <= bx1 / V; x += 1) {
      const n = (z - k0) * nx + (x - i0);
      if (n < 0 || n >= nx * nz || R.kind[n] !== KIND.FIELD || R.ref[n] !== zi) continue;
      const u = dirX ? x : z, v = dirX ? z : x, wx = (x + 0.5) * V, wz = (z + 0.5) * V, um = ((u % 6) + 6) % 6, vm = ((v % 8) + 8) % 8;
      sx += wx; sz += wz; cnt += 1;
      const q = dirX ? 1 : 0;
      if (crop === 'wheat' && (um === 0 || um === 2) && vm === 0) {
        const end = dirX ? cell(wx, wz + 7 * V) : cell(wx + 7 * V, wz);
        if (end >= 0 && R.kind[end] === KIND.FIELD && R.top[end] === R.top[n]) sow(`wheat:${(u >> 1) & 1}`, () => F.wheat((u >> 1) & 1), wx, wz, R.top[n], q ? 3 : 0);
      } else if (crop === 'lavender' && ((u % 3) + 3) % 3 === 1 && ((v % 6) + 6) % 6 === 0) sow(`lav:${v & 1}`, () => F.lavender(v & 1), wx, wz, R.top[n], q);
      else if (crop === 'pumpkins' && um === 4 && hash(x, z, 17) < 0.2) sow(`pump:${x & 1}`, () => F.pumpkin(x & 1), wx, wz, R.top[n], (x + z) & 3);
      else if (crop === 'stooks' && um === 1 && ((v % 11) + 11) % 11 === 0) sow(`stook:${v & 1}`, () => F.stook(v & 1), wx, wz, R.top[n], v & 3);
    }
    if (cnt) fields.push({ zi, crop, x: sx / cnt, z: sz / cnt, n: cnt });
  });
  // a scarecrow in the biggest wheat field, its pumpkin head lit after dark
  const wheatField = fields.filter((f) => f.crop === 'wheat').sort((a, b) => b.n - a.n)[0];
  if (wheatField) {
    const at = findSpot(wheatField.x, wheatField.z, 4, (x, z) => kindAt(x, z) === KIND.FIELD && !onLot(x, z, 1.5) && topAt(x + 0.5, z) === topAt(x, z) && topAt(x - 0.5, z) === topAt(x, z));
    if (at) sow('scarecrow', () => A.scarecrow(), at[0], at[1], topAt(...at), 0);
  }
  // the wild: drifts of wildflowers, tufts, and in the woods ferns, mushrooms (some glowing), logs and mossy rocks;
  // marram on the dunes; reeds along the river's banks; lilies on the canal and the river's slow stretches
  const woodsNear = (x, z) => { for (let a = -1; a <= 1; a += 1) for (let b = -1; b <= 1; b += 1) for (const o of treeGrid.get(`${Math.floor(x / 4) + a},${Math.floor(z / 4) + b}`) || []) if (Math.hypot(o.x - x, o.z - z) < 2.6 && o.sp !== 'willow') return true; return false; };
  const glowSpots = [];
  for (let gz = -98, iz = 0; gz < 50; gz += 0.75, iz += 1) for (let gx = -94, ix = 0; gx < 54; gx += 0.75, ix += 1) {
    const x = gx + (hash(ix, iz, 21) - 0.5) * 0.7, z = gz + (hash(ix, iz, 22) - 0.5) * 0.7, n = cell(x, z);
    if (n < 0) continue;
    const k = R.kind[n], h = R.top[n], u = hash(ix, iz, 23), q = ix + iz;
    if (k === KIND.BEACH) { if (u < 0.2 && shoreAt(x, z) > 0.45) sow(`dune:${q & 1}`, () => F.tuft(q & 1, true), x, z, h, q); continue; }
    if (k === KIND.ROCK) { if (u < 0.018 && h > 3) sow(`rock:${q % 3}`, () => F.rock(q % 3), x, z, h, q); continue; }
    if (!GRASS.has(k) || inTown(x, z) || onLot(x, z, 0.4) || kept(x, z, -1.5)) continue;
    const woods = k === KIND.GARDEN || woodsNear(x, z);
    if (woods) {
      if (u < 0.08) sow(`fern:${q % 2}`, () => F.fern(q % 2), x, z, h, q);
      else if (u < 0.11) { const glow = noise(x, z, 6, 41) > 0.6; sow(`mush:${glow ? 'glow' : q % 2 ? 'red' : 'brown'}:${q % 3}`, () => F.mushrooms(q % 3, glow ? 'glow' : q % 2 ? 'red' : 'brown'), x, z, h, q); if (glow) glowSpots.push([x, h * V, z]); }
      else if (u < 0.118 && room(x, z, 0.3, 1.6, GRASS)) sow(`log:${q % 2}`, () => F.log(q % 2), x, z, h, q);
      else if (u < 0.13) sow(`rock:${q % 3}`, () => F.rock(q % 3), x, z, h, q);
      continue;
    }
    const drift = noise(x, z, 5, 13);
    if (drift > 0.6 && u < 0.32) sow(`wild:${q % 3}`, () => F.wild(q % 3), x, z, h, q);
    else if (u < (k === KIND.MEADOW ? 0.16 : 0.05)) sow(`tuft:${q & 1}`, () => F.tuft(q & 1), x, z, h, q);
    else if (u > 0.996 && room(x, z, 0.3, 0.6, GRASS)) sow(`rock:${q % 3}`, () => F.rock(q % 3), x, z, h, q);
  }
  // water plants: walk the river; reeds at its natural banks, lilies out on the water (the canal's too)
  for (let s = 1; s < RIVER.length - 1; s += 1) {
    const [ax, az, al, aw] = RIVER[s - 1], [bx, bz, bl, bw] = RIVER[s], L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L;
    for (let u = 0.4; u < L; u += 0.55) {
      const cx = ax + dx * u, cz = az + dz * u, w = aw + ((bw - aw) * u) / L, iu = Math.round(u * 10) + s * 1000;
      const wn = cell(cx, cz);
      if (wn < 0 || R.kind[wn] !== KIND.RIVER) continue;
      const lvl = R.water[wn], canal = inTown(cx, cz);
      if (al !== bl && Math.abs(u - L / 2) < 2.2) continue; // not on the cascades
      for (const side of [-1, 1]) {
        const ex = cx - dz * side * (w / 2 - 0.35), ez = cz + dx * side * (w / 2 - 0.35), bank = kindAt(cx - dz * side * (w / 2 + 0.5), cz + dx * side * (w / 2 + 0.5));
        if (kindAt(ex, ez) !== KIND.RIVER) continue;
        if (!canal && (bank === KIND.MEADOW || bank === KIND.LAND) && hash(iu, side, 5) < 0.42) sow(`reeds:${iu % 3}`, () => F.reeds(iu % 3), ex, ez, lvl - 1, iu + side);
        if (canal && hash(iu, side, 6) < 0.06 && (Math.abs(cx + 64) < 3 || Math.abs(cx + 18) < 2.5)) sow(`reeds:${iu % 3}`, () => F.reeds(iu % 3), ex, ez, lvl - 1, iu + side);
      }
      if (hash(iu, 7) < (canal ? 0.2 : 0.1) && w > 1.8) {
        const off = (hash(iu, 8) - 0.5) * (w - 1.2), lx = cx - dz * off, lz = cz + dx * off;
        if (kindAt(lx, lz) === KIND.RIVER) sow(`lily:${iu % 2}:${hash(iu, 9) < 0.35 ? 1 : 0}`, () => F.lily(iu % 2, hash(iu, 9) < 0.35), lx, lz, lvl - 1, iu);
      }
    }
  }
  // crystal flower beds: one by the old tree, one on the headland by the lantern tree
  const beds = [];
  for (const [ax, az] of [[greatAt ? greatAt[0] + 3.4 : -49, greatAt ? greatAt[1] + 3.2 : -63], [lanternAt ? lanternAt[0] - 3.2 : 23, lanternAt ? lanternAt[1] + 0.4 : 19.5]]) {
    const at = findSpot(ax, az, 3, (x, z) => room(x, z, 1.1, 1.2) && riverD(x, z) > 2);
    if (!at) continue;
    beds.push(at);
    sow('crystals', () => F.crystals(3), at[0], at[1], topAt(...at), 0);
    target('Crystal flowers', [at[0], topAt(...at) * V + 0.5, at[1]], [2.4, 1.2, 1.8], (yu) => {
      react(yu, at, 'cheer');
      for (let i = 0; i < 26; i += 1) fx.bit(at[0] + (hash(i, 1) - 0.5) * 2.2, topAt(...at) * V + 0.4, at[1] + (hash(i, 2) - 0.5) * 1.6, 0, 0.6 + hash(i, 3) * 0.9, 0, 1.6 + hash(i, 4), 0.045, [0xe6fdff, 0xb89cff, 0xff7ae0, 0x6ff2ff][i % 4], 0x2a3a8a, { drag: 0.8 });
      rings.spawn(at[0], topAt(...at) * V + 0.3, at[1], 0xb89cff, 1.2, 3.5);
    });
  }
  if (greatAt) { // a fairy ring of glowcaps on the grass by the old tree
    const ring = findSpot(greatAt[0] + 3.2, greatAt[1] - 1.2, 4, (x, z) => { if (beds.some(([bx, bz]) => Math.hypot(bx - x, bz - z) < 3)) return false; for (let a = 0; a < TAU; a += 0.5) { const n = cell(x + Math.cos(a) * 1.2, z + Math.sin(a) * 1.2); if (n < 0 || !GRASS.has(R.kind[n]) || R.top[n] !== topAt(x, z)) return false; } return !onLot(x, z, 1.5); });
    if (ring) {
      for (let i = 0; i < 11; i += 1) { const a = (i / 11) * TAU, x = ring[0] + Math.cos(a) * 1.15, z = ring[1] + Math.sin(a) * 1.15; sow(`mush:glow:${i % 3}`, () => F.mushrooms(i % 3, 'glow'), x, z, topAt(ring[0], ring[1]), i); }
      glowSpots.unshift([ring[0], topAt(...ring) * V, ring[1]]);
    }
  }
  for (const [i, [x, y, z]] of glowSpots.entries()) if (i % 6 === 0) target(i === 0 && greatAt ? 'Fairy ring' : 'Glowcaps', [x, y + 0.25, z], i === 0 && greatAt ? [3, 0.7, 3] : [1.2, 0.6, 1.2], (yu) => { react(yu, [x, z]); for (let k = 0; k < 16; k += 1) fx.bit(x + (hash(k, i) - 0.5), y + 0.3, z + (hash(k, i + 1) - 0.5), (hash(k, 3) - 0.5) * 0.3, 0.25 + hash(k, 4) * 0.3, (hash(k, 5) - 0.5) * 0.3, 2.6, 0.035, 0x9dff8a, 0x2a8a6a, { drag: 0.6 }); });
  if (coopAt) sow('coop', () => A.coop(), coopAt[0], coopAt[1], topAt(...coopAt), 1);
  // a field answers a click with a gust running out across it
  for (const f of fields) target({ wheat: 'Wheat', lavender: 'Lavender', pumpkins: 'Pumpkin patch', stooks: 'Stooks' }[f.crop], [f.x, topAt(f.x, f.z) * V + 0.4, f.z], [Math.sqrt(f.n) * V * 0.9, 0.9, Math.sqrt(f.n) * V * 0.9], (yu) => { react(yu, [f.x, f.z]); gust(f.x, f.z, 1.4); });
  buildTiles();
  const floraMs = Math.round(performance.now() - tt);

  // ================================================================================================
  // FAUNA
  // ================================================================================================
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sph = new THREE.Sphere();
  // A flock: one crowd, its members posed from { x, y, z, ry, rx, rz, s, t, ... } (the def's idle reads the rest).
  function flock(key, def, cap, tints = null) {
    const cr = kit.crowd(key, def, cap), g = new THREE.Group();
    cr.meshes.forEach((m) => g.add(m));
    g.visible = false;
    group.add(g);
    if (tints) cr.meshes.forEach((m) => { for (let i = 0; i < cap; i += 1) m.setColorAt(i, C3.setRGB(...tints[i % tints.length])); m.instanceColor.needsUpdate = true; });
    return {
      g,
      pose(i, m) { def.m = m; M4.compose(P3.set(m.x, m.y, m.z), Q.setFromEuler(E.set(m.rx || 0, m.ry || 0, m.rz || 0)), S3.setScalar(m.s || 1)); cr.pose(i, M4, m.t, 0, false); },
      done(n) { cr.count(n); },
    };
  }
  const single = (key, def, x, y, z, ry = 0) => { const r = kit.rig(key, def); r.group.position.set(x, y, z); r.group.rotation.y = ry; r.group.visible = false; group.add(r.group); return r; };
  const systems = []; // { name, at: [x, y, z], r, always?, night?: 1 | -1, update(dt, t), show?(on) }
  // an animal's pick box answers only while its system is shown
  const adopt = (name, picks) => { const sys = systems.find((q) => q.name === name); for (const p of picks) if (p) p.userData.sys = sys; };
  const faunaT = performance.now();
  let clock = 0;

  // ---- ducks: a flock on the canal (the rubber duck their captain), a few on the harbour -------------------
  // the canal from the Workshop Quarter's front, round its bend by the bridge, to just short of the water gate over
  // the falls; the flock lives on the open stretch at its east end (the houses along the lane hide the rest from the
  // town's camera) and follows Yuuv along all of it
  const CANAL = [[-44, 18.6], ...RIVER.slice(8, 11).map(([x, z]) => [x, z]), [-10.75, 27.4]];
  const canalY = RIVER[8][2] * V - 0.03;
  const canalLen = CANAL.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - CANAL[i][0], p[1] - CANAL[i][1]), 0);
  const along = (s) => { let d = Math.max(0, Math.min(canalLen, s)); for (let i = 1; i < CANAL.length; i += 1) { const [ax, az] = CANAL[i - 1], [bx, bz] = CANAL[i], L = Math.hypot(bx - ax, bz - az); if (d <= L || i === CANAL.length - 1) { const u = Math.min(1, d / L); return { x: ax + (bx - ax) * u, z: az + (bz - az) * u, dx: (bx - ax) / L, dz: (bz - az) / L }; } d -= L; } return null; };
  const project = (x, z) => { let best = null, run = 0; for (let i = 1; i < CANAL.length; i += 1) { const [ax, az] = CANAL[i - 1], [bx, bz] = CANAL[i], q = toSeg(x, z, ax, az, bx, bz), L = Math.hypot(bx - ax, bz - az); if (!best || q.d < best.d) best = { d: q.d, s: run + q.t * L }; run += L; } return best; };
  const drakes = flock('nat:drake', A.duck('drake'), 3), hens = flock('nat:hen', A.duck('hen'), 2), chicks = flock('nat:duckling', A.duckling(), 4);
  const hDrakes = flock('nat:drake:h', A.duck('drake'), 2), hHens = flock('nat:hen:h', A.duck('hen'), 1);
  const rubber = single('nat:rubber', A.rubberDuck(), 0, canalY, 0);
  const S0 = 1, S1 = canalLen - 0.3, H0 = canalLen - 15; // the whole run, and the home stretch
  // where a bridge crosses (ducks pass under it only on their way somewhere; they never idle under one)
  const bands = [];
  for (let q = 0; q < canalLen; q += 0.1) { const p = along(q); if (kindAt(p.x, p.z) === KIND.BRIDGE) { const b = bands[bands.length - 1]; if (b && q - b[1] < 0.3) b[1] = q; else bands.push([q, q]); } }
  const offBridge = (q) => { for (const [a, b] of bands) if (q > a - 1 && q < b + 1) return q - (a - 1) < b + 1 - q ? a - 1 : b + 1; return q; };
  const canalDucks = [];
  const mk = (kind, s, off, i) => ({ kind, s, off, ts: s, to: off, speed: 0, head: 0, t: i * 1.7, seed: i, dab: 0, dabT: 4 + hash(i, 5) * 8, quack: 9, wait: hash(i, 3) * 4, look: 0 });
  [['drake', 0], ['hen', 2.5], ['drake', 5.5], ['hen', 8.5], ['drake', 12]].forEach(([kd, s], i) => canalDucks.push(mk(kd, offBridge(H0 + s), (hash(i, 2) - 0.5) * 1.2, i)));
  const mother = canalDucks[1];
  const ducklings = [0, 1, 2, 3].map((i) => ({ kind: 'chick', x: 0, z: 0, head: 0, speed: 0, t: i * 0.7, seed: i + 10 }));
  const captain = { kind: 'rubber', s: offBridge(H0 + 6), off: 0.3, ts: offBridge(H0 + 6), to: 0.3, speed: 0, head: 1, t: 0, seed: 40, spin: 0 };
  const harbourDucks = [0, 1, 2].map((i) => ({ kind: i === 1 ? 'hen' : 'drake', x: 3 + i * 1.4, z: 31.5 + hash(i, 4), tx: 3 + i * 1.4, tz: 31.5, head: i, speed: 0, t: i * 2.3, seed: 20 + i, dab: 0, dabT: 5 + i * 3, quack: 9, wait: 0 }));
  const HB = { x0: -1, x1: 13, z0: 30.5, z1: 34.5 };
  const posOf = (d) => { const p = along(d.s); return [p.x - p.dz * d.off, p.z + p.dx * d.off, p]; };
  function quack(d, all) {
    d.quack = 0;
    rings.spawn(d.x, (d.y ?? canalY) + 0.05, d.z, 0xd8fdff, 0.8, 2.2);
    icons.spawn('note', d.x, (d.y ?? canalY) + 0.9, d.z, 1);
    // the flock turns: every duck swims off the other way a little
    for (const o of all) { if (o.s === undefined) continue; const dir = Math.sign(o.ts - o.s) || 1; o.ts = Math.max(S0, Math.min(S1, o.s - dir * (2 + hash(o.seed, 9) * 3))); o.wait = 0; }
  }
  for (const d of canalDucks) { const [x, z] = posOf(d); d.x = x; d.z = z; target(d.kind === 'drake' ? 'Mallard' : 'Mallard hen', [x, canalY + 0.3, z], [1.1, 0.8, 1.1], (yu) => { react(yu, [d.x, d.z], 'laugh'); quack(d, [...canalDucks, captain]); }); d.pick = targets[targets.length - 1].object; }
  { const [x, z] = posOf(captain); captain.x = x; captain.z = z; target('Rubber duck', [x, canalY + 0.4, z], [1.1, 1, 1.1], (yu) => { react(yu, [captain.x, captain.z], 'laugh'); rubber.ctx.mem.squeak = rubber.state.t; quack(captain, [...canalDucks, captain]); icons.spawn('heart', captain.x, canalY + 1.1, captain.z, 1); }); captain.pick = targets[targets.length - 1].object; }
  for (const d of harbourDucks) { target(d.kind === 'drake' ? 'Mallard' : 'Mallard hen', [d.x, 0.3, d.z], [1.1, 0.8, 1.1], (yu) => { react(yu, [d.x, d.z], 'laugh'); d.quack = 0; d.y = 0; rings.spawn(d.x, 0.05, d.z, 0xd8fdff, 0.8, 2.2); icons.spawn('note', d.x, 0.9, d.z, 1); for (const o of harbourDucks) { o.tx = Math.max(HB.x0, Math.min(HB.x1, o.x + (o.x - d.x) * 1.5 + (hash(o.seed, 3) - 0.5) * 2)); o.tz = Math.max(HB.z0, Math.min(HB.z1, o.z + (o.z - d.z) * 1.5 + 1)); o.wait = 0; } }); d.pick = targets[targets.length - 1].object; }
  function paddle(d, dt, tx, tz, speed) {
    const dx = tx - d.x, dz = tz - d.z, dist = Math.hypot(dx, dz);
    const want = dist > 0.15 ? Math.min(speed, dist * 0.8) : 0;
    d.speed += (want - d.speed) * Math.min(1, dt * 2);
    if (dist > 0.05) d.head = lerpAngle(d.head, Math.atan2(dx, dz), Math.min(1, dt * 2.5));
    d.x += Math.sin(d.head) * d.speed * dt; d.z += Math.cos(d.head) * d.speed * dt;
  }
  systems.push({
    name: 'canal', at: [-27, canalY, 21], r: 20,
    update(dt, t) {
      // Yuuv by the canal: the flock follows along with him
      const y = yuuvAt(), pj = project(y.x, y.z), follow = pj && pj.d < 5.5 && y.y > canalY - 1;
      for (const [i, d] of canalDucks.entries()) {
        d.t += dt; d.quack += dt; d.wait -= dt;
        if (follow) { d.ts = offBridge(Math.max(S0, Math.min(S1, pj.s - 0.6 - i * 0.9))); d.to = (hash(i, 11) - 0.5) * 1; }
        else if (d.wait <= 0 && Math.abs(d.ts - d.s) < 0.3) { d.ts = offBridge(Math.max(H0, Math.min(S1, d.s + (hash(i, Math.floor(t / 7)) - 0.5) * 7))); d.to = (hash(i, Math.floor(t / 5), 3) - 0.5) * 1.3; d.wait = 3 + hash(i, Math.floor(t)) * 5; }
        // steer along the canal: s toward ts, lateral toward to
        const ds = d.ts - d.s, sp = follow ? 1.5 : Math.abs(d.ts - d.s) > 4 ? 0.8 : 0.32; // (home at a brisker paddle)
        d.s += Math.sign(ds) * Math.min(Math.abs(ds), sp * dt); d.off += (d.to - d.off) * Math.min(1, dt * 0.6);
        const [x, z, p] = posOf(d), vx = x - d.x, vz = z - d.z;
        if (Math.hypot(vx, vz) > 1e-4) d.head = lerpAngle(d.head, Math.atan2(vx, vz), Math.min(1, dt * 3));
        d.x = x; d.z = z;
        d.dabT -= dt;
        if (d.dabT < 0 && !follow) { d.dab = Math.min(1, d.dab + dt * 2); if (d.dabT < -1.6) d.dabT = 5 + hash(i, Math.floor(t)) * 9; } else d.dab = Math.max(0, d.dab - dt * 3);
        d.pick.position.set(x, canalY + 0.3, z); d.pick.updateMatrixWorld();
      }
      // the ducklings in a line behind their mother
      let lead = mother;
      for (const c of ducklings) { c.t += dt; const bx = lead.x - Math.sin(lead.head) * 0.55, bz = lead.z - Math.cos(lead.head) * 0.55; if (!c.x) { c.x = bx; c.z = bz; } paddle(c, dt, bx, bz, 1.3); lead = c; }
      // the captain drifts with the flock, turning slowly (it cannot paddle)
      const mean = canalDucks.reduce((s, d) => s + d.s, 0) / canalDucks.length;
      captain.ts = offBridge(Math.max(S0, Math.min(S1 - 0.6, mean + 1.2))); captain.s += Math.sign(captain.ts - captain.s) * Math.min(Math.abs(captain.ts - captain.s), (Math.abs(captain.ts - captain.s) > 3 ? 0.9 : 0.28) * dt);
      const [cx, cz] = posOf(captain); captain.x = cx; captain.z = cz; captain.spin += dt * 0.25; captain.quack += dt;
      captain.pick.position.set(cx, canalY + 0.4, cz); captain.pick.updateMatrixWorld();
      rubber.group.position.set(cx, canalY - 0.02, cz); rubber.group.rotation.y = captain.spin;
      rubber.update(dt, false);
      // pose
      let nd = 0, nh = 0;
      for (const d of canalDucks) { const m = { x: d.x, y: canalY - 0.05, z: d.z, ry: d.head, t: d.t, seed: d.seed, dab: d.dab, quack: d.quack }; if (d.kind === 'drake') drakes.pose(nd++, m); else hens.pose(nh++, m); }
      drakes.done(nd); hens.done(nh);
      ducklings.forEach((c, i) => chicks.pose(i, { x: c.x, y: canalY - 0.04, z: c.z, ry: c.head, t: c.t, seed: c.seed }));
      chicks.done(ducklings.length);
    },
    show(on) { drakes.g.visible = hens.g.visible = chicks.g.visible = rubber.group.visible = on; },
  });
  adopt('canal', [...canalDucks.map((d) => d.pick), captain.pick]);
  systems.push({ // the harbour ducks bob on the swell, wander, dabble
    name: 'harbour', at: [6, 0, 32.5], r: 9,
    update(dt, t) {
      for (const [i, d] of harbourDucks.entries()) {
        d.t += dt; d.quack += dt; d.wait -= dt;
        if (d.wait <= 0 && Math.hypot(d.tx - d.x, d.tz - d.z) < 0.3) { d.tx = HB.x0 + hash(i, Math.floor(t / 6), 1) * (HB.x1 - HB.x0); d.tz = HB.z0 + hash(i, Math.floor(t / 6), 2) * (HB.z1 - HB.z0); d.wait = 4 + hash(i, Math.floor(t), 3) * 6; }
        paddle(d, dt, d.tx, d.tz, 0.35);
        d.dabT -= dt; d.dab = d.dabT < 0 ? Math.min(1, d.dab + dt * 2) : Math.max(0, d.dab - dt * 3); if (d.dabT < -1.5) d.dabT = 6 + hash(i, Math.floor(t)) * 8;
        d.pick.position.set(d.x, 0.3, d.z); d.pick.updateMatrixWorld();
      }
      let nd = 0, nh = 0;
      for (const d of harbourDucks) { const m = { x: d.x, y: -0.04, z: d.z, ry: d.head, t: d.t, seed: d.seed, dab: d.dab, quack: d.quack }; if (d.kind === 'drake') hDrakes.pose(nd++, m); else hHens.pose(nh++, m); }
      hDrakes.done(nd); hHens.done(nh);
    },
    show(on) { hDrakes.g.visible = hHens.g.visible = on; },
  });
  adopt('harbour', harbourDucks.map((d) => d.pick));
  // ---- swans: a pair gliding up and down the river below the west gate ----------------------------------------
  const swanDef = A.swan(), swans = flock('nat:swan', swanDef, 2);
  const R3 = RIVER[3], R4 = RIVER[4], swanY = R3[2] * V - 0.03;
  const swanPair = [0, 1].map((i) => ({ u: 0.3 + i * 0.08, off: i ? 0.45 : -0.45, dir: 1, head: 0, t: i * 3, seed: i * 5, neck: 0, heart: -100 }));
  const swanPos = (w) => { const u = Math.max(0.1, Math.min(0.78, w.u)); return [R3[0] + (R4[0] - R3[0]) * u + w.off * 0.9, R3[1] + (R4[1] - R3[1]) * u]; };
  systems.push({
    name: 'swans', at: [(R3[0] + R4[0]) / 2, swanY, (R3[1] + R4[1]) / 2], r: 10,
    update(dt, t) {
      const [a, b] = swanPair, heart = t - a.heart < 7;
      for (const w of swanPair) {
        w.t += dt;
        if (!heart) { w.u += w.dir * dt * 0.012; if (w.u > 0.76 || w.u < 0.12) w.dir *= -1; }
        const [x, z] = swanPos(w), L = Math.hypot(R4[0] - R3[0], R4[1] - R3[1]);
        w.x = x; w.z = z;
        const face = heart ? Math.atan2((w === a ? b : a).x - x, (w === a ? b : a).z - z) : Math.atan2((R4[0] - R3[0]) / L * w.dir, (R4[1] - R3[1]) / L * w.dir);
        w.head = lerpAngle(w.head, face, Math.min(1, dt * 1.5));
        w.neck += ((heart ? 1 : 0) - w.neck) * Math.min(1, dt * 1.6);
      }
      if (heart) { a.u += (b.u - 0.035 - a.u) * Math.min(1, dt); }
      swanPair.forEach((w, i) => swans.pose(i, { x: w.x, y: swanY - 0.05, z: w.z, ry: w.head, t: w.t, seed: w.seed, neck: w.neck, side: i ? -1 : 1 }));
      swans.done(2);
      swanPick.position.set((a.x + b.x) / 2, swanY + 0.8, (a.z + b.z) / 2); swanPick.updateMatrixWorld();
    },
    show(on) { swans.g.visible = on; },
  });
  const swanPick = target('Swans', [...swanPos(swanPair[0])].flatMap((v, i) => (i ? [swanY + 0.8, v] : [v])), [2.4, 1.8, 2.8], (yu) => {
    const [a, b] = swanPair;
    react(yu, [(a.x + b.x) / 2, (a.z + b.z) / 2], 'cheer');
    a.heart = b.heart = clock;
    for (let k = 0; k < 4; k += 1) fx.after(0.8 + k * 0.5, () => icons.spawn('heart', (a.x + b.x) / 2, swanY + 1.9, (a.z + b.z) / 2, 1.3));
  }).object;

  adopt('swans', [swanPick]);
  // ---- gulls: wheeling over the harbour, a few standing on the point road's parapets over the sea ------------------
  const gullDef = A.gull(), gulls = flock('nat:gull', gullDef, 12);
  const bollards = []; // (perches)
  for (const [ax, az] of [[22.5, 22.7], [27, 22.9], [33.5, 25.2], [36.8, 27.5]]) { const p = parapet(ax, az, 1.6); if (p && bollards.every((b) => Math.hypot(b[0] - p[0], b[2] - p[1]) > 1.2)) bollards.push([p[0], p[2], p[1], p[3]]); }
  const wheel = [0, 1, 2, 3, 4, 5].map((i) => ({ cx: 5 + (hash(i, 1) - 0.5) * 10, cz: 28 + (hash(i, 2) - 0.5) * 6, r: 4 + hash(i, 3) * 6, h: 5 + hash(i, 4) * 6, w: (0.28 + hash(i, 5) * 0.2) * (i % 3 ? 1 : -1), a: hash(i, 6) * TAU, t: i, seed: i }));
  const perched = bollards.slice(0, 4).map((b, i) => ({ home: b, x: b[0], y: b[1], z: b[2], head: b[3] + (hash(i, 1) - 0.5), t: i * 1.3, seed: i + 10, fly: 0, off: -1, squawk: 0 }));
  systems.push({
    name: 'gulls', at: [6, 4, 27], r: 18, always: true,
    update(dt, t) {
      let n = 0;
      for (const g of wheel) {
        g.a += g.w * dt; g.t += dt;
        const x = g.cx + Math.cos(g.a) * g.r, z = g.cz + Math.sin(g.a) * g.r, y = g.h + 0.5 * Math.sin(g.a * 2 + g.seed);
        const flapping = Math.sin(t * 0.7 + g.seed * 2) > 0.55;
        gulls.pose(n++, { x, y, z, s: 0.72, ry: Math.atan2(-Math.sin(g.a) * Math.sign(g.w), Math.cos(g.a) * Math.sign(g.w)), rz: -0.45 * Math.sign(g.w), t: g.t, seed: g.seed, fly: 1, beat: flapping ? Math.sin(g.t * 10) * 0.8 : 0.08 * Math.sin(g.t * 2) });
      }
      if (this.near) for (const [i, p] of perched.entries()) {
        p.t += dt; p.squawk = Math.max(0, p.squawk - dt * 1.5);
        if (p.off >= 0) { // off on a turn over the water after a fright, then home again
          p.off += dt; const u = p.off / 7, a = u * TAU;
          p.x = p.home[0] + Math.sin(a) * 4; p.z = p.home[2] + 3 - Math.cos(a) * 3; p.y = p.home[1] + Math.sin(Math.PI * Math.min(1, u)) * 4;
          p.head = Math.atan2(Math.cos(a), Math.sin(a)); p.fly = u < 0.94 ? 1 : 1 - (u - 0.94) / 0.06;
          if (u >= 1) { p.off = -1; p.x = p.home[0]; p.y = p.home[1]; p.z = p.home[2]; p.fly = 0; }
        } else if (hash(i, Math.floor(p.t / 3)) < 0.2 && p.t % 3 < dt * 1.5) p.squawk = 1;
        gulls.pose(n++, { x: p.x, y: p.y, z: p.z, s: 0.72, ry: p.head + (p.off < 0 ? 0.4 * Math.sin(p.t * 0.4) : 0), t: p.t, seed: p.seed, fly: p.fly, squawk: p.squawk });
        p.pick.position.set(p.x, p.y + 0.3, p.z); p.pick.updateMatrixWorld();
      }
      gulls.done(n);
    },
    show() { gulls.g.visible = true; },
  });
  for (const p of perched) p.pick = target('Herring gull', [p.x, p.y + 0.3, p.z], [0.7, 0.8, 0.9], (yu) => { react(yu, [p.x, p.z]); p.squawk = 1; icons.spawn('bang', p.x, p.y + 1.1, p.z, 1); fx.after(0.5, () => { if (p.off < 0) p.off = 0; }); }).object;

  adopt('gulls', perched.map((p) => p.pick));
  // ---- songbirds: they live in the old tree; now and then (or when it is woken) they swoop over the town --------
  const TINTS = [[1, 0.62, 0.45], [1, 0.9, 0.45], [0.7, 0.85, 1.1], [1, 1, 1], [1.1, 0.72, 0.62], [0.85, 1, 0.7]];
  const birds = flock('nat:songbird', A.songbird(), 16, TINTS);
  const home = great ? [great.x, great.y + 6.5, great.z] : [-40, 18, -30];
  const loop = [home, [-62, 15, 10], [-42, 16, -14], [-20, 17, -30], [-4, 14, -12], [3.5, 10.5, 4], [-6, 10.5, 16], [-30, 11, 19], [-56, 12, 22], home]; // over the Academy and the Market, down through Gate Square, home along the canal
  const swoop = { at: -1000, next: 25, dur: 26 };
  const flyers = Array.from({ length: 14 }, (_, i) => ({ lag: i * 0.12 + hash(i, 3) * 0.3, ox: (hash(i, 1) - 0.5) * 3, oy: (hash(i, 2) - 0.5) * 1.6, oz: (hash(i, 4) - 0.5) * 3, t: i, seed: i }));
  const splinePt = (u, out) => { const n = loop.length - 1, f = Math.max(0, Math.min(n - 1e-6, u * n)), i = Math.floor(f), s = f - i; const p0 = loop[Math.max(0, i - 1)], p1 = loop[i], p2 = loop[i + 1], p3 = loop[Math.min(n, i + 2)]; for (let c = 0; c < 3; c += 1) out[c] = 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * s + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * s * s + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * s * s * s); return out; };
  const sp0 = [0, 0, 0], sp1 = [0, 0, 0];
  systems.push({
    at: [-25, 14, -15], r: 60, always: true,
    update(dt, t) {
      if (t > swoop.next && t - swoop.at > swoop.dur) { swoop.at = t; swoop.next = t + swoop.dur + 30 + hash(Math.floor(t), 3) * 25; }
      const u0 = (t - swoop.at) / swoop.dur;
      let n = 0;
      if (u0 >= 0 && u0 < 1.08) for (const b of flyers) {
        const u = u0 - (b.lag * 1.6) / swoop.dur; // (a second or two between the first and the last)
        if (u <= 0 || u >= 1) continue;
        b.t += dt;
        splinePt(u, sp0); splinePt(Math.min(1, u + 0.004), sp1);
        const w = Math.sin(t * 0.9 + b.seed) * 0.6, edge = Math.min(1, u * 12, (1 - u) * 12);
        const x = sp0[0] + (b.ox + w) * edge, y = sp0[1] + (b.oy + Math.sin(t * 1.7 + b.seed) * 0.5) * edge, z = sp0[2] + (b.oz - w) * edge;
        birds.pose(n++, { x, y, z, ry: Math.atan2(sp1[0] - sp0[0], sp1[2] - sp0[2]), rx: -Math.atan2(sp1[1] - sp0[1], Math.hypot(sp1[0] - sp0[0], sp1[2] - sp0[2])) * 0.7, rz: Math.sin(t * 1.3 + b.seed) * 0.3, t: b.t, seed: b.seed, fly: 1, beat: Math.sin(b.t * 18) > -0.2 ? Math.sin(b.t * 22) * 0.9 : 0.1, s: 1.15 });
      }
      birds.done(n);
      birds.g.visible = n > 0;
    },
    show() {},
  });

  // ---- pigeons in Gate Square: they peck about, and burst up when anyone comes through --------------------------
  const HUB = PLOTS.hub, hubY = HUB.y * V, hubEdge = edgeOf(HUB.A, HUB.B, HUB.seed);
  const AVOID = [[0, -1.6, 2.5], [0, 2.3, 2.2], [-4.4, 6.3, 1.4], [5.2, -0.4, 0.9], [-1.85, 8.1, 0.7], [1.85, 8.1, 0.7], [-7.8, -3.6, 1.1], [7.7, -3.8, 1.1], [-7.2, 5.8, 1.1], [7.4, 5.6, 1.1], [-5.6, -4.8, 0.6], [5.6, -4.8, 0.6], [-6.1, 3.4, 0.6], [6.1, 3.4, 0.6]];
  const hubOk = (lx, lz) => hubEdge(lx / V, lz / V) < 0.8 && AVOID.every(([a, b, r]) => Math.hypot(lx - a, lz - b) > r);
  const hubSpot = (seed, away = null) => { for (let k = 0; k < 40; k += 1) { const a = hash(seed, k, 1) * TAU, r = 2.6 + hash(seed, k, 2) * 5, lx = Math.cos(a) * r, lz = -0.6 + Math.sin(a) * r; if (!hubOk(lx, lz)) continue; if (away && Math.hypot(HUB.c[0] + lx - away[0], HUB.c[1] + lz - away[1]) < 4) continue; return [HUB.c[0] + lx, HUB.c[1] + lz]; } return [HUB.c[0] - 3, HUB.c[1] - 4]; };
  const pigeonDef = A.pigeon(), pigeons = flock('nat:pigeon', pigeonDef, 10);
  const doves = Array.from({ length: 9 }, (_, i) => { const [x, z] = hubSpot(i * 13 + 1); return { x, z, y: hubY, tx: x, tz: z, head: hash(i, 2) * TAU, t: i, seed: i, state: 'peck', until: hash(i, 3) * 4, fly: 0, from: null, to: null, u: 0, dur: 3, peck: 0 }; });
  function scatter(from, all = false) {
    let k = 0;
    for (const d of doves) {
      if (d.state === 'fly') continue;
      if (!all && Math.hypot(d.x - from[0], d.z - from[1]) > 1.8) continue;
      const [tx, tz] = hubSpot(Math.floor(clock * 10) + d.seed * 7 + k, from);
      Object.assign(d, { state: 'fly', from: [d.x, d.z], to: [tx, tz], u: -k * 0.08 - hash(d.seed, k) * 0.15, dur: 2.6 + hash(d.seed, 5) * 1.4, loop: hash(d.seed, 6) < 0.5 ? 1 : -1 });
      k += 1;
    }
    return k;
  }
  systems.push({
    name: 'pigeons', at: [HUB.c[0], hubY + 1, HUB.c[1]], r: 11,
    update(dt, t) {
      const y = yuuvAt();
      if (Math.abs(y.y - hubY) < 1.2) scatter([y.x, y.z]);
      if (dogState.run && dogRig) scatter([dogRig.group.position.x, dogRig.group.position.z]);
      for (const [i, d] of doves.entries()) {
        d.t += dt;
        if (d.state === 'fly') {
          d.u += dt / d.dur;
          const u = Math.max(0, Math.min(1, d.u)), [ax, az] = d.from, [bx, bz] = d.to, dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1;
          const side = Math.sin(u * Math.PI) * 1.6 * d.loop, e = smooth(u);
          const nx2 = ax + dx * e - (dz / L) * side, nz2 = az + dz * e + (dx / L) * side;
          if (u > 0) d.head = Math.atan2(nx2 - d.x, nz2 - d.z) || d.head;
          d.x = nx2; d.z = nz2; d.y = hubY + Math.sin(u * Math.PI) * (2.4 + hash(i, 7) * 1.4);
          d.fly = u <= 0 ? 0 : u < 0.92 ? 1 : (1 - u) / 0.08;
          if (d.u >= 1) { d.state = 'peck'; d.until = t + 1 + hash(i, Math.floor(t)) * 3; d.fly = 0; d.y = hubY; }
        } else if (d.state === 'walk') {
          const dx = d.tx - d.x, dz = d.tz - d.z, dist = Math.hypot(dx, dz);
          d.head = lerpAngle(d.head, Math.atan2(dx, dz), Math.min(1, dt * 5));
          const step = Math.min(dist, dt * 0.45); d.x += (dx / (dist || 1)) * step; d.z += (dz / (dist || 1)) * step;
          if (dist < 0.05) { d.state = 'peck'; d.until = t + 1.5 + hash(i, Math.floor(t), 2) * 3; }
        } else if (t > d.until) {
          const a = hash(i, Math.floor(t), 4) * TAU, r = 0.4 + hash(i, Math.floor(t), 5) * 1.1, lx = d.x + Math.cos(a) * r - HUB.c[0], lz = d.z + Math.sin(a) * r - HUB.c[1];
          if (hubOk(lx, lz)) { d.tx = HUB.c[0] + lx; d.tz = HUB.c[1] + lz; d.state = 'walk'; } else d.until = t + 0.5;
        }
        d.peck = d.state === 'peck' ? Math.max(0, Math.sin(d.t * 5 + i) ** 8) : 0;
        pigeons.pose(i, { x: d.x, y: d.y, z: d.z, ry: d.head, t: d.t, seed: d.seed, fly: d.fly, walk: d.state === 'walk' ? 1 : 0, peck: d.peck, pitch: d.fly * 0.15 });
        d.pick.position.set(d.x, d.y + 0.35, d.z); d.pick.updateMatrixWorld();
      }
      pigeons.done(doves.length);
    },
    show(on) { pigeons.g.visible = on; },
  });
  for (const d of doves) d.pick = target('Pigeons', [d.x, hubY + 0.35, d.z], [0.8, 0.8, 0.9], (yu) => { react(yu, [d.x, d.z], 'laugh'); scatter([d.x, d.z], true); for (let k = 0; k < 6; k += 1) fx.bit(d.x, hubY + 0.4, d.z, (hash(k, 1) - 0.5) * 1.5, 1 + hash(k, 2), (hash(k, 3) - 0.5) * 1.5, 1.8, 0.04, 0xb4b9c4, 0x868c98, { fall: 0.6, drag: 1.4 }); }).object;

  adopt('pigeons', doves.map((d) => d.pick));
  // ---- the dog in Gate Square: naps by the notice board, trots about, sees off the pigeons now and then ---------
  const dogBed = [HUB.c[0] + 3.6, HUB.c[1] + 4.7];
  const dogRig = single('nat:dog', A.dog(), dogBed[0], hubY, dogBed[1], 0.9);
  const dogState = { mode: 'lie', until: 12, tx: dogBed[0], tz: dogBed[1], head: 0.9, run: false, greet: 0 };
  function dogGo(mode, tx, tz, until) { Object.assign(dogState, { mode, tx, tz, until }); }
  systems.push({
    name: 'dog', at: [HUB.c[0], hubY + 1, HUB.c[1]], r: 11,
    update(dt, t) {
      const s = dogState, g = dogRig.group.position, mem = dogRig.ctx.mem;
      let moving = false, pace = 1;
      if (s.mode === 'lie' || s.mode === 'sit') { if (t > s.until) { if (s.mode === 'lie') dogGo('sit', g.x, g.z, t + 3 + hash(Math.floor(t), 1) * 3); else if (hash(Math.floor(t), 2) < 0.35 && doves.some((d) => d.state !== 'fly')) { const d = doves.find((q) => q.state !== 'fly'); dogGo('chase', d.x, d.z, t + 6); } else { const [x, z] = hubSpot(Math.floor(t) * 3); dogGo('trot', x, z, t + 12); } } }
      else if (s.mode === 'spin') { if (t > s.until) { const y = yuuvAt(); dogGo('greet', y.x + Math.sin(0.45) * 1.1, y.z + Math.cos(0.45) * 1.1, t + 10); } }
      else {
        const dx = s.tx - g.x, dz = s.tz - g.z, dist = Math.hypot(dx, dz);
        pace = s.mode === 'chase' ? 2.4 : 1;
        if (dist > 0.12 && t < s.until) { moving = true; s.head = lerpAngle(s.head, Math.atan2(dx, dz), Math.min(1, dt * 6)); const step = Math.min(dist, dt * 1.25 * pace); g.x += Math.sin(s.head) * step; g.z += Math.cos(s.head) * step; }
        else if (s.mode === 'chase') { const [x, z] = hubSpot(Math.floor(t) * 5 + 2); dogGo('trot', x, z, t + 10); }
        else if (s.mode === 'greet') { const y = yuuvAt(); s.head = lerpAngle(s.head, Math.atan2(y.x - g.x, y.z - g.z), Math.min(1, dt * 4)); dogGo('sit', g.x, g.z, t + 6); s.greet = t + 6; }
        else if (s.mode === 'home') dogGo('lie', g.x, g.z, t + 14 + hash(Math.floor(t), 4) * 8);
        else dogGo(hash(Math.floor(t), 5) < 0.5 ? 'sit' : 'home', ...(hash(Math.floor(t), 5) < 0.5 ? [g.x, g.z] : dogBed), t + (hash(Math.floor(t), 5) < 0.5 ? 5 : 20));
      }
      s.run = s.mode === 'chase' && moving;
      const lieK = s.mode === 'lie' ? 1 : 0, sitK = s.mode === 'sit' || s.mode === 'greet' && !moving ? 1 : 0;
      mem.lie += (lieK - mem.lie) * Math.min(1, dt * 3); mem.sit += (sitK - mem.sit) * Math.min(1, dt * 4);
      mem.wag += ((t < s.greet || s.mode === 'chase' || s.mode === 'spin' ? 1 : s.mode === 'lie' ? 0.15 : 0.45) - mem.wag) * Math.min(1, dt * 2);
      mem.run = s.run ? 1 : 0;
      if (s.mode === 'spin') s.head += dt * 9;
      dogRig.group.rotation.y = s.head;
      g.y = hubY;
      dogRig.update(dt * (moving ? pace : 1), moving);
      dogPick.position.set(g.x, hubY + 0.6, g.z); dogPick.updateMatrixWorld();
    },
    show(on) { dogRig.group.visible = on; },
  });
  const dogPick = target('Dog', [dogBed[0], hubY + 0.6, dogBed[1]], [1.2, 1.3, 1.6], (yu) => {
    const g = dogRig.group.position;
    react(yu, [g.x, g.z], 'laugh');
    dogGo('spin', g.x, g.z, clock + 1.4);
    dogRig.ctx.mem.bark = dogRig.state.t + 1.5;
    fx.after(1.5, () => icons.spawn('bang', g.x, hubY + 1.9, g.z, 1));
    fx.after(1.9, () => { dogRig.ctx.mem.bark = dogRig.state.t; icons.spawn('bang', g.x, hubY + 1.9, g.z, 1); });
  }).object;

  adopt('dog', [dogPick]);
  // ---- cats: one on the sea wall watching the gulls, one curled under the lantern tree, one on the terrace wall ----
  const catSpots = [
    ['ginger', 'sit', [8.2, 17.6], 0.35, 'wall'],
    ['black', 'loaf', [0, 0], 0.5, 'lantern'],
    ['grey', 'sit', [-47, -17.9], 0, 'ledge'],
  ];
  const cats = [];
  for (const [coat, pose, [ax, az], face, where] of catSpots) {
    let at = null, ry = face, y0 = 0;
    if (where === 'wall') { at = findSpot(ax, az, 3, (x, z) => kindAt(x, z) === KIND.WALL); if (at) y0 = topAt(...at) * V; }
    else if (where === 'lantern') { if (lanternAt) { at = findSpot(lanternAt[0] - 1.3, lanternAt[1] + 0.5, 1.5, (x, z) => GRASS.has(kindAt(x, z)) && topAt(x, z) === topAt(...lanternAt)); if (at) y0 = topAt(...at) * V; } }
    else { const p = parapet(ax, az, 3, where === 'street' ? new Set([KIND.STREET, KIND.STAIR]) : new Set([KIND.TOWN])); if (p && !onLot(p[0], p[1], 0.3)) { at = [p[0], p[1]]; y0 = p[2]; ry = p[3] + 0.4; } }
    if (!at) continue;
    const [x, z] = at, y = y0;
    const r = single(`nat:cat:${coat}`, A.cat(coat, pose), x, y, z, ry);
    r.ctx.mem.seed = cats.length * 2.3;
    const c = { r, x, z, y };
    cats.push(c);
    systems.push({ name: `cat:${coat}`, at: [x, y, z], r: 2, update(dt) { r.update(dt, false); }, show(on) { r.group.visible = on; } });
    target(coat === 'black' ? 'Black cat' : coat === 'grey' ? 'Grey tabby' : 'Ginger cat', [x, y + 0.7, z], [1.1, 1.5, 1.3], (yu) => {
      react(yu, [x, z], 'laugh');
      r.ctx.mem.pet = r.state.t;
      for (let k = 0; k < 4; k += 1) fx.after(k * 0.35, () => icons.spawn('heart', x + (k - 1.5) * 0.25, y + 1.6, z, 0.9));
    }, where === 'wall' || where === 'lantern' ? {} : { spot: [x - Math.sin(ry) * 1.1, z - Math.cos(ry) * 1.1] });
    adopt(`cat:${coat}`, [targets[targets.length - 1].object]);
  }

  // ---- the farmyard: hens scratching in the run, the rooster on the roof who crows at dawn -----------------------
  let rooster = null;
  if (coopAt) {
    const [cx, cz] = coopAt, cy = topAt(cx, cz) * V;
    // the coop is turned a quarter (model x -> world -z, model z -> world x): its run is 3.6 wide in x, 4.8 deep in z
    const [h0, h1, h2, h3] = A.COOP.house, [rx, ry, rz] = A.COOP.ridge;
    const runOk = (x, z) => Math.abs(x - cx) < 1.55 && Math.abs(z - cz) < 2.2 && !(x > cx + h2 * V - 0.2 && x < cx + h3 * V + 0.2 && z > cz - h1 * V - 0.2 && z < cz - h0 * V + 0.2);
    const hens = flock('nat:chicken', A.chicken(), 7, [[1, 1, 1], [1, 0.82, 0.58], [0.72, 0.48, 0.32], [1, 1, 1], [0.95, 0.75, 0.5], [0.68, 0.5, 0.36], [1, 0.95, 0.9]]);
    const flockC = Array.from({ length: 7 }, (_, i) => ({ x: cx + 0.6 + (hash(i, 1) - 0.5) * 1.6, z: cz - 0.6 + (hash(i, 2) - 0.5) * 2.4, head: hash(i, 3) * TAU, t: i, seed: i, peck: 0, flap: 0, hop: 0, tx: cx, tz: cz, wait: hash(i, 4) * 3, panic: 0 }));
    rooster = single('nat:rooster', A.rooster(), cx + rz * V, cy + ry * V, cz - rx * V, 0.45);
    rooster.group.scale.setScalar(1.25);
    systems.push({
      name: 'hens', at: [cx, cy, cz], r: 4,
      update(dt, t) {
        for (const [i, h] of flockC.entries()) {
          h.t += dt; h.wait -= dt; h.panic = Math.max(0, h.panic - dt);
          const dx = h.tx - h.x, dz = h.tz - h.z, dist = Math.hypot(dx, dz), sp = h.panic > 0 ? 1.6 : 0.4;
          if (dist > 0.08) { h.head = lerpAngle(h.head, Math.atan2(dx, dz), Math.min(1, dt * 6)); const st = Math.min(dist, dt * sp); h.x += (dx / dist) * st; h.z += (dz / dist) * st; }
          else if (h.wait <= 0) { for (let k = 0; k < 6; k += 1) { const x = h.x + (hash(i, Math.floor(t * 3), k) - 0.5) * 2.2, z = h.z + (hash(i, Math.floor(t * 3), k + 9) - 0.5) * 2.2; if (runOk(x, z)) { h.tx = x; h.tz = z; break; } } h.wait = 1 + hash(i, Math.floor(t), 2) * 3; }
          h.peck = dist < 0.08 ? Math.max(0, Math.sin(h.t * 6 + i) ** 6) : 0;
          h.flap = h.panic > 0 ? 1 : 0; h.hop = h.panic > 0 ? Math.abs(Math.sin(h.t * 9)) : 0;
          hens.pose(i, { x: h.x, y: cy, z: h.z, ry: h.head, t: h.t, seed: h.seed, peck: h.peck, flap: h.flap, hop: h.hop, walk: dist > 0.08 ? 1 : 0 });
        }
        hens.done(flockC.length);
        rooster.update(dt, false);
        // dawn: the night lifts, the rooster crows
        if (this.lastNight > 0.5 && U.uNight.value <= 0.5) crow();
        this.lastNight = U.uNight.value;
      },
      lastNight: 1,
      show(on) { hens.g.visible = rooster.group.visible = on; },
    });
    const crow = () => { rooster.ctx.mem.crow = rooster.state.t; for (let k = 0; k < 3; k += 1) fx.after(0.3 + k * 0.45, () => icons.spawn('note', cx + rz * V, cy + ry * V + 1.8, cz - rx * V, 1.2)); };
    target('Hens', [cx, cy + 0.6, cz], [3.6, 1.3, 4.8], (yu) => {
      react(yu, [cx, cz], 'laugh');
      for (const [i, h] of flockC.entries()) { h.panic = 2.2; const a = Math.atan2(h.x - cx, h.z - cz) + (hash(i, 7) - 0.5); const nx0 = h.x + Math.sin(a) * 1.2, nz0 = h.z + Math.cos(a) * 1.2; if (runOk(nx0, nz0)) { h.tx = nx0; h.tz = nz0; } for (let k = 0; k < 3; k += 1) fx.bit(h.x, cy + 0.5, h.z, (hash(i, k) - 0.5) * 1.2, 0.8 + hash(k, i), (hash(k, i, 2) - 0.5) * 1.2, 1.6, 0.045, 0xf4f0e6, 0xe0d8c6, { fall: 0.5, drag: 1.6 }); }
      fx.after(0.8, crow);
    });
    adopt('hens', [targets[targets.length - 1].object]);
  }

  // ---- sheep and cows ----------------------------------------------------------------------------------------
  function herd(key, def, field, n, label, opts) {
    if (!field) return null;
    const f = flock(key, def, n);
    const members = Array.from({ length: n }, (_, i) => { const [x, z] = field.spots[Math.floor(hash(i, 3, opts.seed) * field.spots.length)]; return { x, z, tx: x, tz: z, head: hash(i, 4) * TAU, t: i * 1.3, seed: i, graze: 1, wait: hash(i, 5) * 6, s: opts.lamb && i >= n - opts.lamb ? 0.62 : 1, hop: 0, hopT: -1, hops: 0, moo: 0, swish: 0 }; });
    const sys = {
      name: key, at: [field.at[0], field.y + 0.6, field.at[1]], r: 8,
      update(dt, t) {
        for (const [i, m] of members.entries()) {
          m.t += dt; m.wait -= dt;
          // hopping (clicked, or following the one that was): a few bounds toward its goal
          if (m.hopT >= 0) {
            m.hopT += dt;
            const k = m.hopT / 0.42, bound = Math.floor(k);
            m.hopU = k - bound; m.hop = bound < m.hops ? Math.sin(Math.PI * m.hopU) : 0;
            if (bound >= m.hops) { m.hopT = -1; m.hop = 0; }
          }
          const dx = m.tx - m.x, dz = m.tz - m.z, dist = Math.hypot(dx, dz), hopping = m.hopT >= 0;
          const sp = hopping ? 2.2 : opts.speed;
          if (dist > 0.1 && (m.wait <= 0 || hopping)) { m.head = lerpAngle(m.head, Math.atan2(dx, dz), Math.min(1, dt * 3)); const st = Math.min(dist, dt * sp); m.x += (dx / dist) * st; m.z += (dz / dist) * st; m.graze = Math.max(0, m.graze - dt * 2); m.walk = 1; }
          else {
            m.walk = 0;
            m.graze = Math.min(1, m.graze + dt * (Math.sin(m.t * 0.21 + i) > -0.3 ? 1 : -1.5)); m.graze = Math.max(0, m.graze);
            if (m.wait <= 0) { const [x, z] = field.spots[Math.floor(hash(i, Math.floor(t / 3), opts.seed) * field.spots.length)]; if (Math.hypot(x - m.x, z - m.z) < opts.roam) { m.tx = x; m.tz = z; } m.wait = opts.rest + hash(i, Math.floor(t)) * opts.rest; }
          }
          if (m.s < 1 && m.hopT < 0 && hash(i, Math.floor(t / 2), 8) < 0.12 && t % 2 < dt * 1.1) { m.hopT = 0; m.hops = 2; } // lambs frolic
          m.moo = Math.max(0, m.moo - dt * 0.6); m.swish = Math.max(0, m.swish - dt * 0.5);
          f.pose(i, { x: m.x, y: field.y, z: m.z, ry: m.head, s: m.s, t: m.t, seed: m.seed, graze: m.graze, chew: 1 - m.graze, walk: m.walk, hop: m.hop, hopU: m.hopU, moo: m.moo > 0 ? Math.min(1, m.moo * 2) : 0, swish: m.swish });
          m.pick.position.set(m.x, field.y + opts.h * 0.5 * m.s, m.z); m.pick.updateMatrixWorld();
        }
        f.done(n);
      },
      show(on) { f.g.visible = on; },
    };
    systems.push(sys);
    for (const m of members) m.pick = target(m.s < 1 ? 'Lamb' : label, [m.x, field.y + opts.h * 0.5, m.z], [opts.w * m.s, opts.h * m.s, opts.l * m.s], (yu) => opts.on(yu, m, members, field)).object;
    adopt(key, members.map((m) => m.pick));
    return members;
  }
  herd('nat:sheep', A.sheep(), sheepField, 11, 'Sheep', {
    seed: 3, speed: 0.35, roam: 3.5, rest: 7, h: 1.3, w: 1.1, l: 1.6, lamb: 3,
    on(yu, m, all, field) {
      react(yu, [m.x, m.z], 'laugh');
      // it bounds off, and the herd follows it, one after another
      const a = hash(Math.floor(clock * 10), 3) * TAU;
      let goal = [m.x + Math.cos(a) * 2.6, m.z + Math.sin(a) * 2.6];
      goal = field.spots.reduce((b, s) => (Math.hypot(s[0] - goal[0], s[1] - goal[1]) < Math.hypot(b[0] - goal[0], b[1] - goal[1]) ? s : b), field.spots[0]);
      Object.assign(m, { tx: goal[0], tz: goal[1], hopT: 0, hops: 4, wait: 3 });
      for (const o of all) {
        if (o === m) continue;
        const d = Math.hypot(o.x - m.x, o.z - m.z), off = [(hash(o.seed, 4) - 0.5) * 2.4, (hash(o.seed, 5) - 0.5) * 2.4];
        const s = field.spots.reduce((b, p) => (Math.hypot(p[0] - goal[0] - off[0], p[1] - goal[1] - off[1]) < Math.hypot(b[0] - goal[0] - off[0], b[1] - goal[1] - off[1]) ? p : b), field.spots[0]);
        fx.after(0.3 + d * 0.22, () => Object.assign(o, { tx: s[0], tz: s[1], hopT: 0, hops: 3 + (o.seed % 2), wait: 3 }));
      }
    },
  });
  herd('nat:cow', A.cow(), cowField, 3, 'Cow', {
    seed: 7, speed: 0.22, roam: 3, rest: 12, h: 1.9, w: 1.2, l: 2.2,
    on(yu, m) { react(yu, [m.x, m.z], 'laugh'); m.moo = 1.6; m.swish = 1; m.graze = 0; m.wait = 4; for (let k = 0; k < 3; k += 1) fx.after(0.2 + k * 0.4, () => icons.spawn('note', m.x + Math.sin(m.head) * 1.2, (cowField.y || 0) + 2.2, m.z + Math.cos(m.head) * 1.2, 1.1)); },
  });

  // ---- fish that leap in the harbour and off the headland -------------------------------------------------------
  const fishDef = A.fish(), fishes = flock('nat:fish', fishDef, 4);
  const SPOTS = [[8, 36], [42.5, 28]].filter(([x, z]) => kindAt(x, z) === KIND.SEA);
  const leaps = SPOTS.map((s, i) => ({ spot: s, u: 1, dur: 0.8, x0: 0, z0: 0, x1: 0, z1: 0, h: 1, s: 0.8, next: 2 + i * 1.7, t: 0, big: false }));
  function leap(L, big) {
    const a = hash(Math.floor(clock * 7), 3) * TAU, r = big ? 0 : hash(Math.floor(clock * 5), 4) * 2.5, len = big ? 3.2 : 1.6 + hash(Math.floor(clock), 5);
    const x = L.spot[0] + Math.cos(a) * r, z = L.spot[1] + Math.sin(a) * r, b = hash(Math.floor(clock * 3), 6) * TAU;
    Object.assign(L, { u: 0, dur: big ? 1.35 : 0.75, x0: x - Math.cos(b) * len / 2, z0: z - Math.sin(b) * len / 2, x1: x + Math.cos(b) * len / 2, z1: z + Math.sin(b) * len / 2, h: big ? 2.8 : 0.9, s: big ? 1.9 : 0.85, big });
    rings.spawn(L.x0, 0.03, L.z0, 0xd8fdff, big ? 1.4 : 0.8, big ? 3 : 1.8);
  }
  systems.push({
    name: 'fish', at: [20, 0.5, 30], r: 30,
    update(dt, t) {
      let n = 0;
      for (const L of leaps) {
        L.t += dt;
        if (L.u >= 1 && t > L.next) { leap(L, false); L.next = t + 3 + hash(Math.floor(t), 7) * 5; }
        if (L.u < 1) {
          const was = L.u; L.u += dt / L.dur;
          const u = Math.min(1, L.u), x = L.x0 + (L.x1 - L.x0) * u, z = L.z0 + (L.z1 - L.z0) * u, y = Math.sin(Math.PI * u) * L.h - 0.15;
          if (was < 1 && L.u >= 1) { rings.spawn(L.x1, 0.03, L.z1, 0xd8fdff, L.big ? 1.6 : 0.9, L.big ? 3.4 : 2); if (L.big) for (let k = 0; k < 24; k += 1) fx.bit(L.x1, 0.1, L.z1, (hash(k, 1) - 0.5) * 2.4, 1.5 + hash(k, 2) * 2.5, (hash(k, 3) - 0.5) * 2.4, 1.1, 0.07, 0xe6fdff, 0x5ab8d8, { fall: 7 }); }
          fishes.pose(n++, { x, y, z, ry: Math.atan2(L.x1 - L.x0, L.z1 - L.z0), rx: -Math.cos(Math.PI * u) * 1.1, s: L.s, t: L.t });
        } else if (Math.floor(t * 0.5 + L.spot[0]) % 3 === 0 && (t * 0.5 + L.spot[0]) % 1 < dt * 0.5) rings.spawn(L.spot[0] + (hash(Math.floor(t), 1) - 0.5) * 2, 0.03, L.spot[1] + (hash(Math.floor(t), 2) - 0.5) * 2, 0x9fe8ff, 0.5, 1.2);
      }
      fishes.done(n);
    },
    show(on) { fishes.g.visible = on; },
  });
  for (const L of leaps) L.pick = target('Leaping fish', [L.spot[0], 0.3, L.spot[1]], [4.5, 0.8, 4.5], (yu) => { react(yu, L.spot, 'cheer'); leap(L, true); L.next = clock + 4; });

  adopt('fish', leaps.map((L) => L.pick && L.pick.object));
  // ---- butterflies by day, over the flowers ----------------------------------------------------------------------
  const flutter = flock('nat:butterfly', A.butterfly(), 12, [[1, 0.6, 0.25], [0.5, 0.75, 1.2], [1.1, 1, 0.45], [1, 1, 1], [1, 0.55, 0.8], [0.8, 1, 0.6]]);
  const meadows = [];
  const flowerAt = (ax, az, r) => findSpot(ax, az, r, (x, z) => GRASS.has(kindAt(x, z)) && noise(x, z, 5, 13) > 0.62 && !inTown(x, z));
  for (const [ax, az] of [[-70, -30], [-60, -60], [-80, 16], [30, 24], [40, -20]]) { const at = flowerAt(ax, az, 8); if (at) meadows.push([at[0], topAt(...at) * V, at[1]]); }
  if (sheepField) meadows.push([sheepField.at[0] + 3, sheepField.y, sheepField.at[1] - 2]);
  const bflies = meadows.slice(0, 3).flatMap((m, g) => [0, 1, 2, 3].map((i) => ({ m, t: i * 2.1 + g, seed: g * 4 + i, r: 0.8 + hash(g, i) * 1.4 })));
  systems.push({
    at: meadows[0] ? [meadows[0][0], meadows[0][1] + 1, meadows[0][2]] : [0, 0, 0], r: 60, night: -1,
    update(dt) {
      let n = 0;
      for (const b of bflies) {
        b.t += dt;
        const [mx, my, mz] = b.m;
        if (!this.seen(mx, mz)) continue;
        const a = b.t * (0.6 + (b.seed % 3) * 0.15) + b.seed, x = mx + Math.cos(a) * b.r + Math.sin(b.t * 2.3 + b.seed) * 0.35, z = mz + Math.sin(a * 1.3) * b.r, y = my + 0.5 + 0.35 * Math.sin(b.t * 1.7 + b.seed) + 0.25 * Math.abs(Math.sin(b.t * 3.1));
        flutter.pose(n++, { x, y, z, ry: a + Math.PI / 2 + Math.sin(b.t * 4) * 0.5, rz: Math.sin(b.t * 5) * 0.3, t: b.t, seed: b.seed, s: 0.8 });
      }
      flutter.done(n);
    },
    show(on) { flutter.g.visible = on; },
  });

  // ---- fireflies after dark: along the river, in the woods, round the old tree -----------------------------------
  const clusters = [];
  for (let s = 1; s < RIVER.length - 3; s += 2) { const [ax, az] = RIVER[s - 1], [bx, bz] = RIVER[s]; const x = (ax + bx) / 2 + 1.8, z = (az + bz) / 2; if (!inTown(x, z)) clusters.push([x, topAt(x, z) * V, z]); }
  for (let s = 0; s < canalLen; s += 7) { const p = along(s); clusters.push([p.x, canalY + 0.3, p.z]); } // over the canal
  if (great) clusters.push([great.x + 2.5, great.y, great.z + 1.5], [great.x - 3, great.y, great.z - 2.5], [great.x + 1, great.y + 3, great.z - 1]);
  clusters.push([-79, topAt(-79, 21) * V, 21], [-73, topAt(-73, 20) * V, 20]);
  if (lantern) clusters.push([lantern.x - 2, lantern.y, lantern.z + 0.5], [lantern.x + 3, lantern.y, lantern.z]);
  if (coopAt) clusters.push([coopAt[0] - 2, topAt(...coopAt) * V, coopAt[1] + 4]);
  const glow = fireflies(THREE, clusters, U);
  group.add(glow.points);
  clusters.forEach(([x, y, z], i) => { target('Fireflies', [x, y + 1.2, z], [3.2, 2.2, 3.2], (yu) => { react(yu, [x, z], 'cheer'); glow.swirl(i, U.uTime.value); }).object.userData.night = true; });

  // ---- bats round the citadel's towers after dark ------------------------------------------------------------------
  const R0 = PLOTS.research, batAt = [R0.c[0], R0.y * V + 9, R0.c[1]];
  const bats = flock('nat:bat', A.bat(), 8);
  const batList = Array.from({ length: 8 }, (_, i) => ({ a: hash(i, 1) * TAU, r: 3 + hash(i, 2) * 5, h: hash(i, 3) * 4, w: 1.1 + hash(i, 4) * 0.9, t: i, seed: i, scare: 0 }));
  systems.push({
    name: 'bats', at: batAt, r: 12, night: 1, far: 44,
    update(dt, t) {
      batList.forEach((b, i) => {
        b.t += dt; b.scare = Math.max(0, b.scare - dt * 0.3);
        b.a += dt * b.w * (1 + b.scare) * (0.8 + 0.4 * Math.sin(t * 1.3 + i));
        const r = b.r * (1 + b.scare * 1.5) + Math.sin(t * 2.1 + i) * 0.8;
        const x = batAt[0] + Math.cos(b.a) * r, z = batAt[2] + Math.sin(b.a) * r, y = batAt[1] + b.h + Math.sin(t * 3 + i * 2) * 0.8 + b.scare * 3;
        bats.pose(i, { x, y, z, ry: -b.a, rz: 0.4, t: b.t, seed: b.seed, s: 0.95 });
      });
      bats.done(batList.length);
    },
    show(on) { bats.g.visible = on; },
  });
  adopt('bats', [target('Bats', [batAt[0], batAt[1] + 2, batAt[2]], [12, 5, 12], (yu) => { react(yu, [batAt[0], batAt[2]]); for (const b of batList) b.scare = 1; }).object]);

  // ================================================================================================
  // the old tree woken: veins light up from the roots to the crown, the blossom opens, spirit-lights and petals
  // spiral off it, the songbirds burst out, the fireflies swirl, and a breath of wind runs out over the island
  function wakeTree(yu) {
    if (!great) return;
    const { r, x, y, z } = great;
    if (clock - great.woke < 6) return;
    great.woke = clock;
    if (yu) yu.play('cheer');
    r.ctx.mem.woke = r.state.t;
    gust(x, z, 1.6);
    for (let k = 0; k < 40; k += 1) fx.after(1.2 + k * 0.05, () => { const a = k * 0.7, rr = 1.5 + (k % 5) * 0.7; fx.bit(x + Math.cos(a) * rr, y + 5 + (k % 7) * 0.4, z + Math.sin(a) * rr, -Math.sin(a) * 1.2, 0.6 + (k % 3) * 0.3, Math.cos(a) * 1.2, 3.2, 0.07, [0xffb8e0, 0xd8fdff, 0xfff2b0, 0xb89cff][k % 4], 0xff8ad0, { drag: 0.4, fall: -0.1 }); });
    for (let k = 0; k < 30; k += 1) fx.after(2.2 + k * 0.12, () => fx.bit(x + (hash(k, 1) - 0.5) * 7, y + 6 + hash(k, 2) * 2, z + (hash(k, 3) - 0.5) * 7, 0.3, -0.2, 0.15, 4.5, 0.05, 0xffb8e0, 0xfff0f8, { fall: 0.12, drag: 1 }));
    fx.after(1.6, () => { if (clock - swoop.at > swoop.dur) { swoop.at = clock; swoop.next = clock + swoop.dur + 40; } });
    clusters.forEach((c, i) => fx.after(1.8 + i * 0.1, () => glow.swirl(i, U.uTime.value)));
    rings.spawn(x, y + 0.1, z, 0xb89cff, 2.4, 5);
  }

  // ================================================================================================
  // UPDATE
  // ================================================================================================
  const faunaMs = Math.round(performance.now() - faunaT);
  const prof = { ms: 0, n: 0 };
  function update(dt, t, night) {
    const p0 = performance.now();
    upd(dt, t, night);
    prof.ms += performance.now() - p0; prof.n += 1;
  }
  function upd(dt, t, night) {
    clock = t;
    U.uTime.value = t; U.uNight.value = night;
    const cam = env.cam(), isNear = cam.fit < NEAR, pickOn = cam.fit < PICK;
    for (const o of near) { const u = o.userData; o.visible = pickOn && (!u.sys || u.sys.on === true) && (!u.night || night > 0.5); }
    const cam3 = env.camera;
    frustum.setFromProjectionMatrix(pv.multiplyMatrices(cam3.projectionMatrix, cam3.matrixWorldInverse));
    const tx = cam.target.x, tz = cam.target.z, reach = cam.fit * 2.6 + 6;
    const lr = cam.fit > 30 ? 0 : cam.fit * 1.3 + 8;
    if (!lodAt || Math.hypot(tx - lodAt[0], tz - lodAt[1]) > 5 || Math.abs(lr - lodAt[2]) > 4 || (lr === 0) !== (lodAt[2] === 0)) { relod(tx, tz, lr); lodAt = [tx, tz, lr]; }
    // small plants: near the camera's target only (frustum culling does the rest)
    const win = cam.fit * 1.8 + 8 + TILE / 2;
    for (const tm of tileMeshes) tm.mesh.visible = isNear && Math.abs(tm.cx - tx) < win && Math.abs(tm.cz - tz) < win;
    // animals: the ones in view and near enough to see
    const seen = (x, z, r = 0) => Math.hypot(x - tx, z - tz) < reach + r;
    for (const s of systems) {
      const lit = s.night === 1 ? night > 0.5 : s.night === -1 ? night < 0.5 : true;
      sph.center.set(...s.at); sph.radius = s.r + 2;
      const on = lit && (s.always || ((isNear || (s.far && cam.fit < s.far)) && seen(s.at[0], s.at[2], s.r) && frustum.intersectsSphere(sph)));
      s.near = isNear;
      s.seen = seen;
      if (on !== s.on) { s.on = on; s.show?.(on); }
      if (on) s.update(dt, t);
    }
    // the old tree and the lantern tree: always alive (they are landmarks from afar)
    if (great) {
      const { r, veins, sparks, bloom } = great, w = t - great.woke;
      r.update(dt, false);
      veins.forEach((m, i) => { const k = w > 0 && w < 9 ? Math.exp(-((w - 0.3 - i * 0.35) ** 2) * 3) * 1.6 + smooth((w - 0.3 - i * 0.35) * 2) * (1 - smooth((w - 6) / 3)) * 0.5 : 0; m.color.setScalar(0.55 + 0.25 * night + 0.12 * Math.sin(t * 1.3 + i) + k); });
      sparks.color.setScalar((0.35 + 0.65 * night) * (0.7 + 0.3 * Math.sin(t * 2.3)) + (r.ctx.mem.open || 0) * 0.6);
      bloom.color.setScalar(0.7 + 0.5 * (r.ctx.mem.open || 0) + 0.1 * Math.sin(t * 3));
    }
    if (lantern) {
      lantern.r.update(dt, false);
      const f = lantern.r.ctx.mem.flare || 0;
      lantern.lamps.color.setScalar(0.75 + 0.25 * night + 0.1 * Math.sin(t * 2.7) + f * 0.9);
      lantern.sky.color.setScalar(0.8 + 0.2 * night + 0.1 * Math.sin(t * 3.3) + f * 0.5);
    }
    glow.update(t, night, cam3, true);
    fxRig.update(dt, false);
    icons.update(dt, cam.yaw);
    rings.update(dt);
  }

  const natureStats = () => ({ trees: stats.trees, plants: stats.plants, tiles: stats.tiles, fineTris: instanced.reduce((s, l) => s + l.fineTris * l.xz.length, 0), coarseTris: instanced.reduce((s, l) => s + l.coarseTris * l.xz.length, 0), tileTris: tileMeshes.reduce((s, t) => s + t.tris, 0), variants: instanced.length, targets: targets.length, treeTargets, floraMs, faunaMs, systems: systems.length, sown: Object.entries(sown).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k}:${Math.round(v / 1000)}k`).join(' ') });
  window.__nature = { bands, canalLen, swoop, bflies, ivies, hit: () => lastHit, prof, group, stats: natureStats, great, wake: () => wakeTree(env.yuuv.ctx), targets, systems, trees, fields, cats, doves, canalDucks, captain, swanPair, leaps, meadows, clusters, sheepField, cowField, coopAt, lanternAt, greatAt, glow, U };
  return { group, update, targets };
}

// Its own copy of a part's glow material, so it can brighten and dim on its own (the kit's is shared).
function ownGlow(THREE, part) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true });
  part.traverse((o) => { if (o.isMesh && o.material.isMeshBasicMaterial) o.material = m; });
  return m;
}

// ---- the flora's material ----------------------------------------------------------------------------------
function floraMaterial(THREE, U) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float glow;
attribute float flex;
uniform float uTime;
uniform vec2 uWind;
uniform vec4 uGust;
varying float vGlow;
varying vec3 vVox;
varying vec3 vNl;
varying float vWave;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vVox = position; vNl = normal; vGlow = glow;
#ifdef USE_INSTANCING
vec3 nOrg = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
vec3 nWind = normalize((vec4(uWind.x, 0.0, uWind.y, 0.0) * instanceMatrix).xyz);
#else
vec3 nOrg = (modelMatrix * vec4(position, 1.0)).xyz;
vec3 nWind = vec3(uWind.x, 0.0, uWind.y);
#endif
float nPh = dot(nOrg.xz, vec2(0.33, 0.21));
float nW = sin(uTime * 1.3 - nPh) * 0.55 + sin(uTime * 2.2 - nPh * 1.8 + 1.7) * 0.22 + 0.25;
float nGa = uTime - uGust.z, nGd = distance(nOrg.xz, uGust.xy) - nGa * 8.0;
nW += uGust.w * 2.6 * exp(-nGd * nGd * 0.3) * clamp(1.0 - nGa / 4.0, 0.0, 1.0);
vWave = nW * min(flex, 2.0);
transformed += nWind * flex * nW;
transformed.y -= flex * abs(nW) * 0.12;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
uniform float uNight;
varying float vGlow;
varying vec3 vVox;
varying vec3 vNl;
varying float vWave;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 nCell = floor(vVox - vNl * 0.5 + 0.001);
float nHv = fract(sin(dot(nCell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
float nGk = vGlow > 0.75 ? 1.0 : (vGlow > 0.25 ? uNight : 0.0);
diffuseColor.rgb *= mix(1.0 + (nHv - 0.5) * 0.15 + vWave * 0.05, 1.0, nGk);`)
      .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;', `vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
outgoingLight = mix(outgoingLight, diffuseColor.rgb * (0.85 + 0.15 * sin(uTime * 2.1 + nHv * 6.283)), nGk);`);
  };
  m.customProgramCacheKey = () => 'nat-flora';
  return m;
}

// ---- fireflies: one cloud of points, each drifting round its home and blinking, animated in its shader --------
function fireflies(THREE, clusters, U) {
  const PER = 18, n = clusters.length * PER, pos = new Float32Array(n * 3), seed = new Float32Array(n), grp = new Float32Array(n);
  clusters.forEach(([x, y, z], c) => { for (let i = 0; i < PER; i += 1) { const k = c * PER + i, a = hash(c, i, 1) * TAU, r = 0.4 + hash(c, i, 2) * 2.4; pos.set([x + Math.cos(a) * r, y + 0.3 + hash(c, i, 3) * 1.9, z + Math.sin(a) * r], k * 3); seed[k] = hash(c, i, 4); grp[k] = c; } });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('grp', new THREE.BufferAttribute(grp, 1));
  g.computeBoundingSphere();
  const centres = clusters.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const swirlAt = new Float32Array(32).fill(-99);
  const cg = new Float32Array(32 * 3); centres.slice(0, 32).forEach((c, i) => cg.set([c.x, c.y, c.z], i * 3));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uNight: U.uNight, uScale: { value: 300 }, uSwirl: { value: swirlAt }, uCentre: { value: Array.from({ length: 32 }, (_, i) => new THREE.Vector3(cg[i * 3], cg[i * 3 + 1], cg[i * 3 + 2])) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float seed; attribute float grp;
      uniform float uTime, uNight, uScale; uniform float uSwirl[32]; uniform vec3 uCentre[32];
      varying float vA;
      void main() {
        vec3 p = position;
        float s = seed * 40.0;
        p += vec3(sin(uTime * 0.45 + s) * 0.55, sin(uTime * 0.7 + s * 1.3) * 0.3, cos(uTime * 0.38 + s * 0.7) * 0.55);
        int gi = int(grp + 0.5);
        float w = uTime - uSwirl[gi];
        if (w > 0.0 && w < 5.0) {
          vec3 c = uCentre[gi];
          vec3 d = p - c;
          float k = sin(3.14159 * w / 5.0), a = w * (3.0 + seed * 2.0) + seed * 6.28, r = length(d.xz) * (1.0 - 0.55 * k) + 0.3;
          vec3 q = c + vec3(cos(a) * r, d.y + k * (0.8 + seed * 1.6), sin(a) * r);
          p = mix(p, q, k);
        }
        vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float blink = pow(max(0.0, sin(uTime * (1.2 + seed) + s)), 3.0);
        vA = uNight * (0.4 + 1.1 * blink) * (w > 0.0 && w < 5.0 ? 1.5 : 1.0);
        gl_PointSize = clamp((0.34 + 0.22 * blink) * uScale / -mv.z, 2.0, 22.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); float k = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(0.85, 1.0, 0.42) * k * vA + vec3(1.0) * smoothstep(0.18, 0.0, d) * vA * 0.6, 1.0); }`,
  });
  const points = new THREE.Points(g, m);
  points.name = 'nat:fireflies';
  points.frustumCulled = true;
  return {
    points,
    swirl(i, t) { if (i < 32) swirlAt[i] = t; },
    update(t, night, camera, on) {
      points.visible = night > 0.05 && on;
      const h = camera.isPerspectiveCamera ? 1 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) : 1;
      m.uniforms.uScale.value = 260 * h;
    },
  };
}

// ---- hearts, notes and a bang: little voxel icons that pop up, float, turn to the camera and fade ------------------
function iconPools(THREE, group, V) {
  const shapes = {
    heart: [['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'], 0xff5a9a, 0xffb8d8],
    note: [['..####', '..#..#', '..#..#', '###.##', '###.##'], 0xfff2b0, 0xffe070],
    bang: [['##', '##', '##', '##', '..', '##'], 0xfff4d8, 0xffc764],
  };
  const pools = {};
  for (const [name, [rows, c1, c2]] of Object.entries(shapes)) {
    const pos = [], col = [], idx = [];
    const h = rows.length;
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch !== '#') return;
      const x = i - row.length / 2, y = h - 1 - j, v = pos.length / 3, c = new THREE.Color((i + j) % 3 === 0 ? c2 : c1);
      for (const [a, b, z] of [[0, 0, 0.5], [1, 0, 0.5], [1, 1, 0.5], [0, 1, 0.5], [0, 0, -0.5], [1, 0, -0.5], [1, 1, -0.5], [0, 1, -0.5]]) { pos.push(x + a, y + b, z); col.push(c.r, c.g, c.b); }
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3, v + 5, v + 4, v + 7, v + 5, v + 7, v + 6, v + 1, v + 5, v + 6, v + 1, v + 6, v + 2, v + 4, v, v + 3, v + 4, v + 3, v + 7, v + 3, v + 2, v + 6, v + 3, v + 6, v + 7, v + 4, v + 5, v + 1, v + 4, v + 1, v);
    }));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ vertexColors: true }), 16);
    mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false;
    group.add(mesh);
    pools[name] = { mesh, list: [] };
  }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
  return {
    spawn(name, x, y, z, size = 1) { const p = pools[name]; if (p.list.length >= 16) p.list.shift(); p.list.push({ x, y, z, age: 0, life: 1.6, size, sway: p.list.length }); },
    update(dt, yaw) {
      for (const p of Object.values(pools)) {
        let n = 0;
        p.list = p.list.filter((it) => (it.age += dt) < it.life);
        for (const it of p.list) {
          const u = it.age / it.life, pop = Math.min(1, it.age * 7) * (1 - Math.max(0, (u - 0.75) / 0.25)), s = V * 0.55 * it.size * pop * (1 + 0.25 * Math.max(0, 1 - it.age * 4));
          M.compose(P.set(it.x + Math.sin(it.age * 3 + it.sway) * 0.12, it.y + it.age * 0.55, it.z), Q.setFromEuler(E.set(0, yaw, Math.sin(it.age * 4 + it.sway) * 0.2)), S.set(s, s, s));
          p.mesh.setMatrixAt(n++, M);
        }
        p.mesh.count = n; p.mesh.visible = n > 0;
        if (n) p.mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

// ---- rings on the water (a quack, a leap, a splash): flat voxel rings that spread and fade -----------------------
function ringPool(THREE, group, V) {
  const pos = [], idx = [];
  const R0 = 3, N = 28;
  for (let i = 0; i < N; i += 1) { // a ring of small flat tiles
    const a = (i / N) * Math.PI * 2, x = Math.cos(a) * R0, z = Math.sin(a) * R0, v = pos.length / 3, h = 0.5;
    pos.push(x - h, 0, z - h, x + h, 0, z - h, x + h, 0, z + h, x - h, 0, z + h);
    idx.push(v, v + 2, v + 1, v, v + 3, v + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 24);
  mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false;
  for (let i = 0; i < 24; i += 1) mesh.setColorAt(i, new THREE.Color(0));
  group.add(mesh);
  let list = [];
  const M = new THREE.Matrix4(), C = new THREE.Color();
  return {
    spawn(x, y, z, colour = 0xffffff, life = 1, grow = 2) { if (list.length >= 24) list.shift(); list.push({ x, y, z, colour, life, grow, age: 0 }); },
    update(dt) {
      list = list.filter((r) => (r.age += dt) < r.life);
      list.forEach((r, i) => {
        const u = r.age / r.life, s = V * (0.6 + r.grow * u) * 0.9;
        mesh.setMatrixAt(i, M.makeScale(s, 1, s).setPosition(r.x, r.y, r.z));
        mesh.setColorAt(i, C.setHex(r.colour).multiplyScalar((1 - u) * 0.8));
      });
      mesh.count = list.length; mesh.visible = list.length > 0;
      if (list.length) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
    },
  };
}
