// The Market (more on GitHub): eleven stalls and carts round a square, one per repo. Seven
// timber stalls stand in an arc behind a fountain of glowing water, four hand carts out at the
// square's front (parted for Market Street, which comes in at the front through a gate of two banner posts with a
// string of lanterns between them), every awning striped in its own colour. Each counter holds one object that says
// what the repo is, and a hologram price tag with its glyph swings over each stall. A crystal
// rides the fountain's jet; garlands of lanterns run from post to post round the stalls. Visit a
// stall and Yuuv looks, picks the object up, shows it to you, turns it over and puts it back.
// The joke: a greengrocer's barrow of GitHub contribution squares, kept by a robot in a straw
// hat who waters them so they grow, while a grey cat sits among them watching the can drip.
//
// Cheap to draw: the eleven stall frames are two instanced crowds (timber and canvas, then the
// stripes tinted per stall), the lanterns a third; the wares, the cat and the barrow go (LOD)
// when the camera is out at the whole town.
import { stallFrame, stallCloth, cartFrame, cartCloth, goods, LOOKS, STALL, CART } from '../models/mkt_stall.js';
import { fountain, wires, along, lanternDef, cat, greens, clutter, gate, FOUNTAIN, GATE } from '../models/mkt_square.js';
import { tree } from '../models/props.js';
import { smooth, clamp01 } from '../models/space.js';
import { edgeOf } from '../models/island.js';

const YAW = 0.45; // the town's camera yaw: +F points at the camera, +R to the right of the screen
const F = [Math.sin(YAW), Math.cos(YAW)], R = [Math.cos(YAW), -Math.sin(YAW)];
const CV = [4, 8]; // the fountain (island voxels)
const RO = 64, RC = 46; // the stalls' ring and the carts' ring, voxels from the fountain
const DEG = Math.PI / 180;
const OUTER = [-72, -50, -28, -6, 16, 38, 60, 82].map((d) => d * DEG); // eight slots behind the fountain; the lane takes one
const INNER = [-52, -21, 21, 52].map((d) => d * DEG); // four carts in front of it, kept in from the arc's ends, parted for the lane
const LOD_FAR = 115; // camera distance (units) past which the wares, the cat and the clutter are not drawn

// Where everything stands (island voxels), given where the bridge lands (voxels, or null alone).
function layout(dock) {
  const rel = (p) => [p[0] - CV[0], p[1] - CV[1]];
  const back = (phi, r) => [CV[0] + r * (-F[0] * Math.cos(phi) + R[0] * Math.sin(phi)), CV[1] + r * (-F[1] * Math.cos(phi) + R[1] * Math.sin(phi))];
  const front = (phi, r) => [CV[0] + r * (F[0] * Math.cos(phi) + R[0] * Math.sin(phi)), CV[1] + r * (F[1] * Math.cos(phi) + R[1] * Math.sin(phi))];
  // the lane's angle round the back arc; the slot nearest it moves onto it (at most half a pitch) and is left out
  const d = dock ? rel(dock) : null;
  const lane = d ? Math.atan2(d[0] * R[0] + d[1] * R[1], -(d[0] * F[0] + d[1] * F[1])) : 88 * DEG;
  const k = OUTER.reduce((b, s, i) => (Math.abs(s - lane) < Math.abs(OUTER[b] - lane) ? i : b), 0);
  const shift = Math.max(-11 * DEG, Math.min(11 * DEG, lane - OUTER[k]));
  const stalls = OUTER.map((s) => s + shift).filter((s, i) => i !== k).map((phi) => {
    const p = back(phi, RO), to = rel(p);
    return { kind: 'stall', p, ry: Math.atan2(-to[0], -to[1]), phi };
  });
  // a street in at the front (the town's Market Street): the carts part round it, and it comes in through the gate
  const gate = d ? Math.atan2(d[0] * R[0] + d[1] * R[1], d[0] * F[0] + d[1] * F[1]) : null;
  const front0 = gate !== null && Math.abs(gate) < 40 * DEG, g = front0 ? gate : 0;
  const carts = INNER.map((phi) => { const p = front(phi + g, RC), to = rel(p); return { kind: 'cart', p, ry: Math.atan2(to[0], to[1]), phi: phi + g }; });
  const laneTo = back(lane, 44), far = !d || Math.hypot(d[0], d[1]) > 84;
  return { stalls, carts, lane: [dock || back(lane, 110), ...(far ? [back(lane, 80)] : []), laneTo], laneAngle: lane, gate: front0 ? g : null, back, front };
}

