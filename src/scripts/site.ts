// Calm Technical Prestige — restrained, accessible interactions.
// No animation libraries. Everything degrades under reduced motion.

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* --- Scroll reveals ------------------------------------------------------ */
function initReveals(): void {
  const items = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
  if (reducedMotion || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const mobileReveal = window.matchMedia("(max-width: 760px)").matches;
  const io = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    mobileReveal
      ? { rootMargin: "0px 0px 18% 0px", threshold: 0.01 }
      : { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
  items.forEach((el) => io.observe(el));
}

/* --- Sticky / condensing nav --------------------------------------------- */
function initStickyNav(): void {
  const bar = document.querySelector<HTMLElement>("[data-topbar]");
  if (!bar) return;
  let ticking = false;
  const update = () => {
    bar.classList.toggle("is-scrolled", window.scrollY > 12);
    ticking = false;
  };
  update();
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
}

/* --- Active section + sliding indicator ---------------------------------- */
function initActiveNav(): void {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-nav-link]"));
  const indicator = document.querySelector<HTMLElement>("[data-nav-indicator]");
  if (!links.length || !("IntersectionObserver" in window)) return;
  const sections = links
    .map((l) => document.getElementById(l.dataset.navLink ?? ""))
    .filter((el): el is HTMLElement => Boolean(el));

  let activeId: string | null = null;
  let navClickLocked = false;
  let clickTargetId: string | null = null;
  let clickUnlockTimer = 0;

  const moveIndicator = (link: HTMLElement | null, instant = false) => {
    if (!indicator) return;
    if (!link) {
      indicator.classList.remove("is-active");
      return;
    }
    indicator.style.transition = instant ? "none" : "";
    indicator.style.transform = `translateX(${link.offsetLeft}px)`;
    indicator.style.width = `${link.offsetWidth}px`;
    indicator.classList.add("is-active");
  };

  const setActive = (id: string | null, instant = false) => {
    activeId = id;
    links.forEach((l) => l.setAttribute("aria-current", l.dataset.navLink === id ? "true" : "false"));
    moveIndicator(links.find((l) => l.dataset.navLink === id) ?? null, instant);
  };

  const viewedSectionId = (): string | null => {
    const probeY = window.innerHeight * 0.42;
    const containing = sections.find((section) => {
      const rect = section.getBoundingClientRect();
      return rect.top <= probeY && rect.bottom >= probeY;
    });
    if (containing) return containing.id;

    const nearest = sections
      .map((section) => {
        const rect = section.getBoundingClientRect();
        return { id: section.id, distance: Math.abs(rect.top - probeY) };
      })
      .sort((a, b) => a.distance - b.distance)[0];
    return nearest?.id ?? activeId;
  };

  const io = new IntersectionObserver(
    (entries) => {
      if (navClickLocked || !entries.some((entry) => entry.isIntersecting)) return;
      setActive(viewedSectionId());
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );
  sections.forEach((s) => io.observe(s));

  const unlockNavClick = () => {
    if (clickTargetId) {
      setActive(clickTargetId, true);
      if (indicator) {
        void indicator.offsetWidth;
        indicator.style.transition = "";
      }
    }
    navClickLocked = false;
    clickTargetId = null;
  };

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.dataset.navLink ?? null;
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;

      event.preventDefault();
      navClickLocked = true;
      clickTargetId = id;

      const fromId = viewedSectionId();
      if (fromId && fromId !== id) {
        setActive(fromId, true);
        if (indicator) void indicator.offsetWidth; // commit the current-section position
        window.requestAnimationFrame(() => {
          if (indicator) indicator.style.transition = "";
          setActive(id);
        });
      } else {
        if (indicator) indicator.style.transition = "";
        setActive(id);
      }

      target.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
      window.history.pushState(null, "", link.href);

      window.clearTimeout(clickUnlockTimer);
      clickUnlockTimer = window.setTimeout(unlockNavClick, 3000);
    });
  });

  window.addEventListener(
    "scrollend",
    () => {
      if (!navClickLocked) return;
      window.clearTimeout(clickUnlockTimer);
      window.setTimeout(unlockNavClick, 80);
    },
    { passive: true }
  );

  window.addEventListener(
    "resize",
    () => {
      if (activeId) moveIndicator(links.find((l) => l.dataset.navLink === activeId) ?? null);
    },
    { passive: true }
  );
}

