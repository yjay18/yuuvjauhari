// world.js: the lane he walks in. The sky runs from morning at the top of the page to night at the bottom, and
// painted props from the current chapter slide past behind him as he walks.
import { rng } from './ink.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const hash = i => { const r = rng(i * 9301 + 49297); return r(); };

// sky colour stops over the page: [phase, top, bottom]
const SKY = [[0, '#CFE2EA', '#F4EBDD'], [.3, '#BCDCEB', '#F3EBDC'], [.55, '#F2C98E', '#F6E2C2'], [.7, '#9C7BA6', '#E9A98F'], [.85, '#2B2F5A', '#51507A'], [1, '#1E2248', '#3A3C66']];
function skyAt(p) {
  let i = 0; while (i < SKY.length - 2 && p > SKY[i + 1][0]) i++;
  const [p0, t0, b0] = SKY[i], [p1, t1, b1] = SKY[i + 1], k = clamp((p - p0) / (p1 - p0));
  return [mix(hex(t0), hex(t1), k), mix(hex(b0), hex(b1), k)];
}
// a faint wash over the page itself, so the paper warms at dusk and cools at night (text is never touched)
export function pageTint(p) {
  if (p < .5) return 'transparent';
  if (p < .78) return css([240, 168, 118], .08 * clamp((p - .5) / .15));
  return css([44, 48, 96], .1 * clamp((p - .78) / .12));
}

export function drawSky(ink, { x0, x1, y0, y1, p, now, phone }) {
  const x = ink.x, [top, bot] = skyAt(p), W = x1 - x0, H = y1 - y0;
  x.save();
  const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, css(top, .78)); g.addColorStop(1, css(bot, .6));
  x.fillStyle = g; x.fillRect(x0, y0, W, H);
  // feather the edge that meets the page
  x.globalCompositeOperation = 'destination-out';
  const f = phone ? x.createLinearGradient(0, y0, 0, y0 + 60) : x.createLinearGradient(x1 - 70, 0, x1, 0);
  f.addColorStop(0, phone ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0)'); f.addColorStop(1, phone ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,1)');
  x.fillStyle = f; phone ? x.fillRect(x0, y0, W, 60) : x.fillRect(x1 - 70, y0, 70, H);
  x.restore();
  const cream = '#FFF5E2';

  // clouds by day, fading out by dusk
  const cloudA = 1 - clamp((p - .55) / .2);
  if (cloudA > 0) for (let i = 0; i < 3; i++) {
    const cx = x0 + ((hash(i + 3) * W + now * .006 * (i + 1)) % (W + 160)) - 80, cy = y0 + H * (.1 + i * .09);
    const P = []; for (let a = 0; a <= 20; a++) { const t = a / 20 * Math.PI * 2, r = 1 + .18 * Math.abs(Math.sin(t * 3 + i)); P.push([cx + Math.cos(t) * 46 * r, cy + Math.sin(t) * 15 * r]); }
    x.globalAlpha = .75 * cloudA; x.fillStyle = cream; x.beginPath(); P.forEach(([a, b], j) => j ? x.lineTo(a, b) : x.moveTo(a, b)); x.fill(); x.globalAlpha = 1;
    ink.stroke(P, { w: 1.1, key: 'cloud' + i, alpha: .45 * cloudA, wob: .8 });
  }
  // the sun arcs down and sets behind the ground by dusk; the moon rises after
  const sp = clamp(p / .68);
  if (sp < 1) {
    const sx = x0 + W * (.72 - .3 * sp), sy = y0 + H * (.1 + .78 * Math.pow(sp, 1.6)), r = phone ? 16 : 26;
    const glow = x.createRadialGradient(sx, sy, 0, sx, sy, r * 4); glow.addColorStop(0, 'rgba(255,214,122,.55)'); glow.addColorStop(1, 'rgba(255,214,122,0)');
    x.fillStyle = glow; x.fillRect(sx - r * 4, sy - r * 4, r * 8, r * 8);
    x.fillStyle = sp > .7 ? '#F6A96B' : '#FBD77E'; x.beginPath(); x.arc(sx, sy, r, 0, Math.PI * 2); x.fill();
    ink.ellipse(sx, sy, r, r, { w: 1.4, key: 'sun', wob: .6 });
  }
  const mp = clamp((p - .66) / .22);
  if (mp > 0) {
    const mx = x0 + W * .3, my = y0 + H * (.8 - .62 * mp), r = phone ? 13 : 20;
    x.fillStyle = cream; x.beginPath(); x.arc(mx, my, r, 0, Math.PI * 2); x.fill();
    x.fillStyle = css(skyAt(p)[0], 1); x.beginPath(); x.arc(mx + r * .45, my - r * .2, r * .85, 0, Math.PI * 2); x.fill();   // the crescent's shadow
    ink.stroke(Array.from({ length: 17 }, (_, i) => { const a = Math.PI * .35 + i / 16 * Math.PI * 1.3; return [mx + Math.cos(a) * r, my + Math.sin(a) * r]; }), { w: 1.2, key: 'moon', col: cream, wob: .5 });
  }
  // stars, twinkling on the boil
  const sa = clamp((p - .68) / .15);
  if (sa > 0) for (let i = 0; i < (phone ? 10 : 18); i++) {
    const sx = x0 + 10 + hash(i) * (W - 30), sy = y0 + 20 + hash(i + 40) * H * .5, tw = .5 + .5 * Math.sin(now / 300 + i * 2.1);
    const s = 2 + hash(i + 80) * 3;
    ink.stroke([[sx - s, sy], [sx + s, sy]], { w: 1.1, key: 'st' + i, col: cream, alpha: sa * tw, dry: false, wob: .3 });
    ink.stroke([[sx, sy - s], [sx, sy + s]], { w: 1.1, key: 'sv' + i, col: cream, alpha: sa * tw, dry: false, wob: .3 });
  }
}

