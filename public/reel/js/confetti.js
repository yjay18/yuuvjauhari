// confetti.js: when a cover comes off, a burst of little torn paper bits flutters down over the card. The dragon can
// chase one (chaseTarget) and catch it (catchNear).
const rnd = (a, b) => a + Math.random() * (b - a);
const PAPER = ['#F6EFE2', '#EFE5D2', '#E8DCC6', '#CFE0D4', '#F2C9B6', '#B9D3C2', '#F4DDA8'];   // cream paper plus a few sage, clay and ochre scraps

export class Confetti {
  constructor() { this.bits = []; }
  get active() { return this.bits.length > 0; }
  // burst from across the top of a card's box (screen px)
  burst(r, n = 36) {
    for (let i = 0; i < n; i++) {
      const s = rnd(7, 15), sides = Math.random() < .5 ? 3 : 4;
      const shape = Array.from({ length: sides }, (_, k) => { const a = k / sides * Math.PI * 2 + rnd(-.4, .4); return [Math.cos(a) * s * rnd(.7, 1.2), Math.sin(a) * s * rnd(.5, 1)]; });
      this.bits.push({
        x: rnd(r.left + r.width * .08, r.right - r.width * .08), y: rnd(r.top, r.top + r.height * .35),
        vx: rnd(-140, 140), vy: rnd(-420, -140), rot: rnd(0, 6), vr: rnd(-7, 7), sway: rnd(0, 6), shape,
        col: PAPER[Math.floor(Math.random() * PAPER.length)], born: performance.now(),
      });
    }
  }
  update(dt) {
    const s = Math.min(.05, dt / 1000), H = innerHeight;
    for (const b of this.bits) {
      // gravity, then air drag and a side-to-side flutter once it's falling
      b.vy += 900 * s; b.vx *= Math.pow(.2, s); b.vy = Math.min(b.vy, 170);
      b.x += (b.vx + Math.sin(performance.now() / 260 + b.sway) * 46) * s; b.y += b.vy * s;
      b.rot += b.vr * s * (b.vy > 0 ? .6 : 1);
    }
    this.bits = this.bits.filter(b => b.y < H + 40 && !b.caught);
    return this.bits.length > 0;
  }
  // a scrap for the dragon to chase: one still high on screen
  chaseTarget() {
    let best = null;
    for (const b of this.bits) if (b.vy > 0 && b.y < innerHeight * .7 && (!best || b.y < best.y)) best = b;
    return best;
  }
  catchNear(x, y, r) { for (const b of this.bits) if (Math.hypot(b.x - x, b.y - y) < r) { b.caught = true; return true; } return false; }
  draw(ink) {
    const c = ink.x;
    for (const b of this.bits) {
      const cos = Math.cos(b.rot), sin = Math.sin(b.rot), flip = Math.cos(b.rot * 1.7);   // the flip squashes it as it tumbles
      const P = b.shape.map(([u, v]) => [b.x + (u * cos - v * sin) * (.35 + .65 * Math.abs(flip)), b.y + (u * sin + v * cos)]);
      c.fillStyle = b.col; c.beginPath(); P.forEach(([u, v], i) => i ? c.lineTo(u, v) : c.moveTo(u, v)); c.closePath(); c.fill();
      c.strokeStyle = ink.theme.ink; c.globalAlpha = .55; c.lineWidth = .8; c.stroke(); c.globalAlpha = 1;
    }
  }
}
