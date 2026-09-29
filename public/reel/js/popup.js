// popup.js: the "Research, folded up" pop-up book. Self-contained three.js scene.
//
//   const api = mountPopup(container, items, { onHover, onPick, spriteBase: 'sprites/', manifest });
//   api.setProgress(p)   // 0..1, scroll through the chapter (pure function of p, reverses cleanly)
//   api.setHover(id)     // highlight a card from outside (DOM list / keyboard); null clears
//   api.react('excited') // play a character clip once ('wave' and other loops play twice)
//   api.destroy()
//
// Throws if WebGL2 is unavailable so the page can fall back to its DOM list.

import * as THREE from '../vendor/three.module.js';

const C = { ink: '#2B2233', soft: '#5A5160', sage: '#3E6B55', clay: '#D97757', cream: '#FFF5E2' };
const PW = 4, PD = 4.6;            // one page: width (x) and depth (z)
const CT = 0.07, BT = 0.12;        // cover board and page block thickness
const SURF = CT + BT;              // height of the open spread
const OV = 0.1;                    // cover overhang
const CARD_T = 0.02, LEAVES = 3;
const FACE_W = 640, FACE_H = 858;  // card face canvas (card aspect 1 : 1.34)
const MASK_W = 320, MASK_H = 429;  // boiling border mask, three jitter variants in R, G, B
const FPS = 12;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const inOut = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
// hinge with a paper overshoot: ~9% past upright, then settles
const springy = t => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.exp(-5.5 * t) * Math.cos(9 * t) * (1 - t));
const rise = t => springy(t ** 1.35);
function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- shaders: paper bend (cards flex, leaves curl) + boiling inverted-hull outline ----------

const BEND = /* glsl */ `
uniform float uBend;
vec3 bendP(vec3 p) {
  if (abs(uBend) < 1e-4) return p;
  float R = 1.0 / uBend, th = p.y * uBend, r = R - p.z;
  return vec3(p.x, r * sin(th), R - r * cos(th));
}
vec3 bendN(vec3 n, float y) {
  float th = y * uBend, c = cos(th), s = sin(th);
  return vec3(n.x, n.y * c - n.z * s, n.y * s + n.z * c);
}`;

const NOISE = /* glsl */ `
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`;

function bendable(mat, u, extra) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + BEND)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = bendN(objectNormal, position.y);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = bendP(transformed);');
    if (extra) extra(sh);
  };
  mat.customProgramCacheKey = () => (extra ? 'bend-face' : 'bend');
  return mat;
}

