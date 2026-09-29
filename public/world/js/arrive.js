// arrive.js: arriving from the portfolio's 3D door. The portfolio left the screen covered in night-blue voxel cubes;
// here the same grid of cubes falls away, from the middle outward, onto the loading island (or the town, if it's ready). The head of index.html has
// already painted the screen that colour (html.arriving-3d), so there is no flash between the two pages.
const html = document.documentElement;
if (html.classList.contains('arriving-3d')) {
  const c = document.createElement('canvas');
  Object.assign(c.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '60', pointerEvents: 'none' });
  document.body.append(c);
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  c.width = W * dpr; c.height = H * dpr;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const S = Math.max(34, Math.round(Math.min(W, H) / 16)), cols = Math.ceil(W / S), rows = Math.ceil(H / S);
  const ox = W / 2, oy = H / 2, far = Math.hypot(ox, oy), tiles = [];
  for (let j = 0; j < rows; j += 1) for (let i = 0; i < cols; i += 1) {
    const x = i * S, y = j * S, h = Math.abs(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1;
    tiles.push({ x, y, d: (Math.hypot(x + S / 2 - ox, y + S / 2 - oy) / far) * 620 + h * 140, glow: h < 0.07, tone: h, spin: (h - 0.5) * 1.6 });
  }
  const draw = (t) => {
    g.clearRect(0, 0, W, H);
    let left = 0;
    for (const q of tiles) {
      const k = Math.min(1, Math.max(0, (t - q.d) / 520));
      if (k >= 1) continue;
      left += 1;
      const e = k * k, fall = e * H * 0.6, s = S * (1 - 0.35 * e);   // each cube tips and drops out of the sky
      g.save();
      g.globalAlpha = 1 - e;
      g.translate(q.x + S / 2, q.y + S / 2 + fall);
      g.rotate(q.spin * e);
      g.fillStyle = q.glow ? '#1d7f96' : q.tone < 0.5 ? '#1b1830' : '#221e3a'; g.fillRect(-s / 2, -s / 2, s, s);
      g.fillStyle = q.glow ? '#6ff2ff' : '#2e2a4d'; g.fillRect(-s / 2, -s / 2, s, s * 0.16);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(s / 2 - s * 0.14, -s / 2, s * 0.14, s);
      g.restore();
    }
    return left;
  };
  draw(0);
  html.classList.remove('arriving-3d');   // the canvas holds the cover now
  const start = () => {
    const t0 = performance.now();
    const frame = (now) => { if (draw(now - t0) > 0) requestAnimationFrame(frame); else c.remove(); };
    requestAnimationFrame(frame);
  };
  // the cubes fall straight away: underneath, the loading screen's island builds itself while the town does, then
  // zooms into it, so the wait is part of the journey rather than a pause
  setTimeout(start, 150);
}
