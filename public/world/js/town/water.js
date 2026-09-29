// The town's water in three draw calls, with no reflection targets and no depth textures:
//   1. the sea to the horizon and the river's surface, one geometry and one ShaderMaterial: ripples and small
//      waves from summed moving waves (the river's carried along its flow), a fresnel tint from deep to shallow
//      and the sky's colour, sun glints and sparkles by day and a moon path by night, and foam along every
//      shore, canal wall and waterfall foot, from a small baked texture of the distance to land (R) and the
//      foam sources (G). The pattern is sampled per voxel cell, so the water reads at the town's fineness.
//   2. the waterfall over the sea cliff and the little cascades upstream: ribbons of scrolling bands of white
//      and pale blue, see-through at their edges.
//   3. spray and mist at the waterfall's foot: one cloud of points animated in its vertex shader.
// buildWater(THREE) -> { group, update(t, night, camera), stats }
import { raster, KIND, RIVER, V, distanceTo, toSeg, LEVEL } from './plan.js';

const COMMON = /* glsl */ `
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }`;

export function buildWater(THREE) {
  const t0 = performance.now();
  const R = raster();
  const { nx, nz, i0, k0 } = R;
  const water = (n) => R.kind[n] === KIND.SEA || R.kind[n] === KIND.RIVER || R.kind[n] === KIND.BRIDGE;
  const dist = distanceTo(R, (n) => !water(n)); // columns from each water column to the nearest land

  // ---- the falls: the waterfall at the river's end, and a cascade wherever its level steps down
  const falls = [];
  for (let s = 1; s < RIVER.length; s += 1) {
    const [ax, az, al, aw] = RIVER[s - 1], [bx, bz, bl] = RIVER[s];
    if (al === bl || s === RIVER.length - 1) continue;
    falls.push({ at: [(ax + bx) / 2, (az + bz) / 2], dir: [bx - ax, bz - az], w: aw + 0.2, top: al * V, bottom: bl * V, out: 0.15 });
  }
  const lip = RIVER[RIVER.length - 1], prev = RIVER[RIVER.length - 2];
  let lipAt = [lip[0], lip[1]];
  { // the lip: the last column of river water along the flow, where the land ends
    const d = Math.hypot(lip[0] - prev[0], lip[1] - prev[1]), ux = (lip[0] - prev[0]) / d, uz = (lip[1] - prev[1]) / d;
    for (let s = -2; s < 3; s += 0.05) {
      const x = lip[0] + ux * s, z = lip[1] + uz * s, n = (Math.floor(z / V) - k0) * nx + (Math.floor(x / V) - i0);
      if (R.kind[n] === KIND.RIVER) lipAt = [x + ux * 0.08, z + uz * 0.08];
    }
  }
  const fall = { at: lipAt, dir: [lip[0] - prev[0], lip[1] - prev[1]], w: lip[3] + 0.3, top: lip[2] * V, bottom: -0.05, out: 1.1, main: true };
  falls.push(fall);
  const foot = [lipAt[0] + (fall.dir[0] / Math.hypot(...fall.dir)) * 1.2, lipAt[1] + (fall.dir[1] / Math.hypot(...fall.dir)) * 1.2];

  // ---- the shore texture: distance to land (R: 0 at the water's edge, 1 six units out), foam sources (G)
  const TS = 512, shore = new Uint8Array(TS * TS * 4), rect = new THREE.Vector4(i0 * V, k0 * V, nx * V, nz * V);
  for (let b = 0; b < TS; b += 1) for (let a = 0; a < TS; a += 1) {
    const i = Math.min(nx - 1, Math.floor(((a + 0.5) / TS) * nx)), k = Math.min(nz - 1, Math.floor(((b + 0.5) / TS) * nz)), n = k * nx + i;
    const x = (i + i0 + 0.5) * V, z = (k + k0 + 0.5) * V, m = (b * TS + a) * 4;
    shore[m] = water(n) ? Math.min(255, (dist[n] * V / 6) * 255) : 0;
    let src = Math.max(0, 1 - Math.hypot(x - foot[0], z - foot[1]) / 3.6) ** 1.5;
    for (const f of falls) if (!f.main) src = Math.max(src, Math.max(0, 1 - Math.hypot(x - f.at[0] - f.dir[0] * 0.02, z - f.at[1] - f.dir[1] * 0.02) / 1.6));
    shore[m + 1] = Math.min(255, src * 255);
    shore[m + 2] = R.kind[n] === KIND.RIVER || R.kind[n] === KIND.BRIDGE ? 255 : 0;
    shore[m + 3] = 255;
  }
  const shoreTex = new THREE.DataTexture(shore, TS, TS, THREE.RGBAFormat);
  shoreTex.magFilter = THREE.LinearFilter; shoreTex.minFilter = THREE.LinearFilter; shoreTex.needsUpdate = true;

  // ---- the sea and the river's surface: one geometry. kind 0 is sea, 1 river (its flow in `flow`)
  const pos = [], flow = [], kind = [], idx = [];
  const quad = (x0, z0, x1, z1, y, k, fx, fz) => {
    const v = pos.length / 3;
    pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
    for (let q = 0; q < 4; q += 1) { flow.push(fx, fz); kind.push(k); }
    idx.push(v, v + 2, v + 1, v, v + 3, v + 2);
  };
  const S = 1600;
  quad(-S, -S, S, S, 0, 0, 0.05, 0.03);
  const riverQ = (x, z) => { let best = null; for (let s = 1; s < RIVER.length; s += 1) { const q = toSeg(x, z, RIVER[s - 1][0], RIVER[s - 1][1], RIVER[s][0], RIVER[s][1]); if (!best || q.d < best.d) best = { ...q, s }; } return best; };
  for (let k = 0; k < nz; k += 1) {
    let i = 0;
    while (i < nx) {
      const n = k * nx + i;
      if (!(R.kind[n] === KIND.RIVER || R.kind[n] === KIND.BRIDGE) || R.water[n] < 0) { i += 1; continue; }
      const lvl = R.water[n];
      let j = i + 1;
      while (j < nx && (R.kind[k * nx + j] === KIND.RIVER || R.kind[k * nx + j] === KIND.BRIDGE) && R.water[k * nx + j] === lvl) j += 1;
      const x0 = (i + i0) * V, x1 = (j + i0) * V, z0 = (k + k0) * V, z1 = z0 + V;
      const q = riverQ((x0 + x1) / 2, z0 + V / 2), a = RIVER[q.s - 1], b = RIVER[q.s], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const speed = lvl <= LEVEL.low - 6 ? 0.35 : 0.9;
      quad(x0, z0, x1, z1, lvl * V - 0.04, 1, ((b[0] - a[0]) / L) * speed, ((b[1] - a[1]) / L) * speed);
      i = j;
    }
  }
  const surf = new THREE.BufferGeometry();
  surf.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  surf.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 2));
  surf.setAttribute('kind', new THREE.Float32BufferAttribute(kind, 1));
  surf.setIndex(idx);
  surf.computeBoundingSphere();

  const U = {
    uTime: { value: 0 }, uNight: { value: 1 }, uShore: { value: shoreTex }, uRect: { value: rect },
    uSun: { value: new THREE.Vector3(0.5, 0.7, 0.4).normalize() }, uMoon: { value: new THREE.Vector3(-0.3, 0.62, -0.72).normalize() },
    uFoot: { value: new THREE.Vector2(...foot) },
  };
  const seaMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, U]),
    fog: true,
    vertexShader: /* glsl */ `
      attribute vec2 flow; attribute float kind;
      varying vec3 vWp; varying vec2 vFlow; varying float vKind;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWp = wp.xyz; vFlow = flow; vKind = kind;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uNight; uniform sampler2D uShore; uniform vec4 uRect; uniform vec3 uSun, uMoon; uniform vec2 uFoot;
      varying vec3 vWp; varying vec2 vFlow; varying float vKind;
      #include <fog_pars_fragment>
      ${COMMON}
      // a height field of moving swells, and ripples that show only up close (they would shimmer far away)
      float waves(vec2 p, vec2 q, float t, float fine) {
        float h = 0.0;
        h += sin(dot(p, vec2(0.21, 0.13)) * 1.0 + t * 0.9) * 0.5;
        h += sin(dot(p, vec2(-0.17, 0.26)) * 1.3 + t * 1.1) * 0.35;
        h += sin(dot(p, vec2(0.45, -0.31)) * 1.1 - t * 1.4) * 0.22;
        h += (vnoise(p * 0.9 + vec2(t * 0.25, -t * 0.2)) - 0.5) * 0.6;
        h += fine * (vnoise(q * 2.6 + vec2(t * 0.6, -t * 0.4)) - 0.5) * 0.35;
        h += fine * (vnoise(q * 5.3 - vec2(t * 0.9, t * 0.7)) - 0.5) * 0.18;
        return h;
      }
      void main() {
        float river = vKind;
        float far = length(cameraPosition - vWp), fine = 1.0 - smoothstep(22.0, 60.0, far);
        vec2 pp = vWp.xz - vFlow * uTime * 1.6 * river;
        vec2 cellP = (floor(vWp.xz / 0.15) + 0.5) * 0.15; // one voxel cell
        vec2 q = cellP - vFlow * uTime * 1.6 * river;
        float t = uTime;
        float e = 0.2;
        float h0 = waves(pp, q, t, fine), hx = waves(pp + vec2(e, 0.0), q + vec2(e, 0.0), t, fine), hz = waves(pp + vec2(0.0, e), q + vec2(0.0, e), t, fine);
        float amp = mix(0.32, 0.7, river) * mix(0.7, 1.0, fine);
        vec3 N = normalize(vec3(-(hx - h0) / e * amp, 1.0, -(hz - h0) / e * amp));
        vec3 Vd = normalize(cameraPosition - vWp);
        vec2 suv = (vWp.xz - uRect.xy) / uRect.zw;
        vec4 sh = (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) ? texture2D(uShore, suv) : vec4(1.0, 0.0, 0.0, 1.0);
        float d = mix(sh.r, 1.0, 0.0), src = sh.g;
        // colours by day and night
        vec3 deep = mix(vec3(0.11, 0.39, 0.53), vec3(0.018, 0.05, 0.13), uNight);
        vec3 shallow = mix(vec3(0.30, 0.72, 0.70), vec3(0.04, 0.17, 0.25), uNight);
        vec3 rdeep = mix(vec3(0.10, 0.33, 0.30), vec3(0.02, 0.07, 0.10), uNight);
        vec3 rshal = mix(vec3(0.24, 0.52, 0.44), vec3(0.05, 0.16, 0.18), uNight);
        vec3 sky = mix(vec3(0.80, 0.92, 0.98), vec3(0.14, 0.17, 0.38), uNight);
        vec3 foamC = mix(vec3(0.93, 0.98, 0.97), vec3(0.42, 0.86, 0.98), uNight); // by night the surf glows faintly, like plankton
        float depthK = mix(smoothstep(0.0, 0.55, d), smoothstep(0.0, 0.16, d), river);
        vec3 col = mix(mix(shallow, deep, depthK), mix(rshal, rdeep, depthK), river);
        float fres = pow(1.0 - clamp(dot(N, Vd), 0.0, 1.0), 4.0);
        col = mix(col, sky, fres * mix(0.75, 0.45, uNight));
        // glints: the sun by day, the moon at night; sparkles where the waves face the light
        vec3 L = normalize(mix(uSun, uMoon, uNight));
        float rv = max(dot(reflect(-L, N), Vd), 0.0);
        float spec = pow(rv, mix(160.0, 90.0, uNight));
        float path = pow(rv, mix(40.0, 70.0, uNight)); // the path of light the glints fall in
        float sp = step(mix(0.955, 0.975, uNight), h21(floor(vWp.xz / 0.15) + floor(t * 4.0 + h21(floor(vWp.xz / 0.15)) * 7.0)));
        vec3 glintC = mix(vec3(1.0, 0.95, 0.82), vec3(0.85, 0.9, 1.0), uNight);
        float glitter = mix(0.22 * fine + smoothstep(0.2, 0.7, path), smoothstep(0.3, 0.8, path), uNight); // by day wavelets glint everywhere near us
        col += glintC * (spec * mix(1.0, 0.55, uNight) * mix(0.35, 1.0, fine) * mix(1.0, 0.35, river) + path * mix(0.06, 0.1, uNight) + sp * glitter * mix(1.0, 0.85, uNight));
        // foam: a line at every edge, waves of it rolling in, and the churn at the falls' feet
        float edge = mix(smoothstep(0.07, 0.0, d), smoothstep(0.05, 0.0, d), river);
        float roll = smoothstep(0.55, 0.9, sin(d * 38.0 - t * 1.7 + vnoise(cellP * 0.8) * 5.0) * 0.5 + 0.5) * smoothstep(0.32, 0.04, d) * (1.0 - river);
        float churn = src * (0.55 + 0.45 * vnoise(cellP * 2.3 + vec2(t * 1.9, -t * 1.3)));
        float bits = step(0.62, vnoise(cellP * 3.0 + vec2(t * 0.8, t * 0.5)));
        float foam = clamp(edge * (0.55 + 0.45 * bits) + roll * 0.7 * bits + churn * 1.2, 0.0, 1.0);
        col = mix(col, foamC, foam * mix(0.85, 0.7, uNight));
        col += vec3(0.0, 0.10, 0.13) * uNight * smoothstep(0.35, 0.0, d) * (1.0 - river); // and the shallows with it
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  const surface = new THREE.Mesh(surf, seaMat);
  surface.frustumCulled = false;
  surface.renderOrder = -1;
  surface.name = 'water';

  // ---- the falls: ribbons from lip to foot, curving out as they drop
  const fp = [], fuv = [], fw = [], fi = [];
  for (const f of falls) {
    const L = Math.hypot(...f.dir), ux = f.dir[0] / L, uz = f.dir[1] / L, px = -uz, pz = ux;
    const rows = f.main ? 16 : 4, cols = f.main ? 6 : 3, v0 = fp.length / 3;
    for (let r = 0; r <= rows; r += 1) {
      const s = r / rows, y = f.top + (f.bottom - f.top) * s, out = f.out * Math.sqrt(s) + 0.02;
      for (let c = 0; c <= cols; c += 1) {
        const a = c / cols - 0.5, w = f.w * (1 + (f.main ? 0.25 * s : 0));
        fp.push(f.at[0] + ux * out + px * a * w, y, f.at[1] + uz * out + pz * a * w);
        fuv.push(c / cols, s); fw.push(f.main ? 1 : 0);
      }
    }
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
      const a = v0 + r * (cols + 1) + c, b = a + cols + 1;
      fi.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  fg.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
  fg.setAttribute('isMain', new THREE.Float32BufferAttribute(fw, 1));
  fg.setIndex(fi);
  fg.computeBoundingSphere();
  const fallMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: U.uTime, uNight: U.uNight }]),
    fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute float isMain; varying vec2 vUv; varying float vMain; varying vec3 vWp;
      #include <fog_pars_vertex>
      void main() { vUv = uv; vMain = isMain; vec4 wp = modelMatrix * vec4(position, 1.0); vWp = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uNight; varying vec2 vUv; varying float vMain; varying vec3 vWp;
      #include <fog_pars_fragment>
      ${COMMON}
      void main() {
        vec2 c = floor(vec2(vUv.x * mix(14.0, 18.0, vMain), vWp.y / 0.15));   // voxel-sized cells down the sheet
        float fallT = uTime * mix(2.2, 3.4, vMain);
        float streak = vnoise(vec2(c.x * 0.9, c.y * 0.35 + fallT * 1.2)) * 0.6 + vnoise(vec2(c.x * 2.1, c.y * 0.8 + fallT * 2.0)) * 0.4;
        float band = step(0.5, fract(c.y * 0.11 + fallT * 0.35 + h21(vec2(c.x, 1.0)) * 0.6));
        vec3 white = mix(vec3(0.95, 0.98, 1.0), vec3(0.62, 0.74, 0.92), uNight);
        vec3 pale = mix(vec3(0.62, 0.84, 0.92), vec3(0.22, 0.34, 0.56), uNight);
        vec3 col = mix(pale, white, smoothstep(0.35, 0.75, streak) * 0.8 + band * 0.2);
        col = mix(col, white * 1.08, smoothstep(0.12, 0.0, vUv.y) * vMain); // the lip, white where it breaks over
        float sides = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
        float a = sides * mix(0.72, 0.9, streak) * mix(1.0, 1.0 - smoothstep(0.82, 1.0, vUv.y) * 0.6, vMain);
        a *= 1.0 - step(0.86, h21(c + floor(fallT * 4.0))) * 0.5;
        gl_FragColor = vec4(col, a);
        #include <fog_fragment>
      }`,
  });
  fallMat.uniforms.uTime = seaMat.uniforms.uTime; fallMat.uniforms.uNight = seaMat.uniforms.uNight;
  const sheet = new THREE.Mesh(fg, fallMat);
  sheet.name = 'falls';

  // ---- spray and mist at the waterfall's foot: points rising and drifting, each on its own loop
  const NP = 180, sp = new Float32Array(NP * 3), seed = new Float32Array(NP);
  for (let q = 0; q < NP; q += 1) { sp.set([foot[0], 0.05, foot[1]], q * 3); seed[q] = (q * 0.618034) % 1; }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  sg.boundingSphere = new THREE.Sphere(new THREE.Vector3(foot[0], 2, foot[1]), 6);
  const sprayMat = new THREE.ShaderMaterial({
    uniforms: { uTime: seaMat.uniforms.uTime, uNight: seaMat.uniforms.uNight, uScale: { value: 400 }, uDir: { value: new THREE.Vector2(fall.dir[0], fall.dir[1]).normalize() } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float seed; uniform float uTime, uScale; uniform vec2 uDir; varying float vA; varying float vMist;
      float h(float n) { return fract(sin(n * 91.7) * 43758.5453); }
      void main() {
        float mist = step(0.8, seed);
        float life = mix(1.6, 4.5, mist), ph = fract(uTime / life + seed * 7.13), a = seed * 40.0;
        vec3 p = position;
        float r = mix(0.3, 1.2, h(seed * 3.1)) + ph * mix(1.4, 2.8, mist);
        p.x += cos(a) * r + uDir.x * (0.6 + ph); p.z += sin(a) * r * 0.7 + uDir.y * (0.6 + ph);
        p.y += mix(ph * (2.2 - ph * 1.6) * 1.4, 0.2 + ph * 1.8, mist);
        vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = mix(0.16, 1.1, mist) * uScale / -mv.z;
        vA = (1.0 - ph) * smoothstep(0.0, 0.1, ph) * mix(0.7, 0.16, mist); vMist = mist;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uNight; varying float vA; varying float vMist;
      void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c);
        float k = vMist > 0.5 ? smoothstep(0.5, 0.0, d) : step(d, 0.5);
        gl_FragColor = vec4(mix(vec3(0.95, 0.98, 1.0), vec3(0.6, 0.72, 0.95), uNight) * vA * k, 1.0); }`,
  });
  const spray = new THREE.Points(sg, sprayMat);
  spray.name = 'spray';

  const group = new THREE.Group();
  group.name = 'town-water';
  group.add(surface, sheet, spray);
  const sunDir = new THREE.Vector3();
  return {
    group, falls, foot, shoreTex, rect,
    stats: { ms: Math.round(performance.now() - t0), quads: idx.length / 6, falls: falls.length },
    update(t, night, sun, pxScale) {
      const u = seaMat.uniforms;
      u.uTime.value = t;
      u.uNight.value = night;
      if (sun) u.uSun.value.copy(sunDir.copy(sun).normalize());
      sprayMat.uniforms.uScale.value = pxScale || 400;
    },
  };
}
