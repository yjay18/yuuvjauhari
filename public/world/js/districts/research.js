// The Observatory (research): a stone tower with a verdigris dome split open and a
// brass telescope that tracks a duck across the holographic star map over it, an owl
// in goggles on the rail, the astronomer's night at its foot, and round it four
// lecterns, one per paper, each with a pop-up diorama rising out of an open book.
// Yuuv at the door waves at the sky (a shooting star; the owl turns its head right
// round); at a lectern he points and its diorama folds flat, pops up again and has
// its moment (the alarm, the deal, the flip, the verdict).
import { tower, orrery, TOWER } from '../models/obs_tower.js';
import { lectern, LECTERN } from '../models/obs_lecterns.js';
import { tree } from '../models/props.js';

const T = [0.3, -1.4]; // the tower (island units)
const TR = 0.6; // the tower turns this far, its door between the town's camera and the Hill Stair's top (south-east)
const RING = 5.4; // the lecterns stand this far round it, two either side of a clear way to the door from the stair
const ARC = { icu: -0.95, negotiation: 0.05, emoji: 1.45, legal: 2.45 }; // their angles from +z, left to right as the town sees them
const GLOW = { icu: 0x5dffb0, negotiation: 0x6ff2ff, emoji: 0xffd23f, legal: 0xffc764 };
const YAW = 0.45;