/* --- Mobile drawer ------------------------------------------------------- */
function initDrawer(): void {
  const toggle = document.querySelector<HTMLButtonElement>("[data-nav-toggle]");
  const drawer = document.querySelector<HTMLElement>("[data-drawer]");
  if (!toggle || !drawer) return;

  const links = Array.from(drawer.querySelectorAll<HTMLElement>("[data-drawer-link]"));
  const focusable = () =>
    Array.from(drawer.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));

  const setOpen = (open: boolean) => {
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) {
      drawer.hidden = false;
      window.requestAnimationFrame(() => focusable()[0]?.focus());
    } else {
      window.setTimeout(() => {
        if (!document.body.classList.contains("nav-open")) drawer.hidden = true;
      }, 340);
      toggle.focus();
    }
  };

  toggle.addEventListener("click", () => setOpen(!document.body.classList.contains("nav-open")));
  links.forEach((l) => l.addEventListener("click", () => setOpen(false)));

  document.addEventListener("keydown", (e) => {
    if (!document.body.classList.contains("nav-open")) return;
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Tab") {
      const f = focusable();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  window.matchMedia("(min-width: 1041px)").addEventListener("change", (e) => {
    if (e.matches) setOpen(false);
  });
}

/* --- Project filters (FLIP) ---------------------------------------------- */
function initFilters(): void {
  const group = document.querySelector<HTMLElement>("[data-filters]");
  const grid = document.querySelector<HTMLElement>("[data-archive]");
  if (!group || !grid) return;

  const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>("[data-filter]"));
  const cards = Array.from(grid.querySelectorAll<HTMLElement>("[data-cats]"));
  const empty = grid.querySelector<HTMLElement>("[data-archive-empty]");

  const matches = (card: HTMLElement, filter: string) =>
    filter === "All" || (card.dataset.cats ?? "").split("|").includes(filter);

  const apply = (filter: string) => {
    const firstRects = new Map<HTMLElement, DOMRect>();
    cards.forEach((c) => {
      if (!c.classList.contains("is-hidden")) firstRects.set(c, c.getBoundingClientRect());
    });

    let shown = 0;
    cards.forEach((card) => {
      const match = matches(card, filter);
      card.classList.toggle("is-hidden", !match);
      if (match) shown += 1;
    });
    if (empty) empty.hidden = shown !== 0;

    if (reducedMotion) return;

    cards.forEach((card) => {
      if (card.classList.contains("is-hidden")) return;
      const first = firstRects.get(card);
      if (first) {
        const last = card.getBoundingClientRect();
        const dx = first.left - last.left;
        const dy = first.top - last.top;
        if (dx || dy) {
          card.style.transition = "none";
          card.style.transform = `translate(${dx}px, ${dy}px)`;
          void card.offsetWidth; // reflow
          card.style.transition = "";
          card.style.transform = "";
        }
      } else {
        // newly shown: fade + scale in
        card.style.transition = "none";
        card.classList.add("is-appearing");
        void card.offsetWidth;
        card.style.transition = "";
        card.classList.remove("is-appearing");
      }
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      apply(btn.dataset.filter ?? "All");
    });
  });
}

/* --- Count-up on case-study metrics -------------------------------------- */
function initCountUp(): void {
  const groups = Array.from(document.querySelectorAll<HTMLElement>(".case-metrics"));
  if (!groups.length || reducedMotion || !("IntersectionObserver" in window)) return;

  const animate = (el: HTMLElement) => {
    const raw = (el.textContent ?? "").trim();
    const m = raw.match(/^([\d,]+(?:\.\d+)?)(.*)$/);
    if (!m) return; // non-numeric values stay as-is
    const numStr = m[1];
    const suffix = m[2];
    const hasComma = numStr.includes(",");
    const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
    const target = parseFloat(numStr.replace(/,/g, ""));
    if (!isFinite(target)) return;

    const fmt = (v: number) => {
      const fixed = v.toFixed(decimals);
      const out = hasComma
        ? Number(fixed).toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        : fixed;
      return out + suffix;
    };

    const duration = 700;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(target * eased);
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = fmt(target);
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll<HTMLElement>(".v").forEach(animate);
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );
  groups.forEach((g) => io.observe(g));
}