// Voxel model points on a placed model (x0, z0 in units, turned ry) to island units.
const onModel = (V, [x0, z0], ry) => (u, w) => [x0 + (u * Math.cos(ry) + w * Math.sin(ry)) * V, z0 + (-u * Math.sin(ry) + w * Math.cos(ry)) * V];
// A turned rectangle (model voxels) as a grid of boxes in island units (nx by nz, so a turned one
// does not balloon into its neighbours' lanes), for the walker to keep clear of.
function footprint(V, at, ry, [x0, z0, x1, z1], nx = 3, nz = 2) {
  const P = onModel(V, at, ry), out = [];
  for (let i = 0; i < nx; i += 1) for (let k = 0; k < nz; k += 1) {
    const a = x0 + ((x1 - x0) * i) / nx, b = x0 + ((x1 - x0) * (i + 1)) / nx, c = z0 + ((z1 - z0) * k) / nz, d = z0 + ((z1 - z0) * (k + 1)) / nz;
    const pts = [P(a, c), P(b, c), P(a, d), P(b, d)];
    out.push([Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))]);
  }
  return out;
}
const clampYaw = (y) => Math.max(YAW - 1, Math.min(YAW + 1, Math.atan2(Math.sin(y - YAW), Math.cos(y - YAW)) + YAW));
// How he reacts once the ware is back on its counter.
const REACT = { personaforge: 'laugh', lora: 'point', polyner: 'wave', storymode: 'cheer', cloudbuilder: 'point', jemdash: 'point', mlmodule: 'laugh', chess: 'cheer', hindi: 'wave', facereg: 'poke', town: 'cheer' };