function hullMaterial(u, boil, center, thick) {
  return new THREE.ShaderMaterial({
    uniforms: { uBend: u.uBend, uBoil: boil, uCenter: { value: center }, uThick: { value: thick }, uColor: { value: new THREE.Color(C.ink) } },
    vertexShader: `${BEND}${NOISE}
      uniform float uBoil, uThick; uniform vec3 uCenter;
      void main() {
        vec3 d = sign(position - uCenter);
        float n = n3(position * 5.0 + vec3(uBoil * 3.7, uBoil * 1.3, uBoil * 2.9));
        vec3 p = position + d * uThick * (0.45 + 1.1 * n);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(bendP(p), 1.0);
      }`,
    fragmentShader: `uniform vec3 uColor;
      void main() { gl_FragColor = vec4(uColor, 1.0);
      #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  });
}

// ---------- 2D ink drawing (canvas) ----------

// one hand-inked stroke: low-frequency wobble, width swell, tiny per-point shake
function inkStroke(g, x0, y0, x1, y1, w, jit, r, color) {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(4, Math.round(len / 9));
  const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
  const p1 = r() * 6.28, p2 = r() * 6.28, f1 = 1 + r() * 2, f2 = 3 + r() * 4;
  g.strokeStyle = color; g.lineCap = 'round';
  let px, py;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const o = jit * (0.65 * Math.sin(t * f1 * 3.14 + p1) + 0.35 * Math.sin(t * f2 * 3.14 + p2)) + (r() - 0.5) * jit * 0.35;
    const x = lerp(x0, x1, t) + nx * o, y = lerp(y0, y1, t) + ny * o;
    if (i) {
      g.lineWidth = w * (0.75 + 0.5 * Math.sin(t * 3.14) + (r() - 0.5) * 0.15);
      g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
    }
    px = x; py = y;
  }
}

// hand-drawn rectangle: four strokes that overshoot the corners a little
function inkRect(g, x, y, w, h, lw, jit, r, color) {
  const o = () => (r() - 0.3) * lw * 2.2;
  inkStroke(g, x - o(), y + (r() - 0.5) * jit, x + w + o(), y + (r() - 0.5) * jit, lw, jit, r, color);
  inkStroke(g, x + w + (r() - 0.5) * jit, y - o(), x + w + (r() - 0.5) * jit, y + h + o(), lw, jit, r, color);
  inkStroke(g, x + w + o(), y + h + (r() - 0.5) * jit, x - o(), y + h + (r() - 0.5) * jit, lw, jit, r, color);
  inkStroke(g, x + (r() - 0.5) * jit, y + h + o(), x + (r() - 0.5) * jit, y - o(), lw, jit, r, color);
}

function paperFill(g, W, H, base, img, alpha, r) {
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  if (!img) return;
  const s = Math.max(W / img.width, H / img.height, 0.5);
  const sw = W / s, sh = H / s;
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = alpha;
  g.drawImage(img, r() * Math.max(0, img.width - sw), r() * Math.max(0, img.height - sh), sw, sh, 0, 0, W, H);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
}

function wrap(g, text, maxW) {
  const lines = []; let line = '';
  for (const w of String(text).split(/\s+/)) {
    const t = line ? line + ' ' + w : w;
    if (line && g.measureText(t).width > maxW) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function fit(g, text, weight, family, size, min, maxW, maxLines) {
  for (let s = size; s >= min; s -= 2) {
    g.font = `${weight} ${s}px ${family}`;
    const L = wrap(g, text, maxW);
    if (L.length <= maxLines && L.every(l => g.measureText(l).width <= maxW)) return { s, lines: L };
  }
  g.font = `${weight} ${min}px ${family}`;
  return { s: min, lines: wrap(g, text, maxW).slice(0, maxLines) };
}

function drawFace(g, item, img, seed) {
  const W = FACE_W, H = FACE_H, m = 54, maxW = W - 2 * m, r = rng(seed);
  paperFill(g, W, H, C.cream, img, 0.45, r);
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';

  // kicker
  g.fillStyle = C.soft; g.letterSpacing = '4px';
  const k = fit(g, String(item.kicker || '').toUpperCase(), 600, '"Inter Tight", sans-serif', 28, 18, maxW, 2);
  let y = m + 26;
  k.lines.forEach((l, i) => g.fillText(l, m, y + i * k.s * 1.3));
  y += (k.lines.length - 1) * k.s * 1.3;
  g.letterSpacing = '0px';

  // title
  g.fillStyle = C.ink;
  const t = fit(g, item.title || '', 600, 'Fraunces, serif', 66, 36, maxW, 3);
  y += 26;
  t.lines.forEach(l => { y += t.s * 1.04; g.fillText(l, m, y); });
  const lastW = g.measureText(t.lines[t.lines.length - 1] || '').width;

  // sage ink underline
  const uw = clamp(lastW, maxW * 0.35, maxW * 0.62);
  inkStroke(g, m + 2, y + 24, m + uw, y + 20 + r() * 6, 7, 3, r, C.sage);
  inkStroke(g, m + uw * 0.18, y + 31, m + uw * 0.9, y + 29, 3.5, 2, r, C.sage);
  const textTop = y + 60;

  // bottom-up: tags (handwritten), metric label, metric value
  let b = H - m + 6;
  if (item.tags && item.tags.length) {
    g.fillStyle = C.sage;
    const tg = fit(g, item.tags.join(' · '), 700, 'Caveat, cursive', 38, 24, maxW, 1);
    g.fillText(tg.lines[0], m, b);
    b -= tg.s + 22;
  }
  if (item.metric) {
    g.fillStyle = C.soft;
    const lb = fit(g, item.metric.label || '', 500, '"Inter Tight", sans-serif', 29, 20, maxW, 2);
    for (let i = lb.lines.length - 1; i >= 0; i--) { g.fillText(lb.lines[i], m, b); b -= lb.s * 1.25; }
    b -= 10;
    g.fillStyle = C.ink;
    const v = fit(g, String(item.metric.value), 600, 'Fraunces, serif', 132, 44, maxW, 1);
    g.fillText(v.lines[0], m - 3, b);
  } else if (item.blurb) {
    g.fillStyle = C.soft;
    const room = Math.max(1, Math.floor((b - textTop) / 36));
    const bl = fit(g, item.blurb, 500, '"Inter Tight", sans-serif', 28, 20, maxW, Math.min(6, room));
    bl.lines.forEach((l, i) => g.fillText(l, m, textTop + bl.s + i * bl.s * 1.3));
  }
}

function drawBorderMask(g, seed) {
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#000'; g.fillRect(0, 0, MASK_W, MASK_H);
  g.globalCompositeOperation = 'lighter';
  const i = 11;
  ['#f00', '#0f0', '#00f'].forEach((col, v) => inkRect(g, i, i, MASK_W - 2 * i, MASK_H - 2 * i, 3.4, 2.4, rng(seed * 13 + v * 7919), col));
  g.globalCompositeOperation = 'source-over';
}

// ---------- the module ----------

export function mountPopup(container, items, opts = {}) {
  items = (items || []).slice(0, 8);
  const n = items.length;
  const manifest = opts.manifest || {};
  const spriteBase = opts.spriteBase ?? 'sprites/';

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    throw new Error('popup: WebGL2 is unavailable (' + e.message + ')');
  }
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab;outline:none';
  canvas.setAttribute('aria-hidden', 'true');  // the page's DOM list is the accessible version
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const disposables = new Set();
  const track = x => (disposables.add(x), x);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // reduced motion
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = mq.matches;
  const onMq = () => { reduced = mq.matches; dirty = true; };
  mq.addEventListener?.('change', onMq);

  // lights: warm key from front-left, lilac-tinted ambient so shadows read as ink wash, not black
  scene.add(new THREE.AmbientLight('#FBF7FF', 2.2));
  const key = new THREE.DirectionalLight('#FFF8EC', 1.25);
  key.position.set(-5, 10, 6.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 2.5;
  key.shadow.intensity = 0.85;
  scene.add(key, key.target);

  const grad = track(new THREE.DataTexture(new Uint8Array([140, 205, 255]), 3, 1, THREE.RedFormat));
  grad.minFilter = grad.magFilter = THREE.NearestFilter;
  grad.needsUpdate = true;
  const toon = o => track(new THREE.MeshToonMaterial({ gradientMap: grad, ...o }));

  const boil = { value: 0 };   // hull wobble seed, steps at 12 fps
  const boilF = { value: 0 };  // which border variant (0..2)

  // ----- textures -----
  const canvasTex = (w, h, srgb = true) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const t = track(new THREE.CanvasTexture(cv));
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  };
  const pageTex = [canvasTex(1024, 1178), canvasTex(1024, 1178)];  // left, right
  const leafTex = canvasTex(512, 590);
  const coverTex = canvasTex(820, 960);
  const edgeTex = canvasTex(64, 256);
  const blobTex = canvasTex(128, 64);
  const paperTex = canvasTex(512, 512);

  // ----- layout -----
  const xMin = -2.15, xMax = 3.45, cx = (xMin + xMax) / 2;
  const span = n > 1 ? Math.min(xMax - xMin, 1.55 * (n - 1)) : 0;
  const spacing = n > 1 ? span / (n - 1) : 1.5;
  const cardW = Math.min(1.36, spacing * 0.93), cardH = cardW * (FACE_H / FACE_W);
  const layout = items.map((it, i) => {
    const x = cx - span / 2 + i * spacing;
    const tn = span ? (x - cx) / (span / 2) : 0;
    const z = 0.5 - 0.85 * (1 - tn * tn) + (i % 2 ? 0.22 : 0);
    const yaw = Math.atan2(cx - x, 11 - z) * 0.9;
    return { x, z, yaw };
  });
  const CH = { x: -3.25, z: 1.05 };
  // the thread: a hand-drawn ink line from his feet across the front of the spread, with one loop
  const THREAD = new THREE.CatmullRomCurve3([
    [-3.05, 1.16], [-2.2, 1.62], [-1.3, 1.38], [-0.5, 1.72], [0.15, 1.48], [0.45, 1.2], [0.15, 1.02], [-0.05, 1.3],
    [0.5, 1.62], [1.4, 1.4], [2.2, 1.72], [2.95, 1.45], [3.3, 1.12],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z))).getPoints(220).map((v, i) => [v.x + Math.sin(i * 1.7) * 0.004, v.z + Math.cos(i * 2.3) * 0.004]);

  // ----- book -----
  const world = new THREE.Group(); scene.add(world);
  const book = new THREE.Group(); world.add(book);
  const leftPage = new THREE.Group(); leftPage.position.set(0, SURF, 0); book.add(leftPage);   // = cover pivot
  const rightPage = new THREE.Group(); rightPage.position.set(0, SURF, 0); book.add(rightPage);

  const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(30, 30)), track(new THREE.ShadowMaterial({ color: C.ink, opacity: 0.2, depthWrite: false })));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  world.add(ground);

  const inkBox = (geo, mats, parent, thick, cast = true) => {
    const mesh = new THREE.Mesh(geo, mats);
    mesh.castShadow = cast; mesh.receiveShadow = true;
    geo.computeBoundingBox();
    const center = geo.boundingBox.getCenter(new THREE.Vector3());
    const u = { uBend: { value: 0 } };
    const hull = new THREE.Mesh(geo, track(hullMaterial(u, boil, center, thick)));
    hull.raycast = () => {};
    mesh.add(hull); parent.add(mesh);
    return mesh;
  };

  const sageMat = toon({ color: C.sage });
  const coverArt = toon({ map: coverTex });
  const endpaper = toon({ color: '#EBDDC4' });
  const edgeMat = toon({ map: edgeTex });
  const creamMat = toon({ color: '#F7EEDC' });

  const coverGeo = track(new THREE.BoxGeometry(PW + OV, CT, PD + 2 * OV, 8, 1, 8));
  // box groups: +x, -x, +y, -y, +z, -z
  const backCover = inkBox(coverGeo, [sageMat, sageMat, endpaper, sageMat, sageMat, sageMat], book, 0.02);
  backCover.position.set((PW + OV) / 2, CT / 2, 0);
  const frontCover = inkBox(coverGeo, [sageMat, sageMat, endpaper, coverArt, sageMat, sageMat], leftPage, 0.02);
  frontCover.position.set(-(PW + OV) / 2, -BT - CT / 2, 0);

  const blockGeo = track(new THREE.BoxGeometry(PW, BT, PD, 8, 1, 8));
  const pageMatL = toon({ map: pageTex[0] }), pageMatR = toon({ map: pageTex[1] });
  const rightBlock = inkBox(blockGeo, [edgeMat, edgeMat, pageMatR, creamMat, edgeMat, edgeMat], book, 0.016);
  rightBlock.position.set(PW / 2, CT + BT / 2, 0);
  const leftBlock = inkBox(blockGeo, [edgeMat, edgeMat, pageMatL, creamMat, edgeMat, edgeMat], leftPage, 0.016);
  leftBlock.position.set(-PW / 2, -BT / 2, 0);

  // flutter leaves: length along local +y from the spine, thickness local z (so the bend shader curls them)
  const leafLen = PW - 0.1, leafGeo = track(new THREE.BoxGeometry(PD - 0.14, leafLen, 0.012, 1, 24, 1));
  leafGeo.translate(0, leafLen / 2 + 0.03, 0);
  const leafBasis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0));
  const leaves = [];
  for (let k = 0; k < LEAVES; k++) {
    const u = { uBend: { value: 0 } };
    const mat = bendable(toon({ map: leafTex }), u);
    const pivot = new THREE.Group(); pivot.position.set(0, SURF, 0); book.add(pivot);
    const mesh = new THREE.Mesh(leafGeo, mat);
    mesh.quaternion.setFromRotationMatrix(leafBasis);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.customDepthMaterial = bendable(track(new THREE.MeshDepthMaterial()), u);
    const hull = new THREE.Mesh(leafGeo, track(hullMaterial(u, boil, new THREE.Vector3(0, leafLen / 2 + 0.03, 0), 0.009)));
    mesh.add(hull); pivot.add(mesh);
    leaves.push({ pivot, mesh, u });
  }

  // ----- cards -----
  const cardGeo = track(new THREE.BoxGeometry(cardW, cardH, CARD_T, 6, 14, 1));
  cardGeo.translate(0, cardH / 2, 0);
  const proxyGeo = track(new THREE.PlaneGeometry(cardW * 1.04, cardH * 1.04));
  proxyGeo.translate(0, cardH / 2, CARD_T);
  const proxyMat = track(new THREE.MeshBasicMaterial({ visible: false }));
  const inkColor = new THREE.Color(C.ink), hoverInk = new THREE.Color(C.clay);

  const cards = items.map((item, i) => {
    const L = layout[i];
    const face = canvasTex(FACE_W, FACE_H);
    const mask = canvasTex(MASK_W, MASK_H, false);
    face.image.getContext('2d').fillStyle = C.cream;
    face.image.getContext('2d').fillRect(0, 0, FACE_W, FACE_H);
    const u = { uBend: { value: 0 } };
    const ink = { value: inkColor.clone() };
    const faceMat = bendable(toon({ map: face }), u, sh => {
      sh.uniforms.uMask = { value: mask };
      sh.uniforms.uBoilF = boilF;
      sh.uniforms.uInkC = ink;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uMask; uniform float uBoilF; uniform vec3 uInkC;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec3 bm = texture2D(uMask, vMapUv).rgb;
          float bk = uBoilF < 0.5 ? bm.r : (uBoilF < 1.5 ? bm.g : bm.b);
          diffuseColor.rgb = mix(diffuseColor.rgb, uInkC, bk);`);
    });
    const backMat = bendable(toon({ map: paperTex }), u);
    const edge = bendable(toon({ color: '#F7EEDC' }), u);

    const parent = L.x < 0 ? leftPage : rightPage;
    const root = new THREE.Group(); root.position.set(L.x, 0, L.z); root.rotation.y = L.yaw; parent.add(root);
    const hinge = new THREE.Group(); root.add(hinge);
    const proxy = new THREE.Mesh(proxyGeo, proxyMat); hinge.add(proxy);
    const hover = new THREE.Group(); hinge.add(hover);
    const mesh = new THREE.Mesh(cardGeo, [edge, edge, edge, edge, faceMat, backMat]);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.customDepthMaterial = bendable(track(new THREE.MeshDepthMaterial()), u);
    mesh.add(new THREE.Mesh(cardGeo, track(hullMaterial(u, boil, new THREE.Vector3(0, cardH / 2, 0), 0.013))));
    hover.add(mesh);
    const c = { item, i, root, hinge, proxy, hover, mesh, face, mask, u, ink, hov: 0, tx: 0, ty: 0, ax: 0, ay: 0, open: 0 };
    proxy.userData.card = c;
    return c;
  });

  // ----- character: painted cutout standee with a cream cut margin and ink edge -----
  const fr0 = manifest.idle2 || { frames: 1, w: 420, h: 480, feet: [210, 450] };
  const figH = cardH * (fr0.h / 352);  // the painted figure is ~352 px of the frame height: he stands as tall as a card
  const figW = figH * (fr0.w / fr0.h);
  const charRoot = new THREE.Group(); charRoot.position.set(CH.x, 0, CH.z); leftPage.add(charRoot);
  const charYaw = new THREE.Group(); charRoot.add(charYaw);
  const charHinge = new THREE.Group(); charYaw.add(charHinge);
  const charMat = track(new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null }, uFrame: { value: new THREE.Vector4(0, 0, 1, 1) }, uMirror: { value: 1 },
      uR1: { value: new THREE.Vector2(6 / fr0.w, 6 / fr0.h) }, uR2: { value: new THREE.Vector2(10 / fr0.w, 10 / fr0.h) },
      uCream: { value: new THREE.Color(C.cream) }, uInk: { value: new THREE.Color(C.ink) }, uBoil: boil, uShade: { value: 1 },
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D map; uniform vec4 uFrame; uniform float uMirror; uniform vec2 uR1, uR2; uniform vec3 uCream, uInk; uniform float uBoil, uShade;
      varying vec2 vUv;
      vec4 S(vec2 uv) { return texture2D(map, vec2(uFrame.x + clamp(uv.x, 0.0, 1.0) * uFrame.z, uFrame.y + clamp(uv.y, 0.0, 1.0) * uFrame.w)); }
      float A(vec2 uv) { return (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) ? 0.0 : S(uv).a; }
      void main() {
        vec2 uv = vec2(uMirror > 0.0 ? vUv.x : 1.0 - vUv.x, vUv.y);
        vec4 c = S(uv);
        vec3 col;
        if (c.a > 0.5) col = c.rgb;
        else {
          float d1 = 0.0, d2 = 0.0;
          for (int i = 0; i < 12; i++) {
            float a = float(i) * 0.5236 + uBoil * 0.37;
            float j = 0.85 + 0.3 * fract(sin(float(i) * 12.9898 + uBoil * 4.1) * 43758.5453);
            vec2 o = vec2(cos(a), sin(a)) * j;
            d1 = max(d1, A(uv + o * uR1));
            d2 = max(d2, A(uv + o * uR2));
          }
          if (d1 > 0.5) col = uCream; else if (d2 > 0.5) col = uInk; else discard;
        }
        gl_FragColor = vec4(col * uShade, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide,
    transparent: true,
  }));
  const charGeo = track(new THREE.PlaneGeometry(figW, figH));
  const feet = fr0.feet || [fr0.w / 2, fr0.h - 30];
  charGeo.translate(-(feet[0] / fr0.w - 0.5) * figW, figH * (0.5 - (fr0.h - feet[1]) / fr0.h) - 0.0, 0);
  const charMesh = new THREE.Mesh(charGeo, charMat);
  charMesh.visible = false;
  charHinge.add(charMesh);
  const blob = new THREE.Mesh(track(new THREE.PlaneGeometry(1.0, 0.42)), track(new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0 })));
  blob.rotation.x = -Math.PI / 2; blob.position.set(0.06, 0.006, 0.02);
  charRoot.add(blob);

  // sprite clips
  const clips = {};
  const texLoader = new THREE.TextureLoader();
  const loadClip = name => {
    if (clips[name] || !manifest[name]) return clips[name];
    const m = manifest[name];
    const c = clips[name] = { name, frames: m.frames, cols: m.cols || m.frames, rows: m.rows || 1, fps: m.fps || FPS, loop: m.loop !== false, w: m.w || fr0.w, h: m.h || fr0.h, tex: null };
    texLoader.load(spriteBase + name + '.webp', t => {
      if (destroyed) return t.dispose();
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
      c.tex = track(t); dirty = true;
    });
    return c;
  };
  ['idle2', 'point', 'excited', 'wave'].forEach(loadClip);
  const anim = { clip: 'idle2', t0: performance.now(), once: false, loops: 0, frame: -1, mirror: 1 };
  const play = (name, once = false, loops = 0) => {
    if (!loadClip(name)) return;
    Object.assign(anim, { clip: name, t0: performance.now(), once, loops });
  };

  // ----- deferred 2D art (waits for fonts + paper) -----
  let destroyed = false;
  const paperImg = new Image();
  const paperReady = new Promise(res => { paperImg.onload = () => res(paperImg); paperImg.onerror = () => res(null); });
  paperImg.src = opts.paperSrc || 'paper.jpg';
  const fontsReady = (async () => {
    try {
      await Promise.all(['600 40px Fraunces', '500 20px "Inter Tight"', '600 20px "Inter Tight"', '700 30px Caveat'].map(f => document.fonts.load(f)));
      await document.fonts.ready;
    } catch { /* fall back to whatever is loaded */ }
  })();

  (async () => {
    const img = await paperReady;
    drawStatic(img);
    await fontsReady;
    if (destroyed) return;
    cards.forEach((c, i) => {
      drawFace(c.face.image.getContext('2d'), c.item, img, 101 + i * 31);
      drawBorderMask(c.mask.image.getContext('2d'), 7 + i);
      c.face.needsUpdate = c.mask.needsUpdate = true;
    });
    dirty = true;
  })();

  function drawStatic(img) {
    if (destroyed) return;
    const r = rng(42);
    // pages: paper, stepped gutter wash, inked margin rule, pop-up slots
    pageTex.forEach((t, side) => {
      const cv = t.image, g = cv.getContext('2d'), W = cv.width, H = cv.height;
      paperFill(g, W, H, '#FBF5EA', img, 0.9, r);
      const gx = side ? 0 : W;
      g.fillStyle = 'rgba(90,81,96,0.06)'; g.fillRect(side ? 0 : W - W * 0.09, 0, W * 0.09, H);
      g.fillStyle = 'rgba(90,81,96,0.07)'; g.fillRect(side ? 0 : W - W * 0.03, 0, W * 0.03, H);
      inkStroke(g, gx + (side ? 3 : -3), 0, gx + (side ? 3 : -3), H, 3, 1.5, r, 'rgba(43,34,51,0.55)');
      const inset = 64;
      inkRect(g, side ? inset * 0.6 : inset, inset, W - inset * 1.6, H - inset * 2, 2.6, 2.4, r, 'rgba(90,81,96,0.45)');
      cards.forEach((c, i) => {
        const L = layout[i];
        const px = x => (x - (side ? 0 : -PW)) / PW * W, pz = z => (z + PD / 2) / PD * H;
        const dx = Math.cos(L.yaw) * cardW * 0.55, dz = -Math.sin(L.yaw) * cardW * 0.55;
        inkStroke(g, px(L.x - dx), pz(L.z - dz), px(L.x + dx), pz(L.z + dz), 4.5, 1.5, r, C.ink);
      });
      const px = x => (x - (side ? 0 : -PW)) / PW * W, pz = z => (z + PD / 2) / PD * H;
      g.strokeStyle = 'rgba(43,34,51,0.85)'; g.lineCap = 'round';
      for (let i = 1; i < THREAD.length; i++) {
        g.lineWidth = 3.4 + 1.6 * Math.sin(i * 0.09) * Math.sin(i * 0.023);
        g.beginPath(); g.moveTo(px(THREAD[i - 1][0]), pz(THREAD[i - 1][1])); g.lineTo(px(THREAD[i][0]), pz(THREAD[i][1])); g.stroke();
      }
      t.needsUpdate = true;
    });
    // leaves (plain pages)
    {
      const g = leafTex.image.getContext('2d'), W = leafTex.image.width, H = leafTex.image.height;
      paperFill(g, W, H, '#FBF5EA', img, 0.9, r);
      inkRect(g, 28, 30, W - 56, H - 60, 1.8, 1.6, r, 'rgba(90,81,96,0.4)');
      leafTex.needsUpdate = true;
    }
    // plain paper (card backs)
    { const g = paperTex.image.getContext('2d'); paperFill(g, 512, 512, '#F7EEDC', img, 0.8, r); paperTex.needsUpdate = true; }
    // cover: sage cloth, cream hand-drawn frame, a clay seal
    {
      const g = coverTex.image.getContext('2d'), W = coverTex.image.width, H = coverTex.image.height;
      paperFill(g, W, H, C.sage, img, 0.5, r);
      inkRect(g, 58, 58, W - 116, H - 116, 5, 3, r, 'rgba(255,245,226,0.85)');
      inkRect(g, 82, 82, W - 164, H - 164, 2.2, 2.5, r, 'rgba(255,245,226,0.55)');
      g.fillStyle = C.clay; g.beginPath(); g.arc(W / 2, H / 2, 62, 0, 6.283); g.fill();
      g.strokeStyle = C.ink; g.lineWidth = 5;
      g.beginPath();
      for (let a = 0; a <= 6.4; a += 0.2) g.lineTo(W / 2 + Math.cos(a) * (62 + (r() - 0.5) * 4), H / 2 + Math.sin(a) * (62 + (r() - 0.5) * 4));
      g.stroke();
      // tiny folded-paper star inside the seal
      g.strokeStyle = C.cream; g.lineWidth = 4; g.lineJoin = 'round'; g.beginPath();
      for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 14 : 34; g.lineTo(W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr); }
      g.stroke();
      coverTex.needsUpdate = true;
    }
    // page edges: fine inked lines
    {
      const g = edgeTex.image.getContext('2d'), W = 64, H = 256;
      g.fillStyle = '#F7EEDC'; g.fillRect(0, 0, W, H);
      for (let y = 3; y < H; y += 5 + r() * 4) { g.fillStyle = `rgba(90,81,96,${0.18 + r() * 0.25})`; g.fillRect(0, y, W, 1.4); }
      edgeTex.wrapS = THREE.RepeatWrapping;
      edgeTex.needsUpdate = true;
    }
    // soft contact blob
    {
      const g = blobTex.image.getContext('2d');
      g.filter = 'blur(9px)'; g.fillStyle = 'rgba(43,34,51,0.5)';
      g.beginPath(); g.ellipse(64, 32, 42, 14, 0, 0, 6.283); g.fill();
      blobTex.needsUpdate = true;
    }
    dirty = true;
  }

  // ----- camera path: pure function of p -----
  const K = [
    { p: 0.0, pos: [0.2, 10.4, 7.4], at: [0.0, 0.1, 0.5], fov: 30 },
    { p: 0.25, pos: [0.0, 9.6, 9.4], at: [0.2, 0.3, 0.3], fov: 30 },
    { p: 0.7, pos: [0.0, 6.3, 12.2], at: [0.1, 0.75, 0.0], fov: 30 },
    { p: 1.0, pos: [0.5, 3.0, 10.5], at: [0.2, 1.0, -0.1], fov: 30 },
  ];
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _t = new THREE.Vector3();
  function placeCamera(p) {
    if (reduced) p = 0.7;
    let i = 0; while (i < K.length - 2 && p > K[i + 1].p) i++;
    const A = K[i], B = K[i + 1], e = smooth(seg(p, A.p, B.p));
    _t.set(...A.at).lerp(_b.set(...B.at), e);
    _a.set(...A.pos).lerp(_b.set(...B.pos), e);
    // keep the spread in frame on narrow viewports: back the camera off along its view line
    const k = Math.max(1, 1.62 / camera.aspect) ** 0.82;
    camera.position.copy(_a.sub(_t).multiplyScalar(k).add(_t));
    camera.fov = lerp(A.fov, B.fov, e);
    camera.updateProjectionMatrix();
    camera.lookAt(_t);
  }

  // ----- choreography: pure function of p -----
  let progress = 0;
  const _w = new THREE.Vector3();
  function pose() {
    const p = progress;
    // 0 to .25: cover swings open, the book slides to centre, three leaves flutter over
    const tc = reduced ? smooth(seg(p, 0, 0.12)) : inOut(seg(p, 0.02, 0.17));
    leftPage.rotation.z = -Math.PI * (1 - tc);
    book.position.x = lerp(-(PW + OV) / 2, 0, reduced ? tc : inOut(seg(p, 0.0, 0.2)));
    book.rotation.y = lerp(-0.14, 0, tc);
    leaves.forEach((L, k) => {
      const t = seg(p, 0.045 + 0.025 * k, 0.165 + 0.025 * k);
      const e = inOut(t);
      const v = (inOut(clamp(t + 0.01)) - inOut(clamp(t - 0.01))) / 0.02;  // angular speed, 0 at lift-off and landing
      L.pivot.visible = !reduced && t < 1;
      L.pivot.rotation.z = Math.PI * e;
      // rests stacked above the right page's flat cards, lands just under the left page's surface
      L.mesh.position.y = lerp(0.052 + 0.016 * (LEAVES - 1 - k), 0.02 + 0.004 * k, e);
      L.u.uBend.value = -0.12 * v + 0.05 * v * Math.max(0, t - 0.5);  // tip lags while it flies, catches up as it lands
    });
    const showCards = tc > 0.4;

    // .2 to .7: cards fold up one by one, hinged at the base, overshoot + settle, paper flex while moving
    cards.forEach((c, i) => {
      let a, flex = 0;
      if (reduced) { a = smooth(seg(p, 0.16, 0.26)); }
      else {
        const s = n > 1 ? 0.235 + i * (0.265 / (n - 1)) : 0.3, d = n > 1 ? 0.2 : 0.3;
        const t = seg(p, s, s + d);
        a = rise(t);
        const h = 0.01, v = (rise(clamp(t + h)) - rise(clamp(t - h))) / (2 * h);
        flex = -0.03 * v;
      }
      c.open = a;
      c.root.visible = showCards;
      c.hinge.rotation.x = -Math.PI / 2 * (1 - a);
      c.root.position.y = 0.022 * (1 - clamp(a));
      c.u.uBend.value = flex;
    });

    // the character pops up first, then billboards to face the camera
    const ct = reduced ? smooth(seg(p, 0.14, 0.24)) : rise(seg(p, 0.215, 0.33));
    charMesh.visible = showCards;
    charHinge.rotation.x = -Math.PI / 2 * (1 - ct);
    charRoot.position.y = 0.036 * (1 - clamp(ct)) + 0.002;
    blob.material.opacity = clamp(ct);

    // drag
    world.rotation.set(drag.pitch, drag.yaw, 0);
    placeCamera(p);

    // billboard him about Y (world yaw minus the book's own yaw)
    charRoot.getWorldPosition(_w);
    const face = Math.atan2(camera.position.x - _w.x, camera.position.z - _w.z) - drag.yaw - book.rotation.y;
    charYaw.rotation.y = face * clamp(ct);
    charMat.uniforms.uShade.value = lerp(0.9, 1, clamp(ct));

    // hover: lift and tilt toward the pointer
    cards.forEach(c => {
      const h = c.hov;
      c.hover.position.set(0, 0.13 * h, 0.06 * h);
      c.hover.rotation.set(-0.05 * h + c.ay * 0.14 * h, c.ax * 0.3 * h, 0);
      c.ink.value.copy(inkColor).lerp(hoverInk, h);
    });
  }

  // ----- sprite animation -----
  function updateSprite(now) {
    const hovered = activeCard();
    const base = hovered ? 'point' : 'idle2';
    if (!anim.once && anim.clip !== base) play(base);
    let clip = clips[anim.clip];
    if (!clip || !clip.tex) clip = clips.idle2;
    if (!clip || !clip.tex) return false;
    let f = Math.floor((now - anim.t0) / 1000 * clip.fps);
    if (anim.once && f >= clip.frames * Math.max(1, anim.loops)) {
      play(base); clip = clips[base]?.tex ? clips[base] : clips.idle2; f = 0;
    }
    f = reduced ? 0 : clip.loop || !anim.once ? f % clip.frames : Math.min(f, clip.frames - 1);  // reduced motion: hold a still pose
    // point to screen right by default; mirror when the card sits left of him on screen
    let mirror = 1;
    if (hovered && clip.name === 'point') {
      const a = charRoot.getWorldPosition(_a).project(camera).x;
      const b = hovered.hover.getWorldPosition(_b).project(camera).x;
      mirror = b < a ? -1 : 1;
    }
    const key = clip.name + f + mirror;
    if (key === anim.frame) return false;
    anim.frame = key;
    const U = charMat.uniforms;
    U.map.value = clip.tex;
    { const col = f % clip.cols, row = Math.floor(f / clip.cols);   // textures are flipped: row 0 is the top of the sheet
      U.uFrame.value.set(col / clip.cols, 1 - (row + 1) / clip.rows, 1 / clip.cols, 1 / clip.rows); U.uMirror.value = mirror; }
    U.uR1.value.set(6 / clip.w, 6 / clip.h); U.uR2.value.set(10 / clip.w, 10 / clip.h);
    return true;
  }

  // ----- interaction -----
  const drag = { on: false, id: null, x0: 0, y0: 0, moved: false, yaw: 0, pitch: 0, vy: 0, vp: 0, ty: 0, tp: 0, sy: 0, sp: 0 };
  const pointer = new THREE.Vector2(), ray = new THREE.Raycaster();
  let pointerIn = false, pointerDirty = false, hoverCard = null, extHover = null;
  const activeCard = () => hoverCard || cards.find(c => c.item.id === extHover) || null;

  const setPointer = e => {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    pointerIn = true; pointerDirty = true; dirty = true;
  };
  const onDown = e => {
    if (e.button !== 0) return;
    setPointer(e);
    Object.assign(drag, { on: true, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, sy: drag.ty, sp: drag.tp });
  };
  const onMove = e => {
    setPointer(e);
    if (!drag.on || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) > 6) {
      drag.moved = true;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      canvas.style.cursor = 'grabbing';
    }
    if (drag.moved) {
      const lim = 0.61; // ~35 degrees
      drag.ty = lim * Math.tanh((drag.sy + dx * 0.006) / lim);
      drag.tp = 0.14 * Math.tanh((drag.sp + dy * 0.0025) / 0.14);
    }
  };
  const onUp = e => {
    if (!drag.on || e.pointerId !== drag.id) return;
    drag.on = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!drag.moved && e.type === 'pointerup') {
      setPointer(e); hoverTest();
      if (hoverCard) { opts.onPick?.(hoverCard.item); react('excited'); }
    }
    drag.ty = drag.tp = 0; drag.sy = drag.sp = 0;
    canvas.style.cursor = hoverCard ? 'pointer' : 'grab';
    dirty = true;
  };
  const onLeave = () => { pointerIn = false; pointerDirty = true; dirty = true; };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);

  function hoverTest() {
    pointerDirty = false;
    let hit = null;
    if (pointerIn && !(drag.on && drag.moved)) {
      scene.updateMatrixWorld();
      ray.setFromCamera(pointer, camera);
      const targets = cards.filter(c => c.root.visible && c.open > 0.6).map(c => c.proxy);
      const h = ray.intersectObjects(targets, false)[0];
      if (h) {
        hit = h.object.userData.card;
        hit.tx = clamp((h.uv.x - 0.5) * 2, -1, 1);
        hit.ty = clamp((h.uv.y - 0.5) * 2, -1, 1);
      }
    }
    if (hit !== hoverCard) {
      hoverCard = hit;
      opts.onHover?.(hit ? hit.item : null);
      if (!drag.on) canvas.style.cursor = hit ? 'pointer' : 'grab';
    }
  }

  function stepDrag(dt) {
    if (drag.on) {
      const k = 1 - Math.exp(-dt * 16);
      const py = drag.yaw, pp = drag.pitch;
      drag.yaw += (drag.ty - drag.yaw) * k; drag.pitch += (drag.tp - drag.pitch) * k;
      drag.vy = (drag.yaw - py) / Math.max(dt, 1e-3); drag.vp = (drag.pitch - pp) / Math.max(dt, 1e-3);
    } else {
      // spring back to rest, slightly underdamped
      for (const [x, v] of [['yaw', 'vy'], ['pitch', 'vp']]) {
        drag[v] += (-70 * drag[x] - 11 * drag[v]) * dt;
        drag[x] += drag[v] * dt;
      }
    }
    const moving = Math.abs(drag.yaw) + Math.abs(drag.pitch) + Math.abs(drag.vy) + Math.abs(drag.vp) > 1e-4;
    if (!moving && !drag.on) drag.yaw = drag.pitch = drag.vy = drag.vp = 0;
    return moving || drag.on;
  }

  function stepHover(dt) {
    const act = activeCard();
    let busy = false;
    const k = 1 - Math.exp(-dt * (reduced ? 30 : 11));
    for (const c of cards) {
      const on = c === act ? 1 : 0;
      const tx = c === hoverCard ? c.tx : 0, ty = c === hoverCard ? c.ty : 0;
      c.hov += (on - c.hov) * k; c.ax += (tx - c.ax) * k; c.ay += (ty - c.ay) * k;
      if (Math.abs(on - c.hov) + Math.abs(tx - c.ax) + Math.abs(ty - c.ay) > 1e-3) busy = true;
      else { c.hov = on; c.ax = tx; c.ay = ty; }
    }
    return busy;
  }

  function react(kind) {
    const m = manifest[kind];
    if (!m) return;
    play(kind, true, m.loop === false ? 1 : 2);
    dirty = true;
  }

  // ----- loop: render only when on screen and only when something changed -----
  let dirty = true, visible = false, last = performance.now(), lastStep = -1, running = false;
  let frameMs = 0;
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let busy = dirty; dirty = false;
    busy = stepDrag(dt) || busy;
    busy = stepHover(dt) || busy;
    const step = Math.floor(now / (1000 / FPS));
    if (step !== lastStep) {
      lastStep = step;
      if (!reduced) { boilF.value = step % 3; boil.value = step % 61; busy = true; }
      if (updateSprite(now)) busy = true;
    }
    if (!busy) return;
    const t0 = performance.now();
    pose();
    if (pointerDirty) hoverTest();
    renderer.render(scene, camera);
    frameMs = frameMs * 0.9 + (performance.now() - t0) * 0.1;
  }
  const setRunning = on => {
    if (on === running) return;
    running = on; last = performance.now();
    renderer.setAnimationLoop(on ? tick : null);
  };

  const resize = () => {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    dirty = true;
  };
  const ro = new ResizeObserver(resize); ro.observe(container);
  const io = new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; setRunning(visible); }, { rootMargin: '120px' });
  io.observe(container);
  resize();

  return {
    setProgress(p) { const v = clamp(+p || 0); if (v !== progress) { progress = v; dirty = true; } },
    setHover(id) { extHover = id ?? null; dirty = true; },
    react,
    get frameMs() { return frameMs; },
    destroy() {
      destroyed = true;
      setRunning(false);
      ro.disconnect(); io.disconnect();
      mq.removeEventListener?.('change', onMq);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      scene.traverse(o => {
        if (o.geometry) disposables.add(o.geometry);
        if (o.material) [].concat(o.material).forEach(m => disposables.add(m));
        if (o.customDepthMaterial) disposables.add(o.customDepthMaterial);
      });
      disposables.forEach(d => d.dispose?.());
      key.shadow.map?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
