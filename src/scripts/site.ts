import { rolePhrases } from "../data/portfolio";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function initCursorBloom() {
  if (reducedMotion || !window.matchMedia("(pointer: fine)").matches) return;

  let raf = 0;
  let x = 50;
  let y = 32;

  const update = () => {
    raf = 0;
    document.documentElement.style.setProperty("--cursor-x", `${x}%`);
    document.documentElement.style.setProperty("--cursor-y", `${y}%`);
  };

  const track = (event: MouseEvent | PointerEvent) => {
      x = (event.clientX / window.innerWidth) * 100;
      y = (event.clientY / window.innerHeight) * 100;

      if (!raf) {
        raf = requestAnimationFrame(update);
      }
  };

  window.addEventListener("pointermove", track, { passive: true });
  window.addEventListener("mousemove", track, { passive: true });
}

function initTypewriter() {
  const target = document.querySelector<HTMLElement>("#role-typewriter");
  if (!target) return;

  if (reducedMotion) {
    target.textContent = rolePhrases[0];
    return;
  }

  let phraseIndex = 0;
  let charIndex = 0;
  let deleting = false;
  let resting = false;

  const type = () => {
    const phrase = rolePhrases[phraseIndex];

    if (!deleting) {
      charIndex += 1;
      target.textContent = phrase.slice(0, charIndex);

      if (charIndex === phrase.length) {
        deleting = true;
        resting = true;
        window.setTimeout(() => {
          resting = false;
          type();
        }, 1350);
        return;
      }
    } else {
      charIndex -= 1;
      target.textContent = phrase.slice(0, charIndex);

      if (charIndex === 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % rolePhrases.length;
        charIndex = 1;
        target.textContent = rolePhrases[phraseIndex].slice(0, charIndex);
      }
    }

    if (!resting) {
      window.setTimeout(type, deleting ? 38 : 72);
    }
  };

  target.textContent = "";
  type();
}

function initBootScreen() {
  const boot = document.querySelector<HTMLElement>(".boot-screen");
  if (!boot) return;

  window.setTimeout(
    () => {
      boot.classList.add("is-complete");
      boot.style.opacity = "0";
      window.setTimeout(() => {
        boot.style.visibility = "hidden";
        boot.remove();
      }, reducedMotion ? 0 : 380);
    },
    reducedMotion ? 80 : 850,
  );
}

function initPixelField() {
  const canvas = document.querySelector<HTMLCanvasElement>("#pixel-field");
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;

  const colors = ["#ffb000", "#9dff7a", "#ff6b35", "#ffd166"];
  const points = Array.from({ length: 54 }, (_, index) => ({
    x: Math.random(),
    y: Math.random(),
    size: index % 10 === 0 ? 3 : 2,
    color: colors[index % colors.length],
  }));

  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;

  const resize = () => {
    dpr = 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const draw = () => {
    raf = 0;
    const scrollOffset = window.scrollY * 0.06;
    context.clearRect(0, 0, width, height);
    context.globalAlpha = 0.64;

    const grid = width < 720 ? 34 : 48;
    const gridOffsetX = scrollOffset % grid;
    const gridOffsetY = (scrollOffset * 0.7) % grid;

    context.strokeStyle = "rgba(255, 176, 0, 0.045)";
    context.lineWidth = 1;
    for (let x = gridOffsetX; x < width; x += grid) {
      context.beginPath();
      context.moveTo(Math.floor(x) + 0.5, 0);
      context.lineTo(Math.floor(x) + 0.5, height);
      context.stroke();
    }
    for (let y = gridOffsetY; y < height; y += grid) {
      context.beginPath();
      context.moveTo(0, Math.floor(y) + 0.5);
      context.lineTo(width, Math.floor(y) + 0.5);
      context.stroke();
    }

    points.forEach((point, index) => {
      const x = Math.floor((point.x * width + scrollOffset * (index % 3)) / 4) * 4;
      const y = Math.floor(((point.y * height + scrollOffset * (index % 5)) % (height + 32)) / 4) * 4;
      context.fillStyle = point.color;
      context.fillRect(x, y, point.size, point.size);
    });
  };

  const scheduleDraw = () => {
    if (raf) return;
    raf = requestAnimationFrame(draw);
  };

  resize();
  draw();
  window.addEventListener("resize", () => {
    resize();
    scheduleDraw();
  });
  window.addEventListener("scroll", scheduleDraw, { passive: true });
}

function initRevealAnimations() {
  const reveals = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));

  if (reducedMotion || !("IntersectionObserver" in window)) {
    reveals.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
  );

  reveals.forEach((element, index) => {
    element.style.setProperty("--reveal-delay", `${Math.min(index % 5, 4) * 45}ms`);
    observer.observe(element);
  });
}

