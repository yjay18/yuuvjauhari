// cover.js: the paper each project hides under, and how it comes off. Two ways, alternating down the page:
//   peel: the sheet folds down from the top edge, its back showing, as the tab is pulled down
//   tear: a ragged rip runs down the middle from the tab, then the two halves fall away
// update(r) is a pure function of r (0 = sealed, 1 = gone), so scrolling back seals it again.
import { rng } from './ink.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const easeIn = t => t * t, easeOut = t => 1 - (1 - t) * (1 - t);
const el = (cls, parent, text) => { const e = document.createElement('div'); e.className = cls; if (text) e.textContent = text; parent.append(e); return e; };

function label(parent, item) {
  const l = el('label', parent);
  el('label-kicker', l, item.kicker || '');
  el('label-title', l, item.title);
  return l;
}

export function makeCover(item, kind, seed) {
  const root = document.createElement('div');
  root.className = `cover ${kind}`; root.setAttribute('aria-hidden', 'true');
  const tab = el('tab', root); el('tab-ring', tab); el('tab-text', tab, 'pull');
  const api = { root, tab, kind, r: -1 };

  if (kind === 'peel') {
    const sheet = el('sheet', root); label(sheet, item);
    const flap = el('flap', root);
    api.update = r => {
      if (r === api.r) return; api.r = r;
      const e = easeIn(r) * 100;                       // where the fold line sits, % from the top
      const f = Math.min(e, 100 - e) * .55;            // how much folded-over back shows below it
      sheet.style.clipPath = `inset(${e}% 0 0 0)`;
      flap.style.top = `${e}%`; flap.style.height = `${f}%`; flap.style.opacity = r > .002 && r < .995 ? 1 : 0;
      // the tab starts sticking up from the top edge, then hangs from the folded flap as it is hauled down
      tab.style.left = '50%'; tab.style.top = `${e + f}%`;
      tab.style.transform = `translate(-50%, ${-100 + clamp(r / .06) * 100}%) rotate(${Math.sin(r * 40) * 3}deg)`;
      tab.style.opacity = r < .97 ? 1 : 0;
    };
  } else {
    // a ragged tear line from the top middle to the bottom, in % of the cover
    const R = rng(seed), line = [];
    for (let y = 0; y <= 100; y += 4) line.push([50 + (R() - .5) * (y ? 9 : 2) + Math.sin(y * .09) * 3, y]);
    const halves = ['l', 'r'].map(side => {
      const half = el(`half ${side}`, root), fiber = el('fiber', half), paper = el('paper', half); label(paper, item);
      const edge = side === 'l' ? line : [...line].reverse(), outer = side === 'l' ? ['0% 100%', '0% 0%'] : ['100% 0%', '100% 100%'];
      paper.style.clipPath = `polygon(${[...edge.map(([x, y]) => `${x}% ${y}%`), ...outer].join(',')})`;
      return { half, fiber, side, edge };
    });
    const at = d => {   // point on the tear line at depth d (0..100)
      const i = Math.min(line.length - 2, Math.floor(d / 4)), f = (d - i * 4) / 4;
      return [line[i][0] + (line[i + 1][0] - line[i][0]) * f, d];
    };
    api.update = r => {
      if (r === api.r) return; api.r = r;
      const d = clamp(r / .55) * 100, [tx, ty] = at(d), fall = easeIn(clamp((r - .55) / .45));
      for (const hv of halves) {
        const s = hv.side === 'l' ? -1 : 1, open = easeOut(d / 100) * 5;
        hv.half.style.transformOrigin = `${tx}% ${ty}%`;
        hv.half.style.transform = `translate(${s * fall * 48}%, ${fall * (26 + (s > 0 ? 8 : 0))}%) rotate(${s * (open + fall * (18 + (s > 0 ? 6 : 0)))}deg)`;
        hv.half.style.opacity = 1 - fall * fall;
        // pale torn fibres only along the part that has actually ripped
        const torn = hv.edge.filter(([, y]) => y <= ty).concat([[tx, ty]]).sort((a, b) => hv.side === 'l' ? a[1] - b[1] : b[1] - a[1]);
        const off = -s * 3.5;   // a pale strip just outside the paper's torn edge, toward the gap
        hv.fiber.style.clipPath = torn.length > 1 && r > 0
          ? `polygon(${[...torn.map(([x, y]) => `${x}% ${y}%`), ...[...torn].reverse().map(([x, y]) => `calc(${x}% + ${off}px) ${y}%`)].join(',')})`
          : 'polygon(0 0, 0 0, 0 0)';
      }
      tab.style.left = `${tx}%`; tab.style.top = `${ty}%`; tab.style.opacity = r < .6 ? 1 : 1 - clamp((r - .6) / .15);
      tab.style.transform = `translate(-50%, -100%) rotate(${(r < .55 ? 0 : fall * 40)}deg)`;
    };
  }
  // the ring the cord ties to, in screen px
  api.ring = () => { const b = tab.querySelector('.tab-ring').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };
  return api;
}
