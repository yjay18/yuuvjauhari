// main.js: builds the page from data.js, turns scroll into paper being pulled off each project, directs painted Yuuv, draws the ink.
import { profile, chapters } from '../data.js';
import { Guide } from './guide.js';
import { Ink, INK, SAGE, makeWipe } from './ink.js';
import { makeCover } from './cover.js';
import { drawSky, pageTint, Scenery } from './world.js';
import { Tidy } from './tidy.js';
import { Dragon } from './dragon.js';
import { Plane } from './plane.js';
import { Cord } from './cord.js';
import { Confetti } from './confetti.js';
import { Doodles } from './doodles.js';
import { PageTurn } from './turn.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PHONE = () => innerWidth < 900;
const $ = (s, r = document) => r.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = t => t * t * (3 - 2 * t);

function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
}
const hardHeading = (tag, text, id) => h(tag, { class: 'hard', id }, h('span', { class: 'hand', 'aria-hidden': 'true', text }), h('span', { class: 'crisp', text }));
const linkBtns = (links = [], primary = true) => links.map((l, i) =>
  h('a', { class: 'btn' + (primary && i === 0 ? ' primary' : ''), href: l.href, target: '_blank', rel: 'noreferrer', text: l.label + ' ↗' }));

// ---------------------------------------------------------------- build
function buildHero() {
  $('#name .hand').textContent = $('#name .crisp').textContent = profile.name;
  $('.hero .line').textContent = profile.line;
  $('.hero .sub').textContent = profile.sub;
  $('.hero .based span').textContent = profile.based || '';
  const mail = $('[data-email]'); mail.textContent = profile.email; mail.href = 'mailto:' + profile.email;
  $('[data-cv]').href = profile.cv; $('[data-github]').href = profile.github; $('[data-linkedin]').href = profile.linkedin;
  $('[data-recruiter]').href = profile.recruiterSite; $('.top .short').href = profile.recruiterSite;
}

let coverN = 0;
function cardEl(item, row) {
  const media = item.media
    ? h('div', { class: 'media', 'data-ink': 'media' },
        h('video', { muted: true, loop: true, playsinline: true, preload: 'none', poster: item.media.poster, 'aria-label': `${item.title} in use` },
          h('source', { src: item.media.webm, type: 'video/webm' }), h('source', { src: item.media.mp4, type: 'video/mp4' })),
        item.media.note ? h('span', { class: 'media-note', text: item.media.note }) : null)
    : item.metric ? h('div', { class: 'metric-big', 'data-ink': 'media' }, h('b', { text: item.metric.value }), h('span', { text: item.metric.label })) : null;
  const more = item.detail ? h('p', { class: 'more', text: item.detail }) : null;
  const openBtn = !row && (item.detail || item.tags) ? h('button', { class: 'btn', type: 'button', 'aria-expanded': 'false', 'data-open': true, text: 'More' }) : null;
  const txt = h('div', { class: 'txt' },
    h('p', { class: 'kicker', 'data-ink': 'kicker', text: item.kicker }),
    h('h3', { 'data-ink': 'title', text: item.title }),
    h('p', { class: 'blurb', 'data-ink': 'text', text: item.blurb }),
    more,
    item.tags && !row ? h('ul', { class: 'tags', 'data-ink': 'tags' }, item.tags.map(t => h('li', { text: t }))) : null,
    !row ? h('p', { class: 'actions' }, openBtn, linkBtns(item.links)) : null);
  const art = h('article', { class: 'card' + (row ? ' row' : ''), 'data-id': item.id }, h('div', { class: 'card-body' }, row ? null : media, txt));
  if (row) art.querySelector('.card-body').prepend(h('div', {}, h('h3', { 'data-ink': 'title', text: item.title })));
  if (row) txt.querySelector('h3').remove();
  if (!row) { const cv = makeCover(item, coverN % 2 ? 'tear' : 'peel', 17 + coverN * 31); coverN++; art.append(cv.root); art._cover = cv; }
  return row ? art : h('div', { class: 'pin' }, h('div', { class: 'pin-stage' }, art));
}

