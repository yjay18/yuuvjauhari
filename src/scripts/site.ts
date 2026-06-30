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
  const io = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
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

  const moveIndicator = (link: HTMLElement | null) => {
    if (!indicator) return;
    if (!link) {
      indicator.classList.remove("is-active");
      return;
    }
    indicator.style.transform = `translateX(${link.offsetLeft}px)`;
    indicator.style.width = `${link.offsetWidth}px`;
    indicator.classList.add("is-active");
  };

  const setActive = (id: string | null) => {
    activeId = id;
    links.forEach((l) => l.setAttribute("aria-current", l.dataset.navLink === id ? "true" : "false"));
    moveIndicator(links.find((l) => l.dataset.navLink === id) ?? null);
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );
  sections.forEach((s) => io.observe(s));

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

  window.matchMedia("(min-width: 761px)").addEventListener("change", (e) => {
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
    document.querySelectorAll<HTMLElement>(".pcard, .skill-card, a.acard")
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

function init(): void {
  initReveals();
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
