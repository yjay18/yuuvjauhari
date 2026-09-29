// The Workshop Quarter (shipped): six workshops, one per product in the chapter,
// in two rows along cobbled lanes. Each arrives crated; Yuuv's first visit drops
// the crate open and boots the shop, whose screen then plays the product's real
// clip (loaded and played only while that workshop is on screen and near).
// Each product's look lives here: roof, paint and hologram colours, a 7 x 7
// glyph for its banner and crate, and a prop for its workbench.
// The quarter's front is a quay on the canal, where the things it makes are shipped: a crane holds one
// product's crate over a punt moored alongside, loaded with two more.
import { workshop, INFO, quay, QUAY } from '../models/workshop.js';
import { lampDef, poleDef, festoon, LAMP_ORB } from '../models/island.js';
import { tree } from '../models/props.js';
import { PLOTS, KIND, kindAt } from '../town/plan.js';

const LOOKS = {
  leadfinder: {
    roof: [0x6e3524, 0x8e4a32, 0xa35a3c, 0xb86a48], paint: [0x24483a, 0x3d7560], holo: [0xe8fff4, 0x5dffb0, 0x2fae7a],
    glyph: ['..###..', '.#.#.#.', '#..#..#', '#######', '#..#..#', '.#.#.#.', '..###..'], props: ['magnifier'], // a crosshair
  },
  kinoir: {
    roof: [0x2e3746, 0x3e4a5c, 0x4b586c, 0x5a687c], paint: [0x6e1d22, 0x962f33], holo: [0xfff3d0, 0xffb347, 0xd9772a],
    glyph: ['.#####.', '#.#.#.#', '##...##', '#..#..#', '##...##', '#.#.#.#', '.#####.'], props: ['popcorn'], // a film reel
  },
  gitlines: {
    roof: [0x262a31, 0x343a43, 0x404751, 0x4d555f], paint: [0x1e4d2b, 0x2f6e3e], holo: [0xeaffea, 0x3fdc6a, 0x1f9a45],
    glyph: ['......#', '.....#.', '.#..#..', '#.#.#..', '...#...', '.......', '#######'], props: [], // a line going up
  },
  randoms: {
    roof: [0x3f2452, 0x55306e, 0x653a82, 0x764594], paint: [0x7a5a16, 0xa8801f], holo: [0xffe6fb, 0xff5ad8, 0xb8309a],
    glyph: ['#######', '#.....#', '#.#.#.#', '#..#..#', '#.#.#.#', '#.....#', '#######'], props: ['popcorn'], // a die showing five
  },
  pitcrew: {
    roof: [0x1f4a50, 0x2a5f66, 0x336f78, 0x3f818b], paint: [0x7a3514, 0xa4491c], holo: [0xfff0dc, 0xff9a3c, 0xc4661a],
    glyph: ['#.#....', '###....', '.###...', '..###..', '...###.', '....###', '.....##'], props: [], // a spanner
  },
  ets: {
    roof: [0x1c2440, 0x263055, 0x2f3b66, 0x3a4878], paint: [0x6b5520, 0x9a7c34], holo: [0xe8f6ff, 0x7cc8ff, 0x3a82c4],
    glyph: ['..###..', '.#..##.', '#...###', '#...###', '#...###', '.#..##.', '..###..'], props: [], // day into night
  },
};
// The clip the 2D site shows for an item (its media paths are relative to /reel/).
const video = (item) => (item.media ? `../reel/${item.media.mp4}` : `../reel/media/${item.id}.mp4`);

// Where each workshop stands (island-local units) and how it turns: the back row, then the front row.
const SLOTS = [[-12.8, -5.8, 0.1], [0, -6.4, 0], [12.8, -5.8, -0.1], [-12.5, 5.1, 0.12], [0, 6.2, 0], [12.5, 5.1, -0.12]];
// Street lamps where the lanes meet and end, festoons slung over the lanes between pairs of them, trees round the edge.
const LAMPS = [[-6.2, 12.4], [6.2, 12.4], [-19.4, 10.4], [19.2, 9.8], [-7.8, 0.5], [7.8, 0.5], [-19.6, -2.4], [19.6, -2.4]];
const SLUNG = [[2, 6], [3, 7]]; // down each end of the quarter, clear of the screens
const ORBS = [[-21.6, 4.6, 'amber', 0xffae3f], [21.4, 3.8, 'cyan', 0x3fd8ff]];
const TREES = [[-19.5, -10.6, 1], [-6.6, -12.8, 2], [6.8, -12.9, 3], [19.6, -10.2, 1], [-22.6, 3.6, 2], [22.4, 2.8, 3], [-24.2, -3.8, 3]];
// The quay along the canal (plot voxels): the crane, the punt's middle, the water stair, the bollards.
const QUAYSIDE = { crane: 45, punt: 34, stair: 2, bollards: [-78, -50, -22, 12, 58] };