// a public repo as a paper index card taped to the page, each at its own slight tilt
function tileEl(item, i) {
  const rot = (((i * 37) % 7) - 3) * .45;
  return h('article', { class: 'tile', style: `--rot:${rot}deg` },
    h('p', { class: 'kicker', text: item.kicker }), h('h3', { text: item.title }), h('p', { class: 'blurb', text: item.blurb }),
    h('p', { class: 'tile-links' }, (item.links || []).map(l => h('a', { href: l.href, target: '_blank', rel: 'noreferrer', text: l.label + ' ↗' }))));
}

function buildChapters() {
  const root = $('#chapters');
  for (const ch of chapters) {
    const head = h('div', { class: 'chapter-head' }, hardHeading('h2', ch.title, `ch-${ch.id}`), ch.lede ? h('p', { class: 'lede', text: ch.lede }) : null);
    const gap = h('div', { class: 'turn-gap', 'aria-hidden': 'true', 'data-title': ch.title, 'data-lede': ch.lede || '' });
    const sec = h('section', { class: `chapter ${ch.layout === 'popup' ? 'popup' : 'col'}`, id: ch.id, 'aria-labelledby': `ch-${ch.id}`, 'data-layout': ch.layout }, gap, head);
    if (ch.layout === 'popup') {
      sec.append(h('div', { class: 'book' }, h('div', { class: 'book-stage' })));
    } else if (ch.layout === 'repos') {
      sec.append(h('div', { class: 'repos' }, ch.items.map(tileEl)),
        h('p', { class: 'repos-more' }, h('a', { class: 'btn', href: profile.github, target: '_blank', rel: 'noreferrer', text: 'Everything on GitHub ↗' })));
    } else ch.items.forEach(it => sec.append(cardEl(it, ch.layout === 'list')));
    root.append(sec);
  }
}

// ---------------------------------------------------------------- state
const S = {
  y: scrollY, vy: 0, lastScrollT: 0, walk: 0, t0: performance.now(), lastInput: performance.now(),
  mouse: [innerWidth * .6, innerHeight * .5], hover: null, cards: [], heads: [], book: null, popupActive: false,
  pulling: null, lastSwitch: 0, boil: -1, dirty: true, contact: false, phase: 0, chapter: 'hero',
  dark: document.documentElement.dataset.theme === 'dark',
};
let tidy, dragon, plane, cord, scenery, front, confetti, doodles, turn;

