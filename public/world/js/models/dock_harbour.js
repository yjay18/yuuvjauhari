// The Sky Docks' harbour pieces (colours dock_):
//   hut(rows)   the dockmaster's hut: coursed stone with circuit light in the beds, a slate gable roof with a round
//               lit window, a chimney, a door with a porthole, and on its front the LEDGER: a glowing board with a
//               row per ship (its colour, a line of entries, a status lamp; the school club's lamp is red). A cursor
//               steps down the rows (ctx.select(i) sends it to one), a beacon turns on the ridge, a windsock swings
//               on its pole, a harbour bell by the door swings (ctx.ring() rings it). A barrel, a crate, a mug and
//               the logbook at the foot, a spyglass on a tripod. rows = [{ chip: hex, lamp: 'ok' | 'stop' }]
//   crane()     a timber quay crane on a stone plinth: a winch, a jib that slews to and fro with a counterweight,
//               a crate swinging on its hook
//   yard(seed)  stacked crates, barrels, sacks and a coil of rope
//   quay()      quay furniture: a lantern post, a pair of bollards with rope, barrels, a coil, a hand cart
// Each is a rig definition standing at its own origin, facing +z.
import { C, colour, hash, noise } from '../kit/voxel-kit.js';
import { box, tone, smooth, clamp01 } from './space.js';

const col = (name, hex, glow = false) => C[name] ?? colour(name, hex, glow);
for (const [n, hex, glow] of [
  ['s1', 0xbab3a6], ['s2', 0xa29b8e], ['s3', 0x8b8579], ['s4', 0x747065], ['hmortar', 0x3d3935], ['q1', 0xd0c8b8], ['q2', 0xc0b7a4],
  ['slate1', 0x4a5468], ['slate2', 0x5a657a], ['slate3', 0x3c4556], ['hmoss', 0x5a7a3c], ['soot', 0x39353a],
  ['plaster1', 0xe6d9bc], ['plaster2', 0xd8c9a8], ['door1', 0x2e5f66], ['door2', 0x3d7880],
  ['hw1', 0x3a2517], ['hw2', 0x4f3421], ['hw3', 0x6b4a2e], ['hw4', 0x86603b],
  ['screen', 0x0c1824], ['htrace', 0x1fd2ea, true], ['hvia', 0xb6fbff, true], ['text', 0xcfefff, true], ['text2', 0x5fa8c8, true],
  ['ok', 0x6bff9a, true], ['stop', 0xff3a2a, true], ['cursor', 0xffe6a8, true], ['hlit', 0xffc764, true], ['hlit2', 0xffe6a8, true],
  ['beam1', 0xfff6d8, true], ['beam2', 0xffd27a, true], ['ember', 0xff7a2a, true],
  ['sock1', 0xe8702a], ['sock2', 0xefe4cc], ['cw1', 0xb28a57], ['cw2', 0xa07644], ['cw3', 0xc39a63], ['batten', 0x6f4c2c], ['stencil', 0x2b221c],
  ['sack1', 0xcdb88e], ['sack2', 0xb9a276], ['hrope1', 0xa88f6a], ['hrope2', 0x86704f], ['mug', 0xe8e0d0], ['tea', 0x7a4a2a],
  ['cweight', 0x5e5a62],
]) col(`dock_${n}`, hex, glow);
const K = (n) => C[`dock_${n}`];
const STONE = [K('s1'), K('s2'), K('s2'), K('s3'), K('s3'), K('s4')];
const CRATE = [K('cw1'), K('cw2'), K('cw3'), K('cw2')];

