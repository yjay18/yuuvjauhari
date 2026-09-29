// The HTML layer over the town: a top bar (the owner's name, a button per place
// that walks Yuuv there, Day/Night, the links out), a side panel (a bottom sheet
// on phones) with the current place's chapter, its items as buttons and each
// item's card, and labels that ride over the canvas. All content comes from
// data.js and works without the 3D scene: the canvas is decoration.
//
// createUI({ profile, places, onGo(placeId, itemId?), onNight(), onHome() })
//   places: [{ id, name, chapter: { title, lede, items } | null }], the hub first
// -> { show(placeId, itemId?, focus?), setCurrent(placeId), setNight(on), free(), label(...), tip(...), status(text) }
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
};
const external = (href) => /^https?:/.test(href);
const linkBtn = (l, primary) => h('a', { class: 'btn' + (primary ? ' primary' : ''), href: l.href, target: external(l.href) ? '_blank' : null, rel: external(l.href) ? 'noreferrer' : null, text: l.label + (external(l.href) ? ' ↗' : '') });

// What each place holds, in plain words: the names belong to the town, these say what you'll find there.
const WHAT = { hub: 'About me', shipped: 'Projects', more: 'Side projects', education: 'Education', research: 'Research', work: 'Work experience', contact: 'Contact' };