function track() {
  S.cards = [...document.querySelectorAll('.card')].map((el, i) => ({ el, body: el.querySelector('.card-body'), pin: el.closest('.pin'), i, g: -1, h: -1, gs: 0, hs: 0, done: false, row: el.classList.contains('row'), video: el.querySelector('video'), cover: el._cover }));
  S.tiles = [...document.querySelectorAll('.tile')].map(el => ({ el, h: -1, hs: 0 }));
  S.heads = [...document.querySelectorAll('.chapter .hard, .contact .hard')].map(el => ({ el, crisp: el.querySelector('.crisp'), s: -1, h: -1 }));
}
// ---------------------------------------------------------------- scroll -> progress
function progress(now, dt) {
  const vh = innerHeight, glide = RM ? 1 : 1 - Math.exp(-dt / 120);
  let best = null, bestD = 1e9;
  for (const c of S.cards) {
    const r = c.el.getBoundingClientRect(); c.rect = r;
    // targets from scroll. Pinned products: the cord drops while the stage slides in, then, pinned, he hauls
    // the paper off over most of a screen of scrolling, and the finished page holds for the rest.
    let tg, th;
    if (c.pin) {
      const pr = c.pin.getBoundingClientRect(), span = Math.max(1, pr.height - vh);
      tg = clamp((vh - pr.top) / (vh * .7)); th = clamp(-pr.top / (span * .6));
    } else { const enter = (vh - r.top) / (vh * .82); tg = 1; th = clamp((enter - .15) / .35); }
    if (RM) tg = th = 1;
    // glide toward the target so a wheel notch never jumps the paper
    c.gs += (tg - c.gs) * glide; c.hs += (th - c.hs) * glide;
    if (Math.abs(tg - c.gs) < .002) c.gs = tg;
    if (Math.abs(th - c.hs) < .002) c.hs = th;
    const g = +c.gs.toFixed(3), hh = +c.hs.toFixed(3);
    if (g !== c.g || hh !== c.h) {
      if (c.cover?.kind === 'tear' && c.h < .08 && hh >= .08) dragon?.startle(now);
      c.g = g; c.h = hh;
      c.el.style.setProperty('--h', hh.toFixed(3));
      c.cover?.update(hh);
      c.el.classList.toggle('revealed', hh >= 1);
      if (hh >= 1 && !c.done) { c.done = true; if (!c.row && tidy && !RM) { tidy.reveal([r.left + r.width * .12, r.top + r.height * .85], now, PHONE()); confetti?.burst(c.body.getBoundingClientRect()); S.chaseUntil = now + 1900; } }
      if (hh < .2 && c.done) { c.done = false; if (!c.row) tidy?.unreveal(); }
    }
    if (c.video) {
      const on = hh > .5 && r.bottom > 0 && r.top < vh;
      if (on && c.video.paused) { if (c.video.preload === 'none') c.video.preload = 'auto'; c.video.play().catch(() => {}); }
      else if (!on && !c.video.paused) c.video.pause();
    }
    if (!c.row && g > 0 && hh < 1 && r.top < vh && r.bottom > 0) { const d = Math.abs(r.top + r.height / 2 - vh * .5); if (d < bestD) { bestD = d; best = c; } }
  }
  S.pulling = best;
  for (const tl of S.tiles) {
    const r = tl.el.getBoundingClientRect(), th = RM ? 1 : clamp(((vh - r.top) / (vh * .8) - .04) / .3);
    tl.hs += (th - tl.hs) * glide; if (Math.abs(th - tl.hs) < .002) tl.hs = th;
    const v = +tl.hs.toFixed(3); if (v !== tl.h) { tl.h = v; tl.el.style.setProperty('--h', v); }
  }
  // chapter headings stamp down once they're well on screen, and re-arm when scrolled back below the fold
  for (const hd of S.heads) {
    const r = hd.el.getBoundingClientRect(), enter = (vh - r.top) / (vh * .7);
    if (!hd.stamped && (enter > .42 || RM)) {
      hd.stamped = true; hd.stampT = now; hd.el.classList.add('stamped');
      if (!RM && now - S.t0 > 1200) setTimeout(() => {   // the moment it lands
        const m = $('#main'); m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake');
        if (!S.pulling) oneShot('flinch'); dragon?.startle(performance.now());
      }, 250);
    } else if (hd.stamped && enter < .12) { hd.stamped = false; hd.el.classList.remove('stamped'); }
    hd.rect = r;
  }
  // hero name: on the clock at load, not on scroll
  const t = (now - S.t0) / 1000, name = $('#name');
  const hs = RM ? 1 : ease(clamp((t - .5) / 1.1)), hh = RM ? 1 : ease(clamp((t - 1.7) / .8));
  name.style.setProperty('--s', hs); name.style.setProperty('--h', hh);
  document.querySelector('.hero').style.setProperty('--in', RM ? 1 : ease(clamp((t - 2) / .8)));
  // the book
  if (S.book) {
    // the book finishes opening at ~78% of its pinned stretch, then holds open so you can play with it
    const r = S.book.wrap.getBoundingClientRect(), p = clamp(-r.top / ((r.height - vh) * .78));
    const active = r.top < vh * .3 && r.bottom > vh * .7;
    if (p !== S.book.p) { S.book.p = p; S.book.api?.setProgress(p); }
    if (active !== S.popupActive) {
      S.popupActive = active; $('#guide').classList.toggle('away', active);
      const pages = $('#pages'); pages.hidden = !active || PHONE();
    }
  }
  const ct = $('#contact-title').getBoundingClientRect(), wasContact = S.contact; S.contact = ct.top < vh * .6;   // the heading, not the section (which starts with its page-turn gap)
  if (wasContact && !S.contact) tidy?.rearmKick();
  S.phase = clamp(scrollY / Math.max(1, document.documentElement.scrollHeight - vh));
  // the page turn into each chapter runs while its empty .turn-gap scrolls through the middle of the screen
  let tp = 0, info = null;
  if (!RM) for (const g of document.querySelectorAll('.turn-gap')) {
    const r = g.getBoundingClientRect(), p = (vh * .6 - r.top) / Math.max(1, r.height - vh * .2);
    if (p > 0 && p < 1) { tp = p; info = { key: g.dataset.title, title: g.dataset.title, lede: g.dataset.lede }; break; }
  }
  if (!info) S.turnP = 0;   // outside every gap: no page (snap, so it never replays backwards)
  else {
    if (info.key !== S.turnInfo?.key) { S.turnInfo = info; S.turnP = tp; }
    S.turnP += (tp - S.turnP) * glide; if (Math.abs(tp - S.turnP) < .002) S.turnP = tp;
  }
  if (S.contact) S.chapter = 'contact';
  else if (scrollY < vh * .6) S.chapter = 'hero';
  else for (const sec of document.querySelectorAll('.chapter')) { const b = sec.getBoundingClientRect(); if (b.top < vh * .5 && b.bottom > vh * .5) { S.chapter = sec.id; break; } }
  document.documentElement.style.setProperty('--tint', S.dark ? 'transparent' : pageTint(S.phase));
}