// ---------------------------------------------------------------- scenery
const SETS = {
  street: ['prop_lamppost', 'prop_bench', 'prop_hydrant'],
  research: ['prop_books', 'prop_floorlamp', 'prop_globe'],
  work: ['prop_door', 'prop_plant', 'prop_cooler'],
  campus: ['prop_gate', 'prop_bike', 'prop_tree'],
  shelf: ['prop_shelf', 'prop_boxes'],
  night: ['prop_desk'],
};
const CHAPTER_SET = { hero: 'street', shipped: 'street', research: 'research', work: 'work', education: 'campus', more: 'shelf', contact: 'night' };

export class Scenery {
  constructor(manifest, base = 'art/') {
    this.m = manifest; this.base = base; this.img = {}; this.kinds = new Map();
    for (const n of Object.keys(manifest)) if (n.startsWith('prop_')) { const i = new Image(); i.src = `${base}${n}.webp`; this.img[n] = i; }
  }
  // props sit on the ground line and slide by as he walks (same rate as the ground doodles)
  draw(ink, { x0, x1, groundY, walk, scale, chapter, night, avoidX }) {
    const spacing = 470 * scale, off = walk * .55, first = Math.floor(off / spacing) - 1;
    // props are painted on their own layer so they can fade out toward the page instead of stopping at a hard edge
    const dpr = ink.dpr, W = Math.ceil(x1 - x0 + 2), H = Math.ceil(groundY + 14);
    if (!this.off) { this.off = document.createElement('canvas'); }
    if (this.off.width !== Math.ceil(W * dpr) || this.off.height !== Math.ceil(H * dpr)) { this.off.width = Math.ceil(W * dpr); this.off.height = Math.ceil(H * dpr); }
    const main = ink.x, o = this.off.getContext('2d');
    o.setTransform(dpr, 0, 0, dpr, -x0 * dpr, 0); o.clearRect(x0, 0, W, H);
    ink.x = o;
    for (let n = first; n < first + Math.ceil((x1 - x0) / spacing) + 3; n++) {
      if (!this.kinds.has(n)) {
        const set = SETS[CHAPTER_SET[chapter] || 'street'], r = hash(n + 1000);
        this.kinds.set(n, r < .25 ? null : set[Math.floor(hash(n + 2000) * set.length)]);
      }
      let kind = this.kinds.get(n); if (!kind) continue;
      if (kind === 'prop_desk') kind = night ? 'prop_desk_on' : 'prop_desk_off';
      const m = this.m[kind], im = this.img[kind]; if (!m || !im?.complete || !im.naturalWidth) continue;
      const sx = x0 + n * spacing - off + spacing * .5;
      if (sx < x0 - m.w * scale || sx > x1 + m.w * scale) continue;
      const f = ink.boil % m.frames, cols = m.cols || m.frames, fx = (f % cols) * m.w, fy = Math.floor(f / cols) * m.h;
      const [ax, ay] = m.anchor || [m.w / 2, m.h];
      // a prop right behind him fades a little so he stays readable
      ink.x.globalAlpha = Math.abs(sx - avoidX) < 60 * scale ? .55 : .95;
      ink.x.drawImage(im, fx, fy, m.w, m.h, sx - ax * scale, groundY - ay * scale, m.w * scale, m.h * scale);
      ink.x.globalAlpha = 1;
    }
    o.setTransform(dpr, 0, 0, dpr, -x0 * dpr, 0); o.globalCompositeOperation = 'destination-out';
    const f = o.createLinearGradient(x1 - 90, 0, x1, 0); f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,1)');
    o.fillStyle = f; o.fillRect(x1 - 90, 0, 92, H); o.globalCompositeOperation = 'source-over';
    ink.x = main;
    main.save(); main.setTransform(1, 0, 0, 1, 0, 0); main.drawImage(this.off, Math.round(x0 * dpr), 0); main.restore();
  }
}
