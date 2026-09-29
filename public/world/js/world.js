// The town: one walled cyber-medieval town on a coastal hill, each chapter of the 2D site's data.js a
// district on its own plot, joined by streets (the plan is js/town/plan.js). Visitors arrive at the sea gate
// in Gate Square; the top bar and the tour go round the town in the story's order. Click a landmark: Yuuv
// walks (or jogs, on a long trip) there by the streets, the camera following him, and the stop's own view
// settles in when he arrives. Click the ground or a street: he walks there. Click the sea: the whole town.
// Night by default.
//
// Districts are modules in js/districts/<id>.js (the contract is in DISTRICTS.md).
// index.html?district=<id> builds that district alone on its plot in the town, with Yuuv.
// All timing runs on the frame clock; nothing is re-meshed after load.
import * as THREE from 'three';
import { VOXEL as V } from './kit/voxel-kit.js';
import { createRigKit } from './kit/voxel-rig.js';
import { yuuv as yuuvDef } from './models/yuuv.js';
import { PLOTS, STREETS, ORDER, LAMPS, WALLS, COAST, KIND, raster, edgeOf, heightAt, kindAt } from './town/plan.js';
import { buildGround, lampTexture } from './town/ground.js';
import { buildWater } from './town/water.js';
import { placeBanners } from './town/banners.js';
import { createPlaces } from './walk.js';
import { createUI } from './ui.js';
import { stub } from './districts/stub.js';
import { profile, chapters } from '../../reel/data.js';

const NAMES = { hub: 'Gate Square', shipped: 'Workshop Quarter', research: 'Observatory', work: 'Sky Docks', education: 'Academy', more: 'Market', contact: 'Lighthouse' };
const CONTACT = { id: 'contact', title: 'Say hello', lede: 'Send me the messy problem. I like those.', items: [] }; // the 2D site's closing chapter
const PARAMS = new URLSearchParams(location.search);
const SOLO = PARAMS.get('district'); // the test harness: one district alone on its plot
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const IDS = SOLO ? [SOLO] : ORDER; // the story's order: the gate first
const chapterOf = (id) => (id === 'contact' ? CONTACT : chapters.find((c) => c.id === id) || { id, title: NAMES[id] || id, lede: '', items: [] });

// ---- the HTML layer first: everything readable before (or without) the 3D
let go = (id, item) => ui.show(id, item, true), home = () => ui.show(IDS[0], null, true); // until the town is built: the panel alone
const places0 = IDS.map((id) => ({ id, name: NAMES[id] || id, chapter: id === 'hub' ? null : chapterOf(id) }));
const ui = createUI({ profile, places: places0, onGo: (id, item) => go(id, item), onNight: () => setNight(!nightGoal), onHome: () => home() });
let night = PARAMS.has('day') ? 0 : 1, nightGoal = night;
function setNight(on) {
  nightGoal = on ? 1 : 0;
  if (REDUCED || !started) night = nightGoal;
  ui.setNight(Boolean(nightGoal));
}
let started = false;
setNight(Boolean(night));
document.documentElement.style.setProperty('--night', String(night));

const canvas = document.getElementById('world');
let renderer;
try {
  if (!document.createElement('canvas').getContext('webgl2')) throw new Error('no WebGL 2');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  canvas.hidden = true;
  document.getElementById('loading')?.remove();
  ui.status('The 3D town needs WebGL, which this browser has turned off. Everything is in the panel.');
  await new Promise(() => {}); // stop here quietly: the panel and links work without the scene
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x17143a, 60, 140);
const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 900);
const kit = createRigKit(THREE);
const t0 = performance.now();

// ---- halos: soft additive sprites on things that glow. Faint by day, a bloom by night.
const haloTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,0.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const halos = [];
function halo(parent, [x, y, z], size, color, strength = 1) {
  const m = new THREE.SpriteMaterial({ map: haloTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  const s = new THREE.Sprite(m);
  s.position.set(x, y, z);
  s.scale.set(size, size, 1);
  parent.add(s);
  halos.push({ s, m, strength });
  return s;
}

// ---- lamps: every lamp a district registers; the nearest few borrow one of a fixed pool of real lights
const lamps = [];
const POOL = 6;
const pool = Array.from({ length: POOL }, () => { const l = new THREE.PointLight(0xffffff, 0, 8, 1.6); scene.add(l); return l; });
let poolAt = -1;
function assignLights() {
  const at = cam.target;
  const near = lamps.filter((l) => l.on > 0).sort((a, b) => a.pos.distanceToSquared(at) / a.power - b.pos.distanceToSquared(at) / b.power).slice(0, POOL);
  pool.forEach((p, i) => { const l = near[i]; p.userData.lamp = l || null; if (l) { p.position.copy(l.pos); p.color.setHex(l.colour); p.distance = l.range; } });
}

// ---- videos: loaded the first time their screen comes near, played only while it is on screen and near
const videos = [];
function videoTexture(url, anchor) {
  const video = document.createElement('video');
  Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'none', crossOrigin: 'anonymous' });
  video.setAttribute('playsinline', '');
  const tex = new THREE.VideoTexture(video);
  tex.colorSpace = THREE.SRGBColorSpace;
  videos.push({ video, url, anchor, loaded: false });
  return tex;
}
const frustum = new THREE.Frustum(), projView = new THREE.Matrix4(), tmp = new THREE.Vector3();
const shown = (o) => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; };
function syncVideos() {
  for (const v of videos) {
    v.anchor.getWorldPosition(tmp);
    // near: a close view (whatever the screen size) with the screen in frame and within reach of what the camera looks at
    const near = shown(v.anchor) && cam.fit < 12 && frustum.containsPoint(tmp) && tmp.distanceTo(cam.target) < 11;
    if (near) {
      if (!v.loaded) { v.video.src = v.url; v.loaded = true; }
      if (v.video.paused) v.video.play().catch(() => {});
    } else if (!v.video.paused) v.video.pause();
  }
}

// ---- the clock: timers for districts (cancelled when the visitor goes elsewhere)
let clock = 0, trip = 0;
const timers = [];
function after(seconds, run) { const my = trip; timers.push({ at: clock + seconds, run: () => { if (my === trip) run(); } }); }

// ---- Yuuv
const yuuv = kit.rig('yuuv', yuuvDef);
scene.add(yuuv.group);
const band = new THREE.PointLight(0x9fe8ff, 0, 4.5, 1.4); // his wristband's glow, so he never goes to a silhouette at night
band.position.set(0.4, 2.4, 1.2);
yuuv.group.add(band);
halo(yuuv.parts.foreL, [5, 8.5, 0.5], 4, 0x6ff2ff, 0.8);

// ---- the cyber props (clouds, data orbs, cables, holo signs, rune stones), if they are there
const fx = await import('./models/fx.js').catch((e) => { console.warn('fx props unavailable:', e.message); return null; });

// ---- the districts, each on its plot in the plan
const mods = await Promise.all(IDS.map(async (id) => {
  try { return (await import(`./districts/${id}.js`)).default; } catch (e) {
    console.warn(`district "${id}" did not load, so a placeholder stands in:`, e.message);
    return stub(id, NAMES[id] || id, { A: 56, B: 50, seed: 9 });
  }
}));
mods.forEach((m, i) => ui.setPlace(IDS[i], { name: IDS[i] === 'hub' ? null : m.title, lede: m.lede }));
const R = raster();
const districts = mods.map((m, i) => {
  const id = IDS[i], plot = PLOTS[id] || { c: [0, 0], A: 56, B: 50, seed: 9, y: 46, entries: [[0, 7]] };
  const isl = { ...(m.island || {}), A: plot.A, B: plot.B, seed: plot.seed };
  if (m.island && (m.island.A !== plot.A || m.island.B !== plot.B)) console.warn(`district "${id}": its island is ${m.island.A} x ${m.island.B} but its plot is ${plot.A} x ${plot.B} (js/town/plan.js)`);
  return {
    id, mod: m, isl, plot, edge: edgeOf(plot.A, plot.B, plot.seed), chapter: id === 'hub' ? null : chapterOf(id),
    cx: plot.c[0], cz: plot.c[1], y: plot.y * V, dock: plot.entries[0], docks: plot.entries, rigs: [], casters: [],
  };
});
const byId = Object.fromEntries(districts.map((d) => [d.id, d]));
const hubD = byId.hub || null;
const LOOK = 0.45; // the overview's yaw

