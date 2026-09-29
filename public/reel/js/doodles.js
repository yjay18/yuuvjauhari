// doodles.js: faint pencil doodles behind the page, at three depths that drift at different speeds as you scroll.
// Each chapter has its own little set (gears and bulbs by the products, graphs and neurons by the research...).
import { rng } from './ink.js';

const TAU = Math.PI * 2;
const pts = (n, f) => Array.from({ length: n + 1 }, (_, i) => f(i / n));

// each doodle draws around (0, 0) at size s through a pencil stroke function
const D = {
  star: (p, s) => { const P = pts(10, k => { const a = -Math.PI / 2 + k * TAU, r = (Math.round(k * 10) % 2 ? .45 : 1) * s; return [Math.cos(a) * r, Math.sin(a) * r]; }); p(P); },
  spiral: (p, s) => p(pts(40, k => [Math.cos(k * 14) * s * k, Math.sin(k * 14) * s * k])),
  arrow: (p, s) => { p(pts(12, k => [-s + k * 2 * s, Math.sin(k * 3) * s * .25])); p([[s * .6, -s * .35], [s, 0], [s * .6, s * .4]]); },
  plane: (p, s) => { p([[-s, 0], [s, -s * .3], [-s * .2, s * .15], [-s, 0]]); p([[-s * .2, s * .15], [-s * .35, s * .6], [s, -s * .3]]); },
  gear: (p, s) => { p(pts(48, k => { const a = k * TAU, r = s * (Math.sin(a * 8) > .2 ? 1 : .78); return [Math.cos(a) * r, Math.sin(a) * r]; })); p(pts(16, k => [Math.cos(k * TAU) * s * .3, Math.sin(k * TAU) * s * .3])); },
  bulb: (p, s) => { p(pts(24, k => { const a = Math.PI * .75 + k * Math.PI * 1.5; return [Math.cos(a) * s * .7, -s * .2 + Math.sin(a) * s * .7]; })); p([[-s * .3, s * .45], [s * .3, s * .45]]); p([[-s * .25, s * .65], [s * .25, s * .65]]); for (const a of [-2.4, -1.57, -.7]) p([[Math.cos(a) * s * .95, -s * .2 + Math.sin(a) * s * .95], [Math.cos(a) * s * 1.25, -s * .2 + Math.sin(a) * s * 1.25]]); },
  rocket: (p, s) => { p([[0, -s], [s * .35, -s * .3], [s * .35, s * .5], [-s * .35, s * .5], [-s * .35, -s * .3], [0, -s]]); p([[s * .35, s * .2], [s * .6, s * .7], [s * .35, s * .5]]); p([[-s * .35, s * .2], [-s * .6, s * .7], [-s * .35, s * .5]]); p(pts(12, k => [Math.cos(k * TAU) * s * .14, -s * .25 + Math.sin(k * TAU) * s * .14])); },
  graph: (p, s) => { p([[-s, -s], [-s, s * .8], [s, s * .8]]); p(pts(16, k => [-s * .85 + k * s * 1.8, s * .5 - Math.pow(k, 1.6) * s * 1.2 + Math.sin(k * 9) * s * .08])); },
  neurons: (p, s) => { const N = [[-s, -s * .5], [-s, s * .5], [0, -s * .7], [0, 0], [0, s * .7], [s, 0]]; for (const [a, b] of [[0, 2], [0, 3], [1, 3], [1, 4], [2, 5], [3, 5], [4, 5]]) p([N[a], N[b]]); for (const [x, y] of N) p(pts(10, k => [x + Math.cos(k * TAU) * s * .13, y + Math.sin(k * TAU) * s * .13])); },
  box: (p, s) => { p([[-s, -s * .6], [s, -s * .6], [s, s * .6], [-s, s * .6], [-s, -s * .6]]); p([[-s, -s * .6], [-s * .5, -s], [s * 1.5, -s], [s, -s * .6]]); p([[s * 1.5, -s], [s * 1.5, s * .2], [s, s * .6]]); },
  squiggle: (p, s) => p(pts(30, k => [-s + k * 2 * s, Math.sin(k * 18) * s * .25])),
  cap: (p, s) => { p([[-s, 0], [0, -s * .45], [s, 0], [0, s * .45], [-s, 0]]); p([[-s * .55, s * .2], [-s * .55, s * .65], [s * .55, s * .65], [s * .55, s * .2]]); p([[s * .8, s * .1], [s * .8, s * .75]]); },
  book: (p, s) => { p([[0, -s * .6], [-s, -s * .75], [-s, s * .6], [0, s * .75], [s, s * .6], [s, -s * .75], [0, -s * .6], [0, s * .75]]); p([[-s * .75, -s * .35], [-s * .2, -s * .28]]); p([[s * .2, -s * .28], [s * .75, -s * .35]]); },
  heart: (p, s) => p(pts(36, k => { const t = k * TAU; return [s * .06 * 16 * Math.pow(Math.sin(t), 3), -s * .06 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]; })),
  envelope: (p, s) => { p([[-s, -s * .6], [s, -s * .6], [s, s * .6], [-s, s * .6], [-s, -s * .6]]); p([[-s, -s * .6], [0, s * .1], [s, -s * .6]]); },
  cloud: (p, s) => p(pts(36, k => { const a = k * TAU, r = s * (.55 + .18 * Math.abs(Math.sin(a * 3))); return [Math.cos(a) * r * 1.5, Math.sin(a) * r * .8]; })),
};
const SETS = {
  hero: ['star', 'spiral', 'cloud', 'squiggle', 'plane'],
  shipped: ['gear', 'bulb', 'rocket', 'arrow', 'star'],
  research: ['graph', 'neurons', 'book', 'spiral', 'bulb'],
  work: ['box', 'arrow', 'gear', 'squiggle', 'graph'],
  education: ['cap', 'book', 'star', 'spiral', 'bulb'],
  more: ['gear', 'box', 'arrow', 'squiggle', 'rocket'],
  contact: ['heart', 'envelope', 'plane', 'star', 'cloud'],
};

