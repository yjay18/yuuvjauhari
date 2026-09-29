// The Lighthouse's models. Each export returns a rig definition (origin at its base centre, facing
// +z, 0.15 a voxel, colours prefixed lh_).
//
//   lighthouse()   coursed pale stone on a rocky point, a slate band spiralling up it with a line of
//                  circuit light in it (a pulse runs up the line), lit windows up the stair, a gallery
//                  with an iron rail, a lantern room whose crystal lens turns and throws two soft beams
//                  (ctx.mem.beams: cones a little over the horizon that fade out from the lantern and near the
//                  camera and screen onto what is behind them; their strength is ctx.mem.beamMat.uniforms.uStrength),
//                  a copper dome, a crystal finial and a weathervane shaped like a paper plane
//   cottage()      the keeper's cottage: rubble stone, a slate roof, a lit window, a chimney that smokes,
//                  parcels stacked by the door
//   mailbox()      a red iron letterbox on a post, its slot glowing, a flag that goes up when a letter
//                  goes out (ctx.send()), and the joke: a carrier pigeon on top in a tiny postal cap with
//                  a satchel, who is startled by every paper plane and glares after it
//   telescope()    a brass telescope on a wooden tripod, slowly sweeping the sky
//   plane()        a paper plane (its flight is steered by the district)
import { C, colour, hash, noise } from '../kit/voxel-kit.js';
import { box, tone, smooth, clamp01 } from './space.js';

const col = (name, hex, glow = false) => C[name] ?? colour(name, hex, glow);
for (const [n, hex, glow] of [
  ['s1', 0xdcd5c6], ['s2', 0xcbc3b1], ['s3', 0xb8b09c], ['s4', 0xa39a86], ['mortar', 0x57524a],
  ['slate1', 0x4c5470], ['slate2', 0x3e4560], ['slate3', 0x5a6280], ['trace', 0x3fe6ff, true], ['via', 0xd8fdff, true], ['pulse', 0xffffff, true],
  ['rock1', 0x7a766f], ['rock2', 0x686460], ['rock3', 0x8c877e], ['rock4', 0x57534e], ['lichen1', 0xa6b06a], ['lichen2', 0xc9bb72], ['moss1', 0x4f6a35], ['moss2', 0x6a8a44],
  ['shard1', 0xe6fdff, true], ['shard2', 0x9b7bff, true],
  ['win1', 0xffd98a, true], ['win2', 0xffb347, true], ['frame', 0x4a3a2a],
  ['door1', 0x5a3a22], ['door2', 0x6e4a2a], ['stud', 0x9a9aa2],
  ['iron1', 0x2a2830], ['iron2', 0x3c3a44], ['iron3', 0x5c5a66],
  ['cu1', 0x3f8f7a], ['cu2', 0x52a88f], ['cu3', 0x2f6e5e], ['cuRib', 0x245548],
  ['lens1', 0xfffbe8, true], ['lens2', 0xffe08a, true], ['lens3', 0x9ff8ff, true], ['lens4', 0xffc764, true],
  ['fin1', 0xe6fdff, true], ['fin2', 0xb89cff, true],
  ['rub1', 0x9a938a], ['rub2', 0x857e74], ['rub3', 0xaba396], ['rub4', 0x6f6962], ['plaster', 0xe4ddcf],
  ['roof1', 0x3a4254], ['roof2', 0x465068], ['roof3', 0x323a4a], ['ridge', 0x2a303c],
  ['timber', 0x4a3220], ['shutter', 0x3a6a98], ['shutter2', 0x2e5a84], ['pot', 0x9a5a3c], ['soot', 0x3a3634],
  ['flowerR', 0xd8434a], ['flowerY', 0xf2c84a], ['flowerV', 0x9a5bd6], ['leaf', 0x4f8336],
  ['parcel1', 0xb88a5a], ['parcel2', 0xa47848], ['string', 0xe8dcc0], ['seal', 0xb3322a],
  ['log1', 0x6e4a2a], ['log2', 0x8a6238], ['logEnd', 0xc8a070],
  ['red1', 0xb3322a], ['red2', 0x962824], ['red3', 0xc84a3c], ['slot', 0x6ff2ff, true], ['env', 0xfff4dc, true],
  ['post1', 0x5a3b24], ['post2', 0x6e4a2a],
  ['pg1', 0x9aa0ac], ['pg2', 0x868c98], ['pg3', 0xb4b9c4], ['pgBar', 0x4a4e5a], ['pgNeck1', 0x4f9a7a], ['pgNeck2', 0x8a5aa8], ['pgFoot', 0xd88a8a],
  ['pgEye', 0xffa040, true], ['beak', 0x2e2a28], ['cere', 0xe8e0d8], ['capBlue', 0x2a3a6a], ['capBadge', 0xf0c24a],
  ['satchel', 0x6a4a2e], ['satchel2', 0x7e5a38], ['letter', 0xf6f0e2],
  ['brass1', 0x8a6a26], ['brass2', 0xc49c3e], ['brass3', 0xe0b85a], ['tripod1', 0x5a3b24], ['tripod2', 0x6e4a2a], ['scopeLens', 0x9ff8ff, true],
  ['paper1', 0xfbf8f0], ['paper2', 0xe8e2d4], ['paper3', 0xd4ccba], ['paperGlow', 0x9ff8ff, true],
]) col(`lh_${n}`, hex, glow);
const K = (n) => C[`lh_${n}`];
const mod = (a, n) => ((a % n) + n) % n;
const STONE = [K('s1'), K('s1'), K('s2'), K('s2'), K('s3'), K('s4')];

