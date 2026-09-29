// The Sky Docks (work): the harbour cliff is a harbour in the sky. Six timber jetties on tall stone piers that stand in
// the sea at the cliff's foot line its east rim (the plot's cliff edge, 12 degrees apart), and at the end of each a
// mooring mast holds an airship by its nose, one per job in the chapter's order from north to south, the ships
// fanned wider than their jetties so each tail swings clear of the next: one fleet (the same hull, round tapered
// envelope and livery) but each its own colour, size, pennant glyph and detail. The flagship keeps a
// lookout in a crow's nest; one carries an owl on its envelope; one lets down a sounding line marked in fathoms; one
// wears rocket boosters; one carries a net of scrolls; the smallest, the school club's, is patched, dressed in
// bunting, has a robot on a lookout deck and (the joke) a yellow wheel clamp on its propeller with a ticket tied to
// it, while the parking meter on its jetty blinks red. The dockmaster's hut keeps the ledger, a glowing board with a
// row per ship, where the club's lamp is red too. A crane slews cargo over a paved quay, a lamp and a hologram anchor
// stand at the bridge, and at night the envelopes glow faintly from inside.
//
// Stops: 'main' at the hut's door (he waves, the harbour bell rings); one per ship at its jetty's foot, the view on the
// ship from its side (he looks up at it and points, it toots, revs and rolls to him, the ledger's cursor finds its
// row, then he turns and waves; a cheer for the flagship, a laugh for the clamped school ship).
import { edgeOf, lampDef, LAMP_ORB } from '../models/island.js';
import { berth, berthInfo } from '../models/dock_airship.js';
import { hut, crane, yard, quay } from '../models/dock_harbour.js';
import { tree } from '../models/props.js';
import { smooth } from '../models/space.js';

const V = 0.15;
const ISLAND = { A: 88, B: 76, seed: 3 };

// The fleet, in the chapter's order: where on the rim it berths (degrees from east, toward +z; 12 apart along the cliff,
// which is open sea from about -30 to 30, walls and towers beyond), its heading (degrees, a wider fan), its stop's view
// (how far in front of side-on, fit, pitch), size, colours, glyph and detail.
const G7 = (s) => s.split(' ');
const FLEET = {
  quantexa: { at: -30, head: -45, view: [0, 7], size: 'L', tint: 0x8ee6dc, glow: 0x6ff2e6, holo: [0xe8fffb, 0x5ff0e0, 0x1f9f96], detail: 'nest', glyph: G7('.#####. #.....# #.#.#.# #.....# .####.. ..#.... .#.....') }, // a speech bubble
  oracle: { at: -18, head: -27, view: [0.55, 7], size: 'M', tint: 0xc3a6f0, glow: 0xc49bff, holo: [0xf3e8ff, 0xb98bff, 0x7a4fd0], detail: 'owl', glyph: G7('..###.. ..###.. ...#... .#####. .#.#.#. ##.#.## ##.#.##') }, // an org chart
  fathom: { at: -6, head: -9, view: [0, 7], size: 'M', tint: 0x93b2f0, glow: 0x7cc8ff, holo: [0xe8f6ff, 0x6fc8ff, 0x2f86c8], detail: 'sounding', glyph: G7('...##.. .#####. ####### ....... ...#... ..###.. .#####.') }, // a cloud, and up into it
  blastasia: { at: 6, head: 9, view: [0.55, 7], size: 'M', tint: 0xf6b07c, glow: 0xffb347, holo: [0xfff3dc, 0xffb347, 0xd9772a], detail: 'boosters', glyph: G7('####### #.#...# ####### #.#...# #.#.#.# #.#...# #######') }, // a user interface, laid out
  propylon: { at: 18, head: 27, view: [0, 7], size: 'M', tint: 0x9ad69a, glow: 0x6bff9a, holo: [0xe8fff0, 0x5dffa0, 0x2fae6a], detail: 'net', glyph: G7('...#... ####### #..#..# #..#..# ##.#.## ...#... .#####.') }, // scales
  minet: { at: 30, head: 45, view: [0, 6.8, 0.8], size: 'S', tint: 0xffffff, lamp: 0xe4b64c, glow: 0xff6ad8, holo: [0xffe6fb, 0xff5ad8, 0xb8309a], detail: 'robot', glyph: G7('...#... .#####. #.#.#.# ####### #.###.# .#####. .#...#.') }, // a robot's head
};