export class Doodles {
  constructor(canvas) {
    this.c = canvas; this.x = canvas.getContext('2d'); this.items = []; this.docH = 0;
    this.resize(); addEventListener('resize', () => this.resize());
  }
  resize() {
    this.dpr = Math.min(2, devicePixelRatio || 1); this.w = innerWidth; this.h = innerHeight;
    this.c.width = Math.round(this.w * this.dpr); this.c.height = Math.round(this.h * this.dpr); this.layout();
  }
  // scatter doodles down the whole page, themed by the chapter at that height, avoiding his lane on desktop
  layout() {
    const R = rng(7), docH = document.documentElement.scrollHeight, secs = [...document.querySelectorAll('.hero, .chapter, .contact')];
    const at = y => { let id = 'hero'; for (const s of secs) { const top = s.getBoundingClientRect().top + scrollY; if (top <= y) id = s.id || (s.classList.contains('contact') ? 'contact' : 'hero'); } return SETS[id] ? id : 'hero'; };
    const laneW = innerWidth < 900 ? 0 : document.getElementById('lane').offsetWidth;
    this.items = []; this.docH = docH;
    for (let y = 120; y < docH; y += 150) {
      const set = SETS[at(y)];
      for (let k = 0; k < 2; k++) {
        const depth = [.55, .75, 1][Math.floor(R() * 3)];
        this.items.push({ kind: set[Math.floor(R() * set.length)], x: laneW + 20 + R() * (innerWidth - laneW - 40), y: y + R() * 140, s: (14 + R() * 16) * (.6 + depth * .5), depth, rot: (R() - .5) * .8, seed: Math.floor(R() * 1e6) });
      }
    }
  }
  draw(boil, dark, still) {
    const x = this.x, sy = scrollY, H = this.h;
    if (document.documentElement.scrollHeight !== this.docH) this.layout();
    x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); x.clearRect(0, 0, this.w, H);
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (const d of this.items) {
      // farther doodles scroll slower than the page (parallax), and are fainter
      const y = d.y - sy * d.depth - (1 - d.depth) * H * .2;
      if (y < -60 || y > H + 60) continue;
      const r = rng(d.seed + (still ? 0 : boil) * 131), wob = 1.1;
      const pencil = P => {
        x.beginPath();
        P.forEach(([u, v], i) => { const px = d.x + (u * Math.cos(d.rot) - v * Math.sin(d.rot)) + (r() - .5) * wob, py = y + (u * Math.sin(d.rot) + v * Math.cos(d.rot)) + (r() - .5) * wob; i ? x.lineTo(px, py) : x.moveTo(px, py); });
        x.stroke();
      };
      x.strokeStyle = dark ? `rgba(230,220,205,${.09 + d.depth * .07})` : `rgba(70,62,78,${.1 + d.depth * .09})`;
      x.lineWidth = .8 + d.depth * .5;
      D[d.kind](pencil, d.s);
    }
  }
}