// ---------------------------------------------------------------- the director
let guide;
function oneShot(name) {
  if (!guide || RM || guide.lock) return;
  guide.setFlip(name === 'toss' && PHONE());
  guide.play(name, { once: true, restart: true });
}
function direct(now) {
  if (!guide || guide.lock) return;
  if (RM) { guide.play('idle2'); return; }
  const moving = now - S.lastScrollT < 160 && Math.abs(S.vy) > 40;
  let want, flip = false;
  // the end of the page: roll a ball out of the basket and boot it off the page, then wave
  if (S.contact && !moving && tidy && !tidy.kicked && tidy.count > 0 && !plane?.active) tidy.kick(now, PHONE());
  if (S.contact && !moving) want = 'wave';
  else if (S.pulling && Math.abs(S.vy) < 2600) want = 'pull';
  else if (moving) { want = Math.abs(S.vy) > 1500 ? 'run' : 'walk'; flip = S.vy < 0; }
  else if (S.hover) want = 'point';
  else if (now - S.t0 < 4200 && scrollY < innerHeight * .3) want = 'wave';
  else if (now - S.lastInput > 12000) want = 'bored';
  else {
    const [gx] = guide.at(.5, .2), g = clamp((S.mouse[0] - gx) / 520, -1, 1);
    want = 'idle' + Math.round((g + 1) * 2);
  }
  const idleSwap = want.startsWith('idle') && guide.cur?.startsWith('idle');
  if (want !== guide.cur && (idleSwap || now - S.lastSwitch > (moving || want === 'walk' ? 80 : 240))) { guide.play(want); S.lastSwitch = now; }
  guide.setFlip(flip && (want === 'walk' || want === 'run'));
}