/* --- Pointer-reactive card sheen ----------------------------------------- */
function initCardGlow(): void {
  if (reducedMotion || !window.matchMedia("(pointer: fine)").matches) return;
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>(".xp, .edu-card, .skill-card, a.acard")
  );
  cards.forEach((card) => {
    let raf = 0;
    card.addEventListener(
      "pointermove",
      (e) => {
        const r = card.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        if (!raf) {
          raf = requestAnimationFrame(() => {
            raf = 0;
            card.style.setProperty("--mx", `${x}%`);
            card.style.setProperty("--my", `${y}%`);
          });
        }
      },
      { passive: true }
    );
    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--mx", "-100%");
      card.style.setProperty("--my", "-100%");
    });
  });
}

/* --- Magnetic primary buttons -------------------------------------------- */
function initMagnetic(): void {
  if (reducedMotion || !window.matchMedia("(pointer: fine)").matches) return;
  const btns = Array.from(document.querySelectorAll<HTMLElement>(".btn--primary"));
  btns.forEach((btn) => {
    let raf = 0;
    btn.addEventListener(
      "pointermove",
      (e) => {
        const r = btn.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        if (!raf) {
          raf = requestAnimationFrame(() => {
            raf = 0;
            btn.style.transform = `translate(${dx * 0.16}px, ${dy * 0.22}px)`;
          });
        }
      },
      { passive: true }
    );
    btn.addEventListener("pointerleave", () => {
      btn.style.transform = "";
    });
  });
}

/* --- Copy email ---------------------------------------------------------- */
function initCopyEmail(): void {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-copy]"));
  buttons.forEach((btn) => {
    const ok = btn.parentElement?.querySelector<HTMLElement>("[data-copy-ok]");
    btn.addEventListener("click", async () => {
      const email = btn.dataset.copy ?? "";
      try {
        await navigator.clipboard.writeText(email);
        if (ok) {
          ok.textContent = "Copied to clipboard";
          ok.classList.add("show");
          window.setTimeout(() => ok.classList.remove("show"), 2200);
        }
      } catch {
        window.location.href = `mailto:${email}`;
      }
    });
  });
}

/* --- Flagship cards: click to open, one open at a time ------------------- */
function initFlagships(): void {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".pcard-summary"));
  const setOpen = (btn: HTMLButtonElement, open: boolean) => {
    btn.setAttribute("aria-expanded", String(open));
    btn.closest(".pcard")?.classList.toggle("is-open", open);
  };
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      buttons.forEach((b) => setOpen(b, b === btn && open));
    });
  });
}

/* --- Hero peek: a card that flips between the 2D sketchbook and the 3D island. The shown side's preview plays
   while on screen (never under reduced motion), and opening a version runs its exit transition first. */
