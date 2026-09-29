// A voxel character or machine as parts on joints, animated on its own clock.
//
// A definition is { build, gait?, voxel?, idle?(ctx, dt), act?(ctx), onHit?(ctx) }.
// `build()` returns { parts: { name: { grid, at: [x, y, z], pivot, parent? } } } in
// voxels, standing at the origin and facing +z. `pivot` is where the part turns,
// inside its own grid: "centre", "bottom", "top" or [x, y, z]. A part with a
// `parent` hangs from it (`at` is still in model voxels). Gaits move parts by
// name: body, head, legL/legR, armL/armR, wingL/wingR, tail.
//
// Timing goes through the rig's clock (`ctx.after`), never setTimeout: a paused
// or stepped page then stays in step, and a screenshot catches the right frame.

import { meshBox, toGeometry } from "./voxel-mesher.js";

export const pivotOf = (p) => ({ centre: [p.grid.sx / 2, p.grid.sy / 2, p.grid.sz / 2], bottom: [p.grid.sx / 2, 0, p.grid.sz / 2], top: [p.grid.sx / 2, p.grid.sy, p.grid.sz / 2] })[p.pivot || "centre"] || p.pivot;
const swing = (part, axis, a) => { if (part) part.rotation[axis] += a; };

export const GAITS = {
  walk: { rate: 8, move({ parts, pose }, ph, k) {
    const s = Math.sin(ph) * k;
    swing(parts.legL, "x", s * 0.7); swing(parts.legR, "x", -s * 0.7);
    swing(parts.armL, "x", -s * 0.6); swing(parts.armR, "x", s * 0.6);
    pose.position.y += Math.abs(Math.cos(ph)) * 0.06 * k;
    pose.rotation.z += s * 0.05;
  } },
  stomp: { rate: 5, move({ parts, pose }, ph, k) {
    const s = Math.sin(ph) * k;
    swing(parts.legL, "x", s * 0.45); swing(parts.legR, "x", -s * 0.45);
    swing(parts.armL, "x", -s * 0.3); swing(parts.armR, "x", s * 0.3);
    pose.position.y += Math.abs(Math.cos(ph)) * 0.1 * k;
    pose.rotation.z += s * 0.08;
  } },
  waddle: { rate: 9, move({ parts, pose }, ph, k) {
    const s = Math.sin(ph) * k;
    swing(parts.legL, "x", s * 0.5); swing(parts.legR, "x", -s * 0.5);
    pose.rotation.z += s * 0.16;
    pose.position.y += Math.abs(Math.cos(ph)) * 0.05 * k;
    swing(parts.head, "x", Math.sin(ph * 2) * 0.12 * k);
  } },
  hop: { rate: 4, move({ parts, pose }, ph, k) {
    const up = Math.max(0, Math.sin(ph));
    pose.position.y += up * 0.45 * k;
    pose.rotation.x -= up * 0.25 * k;
    swing(parts.legL, "x", -up * 0.9 * k); swing(parts.legR, "x", -up * 0.9 * k);
  } },
  fly: { rate: 6, move({ parts, pose }, ph, k, t) {
    const flap = Math.sin(ph);
    swing(parts.wingL, "z", flap * 0.8); swing(parts.wingR, "z", -flap * 0.8);
    pose.position.y += 0.15 + Math.sin(ph) * 0.12 + Math.sin(t * 1.1) * 0.08;
    swing(parts.tail, "x", Math.sin(ph - 1) * 0.15);
  } },
  still: { rate: 0, move() {} },
};

