// plane.js: clicking the email folds it into a paper airplane. It flies to his hand, he throws it, it loops once
// and leaves the screen, and only then does the mail app open.
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = t => t * t * (3 - 2 * t);
const THROW_RELEASE = 7;   // frame of the throw clip where the plane leaves his hand

export class Plane {
  constructor({ guide, oneShot }) { this.guide = guide; this.oneShot = oneShot; this.f = null; }
  get active() { return !!this.f; }
  launch(fromRect, href, now, onGone) {
    const from = [fromRect.left + fromRect.width / 2, fromRect.top + fromRect.height / 2];
    this.f = { st: 'fold', t0: now, from, pos: from, ang: 0, href, onGone, w: fromRect.width };
  }
  update(now) {
    const f = this.f; if (!f) return false;
    const g = this.guide, k = t => clamp((now - f.t0) / t);
    if (f.st === 'fold' && k(260) >= 1) { f.st = 'toHand'; f.t0 = now; this.oneShot('throw'); }
    if (f.st === 'toHand') {
      const a = g.anchor() || g.at(.6, .4), q = ease(k(420));
      f.pos = [lerp(f.from[0], a[0], q), lerp(f.from[1], a[1], q) - Math.sin(q * Math.PI) * 70]; f.ang = Math.PI;
      if (q >= 1) f.st = 'held';
    }
    if (f.st === 'held') {
      const a = g.anchor(); if (a) f.pos = a;
      f.ang = -.4;
      if (g.cur !== 'throw' || g.frame >= THROW_RELEASE) { f.st = 'fly'; f.t0 = now; f.from = f.pos; }
    }
    if (f.st === 'fly') {
      // out and up, one loop-the-loop, then off the top-right corner
      const u = k(1500), W = innerWidth, H = innerHeight, L = [W * .55, H * .38], R = Math.min(W, H) * .16;
      let p;
      if (u < .35) { const q = ease(u / .35); p = [lerp(f.from[0], L[0], q), lerp(f.from[1], L[1] + R, q) - Math.sin(q * Math.PI) * 60]; }
      else if (u < .7) { const a = (u - .35) / .35 * Math.PI * 2; p = [L[0] + Math.sin(a) * R, L[1] + Math.cos(a) * R]; }
      else { const q = (u - .7) / .3; p = [lerp(L[0], W + 120, q * q), lerp(L[1] + R, -120, q)]; }
      if (f.pos) f.ang = Math.atan2(p[1] - f.pos[1], p[0] - f.pos[0]);
      f.pos = p;
      if (u >= 1) { const done = f.onGone; this.f = null; done?.(); return false; }
    }
    return true;
  }
  // a classic dart plane, top view slightly from the side: two wings and a keel, paper with ink edges
  draw(ink) {
    const f = this.f; if (!f) return;
    const x = ink.x, s = f.st === 'fold' ? lerp(.3, 1, clamp((performance.now() - f.t0) / 260)) : 1, L = 34 * s;
    const P = (px, py) => [f.pos[0] + Math.cos(f.ang) * px - Math.sin(f.ang) * py, f.pos[1] + Math.sin(f.ang) * px + Math.cos(f.ang) * py];
    const nose = P(L, 0), tailT = P(-L, -L * .55), tailB = P(-L, L * .55), mid = P(-L * .7, 0), keel = P(-L * .8, L * .25);
    const tri = (pts, fill) => { x.fillStyle = fill; x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fill(); };
    tri([nose, tailT, mid], '#FBF6EC'); tri([nose, mid, tailB], '#EDE3D0'); tri([nose, mid, keel], '#DCCFB6');
    ink.stroke([nose, tailT, mid, tailB, nose], { w: 1.5, key: 'plane', wob: .4 });
    ink.stroke([nose, keel, mid], { w: 1, key: 'keel', wob: .3, alpha: .7 });
  }
}