function wire(b, a, c, id, sag = 0) {
  const n = Math.max(2, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]) * 3));
  for (let i = 0; i <= n; i += 1) { const t = i / n; b.put(Math.floor(a[0] + (c[0] - a[0]) * t), Math.floor(a[1] + (c[1] - a[1]) * t - sag * 4 * t * (1 - t)), Math.floor(a[2] + (c[2] - a[2]) * t), typeof id === 'function' ? id(t, i) : id); }
}
// A crate: planks in courses, battens round the edges, iron corners, a stencil on its front (a 5 x 5 glyph, or arrows).
function crate(b, [x0, y0, z0], [w, h, d], seed, glyph) {
  for (let y = y0; y < y0 + h; y += 1) for (let z = z0; z < z0 + d; z += 1) for (let x = x0; x < x0 + w; x += 1) {
    const ex = x === x0 || x === x0 + w - 1, ey = y === y0 || y === y0 + h - 1, ez = z === z0 || z === z0 + d - 1;
    if (!(ex || ey || ez)) continue;
    const edges = (ex ? 1 : 0) + (ey ? 1 : 0) + (ez ? 1 : 0);
    let id = edges >= 2 ? (edges === 3 ? C.iron2 : K('batten')) : CRATE[Math.floor(hash(Math.floor((y - y0) / 2), seed, z0) * 4)];
    if (edges < 2 && (y - y0) % 2 === 1 && hash(x, y, z + seed) < 0.3) id = K('batten');
    const gu = x - x0 - Math.floor((w - 5) / 2), gv = y0 + h - 2 - y - Math.floor((h - 7) / 2);
    if (glyph && z === z0 + d - 1 && edges === 1 && gu >= 0 && gu < 5 && gv >= 0 && gv < 5 && glyph[gv][gu] === '#') id = K('stencil');
    b.put(x, y, z, id);
  }
}
function barrel(b, [cx, y0, cz], h = 6) {
  for (let y = y0; y < y0 + h; y += 1) {
    const k = (y - y0 + 0.5) / h, rr = 1.9 + 0.5 * Math.sin(Math.PI * k);
    for (let z = Math.floor(cz - 3); z <= cz + 3; z += 1) for (let x = Math.floor(cx - 3); x <= cx + 3; x += 1) {
      const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
      if (d > rr) continue;
      const hoop = y === y0 + 1 || y === y0 + h - 2;
      b.put(x, y, z, y === y0 + h - 1 && d < rr - 0.8 ? K('hw3') : hoop ? C.iron2 : Math.floor((Math.atan2(z + 0.5 - cz, x + 0.5 - cx) + 4) * 2.2) % 2 ? K('hw3') : K('hw4'));
    }
  }
}
function coil(b, [cx, y, cz], r = 2) {
  for (let z = Math.floor(cz - r - 1); z <= cz + r; z += 1) for (let x = Math.floor(cx - r - 1); x <= cx + r; x += 1) {
    const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
    if (d > r + 0.5) continue;
    b.put(x, y, z, Math.round(d * 2) % 2 ? K('hrope1') : K('hrope2'));
    if (d > r - 0.5) b.put(x, y + 1, z, hash(x, z) < 0.5 ? K('hrope1') : K('hrope2'));
  }
}

