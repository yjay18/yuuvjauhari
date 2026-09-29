// ink.js: the live ink layer. One fixed canvas over the page. Every stroke is re-jittered from a seed that changes 12
// times a second (the boil), so the live lines wobble exactly like the painted frames of the character.
export const INK = '#2B2233', SAGE = '#3E6B55', CLAY = '#D97757';

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

export class Ink {
  constructor(canvas) {
    this.c = canvas; this.x = canvas.getContext('2d'); this.boil = 0; this.still = false;
    this.theme = { ink: INK, sage: SAGE, paper: '#F3EBDC' };   // swapped for dark mode
    this.resize(); addEventListener('resize', () => this.resize());
  }
  resize() {
    this.dpr = Math.min(2, devicePixelRatio || 1); this.w = innerWidth; this.h = innerHeight;
    this.c.width = Math.round(this.w * this.dpr); this.c.height = Math.round(this.h * this.dpr);
  }
  begin(boil) {
    this.boil = this.still ? 0 : boil;
    const x = this.x; x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); x.clearRect(0, 0, this.w, this.h);
    x.lineCap = 'round'; x.lineJoin = 'round';
  }
  rand(key) { return rng(hashStr(key) + this.boil * 7919); }

  // A wobbly brush stroke through P, drawn up to fraction k of its length. Width swells in the middle and tapers at
  // both ends; a thinner offset pass on top gives the dry, bristly edge of real ink.
  stroke(P, { w = 2, col = this.theme.ink, alpha = 1, k = 1, key = 'ink', wob = 1.1, dry = true } = {}) {
    if (k <= 0 || alpha <= 0 || P.length < 2) return null;
    const r = this.rand(key), J = P.map(([x, y]) => [x + (r() - .5) * 2 * wob, y + (r() - .5) * 2 * wob]);
    // resample every ~7px so the taper and the cut at k are smooth
    const S = [J[0]];
    for (let i = 1; i < J.length; i++) {
      const [ax, ay] = J[i - 1], [bx, by] = J[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 7));
      for (let j = 1; j <= n; j++) S.push([ax + (bx - ax) * j / n, ay + (by - ay) * j / n]);
    }
    const L = [0]; for (let i = 1; i < S.length; i++) L.push(L[i - 1] + Math.hypot(S[i][0] - S[i - 1][0], S[i][1] - S[i - 1][1]));
    const total = L[L.length - 1], end = total * clamp(k);
    const x = this.x; x.globalAlpha = alpha; x.strokeStyle = col;
    let pen = S[0];
    for (let pass = 0; pass < (dry ? 2 : 1); pass++) {
      const off = pass ? (r() - .5) * w * .8 : 0, pw = pass ? .42 : 1;
      if (pass) x.globalAlpha = alpha * .55;
      for (let i = 1; i < S.length && L[i - 1] < end; i++) {
        let [bx, by] = S[i]; const [ax, ay] = S[i - 1];
        if (L[i] > end) { const f = (end - L[i - 1]) / (L[i] - L[i - 1]); bx = ax + (bx - ax) * f; by = ay + (by - ay) * f; }
        const u = L[i] / total, taper = .35 + .65 * Math.sin(Math.PI * clamp(u * .92 + .04));
        x.lineWidth = Math.max(.6, w * pw * taper * (.85 + r() * .3));
        x.beginPath(); x.moveTo(ax + off, ay + off); x.lineTo(bx + off, by + off); x.stroke();
        if (!pass) pen = [bx, by];
      }
    }
    x.globalAlpha = 1;
    return pen;
  }

  // A sketched rectangle: four edges drawn one after another (k 0..1), each overshooting its corner a little.
  box(x0, y0, w, h, o = {}) {
    const ov = o.over ?? 5, E = [
      [[x0 - ov, y0], [x0 + w + ov, y0]], [[x0 + w, y0 - ov], [x0 + w, y0 + h + ov]],
      [[x0 + w + ov, y0 + h], [x0 - ov, y0 + h]], [[x0, y0 + h + ov], [x0, y0 - ov]]];
    let pen = null;
    E.forEach((e, i) => { const p = this.stroke(e, { ...o, k: (o.k ?? 1) * 4 - i, key: (o.key || 'box') + i }); if (p) pen = p; });
    return pen;
  }
  // A handwriting-ish scribble filling a line of text: small loops marching right.
  scribble(x0, y0, w, h, o = {}) {
    const r = this.rand((o.key || 'scr') + 'shape'), P = [], n = Math.max(3, Math.round(w / (h * .55)));
    for (let i = 0; i <= n; i++) P.push([x0 + w * i / n, y0 + h * (i % 2 ? .15 + r() * .2 : .75 + r() * .2)]);
    return this.stroke(P, { wob: 1.4, ...o });
  }
  // Diagonal hatching inside a box, revealed left to right.
  hatch(x0, y0, w, h, o = {}) {
    const x = this.x, gap = o.gap || 11, k = o.k ?? 1; x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip();
    const n = Math.ceil((w + h) / gap); let pen = null;
    for (let i = 0; i < n * k; i++) { const d = i * gap; pen = this.stroke([[x0 + d, y0], [x0 + d - h, y0 + h]], { w: 1.1, wob: 1.6, dry: false, ...o, k: 1, key: (o.key || 'h') + i }); }
    x.restore(); return pen;
  }
  ellipse(cx, cy, rx, ry, o = {}) {
    const P = []; for (let i = 0; i <= 26; i++) { const a = -Math.PI / 2 + i / 24 * Math.PI * 2; P.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return this.stroke(P, o);
  }
  // A fat dry-brush swash (chapter underlines): several bristle strokes side by side.
  swash(x0, y, w, o = {}) {
    const r = this.rand((o.key || 'sw') + 'b'), n = o.bristles || 6, th = o.th || 10;
    for (let b = 0; b < n; b++) {
      const dy = (b / (n - 1) - .5) * th, P = [];
      for (let i = 0; i <= 8; i++) P.push([x0 + w * i / 8, y + dy + Math.sin(i * .9 + b) * 1.6 + (i === 8 ? (r() - .5) * 6 : 0)]);
      this.stroke(P, { w: 2.2 + r() * 2, col: o.col || this.theme.sage, alpha: (o.alpha ?? .85) * (.6 + r() * .4), k: (o.k ?? 1) * (1.05 - b * .02), key: (o.key || 'sw') + b, wob: .9, dry: false });
    }
  }
  // A curved arrow with a hand-drawn head.
  arrow(a, b, o = {}) {
    const mx = (a[0] + b[0]) / 2 + (o.bend ?? -.25) * (b[1] - a[1]), my = (a[1] + b[1]) / 2 - (o.bend ?? -.25) * (b[0] - a[0]);
    const P = []; for (let i = 0; i <= 16; i++) { const t = i / 16, u = 1 - t; P.push([u * u * a[0] + 2 * u * t * mx + t * t * b[0], u * u * a[1] + 2 * u * t * my + t * t * b[1]]); }
    const pen = this.stroke(P, { w: 1.8, ...o });
    if ((o.k ?? 1) >= .98) {
      const [px, py] = P[14], ang = Math.atan2(b[1] - py, b[0] - px), s = 13;
      for (const d of [-.5, .5]) this.stroke([[b[0] - Math.cos(ang + d) * s, b[1] - Math.sin(ang + d) * s], b], { w: 1.8, ...o, k: 1, key: (o.key || 'ar') + d });
    }
    return pen;
  }
  dot(x, y, r, o = {}) { const g = this.rand((o.key || 'dot') + 'd'); this.x.fillStyle = o.col || this.theme.ink; this.x.globalAlpha = o.alpha ?? 1; this.x.beginPath(); this.x.ellipse(x + (g() - .5), y + (g() - .5), r * (.9 + g() * .2), r * (.9 + g() * .2), g() * 3, 0, Math.PI * 2); this.x.fill(); this.x.globalAlpha = 1; }
}

// The harden mask: opaque left third, a dry-brush edge through the middle third, clear right third. Used as a CSS
// mask at 300% width; sliding it from 100% to 0% paints the element in with brush strokes.
export function makeWipe() {
  const W = 1500, H = 420, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), r = rng(42);
  x.fillStyle = '#000'; x.fillRect(0, 0, W * .36, H);
  x.lineCap = 'round';
  const bands = 11;
  for (let b = 0; b < bands; b++) {
    const y = (b + .5) / bands * H, len = W * (.1 + r() * .16), x0 = W * .3;
    for (let k = 0; k < 26; k++) {
      const yy = y + (r() - .5) * H / bands * 1.5, l = len * (.55 + r() * .45);
      x.globalAlpha = .55 + r() * .45; x.lineWidth = 3 + r() * 9; x.strokeStyle = '#000';
      x.beginPath(); x.moveTo(x0, yy); x.quadraticCurveTo(x0 + l * .5, yy + (r() - .5) * 10, x0 + l, yy + (r() - .5) * 16); x.stroke();
    }
  }
  x.globalAlpha = 1;
  return c.toDataURL('image/png');
}
