// cord.js: a lamp hangs at the top of his lane with a pull cord. Drag the bead down (or click it) and the lights go
// out: the page switches to its dark theme and the lamp swings. The bead is a real button for keyboards.
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

export class Cord {
  constructor(button, { onToggle }) {
    this.b = button; this.onToggle = onToggle;
    this.stretch = 0; this.sv = 0; this.swing = 0; this.wv = 0; this.drag = null; this.moving = false;
    button.addEventListener('pointerdown', e => {
      this.drag = { y: e.clientY, x: e.clientX, moved: false }; button.setPointerCapture(e.pointerId); e.preventDefault();
    });
    button.addEventListener('pointermove', e => {
      if (!this.drag) return;
      const dy = e.clientY - this.drag.y, dx = e.clientX - this.drag.x;
      if (Math.abs(dy) + Math.abs(dx) > 4) this.drag.moved = true;
      this.stretch = clamp(dy, -10, 90); this.swing = clamp(dx / 180, -.5, .5); this.moving = true;
    });
    const release = () => {
      if (!this.drag) return;
      const pulled = this.stretch > 34 || !this.drag.moved;   // a real pull, or a plain click
      this.drag = null;
      if (pulled) this.pull();
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', () => { this.drag = null; });
    button.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.stretch = 40; this.pull(); } });
  }
  pull() { this.wv += (Math.random() < .5 ? -1 : 1) * 2.2; this.onToggle(); this.moving = true; }
  // spring the cord back and let the lamp swing to rest
  update(dt) {
    const s = dt / 1000;
    if (!this.drag) { this.sv = (this.sv + -this.stretch * 140 * s) * Math.exp(-s * 7); this.stretch += this.sv * s; }
    this.wv = (this.wv + -this.swing * 38 * s) * Math.exp(-s * 2.4); this.swing += this.wv * s;
    this.moving = this.drag || Math.abs(this.stretch) > .3 || Math.abs(this.sv) > .5 || Math.abs(this.swing) > .002 || Math.abs(this.wv) > .01;
    return this.moving;
  }
  // lamp + cord drawn in ink, hanging from (x, 0); the bead button follows the cord's end
  draw(ink, x, dark, scale = 1) {
    const L = 118 * scale, a = this.swing, px = x, py = 0;
    const lampY = 36 * scale, lx = px + Math.sin(a) * lampY, ly = py + Math.cos(a) * lampY;
    const c = ink.x;
    // the flex it hangs from
    ink.stroke([[px, py], [lx, ly]], { w: 1.6, key: 'flex', wob: .3 });
    // shade: a little trapezoid, rotated with the swing
    const R = (u, v) => [lx + Math.cos(a) * u + Math.sin(a) * v, ly - Math.sin(a) * u + Math.cos(a) * v];
    const shade = [R(-9 * scale, 0), R(9 * scale, 0), R(24 * scale, 26 * scale), R(-24 * scale, 26 * scale)];
    if (dark) {   // the lit bulb throws a soft pool of light
      const [gx, gy] = R(0, 30 * scale), g = c.createRadialGradient(gx, gy, 0, gx, gy, 220 * scale);
      g.addColorStop(0, 'rgba(255,214,140,.32)'); g.addColorStop(1, 'rgba(255,214,140,0)');
      c.fillStyle = g; c.fillRect(gx - 240 * scale, gy - 40, 480 * scale, 300 * scale);
      c.fillStyle = '#FFE3A3'; c.beginPath(); c.arc(gx, gy - 2 * scale, 6 * scale, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = dark ? '#E9D6A8' : '#3E6B55'; c.beginPath(); shade.forEach(([u, v], i) => i ? c.lineTo(u, v) : c.moveTo(u, v)); c.closePath(); c.fill();
    ink.stroke([...shade, shade[0]], { w: 1.5, key: 'shade', wob: .4 });
    // the pull cord from one side of the shade, stretched by the drag
    const [cx0, cy0] = R(16 * scale, 22 * scale), end = [cx0 + Math.sin(a * 1.4) * L * .35, cy0 + L + this.stretch];
    ink.stroke([[cx0, cy0], [(cx0 + end[0]) / 2 + Math.sin(a) * 6, (cy0 + end[1]) / 2], end], { w: 1.2, key: 'cordpull', wob: .4 });
    c.fillStyle = dark ? '#E9D6A8' : '#D97757'; c.beginPath(); c.ellipse(end[0], end[1] + 7 * scale, 5.5 * scale, 8 * scale, 0, 0, Math.PI * 2); c.fill();
    ink.ellipse(end[0], end[1] + 7 * scale, 5.5 * scale, 8 * scale, { w: 1.2, key: 'bead', wob: .3 });
    this.b.style.transform = `translate(${end[0] - 22}px, ${end[1] - 12}px)`;
    this.bead = [end[0], end[1] + 7 * scale];
  }
}
