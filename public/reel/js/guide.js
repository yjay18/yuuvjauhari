// guide.js: plays painted Yuuv. Each clip is a WebP grid of frames (see sprites/manifest.json); the sprite div shows
// one frame at a time. Clips run at 12 fps on the clock, or on a frame the caller passes (walking is driven by scroll).
export class Guide {
  constructor(el, manifest, base = 'sprites/', ref = 'idle2') {
    this.el = el; this.m = manifest; this.base = base; this.ref = ref;   // ref: the clip that sets the frame size
    this.spr = el.querySelector('.sprite');
    this.cur = null; this.frame = -1; this.t0 = 0; this.flip = false; this.scale = 1;
    this.lock = false; this.onEnd = null; this.imgs = [];
  }
  load(names = Object.keys(this.m)) {
    return Promise.all(names.map(n => new Promise(ok => {
      const i = new Image(); i.onload = i.onerror = () => ok(); i.src = `${this.base}${n}.webp`; this.imgs.push(i);
    })));
  }
  setScale(s) {
    if (s === this.scale) return;
    const c = this.m[this.ref]; if (!c) return; this.scale = s;
    this.spr.style.width = `${c.w * s}px`; this.spr.style.height = `${c.h * s}px`;
    this.apply(this.frame, true);
  }
  // once: play to the end, hold input (lock) until then, then call onEnd
  play(name, { once = false, onEnd = null, restart = false } = {}) {
    if (!this.m[name] || (name === this.cur && !restart)) return;
    this.cur = name; this.t0 = performance.now(); this.lock = once; this.onEnd = onEnd;
    this.spr.style.backgroundImage = `url(${this.base}${name}.webp)`;
    this.apply(0, true);
  }
  tick(now, frame) {
    const c = this.m[this.cur]; if (!c) return;
    let f = frame ?? Math.floor((now - this.t0) / 1000 * c.fps);
    if (this.lock && f >= c.frames) {
      f = c.frames - 1; this.lock = false;
      const cb = this.onEnd; this.onEnd = null; if (cb) cb();
    } else f = ((f % c.frames) + c.frames) % c.frames;
    this.apply(f);
  }
  apply(f, force) {
    const c = this.m[this.cur]; if (!c || (f === this.frame && !force)) return;
    this.frame = f;
    // clips can have different frame sizes (the dragon's do): size the box to this clip, or a neighbour frame shows
    const bw = `${c.w * this.scale}px`, bh = `${c.h * this.scale}px`;
    if (this.spr.style.width !== bw) this.spr.style.width = bw;
    if (this.spr.style.height !== bh) this.spr.style.height = bh;
    const cols = c.cols || c.frames, rows = c.rows || 1;
    this.spr.style.backgroundSize = `${cols * c.w * this.scale}px ${rows * c.h * this.scale}px`;
    this.spr.style.backgroundPosition = `${-(f % cols) * c.w * this.scale}px ${-Math.floor(f / cols) * c.h * this.scale}px`;
  }
  setFlip(b) { if (b !== this.flip) { this.flip = b; this.spr.style.transform = b ? 'scaleX(-1)' : ''; } }
  // screen position of the clip's anchor this frame (brush tip, pointing hand), or null
  anchor() {
    const c = this.m[this.cur]; if (!c || !c.anchor) return null;
    const [ax, ay] = c.anchor[Math.max(0, this.frame)] || c.anchor[0], r = this.spr.getBoundingClientRect();
    return [r.left + (this.flip ? c.w - ax : ax) * this.scale, r.top + ay * this.scale];
  }
  // screen point: fraction (fx, fy) of the frame, e.g. the head is about (.5, .2)
  at(fx, fy) { const r = this.spr.getBoundingClientRect(); return [r.left + r.width * fx, r.top + r.height * fy]; }
}
