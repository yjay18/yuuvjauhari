// The Lighthouse (say hello). A tall lighthouse of pale coursed stone on the island's rocky point,
// a slate band spiralling up it with a line of circuit light in it, a gallery rail, and a lantern
// room whose crystal lens turns and throws two soft beams round the sky (bright at night, faint by
// day). By it the keeper's cottage with a lit window and smoke from the chimney; a red mailbox by
// the lane; a bench and a telescope at the island's edge, looking out at the sky.
// Click the email address in the panel and a paper plane leaves the mailbox, loops round the
// lighthouse and flies off (the link still opens the mail app as normal). The joke: the carrier
// pigeon on the mailbox, in a tiny postal cap, who is startled by every plane and glares after it.
// The panel itself (email, CV, GitHub, LinkedIn) is the core's, from profile in data.js.
import { lighthouse, cottage, mailbox, telescope, plane, TOWER, MAILBOX } from '../models/lh_lighthouse.js';
import { bench, tree } from '../models/props.js';
import { smooth } from '../models/space.js';

const YAW = 0.45;
// Where things stand (island voxels) and how they turn.
const AT = { tower: [-44, -2], cottage: [-12, -24, 0.3], mailbox: [24, 6, 0.45], bench: [-8, 34, 0.45], scope: [4, 36, 0.3] };
const LOD_FAR = 115; // camera distance (units) past which the small things are not drawn

