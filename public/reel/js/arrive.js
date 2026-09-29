// arrive.js: the far side of the portfolio's 2D door. index.html's head saw sessionStorage 'yj-arrive' = '2d' and keeps
// the screen black (html.arriving). Once this page has drawn, a closed sketchbook lies in the dark, its elastic slips off,
// the cover swings open on its hinge and the camera pushes into the first page, which is this site, live: the page is
// the whole body, moved as one piece (html.book), while main.js holds the ink still. Any click, scroll or key skips it.
import { profile } from '../data.js';

const root = document.documentElement, body = document.body;
if (root.classList.contains('arriving')) arrive();

async function arrive() {
  const SKIP = ['pointerdown', 'wheel', 'touchstart', 'keydown'], parts = [];
  let anims = [], done = false;
  const end = () => {
    if (done) return; done = true;
    anims.forEach(a => a.cancel()); parts.forEach(p => p.remove());
    root.classList.remove('arriving', 'book');
    SKIP.forEach(t => removeEventListener(t, end, true));
  };
  SKIP.forEach(t => addEventListener(t, end, { capture: true, passive: true }));
  if (!body.animate) return end();
  // in the dark, wait for the site's first frame of ink and the cover's lettering, but not for long
  const drawn = new Promise(ok => { const f = () => root.classList.contains('drawn') ? ok() : requestAnimationFrame(f); f(); });
  await Promise.race([Promise.all([drawn, document.fonts?.load('700 1em Caveat')]), new Promise(ok => setTimeout(ok, 1500))]);
  if (done) return;

  const W = innerWidth, H = innerHeight, k = W > H ? .46 : .6;   // the closed book's size, as a share of the screen
  const under = Object.assign(document.createElement('div'), { id: 'book-under', innerHTML: '<i class="block"></i><i class="edges"></i>' });
  const book = Object.assign(document.createElement('div'), { id: 'book', innerHTML: '<i class="shadow"></i><div class="lid">' +
    `<div class="front"><b class="title">${profile.name}<svg viewBox="0 0 400 24" preserveAspectRatio="none"><path d="M6 15 C 80 6, 150 20, 230 12 S 350 7, 394 14"/></svg></b><i class="band"></i><i class="shade"></i></div>` +
    '<div class="inside"><i class="shade"></i></div></div>' });
  const clover = document.querySelector('.hero .clover')?.cloneNode(true);
  if (clover) book.querySelector('.band').before(clover);
  for (const p of [under, book]) { p.setAttribute('aria-hidden', 'true'); body.append(p); parts.push(p); }
  book.style.perspective = `${Math.round(Math.max(W, H) * 2.2)}px`;
  root.classList.add('book');

  const $ = s => book.querySelector(s), o = { duration: 1600, fill: 'both' }, P = Math.round(Math.max(W, H) * 1.5);
  const cam = (s, rx, x, y) => `translate(${x}px, ${y}px) perspective(${P}px) rotateX(${rx}deg) scale(${s})`;
  const swing = 'cubic-bezier(.5, 0, .25, 1)';
  anims = [
    // the camera: the book rises out of the dark, drifts after the opening cover, then pushes in until the page is the screen
    body.animate([
      { offset: 0, opacity: 0, transform: cam(k * .9, 26, 0, H * .07), easing: 'cubic-bezier(.2, .7, .3, 1)' },
      { offset: .17, opacity: 1, transform: cam(k, 18, 0, 0), easing: 'ease-in-out' },
      { offset: .5, opacity: 1, transform: cam(k * 1.06, 12, W * k * .24, 0), easing: 'cubic-bezier(.6, 0, .15, 1)' },
      { offset: 1, opacity: 1, transform: cam(1, 0, 0, 0) },
    ], o),
    // the elastic is pulled off the fore edge
    $('.band').animate([
      { offset: 0, transform: 'none', opacity: 1 },
      { offset: .13, transform: 'none', opacity: 1, easing: 'cubic-bezier(.55, 0, .8, .3)' },
      { offset: .24, transform: 'translateX(16vw) scaleX(1.6)', opacity: 0 },
      { offset: 1, transform: 'translateX(16vw) scaleX(1.6)', opacity: 0 },
    ], o),
    // the cover swings over on its hinge, darkening as it turns from the light, and its inside lightens as it lands
    $('.lid').animate(hinge('transform', 'rotateY(0deg)', 'rotateY(-180deg)'), o),
    $('.front .shade').animate(hinge('opacity', 0, .8), o),
    $('.inside .shade').animate(hinge('opacity', .8, .22), o),
    // the page under it starts in the cover's shadow
    $('.shadow').animate([{ offset: 0, opacity: 1 }, { offset: .23, opacity: 1, easing: 'ease-out' }, { offset: .45, opacity: .45 }, { offset: .85, opacity: 0 }, { offset: 1, opacity: 0 }], o),
  ];
  function hinge(prop, a, b) {
    return [{ offset: 0, [prop]: a }, { offset: .23, [prop]: a, easing: swing }, { offset: .62, [prop]: b }, { offset: 1, [prop]: b }];
  }
  anims[0].finished.then(end, () => {});
}