// ---- the harbour's geometry, from the island's own outline (island units; the rim and its outward normal per berth)
const edge = edgeOf(ISLAND.A, ISLAND.B, ISLAND.seed);
const walkEdge = 1 - 1 / (Math.min(ISLAND.A, ISLAND.B) * V);
const rimAt = (th) => { let lo = 0, hi = 3 * ISLAND.A; for (let i = 0; i < 40; i += 1) { const m = (lo + hi) / 2; if (edge(Math.cos(th) * m, Math.sin(th) * m) < 1) lo = m; else hi = m; } return lo * V; };
const rot = (ry, [x, z]) => [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)]; // a model point turned ry about y
const BERTHS = Object.entries(FLEET).map(([id, f]) => {
  const th = (f.at * Math.PI) / 180, r = rimAt(th), n = [Math.cos(th), Math.sin(th)], rim = [n[0] * r, n[1] * r];
  const ph = ((f.head ?? f.at) * Math.PI) / 180; // the ship's heading: straight out along its jetty, unless turned
  let inset = 1.35; // the jetty's foot: just inside the walkable ground
  while (edge((rim[0] - n[0] * inset) / V, (rim[1] - n[1] * inset) / V) > walkEdge - 0.015) inset += 0.05;
  return { id, ...f, rim, n, ry: Math.atan2(-n[0], -n[1]), yaw: Math.PI / 2 + th - ph, spot: [rim[0] - n[0] * inset, rim[1] - n[1] * inset], side: Math.atan2(Math.sin(-ph), Math.cos(-ph)) };
});
// The hut, the crane, the yards and the trees (island units; turned ry). The harbour side is paved as a quay.
const HUT = { at: [-4.2, 1.8], ry: 0.3 };
const CRANE = { at: [-0.6, -5.4], ry: 1.4 };
const YARDS = [[-3.4, -7.4, 0.4, 1]];
const QUAYS = [[6.8, -2.6, 2.1], [7.2, 4.4, 0.9]]; // quay furniture: lantern, bollards, barrels, a cart
const TREES = [[-9.6, 5.4, 2, 13], [-2.2, 9.1, 3, 12], [-7.8, -6.9, 1, 12]];
const at = (o, [u, w]) => { const [x, z] = rot(o.ry, [u * V, w * V]); return [o.at[0] + x, o.at[1] + z]; };
const DOOR = at(HUT, [-8.5, 18]);
const vox = ([x, z]) => [Math.round(x / V), Math.round(z / V)];