// ---- building each district: its env, its landmarks
const places = createPlaces({ heightAt: (x, z, at) => groundAt(x, z, at) });
const castOn = (o, on) => o.traverse((m) => { if (m.isMesh && m.userData.caster) m.castShadow = on; });
function prepare(group, d) {
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.isMeshLambertMaterial) o.receiveShadow = true;
    if (o.castShadow) { o.userData.caster = true; o.castShadow = false; } // off until its district has the focus
  });
  if (d) d.casters.push(group);
}
const local = (d, [x, z]) => [x + d.cx, z + d.cz];
const toVoxels = (p) => (p ? [p[0] / V, p[1] / V] : null);
function makeEnv(d) {
  return {
    id: d.id, THREE, kit, V, profile, chapters, chapter: d.chapter, yuuv, fx,
    night: () => night,
    dock: d.dock, docks: d.docks,
    plot: { A: d.plot.A, B: d.plot.B, y: d.y, entries: d.docks, cliff: d.plot.cliff || null },
    place(key, def, [x, z], ry = 0) {
      const r = kit.rig(key, def);
      r.group.position.set(x, 0, z);
      r.group.rotation.y = ry;
      d.root.add(r.group);
      prepare(r.group, d);
      d.rigs.push(r);
      return r;
    },
    halo,
    light([x, y, z], colour, power = 5, range = 8) { const l = { pos: new THREE.Vector3(x + d.cx, y + d.y, z + d.cz), colour, power, range, on: 1 }; lamps.push(l); return l; },
    videoTexture,
    walk: (p, then) => walkTo(local(d, p), then),
    face: (f) => faceTo(f === 'camera' ? f : local(d, f)),
    after,
  };
}
const timing = {};
const spotOf = (s) => (typeof s.spot === 'function' ? s.spot() : s.spot);
for (const d of districts) {
  const tb = performance.now();
  d.root = new THREE.Group();
  d.root.position.set(d.cx, d.y, d.cz);
  scene.add(d.root);
  d.env = makeEnv(d);
  let out;
  try { out = d.mod.build(d.env, d.chapter) || {}; } catch (e) {
    console.warn(`district "${d.id}" failed to build, so a placeholder stands in:`, e.message);
    d.root.clear(); d.rigs = []; d.casters = [];
    d.mod = stub(d.id, NAMES[d.id] || d.id, d.isl);
    out = d.mod.build(d.env, d.chapter);
  }
  if (out.group) { d.root.add(out.group); prepare(out.group, d); }
  d.out = out;
  if (out.panel) ui.setPlace(d.id, { panel: out.panel });
  d.stops = out.stops || {};
  if (!d.stops.main) d.stops.main = { spot: [0, 0], face: 'camera' };
  d.targets = (out.targets || []).map((t) => ({ ...t, d }));
  // its ground: its own paths (or one from its entry to its main stop), plazas and flags, painted into the town
  const ctx = { dock: toVoxels(d.dock), docks: d.docks.map(toVoxels) };
  d.isl.paths = typeof d.isl.paths === 'function' ? d.isl.paths(ctx) : d.isl.paths || [[toVoxels(d.dock), toVoxels(spotOf(d.stops.main))]];
  const walkEdge = 1 - 1 / (Math.min(d.isl.A, d.isl.B) * V);
  d.isle = places.addIsle(d.id, (x, z) => d.edge((x - d.cx) / V, (z - d.cz) / V) < walkEdge && kindAt(x, z) === KIND.PLOT); // (a canal may cut a plot's margin)
  places.setBoxes(d.isle, (out.colliders || []).map(([x0, z0, x1, z1]) => [x0 + d.cx, z0 + d.cz, x1 + d.cx, z1 + d.cz]));
  d.sphere = new THREE.Sphere(new THREE.Vector3(d.cx, d.y + 2, d.cz), Math.hypot(d.isl.A, d.isl.B) * V * 0.8 + 6);
  timing[d.id] = Math.round(performance.now() - tb);
}
const real = districts;