// Where things are on the lighthouse (model voxels): the lens's centre, the door, the spiral's pitch.
export const TOWER = { lens: 76, door: [0, 11], top: 97, rail: 10.5, turn: 44, r0: 9.6, r1: 7.4, y0: 5, y1: 68 };
const radiusAt = (y) => TOWER.r0 + (TOWER.r1 - TOWER.r0) * clamp01((y - TOWER.y0) / (TOWER.y1 - TOWER.y0));
// The spiral band: where round the shaft (0..1 of a turn) its middle is at height y.
const bandAt = (y) => mod(0.08 + (y - TOWER.y0) / TOWER.turn, 1);

// ---------------------------------------------------------------------------------------------
export function lighthouse() {
  return {
    gait: 'still',
    build() {
      const b = box([-20, -2, -20], [19, 98, 19]);
      const ang = (x, z) => mod(Math.atan2(x + 0.5, z + 0.5) / (Math.PI * 2), 1); // 0 at the front (+z), turning toward +x
      // ---- the rocky point it stands on: boulders, lichen on their tops, moss at their feet, crystal shards
      for (let z = -20; z <= 19; z += 1) for (let x = -20; x <= 19; x += 1) {
        const r = Math.hypot(x + 0.5, z + 0.5), n = noise(x, z, 4, 3), h = Math.round((1 - (r - 10) / 9) * 7 * (0.4 + n)) - (z > 6 && Math.abs(x) < 5 ? 5 : 0);
        if (r < 10 || r > 19.5 || h < 0) continue;
        for (let y = -2; y <= h; y += 1) {
          let id = [K('rock1'), K('rock2'), K('rock3'), K('rock1'), K('rock4')][mod(Math.floor((y + noise(x, z, 3, 5) * 3) / 2) + Math.floor(hash(Math.floor(x / 3), Math.floor(z / 3), 2) * 3), 5)];
          if (y === h && noise(x + 7, z, 3, 8) > 0.55) id = hash(x, z, 1) < 0.5 ? K('lichen1') : K('lichen2');
          if (y <= 0 && noise(x, z + 9, 3, 9) > 0.5) id = hash(x, y, z) < 0.5 ? K('moss1') : K('moss2');
          b.put(x, y, z, id);
        }
        if (h > 2 && hash(x, z, 17) > 0.975) { b.put(x, h + 1, z, K('shard1')); b.put(x, h + 2, z, hash(x, z, 18) < 0.5 ? K('shard2') : K('shard1')); }
      }
      // ---- the plinth: two stepped courses of big blocks, a threshold at the door
      for (let y = 0; y <= 4; y += 1) for (let z = -13; z <= 12; z += 1) for (let x = -13; x <= 12; x += 1) {
        const r = Math.max(Math.abs(x + 0.5), Math.abs(z + 0.5)) * 0.72 + Math.hypot(x + 0.5, z + 0.5) * 0.35, R = y <= 1 ? 12.8 : 11.6;
        if (r > R) continue;
        const a = ang(x, z), seg = Math.floor(a * (y <= 1 ? 18 : 16) + (y % 2) * 0.5);
        b.put(x, y, z, y === 1 || y === 4 ? (r > R - 1.1 ? K('s4') : K('s3')) : r > R - 1.1 ? (hash(seg, y) < 0.12 ? K('mortar') : STONE[Math.floor(hash(seg, y, 3) * STONE.length)]) : K('s4'));
      }
      // ---- the shaft: a two-voxel shell of coursed stone, the slate band with its circuit, quoin-like joints
      for (let y = 5; y <= 68; y += 1) {
        const R = radiusAt(y), course = Math.floor((y - 5) / 3), bed = (y - 5) % 3 === 2;
        for (let z = -11; z <= 10; z += 1) for (let x = -11; x <= 10; x += 1) {
          const r = Math.hypot(x + 0.5, z + 0.5);
          if (r > R || r < R - 2.2) continue;
          const a = ang(x, z), d = mod(a - bandAt(y) + 0.5, 1) - 0.5; // how far round from the band's middle
          const inBand = Math.abs(d) < 0.075;
          let id;
          if (inBand && Math.abs(d) < 0.02) id = hash(Math.floor(y / 2), 7) < 0.14 ? K('via') : K('trace'); // the line of light
          else if (inBand) id = bed ? K('slate2') : (Math.abs(d) > 0.06 ? K('slate3') : [K('slate1'), K('slate2'), K('slate1')][Math.floor(hash(Math.floor(a * 30), course, 5) * 3)]);
          else if (bed) id = K('mortar');
          else {
            const stones = Math.round(R * 1.2), seg = Math.floor(a * stones + (course % 2) * 0.5);
            id = mod(a * stones + (course % 2) * 0.5, 1) < 0.08 ? K('mortar') : STONE[Math.floor(hash(seg, course, 11) * STONE.length)];
            if (hash(x, y, z) < 0.05) id = K('s4');
          }
          b.put(x, y, z, id);
        }
        // little branches off the line of light, like a circuit's stubs
        if (y % 5 === 0) {
          const a = bandAt(y) + (hash(y, 3) < 0.5 ? 0.03 : -0.03), t = a * Math.PI * 2;
          b.put(Math.floor(Math.sin(t) * (R - 0.4)), y, Math.floor(Math.cos(t) * (R - 0.4)), K('trace'));
        }
      }
      // ---- windows up the stair: arched, lit warm, a sill under each, set back into the wall
      for (const [y0, a0] of [[18, 0.42], [31, 0.7], [44, 0.02], [57, 0.33]]) {
        const t = a0 * Math.PI * 2, dx = Math.sin(t), dz = Math.cos(t), px = Math.cos(t), pz = -Math.sin(t);
        for (let j = 0; j < 6; j += 1) for (let i = -1; i <= 1; i += 1) {
          if (j === 5 && i !== 0) continue; // an arched top
          const y = y0 + j, R = radiusAt(y);
          for (let k = 0; k <= 1; k += 1) { const x = Math.floor(dx * (R - 0.5 - k) + px * i), z = Math.floor(dz * (R - 0.5 - k) + pz * i); b.cut(x, y, z); }
          const x = Math.floor(dx * (R - 2) + px * i), z = Math.floor(dz * (R - 2) + pz * i);
          b.put(x, y, z, j === 2 ? K('frame') : (i + j) % 3 ? K('win1') : K('win2'));
        }
        for (let i = -2; i <= 2; i += 1) { const R = radiusAt(y0 - 1) + 0.3; b.put(Math.floor(dx * R + px * i), y0 - 1, Math.floor(dz * R + pz * i), K('s1')); }
      }
      // ---- the door at the front: jambs, an arch of voussoirs, a studded plank door, a lantern beside it
      for (let y = 5; y <= 16; y += 1) for (let x = -4; x <= 3; x += 1) {
        const inArch = x >= -2 && x <= 1 && (y <= 12 || (x + 0.5) ** 2 + (y - 12) ** 2 <= 4.5);
        const R = radiusAt(y), z = Math.floor(Math.sqrt(Math.max(0, R * R - (x + 0.5) ** 2)) - 0.5);
        if (inArch) { b.cut(x, y, z); b.put(x, y, z - 1, (x + 2) % 2 ? K('door1') : K('door2')); if ((y === 7 || y === 11) && (x === -2 || x === 1)) b.put(x, y, z - 1, K('stud')); continue; }
        if ((x === -3 || x === 2) && y <= 12) { b.put(x, y, z + 1, (y - 5) % 3 === 2 ? K('mortar') : K('s1')); continue; }
        if (y > 12 && y <= 16 && (x + 0.5) ** 2 + (y - 12) ** 2 <= 12.5) b.put(x, y, z + 1, ((Math.atan2(y - 12, x + 0.5) * 3) | 0) % 2 ? K('s1') : K('s2'));
      }
      b.fill(-3, 4, 11, 2, 4, 13, (x, y, z) => (z === 13 ? K('s3') : K('s2'))); // the step
      b.put(4, 13, 10, K('iron2')); b.put(4, 13, 11, K('iron2'));
      b.fill(3, 9, 11, 5, 12, 12, (x, y, z) => (y === 9 || y === 12 ? K('iron2') : x === 4 ? K('win1') : (x + z) % 2 ? K('iron1') : 0));
      // ---- the gallery: corbels stepping out, a walkway, an iron rail with brass caps
      for (let y = 64; y <= 69; y += 1) for (let z = -12; z <= 11; z += 1) for (let x = -12; x <= 11; x += 1) {
        const r = Math.hypot(x + 0.5, z + 0.5), a = ang(x, z), R = y === 69 ? 11 : radiusAt(y) + (y - 63) * 0.55;
        if (r > R || (y < 69 && r < R - 2)) continue; // corbels round the top, then the whole gallery floor
        if (y < 69 && mod(a * 16, 1) > 0.55) continue; // corbels, with gaps between
        b.put(x, y, z, y === 69 ? (r > 10.2 ? K('s4') : K('s2')) : y === 68 ? K('s1') : K('s3'));
      }
      for (let k = 0; k < 40; k += 1) {
        const t = (k / 40) * Math.PI * 2, x = Math.floor(Math.sin(t) * 10.3), z = Math.floor(Math.cos(t) * 10.3);
        b.put(x, 72, z, K('iron2')); b.put(x, 74, z, K('iron3'));
        if (k % 3 === 0) { b.put(x, 70, z, K('iron1')); b.put(x, 71, z, K('iron1')); b.put(x, 73, z, K('iron1')); if (k % 6 === 0) b.put(x, 75, z, K('brass2')); }
      }
      // ---- the lantern room: a sill, eight iron mullions, a top ring; open glazing so the lens shows
      for (let z = -7; z <= 6; z += 1) for (let x = -7; x <= 6; x += 1) {
        const r = Math.hypot(x + 0.5, z + 0.5);
        if (r <= 6.6) b.put(x, 69, z, r > 5.6 ? K('iron2') : K('s3'));
        if (r <= 6.6 && r > 5.4) { b.put(x, 70, z, K('iron2')); b.put(x, 82, z, K('iron2')); }
      }
      for (let k = 0; k < 8; k += 1) {
        const t = ((k + 0.5) / 8) * Math.PI * 2, x = Math.floor(Math.sin(t) * 6), z = Math.floor(Math.cos(t) * 6);
        b.fill(x, 71, z, x, 81, z, (xx, y) => (y === 76 ? K('brass2') : K('iron1')));
        for (let s = 0; s < 3; s += 1) { const tt = t + (s - 1) * 0.12; b.put(Math.floor(Math.sin(tt) * 6.1), 71 + ((s * 4 + k) % 10), Math.floor(Math.cos(tt) * 6.1), K('iron3')); } // glazing bars
      }
      // ---- the dome: copper, ribbed, a ventilator ball, the crystal finial, a paper-plane weathervane
      for (let y = 83; y <= 90; y += 1) {
        const R = 7.2 * Math.sqrt(Math.max(0, 1 - ((y - 82.5) / 8) ** 2));
        for (let z = -8; z <= 7; z += 1) for (let x = -8; x <= 7; x += 1) {
          const r = Math.hypot(x + 0.5, z + 0.5);
          if (r > R) continue;
          const a = ang(x, z), rib = mod(a * 8, 1) < 0.1;
          b.put(x, y, z, rib ? K('cuRib') : y === 83 ? K('cu3') : hash(x, y, z) < 0.3 ? K('cu2') : (x + y + z) % 5 === 0 ? K('cu3') : K('cu1'));
        }
      }
      b.egg(0, 92, 0, 1.6, 1.6, 1.6, (x, y) => (y % 2 ? K('brass2') : K('brass1')));
      b.fill(-1, 93, -1, 0, 94, 0, K('iron2'));
      for (const [y, id] of [[95, 'fin2'], [96, 'fin1'], [97, 'fin1']]) b.put(-1, y, -1, K(id));
      b.put(0, 95, -1, K('fin1')); b.put(-1, 95, 0, K('fin2'));
      // the lens: a faceted crystal, two brass bullseye panels either side (the beams leave through them)
      const lens = box([-5, 71, -5], [4, 81, 4]);
      for (let y = 71; y <= 81; y += 1) {
        const k = 1 - Math.abs(y - 76) / 5.5, r = 0.8 + 2.6 * k;
        for (let z = -4; z <= 3; z += 1) for (let x = -4; x <= 3; x += 1) {
          const d = Math.abs(x + 0.5) + Math.abs(z + 0.5);
          if (d <= r) lens.put(x, y, z, d > r - 0.9 ? ((x + y + z) % 3 ? K('lens2') : K('lens3')) : d < 1.2 ? K('lens1') : K('lens4'));
        }
      }
      for (const s of [-1, 1]) for (let y = 73; y <= 79; y += 1) for (let z = -3; z <= 2; z += 1) {
        const r = Math.hypot(y + 0.5 - 76.5, z + 0.5);
        if (r <= 3.2 && r > 2.3) lens.put(s < 0 ? -5 : 4, y, z, K('brass2'));
        else if (r <= 2.3 && (Math.round(r * 2) % 2 === 0)) lens.put(s < 0 ? -5 : 4, y, z, K('lens1'));
      }
      // the pulse: a bright bead that runs up the line of light
      const pulse = box([-1, 0, -1], [0, 1, 0]);
      pulse.fill(-1, 0, -1, 0, 1, 0, K('pulse'));
      // the weathervane: a little paper plane on a spindle, turning with the wind
      const vane = box([-4, 98, -4], [3, 100, 3]);
      vane.put(-1, 98, -1, K('iron2'));
      for (const [x, z] of [[-1, 3], [-1, 2], [-1, 1], [-2, 1], [0, 1], [-1, 0], [-2, 0], [0, 0], [-3, -1], [-1, -1], [1, -1], [-3, -2], [1, -2]]) vane.put(x, 99, z, (x + z) % 2 ? K('paper1') : K('paper2'));
      vane.put(-1, 100, 0, K('paper3'));
      return { parts: {
        tower: b.part('tower', [0, 0, 0]),
        lens: lens.part('lens', [0, 76.5, 0]),
        pulse: pulse.part('pulse', [0, 1, 0]),
        vane: vane.part('vane', [-0.5, 98, -0.5]),
      } };
    },
    setup(ctx) {
      const { THREE, parts, mem } = ctx;
      // two soft beams through the lens: open cones, tilted a little up so they pass over the town's roofs, their
      // light fading with distance from the lantern and soft at their edges (bright only where you look through the
      // middle of the beam). A beam fades out as the camera comes near it (so a view is never inside one) and near
      // the camera. They screen onto what is behind them (src * (1 - dst) + dst), so a lit wall they cross can
      // never be pushed to white, and the canvas's alpha is left alone (the page's sky shows through a transparent
      // canvas). Its strength is the uniform uStrength (the district sets it for day and night).
      const L = 96, geo = new THREE.CylinderGeometry(11, 1.8, L, 20, 6, true);
      geo.translate(0, L / 2, 0);
      geo.rotateZ(-Math.PI / 2);
      const mat = new THREE.ShaderMaterial({
        uniforms: { uStrength: { value: 0.3 }, uLen: { value: L }, uNear: { value: new THREE.Vector2(10, 45) }, uWarm: { value: new THREE.Color(0xfff1c8) }, uCold: { value: new THREE.Color(0x9ff8ff) } },
        vertexShader: /* glsl */ `
          uniform float uLen;
          varying float vAlong, vAway; varying vec3 vView; varying vec3 vNorm;
          void main() {
            vAlong = clamp(position.x / uLen, 0.0, 1.0);
            // how far the camera is from this beam's axis (world units), past the cone's radius there
            vec3 o = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz, e = (modelMatrix * vec4(uLen, 0.0, 0.0, 1.0)).xyz - o;
            float t = clamp(dot(cameraPosition - o, e) / dot(e, e), 0.0, 1.0);
            float r = length(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0)) * mix(1.8, 11.0, t);
            vAway = smoothstep(r + 0.5, r + 6.0, length(cameraPosition - o - e * t));
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vView = mv.xyz; vNorm = normalMatrix * normal;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uStrength; uniform vec2 uNear; uniform vec3 uWarm, uCold;
          varying float vAlong, vAway; varying vec3 vView; varying vec3 vNorm;
          void main() {
            float fall = pow(1.0 - vAlong, 1.8) * smoothstep(1.0, 0.55, vAlong); // from the lantern out to nothing
            float near = smoothstep(uNear.x, uNear.y, length(vView)); // units from the camera
            float body = pow(abs(dot(normalize(vNorm), normalize(vView))), 1.3); // soft edges, like a lit haze
            gl_FragColor = vec4(min(mix(uWarm, uCold, vAlong * 0.7) * (fall * near * body * vAway * uStrength), vec3(0.5)), 1.0);
            #include <colorspace_fragment>
          }`,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneMinusDstColorFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
      });
      mem.beams = [0, Math.PI].map((a) => {
        const m = new THREE.Mesh(geo, mat);
        m.rotation.set(0, a, 0.06); // a little over the horizon
        m.raycast = () => {}; // light is not a thing to click
        m.renderOrder = 2;
        parts.lens.add(m);
        return m;
      });
      mem.beamMat = mat;
      mem.path = []; // the pulse climbs the spiral: a point a step, relative to the part's home
      for (let y = TOWER.y0 + 1; y <= TOWER.y1 - 1; y += 0.5) { const t = bandAt(y) * Math.PI * 2, R = radiusAt(y) + 0.3; mem.path.push([Math.sin(t) * R, y, Math.cos(t) * R]); }
    },
    idle(ctx) {
      const { parts: P, state: { t }, mem } = ctx;
      P.lens.rotation.y += t * 0.55;
      P.lens.scale.setScalar(1 + 0.03 * Math.sin(t * 4.1));
      P.vane.rotation.y += 0.6 * Math.sin(t * 0.21) + 0.15 * Math.sin(t * 1.3);
      const u = (t * 0.09) % 1, i = Math.floor(u * (mem.path.length - 1)), [x, y, z] = mem.path[i];
      P.pulse.position.set(x, y, z);
      P.pulse.scale.setScalar(u > 0.96 ? 0 : 1);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The keeper's cottage. Model voxels x -17..16, z -11..12; the door at x -9..-7 on the front.
export const COTTAGE = { door: [-8, 14], chimney: [11, 29, -3], window: [3, 8, 10] };
export function cottage() {
  return {
    gait: 'still',
    build() {
      const b = box([-18, 0, -12], [17, 32, 13]);
      const RUB = [K('rub1'), K('rub1'), K('rub2'), K('rub3'), K('rub4')];
      // ---- walls: rubble stone in irregular courses, quoins, a timber wall plate
      b.fill(-15, 0, -9, 14, 13, 9, (x, y, z) => {
        const front = z === 9, back = z === -9, left = x === -15, right = x === 14;
        if (!(front || back || left || right)) return y === 0 ? K('rub4') : 0;
        if (y === 0) return K('rub4');
        if (y === 13) return K('timber');
        const along = front || back ? x : z, corner = front || back ? Math.min(x + 15, 14 - x) : Math.min(z + 9, 9 - z);
        if (corner <= 1) return Math.floor((y - 1) / 2) % 2 === (corner === 0 ? 0 : 1) ? K('s1') : K('s2');
        const course = Math.floor((y - 1 + Math.floor(hash(Math.floor(along / 3), 3) * 2)) / 2), seg = Math.floor((along + course * 2 + 40) / 3);
        if (mod(along + course * 2 + 40, 3) === 0 && hash(seg, course) < 0.6) return K('mortar');
        return RUB[Math.floor(hash(seg, course, front ? 1 : 2) * RUB.length)];
      });
      // ---- the door: an arch, a plank door with iron straps, a rune on the lintel; a lantern beside it
      for (let y = 1; y <= 10; y += 1) for (let x = -11; x <= -5; x += 1) {
        const inArch = x >= -10 && x <= -6 && (y <= 7 || (x + 7.5) ** 2 + (y - 7.5) ** 2 <= 5);
        if (inArch) { b.cut(x, y, 9); b.put(x, y, 8, y === 3 || y === 6 ? K('iron2') : x % 2 ? K('door1') : K('door2')); }
        else if ((x === -11 || x === -5) && y <= 8) b.put(x, y, 10, K('s2'));
        else if (y >= 8 && (x + 7.5) ** 2 + (y - 7.5) ** 2 <= 10) b.put(x, y, 10, y === 10 && x === -8 ? K('trace') : K('s1'));
      }
      b.put(-6, 4, 8, K('brass2'));
      b.fill(-4, 8, 10, -4, 8, 11, K('iron2')); b.fill(-5, 5, 11, -3, 7, 12, (x, y, z) => (y === 5 || y === 7 ? K('iron2') : x === -4 ? K('win1') : 0));
      // ---- the window: a frame, four lit panes, painted shutters, a sill and a box of flowers
      for (let y = 4; y <= 10; y += 1) for (let x = 0; x <= 6; x += 1) {
        const edge = x === 0 || x === 6 || y === 4 || y === 10, bar = x === 3 || y === 7;
        if (edge || bar) { b.put(x, y, 9, K('timber')); continue; }
        b.cut(x, y, 9); b.put(x, y, 8, (x + y) % 3 ? K('win1') : K('win2'));
      }
      for (const x of [-2, -1, 7, 8]) b.fill(x, 4, 10, x, 10, 10, (xx, y) => (y % 2 ? K('shutter') : K('shutter2')));
      b.fill(-1, 3, 10, 7, 3, 11, K('s1'));
      for (let x = 0; x <= 6; x += 1) { b.put(x, 3, 12, K('timber')); const r = hash(x, 4, 4); b.put(x, 4, 11, r < 0.3 ? K('flowerR') : r < 0.5 ? K('flowerY') : r < 0.65 ? K('flowerV') : K('leaf')); }
      // a side window, lit
      for (let y = 5; y <= 9; y += 1) for (let z = -3; z <= 1; z += 1) {
        const edge = z === -3 || z === 1 || y === 5 || y === 9;
        if (edge) b.put(14, y, z, K('timber')); else { b.cut(14, y, z); b.put(13, y, z, K('win1')); }
      }
      // ---- the roof: slate courses on a pitch running along x, a ridge, bargeboards, moss on the back slope
      for (let z = -11; z <= 12; z += 1) for (let x = -17; x <= 16; x += 1) {
        const k = Math.min(z + 11, 12 - z), y = 13 + Math.floor(k * 0.95) + (x === -17 || x === 16 ? 0 : 1);
        const course = Math.floor(k / 2);
        let id = x === -17 || x === 16 ? K('timber') : k === 11 ? K('ridge') : [K('roof1'), K('roof2'), K('roof1'), K('roof3')][Math.floor(hash(Math.floor((x + 40 + (course % 2) * 2) / 3), course, z < 0 ? 5 : 6) * 4)];
        if (z < 0 && x > -15 && x < 14 && noise(x, z, 5, 3) > 0.62) id = hash(x, z) < 0.5 ? K('moss1') : K('moss2');
        b.put(x, y, z, id);
        if (y > 14 && (x === -15 || x === 14) && z > -10 && z < 10) for (let yy = 14; yy < y; yy += 1) b.put(x, yy, z, (z === 0 && yy > 17 && yy < 21) ? K('win1') : (yy + z) % 4 === 0 ? K('timber') : K('plaster')); // gable ends, a lit slit window
      }
      // ---- the chimney at the right end, capped, a pot
      b.fill(9, 14, -5, 13, 28, -1, (x, y, z) => ((y - 14) % 3 === 2 ? K('mortar') : y > 25 && hash(x, y, z) < 0.4 ? K('soot') : RUB[Math.floor(hash(Math.floor((x + z) / 2), Math.floor(y / 3), 9) * RUB.length)]));
      b.fill(8, 29, -6, 14, 29, 0, (x, y, z) => (x === 8 || x === 14 || z === -6 || z === 0 ? K('s3') : K('soot')));
      b.fill(10, 30, -4, 12, 31, -2, (x, y, z) => (x === 11 && z === -3 ? 0 : K('pot')));
      // ---- a story at the foot: parcels stacked by the door, tied with string and sealed; a woodpile at the left end
      const parcel = (x0, y0, z0, w, h, d, seal) => b.fill(x0, y0, z0, x0 + w - 1, y0 + h - 1, z0 + d - 1, (x, y, z) => (x === x0 + (w >> 1) || y === y0 + h - 1 && z === z0 + (d >> 1) ? K('string') : seal && y === y0 + h - 1 && x === x0 ? K('seal') : (x + y + z) % 3 ? K('parcel1') : K('parcel2')));
      parcel(-14, 0, 10, 4, 3, 3, true); parcel(-13, 3, 10, 3, 2, 3, false); parcel(-4, 0, 11, 3, 2, 2, true);
      for (let y = 0; y <= 6; y += 1) for (let z = -8; z <= 6; z += 1) for (const x of [-17, -16]) {
        const log = Math.floor(z / 2) + y * 3;
        b.put(x, y, z, x === -17 ? (hash(log, y) < 0.5 ? K('logEnd') : K('log2')) : (log % 2 ? K('log1') : K('log2')));
      }
      return { parts: { cottage: b.part('cottage', [0, 0, 0]) } };
    },
    idle(ctx) {
      const { state: { t }, mem } = ctx;
      if (t > (mem.next ?? 0)) { // smoke from the pot
        const V = ctx.voxel;
        ctx.bit(11 * V, 31.5 * V, -3 * V, 0.08 + 0.05 * Math.sin(t), 0.45, 0.02, 3, 0.12, 0x8a8a92, 0x3a3a44, { grow: 2.5, drag: 0.2 });
        mem.next = t + 0.45;
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The mailbox and its pigeon. The letterbox's round-topped body is x -3..3, y 12..19, z -5..5; its
// slot is on the front door (z 6). ctx.send() sends a letter: the flag goes up, the slot flares, the
// pigeon startles off the roof, flaps, lands again and glares the way the plane went (ctx.mem.glare).
export const MAILBOX = { slot: [0, 16, 7], top: 19 };
export function mailbox() {
  return {
    gait: 'still',
    build() {
      const b = box([-5, 0, -7], [5, 21, 7]);
      b.fill(-2, 0, -2, 1, 1, 1, (x, y, z) => (y === 1 ? K('s2') : K('s3')));
      b.fill(-1, 2, -1, 0, 11, 0, (x, y, z) => (y % 4 === 0 ? K('iron2') : tone([K('post1'), K('post2')], x, y, z, 3)));
      b.fill(-2, 11, -3, 1, 11, 2, K('post1')); // the saddle it sits on
      // the body: a half-round top on straight sides, red paint over iron, brass bands and rivets
      for (let y = 12; y <= 19; y += 1) for (let z = -5; z <= 5; z += 1) for (let x = -3; x <= 3; x += 1) {
        const inside = y <= 15 || x * x + (y - 15) ** 2 <= 13;
        if (!inside) continue;
        const shell = Math.abs(x) === 3 || y === 12 || z === -5 || z === 5 || (y > 15 && x * x + (y - 15) ** 2 > 7);
        if (!shell) continue;
        let id = hash(x, y, z) < 0.3 ? K('red2') : y > 17 ? K('red3') : K('red1');
        if (z === -4 || z === 4) id = K('brass1');
        if ((z === -4 || z === 4) && (y + x) % 3 === 0) id = K('brass3');
        b.put(x, y, z, id);
      }
      // the front door: a slot that glows, a brass pull, an envelope rune on the side plate
      b.fill(-2, 13, 6, 2, 18, 6, (x, y) => (y === 16 && Math.abs(x) <= 1 ? K('slot') : Math.abs(x) === 2 || y === 13 ? K('red2') : K('red1')));
      b.put(0, 14, 7, K('brass2'));
      for (const [y, z] of [[14, -2], [14, -1], [14, 0], [14, 1], [17, -2], [17, 1], [16, -1], [16, 0], [15, -2], [15, 1], [16, -2], [16, 1], [15, -1], [15, 0]]) b.put(-4, y, z, y === 14 || y === 17 || z === -2 || z === 1 ? K('env') : (y === 16 ? K('env') : 0));
      const flag = box([4, 12, -3], [5, 20, 2]);
      flag.fill(4, 14, 1, 4, 14, 1, K('iron2'));
      flag.fill(5, 13, -3, 5, 15, 1, (x, y, z) => (z === 1 ? K('iron3') : y === 15 || z === -3 ? K('red3') : K('red1')));
      // the pigeon, on the roof: a grey body with dark wing bars, a green and violet neck, pink feet,
      // a tiny satchel with a letter in it slung across it
      const py = MAILBOX.top;
      const bird = box([-3, py, -5], [3, py + 5, 3]);
      bird.egg(0, py + 2, -0.8, 1.8, 1.6, 2.6, (x, y, z) => (y <= py + 1 && z < 0 ? K('pg2') : z < -2 ? K('pg2') : K('pg1')));
      bird.fill(-2, py + 2, -3, -2, py + 2, -1, K('pgBar')); bird.fill(1, py + 2, -3, 1, py + 2, -1, K('pgBar'));
      bird.put(-1, py + 1, -4, K('pgBar')); bird.put(0, py + 1, -4, K('pgBar')); bird.put(-1, py + 2, -4, K('pg2')); bird.put(0, py + 2, -4, K('pg2')); // tail
      bird.fill(-1, py + 3, 0, 0, py + 4, 1, (x, y) => (y === py + 3 ? K('pgNeck2') : K('pgNeck1')));
      bird.fill(-1, py, 0, -1, py, 0, K('pgFoot')); bird.put(0, py, 0, K('pgFoot')); bird.put(-1, py, 1, K('pgFoot')); bird.put(0, py, 1, K('pgFoot'));
      bird.fill(1, py + 1, -1, 2, py + 2, 0, (x, y) => (y === py + 2 && x === 2 ? K('letter') : K('satchel'))); // the satchel on its right side
      bird.put(2, py + 2, -1, K('seal'));
      bird.fill(-1, py + 3, -1, 0, py + 3, -1, K('satchel2')); // its strap across the back
      const head = box([-2, py + 4, -1], [1, py + 8, 3]);
      head.egg(-0.5 + 0.5, py + 5.4, 1, 1.3, 1.2, 1.3, (x, y) => (y <= py + 4 ? K('pgNeck1') : K('pg3')));
      head.put(-2, py + 5, 1, K('pgEye')); head.put(1, py + 5, 1, K('pgEye'));
      head.put(-1, py + 5, 3, K('beak')); head.put(0, py + 5, 3, K('beak')); head.put(-1, py + 6, 2, K('cere')); head.put(0, py + 6, 2, K('cere'));
      head.fill(-2, py + 6, 0, 1, py + 6, 2, (x, y, z) => (z === 2 && (x === -1 || x === 0) ? 0 : K('capBlue'))); // the postal cap
      head.fill(-1, py + 7, 0, 0, py + 7, 1, K('capBlue')); head.put(-1, py + 7, 2, K('capBlue')); head.put(0, py + 7, 2, K('capBadge'));
      const wings = box([-3, py + 1, -4], [2, py + 3, 1]);
      wings.fill(-3, py + 2, -3, -3, py + 3, 0, (x, y, z) => (z === -3 ? K('pgBar') : K('pg2'))); wings.fill(2, py + 2, -3, 2, py + 3, 0, (x, y, z) => (z === -3 ? K('pgBar') : K('pg2')));
      return { parts: {
        box: b.part('box', [0, 0, 0]),
        flag: flag.part('flag', [4.5, 14.5, 1.5]),
        bird: bird.part('bird', [0, py, 0]),
        head: head.part('head', [-0.5, py + 4, 0.5], bird),
        wings: wings.part('wings', [0, py + 3, -1], bird),
      } };
    },
    setup(ctx) {
      ctx.mem.sent = -100;
      ctx.send = () => { ctx.mem.sent = ctx.state.t; };
    },
    idle(ctx) {
      const { parts: P, state: { t }, mem } = ctx;
      const u = t - mem.sent;
      // the flag: up for a letter going out, down again a while after
      const up = smooth(clamp01(u / 0.35)) * (1 - smooth(clamp01((u - 6) / 0.8)));
      P.flag.rotation.x += (Math.PI / 2) * up + 0.08 * Math.sin(u * 18) * Math.exp(-3 * Math.max(0, u - 0.35)) * (u > 0.35 ? 1 : 0);
      // the pigeon: pecks and bobs at rest; a letter goes out and it jumps, flaps, lands, and glares after it
      const jump = u > 0 && u < 1.6 ? Math.sin(Math.PI * clamp01(u / 1.4)) : 0;
      const flap = u > 0 && u < 1.8 ? 1 : 0;
      const glare = u > 1.5 && u < 8 ? smooth(clamp01((u - 1.5) / 0.4)) * (1 - smooth(clamp01((u - 7) / 1))) : 0;
      P.bird.position.y += 7 * jump;
      P.bird.rotation.y += 0.6 * Math.sin(t * 0.3) * (1 - glare) + (mem.glare || 1.2) * glare;
      P.bird.rotation.z += 0.15 * jump * Math.sin(u * 20);
      P.wings.scale.y = flap ? 1 + 1.6 * Math.abs(Math.sin(u * 26)) : 1;
      P.wings.scale.x = flap ? 1.5 : 1;
      const peck = (t % 3.7) < 0.35 && !flap ? Math.sin(((t % 3.7) / 0.35) * Math.PI) : 0;
      P.head.rotation.x += 0.7 * peck - 0.25 * glare;
      P.head.position.z += 0.3 * Math.sin(t * 4) * (1 - glare) * (1 - peck);
      P.head.rotation.z += 0.12 * glare * Math.sin(t * 3); // indignant
    },
  };
}

// ---------------------------------------------------------------------------------------------
// A brass telescope on a wooden tripod, pointed up at the sky and sweeping slowly. ctx.mem.look (0..1)
// swings it toward the camera for a moment when someone looks through it.
export function telescope() {
  return {
    gait: 'still',
    build() {
      const b = box([-5, 0, -5], [4, 12, 4]);
      for (const [x, z] of [[-4, -3], [3, -3], [-0.5, 4]]) b.rope([[x + 0.5, 0, z + 0.5], [0, 11, 0]], 0.6, 0.5, (xx, y) => (y === 0 ? K('brass1') : y % 4 === 0 ? K('tripod1') : K('tripod2')));
      b.fill(-1, 11, -1, 0, 12, 0, K('brass1'));
      const tube = box([-3, 10, -9], [2, 17, 8]);
      for (let z = -8; z <= 7; z += 1) {
        const r = z > 4 ? 1.7 : z < -5 ? 0.9 : 1.3;
        for (let y = 11; y <= 16; y += 1) for (let x = -2; x <= 1; x += 1) {
          const d = Math.hypot(x + 0.5, y + 0.5 - 13.5);
          if (d > r) continue;
          tube.put(x, y, z, z === 7 && d < 1.1 ? K('scopeLens') : z % 5 === 0 || z === 7 ? K('brass3') : d > r - 0.6 ? K('brass2') : K('brass1'));
        }
      }
      tube.fill(-1, 12, -9, 0, 13, -9, K('iron2')); // the eyepiece
      return { parts: { tripod: b.part('tripod', [0, 0, 0]), tube: tube.part('tube', [0, 13, 0]) } };
    },
    setup(ctx) { ctx.mem.look = 0; },
    idle(ctx) {
      const { parts: P, state: { t }, mem } = ctx;
      const l = mem.look || 0;
      P.tube.rotation.x -= (0.55 + 0.12 * Math.sin(t * 0.17)) * (1 - l) + 0.1 * l;
      P.tube.rotation.y += 0.9 * Math.sin(t * 0.11) * (1 - l);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// A paper plane: a folded dart, nose +z, with a faint glowing edge so it reads against the night.
export function plane() {
  return {
    gait: 'still',
    build() {
      const b = box([-5, -1, -6], [4, 2, 6]);
      for (let z = -6; z <= 6; z += 1) {
        const w = Math.round((6 - z) * 0.38); // widest at the tail
        for (let x = -w - 1; x <= w; x += 1) {
          const keel = x === -1 || x === 0, edge = x === -w - 1 || x === w;
          b.put(x, keel ? -1 + (z > 3 ? 1 : 0) : 0 + (Math.abs(x + 0.5) > 3 ? 1 : 0), z, edge && z < 3 ? K('paperGlow') : keel ? K('paper3') : (x + z) % 3 === 0 ? K('paper2') : K('paper1'));
        }
      }
      return { parts: { plane: b.part('plane', [-0.5, 0, 0]) } };
    },
  };
}