export default {
  id: 'contact',
  title: 'Lighthouse',
  island: {
    A: 70, B: 54, seed: 7,
    paths: ({ dock }) => [
      [...(dock ? [dock] : [[68, -14]]), [40, 0], [26, 13]],
      [[26, 13], [4, 8], [-26, 6], [-44, 12]],
      [[-4, 8], [-4, 28]],
    ],
    flags: [[-18, 30, 12, 40]],
  },
  build(env) {
    const { THREE, V } = env;
    const u = ([x, z]) => [x * V, z * V];
    const onModel = ([x0, z0], ry) => (a, w) => [x0 + (a * Math.cos(ry) + w * Math.sin(ry)) * V, z0 + (-a * Math.sin(ry) + w * Math.cos(ry)) * V];
    const group = new THREE.Group();
    const lod = new THREE.LOD(), near = new THREE.Group();
    lod.addLevel(near, 0); lod.addLevel(new THREE.Group(), LOD_FAR);
    group.add(lod);
    const keep = (r, shadow = true) => { near.add(r.group); if (!shadow) r.group.traverse((o) => { if (o.isMesh) o.userData.caster = false; }); return r; };
    const stops = {}, targets = [], colliders = [];
    const box1 = ([x, z], r) => [x - r, z - r, x + r, z + r];

    // ---- the lighthouse on its point
    const towerAt = u(AT.tower);
    const tw = env.place('lh:tower', lighthouse(), towerAt);
    env.halo(tw.parts.lens, [0, 0, 0], 34, 0xffe6a8, 1);
    env.halo(tw.parts.pulse, [0, 0, 0], 6, 0x6ff2ff, 0.9);
    env.light([towerAt[0], TOWER.lens * V, towerAt[1]], 0xffe2a0, 9, 16); // the lamp's glow on the island at night
    env.light([towerAt[0] + 0.6, 1.6, towerAt[1] + 1.7], 0xffc764, 2.4, 4); // the door's lantern
    // the tower, and the rocks round its foot (open at the front, where the path comes to the door)
    colliders.push(box1(towerAt, 1.75), [towerAt[0] - 2.9, towerAt[1] - 2.9, towerAt[0] - 1, towerAt[1] + 1.6], [towerAt[0] + 1, towerAt[1] - 2.9, towerAt[0] + 2.9, towerAt[1] + 1.6], [towerAt[0] - 2.9, towerAt[1] - 2.9, towerAt[0] + 2.9, towerAt[1] - 1]);
    targets.push({ object: tw.group, stop: 'tower', label: 'The lighthouse' });

    // ---- the keeper's cottage
    const [cx, cz, cry] = AT.cottage, cAt = u([cx, cz]);
    const cot = env.place('lh:cottage', cottage(), cAt, cry);
    const CP = onModel(cAt, cry);
    const win = CP(3, 9);
    env.light([win[0], 1.3, win[1]], 0xffc764, 3, 5);
    env.halo(cot.parts.cottage, [3, 7, 10], 12, 0xffc764, 0.7);
    for (const [a, b, c, d] of [[-17, -9, 0, 12], [0, -9, 14, 12]]) { const pts = [CP(a, b), CP(c, b), CP(a, d), CP(c, d)]; colliders.push([Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))]); }
    targets.push({ object: cot.group, stop: 'main', label: "The keeper's cottage" });

    // ---- the mailbox (and its pigeon) by the lane
    const [mx, mz, mry] = AT.mailbox, mAt = u([mx, mz]);
    const mbox = keep(env.place('lh:mailbox', mailbox(), mAt, mry));
    env.halo(mbox.parts.box, [0, 16, 7], 7, 0x6ff2ff, 0.8);
    env.light([mAt[0], 2.4, mAt[1]], 0x6ff2ff, 1.6, 3);
    colliders.push(box1(mAt, 0.55));
    targets.push({ object: mbox.group, stop: 'main', label: 'The mailbox' });
    const MP = onModel(mAt, mry), slot = MP(MAILBOX.slot[0], MAILBOX.slot[2]);
    // the pigeon glares the way the planes go: toward the lighthouse, in the mailbox's own turn
    mbox.ctx.mem.glare = Math.atan2(towerAt[0] - mAt[0], towerAt[1] - mAt[1]) - mry;

    // ---- a bench and a telescope at the edge, looking out at the sky
    const [bx, bz, bry] = AT.bench, bAt = u([bx, bz]);
    const seat = keep(env.place('bench', bench(), bAt, bry), false);
    colliders.push(box1(bAt, 1));
    const [sx, sz, sry] = AT.scope, sAt = u([sx, sz]);
    const scope = keep(env.place('lh:scope', telescope(), sAt, sry), false);
    env.halo(scope.parts.tube, [0, 0, 8], 5, 0x9ff8ff, 0.6);
    colliders.push(box1(sAt, 0.7));
    targets.push({ object: scope.group, stop: 'scope', label: 'The telescope' }, { object: seat.group, stop: 'scope', label: 'A bench looking out' });

    // ---- trees
    for (const [x, z, seed] of [[34, -26, 1], [50, 18, 3], [-22, -40, 2]]) {
      const p = u([x, z]);
      env.place(`tree:${seed}`, tree(seed), p, seed * 1.1);
      colliders.push(box1(p, 0.45));
    }

    // ---- stops
    const mainSpot = MP(10, 5); // on the mailbox's right as you see it, so it and its pigeon stay in view
    stops.main = {
      spot: mainSpot, face: 'camera',
      // views look from the south-west: toward the camera from here lies the Market's island, whose stalls
      // would stand in the foreground
      view: { target: [(towerAt[0] + mAt[0]) / 2 + 0.6, 5.6, -0.2], yaw: YAW - 0.35, pitch: 0.42, fit: 10.2 },
      on: (yuuv) => yuuv.play('wave'),
    };
    const doorAt = [towerAt[0] + 0.3, towerAt[1] + 2.25];
    stops.tower = {
      spot: [doorAt[0] + 1.2, doorAt[1] + 0.4], face: [towerAt[0], towerAt[1]],
      view: { target: [towerAt[0] + 0.8, 6.2, towerAt[1] + 1], yaw: YAW - 0.4, pitch: 0.3, fit: 8.4 },
      on(yuuv) { yuuv.play('point'); env.after(1.9, () => { env.face('camera'); yuuv.play('wave'); }); },
    };
    const SP = onModel(sAt, sry);
    stops.scope = {
      spot: SP(-2, -14), face: sAt,
      view: { target: [(sAt[0] + bAt[0]) / 2, 1.6, (sAt[1] + bAt[1]) / 2 - 0.4], yaw: YAW - 0.3, pitch: 0.5, fit: 4.4 },
      on(yuuv) {
        scope.ctx.mem.look = 1; // it swings down to him
        yuuv.play('point');
        env.after(2.2, () => { scope.ctx.mem.look = 0; env.face('camera'); yuuv.play('cheer'); });
      },
    };

    // ---- the paper plane: out of the slot, a loop and a half round the lighthouse, off into the sky
    const pl = env.place('lh:plane', plane(), slot, 0);
    pl.group.visible = false;
    const trail = env.place('lh:trail', { gait: 'still', build: () => ({ parts: {} }) }, [0, 0]);
    const flight = { t0: -1, curve: null };
    let clock = 0;
    const route = () => {
      const [tx, tz] = towerAt, R = 3.3, a0 = Math.atan2(slot[0] - tx, slot[1] - tz), pts = [
        new THREE.Vector3(slot[0], 2.4, slot[1]),
        new THREE.Vector3(slot[0] + Math.sin(mry) * 0.7, 3, slot[1] + Math.cos(mry) * 0.7),
      ];
      for (let k = 0; k <= 10; k += 1) { const a = a0 - 0.5 - (k / 10) * Math.PI * 3, y = 4 + (k / 10) * 7.5; pts.push(new THREE.Vector3(tx + Math.sin(a) * R, y, tz + Math.cos(a) * R)); }
      const out = [Math.sin(-2.2), Math.cos(-2.2)];
      for (const [d, y] of [[3, 12.5], [9, 15.5], [18, 20]]) pts.push(new THREE.Vector3(tx + out[0] * (R + d), y, tz + out[1] * (R + d)));
      return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    };
    function launch() {
      flight.curve = route();
      flight.t0 = clock;
      pl.group.visible = true;
      mbox.ctx.send();
      // if he is by the mailbox, he watches it go
      const p = env.yuuv.group.position, root = pl.group.parent;
      const mWorld = root ? root.localToWorld(new THREE.Vector3(mAt[0], 0, mAt[1])) : null;
      if (mWorld && Math.hypot(p.x - mWorld.x, p.z - mWorld.z) < 3 && !env.yuuv.state.moving) {
        env.face(towerAt); env.yuuv.ctx.play('point');
        env.after(3.4, () => { env.face('camera'); env.yuuv.ctx.play('cheer'); });
      }
    }
    // An email link in the Lighthouse's panel sends one. The link itself goes on to open the mail app.
    if (typeof document !== 'undefined') document.addEventListener('click', (e) => {
      const a = e.target.closest?.('a[href^="mailto:"]');
      if (a && a.closest('#panel') && document.getElementById('panel')?.dataset.place === 'contact') launch();
    }, true);
    const pos = new THREE.Vector3(), ahead = new THREE.Vector3(), m4 = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
    const DUR = 8.5;
    function fly() {
      const s = (clock - flight.t0) / DUR;
      if (flight.t0 < 0 || s >= 1) { if (pl.group.visible) pl.group.visible = false; flight.t0 = -1; return; }
      const e = s < 0.12 ? 0.5 * s + 0.5 * smooth(s / 0.12) * s : s; // a slower start out of the slot
      flight.curve.getPointAt(Math.min(1, e), pos);
      flight.curve.getPointAt(Math.min(1, e + 0.01), ahead);
      pl.group.position.copy(pos);
      m4.lookAt(ahead, pos, up);
      pl.group.quaternion.setFromRotationMatrix(m4);
      const turn = s > 0.12 && s < 0.78 ? 1 : 0;
      pl.group.rotateZ(0.55 * turn + 0.08 * Math.sin(clock * 6)); // banked into the loop, a wobble
      pl.group.scale.setScalar(Math.max(0.001, 1.4 * (1 - smooth((s - 0.82) / 0.18))));
      if (Math.floor(clock * 24) !== flight.spark) { // a trail of sparkles
        flight.spark = Math.floor(clock * 24);
        trail.ctx.bit(pos.x, pos.y, pos.z, 0, 0.12, 0, 0.9, 0.05, 0xd8fdff, 0x9b7bff, { drag: 0.6 });
      }
    }

    return {
      group, stops, targets, colliders,
      update(dt, t, night) {
        clock = t;
        tw.ctx.mem.beamMat.uniforms.uStrength.value = 0.06 + 0.56 * night; // a faint sweep by day, a soft bright one by night
        fly();
      },
      panel: (stop) => (stop === 'main' ? '<p>Write to me and a paper plane sets off from the mailbox.</p>' : null),
    };
  },
};