// ---------------------------------------------------------------------------------------------
export function hut(rows) {
  const chips = rows.map(({ chip }) => col(`dock_chip_${chip.toString(16)}`, chip, true));
  const ROWS = [18, 16, 14, 12, 10, 8]; // the ledger's rows, top to bottom
  let built;
  function body() {
    const b = box([-19, 0, -14], [18, 46, 13]);
    // plinth and step
    b.fill(-15, 0, -11, 14, 0, 10, (x, y, z) => ((x + 60) % 6 === 0 || (z + 60) % 5 === 0 ? K('hmortar') : tone([K('s3'), K('s4'), K('s3')], Math.floor(x / 6), 0, Math.floor(z / 5), 3)));
    b.fill(-13, 0, 11, -4, 0, 12, (x, y, z) => (z === 12 ? K('q2') : tone(STONE, x, y, z, 4)));
    // the stone storey: courses over mortar beds with circuit light in them, quoins at the corners
    const T = (c, a, f) => hash(c * 13 + f * 101, Math.floor((a + c * 7 + 200) / 6), 21) < (f === 1 ? 0.34 : 0.16);
    b.fill(-14, 1, -10, 13, 22, 9, (x, y, z) => {
      const front = z === 9, back = z === -10, left = x === -14, right = x === 13;
      if (!(front || back || left || right)) return K('hmortar');
      const f = front ? 1 : back ? 2 : left ? 3 : 4, along = front || back ? x : z;
      const row = y - 1, c = Math.floor(row / 3), bed = row % 3 === 2;
      const corner = front || back ? Math.min(x + 14, 13 - x) : Math.min(z + 10, 9 - z);
      const q = c % 2 ? 3 : 1;
      if (y === 22) return (x + z) % 4 ? K('hw1') : K('hw2'); // the wall plate
      if (bed) return corner > q && T(c, along, f) ? ((along + c * 7 + 200) % 6 === 5 ? K('hvia') : K('htrace')) : K('hmortar');
      if (corner < q) return c % 2 ? K('q1') : K('q2');
      if (corner === q) return K('hmortar');
      const seg = along + 60 + c * 3 + (c % 2) * 2;
      if (seg % 5 === 0) return K('hmortar');
      if (y <= 3 && noise(along + f * 40, y * 2, 3.5) > 0.6) return hash(x, y, z) < 0.5 ? K('hmoss') : C.leaf2;
      return STONE[Math.floor(hash(Math.floor(seg / 5), c, f) * STONE.length)];
    });
    // the door: an arch of voussoirs, a painted plank leaf with iron straps and a round lit porthole, a ring handle
    for (let y = 1; y <= 21; y += 1) for (let x = -13; x <= -4; x += 1) {
      const inArch = x >= -11 && x <= -6 && (y <= 16 || (x + 8.5) ** 2 + (y + 0.5 - 16.5) ** 2 <= 9);
      if (inArch) {
        b.cut(x, y, 9);
        const port = (x + 8.5) ** 2 + (y + 0.5 - 13) ** 2;
        b.put(x, y, 8, port < 1.6 ? K('hlit2') : port < 3.2 ? C.brass2 : (x + 11) % 2 ? K('door1') : K('door2'));
        continue;
      }
      const r = Math.hypot(x + 8.5, y + 0.5 - 16.5);
      if (y >= 16 && r <= 4.6) b.put(x, y, 9, Math.floor(Math.atan2(y + 0.5 - 16.5, x + 8.5) * 2.4) % 2 ? K('q1') : K('q2'));
    }
    for (const y of [4, 11]) for (let x = -11; x <= -7; x += 1) b.put(x, y, 8, x % 2 ? C.iron3 : C.iron2);
    b.put(-7, 8, 9, C.brass2);
    // the ledger: a brass frame proud of the wall round a dark glass; a rule and an anchor along its head; a row per ship
    for (let y = 5; y <= 21; y += 1) for (let x = -3; x <= 11; x += 1) {
      const frame = y === 5 || y === 21 || x === -3 || x === 11;
      b.cut(x, y, 9);
      if (frame) { b.put(x, y, 9, (x + y) % 4 === 0 ? C.brass1 : C.brass2); b.put(x, y, 10, y === 5 || y === 21 ? C.brass2 : 0); continue; }
      b.put(x, y, 8, K('screen'));
    }
    for (let x = -2; x <= 10; x += 1) b.put(x, 20, 9, x % 2 ? K('text2') : K('text'));
    rows.forEach(({ lamp }, k) => {
      const y = ROWS[k];
      b.put(-1, y, 9, chips[k]); b.put(0, y, 9, chips[k]);
      for (let x = 2; x <= 7; x += 1) if (hash(x, k, 5) > 0.22) b.put(x, y, 9, hash(x, k, 6) < 0.3 ? K('text2') : K('text'));
      b.put(9, y, 9, lamp === 'stop' ? K('stop') : K('ok'));
    });
    b.fill(-3, 4, 9, 11, 4, 11, (x, y, z) => (z === 11 ? K('hw2') : K('hw1'))); // a sill
    // a lantern on an arm beside the door
    b.fill(-15, 14, 9, -15, 14, 11, C.iron2); b.fill(-16, 11, 11, -14, 11, 11, C.iron2); b.fill(-16, 13, 11, -14, 13, 11, C.iron2); b.put(-15, 12, 11, K('hlit'));
    // windows in the side walls
    for (const [x, z0] of [[-14, -5], [-14, 2], [13, -5], [13, 2]]) for (let y = 9; y <= 15; y += 1) for (let z = z0; z <= z0 + 3; z += 1) {
      const edge = y === 9 || y === 15 || z === z0 || z === z0 + 3, bar = y === 12;
      b.put(x, y, z, edge ? K('hw2') : bar ? K('hw1') : (y + z) % 3 ? K('hlit') : K('hlit2'));
      if (y === 9) b.put(x + (x < 0 ? -1 : 1), y, z, K('hw3'));
    }
    // the roof: a gable along z, slates in courses with moss on the back, a ridge, bargeboards; plastered gables
    // with timber studs and a round lit window in the front one
    const roofY = (x) => 23 + Math.floor((16 - Math.abs(x + 0.5)) * 0.8);
    for (let x = -16; x <= 15; x += 1) for (let z = -12; z <= 11; z += 1) {
      const top = roofY(x), over = z <= -11 || z >= 10 || Math.abs(x + 0.5) > 14;
      for (let y = over ? top - 1 : 23; y <= top; y += 1) {
        let id;
        if (y < top) id = z === -11 || z === 10 || z <= -12 || z >= 11 ? K('hw2') : K('hw1');
        else if (z === -12 || z === 11) id = (x + y) % 3 ? K('hw2') : K('hw1'); // bargeboards
        else if (Math.abs(x + 0.5) < 1) id = (z % 3 === 0) ? C.iron2 : K('hw1'); // the ridge
        else {
          const course = Math.floor((top - 23) / 2), cc = Math.floor((z + 40 + (course % 2) * 2) / 3);
          id = (top - 23) % 2 === 0 ? K('slate3') : hash(course, cc, x < 0 ? 5 : 6) < 0.5 ? K('slate1') : K('slate2');
          if (z < -2 && noise(x, z, 5, 3) > 0.6) id = hash(x, z) < 0.6 ? K('hmoss') : C.leaf2;
        }
        b.put(x, y, z, id);
      }
    }
    for (const z of [9, -10]) for (let x = -13; x <= 12; x += 1) for (let y = 23; y < roofY(x); y += 1) {
      const rr = Math.hypot(x + 0.5, y + 0.5 - 29);
      if (z === 9 && rr < 2.2) { b.put(x, y, z, rr < 1.3 ? K('hlit2') : K('hlit')); continue; }
      if (z === 9 && rr < 3.2) { b.put(x, y, z, C.brass2); continue; }
      b.put(x, y, z, (x + 40) % 5 === 0 || y === 23 ? K('hw2') : tone([K('plaster1'), K('plaster1'), K('plaster2')], x, y, z, 7));
    }
    // the chimney: coursed, capped, a pot with an ember
    b.fill(-11, 26, -7, -8, 38, -4, (x, y, z) => ((y - 26) % 3 === 2 ? K('hmortar') : y > 35 && hash(x, y, z) < 0.4 ? K('soot') : STONE[Math.floor(hash(Math.floor((x + z + 40 + Math.floor((y - 26) / 3) * 2) / 3), Math.floor((y - 26) / 3), 9) * STONE.length)]));
    b.fill(-12, 39, -8, -7, 39, -3, (x, y, z) => (x === -12 || x === -7 || z === -8 || z === -3 ? tone([K('s3'), K('soot')], x, y, z, 2) : K('soot')));
    b.fill(-10, 40, -6, -9, 41, -5, (x, y) => (y === 41 ? C.iron2 : C.brass1)); b.put(-10, 40, -6, K('ember'));
    // the beacon's house on the ridge: iron posts and a cap round the turning light
    for (const [x, z] of [[-3, 4], [2, 4], [-3, 8], [2, 8]]) b.fill(x, 34, z, x, 39, z, C.iron1);
    b.fill(-3, 40, 4, 2, 40, 8, (x, y, z) => (x === -3 || x === 2 || z === 4 || z === 8 ? C.iron2 : C.brass2)); b.put(-1, 41, 6, C.brass2); b.put(0, 41, 6, C.brass2);
    b.fill(-2, 35, 5, 1, 35, 7, C.iron2);
    // the windsock's pole, at the back of the ridge
    b.fill(-1, 34, -8, -1, 44, -8, (x, y) => (y % 4 === 0 ? C.brass2 : C.iron1));
    // the bell's bracket at the left front corner
    b.fill(-17, 21, 8, -15, 21, 8, C.iron2); b.put(-15, 20, 8, C.iron2);
    // at the foot: a barrel with a crate on it, a mug of tea and the logbook open; a coil of rope; a spyglass on a tripod
    barrel(b, [15.5, 1, 7.5], 7);
    crate(b, [14, 1, 0], [5, 5, 5], 3, null);
    b.fill(14, 8, 7, 14, 9, 7, K('mug')); b.put(14, 9, 7, K('tea')); b.put(15, 9, 7, K('mug'));
    b.fill(15, 6, 2, 17, 6, 4, (x, y, z) => (z === 3 ? K('hw2') : (x + z) % 2 ? K('plaster1') : K('stencil')));
    coil(b, [-16.5, 1, 11.5], 1.6);
    for (const [dx, dz] of [[-1, -1], [1, -1], [0, 1]]) wire(b, [15.5 + dx * 1.8, 0.5, -3.5 + dz * 1.8], [15.5, 7.5, -3.5], K('hw2'));
    b.fill(15, 8, -6, 15, 8, -2, (x, y, z) => (z === -6 ? C.brass1 : z === -2 ? C.iron1 : C.brass2)); b.put(15, 9, -5, C.brass1);
    return b;
  }
  const ledgerX = [-2, 10];
  return {
    gait: 'still',
    info: { rows: ROWS, door: [-8.5, 16], standoff: [-2, 17], ledger: [4, 13, 10], blocks: [[-16, -12, 15, 11], [12, 0, 18, 9], [-18, 7, -14, 13], [13, -6, 18, -1]] },
    build() {
      if (built) return built;
      const cursor = box([-4, 17, 10], [12, 19, 10]);
      for (const x of [ledgerX[0] - 1, ledgerX[1] + 1]) { cursor.put(x, 18, 10, K('cursor')); }
      for (let x = ledgerX[0]; x <= ledgerX[1]; x += 1) if (x % 2 === 0) { cursor.put(x, 19, 10, K('cursor')); cursor.put(x, 17, 10, K('cursor')); }
      const beacon = box([-2, 36, 5], [1, 39, 7]);
      beacon.fill(-1, 36, 5, 0, 38, 7, (x, y, z) => (y === 37 && z === 6 ? K('beam1') : K('beam2')));
      beacon.fill(-2, 37, 6, 1, 37, 6, K('beam1'));
      const sock = box([-1, 40, -8], [9, 44, -7]);
      for (let x = 0; x <= 9; x += 1) { const h = x < 3 ? 2 : x < 7 ? 1 : 0; for (let y = 42 - h; y <= 42 + h; y += 1) for (let z = -8; z <= -7; z += 1) if (x > 0 || y === 42) sock.put(x, y, z, x === 0 ? C.iron2 : Math.floor(x / 2) % 2 ? K('sock2') : K('sock1')); }
      const bell = box([-18, 15, 7], [-15, 20, 9]);
      bell.fill(-17, 16, 7, -15, 19, 9, (x, y, z) => ((x === -17 || x === -15) && (z === 7 || z === 9) && y > 17 ? 0 : y === 19 ? C.brass1 : C.brass2));
      bell.put(-16, 20, 8, C.iron2); bell.put(-16, 15, 8, C.iron2);
      built = { parts: {
        body: body().part('body', [0, 0, 0]),
        cursor: cursor.part('cursor', [4, 18, 10]),
        beacon: beacon.part('beacon', [-0.5, 37, 6.5]),
        sock: sock.part('sock', [-0.5, 42, -7.5]),
        bell: bell.part('bell', [-15.5, 20.5, 8.5]),
      } };
      return built;
    },
    setup(ctx) {
      ctx.mem.sel = -1; ctx.mem.row = 0; ctx.mem.ring = -10; ctx.mem.wind = 0; // the district sets the wind, in the hut's frame
      ctx.select = (i) => { ctx.mem.sel = i; };
      ctx.ring = () => { ctx.mem.ring = ctx.state.t; };
    },
    idle(ctx, dt) {
      const { parts: P, state: { t }, mem } = ctx;
      // the cursor steps down the ledger, a row every second and a half, or holds on the ship Yuuv is visiting
      const want = mem.sel >= 0 ? mem.sel : Math.floor(t / 1.5) % ROWS.length;
      mem.row += (want - mem.row) * Math.min(1, dt * 8);
      P.cursor.position.y -= 2 * mem.row; // the rows are two apart
      P.cursor.scale.setScalar(mem.sel >= 0 && Math.floor(t * 3) % 2 ? 0 : 1);
      // the beacon turns; the windsock swings and fills with the gusts; the bell sways, and rings
      P.beacon.rotation.y = t * 1.6;
      P.sock.rotation.y = mem.wind + 0.18 * Math.sin(t * 0.7) + 0.06 * Math.sin(t * 2.3);
      P.sock.rotation.z = -0.25 + 0.2 * Math.sin(t * 0.45) + 0.05 * Math.sin(t * 3.1);
      const rg = t - mem.ring;
      P.bell.rotation.z = 0.05 * Math.sin(t * 1.3) + (rg < 3 ? 0.5 * Math.exp(-rg * 1.4) * Math.sin(rg * 11) : 0);
    },
    act(ctx) { ctx.ring(); },
  };
}

