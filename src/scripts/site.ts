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

/* --- Sticky nav state ---------------------------------------------------- */
function initStickyNav(): void {
  const bar = document.querySelector<HTMLElement>("[data-topbar]");
  if (!bar) return;
  let ticking = false;
  const update = () => {
    bar.classList.toggle("is-scrolled", window.scrollY > 8);
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

/* --- Active section in nav ----------------------------------------------- */
function initActiveNav(): void {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-nav-link]"));
  if (!links.length || !("IntersectionObserver" in window)) return;
  const sections = links
    .map((l) => document.getElementById(l.dataset.navLink ?? ""))
    .filter((el): el is HTMLElement => Boolean(el));

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          links.forEach((l) =>
            l.setAttribute("aria-current", l.dataset.navLink === id ? "true" : "false")
          );
        }
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );
  sections.forEach((s) => io.observe(s));
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

  toggle.addEventListener("click", () =>
    setOpen(!document.body.classList.contains("nav-open"))
  );
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

  // Close drawer if resized up to desktop.
  window.matchMedia("(min-width: 761px)").addEventListener("change", (e) => {
    if (e.matches) setOpen(false);
  });
}

/* --- Archive filters ----------------------------------------------------- */
function initFilters(): void {
  const group = document.querySelector<HTMLElement>("[data-filters]");
  const grid = document.querySelector<HTMLElement>("[data-archive]");
  if (!group || !grid) return;

  const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>("[data-filter]"));
  const cards = Array.from(grid.querySelectorAll<HTMLElement>("[data-cats]"));
  const empty = grid.querySelector<HTMLElement>("[data-archive-empty]");

  const apply = (filter: string) => {
    let shown = 0;
    cards.forEach((card) => {
      const cats = (card.dataset.cats ?? "").split("|");
      const match = filter === "All" || cats.includes(filter);
      card.classList.toggle("is-hidden", !match);
      if (match) shown += 1;
    });
    if (empty) empty.hidden = shown !== 0;
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      apply(btn.dataset.filter ?? "All");
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
  initCopyEmail();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