// The creases a crumple leaves, drawn once before anything moves, in screen px: long folds and facets across the page,
// then the tighter facets, blank back-of-sheet patches and round shading of the ball (radius R around cx, cy).
function creaseArt(W: number, H: number, cx: number, cy: number, R: number): string[] {
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const pt = (p: number[]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const mesh = (rows: number[][][], lit: number, dark: number, back: number, folds: number) => {
    let fill = "", lines = "";
    for (let j = 0; j < rows.length - 1; j += 1) for (let i = 0; i < rows[j].length - 1; i += 1) {
      const [a, b, c, d] = [rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]];
      const cut = Math.random() < 0.5; // which diagonal splits the cell
      for (const t of cut ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]]) {
        const v = rnd(-1, 1), paper = Math.random() < back;
        const col = paper ? `hsla(68,22%,${rnd(80, 95).toFixed(0)}%,.94)` : v > 0 ? `rgba(255,255,255,${(v * lit).toFixed(3)})` : `rgba(31,44,35,${(-v * dark).toFixed(3)})`;
        fill += `<polygon points="${t.map(pt).join(" ")}" fill="${col}"/>`;
      }
      for (const [p, q] of [cut ? [a, c] : [b, d], [a, b], [a, d]]) if (Math.random() < folds) lines += `M${pt(p)}L${pt(q)}`;
    }
    // a crease is a thin lit ridge beside its own shadow
    return `${fill}<path d="${lines}" fill="none" stroke="rgba(31,44,35,.3)" stroke-width="2.6" transform="translate(1 1.2)"/><path d="${lines}" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.1"/>`;
  };
  // an irregular triangle mesh over a box: a jittered grid, its edge points left on the edge so it covers the box
  const grid = (x0: number, y0: number, w: number, h: number, nx: number, ny: number) =>
    Array.from({ length: ny + 1 }, (_, j) => Array.from({ length: nx + 1 }, (_, i) => [
      x0 + (w * i) / nx + (i % nx ? rnd(-0.36, 0.36) * (w / nx) : 0),
      y0 + (h * j) / ny + (j % ny ? rnd(-0.36, 0.36) * (h / ny) : 0),
    ]));
  const svg = (s: string) => `<svg class="crease" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${s}</svg>`;
  const B = R * 1.2;
  return [
    svg(mesh(grid(0, 0, W, H, Math.max(3, Math.round(W / 230)), Math.max(4, Math.round(H / 200))), 0.13, 0.15, 0, 0.36)),
    svg(mesh(grid(cx - B, cy - B, B * 2, B * 2, 7, 7), 0.3, 0.44, 0.42, 0.55)),
    // light from the top left, and the ball darkening toward its rim
    svg(
      `<defs><radialGradient id="yj-ball-lit" cx=".34" cy=".3" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="yj-ball-rim" cx=".56" cy=".6" r=".56"><stop offset=".45" stop-color="#1f2c23" stop-opacity="0"/><stop offset="1" stop-color="#1f2c23" stop-opacity=".78"/></radialGradient></defs>` +
      `<circle cx="${cx}" cy="${cy}" r="${R * 1.13}" fill="url(#yj-ball-lit)"/><circle cx="${cx}" cy="${cy}" r="${R * 1.13}" fill="url(#yj-ball-rim)"/>`
    ),
  ];
}
// Leaving for the sketchbook: the page itself (not a picture of it) creases, balls up near where it was clicked, hops
// and drops away into the dark. Only transform, clip-path and opacity animate. The body keeps its own background while
// it moves (see .crumpling), and the returned promise settles once the ball is gone.
function exit2d(from: DOMRect): Promise<void> {
  const root = document.documentElement, body = document.body, vv = window.visualViewport;
  // what is on screen, in page px (on a phone that can be less than the layout viewport)
  const X = vv ? vv.pageLeft : scrollX, Y = vv ? vv.pageTop : scrollY, W = vv ? vv.width : innerWidth, H = vv ? vv.height : innerHeight;
  const m = Math.min(W, H), R = m * 0.44, s = 0.41; // the ball: radius in page px, and its scale (0.18 of the screen)
  const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
  const fx = from.left + from.width / 2 + scrollX - X, fy = from.top + from.height / 2 + scrollY - Y;
  const cx = clamp(W / 2 + (fx - W / 2) * 0.4, R * 1.13, W - R * 1.13), cy = clamp(H / 2 + (fy - H / 2) * 0.4, R * 1.13, H - R * 1.13);
  // one ray per outline point, plus the four corners, so the first outline is exactly the screen
  const TAU = Math.PI * 2, ang = (a: number) => ((a % TAU) + TAU) % TAU;
  const rays = Array.from({ length: 52 }, (_, i) => (i / 52) * TAU + (Math.random() - 0.5) * 0.05);
  const corners = [[0, 0], [W, 0], [W, H], [0, H]].map(([x, y]) => ang(Math.atan2(y - cy, x - cx)));
  const pts = [...rays.map((a) => [ang(a), 0]), ...corners.map((a) => [a, 1])].sort((a, b) => a[0] - b[0]).map(([a, corner]) => {
    const c = Math.cos(a), n = Math.sin(a);
    const edge = Math.min(c > 1e-6 ? (W - cx) / c : c < -1e-6 ? -cx / c : Infinity, n > 1e-6 ? (H - cy) / n : n < -1e-6 ? -cy / n : Infinity);
    const lump = R * clamp(0.9 + 0.09 * Math.sin(3 * a + 1) + 0.06 * Math.sin(7 * a) + (Math.random() - 0.5) * 0.16, 0.8, 1.12);
    return { c, n, d: [edge, edge * (corner ? 0.9 : 1 - Math.random() * 0.05), (edge + lump) / 2 * (0.92 + Math.random() * 0.16), lump] };
  });
  const outline = (k: number) => `polygon(${pts.map((p) => `${(X + cx + p.c * p.d[k]).toFixed(1)}px ${(Y + cy + p.n * p.d[k]).toFixed(1)}px`).join(",")})`;
  const cam = (tx: number, ty: number, rx: number, ry: number, rz: number, sx: number, sy = sx) =>
    `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) perspective(1400px) rotateX(${rx}deg) rotateY(${ry}deg) rotate(${rz}deg) scale(${sx}, ${sy})`;

  const art = creaseArt(W, H, cx, cy, R).map((html) => {
    const t = document.createElement("template");
    t.innerHTML = html;
    const el = t.content.firstElementChild as SVGSVGElement;
    el.style.left = `${X}px`;
    el.style.top = `${Y}px`;
    body.append(el);
    return el;
  });
  const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]'), themeWas = theme?.content;
  const hold = (e: Event) => e.preventDefault(); // no scrolling out from under the ball
  const HOLD = ["wheel", "touchmove", "keydown"];
  HOLD.forEach((t) => addEventListener(t, hold, { passive: false }));
  root.style.setProperty("--cy", `${scrollY}px`);
  root.style.setProperty("--ch", `${innerHeight}px`);
  body.style.transformOrigin = `${X + cx}px ${Y + cy}px`;
  root.classList.add("crumpling");
  if (theme) theme.content = "#000";

  let anims: Animation[] = [], timer = 0;
  const undo = () => {
    window.clearTimeout(timer);
    anims.forEach((a) => a.cancel());
    art.forEach((el) => el.remove());
    HOLD.forEach((t) => removeEventListener(t, hold));
    root.classList.remove("crumpling");
    body.style.transformOrigin = "";
    if (theme && themeWas) theme.content = themeWas;
  };
  // back from the sketchbook (page cache) or a navigation that never happened: the page comes back flat
  addEventListener("pageshow", (e) => { if (e.persisted) undo(); }, { once: true });
  timer = window.setTimeout(undo, 9000);

  return new Promise((done) => {
    // two frames to lay out the creases and promote the page before anything moves
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const o = { duration: 1100, fill: "forwards" as FillMode };
      const fade = (el: Element, a: number, b: number) => el.animate([{ offset: 0, opacity: 0 }, { offset: a, opacity: 0, easing: "ease-out" }, { offset: b, opacity: 1 }, { offset: 1, opacity: 1 }], o);
      const fall = H - cy + R * s * 1.7, drift = W * 0.04;
      anims = [
        body.animate([
          { offset: 0, transform: cam(0, 0, 0, 0, 0, 1), easing: "cubic-bezier(.3,.7,.4,1)" },
          { offset: 0.12, transform: cam(0, 0, 8, -6, -2, 0.95, 0.94), easing: "cubic-bezier(.55,0,.6,.9)" },
          { offset: 0.33, transform: cam(0, 0, 14, 10, -13, 0.64, 0.62), easing: "cubic-bezier(.2,.6,.3,1)" },
          { offset: 0.5, transform: cam(0, 0, 3, 2, -30, s), easing: "ease-in-out" },
          { offset: 0.57, transform: cam(0, H * 0.01, 1, 1, -34, s * 1.07, s * 0.91), easing: "cubic-bezier(.2,.7,.4,1)" },
          { offset: 0.67, transform: cam(drift * 0.3, -H * 0.05, 0, 0, -44, s * 0.98, s * 1.03), easing: "cubic-bezier(.55,0,.85,.45)" },
          { offset: 1, transform: cam(drift, fall, 0, 0, -160, s * 0.8) },
        ], o),
        body.animate([
          { offset: 0, clipPath: outline(0), easing: "cubic-bezier(.3,.7,.4,1)" },
          { offset: 0.12, clipPath: outline(1), easing: "cubic-bezier(.55,0,.6,.9)" },
          { offset: 0.33, clipPath: outline(2), easing: "cubic-bezier(.2,.6,.3,1)" },
          { offset: 0.5, clipPath: outline(3) },
          { offset: 1, clipPath: outline(3) },
        ], o),
        fade(art[0], 0.02, 0.28),
        fade(art[1], 0.22, 0.48),
        fade(art[2], 0.3, 0.52),
      ];
      anims[0].finished.then(() => done(), () => {});
    }));
  });
}
// Voxel cubes rain down from the card outward until the page is night sky, then the island takes over.
function exit3d(from: DOMRect): Promise<void> {
  const el = document.createElement("div");
  el.className = "exit-3d";
  const c = document.createElement("canvas");
  el.append(c);
  document.body.append(el);
  // coming Back to this page from the town restores it as it was left: take the cube wall down again
  addEventListener("pageshow", (e) => { if (e.persisted) el.remove(); }, { once: true });
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  c.width = W * dpr; c.height = H * dpr;
  const g = c.getContext("2d")!;
  g.scale(dpr, dpr);
  const S = Math.max(34, Math.round(Math.min(W, H) / 16)), cols = Math.ceil(W / S), rows = Math.ceil(H / S);
  const ox = from.left + from.width / 2, oy = from.top + from.height / 2, far = Math.hypot(Math.max(ox, W - ox), Math.max(oy, H - oy));
  const tiles: { x: number; y: number; d: number; glow: boolean; tone: number }[] = [];
  for (let j = 0; j < rows; j += 1) for (let i = 0; i < cols; i += 1) {
    const x = i * S, y = j * S, h = Math.abs(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1;
    tiles.push({ x, y, d: (Math.hypot(x + S / 2 - ox, y + S / 2 - oy) / far) * 520 + h * 90, glow: h < 0.07, tone: h });
  }
  const t0 = performance.now(), DUR = 260;
  return new Promise((done) => {
    const frame = (now: number) => {
      const t = now - t0;
      g.clearRect(0, 0, W, H);
      let all = true;
      for (const q of tiles) {
        const k = Math.min(1, Math.max(0, (t - q.d) / DUR));
        if (k < 1) all = false;
        if (k <= 0) continue;
        const e = 1 - (1 - k) ** 3, drop = (1 - e) * -S * 1.6, s = S * (0.55 + 0.45 * e);
        const x = q.x + (S - s) / 2, y = q.y + (S - s) / 2 + drop;
        g.globalAlpha = Math.min(1, k * 2.2);
        g.fillStyle = q.glow ? "#1d7f96" : q.tone < 0.5 ? "#1b1830" : "#221e3a"; g.fillRect(x, y, s, s); // face
        g.fillStyle = q.glow ? "#6ff2ff" : "#2e2a4d"; g.fillRect(x, y, s, s * 0.16); // lit top edge
        g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(x + s * 0.86, y, s * 0.14, s); // shaded side
      }
      g.globalAlpha = 1;
      if (all || t > 1400) { window.setTimeout(done, 80); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
function initReelPeek(): void {
  const link = document.querySelector<HTMLAnchorElement>(".reel-peek");
  if (!link) return;
  const buttons = [...document.querySelectorAll<HTMLButtonElement>(".peek-switch button")];
  const sides = { "2d": link.querySelector<HTMLElement>(".peek-side--2d"), "3d": link.querySelector<HTMLElement>(".peek-side--3d") };
  const videos = { "2d": link.querySelector<HTMLVideoElement>('video[data-peek="2d"]'), "3d": link.querySelector<HTMLVideoElement>('video[data-peek="3d"]') };
  let mode: "2d" | "3d" = "2d", onScreen = false, leaving = false;
  const sync = () => {
    for (const m of ["2d", "3d"] as const) {
      const v = videos[m];
      if (!v) continue;
      if (m === mode && onScreen && !leaving && !reducedMotion) { if (v.preload === "none") v.preload = "auto"; v.play().catch(() => {}); } // missing media: poster stays
      else v.pause();
    }
  };
  const setMode = (m: "2d" | "3d") => {
    mode = m;
    link.dataset.mode = m;
    link.href = link.getAttribute(m === "3d" ? "data-href-3d" : "data-href-2d") || link.href; // (dataset leaves "-3d" as is, so read attributes)
    link.setAttribute("aria-label", m === "3d" ? "Open the 3D island version of this portfolio" : "Open the 2D sketchbook version of this portfolio");
    sides["2d"]?.setAttribute("aria-hidden", String(m !== "2d"));
    sides["3d"]?.setAttribute("aria-hidden", String(m !== "3d"));
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.mode === m));
    sync();
  };
  buttons.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode === "3d" ? "3d" : "2d")));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); }, { threshold: 0.25 }).observe(link);
  }
  // Leaving: remember which door was taken so the next page can finish the move, then play this half of it.
  link.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    try { sessionStorage.setItem("yj-arrive", mode); } catch { /* private mode: no hand-off, still navigates */ }
    if (reducedMotion) return;
    e.preventDefault();
    const href = link.href;
    const go = () => { window.location.href = href; };
    if (mode === "3d") { exit3d(link.getBoundingClientRect()).then(go); return; }
    leaving = true; // the previews hold still while the page crumples
    sync();
    document.head.append(Object.assign(document.createElement("link"), { rel: "prefetch", href })); // fetched while it plays
    exit2d(link.getBoundingClientRect()).then(go);
  });
  addEventListener("pageshow", (e) => { if (e.persisted) { leaving = false; sync(); } });
}

