// dragon.js: the paper dragon. It unfolds from the first scrap he tears off, then keeps him company: hovering at his
// shoulder, flying ahead when he walks, perching on whatever card you point at, jumping when paper tears or a heading
// stamps down, chasing the paper airplane, and puffing a little ink smoke when things go quiet.
import { Guide } from './guide.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

export class Dragon {
  constructor(el, art) {
    const m = Object.fromEntries(Object.entries(art).filter(([n]) => n.startsWith('dragon_')));
    this.sprite = new Guide(el, m, 'art/', 'dragon_fly');
    this.el = el; this.m = m; this.alive = false;
    this.pos = [-200, -200]; this.vel = [0, 0]; this.face = 1; this.perched = false; this.lastPuff = performance.now();
    el.hidden = true;
  }
  load() { return this.sprite.load(Object.keys(this.m)); }
  setScale(s) { this.scale = s; if (this.m.dragon_fly) this.sprite.setScale(s); }
  // it appears where the first ball landed, as the ball, and unfolds
  hatch(at, now) {
    this.alive = true; this.el.hidden = false; this.pos = [...at]; this.vel = [0, 0];
    this.sprite.play('dragon_unfold', { once: true, onEnd: () => { this.busyUntil = 0; } });
    this.busyUntil = now + 1500; this.anchorName = 'dragon_unfold';
  }
  startle(now) {
    if (!this.alive || now < (this.busyUntil || 0)) return;
    this.perched = false; this.vel[1] -= 260;
    this.sprite.play('dragon_startle', { once: true, restart: true }); this.busyUntil = now + 700;
  }
  // target: { x, y, perch: bool } in screen px: where its feet should be (on a perch, the edge it sits on)
  update(now, dt, target) {
    if (!this.alive) return;
    const s = this.scale || 1, busy = now < (this.busyUntil || 0) && this.sprite.lock;
    if (!busy) {
      // a soft spring toward the target, with a little bob so it never hangs dead still
      const bob = target.perch ? 0 : Math.sin(now / 380) * 10 * s;
      const dx = target.x - this.pos[0], dy = target.y + bob - this.pos[1], k = target.perch ? 30 : 5, damp = Math.exp(-dt / 1000 * (target.perch ? 11 : 4.2));   // perching: a near-critical spring, so it swoops in and settles
      this.vel[0] = (this.vel[0] + dx * k * dt / 1000) * damp; this.vel[1] = (this.vel[1] + dy * k * dt / 1000) * damp;
      this.pos[0] += this.vel[0] * dt / 1000; this.pos[1] += this.vel[1] * dt / 1000;
      const speed = Math.hypot(this.vel[0], this.vel[1]), close = Math.hypot(dx, dy) < 18 * s;
      this.perched = target.perch && close && speed < 90;
      if (this.perched) { this.pos = [target.x, target.y]; this.vel = [0, 0]; }
      let clip = this.perched ? 'dragon_perch' : speed > 140 ? 'dragon_fly' : speed > 35 ? 'dragon_glide' : 'dragon_fly';
      if (!this.perched && !target.perch && speed < 60 && now - this.lastPuff > 9000 && this.m.dragon_puff) { clip = 'dragon_puff'; this.lastPuff = now; this.sprite.play(clip, { once: true, restart: true }); this.busyUntil = now + 700; }
      else this.sprite.play(clip);
      if (Math.abs(this.vel[0]) > 25) this.face = this.vel[0] > 0 ? 1 : -1;
      else if (target.faceX != null) this.face = target.faceX > this.pos[0] ? 1 : -1;
    }
    this.sprite.setFlip(this.face < 0);
    this.sprite.tick(now);
    // place the sprite so the clip's anchor sits on pos; tilt into the direction of travel
    // every clip is painted in one shared world position, so its feet point lines them all up: pos is always the feet
    const c = this.m[this.sprite.cur] || this.m.dragon_fly, [ax, ay] = c.feet || c.anchor || [c.w / 2, c.h / 2];
    const tilt = this.perched ? 0 : clamp(this.vel[1] * .02 + this.vel[0] * .012 * this.face, -14, 14);
    const lx = this.face < 0 ? c.w - ax : ax;
    this.el.style.transform = `translate(${this.pos[0] - lx * s}px, ${this.pos[1] - ay * s}px) rotate(${tilt}deg)`;
    this.el.style.transformOrigin = `${lx * s}px ${ay * s}px`;
  }
}
