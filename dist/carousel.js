/**
 * Destinations carousel (Figma 605:6580) — a draggable, wrap-around strip of
 * hanging cloth tiles. Fully self-contained: the caller only maps a DOM host
 * and hands in the country list/order, the shared physics CONFIG, and hooks to
 * switch the current home country.
 */
import * as K from "./constants.js";
import { createCarouselCloth } from "./cloths.js";

// Desktop center gap ≈ 575px at area 492; side scale ≈ 290/492 ≈ 0.59
const CAROUSEL_GAP_DESKTOP = 575;
const CAROUSEL_AREA_DESKTOP = K.AREA_W;
const CAROUSEL_SIDE_SCALE = 0.58;
const CAROUSEL_SNAP_MS = 520;
const DRAG_HINT_KEY = "budarina-carousel-hint-seen";

function carouselGapPx() {
  const sample =
    document.querySelector(".carousel__item") ||
    document.getElementById("area");
  // Prefer offsetWidth — getBoundingClientRect shrinks with transform:scale on
  // side items, which made spacing collapse whenever Vietnam wasn't centered.
  const w = sample?.offsetWidth || sample?.getBoundingClientRect?.().width;
  if (!w || !Number.isFinite(w) || w < 8) return CAROUSEL_GAP_DESKTOP;
  return (CAROUSEL_GAP_DESKTOP / CAROUSEL_AREA_DESKTOP) * w;
}