// ---------------------------------------------------------------- ink
let ink;
function drawInk(now) {
  const boil = Math.floor(now / 1000 * 12);
  ink.begin(boil);
  const vh = innerHeight, vw = innerWidth;

  // the lane: sky (morning at the top of the page, night at the bottom), props, the basket, then the ground
  if (guide && !S.popupActive) {
    const [fx, fy] = guide.at(.5, guide.m.idle2.feet[1] / guide.m.idle2.h), laneW = PHONE() ? vw : Math.max(260, $('#lane').offsetWidth);
    const x0 = PHONE() ? 0 : 0, x1 = PHONE() ? vw : laneW - 10;
    const p = S.dark ? Math.max(S.phase, .9) : S.phase;
    drawSky(ink, { x0, x1: PHONE() ? vw : laneW, y0: PHONE() ? fy - 150 : 0, y1: fy + 2, p, now, phone: PHONE() });
    scenery?.draw(ink, { x0, x1, groundY: fy + 2, walk: S.walk, scale: guide.scale, chapter: S.chapter, night: S.dark || p > .8, avoidX: fx });
    tidy?.drawBack(ink, PHONE());
    ink.stroke([[x0 + 10, fy + 2], [(x0 + x1) / 2, fy + 3], [x1, fy + 1]], { w: 2, key: 'ground', alpha: .9 });
    const off = S.walk * .55, gap = 64;
    for (let i = -1; i < (x1 - x0) / gap + 2; i++) {
      const wx = i * gap - (off % gap), n = Math.floor((off - wx) / gap) * 7 + i * 13, kind = ((n % 5) + 5) % 5;
      const x = x0 + wx + gap, y = fy + 2;
      if (x < x0 + 6 || x > x1 - 6 || Math.abs(x - fx) < 26) continue;
      if (kind === 0) ink.stroke([[x - 5, y], [x - 2, y - 9], [x, y], [x + 3, y - 12], [x + 5, y]], { w: 1.3, key: 'tuft' + n, wob: .6 });
      else if (kind === 2) ink.ellipse(x, y - 3, 6, 3, { w: 1.2, key: 'pebble' + n, wob: .5 });
      else if (kind === 4) ink.stroke([[x - 4, y - 1], [x + 4, y - 1]], { w: 1, key: 'dash' + n, alpha: .6 });
    }
  }

  // the hero note and its arrow to the guide's head
  const note = $('.note');
  if (note && guide && !PHONE() && scrollY < vh * .35) {
    const r = note.getBoundingClientRect(), t = (now - S.t0) / 1000, k = (RM ? 1 : ease(clamp((t - 2.6) / .8))) * (1 - clamp(scrollY / (vh * .3)));
    const [hx, hy] = guide.at(.6, .3);
    note.style.opacity = k;
    if (k > 0) ink.arrow([r.left - 8, r.top + r.height / 2], [hx + 14, hy], { k, key: 'note', col: SAGE, bend: -.3 });
  }

  // chapter headings: a sage swash painted under the words
  for (const hd of S.heads) {
    if (!hd.rect || !hd.stamped || hd.rect.bottom < -50 || hd.rect.top > vh + 50) continue;
    const cr = hd.crisp.getBoundingClientRect(), k = RM ? 1 : clamp((now - hd.stampT - 420) / 520);
    if (k > 0) ink.swash(cr.left - 4, cr.bottom - cr.height * .08, cr.width + 8, { k, key: 'sw' + hd.el.id, th: 9 });
  }

  // rows on the work timeline: an ink dot, an underline that draws in, and a line joining the dots
  let prevDot = null;
  for (const c of S.cards) {
    const r = c.rect; if (!c.row || !r || c.h <= 0 || r.bottom < -40 || r.top > vh + 40) continue;
    const b = c.body.getBoundingClientRect(), tr = c.el.querySelector('h3').getBoundingClientRect();
    const t = { r: { x: tr.left - b.left, y: tr.top - b.top, w: tr.width, h: tr.height } };
    const dot = [b.left + 12, b.top + t.r.y + t.r.h / 2];
    if (prevDot && prevDot[2] === c.el.parentElement) ink.stroke([[prevDot[0], prevDot[1] + 12], [dot[0] + .5, (prevDot[1] + dot[1]) / 2], [dot[0], dot[1] - 12]], { w: 1.4, k: c.h, key: 'rowl' + c.i, alpha: .55, wob: .7 });
    prevDot = [...dot, c.el.parentElement];
    ink.dot(dot[0], dot[1], 5.5, { key: 'row' + c.i, col: c.h > .6 ? SAGE : INK });
    ink.stroke([[b.left + 34, b.top + t.r.y + t.r.h + 4], [b.left + 34 + t.r.w, b.top + t.r.y + t.r.h + 6]], { w: 1.8, k: c.h, key: 'rowu' + c.i, alpha: .8 });
  }

  // the cord: from the tab's ring to his fists, sagging while it drops to him, taut while he hauls
  const c = S.pulling;
  if (c && c.cover && guide?.cur === 'pull' && !S.popupActive) {
    const a = guide.anchor(), ring = c.cover.ring();
    if (a) {
      const taut = clamp(c.h * 4), sag = (1 - taut) * 90 + 10;
      const mx = (a[0] + ring[0]) / 2, my = Math.max(a[1], ring[1]) + sag;
      const P = []; for (let i = 0; i <= 22; i++) { const t = i / 22, u = 1 - t; P.push([u * u * ring[0] + 2 * u * t * mx + t * t * a[0], u * u * ring[1] + 2 * u * t * my + t * t * a[1]]); }
      ink.stroke(P, { w: 2.2, k: c.g, key: 'cord', wob: .8, col: INK });
      if (c.g >= 1) {   // the loose end hanging from his fists, swinging a little
        const sw = Math.sin(now / 420) * 8;
        ink.stroke([[a[0], a[1]], [a[0] - 6 + sw * .4, a[1] + 26], [a[0] - 10 + sw, a[1] + 54]], { w: 2, key: 'cordtail', wob: .6 });
      }
    }
  }
}