export function createUI({ profile, places, onGo, onNight, onHome }) {
  const $ = (s) => document.querySelector(s);
  const byId = Object.fromEntries(places.map((p) => [p.id, p]));
  const hub = byId.hub || null; // absent when one district is shown alone
  const districtsOf = places.filter((p) => p.id !== 'hub');

  // ---- the top bar
  $('#owner').textContent = profile.name;
  $('#short').href = profile.recruiterSite;
  const nav = $('#places');
  const navBtns = {};
  for (const p of places) {
    navBtns[p.id] = h('button', { type: 'button', title: p.chapter && p.id !== 'hub' ? p.chapter.title : null, onclick: () => onGo(p.id) }, h('span', { class: 'n', text: p.name }), WHAT[p.id] ? h('small', { text: WHAT[p.id] }) : null);
    nav.append(navBtns[p.id]);
  }
  const nightBtn = $('#night');
  nightBtn.addEventListener('click', () => onNight());

  // ---- the panel
  const panel = $('#panel'), body = $('#panel-body'), sheet = $('#sheet');
  sheet.addEventListener('click', () => { const open = panel.dataset.open !== 'true'; panel.dataset.open = String(open); sheet.setAttribute('aria-expanded', String(open)); sheet.textContent = open ? 'Hide' : 'Show'; });
  let shown = { place: null, item: null };

  // A district's own extra for the panel: HTML (a string) or a node, from its build's panel(stopId).
  function extra(p, stopId) {
    if (stopId === 'main') return null; // a district's how-to line for its place page: left out, the town shows how it works
    let x = null;
    try { x = p.panel?.(stopId); } catch (e) { console.warn(`panel(${stopId}) of ${p.id}:`, e.message); }
    if (!x) return null;
    if (x instanceof Node) return h('div', { class: 'extra' }, x);
    const d = h('div', { class: 'extra' }); d.innerHTML = String(x); return d;
  }
  function list(p) {
    return h('ul', { class: 'items' }, p.chapter.items.map((it) => h('li', {},
      h('button', { type: 'button', 'data-item': it.id, onclick: () => onGo(p.id, it.id) }, h('span', { class: 't', text: it.title }), h('span', { class: 's', text: it.kicker })))));
  }
  function homeView() {
    return [
      h('p', { class: 'kicker', text: hub.name }),
      h('h2', { id: 'panel-title', tabindex: '-1', text: profile.line }),
      h('p', { class: 'lede', text: profile.sub }),
      profile.based ? h('p', { class: 'based', text: profile.based }) : null,
      extra(hub, 'main'),
      h('ul', { class: 'items' }, districtsOf.map((p) => h('li', {},
        h('button', { type: 'button', 'data-place': p.id, onclick: () => onGo(p.id) }, h('span', { class: 't', text: p.name }), h('span', { class: 's', text: WHAT[p.id] || p.chapter.title }))))),
    ];
  }
  function contactView(p) {
    return [
      hub ? h('button', { type: 'button', class: 'back', onclick: () => onHome() }, 'Town') : null,
      h('p', { class: 'kicker', text: p.name }),
      h('h2', { id: 'panel-title', tabindex: '-1', text: p.chapter.title }),
      h('p', { class: 'mail' }, h('a', { href: `mailto:${profile.email}`, text: profile.email })),
      h('p', { class: 'links' },
        h('a', { class: 'btn primary', href: profile.cv, text: 'Read the CV' }),
        linkBtn({ label: 'GitHub', href: profile.github }), linkBtn({ label: 'LinkedIn', href: profile.linkedin })),
      extra(p, 'main'),
    ];
  }
  function placeView(p) {
    return [
      hub ? h('button', { type: 'button', class: 'back', onclick: () => onHome() }, 'Town') : null,
      h('p', { class: 'kicker', text: p.name }),
      h('h2', { id: 'panel-title', tabindex: '-1', text: p.chapter.title }),
      list(p),
      extra(p, 'main'),
    ];
  }
  function itemView(p, it) {
    const items = p.chapter.items, i = items.indexOf(it), prev = items[i - 1], next = items[i + 1];
    const note = it.media?.note ? `${it.media.note}.` : ''; // honest labels only (sample data), no how-to lines
    return [
      h('button', { type: 'button', class: 'back', onclick: () => { show(p.id); body.querySelector(`[data-item="${it.id}"]`)?.focus(); } }, p.name),
      h('article', { class: 'card' },
        h('p', { class: 'kicker', text: it.kicker }),
        h('h2', { id: 'panel-title', tabindex: '-1', text: it.title }),
        it.metric ? h('p', { class: 'metric' }, h('b', { text: it.metric.value }), ' ', h('span', { text: it.metric.label })) : null,
        h('p', { class: 'blurb', text: it.blurb }),
        it.detail ? h('p', { class: 'detail', text: it.detail }) : null,
        note ? h('p', { class: 'note', text: note }) : null,
        it.tags ? h('ul', { class: 'tags', 'aria-label': 'Tags' }, it.tags.map((t) => h('li', { text: t }))) : null,
        it.links ? h('p', { class: 'links' }, it.links.map((l, k) => linkBtn(l, k === 0))) : null,
        extra(p, it.id)),
      h('nav', { class: 'pager', 'aria-label': `More in ${p.name}` },
        prev ? h('button', { type: 'button', onclick: () => onGo(p.id, prev.id) }, h('span', { class: 's', text: 'Previous' }), h('span', { class: 't', text: prev.title })) : h('span'),
        next ? h('button', { type: 'button', class: 'next', onclick: () => onGo(p.id, next.id) }, h('span', { class: 's', text: 'Next' }), h('span', { class: 't', text: next.title })) : h('span')),
    ];
  }
  // Render a place (and an item's card). `focus`: move keyboard focus to the new heading.
  function show(placeId, itemId = null, focus = false) {
    const p = byId[placeId] || hub || places[0];
    const it = itemId && p.chapter ? p.chapter.items.find((x) => x.id === itemId) : null;
    if (shown.place === p.id && shown.item === (it ? it.id : null) && body.childElementCount) return;
    shown = { place: p.id, item: it ? it.id : null };
    body.replaceChildren(...(p.id === 'hub' ? homeView() : p.id === 'contact' ? contactView(p) : it ? itemView(p, it) : placeView(p)).filter(Boolean));
    body.scrollTop = 0;
    panel.dataset.place = p.id;
    if (focus) body.querySelector('#panel-title')?.focus({ preventScroll: true });
    setCurrent(p.id);
  }
  function setCurrent(placeId) {
    for (const [id, b] of Object.entries(navBtns)) { if (id === placeId) b.setAttribute('aria-current', 'location'); else b.removeAttribute('aria-current'); }
  }
  function setNight(on) {
    nightBtn.textContent = on ? 'Day' : 'Night';
    nightBtn.setAttribute('aria-label', on ? 'Switch to day' : 'Switch to night');
  }

  // ---- labels over the canvas (decorative: the nav and panel carry the same things)
  const layer = $('#labels');
  const tags = {};
  for (const p of districtsOf) {
    tags[p.id] = h('button', { type: 'button', class: 'tag', tabindex: '-1', 'aria-hidden': 'true', onclick: () => onGo(p.id) }, h('b', { text: p.name }), h('span', { text: WHAT[p.id] || p.chapter.title }));
    layer.append(tags[p.id]);
  }
  const plate = h('div', { class: 'nameplate', 'aria-hidden': 'true' }, h('b', { text: profile.name }), h('span', { text: profile.line }));
  const tipEl = h('div', { class: 'tip', 'aria-hidden': 'true' });
  layer.append(plate, tipEl);
  const place = (el, x, y, on, mid) => {
    el.classList.toggle('on', on);
    if (on) el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, ${mid ? '-50%' : '-100%'})`;
  };
  // Labels in priority order: each one that would overlap one already placed stays hidden.
  const size = (el) => (el._size ||= el.offsetWidth ? [el.offsetWidth, el.offsetHeight + (parseFloat(getComputedStyle(el).marginTop) < 0 ? -parseFloat(getComputedStyle(el).marginTop) : 0)] : null) || [120, 40];
  function labels(list) {
    const placed = [];
    for (const { el, x, y, on, mid } of list) {
      let ok = on;
      if (ok) {
        const [w, hh] = size(el), r = mid ? [x - w / 2, y - hh / 2, x + w / 2, y + hh / 2] : [x - w / 2, y - hh, x + w / 2, y];
        ok = !placed.some((q) => r[0] < q[2] + 6 && r[2] > q[0] - 6 && r[1] < q[3] + 4 && r[3] > q[1] - 4);
        if (ok) placed.push(r);
      }
      place(el, x, y, ok, mid);
    }
  }

  // The part of the window the 3D scene can use: not under the bar or the panel.
  function free() {
    const W = innerWidth, H = innerHeight, bar = $('#bar').getBoundingClientRect(), r = panel.getBoundingClientRect();
    const phone = W < 760;
    const top = Math.min(H * 0.4, bar.bottom);
    if (phone) return { left: 0, top, right: W, bottom: Math.max(top + 120, Math.min(H, r.top)) };
    return { left: 0, top, right: Math.max(W * 0.5, Math.min(W, r.left)), bottom: H };
  }

  // A district module's own name, lede and panel extra, once it has loaded.
  function setPlace(id, { name, lede, panel } = {}) {
    const p = byId[id];
    if (!p) return;
    if (name) { p.name = name; if (navBtns[id] && id !== 'hub') navBtns[id].querySelector('.n').textContent = name; tags[id]?.querySelector('b') && (tags[id].querySelector('b').textContent = name); }
    if (lede !== undefined) p.lede = lede;
    if (panel) p.panel = panel;
    if (shown.place === id) { const again = shown; shown = { place: null, item: null }; show(again.place, again.item); }
  }

  show(places[0].id);
  return {
    show, setCurrent, setNight, free, setPlace,
    // [{ id: placeId | 'name', x, y, on }], most important first
    labels(list, compact) {
      if (plate.classList.contains('compact') !== Boolean(compact)) { plate.classList.toggle('compact', Boolean(compact)); plate._size = null; }
      labels(list.map((l) => ({ ...l, el: l.id === 'name' ? plate : tags[l.id] })).filter((l) => l.el));
    },
    tip(text, x, y) { tipEl.textContent = text || ''; place(tipEl, x, y - 14, Boolean(text)); },
    status(text) { const s = $('#status'); s.textContent = text || ''; s.hidden = !text; },
    shown: () => ({ ...shown }),
  };
}