function initExperienceSequence() {
  const sequence = document.querySelector<HTMLElement>(".experience-sequence");
  if (!sequence) return;

  const steps = Array.from(sequence.querySelectorAll<HTMLElement>("[data-experience-step]"));
  if (!steps.length) return;

  let activeIndex = -1;
  let raf = 0;

  const setActive = (nextIndex: number) => {
    if (nextIndex === activeIndex) return;
    activeIndex = nextIndex;

    steps.forEach((step, index) => {
      const isActive = index === activeIndex;
      step.classList.toggle("is-active", isActive);
      step.classList.toggle("is-dim", index < activeIndex);

      if (isActive) {
        const target = step.querySelector<HTMLElement>("[data-experience-typed]");
        if (target && step.dataset.body) {
          target.textContent = step.dataset.body;
          target.classList.remove("is-typed");
          requestAnimationFrame(() => target.classList.add("is-typed"));
        }
      }
    });
  };

  const update = () => {
    raf = 0;

    const viewportLine = window.innerHeight * 0.58;

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    steps.forEach((step, index) => {
      const rect = step.getBoundingClientRect();
      const center = rect.top + rect.height * 0.42;
      const distance = Math.abs(center - viewportLine);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    setActive(nearestIndex);
  };

  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(update);
  };

  if (reducedMotion) {
    setActive(0);
    return;
  }

  update();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
}

function initProjectStack() {
  const stack = document.querySelector<HTMLElement>("[data-project-stack]");
  if (!stack) return;

  const cards = Array.from(stack.querySelectorAll<HTMLAnchorElement>("[data-project-card]"));
  const previousButton = stack.querySelector<HTMLButtonElement>("[data-project-prev]");
  const nextButton = stack.querySelector<HTMLButtonElement>("[data-project-next]");
  const status = stack.querySelector<HTMLElement>("[data-project-status]");
  if (!cards.length || !previousButton || !nextButton) return;

  const configuredFeaturedCount = Number(stack.dataset.featuredCount);
  const featuredCount = Number.isFinite(configuredFeaturedCount)
    ? Math.min(cards.length, Math.max(1, Math.floor(configuredFeaturedCount)))
    : cards.length;
  const hasArchiveProjects = cards.length > featuredCount;
  const seenFeaturedIndexes = new Set<number>([0]);
  let activeIndex = 0;
  let direction: "next" | "prev" = "next";
  let archiveUnlocked = !hasArchiveProjects;

  const wrap = (index: number, length: number) => (index + length) % length;

  const markActiveProjectSeen = () => {
    if (activeIndex < featuredCount) {
      seenFeaturedIndexes.add(activeIndex);
    }

    if (!archiveUnlocked && seenFeaturedIndexes.size >= featuredCount) {
      archiveUnlocked = true;
      stack.dataset.archiveUnlocked = "true";
    }
  };

  const getLineupLength = () => (archiveUnlocked ? cards.length : featuredCount);

  const getNextIndex = () => wrap(activeIndex + 1, getLineupLength());

  const getPreviousIndex = () => {
    if (archiveUnlocked && hasArchiveProjects && direction === "prev" && activeIndex === 1) {
      return cards.length - 1;
    }

    return wrap(activeIndex - 1, getLineupLength());
  };

  const render = () => {
    markActiveProjectSeen();

    const lineupLength = getLineupLength();
    const previousIndex = getPreviousIndex();
    const nextIndex = getNextIndex();

    stack.dataset.direction = direction;

    cards.forEach((card, index) => {
      const isActive = index === activeIndex;
      const isPrevious = index === previousIndex;
      const isNext = index === nextIndex;
      const isInLineup = index < lineupLength;

      card.classList.toggle("is-active", isInLineup && isActive);
      card.classList.toggle("is-prev", isInLineup && isPrevious);
      card.classList.toggle("is-next", isInLineup && isNext);
      card.classList.toggle("is-hidden", !isInLineup || (!isActive && !isPrevious && !isNext));
      card.tabIndex = isActive ? 0 : -1;
      card.setAttribute("aria-hidden", isInLineup && isActive ? "false" : "true");
    });

    if (status) {
      status.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(lineupLength).padStart(2, "0")}`;
    }
  };

  const goTo = (nextIndex: number, nextDirection: "next" | "prev") => {
    direction = nextDirection;
    activeIndex = nextIndex;
    render();
  };

  previousButton.addEventListener("click", () => goTo(getPreviousIndex(), "prev"));
  nextButton.addEventListener("click", () => goTo(getNextIndex(), "next"));

  stack.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(getPreviousIndex(), "prev");
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(getNextIndex(), "next");
    }
  });

  render();
}

document.addEventListener("DOMContentLoaded", () => {
  initBootScreen();
  initCursorBloom();
  initTypewriter();
  initPixelField();
  initRevealAnimations();
  initExperienceSequence();
  initProjectStack();
});