export default {
  id: 'more',
  title: 'Market',
  island: {
    A: 92, B: 76, seed: 6,
    plazas: [[CV[0], CV[1], 57]],
    paths: ({ dock }) => [layout(dock).lane],
  },
  build(env, chapter) {
    const { THREE, V, kit } = env;
    const units = ([x, z]) => [x * V, z * V];
    const L = layout(env.dock ? [env.dock[0] / V, env.dock[1] / V] : null);
    const group = new THREE.Group();
    const lod = new THREE.LOD(), near = new THREE.Group();
    lod.addLevel(near, 0); lod.addLevel(new THREE.Group(), LOD_FAR);
    group.add(lod);
    const stops = {}, targets = [], colliders = [];
    const noShadow = (r) => r.group.traverse((o) => { if (o.isMesh) o.userData.caster = false; });
    const keep = (r, shadow = false) => { near.add(r.group); if (!shadow) noShadow(r); return r; };

    // ---- the stalls and carts: frames and stripes as crowds, one pose each; each stripe crowd tinted per stall
    const items = chapter.items.slice(0, L.stalls.length + L.carts.length);
    const places = [...L.stalls, ...L.carts].slice(0, items.length);
    const crowds = {};
    for (const kind of ['stall', 'cart']) {
      const n = Math.max(1, places.filter((p) => p.kind === kind).length);
      crowds[kind] = {
        frame: kit.crowd(`mkt:${kind}Frame`, kind === 'stall' ? stallFrame() : cartFrame(), n),
        cloth: kit.crowd(`mkt:${kind}Cloth`, kind === 'stall' ? stallCloth() : cartCloth(), n),
        n: 0,
      };
      for (const m of [...crowds[kind].frame.meshes, ...crowds[kind].cloth.meshes]) group.add(m);
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), v3 = new THREE.Vector3(), tint = new THREE.Color(), axisY = new THREE.Vector3(0, 1, 0);
    const shops = [];
    items.forEach((item, i) => {
      const pl = places[i], A = pl.kind === 'cart' ? CART : STALL, c = crowds[pl.kind], at = units(pl.p);
      m4.compose(v3.set(at[0], 0, at[1]), q.setFromAxisAngle(axisY, pl.ry), one);
      c.frame.pose(c.n, m4, 0, 0, false);
      c.cloth.pose(c.n, m4, 0, 0, false);
      const look = LOOKS[item.id] || LOOKS.town;
      for (const m of c.cloth.meshes) m.setColorAt(c.n, tint.setHex(look.tint));
      c.n += 1;
      const g = keep(env.place(`mkt:goods:${item.id}`, goods(item.id, look, pl.kind), at, pl.ry));
      const P = onModel(V, at, pl.ry);
      const lantern = P(A.lantern[0], A.lantern[2]);
      env.light([lantern[0], (A.lantern[1] + 2) * V, lantern[1]], 0xffc764, 2.6, 4.5);
      colliders.push(...footprint(V, at, pl.ry, A.body, pl.kind === 'cart' ? 2 : 3, 2));
      targets.push({ object: g.group, stop: item.id, label: item.title });
      shops.push({ g, pl, item, A, P });
    });
    for (const c of Object.values(crowds)) {
      c.frame.count(c.n); c.cloth.count(c.n);
      for (const m of c.cloth.meshes) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }

    // ---- the fountain and its crystal
    const fAt = units(CV);
    const fnt = env.place('mkt:fountain', fountain(), fAt);
    env.halo(fnt.parts.crystal, [0, 0, 0], 26, 0xa6f7ff, 0.95);
    env.halo(fnt.parts.water, [0, 1, 0], 40, 0x2ad6ee, 0.32);
    env.light([fAt[0], FOUNTAIN.crystal * V, fAt[1]], 0x9ff8ff, 6, 11);
    env.light([fAt[0], 0.9, fAt[1]], 0x5fe8ff, 4, 5.5);
    colliders.push([fAt[0] - FOUNTAIN.r * V, fAt[1] - FOUNTAIN.r * V, fAt[0] + FOUNTAIN.r * V, fAt[1] + FOUNTAIN.r * V]);
    targets.push({ object: fnt.group, stop: 'main', label: 'The fountain' });

    // ---- lantern strings: garlands from post to post round the stalls, never across the square, where the
    // stops' cameras look
    const tie = ({ pl }) => { const e = onModel(1, pl.p, pl.ry)(STALL.wire[0], STALL.wire[2]); return [e[0], STALL.wire[1], e[1]]; };
    const row = shops.filter((s) => s.pl.kind === 'stall').sort((a, b) => a.pl.phi - b.pl.phi), garland = [];
    for (let i = 1; i < row.length; i += 1) if (Math.abs(row[i].pl.phi - row[i - 1].pl.phi) < 40 * DEG) garland.push([tie(row[i - 1]), tie(row[i]), 5]); // not across the lane
    noShadow(env.place('mkt:wires', wires(garland), [0, 0]));
    // the market gate where Market Street comes in: two banner posts either side of the lane with a string of lanterns
    // slung between them (its lanterns in the square's crowd)
    const posts = [];
    if (L.gate !== null) {
      const [dx, dz] = L.lane[0], [tx, tz] = L.lane[L.lane.length - 1], n0 = Math.hypot(tx - dx, tz - dz), u = [(tx - dx) / n0, (tz - dz) / n0];
      for (const s of [-1, 1]) posts.push([dx + u[0] * 2 + u[1] * 12 * s, dz + u[1] * 2 - u[0] * 12 * s]); // either side of the lane, in the carts' gap as the cameras see it
      noShadow(env.place('mkt:gate', gate(...posts), [0, 0]));
      garland.push([...GATE.ends(...posts), GATE.sag]);
    }
    const hang = garland.flatMap(([a, b, sag]) => [0.33, 0.67].map((u) => along(a, b, sag, u).map((v) => v * V)));
    const lanterns = kit.crowd('mkt:lantern', lanternDef, hang.length);
    const LCOL = [0xffc764, 0x6ff2ff, 0xff7ae0, 0x9dff7a, 0xffe6a8];
    const glowMesh = lanterns.meshes.find((m) => m.material.isMeshBasicMaterial);
    for (const m of lanterns.meshes) { m.castShadow = false; group.add(m); }
    const swing = (t) => {
      hang.forEach(([x, y, z], i) => {
        m4.compose(v3.set(x, y, z), q.setFromEuler(eu.set(0.1 * Math.sin(t * 1.3 + i * 1.7), t * 0.2 + i, 0.1 * Math.sin(t * 1.1 + i * 2.3))), one);
        lanterns.pose(i, m4, t, 0, false);
        if (glowMesh) glowMesh.setColorAt(i, tint.setHex(LCOL[i % LCOL.length]).multiplyScalar(0.62 + 0.38 * Math.max(0, Math.sin(t * 2.1 - i * 0.8)) ** 2));
      });
      lanterns.count(hang.length);
      if (glowMesh?.instanceColor) glowMesh.instanceColor.needsUpdate = true;
    };
    swing(0);

    // ---- the joke: the greens barrow and its robot, out on the grass to the left of the carts, facing the camera
    const gAt = units([-50, 50]), gRy = YAW;
    const grn = keep(env.place('mkt:greens', greens(), gAt, gRy), true);
    env.halo(grn.parts.base, [0, 14, 0], 22, 0x39d353, 0.45);
    env.light([gAt[0], 2.4, gAt[1]], 0x7dff9a, 2.5, 4);
    colliders.push(...footprint(V, gAt, gRy, [-11, -16, 11, 7], 2, 2));
    const GP = onModel(V, gAt, gRy), greensSpot = GP(17, 7), greensMid = GP(0, -2);
    // the cat sits up on the barrow's left end, among the greens, watching the can drip
    const puss = keep(env.place('mkt:cat', cat(), GP(-9, 1), gRy + 0.35));
    puss.group.position.y = 5 * V; // its paws on the tray's rim
    stops.greens = {
      spot: greensSpot, face: greensMid,
      view: { target: [greensMid[0] + (greensSpot[0] - greensMid[0]) * 0.3, 3.5, greensMid[1] + (greensSpot[1] - greensMid[1]) * 0.3], yaw: gRy, pitch: 0.65, fit: 6.5 },
      on(yuuv) { yuuv.play('point'); env.after(0.6, () => puss.act()); env.after(1.7, () => { env.face('camera'); yuuv.play('laugh'); }); },
    };
    targets.push({ object: grn.group, stop: 'greens', label: 'Fresh greens' }, { object: puss.group, stop: 'greens', label: 'The cat' });

    // ---- a market day's clutter: crates, sacks and barrels between the stalls and by the carts
    const mids = L.stalls.slice(1).map((s, i) => (s.phi + L.stalls[i].phi) / 2);
    const spots = [
      ...mids.filter((phi) => Math.abs(phi - L.laneAngle) > 14 * DEG).map((phi, i) => [['crates', 'barrel', 'sacks', 'crystals', 'crates', 'barrel'][i % 6], ...L.back(phi, 75), i + 1]),
      ['fruit', ...L.front(-86 * DEG, 40), 7], ['sacks', ...L.front(88 * DEG, 42), 8],
    ];
    keep(env.place('mkt:clutter', clutter(spots), [0, 0]), true);
    for (const [, x, z] of spots) colliders.push([x * V - 0.75, z * V - 0.75, x * V + 0.75, z * V + 0.75]);
    for (const [x, z] of posts) {
      colliders.push([x * V - 0.35, z * V - 0.35, x * V + 0.35, z * V + 0.35]);
      env.light([x * V, 5.6, z * V + 0.6], 0xffc764, 2.6, 4.5); // the pennant's coin and the post catch it
    }

    // ---- a tree at the east rim (the west one gave way to the gate: the houses round the square hide it)
    for (const [x, z, seed] of [[77, -10, 3]]) {
      const p = units([x, z]);
      env.place(`tree:${seed}`, tree(seed), p, seed * 1.3);
      colliders.push([p[0] - 0.45, p[1] - 0.45, p[0] + 0.45, p[1] + 0.45]);
    }

    // ---- a stop at each stall: he stands at its front corner, on its left unless that side is taken (a
    // neighbour, the edge), and holds the ware in the hand nearer the stall. The camera looks at the stall as
    // squarely as the town's own camera allows and aims between the ware and him, so the whole stall shows
    // (awning, tag, counter) with him beside it. The arc's two ends it can only see at a slant: there it looks
    // down more steeply, a little closer, and aims into the stall, so the carts at the square's front stay out of
    // the frame (tested from 1440 x 900 and 390 x 844, alone and in the town). A cart's camera looks at it from
    // the south, high enough to clear the houses round the square.
    const edge = edgeOf(92, 76, 6), free = ([x, z]) => edge(x / V, z / V) < 0.88 && !colliders.some(([a, b, c, d]) => x > a - 0.5 && x < c + 0.5 && z > b - 0.5 && z < d + 0.5);
    for (const { g, pl, item, A, P } of shops) {
      const away = pl.kind === 'cart' && L.gate !== null && pl.phi > L.gate ? -1 : 1; // a cart right of the lane: his side away from it (and its gate post)
      const side = free(P(A.spot[0] * away, A.spot[1])) || !free(P(-A.spot[0] * away, A.spot[1])) ? away : -away;
      const itemAt = P(A.item[0], A.item[2]), spot = P(A.spot[0] * side, A.spot[1]), cart = pl.kind === 'cart';
      const yaw = clampYaw(pl.ry), swing = Math.abs(Math.atan2(Math.sin(pl.ry - yaw), Math.cos(pl.ry - yaw))), slant = Math.min(1, swing / 0.15);
      const from = cart ? P(0, 5) : itemAt, into = cart ? 0 : 8 * V * slant;
      const aim = [from[0] + (spot[0] - from[0]) * 0.3 - Math.sin(pl.ry) * into, from[1] + (spot[1] - from[1]) * 0.3 - Math.cos(pl.ry) * into];
      stops[item.id] = {
        spot, face: itemAt,
        // a cart's from the south, over the houses round the square: one right of the lane from higher (the houses on that
        // side stand taller and nearer)
        view: cart ? (pl.phi > (L.gate ?? 0) ? { target: [aim[0], 4.5, aim[1]], yaw: 0.5, pitch: 1.02, fit: 7 } : { target: [aim[0], 4.5, aim[1]], yaw: Math.min(0.6, yaw), pitch: 0.85, fit: 7 }) : { target: [aim[0], 4.5, aim[1]], yaw, pitch: 0.7 + swing, fit: 6 - 0.5 * slant },
        on(yuuv) { pickUp(g, itemAt, side, cart ? 0 : swing, () => yuuv.play(REACT[item.id] || 'point')); },
      };
    }

    // ---- main: at the square's front, just out past the two middle carts, facing the camera (nothing stands between him and it)
    const mainSpot = units(L.gate !== null ? L.front(L.gate, 58) : L.front(0, 56)); // in the gateway, when the street comes in at the front
    stops.main = {
      spot: mainSpot, face: 'camera',
      view: { target: [fAt[0] - F[0] * 1.2, 2.4, fAt[1] - F[1] * 1.2], yaw: YAW, pitch: 0.7, fit: 12.2 },
      on: (yuuv) => yuuv.play('wave'),
    };

    // ---- picking a ware up: he looks at it, lifts it onto one hand, turns to show you, turns it over,
    // and puts it back. Timed on the world's clock; walking off puts it straight back. Where the camera looks down
    // steeply (the arc's ends) he tips his head back to it, so his face shows under the curls.
    const hold = { g: null, k: 0, want: 0, t: 0, side: 1, up: 0 };
    const hand = new THREE.Vector3();
    function pickUp(g, itemAt, side, up, then) {
      env.after(0.6, () => { if (hold.g && hold.g !== g) { hold.g.ctx.mem.held = 0; hold.k = 0; } Object.assign(hold, { g, want: 1, t: 0, side, up }); });
      env.after(0.9, () => env.face('camera'));
      env.after(4.2, () => env.face(itemAt));
      env.after(4.5, () => { hold.want = 0; });
      env.after(5.2, () => { env.face('camera'); then(); });
    }
    function holding(dt) {
      const g = hold.g;
      if (!g) return;
      const y = env.yuuv;
      if (y.state.moving) hold.want = 0;
      hold.k = hold.want > hold.k ? Math.min(hold.want, hold.k + dt / 0.4) : Math.max(hold.want, hold.k - dt / 0.4);
      hold.t += dt;
      const e = smooth(hold.k), p = y.parts;
      // the hand nearer the stall out, palm up (the ware then sits between him and the stall as you see it); the other on his hip
      const [arm, fore, hip, hipFore, s] = hold.side > 0 ? [p.armL, p.foreL, p.armR, p.foreR, 1] : [p.armR, p.foreR, p.armL, p.foreL, -1];
      arm.rotation.x -= 1.2 * e; arm.rotation.z += 0.45 * e * s; fore.rotation.x -= 0.5 * e;
      hip.rotation.z -= 0.5 * e * s; hipFore.rotation.z += 1.25 * e * s;
      p.head.rotation.x -= hold.up * e;
      y.group.updateMatrixWorld(true);
      fore.localToWorld(hand.set(0, -3.4, 0.5));
      g.group.updateMatrixWorld(true);
      g.ctx.model.worldToLocal(hand);
      const it = g.parts.item, over = smooth(clamp01((hold.t - 1.1) / 1.1));
      it.position.lerp(hand.add(v3.set(0, 0.6, 0)), e);
      it.rotation.x += e * Math.PI * 2 * over; // turned over once
      it.rotation.y += e * (0.6 * Math.sin(hold.t * 1.4) + (YAW - g.group.rotation.y) * 0.5);
      it.scale.multiplyScalar(1 - 0.22 * e);
      g.ctx.mem.held = e;
      if (hold.k === 0 && hold.want === 0) { g.ctx.mem.held = 0; hold.g = null; }
    }

    return {
      group, stops, targets, colliders,
      update(dt, t) {
        holding(dt);
        if (lod.getCurrentLevel() === 0) swing(t);
      },
      panel: (stop) => (stop === 'main' ? '<p>Pick a stall and Yuuv goes over to look at what is on its counter.</p>' : null),
    };
  },
};