// ---------------------------------------------------------------------------------------------
const GLYPH5 = ['#####', '#...#', '#.#.#', '#...#', '#####'];
export function crane() {
  let built;
  return {
    gait: 'still',
    info: { block: [-5, -5, 4, 4], tip: [24.5, 29, 0.5] },
    build() {
      if (built) return built;
      const base = box([-5, 0, -5], [4, 31, 5]);
      base.fill(-4, 0, -4, 3, 2, 3, (x, y, z) => (y === 1 && (x + z) % 3 === 0 ? K('hmortar') : (x === -4 || x === 3) && (z === -4 || z === 3) ? K('q1') : tone(STONE, Math.floor(x / 2), y, Math.floor(z / 2), 5)));
      for (let z = -4; z <= 3; z += 1) for (let x = -4; x <= 3; x += 1) { const d = Math.hypot(x + 0.5, z + 0.5); if (d > 2.4 && d <= 3.6) base.put(x, 3, z, (x + z) % 3 ? C.brass2 : C.iron2); }
      base.fill(-2, 3, -2, 1, 29, 1, (x, y, z) => (y % 6 === 0 ? C.iron2 : y % 6 === 1 && (x + z) % 2 ? C.brass2 : tone([K('hw1'), K('hw2'), K('hw2')], x, Math.floor(y / 3), z, 6)));
      // the winch: a drum of rope in iron cheeks, a crank
      for (let x = -2; x <= 1; x += 1) for (let y = 6; y <= 10; y += 1) for (let z = 2; z <= 5; z += 1) {
        const d = Math.hypot(y + 0.5 - 8.5, z + 0.5 - 4);
        if (d > 2.1) continue;
        base.put(x, y, z, x === -2 || x === 1 ? C.iron2 : d < 1 ? K('hw3') : Math.round(d * 3 + x) % 2 ? K('hrope1') : K('hrope2'));
      }
      base.fill(2, 8, 4, 3, 8, 4, C.iron3); base.fill(3, 8, 5, 3, 10, 5, C.iron3);
      base.fill(-1, 20, 2, 0, 20, 2, C.iron2); base.put(-1, 19, 2, K('hlit')); base.put(0, 19, 2, K('hlit2'));
      // the jib: a boom with a counterweight, braced back to the post, stayed from a king post, a pulley and a lamp at the tip
      const jib = box([-10, 17, -2], [26, 37, 2]);
      jib.fill(-8, 30, -1, 24, 31, 0, (x, y, z) => (x % 5 === 0 ? C.brass2 : tone([K('hw2'), K('hw3')], Math.floor(x / 4), y, z, 8)));
      wire(jib, [1.5, 20.5, -0.5], [13.5, 30.5, -0.5], K('hw2')); wire(jib, [1.5, 20.5, 0.5], [13.5, 30.5, 0.5], K('hw2'));
      jib.fill(-1, 32, -1, 0, 36, 0, K('hw1'));
      wire(jib, [0.5, 36.5, 0], [24.5, 32, 0], K('hrope2')); wire(jib, [0.5, 36.5, 0], [-7.5, 32, 0], K('hrope2'));
      jib.fill(-10, 26, -2, -6, 29, 1, (x, y, z) => (y === 29 || y === 26 ? (x % 2 ? C.iron2 : C.iron3) : x === -10 || x === -6 ? ((y + z) % 3 ? C.iron2 : C.brass1) : tone([K('cweight'), K('s4'), K('s3')], x, y, z, 9))); // stone blocks in an iron cage, riveted
      jib.fill(24, 29, -1, 25, 29, 0, C.brass2);
      jib.put(25, 32, 0, C.iron2); jib.put(25, 31, 1, K('hlit'));
      // the load: rope, hook, sling and a crate
      const load = box([21, 7, -3], [28, 28, 3]);
      load.fill(24, 17, 0, 24, 28, 0, (x, y) => (y % 2 ? K('hrope1') : K('hrope2')));
      load.fill(24, 15, 0, 25, 16, 0, C.iron3);
      for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) wire(load, [24.5, 15.5, 0.5], [24.5 + dx, 13.5, 0.5 + dz], K('hrope1'));
      crate(load, [22, 8, -2], [5, 5, 5], 7, GLYPH5);
      built = { parts: { base: base.part('base', [0, 0, 0]), jib: jib.part('jib', [0, 30, 0]), load: load.part('load', [24.5, 29, 0.5], jib) } };
      return built;
    },
    idle({ parts: P, state: { t }, mem }) {
      // slews out to the fleet, holds, slews back, holds; the crate swings behind the motion
      const k = (t % 18) / 18, a = k < 0.3 ? 0 : k < 0.45 ? smooth((k - 0.3) / 0.15) : k < 0.8 ? 1 : 1 - smooth((k - 0.8) / 0.15);
      const v = (k > 0.3 && k < 0.45) || (k > 0.8 && k < 0.95) ? 1 : 0;
      P.jib.rotation.y = -0.2 - 1.1 * a;
      P.load.rotation.x = 0.06 * Math.sin(t * 1.4) + 0.12 * v * Math.sin(t * 2.6);
      P.load.rotation.z = 0.05 * Math.sin(t * 1.1 + 1) + 0.1 * v;
    },
  };
}