export function createRigKit(THREE) {
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  const owned = [cube, glowMaterial];
  const cache = new WeakMap();
  const built = new Map();
  // A grid's solid and glowing faces, meshed once per grid and shared by every rig; two grids with the
  // same size and voxels (a part two models both build) share one mesh too.
  const byContent = new Map();
  const same = (a, b) => a.sx === b.sx && a.sy === b.sy && a.sz === b.sz && a.data.length === b.data.length && a.data.every((v, i) => v === b.data[i]);
  function meshesOf(grid) {
    if (!cache.has(grid)) {
      let h = 2166136261 ^ grid.sx ^ (grid.sy << 10) ^ (grid.sz << 20);
      for (let i = 0; i < grid.data.length; i += 1) h = Math.imul(h ^ grid.data[i], 16777619);
      const twins = byContent.get(h) || [];
      let hit = twins.find((e) => same(e.grid, grid));
      if (!hit) {
        const { opaque, glow } = meshBox(grid);
        hit = { grid, pair: [toGeometry(THREE, opaque, grid, { centre: false }), toGeometry(THREE, glow, grid, { centre: false })] };
        for (const g of hit.pair) if (g) owned.push(g);
        byContent.set(h, [...twins, hit]);
      }
      cache.set(grid, hit.pair);
    }
    return cache.get(grid);
  }

  function rig(key, def) {
    if (!built.has(key)) built.set(key, def.build());
    const d = built.get(key);
    const voxel = def.voxel || 0.15;
    // Its own body material, so a hit can light it up.
    const solid = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x000000 });
    owned.push(solid);
    const voxels = (grid, pivot) => {
      const out = new THREE.Group();
      const at = pivotOf({ grid, pivot });
      const [s, g] = meshesOf(grid);
      for (const [geometry, material] of [[s, solid], [g, glowMaterial]]) {
        if (!geometry) continue;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(-at[0], -at[1], -at[2]);
        mesh.castShadow = material === solid;
        out.add(mesh);
      }
      return out;
    };
    const group = new THREE.Group();
    const pose = new THREE.Group(); // the whole body's lean, bob and recoil
    const model = new THREE.Group(); // in voxels
    model.scale.setScalar(voxel);
    pose.add(model);
    group.add(pose);
    const parts = {};
    for (const [name, p] of Object.entries(d.parts)) { parts[name] = new THREE.Group(); parts[name].add(voxels(p.grid, p.pivot)); }
    for (const [name, p] of Object.entries(d.parts)) {
      const at = p.parent ? p.at.map((v, i) => v - pivotOf(d.parts[p.parent])[i]) : p.at;
      parts[name].position.set(...at);
      (p.parent ? parts[p.parent] : model).add(parts[name]);
      parts[name].userData.home = parts[name].position.clone();
    }

    // Sparks, dust, notes, embers: little cubes in a ring buffer. An empty pool skips its loop.
    const CAP = 200;
    const fx = new THREE.Group();
    group.add(fx);
    const pool = new THREE.InstancedMesh(cube, new THREE.MeshBasicMaterial({ color: 0xffffff }), CAP);
    owned.push(pool.material);
    pool.frustumCulled = false;
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let k = 0; k < CAP; k += 1) { pool.setMatrixAt(k, hidden); pool.setColorAt(k, new THREE.Color(0)); }
    fx.add(pool);
    const bits = Array.from({ length: CAP }, () => ({ life: 0, max: 0 }));
    let next = 0;
    let live = 0;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
    const colA = new THREE.Color(), colB = new THREE.Color();

    const state = { t: 0, phase: 0, moving: true, hurt: 0, acting: 0, later: [] };
    const ctx = {
      THREE, parts, pose, model, group, fx, state, voxel, mem: {},
      home: (name) => parts[name].userData.home,
      // A point on a part, in the rig's own space: where a spark leaves a hand.
      where: (object, out = new THREE.Vector3()) => group.worldToLocal(object.getWorldPosition(out)),
      after: (seconds, run) => state.later.push({ at: state.t + seconds, run }),
      bit(x, y, z, vx, vy, vz, life, size, from, to, { grow = 0, fall = 0, drag = 0 } = {}) {
        if (!bits[next].max) live += 1;
        Object.assign(bits[next], { x, y, z, vx, vy, vz, life, max: life, size, from, to, grow, fall, drag, spin: (next * 2.39) % 6.28 });
        next = (next + 1) % CAP;
      },
      burst(p, count, speed, [from, to], size = 0.12, life = 0.6) {
        for (let k = 0; k < count; k += 1) {
          const a = (k / count) * Math.PI * 2 + k * 0.7;
          const u = ((k * 0.618) % 1) * 2 - 1;
          const s = Math.sqrt(1 - u * u) * speed;
          ctx.bit(p.x, p.y, p.z, Math.cos(a) * s, Math.abs(u) * speed + 0.5, Math.sin(a) * s, life * (0.7 + 0.6 * ((k * 0.37) % 1)), size, from, to, { fall: 4, drag: 1.5 });
        }
      },
      ring(p, radius, [from, to], life = 0.6, count = 28) {
        for (let k = 0; k < count; k += 1) {
          const a = (k / count) * Math.PI * 2;
          ctx.bit(p.x, p.y + 0.1, p.z, Math.cos(a) * (radius / life), 0, Math.sin(a) * (radius / life), life, 0.14, from, to);
        }
      },
      smoke(p, count = 1, [from, to] = [0x8a847c, 0x4a4640], size = 0.12) {
        for (let k = 0; k < count; k += 1) ctx.bit(p.x, p.y, p.z, 0, 0.5, 0, 1.2, size, from, to, { grow: 2 });
      },
    };
    def.setup?.(ctx);

    function update(step, moving = true) {
      // Clamp: the first animation frame's timestamp can come before the page's
      // clock, and a negative step runs every fade backwards.
      const dt = Math.max(0, Math.min(0.1, step));
      state.t += dt;
      state.moving = moving;
      for (const due of state.later.filter((l) => l.at <= state.t)) { state.later.splice(state.later.indexOf(due), 1); due.run(); }
      state.hurt = Math.max(0, state.hurt - dt * 3);
      state.acting = Math.max(0, state.acting - dt);
      const gait = GAITS[def.gait || "walk"];
      if (moving) state.phase += dt * gait.rate;
      for (const part of Object.values(parts)) {
        part.position.copy(part.userData.home); part.rotation.set(0, 0, 0); part.scale.setScalar(1);
        if (part.userData.zeroHidden) { part.visible = true; part.userData.zeroHidden = false; } // only what this loop hid
      }
      pose.position.set(0, 0, 0);
      pose.rotation.set(0, 0, 0);
      pose.scale.setScalar(1);
      gait.move(ctx, state.phase, moving ? 1 : 0.15, state.t);
      def.idle?.(ctx, dt);
      if (state.hurt > 0) { pose.rotation.x -= state.hurt * 0.35; pose.scale.set(1 + state.hurt * 0.12, 1 - state.hurt * 0.12, 1 + state.hurt * 0.12); }
      solid.emissive.setRGB(state.hurt * 0.55, state.hurt * 0.5, state.hurt * 0.45);
      // a part scaled to nothing still costs a draw call: hide it until it grows again
      for (const part of Object.values(parts)) if (part.visible && (part.scale.x === 0 || part.scale.y === 0 || part.scale.z === 0)) { part.visible = false; part.userData.zeroHidden = true; }
      fx.visible = live > 0; // an empty pool costs no draw call
      if (!live) return;
      let touched = false;
      for (let k = 0; k < CAP; k += 1) {
        const p = bits[k];
        if (p.life <= 0) { if (p.max) { pool.setMatrixAt(k, hidden); p.max = 0; live -= 1; touched = true; } continue; }
        touched = true;
        p.life -= dt;
        const age = 1 - Math.max(0, p.life) / p.max;
        if (p.drag) { const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy *= f; p.vz *= f; }
        p.vy -= p.fall * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const size = p.size * (p.grow ? 1 + age * p.grow : Math.max(0.15, 1 - age * 0.7));
        m4.compose(v3.set(p.x, p.y, p.z), q.setFromEuler(e3.set(p.spin * age, p.spin * 0.7 * age, 0)), s3.set(size, size, size));
        pool.setMatrixAt(k, m4);
        pool.setColorAt(k, colA.setHex(p.from).lerp(colB.setHex(p.to), age));
      }
      if (touched) { pool.instanceMatrix.needsUpdate = true; if (pool.instanceColor) pool.instanceColor.needsUpdate = true; }
      fx.visible = live > 0;
    }

    return {
      group, parts, state, ctx, solid, update,
      hit() { state.hurt = 1; def.onHit?.(ctx); },
      act() { state.acting = 2; def.act?.(ctx); },
    };
  }

  // A crowd of one kind at a dozen draw calls, whatever its size: ONE rig is
  // posed for each member and its parts are stamped into an instanced mesh
  // each. Crowd members share a clock only through what you pass to `pose`.
  function crowd(key, def, cap) {
    const puppet = rig(key, def);
    const parts = [];
    puppet.group.traverse((node) => {
      if (!node.isMesh || node.isInstancedMesh) return;
      const mesh = new THREE.InstancedMesh(node.geometry, node.material, cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = node.castShadow;
      mesh.count = 0;
      parts.push({ node, mesh });
    });
    const out = new THREE.Matrix4();
    return {
      meshes: parts.map((p) => p.mesh),
      // Pose member n: its world matrix, its own time and stride, moving or not.
      pose(n, matrix, t, phase, moving = true) {
        puppet.state.t = t;
        puppet.state.phase = phase;
        puppet.state.hurt = 0;
        puppet.update(0, moving);
        puppet.group.updateMatrixWorld(true);
        for (const p of parts) p.mesh.setMatrixAt(n, out.multiplyMatrices(matrix, p.node.matrixWorld));
      },
      count(n) { for (const p of parts) { p.mesh.count = n; p.mesh.instanceMatrix.needsUpdate = true; } },
    };
  }

  return { rig, crowd, dispose() { for (const o of owned) o.dispose(); } };
}
