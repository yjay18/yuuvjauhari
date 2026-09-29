// A placeholder district: its island with a holographic banner and a plasma lamp,
// standing in until its designer builds the real thing (see DISTRICTS.md). The side
// panel already lists the chapter's items; clicking one brings Yuuv here.
import { lampDef, poleDef, LAMP_ORB } from '../models/island.js';

export function stub(id, title, island, extra = {}) {
  return {
    id, title, island, ...extra,
    build(env) {
      const { V } = env;
      const pole = env.place('pole', poleDef, [-0.4, -1.2]);
      const lamp = env.place('lamp', lampDef, [2.3, 0.4]);
      env.halo(lamp.parts.orb, [0, 0, 0], 16, 0x7fe8ff, 1);
      env.halo(pole.parts.flag3, [0, -6, 0], 18, 0x3fe6ff, 0.4);
      env.light([2.3, LAMP_ORB * V, 0.4], 0x7fe8ff, 6, 9);
      const main = { spot: [0.5, 1.7], face: 'camera', view: { target: [0.5, 1.5, 0.2], yaw: 0.42, pitch: 0.7, fit: 7.2 }, on: (yuuv) => yuuv.play('wave') };
      return {
        stops: { main },
        targets: [{ object: pole.group, stop: 'main', label: title }, { object: lamp.group, stop: 'main', label: title }],
        colliders: [[-0.9, -1.7, 0.1, -0.7], [1.8, -0.1, 2.8, 0.9]],
      };
    },
  };
}