// ---------------------------------------------------------------------------------------------
const ARROWS = ['..#..', '.###.', '#####', '..#..', '..#..'];
export function yard(seed = 1) {
  let built;
  return {
    gait: 'still',
    build() {
      if (built) return built;
      const b = box([-12, 0, -8], [12, 14, 8]);
      crate(b, [-11, 0, -6], [7, 7, 7], seed, ARROWS);
      crate(b, [-4, 0, -5], [6, 6, 6], seed + 1, GLYPH5);
      crate(b, [-9, 7, -5], [6, 6, 6], seed + 2, null);
      crate(b, [-3, 6, -4], [5, 5, 5], seed + 3, ARROWS);
      barrel(b, [5.5, 0, -3.5], 7); barrel(b, [9.5, 0, -1.5], 6); barrel(b, [6.5, 0, 1.5], 6);
      for (const [cx, cz] of [[-7, 3], [-3.5, 4], [-5.5, 5.5]]) b.egg(cx, 1.5, cz, 2.2, 1.6, 1.8, (x, y, z) => (y === 2 && (x + z) % 3 === 0 ? K('hrope2') : hash(x, y, z) < 0.4 ? K('sack2') : K('sack1')));
      coil(b, [1.5, 0, 5.5], 2);
      built = { parts: { yard: b.part('yard', [0, 0, 0]) } };
      return built;
    },
  };
}

