// turn.js: between chapters a real page turns. A full-screen sketchbook page swings in from the right on a hinge at its
// right edge, lies flat showing the next chapter's name, then lifts its right edge and turns over to the left on a hinge
// at its left edge, like a book page. It's a DOM element with 3D perspective, driven by p (0..1) from scroll.
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = t => t * t * (3 - 2 * t);
const IN = .34, OUT = .66;   // p where the page lands flat, and where it starts to turn away

export class PageTurn {
  constructor(root) {
    this.root = root; this.page = root.querySelector('.turn-page'); this.shade = root.querySelector('.turn-shade');
    this.title = root.querySelector('.turn-title'); this.lede = root.querySelector('.turn-lede'); this.key = null; this.p = -1;
  }
  set(p, info) {
    if (info && info.key !== this.key) { this.key = info.key; this.title.textContent = info.title; this.lede.textContent = info.lede || ''; }
    if (p === this.p) return; this.p = p;
    const on = p > 0 && p < 1;
    this.root.classList.toggle('on', on);
    if (!on) return;
    let rot, origin, lift;
    if (p < IN) { const k = ease(p / IN); rot = 100 * (1 - k); origin = 'right center'; lift = 1 - k; }        // swinging in
    else if (p < OUT) { rot = 0; origin = 'left center'; lift = 0; }                                         // lying flat
    else { const k = ease((p - OUT) / (1 - OUT)); rot = -100 * k; origin = 'left center'; lift = k; }        // turning away
    const hold = clamp((p - IN) / (OUT - IN)), float = Math.sin(hold * Math.PI) * -6;
    this.page.style.transformOrigin = origin;
    this.page.style.transform = `perspective(2200px) rotateY(${rot.toFixed(2)}deg) translateY(${float.toFixed(1)}px)`;
    // the page darkens as it tilts away from the light, and its shadow grows while it is lifted
    this.shade.style.opacity = (Math.min(1, Math.abs(rot) / 90) * .55).toFixed(3);
    this.page.style.setProperty('--lift', lift.toFixed(3));
    // the words settle in once it lands, and the underline draws itself
    this.root.style.setProperty('--hold', clamp((p - IN + .04) / .14).toFixed(3));
  }
}