export default {
  id: 'shipped',
  title: 'Workshop Quarter',
  island: {
    A: 168, B: 116, seed: 5,
    // a lane before each row, two cross lanes between the front row's shops, the bridge onto the front lane
    paths: ({ dock }) => [
      [[-112, 73], [0, 76], [112, 70], ...(dock ? [dock] : [])],
      [[-118, -12], [0, -16], [118, -12]],
      [[-44, -14], [-44, 74]],
      [[44, -14], [44, 74]],
    ],
    flags: [[-20, 58, 20, 66], [-20, -32, 20, -24], [-88, 80, 72, 97]], // two yards, and the quay's flagstones down to the canal
  },
  build(env, chapter) {
    const { V, THREE } = env;
    const stops = {}, targets = [], colliders = [], shops = [];
    const info = INFO;
    chapter.items.forEach((item, i) => {
      if (!SLOTS[i]) return;
      const [x0, z0, ry] = SLOTS[i];
      const look = LOOKS[item.id] || LOOKS.kinoir;
      // No video handed to the model: the world lends its screen a lazily loaded clip instead.
      const def = workshop({ key: item.id, ...look });
      const shop = env.place(`shop:${item.id}`, def, [x0, z0], ry);
      const c = Math.cos(ry), s = Math.sin(ry);
      const at = ([u, w]) => [x0 + u * V * c + w * V * s, z0 - u * V * s + w * V * c]; // model voxels to island units
      const at3 = (u, y, w) => { const [x, z] = at([u, w]); return [x, y * V, z]; };
      const screen = shop.ctx.mem.screen;
      if (screen) screen.material = new THREE.MeshBasicMaterial({ map: env.videoTexture(video(item), screen), toneMapped: false });
      // glow: the lantern's crystal, the dish, the banner, the screen; lights that come on with the shop
      const P = shop.parts;
      if (P.crystal) env.halo(P.crystal, [0, 0, 0], 11, 0xb89cff, 1);
      if (P.dish) env.halo(P.dish, [0, 10, 2.6], 9, 0x7fe8ff, 0.8);
      if (P.banner) env.halo(P.banner, [0, -5, 0.6], 20, look.holo[1], 0.55);
      const glowScreen = P.body && screen ? env.halo(P.body, [6, 12, 13], 34, 0x9fcfff, 0.45) : null;
      const lit = [env.light(at3(-20.5, 13, 15), 0xa98bff, 4, 6), env.light(at3(6, 12, 16), 0x9fd8ff, 6, 8), env.light(at3(0, 30, 17), look.holo[1], 4, 7)];
      shops.push({ shop, screen, glowScreen, lit });
      for (const [a, b, cc, d] of info.blocks) {
        const pts = [at([a, b]), at([cc, b]), at([a, d]), at([cc, d])];
        colliders.push([Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))]);
      }
      const door = at(info.door), standoff = at(info.standoff), middle = at([0, 0]);
      const front = at([info.focus[0], info.focus[2]]);
      const back = z0 < 0;
      stops[item.id] = {
        spot: () => (shop.ctx.revealed() ? door : standoff),
        face: 'camera',
        view: { target: [front[0] + 0.6 * c, info.focus[1] * V * 0.8, front[1] + 1.2], yaw: 0.38 + ry, pitch: back ? 0.66 : 0.7, fit: 8.6 }, // the front row's over the houses across the canal
        on(yuuv) {
          if (!shop.ctx.revealed()) {
            // first visit: stand clear, point, the crate drops open, then up to the door to cheer
            env.face(middle);
            yuuv.play('point');
            env.after(0.45, () => shop.ctx.reveal());
            env.after(2.7, () => env.walk(door, () => { env.face('camera'); yuuv.play('cheer'); }));
          } else {
            env.face([door[0] - Math.sin(ry), door[1] - Math.cos(ry)]);
            yuuv.play('point');
            env.after(1.6, () => { env.face('camera'); yuuv.play('wave'); });
          }
        },
      };
      targets.push({ object: shop.group, stop: item.id, label: item.title });
    });
    // the street: lamps, festoons over the lanes, trees round the edge, a banner where the bridge lands
    for (const [x, z] of LAMPS) {
      const l = env.place('lamp', lampDef, [x, z]);
      env.halo(l.parts.orb, [0, 0, 0], 16, 0x7fe8ff, 1);
      env.light([x, LAMP_ORB * V, z], 0x7fe8ff, 6, 9);
      colliders.push([x - 0.5, z - 0.5, x + 0.5, z + 0.5]);
    }
    const top = ([x, z]) => [x / V - 0.5, 31.5, z / V - 0.5];
    if (env.fx?.cable) SLUNG.forEach(([a, b], i) => env.place(`shipped:cable${i}`, env.fx.cable(top(LAMPS[a]), top(LAMPS[b]), 11, 11), [0, 0]));
    else env.place('shipped:festoons', { gait: 'still', build: () => ({ parts: Object.fromEntries(SLUNG.map(([a, b], i) => [`f${i}`, festoon(top(LAMPS[a]), top(LAMPS[b]), { sag: 11, name: `f${i}` })])) }) }, [0, 0]);
    // data orbs where the lanes end, humming over their emitters
    if (env.fx?.dataOrb) ORBS.forEach(([x, z, variant, hex]) => {
      const orb = env.place(`orb:${variant}`, env.fx.dataOrb(variant), [x, z]);
      env.halo(orb.parts.core, [0, 0, 0], 20, hex, 0.9);
      env.light([x, 2.3, z], hex, 4, 6);
      colliders.push([x - 0.6, z - 0.6, x + 0.6, z + 0.6]);
    });
    for (const [x, z, seed] of TREES) {
      env.place(`tree:${seed}`, tree(seed), [x, z], seed * 1.3);
      colliders.push([x - 0.45, z - 0.45, x + 0.45, z + 0.45]);
    }
    // the quay: along the stretch where the plot meets the canal (its first column of water at each x, found in the plan)
    const o = PLOTS.shipped.o, kind = (x, z) => kindAt((o[0] + x + 0.5) * V, (o[1] + z + 0.5) * V);
    const edge = (x) => { for (let z = 70; z < 130; z += 1) if (kind(x, z) === KIND.RIVER) return kind(x, z - 1) === KIND.PLOT ? z : null; return null; };
    const along = []; for (let x = -168; x <= 168; x += 1) if (edge(x) !== null) along.push(x);
    if (along.length > 60) {
      const x0 = along[0], x1 = along[along.length - 1], Q = QUAYSIDE;
      const crates = chapter.items.slice(0, 3).map((it) => ({ glyph: (LOOKS[it.id] || LOOKS.kinoir).glyph, hex: (LOOKS[it.id] || LOOKS.kinoir).holo[1] }));
      const qy = env.place('shop:quay', quay({ edge, x0, x1, crane: Q.crane, punt: Q.punt, stair: Q.stair, bollards: Q.bollards, glyphs: crates }), [0, 0]);
      qy.parts.punt.traverse((m) => { if (m.isMesh) m.userData.caster = false; });
      const e = edge(Q.punt), pz = e + 6;
      env.light([(Q.punt + 15.5) * V, (QUAY.water + 9) * V, (pz - 3.5) * V], 0xffc764, 3, 5);
      const zmin = Math.min(...along.map(edge));
      colliders.push([x0 * V, (zmin - 3) * V, x1 * V, (zmin + 1) * V]); // the coping, and the water beyond it
      const zc = edge(Q.crane) - 5;
      colliders.push([(Q.crane - 3) * V, (zc - 3) * V, (Q.crane + 3) * V, (zc + 3) * V]);
    }
    if (env.dock) {
      const [dx, dz] = env.dock, n = Math.hypot(dx, dz), [px, pz] = [dx - (dz / n) * 1.9 - (dx / n) * 0.6, dz + (dx / n) * 1.9 - (dz / n) * 0.6];
      const pole = env.place('pole', poleDef, [px, pz], Math.atan2(dx, dz) + Math.PI / 2);
      env.halo(pole.parts.flag3, [0, -6, 0], 18, 0x3fe6ff, 0.4);
      colliders.push([px - 0.5, pz - 0.5, px + 0.5, pz + 0.5]);
      targets.push({ object: pole.group, stop: 'main', label: 'Workshop Quarter' });
    }
    stops.main = {
      spot: [1.2, 10.4], face: 'camera',
      view: { target: [0, 1.8, 0.8], yaw: 0.34, pitch: 0.8, fit: 19.5 },
      on: (yuuv) => yuuv.play('wave'),
    };
    return {
      stops, targets, colliders,
      update() {
        for (const { screen, glowScreen, lit } of shops) {
          const open = screen ? (screen.visible ? 1 : 0) : 1; // the shop's own lights come on with its screen
          if (glowScreen) glowScreen.visible = open > 0;
          for (const l of lit) l.on = open;
        }
      },
    };
  },
};
