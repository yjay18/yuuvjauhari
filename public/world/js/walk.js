// Walking in the town: the streets are a graph (their polylines' points are its nodes), and each district's
// plot is a walkable area joined to it at its entries. Inside a plot Yuuv takes the shortest way round its
// colliders (a small visibility graph over their corners); between places he walks to an entry, along the
// streets by the shortest way, and in at the other end. All in world units (x, z).
//
//   const places = createPlaces({ heightAt });      // heightAt(x, z): the ground under a walkable point
//   places.addIsle(key, inside(x, z)) -> index      // a plot
//   places.setBoxes(index, [[x0, z0, x1, z1], ...]) // its colliders
//   places.addStreet(key, [[x, z], ...], half)      // a street's centreline and half its width
//   places.addEntry(index, [x, z])                  // where a plot meets a street (a street's point)
//   places.plan([x, z], [x, z]) -> waypoints (the start left out)
//   places.nearest([x, z]) -> the nearest walkable point
const PAD = 0.45; // Yuuv's half-width: boxes grow by this much

function hits([ax, az], [bx, bz], [x0, z0, x1, z1]) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dz, az - z0], [dz, z1 - az]]) {
    if (p === 0) { if (q <= 1e-6) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t1 - t0 > 1e-4;
}
const inside = ([x, z], [x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1;
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
function onSeg([px, pz], [ax, az], [bx, bz]) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
  return { t, p: [ax + dx * t, az + dz * t], d: Math.hypot(px - ax - dx * t, pz - az - dz * t) };
}

export function createPlaces({ heightAt = () => 0 } = {}) {
  const isles = []; // { key, inside, boxes, entries: [node] }
  const nodes = []; // { p: [x, z], links: [{ to, w }] }
  const streets = []; // { key, half, segs: [[nodeA, nodeB]] }
  const nodeAt = (p) => {
    let k = nodes.findIndex((n) => dist(n.p, p) < 0.05);
    if (k < 0) { k = nodes.length; nodes.push({ p: [p[0], p[1]], links: [] }); }
    return k;
  };
  const link = (a, b, w = dist(nodes[a].p, nodes[b].p)) => { if (a === b) return; nodes[a].links.push({ to: b, w }); nodes[b].links.push({ to: a, w }); };

  function addIsle(key, insideFn) { isles.push({ key, inside: insideFn, boxes: [], entries: [] }); return isles.length - 1; }
  function setBoxes(i, boxes) { isles[i].boxes = boxes.map(([x0, z0, x1, z1]) => [Math.min(x0, x1) - PAD, Math.min(z0, z1) - PAD, Math.max(x0, x1) + PAD, Math.max(z0, z1) + PAD]); }
  function addStreet(key, pts, half = 1.4) {
    const ids = pts.map(nodeAt), segs = [];
    for (let k = 1; k < ids.length; k += 1) { link(ids[k - 1], ids[k]); segs.push([ids[k - 1], ids[k]]); }
    streets.push({ key, half, segs });
    return streets.length - 1;
  }
  function addEntry(i, p) { const k = nodeAt(p); if (!isles[i].entries.includes(k)) isles[i].entries.push(k); return k; }

  // Where a point is: in a plot ({ isle }), on a street ({ street, seg, t }), or nowhere (null).
  function locate(p) {
    for (let i = 0; i < isles.length; i += 1) if (isles[i].inside(p[0], p[1])) return { isle: i };
    let best = null;
    streets.forEach((s, si) => s.segs.forEach(([a, b], g) => {
      const q = onSeg(p, nodes[a].p, nodes[b].p);
      if (q.d <= s.half && (!best || q.d < best.d)) best = { street: si, seg: g, t: q.t, d: q.d };
    }));
    return best;
  }
  const walkable = (p) => Boolean(locate(p));
  // The nearest walkable point: on a street's centreline, or drawn into a plot, whichever is nearer.
  function nearest(p) {
    if (walkable(p)) return [p[0], p[1]];
    let best = null;
    for (const s of streets) for (const [a, b] of s.segs) {
      const q = onSeg(p, nodes[a].p, nodes[b].p), k = q.d > 1e-6 ? Math.max(0, (q.d - s.half * 0.8) / q.d) : 0;
      const at = [p[0] + (q.p[0] - p[0]) * k, p[1] + (q.p[1] - p[1]) * k];
      if (!best || dist(p, at) < best.d) best = { at, d: dist(p, at) };
    }
    for (const isle of isles) { // march toward each of its entries until inside
      for (const e of isle.entries) {
        const ep = nodes[e].p;
        for (let s = 0; s <= 1; s += 0.02) {
          const at = [p[0] + (ep[0] - p[0]) * s, p[1] + (ep[1] - p[1]) * s];
          if (isle.inside(...at)) { if (!best || dist(p, at) < best.d) best = { at, d: dist(p, at) }; break; }
        }
      }
    }
    return best ? best.at : [p[0], p[1]];
  }

  // Nudge a goal out of any box it landed in, staying in its plot.
  function settle(i, [x, z]) {
    const { inside: on, boxes } = isles[i];
    for (const b of boxes) {
      if (!inside([x, z], b)) continue;
      const opts = [[b[0] - 0.05, z], [b[2] + 0.05, z], [x, b[1] - 0.05], [x, b[3] + 0.05]].filter((q) => on(...q) && !boxes.some((o) => inside(q, o)));
      [x, z] = opts.sort((q, r) => dist(q, [x, z]) - dist(r, [x, z]))[0] || [x, z];
    }
    return [x, z];
  }
  // Shortest way round the boxes in one plot: Dijkstra over their corners.
  function route(i, start, goal) {
    const { inside: on, boxes } = isles[i];
    const pts = [start, goal];
    for (const [x0, z0, x1, z1] of boxes) for (const q of [[x0 - 0.06, z0 - 0.06], [x1 + 0.06, z0 - 0.06], [x0 - 0.06, z1 + 0.06], [x1 + 0.06, z1 + 0.06]]) {
      if (on(...q) && !boxes.some((b) => inside(q, b))) pts.push(q);
    }
    const clear = (a, b) => !boxes.some((bx) => hits(a, b, bx));
    const d = pts.map(() => Infinity), prev = pts.map(() => -1), done = pts.map(() => false);
    d[0] = 0;
    for (;;) {
      let u = -1;
      for (let k = 0; k < pts.length; k += 1) if (!done[k] && d[k] < Infinity && (u < 0 || d[k] < d[u])) u = k;
      if (u < 0 || u === 1) break;
      done[u] = true;
      for (let j = 0; j < pts.length; j += 1) {
        if (done[j] || !clear(pts[u], pts[j])) continue;
        const nd = d[u] + dist(pts[u], pts[j]);
        if (nd < d[j]) { d[j] = nd; prev[j] = u; }
      }
    }
    if (prev[1] < 0) return [goal];
    const out = [];
    for (let k = 1; k > 0; k = prev[k]) out.unshift(pts[k]);
    return out;
  }
  const length = (from, pts) => pts.reduce((s, p, i) => s + dist(i ? pts[i - 1] : from, p), 0);

  // Waypoints from `from` to `to` (the start left out). A goal nowhere walkable is drawn to the nearest place.
  function plan(from, to) {
    const A = locate(from) || locate(nearest(from)), goal0 = locate(to) ? to : nearest(to), B = locate(goal0);
    if (!A || !B) return [];
    const goal = B.isle !== undefined ? settle(B.isle, goal0) : goal0;
    if (A.isle !== undefined && A.isle === B.isle) return route(A.isle, from, goal);
    if (A.street !== undefined && A.street === B.street && A.seg === B.seg) return [goal];
    // the graph, with the start (S) and goal (G) joined in: to a plot's entries, or a street's two ends
    const S = nodes.length, G = S + 1, extra = new Map([[S, []], [G, []]]), inPlot = new Map();
    const join = (at, T, p) => {
      if (at.isle !== undefined) for (const e of isles[at.isle].entries) {
        const r = T === S ? route(at.isle, p, nodes[e].p) : route(at.isle, nodes[e].p, p), w = length(T === S ? p : nodes[e].p, r);
        extra.get(T).push({ to: e, w }); inPlot.set(`${T}:${e}`, r);
      } else { const [a, b] = streets[at.street].segs[at.seg]; for (const e of [a, b]) extra.get(T).push({ to: e, w: dist(p, nodes[e].p) }); }
    };
    join(A, S, from); join(B, G, goal);
    const linksOf = (u) => {
      const own = u < S ? nodes[u].links : extra.get(u);
      const toG = extra.get(G).filter((l) => l.to === u).map((l) => ({ to: G, w: l.w }));
      // crossing a plot between two of its entries (the hub is crossed this way)
      const through = [];
      if (u < S) for (const [ii, isle] of isles.entries()) if (isle.entries.includes(u)) for (const e of isle.entries) if (e !== u) through.push({ to: e, w: crossing(ii, u, e).w });
      return [...own, ...toG, ...through];
    };
    const n = nodes.length + 2, d = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
    d[S] = 0;
    for (;;) {
      let u = -1;
      for (let k = 0; k < n; k += 1) if (!done[k] && d[k] < Infinity && (u < 0 || d[k] < d[u])) u = k;
      if (u < 0 || u === G) break;
      done[u] = 1;
      for (const { to, w } of linksOf(u)) if (d[u] + w < d[to]) { d[to] = d[u] + w; prev[to] = u; }
    }
    if (prev[G] < 0) return [goal];
    const chain = [];
    for (let k = G; k >= 0; k = prev[k]) chain.unshift(k);
    const out = [];
    for (let c = 1; c < chain.length; c += 1) {
      const a = chain[c - 1], b = chain[c];
      if (a === S && inPlot.has(`${S}:${b}`)) out.push(...inPlot.get(`${S}:${b}`));
      else if (b === G) out.push(...(inPlot.get(`${G}:${a}`) || [goal]));
      else if (a < S && b < S && !nodes[a].links.some((l) => l.to === b)) out.push(...crossing(isles.findIndex((isle) => isle.entries.includes(a) && isle.entries.includes(b)), a, b).r);
      else out.push(b === G ? goal : nodes[b].p);
    }
    return out.filter((p, i) => dist(p, i ? out[i - 1] : from) > 1e-3);
  }
  const crossed = new Map();
  function crossing(i, a, b) {
    const key = `${i}:${a}:${b}`;
    if (!crossed.has(key)) { const r = route(i, nodes[a].p, nodes[b].p); crossed.set(key, { r, w: length(nodes[a].p, r) }); }
    return crossed.get(key);
  }

  return { isles, nodes, streets, addIsle, setBoxes, addStreet, addEntry, locate, nearest, plan, length, walkable, heightAt: (x, z) => heightAt(x, z, locate([x, z])) };
}

// A self-check: node js/walk.js
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const assert = (c, m) => { if (!c) throw new Error(m); };
  const P = createPlaces({ heightAt: (x, z, at) => (at && at.isle === 1 ? 2 : 0) });
  const disc = (cx, cz, r) => (x, z) => Math.hypot(x - cx, z - cz) < r;
  const hub = P.addIsle('hub', disc(0, 0, 6)), east = P.addIsle('east', disc(30, 0, 6)), north = P.addIsle('north', disc(0, -30, 6));
  P.addStreet('east-street', [[5.5, 0], [15, 2], [24.5, 0]], 1.5);
  P.addStreet('north-street', [[0, -5.5], [0, -24.5]], 1.5);
  P.addStreet('back-lane', [[15, 2], [15, -20], [0, -24.5]], 1.2);
  P.addEntry(hub, [5.5, 0]); P.addEntry(hub, [0, -5.5]); P.addEntry(east, [24.5, 0]); P.addEntry(north, [0, -24.5]);
  P.setBoxes(east, [[28, -1, 32, 1]]);
  const path = P.plan([-3, 0], [34, 0]);
  assert(path.some((p) => p[0] === 5.5) && path.some((p) => p[0] === 24.5), 'out of the hub and along the east street');
  assert(!path.some((p) => p[0] > 27.5 && p[0] < 32.5 && Math.abs(p[1]) < 1.4), 'round the box in the east plot');
  const across = P.plan([30, 4], [0, -28]);
  assert(across[0][0] === 24.5 && across.some((p) => p[0] === 15 && p[1] === 2), 'east plot to its entry and along the street');
  assert(across.some((p) => p[1] === -20) || across.some((p) => p[0] === 0 && p[1] === -5.5), 'then by the back lane or through the hub');
  assert(P.locate([15, -10]).street === 2, 'on the back lane');
  const mid = P.plan([15, -10], [30, 0]);
  assert(mid[0][0] === 15 && mid[0][1] === 2, 'along the lane to its end, not across the grass');
  const far = P.nearest([40, 40]);
  assert(P.walkable(far), 'the nearest walkable point is walkable');
  assert(P.plan([0, 0], [40, 40]).length > 0, 'a goal off the map is drawn to the nearest place');
  assert(P.heightAt(30, 0) === 2 && P.heightAt(15, 2) === 0, 'height by place');
  const hubCross = P.plan([10, 1], [0, -10]);
  assert(hubCross.some((p) => p[0] === 5.5 && p[1] === 0) && hubCross.some((p) => p[0] === 0 && p[1] === -5.5), 'across the hub between two of its streets');
  console.log('walk.js ok', JSON.stringify(path));
}
