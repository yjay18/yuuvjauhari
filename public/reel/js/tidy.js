// tidy.js: the torn paper doesn't vanish. When a cover comes off, a scrap drops to his hands, he scrunches it into a
// ball and tosses it over his shoulder into the wastepaper basket behind him. The basket fills (and overflows) as you
// go; at the end he rolls one out and kicks it off the page. The very first scrap becomes the paper dragon instead.
import { rng } from './ink.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = t => 1 - (1 - t) * (1 - t);
const hash = i => { const r = rng(i * 7919 + 17); return r(); };
const TOSS_RELEASE = 9, KICK_HIT = 7;   // frames in the toss / kick clips where the ball leaves him

// a scrunched paper ball: a lumpy cream outline, a shaded side and a few creases, all boiling
export function drawBall(ink, x, y, r, rot, key, paper = '#F1E8D6') {
  const R = rng(key.length * 131 + key.charCodeAt(key.length - 1)), P = [];
  for (let i = 0; i < 12; i++) { const a = rot + i / 12 * Math.PI * 2, rr = r * (.82 + R() * .3); P.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  const c = ink.x; c.fillStyle = paper; c.beginPath(); P.forEach(([a, b], i) => i ? c.lineTo(a, b) : c.moveTo(a, b)); c.closePath(); c.fill();
  c.fillStyle = 'rgba(120,100,70,.18)'; c.beginPath(); c.ellipse(x + r * .25, y + r * .3, r * .6, r * .45, rot, 0, Math.PI * 2); c.fill();
  ink.stroke([...P, P[0]], { w: 1.4, key: key + 'o', wob: .5 });
  for (let i = 0; i < 3; i++) { const a = rot + i * 2.1; ink.stroke([[x + Math.cos(a) * r * .15, y + Math.sin(a) * r * .15], [x + Math.cos(a + .6) * r * .7, y + Math.sin(a + .6) * r * .7]], { w: .8, key: key + 'c' + i, alpha: .6, dry: false }); }
}

export class Tidy {
  constructor(art, { guide, oneShot, onHatch }) {
    this.m = art; this.guide = guide; this.oneShot = oneShot; this.onHatch = onHatch;
    this.count = 0; this.balls = []; this.hatched = false; this.kicked = false;
    this.img = {}; for (const n of ['basket_back', 'basket_front']) if (art[n]) { const i = new Image(); i.src = `art/${n}.webp`; this.img[n] = i; }
  }
  // where the basket stands: behind him (screen left) on desktop, in front of him on phones
  basket(phone) {
    const g = this.guide, s = g.scale, [fx, fy] = g.at(.5, g.m.idle2.feet[1] / g.m.idle2.h);
    return { x: fx + (phone ? 120 : -128) * s, y: fy + 2, s };
  }
  mouth(phone) {
    const b = this.basket(phone), m = this.m.basket_back;
    if (!m) return [b.x, b.y - 70 * b.s];
    const [ax, ay] = m.anchor, [mx, my] = m.mouth || [ax, ay - 70];
    return [b.x + (mx - ax) * b.s, b.y + (my - ay) * b.s];
  }
  // a cover just finished coming off: the scrap drops from the card toward him
  reveal(from, now, phone) {
    const g = this.guide, s = g.scale, [fx, fy] = g.at(.5, g.m.idle2.feet[1] / g.m.idle2.h);
    if (!this.hatched) {   // the first scrap lands in front of him and unfolds into the dragon
      this.hatched = true;
      this.balls.push({ st: 'fall', t0: now, dur: 650, from, to: [fx + (phone ? -70 : 95) * s, fy - 8 * s], hatch: true, rot: 0 });
      return;
    }
    const to = g.at(.6, .42);
    this.balls.push({ st: 'fall', t0: now, dur: 480, from, to, rot: 0 });
  }
  unreveal() { if (this.count > 0) this.count--; }   // scrolled back: a cover sealed again, one ball quietly goes
  // the contact section: roll one out and kick it away
  kick(now, phone) {
    if (this.kicked || this.count === 0) return;
    this.kicked = true; this.count--;
    const [mx, my] = this.mouth(phone), g = this.guide, [fx, fy] = g.at(.5, g.m.idle2.feet[1] / g.m.idle2.h);
    this.balls.push({ st: 'roll', t0: now, dur: 700, from: [mx, my], to: [fx + 34 * g.scale, fy - 10 * g.scale], rot: 0 });
  }
  rearmKick() { this.kicked = false; }

  update(now, phone, away = false) {
    const g = this.guide;
    if (away) {   // he's stepped aside for the pop-up book: anything in the air just lands in the basket
      for (const b of this.balls) if (['fall', 'held', 'fly'].includes(b.st)) { if (!b.hatch) this.count++; b.st = 'gone'; } else b.st = 'gone';
      this.balls = []; return false;
    }
    for (const b of this.balls) {
      const k = clamp((now - b.t0) / b.dur);
      if (b.st === 'fall') {
        b.pos = [lerp(b.from[0], b.to[0], k), lerp(b.from[1], b.to[1], k) - Math.sin(k * Math.PI) * 90];
        b.rot += .15; b.size = 1.35;
        if (k >= 1) {
          if (b.hatch) { b.st = 'gone'; this.onHatch?.(b.to, now); }
          else if (!g.lock) { this.oneShot('toss'); b.st = 'held'; }
          else { b.st = 'fly'; b.t0 = now; b.dur = 520; b.from = b.pos; b.to = this.mouth(phone); }
        }
      } else if (b.st === 'held') {
        const a = g.anchor();
        if (g.cur !== 'toss' || !a || g.frame >= TOSS_RELEASE) { b.st = 'fly'; b.t0 = now; b.dur = 560; b.from = a || b.pos; b.to = this.mouth(phone); }
        else { b.pos = a; b.size = lerp(1.35, 1, clamp(g.frame / 4)); b.rot += .4 * (g.frame < 4 ? 1 : .2); }
      } else if (b.st === 'fly') {
        b.pos = [lerp(b.from[0], b.to[0], k), lerp(b.from[1], b.to[1], k) - Math.sin(k * Math.PI) * 160];
        b.rot -= .22; b.size = 1;
        if (k >= 1) { b.st = 'gone'; this.count++; }
      } else if (b.st === 'roll') {
        b.pos = [lerp(b.from[0], b.to[0], easeOut(k)), lerp(b.from[1], b.to[1], k) - (k < .35 ? Math.sin(k / .35 * Math.PI) * 40 : 0)];
        b.rot += .25; b.size = 1;
        if (k >= 1) { this.oneShot('kick'); b.st = 'onfoot'; }
      } else if (b.st === 'onfoot') {
        if (g.cur !== 'kick' || g.frame >= KICK_HIT) {
          b.st = 'launch'; b.t0 = now; b.from = b.pos;
          b.v = [innerWidth * .9, -innerHeight * 1.1];   // px per second
        }
      } else if (b.st === 'launch') {
        const t = (now - b.t0) / 1000;
        b.pos = [b.from[0] + b.v[0] * t, b.from[1] + b.v[1] * t + 1400 * t * t];
        b.rot += .35; b.size = 1 + t * .4;
        if (b.pos[0] > innerWidth + 80 || b.pos[1] > innerHeight + 80) b.st = 'gone';
      }
    }
    this.balls = this.balls.filter(b => b.st !== 'gone');
    return this.balls.length > 0;
  }

  // behind him: the basket, with the pile of balls between its back and front walls
  drawBack(ink, phone) {
    const b = this.basket(phone), r = 13 * b.s, [mx, my] = this.mouth(phone);
    const layer = n => {
      const m = this.m[n], im = this.img[n];
      if (!m || !im?.complete || !im.naturalWidth) return false;
      const f = ink.boil % m.frames, cols = m.cols || m.frames, [ax, ay] = m.anchor;
      ink.x.drawImage(im, (f % cols) * m.w, Math.floor(f / cols) * m.h, m.w, m.h, b.x - ax * b.s, b.y - ay * b.s, m.w * b.s, m.h * b.s);
      return true;
    };
    const drewBack = layer('basket_back');
    const inside = Math.min(this.count, 7);
    for (let i = 0; i < inside; i++) {
      const row = Math.floor(i / 3), x = mx + (hash(i) - .5) * r * 3.2, y = my + r * 1.4 - row * r * 1.2 - hash(i + 9) * 3;
      drawBall(ink, x, y, r, hash(i + 20) * 6, 'pile' + i);
    }
    if (!drewBack) {   // no painted basket yet: a quick inked one
      const w = 44 * b.s, h = 56 * b.s;
      ink.stroke([[mx - w, my], [mx - w * .75, b.y], [mx + w * .75, b.y], [mx + w, my]], { w: 1.8, key: 'bsk' });
      ink.ellipse(mx, my, w, 7 * b.s, { w: 1.5, key: 'bskr' });
    } else layer('basket_front');
    for (let i = 7; i < this.count; i++) drawBall(ink, b.x + (phone ? 1 : -1) * (48 + (i - 7) * 24) * b.s, b.y - r * .9, r, hash(i + 30) * 6, 'spill' + i);
  }
  // in front of him: balls in the air or in his hands
  drawFront(ink) {
    for (const b of this.balls) if (b.pos) drawBall(ink, b.pos[0], b.pos[1], 13 * this.guide.scale * (b.size || 1), b.rot, 'ball' + Math.round(b.t0));
  }
}