function showDragHint(root) {
  if (root.querySelector(".carousel__drag-hint")) return;
  try {
    if (localStorage.getItem(DRAG_HINT_KEY)) return;
  } catch (_) {}
  const hint = document.createElement("div");
  hint.className = "carousel__drag-hint";
  hint.setAttribute("aria-hidden", "true");
  hint.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
    <span>Arraste para explorar</span>
  `;
  root.appendChild(hint);
  // Mark as seen after animation completes
  setTimeout(() => {
    try { localStorage.setItem(DRAG_HINT_KEY, "1"); } catch (_) {}
    hint.classList.add("fade-out");
    hint.addEventListener("transitionend", () => hint.remove());
  }, 4000);
}

function createLoadingSpinner() {
  const spinner = document.createElement("div");
  spinner.className = "carousel__loading";
  spinner.setAttribute("aria-label", "Carregando destinos");
  spinner.innerHTML = `
    <svg class="spinner" viewBox="0 0 50 50" aria-hidden="true">
      <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"
        stroke-dasharray="80 40" stroke-dashoffset="0"/>
    </svg>
  `;
  return spinner;
}

/**
 * @param {{ root, track, countries, order, defaultCountry, config, currentCountryId, setCountry, goHome }} deps
 */
export function initCarousel({
  root,
  track,
  countries,
  order,
  defaultCountry,
  config,
  currentCountryId,
  setCountry,
  goHome
}) {
  if (!root || !track) return null;

  const n = order.length;
  const items = [];
  const cloths = [];

  track.innerHTML = "";
  // Stagger cloth creation to avoid blocking the main thread
  const createClothForItem = (el, country, i) => {
    const stringsHost = el.querySelector(".carousel__strings");
    const spinner = createLoadingSpinner();
    stringsHost.appendChild(spinner);

    // Use requestIdleCallback for non-critical work, fallback to setTimeout
    const schedule = window.requestIdleCallback || ((cb) => setTimeout(cb, 0));
    schedule(() => {
      const cloth = createCarouselCloth(stringsHost, country, config);
      if (cloth) {
        cloths[i] = cloth;
        spinner.remove();
        // Show drag hint on first cloth ready (center item)
        if (i === Math.floor(n / 2)) showDragHint(root);
      } else {
        spinner.remove();
      }
    });
  };

  order.forEach((id, i) => {
    const country = countries[id];
    const el = document.createElement("article");
    el.className = "carousel__item";
    el.dataset.country = id;
    el.setAttribute("role", "option");
    el.setAttribute("aria-label", country.name);
    el.innerHTML = `
      <div class="carousel__area">
        <div class="shadow" aria-hidden="true">
          <img class="shadow__layer shadow__layer--sharp" src="./shadow.svg" alt="" />
          <img class="shadow__layer shadow__layer--soft" src="./shadow.svg" alt="" />
          <img class="shadow__layer shadow__layer--softer" src="./shadow.svg" alt="" />
          <img class="shadow__layer shadow__layer--softest" src="./shadow.svg" alt="" />
        </div>
        <div class="strings carousel__strings" aria-hidden="true"></div>
        <div class="roof" aria-hidden="true">
          <img src="${country.roof}" alt="" draggable="false" />
        </div>
      </div>
    `;
    track.appendChild(el);
    items.push(el);
    createClothForItem(el, country, i);
  });

  let index = order.indexOf(currentCountryId);
  if (index < 0) index = order.indexOf(defaultCountry);
  let animRaf = 0;
  let simRaf = 0;
  let lastSim = performance.now();
  let dragging = false;
  let pointerId = null;
  let startX = 0;
  let startIndex = 0;
  let moved = false;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;

  function wrapDelta(d) {
    let x = d;
    while (x > n / 2) x -= n;
    while (x < -n / 2) x += n;
    return x;
  }

  function scaleFor(absD) {
    if (absD <= 1) {
      return 1 - absD * (1 - CAROUSEL_SIDE_SCALE);
    }
    const extra = Math.min(1, absD - 1);
    return CAROUSEL_SIDE_SCALE * (1 - extra * 0.15);
  }

  function layout() {
    items.forEach((el, i) => {
      const d = wrapDelta(i - index);
      const x = d * carouselGapPx();
      const absD = Math.abs(d);
      const s = scaleFor(absD);
      el.style.transform = `translate3d(${x}px, 0, 0) scale(${s})`;
      el.style.zIndex = String(Math.round(100 - absD * 20));
      el.classList.toggle("is-center", absD < 0.35);
      el.setAttribute("aria-selected", absD < 0.35 ? "true" : "false");
      el.style.opacity = absD > 1.65 ? "0" : "1";
      el.style.pointerEvents = absD > 1.65 ? "none" : "auto";
      if (cloths[i]) cloths[i].setActive(absD <= 1.65);
    });
  }

  function nearestIndex(v) {
    let best = Math.round(v);
    best = ((best % n) + n) % n;
    return best;
  }

  function syncToCountry(id) {
    const i = order.indexOf(id);
    if (i >= 0) index = i;
    layout();
  }

  function animateTo(target, duration = CAROUSEL_SNAP_MS) {
    cancelAnimationFrame(animRaf);
    let delta = wrapDelta(target - index);
    const from = index;
    const to = from + delta;
    const t0 = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - t0) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      index = from + (to - from) * ease;
      if (index > n * 2 || index < -n) {
        index = ((index % n) + n) % n;
      }
      layout();
      if (t < 1) {
        animRaf = requestAnimationFrame(frame);
      } else {
        index = nearestIndex(to);
        layout();
      }
    }
    animRaf = requestAnimationFrame(frame);
  }

  function isDestinationsView() {
    return document.getElementById("stage")?.dataset.view === "destinations";
  }

  function simLoop(now) {
    simRaf = requestAnimationFrame(simLoop);
    if (!isDestinationsView()) {
      lastSim = now;
      return;
    }
    const dt = Math.min(K.DT_MAX, Math.max(K.DT_MIN, now - lastSim));
    lastSim = now;
    for (const cloth of cloths) cloth.tick(dt);
  }
  simRaf = requestAnimationFrame(simLoop);

  function brushFromEvent(e) {
    if (!isDestinationsView() || moved) return;
    for (let i = cloths.length - 1; i >= 0; i--) {
      const cloth = cloths[i];
      if (!cloth) continue;
      const d = Math.abs(wrapDelta(i - index));
      if (d > 1.65) continue;
      if (cloth.containsPoint(e.clientX, e.clientY)) {
        cloth.brush(e.clientX, e.clientY);
        return;
      }
    }
  }

  function onPointerDown(e) {
    if (e.button != null && e.button !== 0) return;
    dragging = true;
    moved = false;
    pointerId = e.pointerId;
    startX = e.clientX;
    startIndex = index;
    lastX = e.clientX;
    lastT = performance.now();
    velocity = 0;
    cancelAnimationFrame(animRaf);
    root.classList.add("is-dragging");
    try {
      root.setPointerCapture(pointerId);
    } catch (_) {}
  }

  function onPointerMove(e) {
    if (dragging && e.pointerId === pointerId) {
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      if (moved) {
        const now = performance.now();
        const dt = Math.max(1, now - lastT);
        const vx = (e.clientX - lastX) / dt; // px / ms
        velocity = velocity * 0.65 + vx * 0.35;
        // Cap so a noisy last frame can't invent a double-skip fling
        velocity = Math.max(-2.2, Math.min(2.2, velocity));
        lastX = e.clientX;
        lastT = now;
        index = startIndex - dx / carouselGapPx();
        layout();
        return;
      }
    }
    // Hover / light press — brush strings
    brushFromEvent(e);
  }

  function onPointerUp(e) {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    root.classList.remove("is-dragging");
    try {
      root.releasePointerCapture(pointerId);
    } catch (_) {}
    pointerId = null;

    if (!moved) {
      const hit = e.target?.closest?.(".carousel__item");
      if (hit) {
        const id = hit.dataset.country;
        const hitIndex = order.indexOf(id);
        if (hit.classList.contains("is-center") && id) {
          setCountry(id, { animate: false });
          goHome();
          return;
        }
        if (hitIndex >= 0) {
          animateTo(hitIndex);
          return;
        }
      }
      animateTo(nearestIndex(index));
      moved = false;
      return;
    }

    const gap = carouselGapPx();
    // Drag-left increases index (content follows finger); fling matches -.
    const flickIndex = Math.max(
      -0.55,
      Math.min(0.55, (-velocity * 140) / gap)
    );
    const releaseNearest = Math.round(index);
    let target = Math.round(index + flickIndex);

    // Never skip a country: settle at most one step from where the finger released
    target = Math.max(releaseNearest - 1, Math.min(releaseNearest + 1, target));

    // Tiny nudge without a real flick → stay on the slide you started from
    const dragged = index - startIndex;
    if (Math.abs(dragged) < 0.2 && Math.abs(flickIndex) < 0.22) {
      target = Math.round(startIndex);
    }

    target = ((target % n) + n) % n;
    animateTo(target);
    moved = false;
    velocity = 0;
  }

  root.addEventListener("pointerdown", onPointerDown);
  root.addEventListener("pointermove", onPointerMove);
  root.addEventListener("pointerup", onPointerUp);
  root.addEventListener("pointercancel", onPointerUp);
  root.addEventListener(
    "wheel",
    (e) => {
      if (!isDestinationsView()) return;
      e.preventDefault();
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      cancelAnimationFrame(animRaf);
      index += delta / carouselGapPx();
      layout();
      clearTimeout(root._wheelSnap);
      root._wheelSnap = setTimeout(() => {
        // Wheel: nearest only — no fling skip
        animateTo(nearestIndex(index));
      }, 80);
    },
    { passive: false }
  );

  root.addEventListener("keydown", (e) => {
    if (!isDestinationsView()) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      animateTo(Math.round(index) - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      animateTo(Math.round(index) + 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const id = order[nearestIndex(index)];
      if (id) {
        setCountry(id, { animate: false });
        goHome();
      }
    }
  });

  layout();
  return {
    layout,
    syncToCountry,
    animateTo,
    centeredId: () => order[nearestIndex(index)]
  };
}