function drawFront(now) {
  front.begin(Math.floor(now / 1000 * 12));
  confetti?.draw(front);
  tidy?.drawFront(front);
  plane?.draw(front);
  if (cord) {
    const laneW = PHONE() ? 0 : $('#lane').offsetWidth;
    cord.draw(front, PHONE() ? 92 : Math.max(120, laneW * .78), S.dark, PHONE() ? .62 : 1);
    drawCordNote(now);
  }
}
// "pull for lights out": a handwritten note beside the bead, an ink arrow that draws itself in and a glow on the bead,
// near the top of the page, until the cord has been pulled
function drawCordNote(now) {
  const note = $('.cord-note'), t = (now - S.t0) / 1000;
  const show = !S.cordUsed && scrollY < innerHeight * .6 && (RM || t > 1.4) && !(S.turnP > .02);   // not while a page is turning
  note.classList.toggle('on', show && !!cord.bead);
  if (!show || !cord.bead) { S.noteT = 0; return; }
  if (!S.noteT) S.noteT = now;
  note.textContent = S.dark ? 'pull for daylight' : 'pull for lights out';
  const [bx, by] = cord.bead, phone = PHONE();
  note.style.left = `${bx + (phone ? 34 : 58)}px`; note.style.top = `${by + (phone ? 18 : -14)}px`;   // level with the bead, clear of the name
  const r = note.getBoundingClientRect(), k = RM ? 1 : clamp((now - S.noteT - 250) / 700);
  if (k > 0) front.arrow([r.left - 6, r.top + r.height * .45], [bx + 9, by + 6], { k, key: 'cordnote', col: front.theme.sage, bend: .45, w: 1.7 });
  // a soft pulse of light around the bead so the eye finds it
  const pulse = RM ? .5 : .5 + .5 * Math.sin((now - S.noteT) / 260), c = front.x, g = c.createRadialGradient(bx, by, 0, bx, by, 26);
  g.addColorStop(0, `rgba(217,119,87,${.35 * pulse})`); g.addColorStop(1, 'rgba(217,119,87,0)');
  c.fillStyle = g; c.fillRect(bx - 26, by - 26, 52, 52);
}
function setTheme(dark) {
  S.dark = dark; document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const t = dark ? { ink: '#EEE5D5', sage: '#8DC3A4', paper: '#1D1A22' } : { ink: '#2B2233', sage: '#3E6B55', paper: '#F3EBDC' };
  if (ink) ink.theme = t; if (front) front.theme = t;
  const b = $('#cord'); b.setAttribute('aria-pressed', dark); b.setAttribute('aria-label', `Pull the lamp cord to turn the lights ${dark ? 'on' : 'off'}`);
  try { localStorage.setItem('reel-theme', dark ? 'dark' : 'light'); } catch (e) {}
}