export default {
  id: 'research',
  title: 'Observatory',
  lede: 'Four research projects, one per lectern.',
  island: {
    A: 72, B: 64, seed: 2,
    plazas: [[T[0] / 0.15, T[1] / 0.15, 45]],
    paths: ({ dock }) => (dock ? [[dock, [T[0] / 0.15 + (dock[0] - T[0] / 0.15) * 0.4, T[1] / 0.15 + (dock[1] - T[1] / 0.15) * 0.4]]] : []),
  },
  build(env, chapter) {
    const { V } = env;
    const at = (a, r) => [T[0] + Math.sin(a) * r, T[1] + Math.cos(a) * r];
    const stops = {}, targets = [], colliders = [];
    const box = ([x, z], hx, hz = hx) => [x - hx, z - hz, x + hx, z + hz];
    const noShadow = (o) => o.traverse((m) => { if (m.isMesh) { m.userData.caster = false; m.castShadow = false; } }); // small or far things: not worth a shadow pass

    // ---- the tower: a lamp in the dome (so the brass stays warm at night), the door's light, glows on the lens, the map, the duck, the owl's goggles
    const obs = env.place('obs:tower', tower(), T, TR);
    const P = obs.parts;
    noShadow(P.owl);
    env.halo(P.scope, [0, 0, 15.5], 9, 0x9ff8ff, 0.9);
    env.halo(P.map, [0, 0, 0], 40, 0x6f9fff, 0.22);
    env.halo(P.duck, [-8, 0, 0], 12, 0xffd23f, 0.55);
    env.halo(P.owlEyes, [0, 0, 1], 6, 0x7ff7ff, 0.8);
    env.light([T[0], 9.8, T[1] + 0.6], 0xffc27a, 4, 5);
    env.light([T[0], 3.4, T[1] + 2.6], 0xffd08a, 3, 5);
    const turn = ([u, w]) => [T[0] + (u * Math.cos(TR) + w * Math.sin(TR)) * V, T[1] + (-u * Math.sin(TR) + w * Math.cos(TR)) * V]; // tower voxels to island units
    const [f0, f1, f2, f3] = TOWER.foot, foot = [[f0, f1], [f2, f1], [f0, f3], [f2, f3]].map(turn);
    colliders.push(box(T, 2.2), [Math.min(...foot.map((q) => q[0])), Math.min(...foot.map((q) => q[1])), Math.max(...foot.map((q) => q[0])), Math.max(...foot.map((q) => q[1]))]); // the tower, the props at its foot
    targets.push({ object: obs.group, stop: 'main', label: 'The Observatory' });

    // ---- the lecterns, one per paper, in an arc before the door
    let now = 0, lookAt = -10; // the world's clock, and when he last looked up at the sky (see main)
    for (const item of chapter.items) {
      const a = ARC[item.id];
      if (a === undefined) continue;
      const p = at(a, RING), ry = YAW + (a - YAW) * 0.5;
      const l = env.place(`obs:${item.id}`, lectern(item.id), p, ry);
      Object.entries(l.parts).forEach(([n, part], i) => { if (n !== 'base' && i > 1) noShadow(part); }); // the lectern and its diorama's first piece cast; the small moving bits do not
      env.halo(l.parts.base, [0, 24, 0], 20, GLOW[item.id], 0.28);
      env.light([p[0] + Math.sin(ry) * 0.6, 3.6, p[1] + Math.cos(ry) * 0.6], GLOW[item.id], item.id === 'legal' ? 5 : 3.5, 4.5); // a little in front, so the brass and faces catch it
      const c = Math.cos(ry), s = Math.sin(ry), [x0, z0, x1, z1] = LECTERN.foot.map((v) => v * V);
      const half = item.id === 'legal' ? 1.62 : Math.max(-x0, x1);
      const corners = [[-half, z0], [half, z0], [-half, z1], [half, z1]].map(([u, w]) => [p[0] + u * c + w * s, p[1] - u * s + w * c]);
      colliders.push([Math.min(...corners.map((q) => q[0])), Math.min(...corners.map((q) => q[1])), Math.max(...corners.map((q) => q[0])), Math.max(...corners.map((q) => q[1]))]);
      const yaw = Math.min(YAW + 1, YAW + (a - YAW) * 0.55), right = [Math.cos(yaw), -Math.sin(yaw)], toward = [Math.sin(yaw), Math.cos(yaw)];
      const side = a < YAW ? 1 : -1; // beside it, on the side toward the door, a little nearer us
      const spot = [p[0] + right[0] * side * 2.4 + toward[0] * 0.25, p[1] + right[1] * side * 2.4 + toward[1] * 0.25];
      stops[item.id] = {
        spot,
        face: [p[0] + toward[0] * 1.6, p[1] + toward[1] * 1.6], // half toward it, half toward us
        view: { target: [p[0] + right[0] * side * 0.9, 2.75, p[1] + right[1] * side * 0.9], yaw, pitch: 0.55, fit: 4 }, // steep enough that the citadel wall frames it, over the wall from the phone too
        on(yuuv) {
          lookAt = -10; // (in case he came straight from the door)
          yuuv.play('point');
          env.after(0.35, () => l.act());
          env.after(2.6, () => { env.face('camera'); yuuv.play('wave'); });
        },
      };
      targets.push({ object: l.group, stop: item.id, label: item.title });
    }

    // ---- trees behind the tower, clear of every view (the front stays open to the lecterns)
    for (const [x, z, seed] of [[T[0] - 6.4, T[1] - 3.6, 2], [T[0] + 2.6, T[1] - 6.4, 3]]) {
      noShadow(env.place(`tree:${seed}`, tree(seed), [x, z], seed * 1.3).group);
      colliders.push(box([x, z], 0.45));
    }

    // a garden orrery on the lawn before the door
    const orr = [T[0] + 4.5, T[1] + 8];
    env.halo(env.place('obs:orrery', orrery(), orr).parts.base, [0, 10, 0], 7, 0xffd08a, 0.7);
    colliders.push(box(orr, 0.7));

    // at the door he looks up and waves at the sky; the sky answers (a shooting star, the duck flares) and the owl turns its head right round
    const door = at(TR, 2.95);
    stops.main = {
      spot: [door[0] - Math.cos(YAW) * 0.8, door[1] + Math.sin(YAW) * 0.8], face: 'camera',
      view: { target: [T[0] + 0.2, 5.6, T[1] + 1.6], yaw: YAW, pitch: 0.5, fit: 10.6 },
      on(yuuv) {
        lookAt = now;
        env.after(0.35, () => yuuv.play('wave'));
        obs.ctx.wave();
      },
    };
    return {
      stops, targets, colliders,
      update(dt, t) {
        now = t;
        const u = t - lookAt; // his head goes back to look at the sky (after his own rig has posed him this frame)
        if (u > 0 && u < 3.2 && !env.yuuv.state.moving) {
          const e = Math.min(1, u / 0.45) ** 2 * (1 - Math.max(0, Math.min(1, (u - 2.5) / 0.7)));
          env.yuuv.parts.head.rotation.x -= 0.42 * e;
          env.yuuv.parts.body.rotation.x -= 0.06 * e;
        }
      },
      panel: (stop) => (stop === 'main' ? '<p>Click a lectern and Yuuv walks over to it. Its book pops up.</p>' : null),
    };
  },
};