// ---------------------------------------------------------------------------------------------
export function quay() {
  let built;
  return {
    gait: 'still',
    build() {
      if (built) return built;
      const b = box([-10, 0, -6], [10, 13, 6]);
      // a lantern post: an iron post on a stone foot, an arm, a caged lamp
      b.fill(-9, 0, -1, -8, 0, 0, K('s3')); b.fill(-9, 1, -1, -9, 11, -1, (x, y) => (y % 4 === 0 ? C.brass2 : C.iron1));
      b.fill(-8, 11, -1, -7, 11, -1, C.iron2); b.put(-7, 10, -1, C.iron2); b.put(-7, 9, -1, K('hlit2')); b.put(-7, 8, -1, K('hlit')); b.put(-7, 7, -1, C.iron2);
      // two bollards, rope slung between them
      for (const x of [-4, 1]) { b.fill(x, 0, 3, x + 1, 2, 4, C.iron1); b.fill(x, 3, 3, x + 1, 3, 4, C.brass2); }
      wire(b, [-2.5, 2.5, 4], [1.5, 2.5, 4], K('hrope1'), 1);
      coil(b, [4.5, 0, 3.5], 1.6);
      barrel(b, [6.5, 0, -2.5], 6); barrel(b, [3.5, 0, -3.5], 5);
      // a hand cart: a plank bed on two spoked wheels, shafts on the ground, a sack in it
      b.fill(-4, 2, -4, 0, 2, -1, (x) => (x % 2 ? K('hw3') : K('hw4'))); b.fill(-4, 3, -4, -4, 3, -1, K('hw2')); b.fill(0, 3, -4, 0, 3, -1, K('hw2'));
      for (const z of [-5, 0]) for (let y = 0; y <= 3; y += 1) for (let x = -4; x <= -1; x += 1) { const d = Math.hypot(x + 0.5 + 2.5, y + 0.5 - 1.9); if (d <= 1.9 && (d > 1.2 || (x + y) % 2 === 0)) b.put(x, y, z, d > 1.2 ? K('hw2') : C.iron2); }
      wire(b, [0.5, 2.5, -3.5], [4.5, 0.5, -3.8], K('hw2')); wire(b, [0.5, 2.5, -1.5], [4.5, 0.5, -1.2], K('hw2'));
      b.egg(-2, 3.6, -2.5, 1.6, 1.1, 1.3, (x, y, z) => (hash(x, y, z) < 0.4 ? K('sack2') : K('sack1')));
      built = { parts: { quay: b.part('quay', [0, 0, 0]) } };
      return built;
    },
  };
}