// ---------------------------------------------------------------- interaction
function wire() {
  addEventListener('scroll', () => {
    const now = performance.now(), dy = scrollY - S.y, dt = Math.max(8, now - (S.lastScrollT || now - 16));
    S.vy = S.vy * .6 + (dy / dt * 1000) * .4; S.y = scrollY; if (!S.pulling) S.walk += Math.abs(dy); S.lastScrollT = now; S.lastInput = now;
  }, { passive: true });
  addEventListener('pointermove', e => { S.mouse = [e.clientX, e.clientY]; S.lastInput = performance.now(); }, { passive: true });

  $('#guide').addEventListener('click', () => { S.lastInput = performance.now(); oneShot('startled'); });
  const mail = $('[data-email]');
  mail.addEventListener('click', e => {
    if (RM || !plane || plane.active || !guide || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    const href = mail.href; mail.style.visibility = 'hidden';
    plane.launch(mail.getBoundingClientRect(), href, performance.now(), () => { mail.style.visibility = ''; location.href = href; });
  });
  wireCards(S.cards);
  for (const tl of S.tiles) {
    tl.el.addEventListener('pointerenter', () => { S.hover = tl; });
    tl.el.addEventListener('pointerleave', () => { if (S.hover === tl) S.hover = null; });
    tl.el.addEventListener('click', e => { if (e.target.closest('a')) oneShot('excited'); });
  }
}
function wireCards(list) {
  for (const c of list) {
    const card = c.el;
    card.addEventListener('pointerenter', () => { if (!c.row) S.hover = c; });
    card.addEventListener('pointerleave', () => { if (S.hover === c) S.hover = null; card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
    card.addEventListener('pointermove', e => {
      if (c.row || RM || c.h < 1) return;
      const r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
      card.style.setProperty('--ry', (px * 2.4).toFixed(2) + 'deg'); card.style.setProperty('--rx', (-py * 2).toFixed(2) + 'deg');
    });
    const toggle = () => {
      if (c.row) return;
      const open = card.classList.toggle('open'), btn = card.querySelector('[data-open]');
      if (btn) { btn.setAttribute('aria-expanded', open); btn.textContent = open ? 'Less' : 'More'; }
      if (open) oneShot('excited');
    };
    card.addEventListener('click', e => {
      if (e.target.closest('a')) { oneShot('excited'); return; }
      if (e.target.closest('[data-open]') || e.target.closest('.card-body')) toggle();
    });
  }
}

// ---------------------------------------------------------------- the pop-up book
function showDetail(item) {
  const d = $('#detail');
  d.querySelector('.kicker').textContent = item.kicker || '';
  d.querySelector('h3').textContent = item.title;
  d.querySelector('.metric').textContent = item.metric ? `${item.metric.value} · ${item.metric.label}` : '';
  d.querySelector('.blurb').textContent = item.blurb || '';
  d.querySelector('.more').textContent = item.detail || '';
  d.querySelector('.tags').replaceChildren(...(item.tags || []).map(t => h('li', { text: t })));
  d.querySelector('.actions').replaceChildren(...linkBtns(item.links));
  d.showModal();
}
async function mountBook(manifest) {
  const ch = chapters.find(c => c.layout === 'popup'); if (!ch) return;
  const sec = $(`#${ch.id}`), wrap = sec.querySelector('.book'), stage = sec.querySelector('.book-stage');
  const pages = $('#pages');
  pages.replaceChildren(h('p', { text: 'pick a page' }), ...ch.items.map(it => {
    const b = h('button', { type: 'button', text: it.title });
    b.addEventListener('click', () => { S.book?.api?.react?.('excited'); showDetail(it); });
    b.addEventListener('pointerenter', () => S.book?.api?.setHover?.(it.id));
    b.addEventListener('focus', () => S.book?.api?.setHover?.(it.id));
    b.addEventListener('pointerleave', () => S.book?.api?.setHover?.(null));
    return b;
  }));
  const fallback = () => {
    wrap.remove();
    const f = h('div', { class: 'book-fallback' }, ch.items.map(it => cardEl(it, false)));
    sec.append(f); S.book = null;
    const before = new Set(S.cards.map(c => c.el)); track(); wireCards(S.cards.filter(c => !before.has(c.el)));
  };
  if (PHONE() && !window.WebGLRenderingContext) return fallback();
  try {
    const { mountPopup } = await import('./popup.js');
    const api = mountPopup(stage, ch.items, { manifest, spriteBase: 'sprites/', onHover: () => {}, onPick: it => showDetail(it) });
    S.book = { wrap, api, p: -1 };
  } catch (e) { console.warn('pop-up book unavailable, using cards', e); fallback(); }
}

// where the dragon wants to be this frame
function dragonTarget(now) {
  const s = guide.scale, moving = now - S.lastScrollT < 160 && Math.abs(S.vy) > 40;
  if (plane?.active && plane.f.pos) return { x: plane.f.pos[0] - 50 * s, y: plane.f.pos[1] - 30 * s };
  if (now < (S.chaseUntil || 0)) { const b = confetti?.chaseTarget(); if (b) return { x: b.x, y: b.y + 70 * s }; }
  const hov = S.hover;
  if (hov && (!hov.h || hov.h >= 1)) {
    // product cards: it lands on the ledge under the video; index cards: on their top edge
    const media = hov.el.querySelector('.media'), r = (media || hov.body || hov.el).getBoundingClientRect();
    const room = r.top > 175 * s;   // no room above a card near the top of the screen: it sits on the bottom edge
    if (r.bottom > 0 && r.top < innerHeight) return media ? { x: r.right - 70 * s, y: r.bottom + 1, perch: true, faceX: r.left } : { x: r.right - 60 * s, y: room ? r.top + 2 : r.bottom + 1, perch: true, faceX: r.left };
  }
  if (S.contact) { const r = $('#contact-title .crisp').getBoundingClientRect(); return { x: r.right + 10 * s, y: r.top + r.height * .15, perch: true, faceX: r.left }; }
  if (S.popupActive && S.book) { const r = S.book.wrap.querySelector('.book-stage').getBoundingClientRect(); return { x: r.left + r.width * (.5 + .3 * Math.sin(now / 2600)), y: r.top + r.height * .22 }; }
  const [hx, hy] = guide.at(.5, .2), lead = moving ? 110 * s * Math.sign(S.vy) : 0;
  return { x: hx + (PHONE() ? 70 : 80) * s + lead, y: hy - 20 * s };
}

// ---------------------------------------------------------------- boot
async function boot() {
  document.documentElement.style.setProperty('--wipe', `url(${makeWipe()})`);
  buildHero(); buildChapters(); track(); wire();
  ink = new Ink($('#ink')); ink.still = RM; front = new Ink($('#inkfront')); front.still = RM;
  // the hint shows on every visit and goes away once the cord has been pulled this visit
  confetti = new Confetti(); doodles = new Doodles($('#doodles')); turn = new PageTurn($('#turn'));
  $('#contact').prepend(h('div', { class: 'turn-gap', 'aria-hidden': 'true', 'data-title': 'Say hello', 'data-lede': 'Send me the messy problem.' }));
  cord = new Cord($('#cord'), { onToggle: () => { setTheme(!S.dark); S.cordUsed = true; } }); setTheme(S.dark);
  const manifest = await fetch('sprites/manifest.json').then(r => r.json());
  guide = new Guide($('#guide'), manifest);
  const size = () => guide.setScale(PHONE() ? 150 / manifest.idle2.h : clamp(innerHeight * .5, 300, 460) / manifest.idle2.h);
  size(); addEventListener('resize', size);
  await guide.load(['idle2', 'wave', 'walk', 'pull']);
  guide.play('wave');
  guide.load();   // the rest in the background
  mountBook(manifest);
  plane = new Plane({ guide, oneShot });
  const art = await fetch('art/manifest.json').then(r => r.ok ? r.json() : {}).catch(() => ({}));
  scenery = new Scenery(art);
  dragon = new Dragon($('#dragon'), art);
  const dsize = () => dragon.setScale(guide.scale); dsize(); addEventListener('resize', dsize);
  dragon.load();
  tidy = new Tidy(art, { guide, oneShot, onHatch: (at, now) => { if (!RM && art.dragon_unfold) { dragon.hatch(at, now); oneShot('excited'); } } });

  let last = performance.now();
  const loop = now => {
    const dt = Math.min(64, now - last); last = now;
    // arriving through the 2D door the whole page is a book page under a moving camera (js/arrive.js): everything read
    // from on-screen positions (scroll progress and the ink) holds still until the camera lands
    const book = document.documentElement.classList.contains('book');
    if (!book) progress(now, dt);
    direct(now);
    if (guide.cur === 'pull' && S.pulling) {
      const c = guide.m.pull, k = clamp(S.pulling.g * .3 + S.pulling.h * .7);
      guide.tick(now, Math.round(k * (c.frames - 1)));
    } else if (guide.cur === 'walk' || guide.cur === 'run') {
      const c = guide.m[guide.cur], stride = guide.cur === 'run' ? 150 : 110;   // scroll px per full cycle
      guide.tick(now, Math.floor(S.walk / stride * c.frames));
    } else guide.tick(now);
    if (now - S.lastScrollT > 120) S.vy *= .85;
    tidy?.update(now, PHONE(), S.popupActive); plane?.update(now); cord?.update(dt);
    if (dragon?.alive) {
      dragon.update(now, dt, dragonTarget(now));
      if (now < (S.chaseUntil || 0) && confetti.catchNear(dragon.pos[0], dragon.pos[1] - 70 * guide.scale, 34 * guide.scale)) S.chaseUntil = 0;   // caught one
    }
    confetti?.update(dt);
    turn?.set(S.turnP || 0, S.turnInfo);
    doodles?.draw(Math.floor(now / 1000 * 12), S.dark, RM);
    if (!book) { drawInk(now); drawFront(now); }
    if (!S.drawn) { S.drawn = true; document.documentElement.classList.add('drawn'); }   // arrive.js waits for this
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
boot();