export default {
  id: 'work',
  title: 'Sky Docks',
  island: {
    ...ISLAND,
    // from the street to the hut's door, round to the quay, along the quay past every jetty's foot, and up from the
    // postern to the school ship's jetty at the quay's south end
    paths: ({ dock, docks }) => [
      [...(dock ? [dock] : []), [-58, 12], vox(DOOR)],
      [vox(DOOR), [-6, 14], [10, 4]],
      BERTHS.map((b) => vox(b.spot)),
      ...(docks && docks[1] ? [[docks[1], [36, 54], vox(BERTHS[BERTHS.length - 1].spot)]] : []),
    ],
    // the quay: flagstones in a band along the jetties' feet
    flags: [
      ...BERTHS.flatMap((b) => [0.9, 2.6].map((k) => { const [x, z] = vox([b.rim[0] - b.n[0] * (1.9 + k), b.rim[1] - b.n[1] * (1.9 + k)]); return [x - 15, z - 15, x + 15, z + 15]; })),
      [-34, -60, 8, -24], // the cargo yard under the crane
    ],
  },
  build(env, chapter) {
    const { V: v } = env;
    const stops = {}, targets = [], colliders = [], ships = [];
    const box1 = ([x, z], r = 0.5) => [x - r, z - r, x + r, z + r];
    const turn = (o, pts) => { const w = pts.map((p) => at(o, p)); return [Math.min(...w.map((p) => p[0])), Math.min(...w.map((p) => p[1])), Math.max(...w.map((p) => p[0])), Math.max(...w.map((p) => p[1]))]; };

    // ---- the dockmaster's hut and its ledger, a row per ship in the chapter's order
    const items = chapter.items.filter((it) => FLEET[it.id]);
    const hutDef = hut(items.map((it) => ({ chip: FLEET[it.id].glow, lamp: it.id === 'minet' ? 'stop' : 'ok' })));
    const office = env.place('dock:hut', hutDef, HUT.at, HUT.ry);
    office.ctx.mem.wind = Math.atan2(0.64, 0.77) - HUT.ry; // the windsock points downwind, out past the fleet
    for (const [a, b, c, d] of hutDef.info.blocks) colliders.push(turn(HUT, [[a, b], [c, b], [a, d], [c, d]]));
    env.halo(office.parts.body, [4, 13, 11], 26, 0x9fdcff, 0.4);
    env.halo(office.parts.beacon, [0, 0, 0], 12, 0xffd27a, 0.9);
    const ledgerAt = at(HUT, [4, 13]);
    env.light([ledgerAt[0], 2, ledgerAt[1]], 0x9fdcff, 4, 6);
    const lampAt = at(HUT, [-15, 13]);
    env.light([lampAt[0], 1.9, lampAt[1]], 0xffc764, 4, 5);
    targets.push({ object: office.group, stop: 'main', label: "The dockmaster's hut" });

    // ---- the fleet, each at its berth
    BERTHS.forEach((b) => {
      const item = chapter.items.find((it) => it.id === b.id);
      if (!item) return;
      const info = berthInfo(b.size);
      const r = env.place(`dock:${b.id}`, berth({ key: b.id, ...b, drop: Math.round(env.plot.y / v) }), b.rim, b.ry);
      for (const n of ['prop', 'extra', 'arm', 'sail']) r.parts[n]?.traverse((m) => { if (m.isMesh) m.userData.caster = false; }); // small parts cast no shadow
      const o = { at: b.rim, ry: b.ry };
      // points on the ship in the berth's frame (it hangs from the nose on the mast, turned yaw), then the island's
      const toBerth = ([x, y, z]) => { const [px, pz] = rot(b.yaw, [x, z]); return [info.nose[0] + px, info.nose[1] + y, info.nose[2] + pz]; };
      const mid = toBerth(info.mid), midW = at(o, [mid[0], mid[2]]);
      const mast = at(o, [0, -11]);
      const lantern = at(o, [info.lantern[0], info.lantern[2]]);
      env.light([lantern[0], info.lantern[1] * v, lantern[1]], 0xffc764, 3.5, 5);
      const glow = env.halo(r.parts.hull, info.engine, b.size === 'S' ? 11 : 15, b.glow, 0.75);
      const hullAt = toBerth([(info.len * 0.4), -info.mast * 0.55, 0]), hullW = at(o, [hullAt[0], hullAt[2]]);
      env.light([hullW[0], hullAt[1] * v, hullW[1]], 0xffc98a, 3, 5); // warm light round the gondola
      ships.push({ id: b.id, r, glow, size: glow.scale.x, lit: -1 });
      targets.push({ object: r.group, stop: b.id, label: item.title });
      const k = items.findIndex((it) => it.id === b.id);
      // the view: on the ship (its middle, a little toward the nose), from its side or as near as the town's yaw allows,
      // high enough to see over the next ship along, pulled back so it stands whole against the sky with Yuuv small
      // at the jetty's foot
      const c = toBerth([info.len * 0.35, info.centre[1], 0]), cW = at(o, [c[0], c[2]]);
      const [dyaw, fit, pitch = 0.95] = b.view;
      stops[b.id] = {
        spot: b.spot,
        face: mast,
        view: { target: [cW[0], c[1] * v, cW[1]], yaw: Math.max(-0.55, Math.min(1.45, b.side - dyaw)), pitch, fit },
        on(yuuv) {
          env.face(mast);
          yuuv.play('point');
          pose.lookAt = now;
          office.ctx.select(k);
          env.after(0.35, () => r.act());
          env.after(1.9, () => { env.face('camera'); yuuv.play(b.id === 'minet' ? 'laugh' : b.size === 'L' ? 'cheer' : 'wave'); }); // a laugh for the clamped school ship
        },
      };
    });

    // ---- the crane in its cargo yard, crates by it, furniture on the quay, trees on the lawn
    const lift = env.place('dock:crane', crane(), CRANE.at, CRANE.ry);
    colliders.push(turn(CRANE, [[-5, -5], [4, -5], [-5, 4], [4, 4]]));
    env.halo(lift.parts.jib, [25, 31, 1], 7, 0xffc764, 0.7);
    targets.push({ object: lift.group, stop: 'main', label: 'Sky Docks' });
    YARDS.forEach(([x, z, ry, seed]) => {
      env.place(`dock:yard${seed}`, yard(seed), [x, z], ry);
      colliders.push(turn({ at: [x, z], ry }, [[-12, -7], [12, -7], [-12, 7], [12, 7]]));
    });
    QUAYS.forEach(([x, z, ry]) => {
      env.place('dock:quay', quay(), [x, z], ry);
      colliders.push(turn({ at: [x, z], ry }, [[-10, -6], [8, -6], [-10, 5], [8, 5]]));
      const l = at({ at: [x, z], ry }, [-6.5, -0.5]);
      env.light([l[0], 1.2, l[1]], 0xffc764, 3, 5);
    });
    for (const [x, z, seed, h] of TREES) { env.place(`tree:${seed}:${h}`, tree(seed, { h, r: 6 }), [x, z], seed * 1.7); colliders.push(box1([x, z], 0.45)); }

    // ---- off the bridge: a plasma lamp, and a hologram anchor on its post
    if (env.dock) {
      const [dx, dz] = env.dock, n = Math.hypot(dx, dz), ux = -dx / n, uz = -dz / n; // inland from the landing
      const lamp = [dx + ux * 1.4 - uz * 1.9, dz + uz * 1.4 + ux * 1.9], post = [dx + ux * 1.4 + uz * 1.9, dz + uz * 1.4 - ux * 1.9];
      const l = env.place('lamp', lampDef, lamp);
      env.halo(l.parts.orb, [0, 0, 0], 16, 0x7fe8ff, 1);
      env.light([lamp[0], LAMP_ORB * v, lamp[1]], 0x7fe8ff, 6, 9);
      colliders.push(box1(lamp));
      if (env.fx?.holoSign) {
        const s = env.place('dock:anchor', env.fx.holoSign(G7('...#... ..###.. ...#... ...#... #..#..# ##.#.## .#####.'), [0xfff3dc, 0xffc764, 0xc4861a]), post, Math.atan2(ux, uz) + 0.5);
        colliders.push(box1(post));
        targets.push({ object: s.group, stop: 'main', label: 'Sky Docks' });
      }
    }

    // ---- the dockmaster's stop: by the door, the whole harbour in view
    stops.main = {
      spot: DOOR, face: 'camera',
      view: { target: [5, 2.4, 0.5], yaw: 0.45, pitch: 0.9, fit: 14.5 }, // steep enough that the fleet's fan reads
      on(yuuv) { yuuv.play('wave'); office.ctx.select(-1); env.after(0.3, () => office.act()); },
    };

    // Yuuv's own moment here, laid over his clips: he looks up at the ship while he points at it
    const pose = { lookAt: -10 };
    let now = 0;
    return {
      stops, targets, colliders,
      update(dt, t, night) {
        now = t;
        for (const s of ships) {
          s.glow.scale.setScalar(s.size * (1 + 0.1 * Math.sin(t * 2.6 + s.size))); // the engine breathes
          const m = s.r.ctx.mem;
          if (m.bag && Math.abs(night - s.lit) > 0.005) { s.lit = night; m.bag.emissive.copy(m.tint).multiplyScalar(0.09 * night); } // at night the envelope glows faintly from inside
        }
        const lu = t - pose.lookAt;
        if (lu >= 0 && lu < 1.9 && !env.yuuv.state.moving) env.yuuv.parts.head.rotation.x -= 0.36 * smooth(lu / 0.3) * (1 - smooth((lu - 1.4) / 0.4));
      },
      leave() { office.ctx.select(-1); },
      panel: (stop) => (stop === 'main' ? '<p>Each airship is a job, moored in order. Click one and Yuuv walks down to its jetty.</p>' : null),
    };
  },
};