/* --- Hero callout arrow: redrawn from the end of the note to the peek card, so it lands on the card at any width */
function initReelArrow(): void {
  const callout = document.querySelector<HTMLElement>(".reel-callout");
  const note = callout?.querySelector<HTMLElement>(".reel-note");
  const svg = callout?.querySelector<SVGSVGElement>(".reel-arrow--side");
  const card = document.querySelector<HTMLElement>(".reel-peek");
  const line = svg?.querySelector<SVGPathElement>(".reel-arrow-line");
  const head = svg?.querySelector<SVGPathElement>(".reel-arrow-head");
  if (!callout || !note || !svg || !card || !line || !head) return;
  const fit = () => {
    const n = note.getBoundingClientRect(), c = card.getBoundingClientRect(), o = callout.getBoundingClientRect();
    if (c.left < n.right + 40) return; // stacked layout: the downward arrow takes over (CSS)
    const sx = n.right + 10 - o.left, sy = n.top + n.height * 0.55 - o.top;
    const ex = c.left - 16 - o.left, ey = c.top + c.height * 0.72 - o.top;
    const dx = ex - sx;
    const c1 = [sx + dx * 0.35, sy + 48], c2 = [ex - dx * 0.3, ey + 34];
    const pad = 24;
    const xs = [sx, ex, c1[0], c2[0]], ys = [sy, ey, c1[1], c2[1]];
    const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad, w = Math.max(...xs) + pad - minX, h = Math.max(...ys) + pad - minY;
    svg.setAttribute("viewBox", `${minX} ${minY} ${w} ${h}`);
    Object.assign(svg.style, { position: "absolute", left: `${minX}px`, top: `${minY}px`, width: `${w}px`, height: `${h}px`, margin: "0" });
    line.setAttribute("d", `M${sx} ${sy} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${ex} ${ey}`);
    // the head follows the curve's last tangent
    const ang = Math.atan2(ey - c2[1], ex - c2[0]), len = 13, spread = 0.5;
    const p1 = [ex - len * Math.cos(ang - spread), ey - len * Math.sin(ang - spread)];
    const p2 = [ex - len * Math.cos(ang + spread), ey - len * Math.sin(ang + spread)];
    head.setAttribute("d", `M${p1[0]} ${p1[1]} L${ex} ${ey} L${p2[0]} ${p2[1]}`);
  };
  fit();
  window.addEventListener("resize", fit);
  document.fonts?.ready.then(fit);
  window.setTimeout(fit, 1400); // after the reveal transitions settle
}

function init(): void {
  initReveals();
  initReelArrow();
  initFlagships();
  initReelPeek();
  initStickyNav();
  initActiveNav();
  initDrawer();
  initFilters();
  initCountUp();
  initCardGlow();
  initMagnetic();
  initCopyEmail();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