// ---- the town: its ground in chunks, its water, its street lamps (glowing lanterns, a baked pool of light
// under each at night, one sprite cloud for their halos), and the walking graph over its streets
const tt = performance.now();
const ground = await buildGround(THREE, { plots: Object.fromEntries(districts.map((d) => [d.id, d.isl])) });
scene.add(ground.group);
const water = buildWater(THREE);
scene.add(water.group);
const lampLight = lampTexture(THREE, LAMPS.map((l) => ({ at: [l.at[0] + l.arm[0] * 0.45, l.at[1] + l.arm[1] * 0.45], y: l.y, r: 3.6 })));
Object.assign(ground.material.userData.uniforms, { uLampMap: { value: lampLight.tex }, uLampRect: { value: lampLight.rect } });
const lampHalos = (() => {
  const pos = new Float32Array(LAMPS.length * 3);
  LAMPS.forEach((l, i) => { const n = (Math.floor(l.at[1] / V) - R.k0) * R.nx + (Math.floor(l.at[0] / V) - R.i0), y0 = R.kind[n] === KIND.BRIDGE ? R.deck[n] : R.top[n]; pos.set([l.at[0] + l.arm[0] * 0.45, (y0 + 21.5) * V, l.at[1] + l.arm[1] * 0.45], i * 3); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ map: haloTex, color: 0xffb35c, size: 2.4, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  p.name = 'lamp-halos';
  scene.add(p);
  return p;
})();
STREETS.forEach((s) => places.addStreet(s.id, s.pts.map(([x, z]) => [x, z]), s.w / 2));
for (const d of districts) for (const e of d.docks) places.addEntry(d.isle, local(d, e));
const banners = placeBanners(THREE, kit);
scene.add(banners.group);
// the street lamps' lanterns can borrow a real light too when the camera is near them (softly: the ground has their pools)
for (const l of LAMPS) { const n = (Math.floor(l.at[1] / V) - R.k0) * R.nx + (Math.floor(l.at[0] / V) - R.i0), y0 = R.kind[n] === KIND.BRIDGE ? R.deck[n] : R.top[n]; lamps.push({ pos: new THREE.Vector3(l.at[0] + l.arm[0] * 0.45, (y0 + 20) * V, l.at[1] + l.arm[1] * 0.45), colour: 0xffb35c, power: 1.6, range: 5, on: 1 }); }
const townMs = Math.round(performance.now() - tt);
// the ground under a point: a plot's level, a street's height along it, or the land's own top
function groundAt(x, z, at = places.locate([x, z])) {
  if (at && at.isle !== undefined) return real[at.isle].y;
  if (at && at.street !== undefined) { const s = STREETS[at.street], a = s.pts[at.seg], b = s.pts[at.seg + 1]; return (a[2] + (b[2] - a[2]) * at.t) * V; }
  return topAt(x, z);
}
const topAt = heightAt;

// ---- the town's life, in layers: js/town/houses.js (homes, shops and street props) and js/town/nature.js (plants and
// animals). Each default-exports { build(env) } returning { group?, update?(dt, t, night), targets?: [{ object, label?,
// spot?: [x, z] (walk there first), on?(yuuv, env) }] }. A layer that is missing or fails is skipped. See DISTRICTS.md.
const layers = [];
for (const id of ['houses', 'nature']) {
  const mod = await import(`./town/${id}.js`).then((m) => m.default).catch((e) => { if (!/Failed to fetch|404|Cannot find/.test(e.message)) console.warn(`town layer "${id}" did not load:`, e.message); return null; });
  if (!mod) continue;
  const tl = performance.now();
  const env = {
    THREE, kit, V, profile, yuuv, halo, after, camera,
    night: () => night, cam: () => cam, groundAt: (x, z) => groundAt(x, z), R,
    plan: { PLOTS, STREETS, ORDER, LAMPS, WALLS, COAST, KIND, heightAt, kindAt },
    light([x, y, z], colour, power = 5, range = 8) { const l = { pos: new THREE.Vector3(x, y, z), colour, power, range, on: 1 }; lamps.push(l); return l; },
    walk: (p, then) => walkTo(p, then), face: (f) => faceTo(f),
  };
  try {
    const out = mod.build(env) || {};
    if (out.group) { scene.add(out.group); prepare(out.group, null); }
    layers.push({ id, env, ...out, targets: (out.targets || []).map((t) => ({ ...t, layer: id })) });
  } catch (e) { console.warn(`town layer "${id}" failed to build:`, e.message); }
  timing[id] = Math.round(performance.now() - tl);
}
const buildMs = Math.round(performance.now() - t0);

// ---- light: a sun and sky by day, a moon and lamps by night
const hemi = new THREE.HemisphereLight(0xdfeeff, 0x6d6450, 1.2);
const sun = new THREE.DirectionalLight(0xfff0d6, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(hemi, sun, sun.target);
const stars = (() => {
  const n = 600, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    const u = ((i * 0.618034) % 1) * 2 - 1, a = i * 2.39996, r = 700, s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * r, Math.abs(u) * r * 0.9 + 20, Math.sin(a) * s * r], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  p.frustumCulled = false;
  scene.add(p);
  return p;
})();
// the moon, low in the sky behind the hill (its path of glints lies on the sea below it)
const MOON = new THREE.Vector3(-Math.sin(LOOK) * 0.72, 0.62, -Math.cos(LOOK) * 0.72).normalize();
const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0xeef3ff, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
moon.scale.set(60, 60, 1);
moon.frustumCulled = false;
scene.add(moon);
const DAY = { sky: 0xdfeeff, ground: 0x6d6450, hemi: 1.25, sun: 0xfff0d6, sunI: 2.5, sunAt: [10, 17, 12], fog: 0xcfe6f3 };
const NIGHT = { sky: 0x7682c8, ground: 0x2e2648, hemi: 1.05, sun: 0xb2c4ff, sunI: 1.25, sunAt: [-7, 14, 11], fog: 0x17143a }; // the moon: south-west, so the faces we look at catch it
const ca = new THREE.Color(), cb = new THREE.Color();
const mix = (a, b, k) => ca.setHex(a).lerp(cb.setHex(b), k);
function applyLight(k) {
  hemi.color.copy(mix(DAY.sky, NIGHT.sky, k));
  hemi.groundColor.copy(mix(DAY.ground, NIGHT.ground, k));
  hemi.intensity = DAY.hemi + (NIGHT.hemi - DAY.hemi) * k;
  sun.color.copy(mix(DAY.sun, NIGHT.sun, k));
  sun.intensity = DAY.sunI + (NIGHT.sunI - DAY.sunI) * k;
  scene.fog.color.copy(mix(DAY.fog, NIGHT.fog, k));
  stars.material.opacity = k;
  moon.material.opacity = k;
  ground.material.userData.uniforms.uNight.value = k;
  document.documentElement.style.setProperty('--night', k.toFixed(3));
}
applyLight(night);

// ---- camera: views are { target, yaw, pitch, fit } in world units, fit the half-size to keep in view
const toView = (d, v) => ({ target: new THREE.Vector3(v.target[0] + d.cx, v.target[1] + d.y, v.target[2] + d.cz), yaw: v.yaw ?? LOOK, pitch: v.pitch ?? 0.7, fit: v.fit ?? 8, d });
const mainView = (d) => (d.stops.main.view ? toView(d, d.stops.main.view) : toView(d, { target: [0, 1.4, 0], yaw: LOOK, pitch: 0.78, fit: Math.max(d.isl.A, d.isl.B) * V * 1.05 }));
// The points the overview keeps on screen: the walls, every plot's rim, the point, the airships off the cliff.
const townPoints = (() => {
  const pts = [];
  pts.coast = [];
  for (const w of WALLS) for (const [x, z] of w.pts) pts.push(new THREE.Vector3(x, topAt(x, z) + 1, z));
  for (const p of Object.values(PLOTS)) for (let i = 0; i < 16; i += 1) { const a = (i / 16) * Math.PI * 2; pts.push(new THREE.Vector3(p.c[0] + Math.cos(a) * p.A * V, p.y * V, p.c[1] + Math.sin(a) * p.B * V)); }
  COAST.forEach(([x, z], i) => { if (i % 3 === 0) pts.coast.push(new THREE.Vector3(x, 0, z)); });
  const w = PLOTS.work;
  pts.push(new THREE.Vector3(w.c[0] + w.A * V + 7, (w.y + 20) * V, w.c[1]), new THREE.Vector3(w.c[0] + w.A * V + 4, (w.y + 20) * V, w.c[1] + 9));
  return pts;
})();
const OVERVIEW = (() => {
  if (SOLO) return mainView(real[0]);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of townPoints) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  return { target: new THREE.Vector3((x0 + x1) / 2, 5, (z0 + z1) / 2), yaw: LOOK, pitch: 0.9, fit: 60, d: null, auto: true };
})();
// The middle of a plot's rim on the side nearest the camera, where its tag sits (worked out once).
const rim = (d, dx, dz) => { let r = 0; while (r < 600 && d.edge(dx * r, dz * r) < 1) r += 0.5; return r * V; };
const frontOf = (d) => (d.front ||= ((r) => [d.cx + Math.sin(LOOK) * r, d.cz + Math.cos(LOOK) * r])(rim(d, Math.sin(LOOK), Math.cos(LOOK)) * 0.92));
// The smallest fit that keeps `points` inside the free part of the screen, found by halving.
function fitFor(v, points) {
  const keep = { target: cam.target.clone(), yaw: cam.yaw, pitch: cam.pitch, fit: cam.fit };
  cam.target.copy(v.target); cam.yaw = v.yaw; cam.pitch = v.pitch;
  let lo = 2, hi = 400;
  for (let i = 0; i < 24; i += 1) {
    cam.fit = (lo + hi) / 2;
    placeCamera();
    camera.updateMatrixWorld();
    const ok = points.every((p) => {
      tmp.copy(p).project(camera);
      const x = ((tmp.x + 1) / 2) * W, y = ((1 - tmp.y) / 2) * H;
      return tmp.z < 1 && x > free.left + 14 && x < free.right - 14 && y > free.top + 34 && y < free.bottom - 30; // room for a tag at the bottom
    });
    if (ok) hi = cam.fit; else lo = cam.fit;
  }
  Object.assign(cam, { yaw: keep.yaw, pitch: keep.pitch, fit: keep.fit });
  cam.target.copy(keep.target);
  return hi;
}
// The overview: the fit that keeps `points` in view, its target moved until they sit in the middle of the free screen.
function frameOverview(points) {
  for (let pass = 0; pass < 3; pass += 1) {
    OVERVIEW.fit = fitFor(OVERVIEW, points);
    const keep = { target: cam.target.clone(), yaw: cam.yaw, pitch: cam.pitch, fit: cam.fit };
    Object.assign(cam, { yaw: OVERVIEW.yaw, pitch: OVERVIEW.pitch, fit: OVERVIEW.fit }); cam.target.copy(OVERVIEW.target);
    placeCamera(); camera.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of points) { tmp.copy(p).project(camera); const x = ((tmp.x + 1) / 2) * W, y = ((1 - tmp.y) / 2) * H; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const per = (2 * distFor(cam.fit) * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / H; // units a pixel at the target
    const dx = (x0 + x1) / 2 - (free.left + free.right) / 2, dy = (y0 + y1) / 2 - (free.top + 34 + free.bottom - 30) / 2;
    OVERVIEW.target.x += (Math.cos(LOOK) * dx - Math.sin(LOOK) * (-dy / Math.sin(OVERVIEW.pitch))) * per;
    OVERVIEW.target.z += (-Math.sin(LOOK) * dx - Math.cos(LOOK) * (-dy / Math.sin(OVERVIEW.pitch))) * per;
    Object.assign(cam, { yaw: keep.yaw, pitch: keep.pitch, fit: keep.fit }); cam.target.copy(keep.target);
  }
  OVERVIEW.fit = fitFor(OVERVIEW, points);
}
const cam = { target: OVERVIEW.target.clone(), yaw: OVERVIEW.yaw, pitch: OVERVIEW.pitch, fit: OVERVIEW.fit };
let view = OVERVIEW;
let follow = null; // { to: the stop's view } while Yuuv is on a long trip
const live = { target: new THREE.Vector3(), yaw: LOOK, pitch: 0.62, fit: 6.8, d: null };
// The play camera stays close on Yuuv wherever he goes, so it is clear who you're steering. A trip to one of the
// portfolio's stops hands over to that stop's own close view as he arrives; wide views only come when asked for (the
// Town button, Escape, or zooming out). `zoom` is the visitor's own scroll or pinch, scaling every close view.
const FOLLOW_FIT = 6.8, CLOSE = 10;
let zoom = 1, intro = 0;
// The visitor's own angle, from dragging: a turn round Yuuv (kept for the rest of the visit) and a tilt. Panning moves
// the camera off him into `roam`, a free view, until the next walk (or the Back to Yuuv button) brings it back.
const orbit = { yaw: 0, pitch: 0.62, manual: false };
const roam = { target: new THREE.Vector3(), yaw: LOOK, pitch: 0.62, fit: FOLLOW_FIT, d: null };
function followYuuv() { view = live; follow = null; intro = 0; if (REDUCED) snap(); }

// ---- feedback: a ring under Yuuv (and an arrow over him from afar) says he's the one you steer; a yellow ring pops
// where you click and waits there until he arrives; a note over him says so the first time
const flatMat = (colour, o, over = false) => new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: o, depthWrite: false, depthTest: !over, toneMapped: false, fog: false });
const flat = (g) => g.rotateX(-Math.PI / 2);
const you = new THREE.Mesh(flat(new THREE.RingGeometry(0.6, 0.74, 48)), flatMat(0x6ff2ff, 0.5));
const youArrow = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.72, 4).rotateX(Math.PI), flatMat(0x6ff2ff, 0.95, true));
const markMat = flatMat(0xffc56b, 0);
const mark = new THREE.Group();
mark.add(new THREE.Mesh(flat(new THREE.RingGeometry(0.34, 0.48, 40)), markMat), new THREE.Mesh(flat(new THREE.CircleGeometry(0.11, 20)), markMat));
const ping = new THREE.Mesh(flat(new THREE.RingGeometry(0.42, 0.5, 40)), flatMat(0xffe3a8, 0));
for (const o of [you, youArrow, mark, ping]) { o.renderOrder = 6; o.visible = o === you; scene.add(o); }
let markT = 0, markOut = -1, pingT = 0;
function markAt([x, z]) { mark.position.set(x, groundAt(x, z) + 0.07, z); ping.position.copy(mark.position); mark.visible = ping.visible = true; markT = pingT = clock; markOut = -1; }
const hintEl = Object.assign(document.createElement('p'), { className: 'hint', textContent: `This is you. ${matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click'} anywhere to walk, drag to look around.` });
const backEl = Object.assign(document.createElement('button'), { type: 'button', className: 'pill back-to', textContent: 'Back to Yuuv' });
backEl.hidden = true;
backEl.addEventListener('click', () => followYuuv());
document.body.append(backEl);
hintEl.setAttribute('aria-hidden', 'true');
document.body.append(hintEl);
let hintOn = false, walked = false;
try { walked = sessionStorage.getItem('yj-walked') === '1'; } catch (e) { /* storage blocked: the note shows once per visit */ }
function hint(on) {
  if (on && walked) return;
  if (!on && hintOn) { walked = true; try { sessionStorage.setItem('yj-walked', '1'); } catch (e) { /* fine */ } }
  hintOn = on;
  hintEl.classList.toggle('on', on);
}
const scr = new THREE.Vector3();
function onScreen(v, lift = 0) { scr.set(v.x, v.y + lift, v.z).project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + ((scr.x + 1) / 2) * r.width, y: r.top + ((1 - scr.y) / 2) * r.height, in: scr.z < 1 && Math.abs(scr.x) < 1 && Math.abs(scr.y) < 1 }; }
const easeBack = (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;
function markers(p) {
  const far = Math.max(1, cam.fit / 9); // grow with the view so they stay readable from further out
  you.position.set(p.x, p.y + 0.05, p.z);
  you.scale.setScalar(Math.min(2.4, far) * (1 + 0.05 * Math.sin(clock * 3)));
  you.material.opacity = (hintOn ? 0.55 : 0.32) + 0.18 * Math.sin(clock * 3);
  youArrow.visible = cam.fit > 14;
  if (youArrow.visible) { const s = cam.fit / 14; youArrow.scale.setScalar(s); youArrow.position.set(p.x, p.y + 3.2 + s * 0.9 + Math.sin(clock * 3.2) * 0.22 * s, p.z); youArrow.rotation.y = clock * 1.4; }
  if (mark.visible) {
    if (!walker.path.length && markOut < 0) markOut = clock; // he's there: the ring goes
    const age = clock - markT;
    let sc = (0.35 + 0.65 * easeBack(Math.min(1, age / 0.22))) * (1 + 0.07 * Math.sin(age * 6)) * Math.min(2.4, far), o = 0.95;
    if (markOut >= 0) { const f = Math.min(1, (clock - markOut) / 0.3); o *= 1 - f; sc *= 1 - 0.4 * f; if (f >= 1) mark.visible = false; }
    mark.scale.setScalar(sc); markMat.opacity = o;
  }
  if (ping.visible) { const f = Math.min(1, (clock - pingT) / 0.55); ping.scale.setScalar((0.6 + 2.4 * f) * Math.min(2.4, far)); ping.material.opacity = 0.85 * (1 - f); if (f >= 1) ping.visible = false; }
  if (hintOn) { const at = onScreen(p, 3.1); hintEl.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) translate(-50%, -100%)`; hintEl.classList.toggle('on', at.in); }
  quests.tick();
  bubbleTick();
  backEl.hidden = view !== roam;
  if (!backEl.hidden) { backEl.style.left = `${((free.left + free.right) / 2).toFixed(0)}px`; backEl.style.top = `${(free.bottom - 58).toFixed(0)}px`; }
}
let free = { left: 0, top: 0, right: 1, bottom: 1 }, W = 1, H = 1;
const distFor = (fit) => {
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const fw = free.right - free.left, fh = free.bottom - free.top;
  return (fit * H * (fw < fh ? 0.86 : 1)) / (tv * Math.max(80, Math.min(fw, fh))); // a portrait screen lets the edge crop a little
};
function goView(v) {
  view = v;
  follow = null;
  if (REDUCED) snap();
}
const snap = () => { cam.target.copy(view.target); cam.yaw = view.yaw; cam.pitch = view.pitch; cam.fit = view.fit; };
function placeCamera() {
  const d = distFor(cam.fit);
  camera.position.set(cam.target.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * d, cam.target.y + Math.sin(cam.pitch) * d, cam.target.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * d);
  camera.lookAt(cam.target);
  camera.near = Math.max(0.5, d * 0.04);
  camera.far = d + 1400;
  camera.updateProjectionMatrix();
  scene.fog.near = d + cam.fit * 0.4;
  scene.fog.far = d + cam.fit * 3.2 + 60;
}

// ---- walking
const WALK = 2.6; // units a second at pace 1 (the stride is tuned to it); a jog is pace 2 to 2.5
const walker = { path: [], then: null, heading: Math.PI, pace: 1, speed: 0 };
function startWalk(path, then) {
  const p = yuuv.group.position, len = places.length([p.x, p.z], path);
  walker.path = path;
  walker.then = then;
  walker.len = len;
  walker.pace = len > 18 ? 2.5 : len > 8 ? 2 : 1;
  yuuv.ctx.mem.pace = walker.pace;
  return len;
}
function walkTo([x, z], then = null) { const p = yuuv.group.position; return startWalk(places.plan([p.x, p.z], [x, z]), then); }
function faceTo(f) {
  const p = yuuv.group.position;
  const [tx, tz] = f === 'camera' ? [camera.position.x, camera.position.z] : f;
  walker.heading = Math.atan2(tx - p.x, tz - p.z);
}
const turnTo = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
const districtAt = (x, z) => { const at = places.locate([x, z]); return at && at.isle !== undefined ? real[at.isle] : null; };

// A trip to a stop: walk there (the camera follows a long trip), face, then the stop's own moment.
let current = { d: null, stop: null };
function visit(d, stopId) {
  trip += 1;
  const stop = d.stops[stopId] || d.stops.main;
  current = { d, stop: d.stops[stopId] ? stopId : 'main' };
  const to = stop.view && (stop.view.fit ?? 8) <= CLOSE ? toView(d, stop.view) : null;
  for (const q of quests) if (q.d === d && q.stop === current.stop && !q.done) { q.done = true; q.doneAt = clock; }
  const at = current.stop;
  const len = walkTo(reachable(d, local(d, spotOf(stop))), () => { if (stop.face) faceTo(stop.face === 'camera' ? 'camera' : local(d, stop.face)); stop.on?.(yuuv.ctx, d.env); if (isItem(d, at)) sayItem(d, at); });
  markAt(walker.path.length ? walker.path[walker.path.length - 1] : [yuuv.group.position.x, yuuv.group.position.z]);
  if (!to) followYuuv();
  else if (len > 12 && !REDUCED) { followYuuv(); follow = { to }; } else goView(to);
}
const isItem = (d, id) => Boolean(d.chapter && d.chapter.items.some((it) => it.id === id));
// A spot off the walkable ground (past the rim's margin) is drawn in toward its plot's middle until it is on it.
function reachable(d, [x, z]) {
  for (let k = 0; k < 60 && !places.walkable([x, z]); k += 1) { x = d.cx + (x - d.cx) * 0.97; z = d.cz + (z - d.cz) * 0.97; }
  return [x, z];
}
go = (placeId, itemId) => {
  const d = byId[placeId];
  hint(false);
  ui.show(placeId, itemId, true);
  if (!d) return;
  visit(d, itemId && d.stops[itemId] ? itemId : 'main');
};
home = () => { ui.show(IDS[0], null, true); overview(); };
function overview() { trip += 1; intro = 0; goView(OVERVIEW); }

// ---- clicks: Yuuv reacts, a landmark is visited, ground is walked to, the sea goes home
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const allTargets = () => real.flatMap((d) => d.targets).concat(layers.flatMap((l) => l.targets));
function aim(px, py) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
function pick() {
  let best = null;
  for (const t of allTargets()) {
    if (!shown(t.object)) continue;
    const hit = ray.intersectObject(t.object, true).find((h) => !h.object.isSprite && shown(h.object));
    if (hit && (!best || hit.distance < best.distance)) best = { ...t, distance: hit.distance };
  }
  return best;
}
// Where the ray meets the town: a march over the land's heights, then a few halvings. Null over the sea.
function hitGround() {
  const o = ray.ray.origin, dir = ray.ray.direction, p = new THREE.Vector3();
  let prev = 0;
  for (let t = 0.5; t < 1400; t += Math.max(0.12, t * 0.004)) {
    p.copy(o).addScaledVector(dir, t);
    if (p.y <= topAt(p.x, p.z)) {
      let lo = prev, hi = t;
      for (let k = 0; k < 12; k += 1) { const m = (lo + hi) / 2; p.copy(o).addScaledVector(dir, m); if (p.y <= topAt(p.x, p.z)) hi = m; else lo = m; }
      p.copy(o).addScaledVector(dir, hi);
      const i = Math.floor(p.x / V) - R.i0, k = Math.floor(p.z / V) - R.k0, n = k * R.nx + i;
      return i < 0 || k < 0 || i >= R.nx || k >= R.nz || R.kind[n] === KIND.SEA ? null : p;
    }
    prev = t;
    if (p.y < -1) return null;
  }
  return null;
}
function clickAt(px, py) {
  aim(px, py);
  hint(false);
  if (ray.intersectObject(yuuv.group, true).some((h) => !h.object.isSprite)) { yuuv.ctx.play('poke'); say(yuuvHead, [tag('h3', '', 'Hi, I\'m Yuuv.'), tag('p', 'b', `${matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click'} anywhere and I'll walk there.`)], { seconds: 3, small: true }); return 'yuuv'; }
  const t = pick();
  if (t && t.layer) {
    // a house, a tree, an animal: its own little moment, with Yuuv walking over first if it asks for that
    const l = layers.find((x) => x.id === t.layer);
    if (t.label) { const b = new THREE.Box3().setFromObject(t.object), top = b.getCenter(new THREE.Vector3()).setY(b.max.y + 0.25); say(() => top, [tag('h3', '', t.label)], { seconds: 2.6, small: true }); }
    if (t.spot) { trip += 1; const at = places.nearest(t.spot); walkTo(at, () => t.on?.(yuuv.ctx, l.env)); markAt(at); followYuuv(); } else t.on?.(yuuv.ctx, l.env);
    return `life:${t.layer}`;
  }
  if (t) {
    const stop = t.d.stops[t.stop] ? t.stop : 'main';
    ui.show(t.d.id, isItem(t.d, stop) ? stop : null);
    visit(t.d, stop);
    return `target:${t.d.id}:${stop}`;
  }
  const hit = hitGround();
  if (hit) {
    trip += 1;
    const goal = places.nearest([hit.x, hit.z]), d = districtAt(...goal);
    walkTo(goal);
    markAt(goal);
    if (d && ui.shown().place !== d.id) ui.show(d.id);
    followYuuv();
    return d ? `ground:${d.id}` : 'street';
  }
  return 'sea';
}
let down = null, pinched = false, dragging = null;
const touches = new Map();
const spread = () => { const [a, b] = [...touches.values()]; return b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0; };
const middle = () => { const [a, b] = [...touches.values()]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
const zoomBy = (f) => { zoom = Math.max(0.55, Math.min(7, zoom * f)); };
// into the free view, from wherever the camera is now (the same picture, so nothing jumps)
function roamFrom() {
  if (view === roam) return;
  roam.target.copy(cam.target); roam.yaw = cam.yaw; roam.pitch = cam.pitch; roam.fit = view === OVERVIEW ? cam.fit : cam.fit / zoom;
  view = roam; follow = null; intro = 0;
}
// turn: sideways round the middle of the view, up and down to tilt; the world follows the pointer
function turnBy(dx, dy) {
  const dyaw = -dx * 0.006, tilt = (x) => Math.max(0.22, Math.min(1.42, x + dy * 0.004));
  intro = 0;
  if (view === live) {
    if (!orbit.manual) { orbit.manual = true; orbit.pitch = live.pitch; orbit.yaw += sightAt[0]; } // start from the angle on screen, including any swing past a wall
    orbit.yaw += dyaw; orbit.pitch = tilt(orbit.pitch);
    live.yaw += dyaw; live.pitch = orbit.pitch; sightAt = [0, orbit.pitch]; sightT = clock + 0.3;
  } else { roamFrom(); roam.yaw += dyaw; roam.pitch = tilt(roam.pitch); }
  cam.yaw += dyaw; cam.pitch = view.pitch;
}
// pan: the ground under the pointer moves with it
function panBy(dx, dy) {
  if (!dx && !dy) return;
  roamFrom();
  const per = (2 * distFor(cam.fit) * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / H, along = per / Math.max(0.35, Math.sin(cam.pitch));
  const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
  const mx = -dx * per * cy - dy * along * sy, mz = dx * per * sy - dy * along * cy;
  const x = Math.max(R.i0 * V, Math.min((R.i0 + R.nx) * V, roam.target.x + mx)), z = Math.max(R.k0 * V, Math.min((R.k0 + R.nz) * V, roam.target.z + mz));
  cam.target.x += x - roam.target.x; cam.target.z += z - roam.target.z;
  roam.target.set(x, groundAt(x, z) + 1.3, z);
}
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  touches.set(e.pointerId, [e.clientX, e.clientY]);
  canvas.setPointerCapture?.(e.pointerId);
  if (touches.size > 1) { pinched = true; down = null; dragging = null; return; }
  down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, pan: e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey };
});
canvas.addEventListener('pointermove', (e) => {
  if (!touches.has(e.pointerId)) return;
  if (touches.size > 1) { // two fingers: apart or together to zoom, moved together to pan
    const before = spread(), m0 = middle();
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    const after = spread(), m1 = middle();
    if (before > 0 && after > 0) zoomBy(before / after);
    panBy(m1[0] - m0[0], m1[1] - m0[1]);
    return;
  }
  touches.set(e.pointerId, [e.clientX, e.clientY]);
  if (!down) return;
  if (!dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { dragging = down.pan ? 'pan' : 'turn'; canvas.style.cursor = 'grabbing'; }
  if (dragging === 'pan') panBy(e.clientX - down.lx, e.clientY - down.ly); else if (dragging) turnBy(e.clientX - down.lx, e.clientY - down.ly);
  down.lx = e.clientX; down.ly = e.clientY;
});
const lift = (e) => { touches.delete(e.pointerId); if (!touches.size) setTimeout(() => { if (!touches.size) pinched = false; }, 0); };
canvas.addEventListener('pointerup', (e) => {
  if (down && !pinched && !dragging && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) clickAt(e.clientX, e.clientY);
  if (dragging) canvas.style.cursor = '';
  down = null; dragging = null; lift(e);
});
canvas.addEventListener('pointercancel', (e) => { down = null; dragging = null; lift(e); });
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomBy(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0016))); }, { passive: false });
// hover: name what is under the pointer (mouse only, a few times a second)
let hoverAt = null;
canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') hoverAt = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerleave', () => { hoverAt = null; ui.tip(''); canvas.style.cursor = ''; });
let hoverT = 0;
function hover() {
  if (!hoverAt || clock - hoverT < 0.12) return;
  hoverT = clock;
  aim(...hoverAt);
  const t = pick();
  if (dragging) return;
  ui.tip(t ? t.label || '' : '', hoverAt[0], hoverAt[1]);
  canvas.style.cursor = t ? 'pointer' : '';
}
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !e.target.closest?.('input, textarea')) home(); });

// ---- the frame
let shadowFocus = undefined;
function setFocus(d) {
  if (d === shadowFocus) return;
  for (const x of districts) for (const g of x.casters) castOn(g, x === d);
  castOn(yuuv.group, Boolean(d));
  shadowFocus = d;
}
yuuv.group.traverse((m) => { if (m.isMesh && m.castShadow) m.userData.caster = true; });
let syncT = 0, inT = -1, yuuvIn = null;
const DETAIL = 30; // units from what the camera looks at within which the ground's small growing things are drawn
const chunkAt = ground.chunks.map((c) => { c.geometry.boundingBox.getCenter(tmp); return new THREE.Vector3().copy(tmp).multiplyScalar(V).add(c.position); });
function step(dt) {
  clock += dt;
  for (const due of timers.filter((x) => x.at <= clock)) { timers.splice(timers.indexOf(due), 1); due.run(); }
  // walk: brisk, easing in and out; up and down the streets' ramps and stairs
  const p = yuuv.group.position;
  let moving = false;
  if (walker.path.length) {
    const left = places.length([p.x, p.z], walker.path);
    const boost = 1 + Math.min(0.6, Math.max(0, walker.len - 28) / 45); // the longest trips lengthen his stride a little
    const want = Math.min(WALK * walker.pace * boost, 1.6 + left * 3);
    walker.speed = Math.min(want, walker.speed + dt * 9);
    let s = walker.speed * dt;
    while (s > 0 && walker.path.length) {
      const [tx, tz] = walker.path[0];
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d > 1e-4) walker.heading = Math.atan2(dx, dz);
      if (d <= s) { p.x = tx; p.z = tz; s -= d; walker.path.shift(); } else { p.x += (dx / d) * s; p.z += (dz / d) * s; s = 0; }
    }
    moving = walker.path.length > 0;
    if (!moving) { walker.speed = 0; yuuv.ctx.mem.pace = 1; }
  }
  if (!walker.path.length && walker.then) { const f = walker.then; walker.then = null; f(); } // arrived (or had nowhere to go)
  const gy = places.heightAt(p.x, p.z);
  p.y = dt > 0 && Math.abs(gy - p.y) < 1.2 ? p.y + (gy - p.y) * Math.min(1, dt * 14) : gy; // steps and ramps, eased
  // entering and leaving a district: its enter/leave hooks, e.g. a cap on in the Academy
  if (clock - inT > 0.2) {
    inT = clock;
    const here = districtAt(p.x, p.z);
    if (here !== yuuvIn) { yuuvIn?.out.leave?.(yuuv.ctx, yuuvIn.env); yuuvIn = here; here?.out.enter?.(yuuv.ctx, here.env); }
  }
  yuuv.group.rotation.y = turnTo(yuuv.group.rotation.y, walker.heading, 1 - Math.exp(-dt * 12));
  yuuv.update(dt, moving);
  // districts on screen come alive; the rest wait
  for (const d of districts) {
    d.awake = frustum.intersectsSphere(d.sphere) || d === current.d;
    if (d.root) d.root.visible = d.awake || d === yuuvIn; // out of view: not drawn, not animated
    if (!d.awake) continue;
    for (const r of d.rigs) r.update(dt, false);
    d.out?.update?.(dt, clock, night);
  }
  for (const l of layers) l.update?.(dt, clock, night);
  // camera: follow a long trip, then settle on the stop's view
  if (intro && clock >= intro) { followYuuv(); hint(true); } // the opening: from the whole town down to Yuuv
  if (follow && (!walker.path.length || places.length([p.x, p.z], walker.path) < 5)) { view = follow.to; follow = null; }
  if (view === live) {
    const lead = walker.path.length ? 1.1 : 0; // look a little ahead of him while he walks
    live.target.set(p.x + Math.sin(walker.heading) * lead, p.y + 1.3, p.z + Math.cos(walker.heading) * lead);
    const base = (follow ? follow.to.yaw : LOOK) + orbit.yaw;
    live.fit = FOLLOW_FIT;
    if (clock - sightT > 0.2) { sightT = clock; const [dy, pitch] = sightAngle(p, base); live.yaw = base + dy; live.pitch = pitch; }
  }
  const k = REDUCED ? 1 : 1 - Math.exp(-dt * (view === live ? 3.2 : 2.4));
  cam.target.lerp(view.target, k);
  cam.yaw += (view.yaw - cam.yaw) * k;
  cam.pitch += (view.pitch - cam.pitch) * k;
  cam.fit += ((view === OVERVIEW ? view.fit : Math.min(OVERVIEW.fit, view.fit * zoom)) - cam.fit) * k;
  markers(p);
  // day and night
  if (night !== nightGoal) {
    night = REDUCED ? nightGoal : Math.max(0, Math.min(1, night + Math.sign(nightGoal - night) * dt * 1.2));
    applyLight(night);
  }
  const glow = 0.12 + 0.88 * night;
  for (const h of halos) h.m.opacity = glow * h.strength;
  lampHalos.material.opacity = 0.08 + 0.72 * night;
  if (clock - poolAt > 0.25) { poolAt = clock; assignLights(); }
  const flick = 1 + 0.06 * Math.sin(clock * 3.1);
  for (const l of pool) { const lamp = l.userData.lamp; l.intensity = lamp ? lamp.power * night * lamp.on * flick : 0; }
  band.intensity = 2.6 * night;
  if (clock - syncT > 0.3) { syncT = clock; syncVideos(); }
  const focus = cam.fit < 24 ? districtAt(cam.target.x, cam.target.z) || view.d || null : null;
  setFocus(focus);
  // the town: its shaders' clock, and the small growing things near what the camera looks at
  ground.material.userData.uniforms.uTime.value = clock;
  if (cam.fit < 40) banners.update(clock); // they sway where anyone can see them sway
  const near = cam.fit < 26;
  ground.chunks.forEach((c, i) => { const dm = c.userData.detail; if (dm) dm.visible = near && Math.abs(chunkAt[i].x - cam.target.x) < DETAIL && Math.abs(chunkAt[i].z - cam.target.z) < DETAIL; });
}

let lastCpu = 0;
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (w !== W || h !== H || canvas.width !== Math.floor(w * renderer.getPixelRatio())) {
    W = w; H = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
  }
  const f = ui.free();
  const changed = f.left !== free.left || f.top !== free.top || f.right !== free.right || f.bottom !== free.bottom;
  free = f;
  camera.setViewOffset(W, H, W / 2 - (free.left + free.right) / 2, H / 2 - (free.top + free.bottom) / 2, W, H);
  // a wide screen frames the whole island; a tall one the town, letting the countryside go off its edges
  if (changed && OVERVIEW.auto) frameOverview(free.right - free.left > (free.bottom - free.top) * 0.9 ? [...townPoints, ...townPoints.coast] : townPoints);
}
const labelAt = new THREE.Vector3(), sunDir = new THREE.Vector3();
function labels() {
  const r = canvas.getBoundingClientRect(), wide = cam.fit > 22, list = [];
  const at = (x, y, z) => {
    labelAt.set(x, y, z).project(camera);
    const sx = r.left + ((labelAt.x + 1) / 2) * r.width, sy = r.top + ((1 - labelAt.y) / 2) * r.height;
    return { x: sx, y: sy, in: labelAt.z < 1 && sx > free.left + 40 && sx < free.right - 40 && sy > free.top + 30 && sy < free.bottom - 10 };
  };
  // the name over the square's plinth: in the square's own views, and over the whole town when there is room
  if (hubD?.out.nameplate) { // over the plinth up close; over the square's gate side from afar, clear of the Market's tag
    const [x, y, z] = hubD.out.nameplate, p = wide ? at(x + hubD.cx, hubD.y + 0.5, z + hubD.cz + 5) : at(x + hubD.cx, y + hubD.y, z + hubD.cz);
    list.push({ id: 'name', x: p.x, y: p.y, on: p.in && (wide ? free.right - free.left > 560 : districtAt(cam.target.x, cam.target.z) === hubD) });
  }
  for (const d of real) {
    if (d === hubD || SOLO) continue;
    // each place's tag sits across the edge of its plot nearest the camera, clear of the landmarks in the middle
    const [fx, fz] = frontOf(d), p = at(fx, d.y, fz);
    list.push({ id: d.id, x: p.x, y: p.y, on: p.in && p.y < free.bottom - 26 && wide, mid: true });
  }
  ui.labels(list, wide);
}
function draw() {
  resize();
  placeCamera();
  frustum.setFromProjectionMatrix(projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const half = Math.min(28, Math.max(7, cam.fit * 1.25));
  Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 160 });
  sun.shadow.camera.updateProjectionMatrix();
  sunDir.fromArray(DAY.sunAt.map((v, i) => v + (NIGHT.sunAt[i] - v) * night)).normalize();
  sun.target.position.copy(cam.target);
  sun.position.copy(sun.target.position).addScaledVector(sunDir, 60);
  stars.position.copy(camera.position);
  moon.position.copy(camera.position).addScaledVector(MOON, 800);
  water.update(clock, night, sunDir, (H * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)));
  labels();
  hover();
  renderer.render(scene, camera);
}
let paused = false, then = null;
const frameMs = [];
// Frames are capped: 60 a second (a 120 Hz screen would otherwise double the work), and a device that can't hold 60
// steps down to a steady 30, then to fewer pixels. An even rate reads smoother than a fast one that stutters.
let cap = 1000 / 60, drawnAt = 0, tuneFrom = 0;
const gaps = [];
function tune(now, gap) {
  if (document.hidden || now < tuneFrom) { gaps.length = 0; return; }
  gaps.push(gap);
  if (gaps.length < 90) return;
  const mid = gaps.slice().sort((a, b) => a - b)[45];
  gaps.length = 0;
  if (mid > cap * 1.3) {
    if (cap < 30) cap = 1000 / 30;
    else if (renderer.getPixelRatio() > 1) { renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - 0.5)); W = 0; }
    tuneFrom = now + 1500; // let the new setting settle before judging it
  }
}
addEventListener('visibilitychange', () => { tuneFrom = performance.now() + 1500; });
function frame(now) {
  requestAnimationFrame(frame);
  if (drawnAt && now - drawnAt < cap - 2) return;
  if (drawnAt) tune(now, now - drawnAt);
  drawnAt = now;
  const dt = then === null ? 0 : Math.max(0, Math.min(0.05, (now - then) / 1000));
  if (then !== null) { frameMs.push(now - then); if (frameMs.length > 120) frameMs.shift(); }
  then = now;
  const c0 = performance.now();
  if (!paused) step(dt);
  draw();
  lastCpu = performance.now() - c0;
}

// ---- what to click: over every portfolio item (a crate, a stall, a lectern, an airship, a school) a yellow marker bobs
// until it has been opened, and up close its name floats over it ("Click to open" until then). Labels are buttons too.
const quests = (() => {
  const list = [], part = new THREE.Box3();
  // just over what can be seen of it (a crate's shop is hidden until it pops up), and no higher than a tall tower's waist
  function place(q) {
    const box = new THREE.Box3();
    q.object.updateWorldMatrix(true, true);
    q.object.traverseVisible((o) => {
      if (!o.isMesh || o.isSprite || !o.geometry?.attributes.position) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      if (part.max.y - part.min.y > 0.02) box.union(part);
    });
    if (box.isEmpty()) box.setFromObject(q.object);
    const c = box.getCenter(new THREE.Vector3());
    q.at.set(c.x, Math.min(box.max.y + 0.55, q.d.y + 6.5), c.z);
  }
  scene.updateMatrixWorld(true);
  for (const d of real) for (const t of d.targets) {
    if (!isItem(d, t.stop) || list.some((q) => q.d === d && q.stop === t.stop)) continue;
    const it = d.chapter.items.find((x) => x.id === t.stop);
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'qlabel'; el.tabIndex = -1; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<b></b><span></span>';
    el.querySelector('b').textContent = it.title;
    el.querySelector('span').textContent = `${matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click'} to open`;
    el.addEventListener('click', () => { hint(false); go(d.id, t.stop); });
    document.getElementById('labels').append(el);
    list.push({ d, stop: t.stop, el, done: false, object: t.object, at: new THREE.Vector3(), placed: false });
  }
  const mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.24), flatMat(0xffc56b, 0.95, true), Math.max(1, list.length));
  mesh.renderOrder = 7; mesh.frustumCulled = false; scene.add(mesh);
  const m = new THREE.Object3D(), placed = [];
  list.tick = () => {
    for (const q of list) {
      if (!q.placed) { q.placed = true; place(q); } // measured once the rigs have their first pose (a closed crate is small)
      if (q.done && !q.settled && clock - q.doneAt > 3.5) { q.settled = true; place(q); } // and again once it has opened up
    }
    const near = cam.fit < 20, far = Math.max(1, cam.fit / 9);
    mesh.visible = near;
    list.forEach((q, i) => {
      const s = q.done || !near ? 0 : far;
      m.position.set(q.at.x, q.at.y + Math.sin(clock * 2.6 + i) * 0.12 * far, q.at.z); m.rotation.set(0, clock * 1.5 + i, 0); m.scale.set(s, s * 1.45, s);
      m.updateMatrix(); mesh.setMatrixAt(i, m.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    // names close up, nearest to the middle of the view first; any that would overlap one already placed stay hidden
    placed.length = 0;
    const show = cam.fit < 12;
    const order = list.map((q) => ({ q, at: show ? onScreen(q.at, 0.45) : null })).sort((a, b) => (a.at && b.at ? Math.hypot(a.at.x - innerWidth / 2, a.at.y - innerHeight / 2) - Math.hypot(b.at.x - innerWidth / 2, b.at.y - innerHeight / 2) : 0));
    for (const { q, at } of order) {
      let ok = show && at.in && at.x > free.left + 50 && at.x < free.right - 50 && at.y > free.top + 40 && at.y < free.bottom - 10 && q.at.distanceTo(cam.target) < cam.fit * 1.6;
      if (ok) {
        const w = q.el.offsetWidth || 110, hh = q.el.offsetHeight || 38, r = [at.x - w / 2, at.y - hh, at.x + w / 2, at.y];
        ok = !placed.some((o) => r[0] < o[2] + 4 && r[2] > o[0] - 4 && r[1] < o[3] + 3 && r[3] > o[1] - 3);
        if (ok) { placed.push(r); q.el.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) translate(-50%, -100%)`; }
      }
      q.el.classList.toggle('on', ok);
      q.el.classList.toggle('done', q.done);
    }
  };
  return list;
})();

// ---- keeping Yuuv in sight: a coarse map of how tall the town stands (land, walls and towers from the raster; houses
// and landmarks from their boxes). The follow camera finds an angle past anything that would come between it and him.
const sky = (() => {
  const c = 0.6, x0 = R.i0 * V, z0 = R.k0 * V, nx = Math.ceil((R.nx * V) / c), nz = Math.ceil((R.nz * V) / c), h = new Float32Array(nx * nz);
  for (let k = 0; k < R.nz; k += 1) {
    const row = Math.floor((k * V) / c) * nx;
    for (let i = 0; i < R.nx; i += 1) {
      const n = k * R.nx + i, kind = R.kind[n];
      const y = kind === KIND.SEA ? 0 : R.top[n] * V + (kind === KIND.TOWER ? 4 : kind === KIND.WALL || kind === KIND.GATE ? 0.9 : 0); // caps and merlons ride above the tops
      const g = row + Math.floor((i * V) / c);
      if (y > h[g]) h[g] = y;
    }
  }
  const box = new THREE.Box3(), m4 = new THREE.Matrix4();
  const stamp = (b) => {
    const i0 = Math.max(0, Math.floor((b.min.x - x0) / c)), i1 = Math.min(nx - 1, Math.floor((b.max.x - x0) / c));
    const k0 = Math.max(0, Math.floor((b.min.z - z0) / c)), k1 = Math.min(nz - 1, Math.floor((b.max.z - z0) / c));
    for (let k = k0; k <= k1; k += 1) for (let i = i0; i <= i1; i += 1) if (b.max.y > h[k * nx + i]) h[k * nx + i] = b.max.y;
  };
  scene.updateMatrixWorld(true);
  const roots = [...real.map((d) => d.root), ...layers.filter((l) => l.id === 'houses' && l.group).map((l) => l.group)];
  for (const root of roots) root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes.position) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    if (o.isInstancedMesh) for (let j = 0; j < o.count; j += 1) { o.getMatrixAt(j, m4); stamp(box.copy(o.geometry.boundingBox).applyMatrix4(m4.premultiply(o.matrixWorld))); }
    else stamp(box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
  });
  return (x, z) => { const i = Math.floor((x - x0) / c), k = Math.floor((z - z0) / c); return i < 0 || k < 0 || i >= nx || k >= nz ? 0 : h[k * nx + i]; };
})();
// a camera angle that sees his head past everything: the town's usual first, then a little higher, then swung round a
// little, then higher still; checked a few times a second, and the current one kept while it stays clear
const ANGLES = [[0, 0.62], [0, 0.76], [0.5, 0.62], [-0.5, 0.62], [0.5, 0.78], [-0.5, 0.78], [0, 0.92], [1, 0.7], [-1, 0.7], [1, 0.9], [-1, 0.9], [0, 1.08], [0.5, 1.08], [-0.5, 1.08], [0, 1.3]];
let sightT = 0, sightAt = ANGLES[0], clearSince = 0;
function sees(p, yaw, pitch) {
  const d = distFor(FOLLOW_FIT * zoom), head = p.y + 1.7;
  const hx = Math.sin(yaw) * Math.cos(pitch) * d, hz = Math.cos(yaw) * Math.cos(pitch) * d, hy = Math.sin(pitch) * d, run = Math.hypot(hx, hz);
  for (let s = 1.1 / run; s < 1; s += 0.35 / run) if (sky(p.x + hx * s, p.z + hz * s) > head + hy * s) return false;
  return true;
}
function sightAngle(p, yaw) {
  const list = orbit.manual ? [0, 0.14, 0.28, 0.42, 0.56].map((up) => [0, Math.min(1.34, orbit.pitch + up)]) : ANGLES;
  const same = (a, b) => a[0] === b[0] && Math.abs(a[1] - b[1]) < 1e-6, rank = (a) => { const i = list.findIndex((b) => same(a, b)); return i < 0 ? Infinity : i; };
  const best = list.find(([dy, pitch]) => sees(p, yaw + dy, pitch)) || list[list.length - 1];
  if (same(best, sightAt)) { clearSince = clock; return sightAt; }
  // a better (more usual) angle has to stay clear a moment before the camera moves back to it; a blocked one goes at once
  if (rank(sightAt) === Infinity || !sees(p, yaw + sightAt[0], sightAt[1]) || (rank(best) < rank(sightAt) && clock - clearSince > 0.8)) { sightAt = best; clearSince = clock; }
  return sightAt;
}

// ---- what you opened, said by Yuuv in a speech box (the panel holds the whole card); a town thing you click gets its
// name in a small one for a moment
const bubble = Object.assign(document.createElement('div'), { className: 'bubble' });
bubble.setAttribute('aria-hidden', 'true');
document.body.append(bubble);
const tag = (name, cls, text) => Object.assign(document.createElement(name), { className: cls, textContent: text });
let said = null;
const headAt = new THREE.Vector3();
const yuuvHead = () => headAt.copy(yuuv.group.position).setY(yuuv.group.position.y + 3.05);
function say(at, parts, { seconds = 0, small = false } = {}) {
  const inner = tag('div', 'in', '');
  inner.append(...parts);
  bubble.replaceChildren(inner);
  bubble.classList.toggle('small', small);
  said = { at, until: seconds ? clock + seconds : 0, trip };
}
function sayItem(d, stopId) {
  const it = d.chapter?.items.find((x) => x.id === stopId);
  if (!it) return;
  const parts = [tag('p', 'k', it.kicker || d.chapter.title), tag('h3', '', it.title)];
  if (it.metric) { const m = tag('p', 'm', ''); m.append(tag('b', '', it.metric.value), ' ', tag('span', '', it.metric.label)); parts.push(m); }
  const line = (it.blurb || '').match(/^.*?[.!?](\s|$)/)?.[0].trim() || it.blurb;
  if (line) parts.push(tag('p', 'b', line));
  const more = tag('button', 'more', 'Read more');
  more.type = 'button'; more.tabIndex = -1;
  more.addEventListener('click', () => {
    const panel = document.getElementById('panel');
    if (panel.dataset.open !== 'true') document.getElementById('sheet').click();
    document.getElementById('panel-title')?.focus({ preventScroll: true });
  });
  parts.push(more);
  say(yuuvHead, parts);
}
function bubbleTick() {
  if (!said) return;
  if ((said.until && clock > said.until) || (!said.until && said.trip !== trip)) { said = null; bubble.classList.remove('on'); return; }
  const at = onScreen(said.at()), w = bubble.offsetWidth, hh = bubble.offsetHeight;
  const x = Math.min(Math.max(at.x, free.left + w / 2 + 10), free.right - w / 2 - 10), y = Math.min(Math.max(at.y, free.top + hh + 14), free.bottom - 14);
  bubble.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  bubble.classList.toggle('on', at.in);
}

// ---- start: Yuuv on the square's (or the solo district's) main spot, the camera on the whole town
{
  const d = SOLO ? real[0] : hubD;
  const [x, z] = local(d, spotOf(d.stops.main));
  yuuv.group.position.set(x, places.heightAt(x, z), z);
  yuuv.group.rotation.y = walker.heading = LOOK;
  current = { d, stop: 'main' };
  resize(); placeCamera(); snap();
  if (!SOLO) intro = REDUCED ? 0.01 : 1.6; // a breath on the whole town, then the camera comes down to him
  if (SOLO) { ui.show(SOLO); const item = PARAMS.get('stop'); if (item && d.stops[item]) { ui.show(SOLO, isItem(d, item) ? item : null); visit(d, item); snap(); } }
}
started = true;
for (const d of districts) for (const r of d.rigs) r.update(0, false); // every rig once, so empty particle pools hide
step(0);
draw();
// Warm up behind the loading screen: every material compiled and every mesh uploaded once, hidden and off-screen ones
// too, so the first visit to each place doesn't hitch while the graphics card catches up.
{
  const shownNow = [], culled = [];
  scene.traverse((o) => { if (!o.visible) { shownNow.push(o); o.visible = true; } if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera).catch(() => {});
  renderer.render(scene, camera);
  for (const o of shownNow) o.visible = false;
  for (const o of culled) o.frustumCulled = true;
  step(0);
  draw();
}
ui.status('');
document.documentElement.dataset.world = 'ready';
dispatchEvent(new Event('world-ready'));
{
  const l = document.getElementById('loading');
  if (l) { l.classList.add('done'); setTimeout(() => l.remove(), 700); }
}
const readyAt = performance.now();
tuneFrom = readyAt + 2500; // the first seconds (videos, fonts) are no measure of the device
requestAnimationFrame(frame);

// ---- a seam for headless checks: step the clock, go places, click, read the cost
const toScreen = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera), r = canvas.getBoundingClientRect(); return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height]; };
window.__scene = {
  pause() { paused = true; intro = 0; }, // headless checks start here: no opening glide
  quests: () => quests.map((q) => ({ place: q.d.id, id: q.stop, done: q.done, at: q.at.toArray().map((v) => +v.toFixed(2)), y: +q.d.y.toFixed(2) })),
  resume() { paused = false; },
  advance(seconds) { const n = Math.max(1, Math.round(seconds * 30)); for (let i = 0; i < n; i += 1) { step(seconds / n); if (i % 10 === 9) draw(); } draw(); },
  go: (id, item) => go(id, item), overview, home, setNight, clickAt, toScreen,
  clickWorld(x, z, y) { draw(); return clickAt(...toScreen(x, y ?? groundAt(x, z), z)); },
  // put the camera straight onto a view: 'overview', a place, a place and a stop, or { target, yaw, pitch, fit }
  jump(id, stop = 'main') {
    intro = 0;
    if (id === 'overview') goView(OVERVIEW);
    else if (typeof id === 'object') goView({ target: new THREE.Vector3(...id.target), yaw: id.yaw ?? LOOK, pitch: id.pitch ?? 0.6, fit: id.fit ?? 10, d: null });
    else { const d = byId[id]; const s = d.stops[stop] || d.stops.main; goView(s.view ? toView(d, s.view) : mainView(d)); }
    snap(); step(0); draw();
  },
  teleport(id, stop = 'main') { const d = byId[id], [x, z] = local(d, spotOf(d.stops[stop] || d.stops.main)); walker.path = []; yuuv.group.position.set(x, places.heightAt(x, z), z); current = { d, stop }; },
  // a district's plot in the town, and each stop's spot (plot units) with whether it can be walked to
  where: (id) => { const d = byId[id]; return d ? { cx: d.cx, cz: d.cz, y: d.y, dock: d.dock, entries: d.docks, stops: Object.keys(d.stops), spots: Object.fromEntries(Object.entries(d.stops).map(([k, st]) => { const p = spotOf(st); return [k, { at: p.map((v) => +v.toFixed(2)), walkable: places.walkable(local(d, p)) }]; })) } : null; },
  // the streets (the walking graph's edges): id, points [x, z, y] in world units
  streets: () => STREETS.map((s) => ({ id: s.id, w: s.w, pts: s.pts.map(([x, z, y]) => [x, z, +(y * V).toFixed(2)]) })),
  route: (from, to) => places.plan(from, to),
  ground: (x, z) => groundAt(x, z),
  state: () => ({
    cam: { x: +cam.target.x.toFixed(2), y: +cam.target.y.toFixed(2), z: +cam.target.z.toFixed(2), yaw: +cam.yaw.toFixed(3), fit: +cam.fit.toFixed(2) },
    pos: yuuv.group.position.toArray().map((v) => +v.toFixed(2)), walking: walker.path.length > 0, pace: walker.pace, route: +(walker.len || 0).toFixed(1), speed: +walker.speed.toFixed(2), following: Boolean(follow),
    at: current.d?.id, stop: current.stop, in: yuuvIn?.id || null, panel: ui.shown(), night,
    videos: videos.map((v) => ({ url: v.url.split('/').pop(), loaded: v.loaded, playing: !v.video.paused, t: +v.video.currentTime.toFixed(2) })),
    revealed: byId.shipped?.rigs.filter((r) => r.ctx.revealed).map((r) => r.ctx.revealed()),
  }),
  stats() {
    draw();
    const avg = frameMs.length ? frameMs.reduce((a, b) => a + b, 0) / frameMs.length : 0;
    return { cap: Math.round(1000 / cap), pixelRatio: renderer.getPixelRatio(), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, cpuMs: +lastCpu.toFixed(2), frameMs: +avg.toFixed(2), buildMs, townMs, town: { ground: ground.stats, water: water.stats, lamps: LAMPS.length }, timing, loadMs: Math.round(readyAt), lights: lamps.length };
  },
  three: { scene, renderer, camera },
  // Time n full frames, forcing the GPU to finish each one (readPixels), so the number is honest.
  bench(n = 60) {
    const gl = renderer.getContext(), px = new Uint8Array(4);
    draw(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const b0 = performance.now();
    for (let i = 0; i < n; i += 1) { step(1 / 60); draw(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
    return +((performance.now() - b0) / n).toFixed(2);
  },
};
