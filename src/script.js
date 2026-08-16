/**
 * Budarina — interactive string-cloth portfolio.
 * Main orchestrator: boots the home cloth, Tweakpane, country navigation,
 * modal About, carousel destinations, contributions view, and responsive layout.
 * All cloth factories live in ./modules/cloths.js; shared helpers in ./modules/cloth-common.js;
 * copy helpers in ./modules/copy.js; carousel logic in ./modules/carousel.js; contributions
 * wiring in ./modules/contributions-view.js.
 */
import { Pane } from "https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js";
import * as K from "./modules/constants.js";
import { getPointID } from "./utils.js";
import {
  COUNTRIES,
  COUNTRY_ORDER,
  DEFAULT_COUNTRY,
  neighborsOf
} from "./countries.js";
import { chimes } from "./chimes.js";
import {
  Vec2,
  Particle,
  Constraint,
  Input,
  sizeCanvas
} from "./physics.js";
import { escapeHtml, splitTitleChars, applyCountryCopy, copyEnterDuration } from "./modules/copy.js";
import { SERIF_FONT, rasterizeChars, buildHangingGrid, clearAndDrawCloth, clothLocalPoint } from "./modules/cloth-common.js";
import { createCarouselCloth } from "./modules/cloths.js";
import { initCarousel } from "./modules/carousel.js";
import { initContributionsView } from "./modules/contributions-view.js";

const STORAGE_KEY = "budarina-country";

function loadSavedCountry() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && COUNTRIES[saved]) return saved;
  } catch (_) {
    /* ignore - localStorage blocked */
  }
  return DEFAULT_COUNTRY;
}

let currentCountryId = loadSavedCountry();
let transitioning = false;
let countryBinding = null;
let gridWBinding = null;
let gridHBinding = null;

function getCountry() {
  return COUNTRIES[currentCountryId] || COUNTRIES[DEFAULT_COUNTRY];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyClothSettings(country) {
  CONFIG.gridW = country.gridW ?? K.DEFAULT_GRID_W;
  CONFIG.gridH = country.gridH ?? K.DEFAULT_GRID_H;
  try {
    gridWBinding?.refresh();
    gridHBinding?.refresh();
  } catch (_) {
    /* ignore */
  }
}

function updateSideButtons() {
  const { left, right } = neighborsOf(currentCountryId);
  const leftCountry = COUNTRIES[left];
  const rightCountry = COUNTRIES[right];

  const btnLeft = document.getElementById("btnLeft");
  const btnRight = document.getElementById("btnRight");
  const leftIcon = document.getElementById("btnLeftIcon");
  const rightIcon = document.getElementById("btnRightIcon");
  const leftLabel = document.getElementById("btnLeftLabel");
  const rightLabel = document.getElementById("btnRightLabel");

  if (btnLeft && leftCountry) {
    btnLeft.dataset.country = leftCountry.id;
    btnLeft.setAttribute("aria-label", leftCountry.name);
    btnLeft.disabled = transitioning;
    if (leftIcon) leftIcon.src = leftCountry.buttonIcon || leftCountry.roof;
    if (leftLabel) leftLabel.textContent = leftCountry.name;
  }
  if (btnRight && rightCountry) {
    btnRight.dataset.country = rightCountry.id;
    btnRight.setAttribute("aria-label", rightCountry.name);
    btnRight.disabled = transitioning;
    if (rightIcon) rightIcon.src = rightCountry.buttonIcon || rightCountry.roof;
    if (rightLabel) rightLabel.textContent = rightCountry.name;
  }
}

function applyCountryVisuals(country) {
  const roofImg = document.getElementById("roofImg");
  const area = document.getElementById("area");
  if (roofImg) roofImg.src = country.roof;
  if (area) area.dataset.country = country.id;
  applyClothSettings(country);
  applyCountryCopy(country, () => layoutAreaAboveCopy());
  chimes.setCountry(country.id);
  updateSideButtons();
}

function setCountryImmediate(id) {
  if (!COUNTRIES[id]) return;
  currentCountryId = id;
  CONFIG.country = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch (_) {
    /* ignore - localStorage blocked */
  }
  try {
    countryBinding?.refresh();
  } catch (_) {
    /* tweakpane may already be in sync */
  }
  applyCountryVisuals(getCountry());
  rerender();
}

async function transitionTo(id, direction) {
  if (!COUNTRIES[id] || id === currentCountryId || transitioning) return;

  transitioning = true;
  updateSideButtons();

  const scene = document.getElementById("scene");
  const bottom = document.getElementById("bottomCopy");
  const exitX = direction > 0 ? "-110vw" : "110vw";
  const enterX = direction > 0 ? "110vw" : "-110vw";
  const next = COUNTRIES[id];

  if (bottom) {
    bottom.classList.remove("is-entering", "is-in");
    bottom.classList.add("is-leaving");
  }

  if (scene) {
    scene.classList.add("is-animating");
    scene.style.transition = `transform ${K.SCENE_MS}ms var(--ease-scene), opacity ${K.SCENE_MS}ms var(--ease-scene)`;
    scene.style.transform = `translateX(${exitX})`;
    scene.style.opacity = "0.25";
  }

  await sleep(K.SCENE_MS * 0.78);

  setCountryImmediate(id);

  if (scene) {
    scene.style.transition = "none";
    scene.style.transform = `translateX(${enterX})`;
    scene.style.opacity = "0.25";
    void scene.offsetWidth;
    scene.style.transition = `transform ${K.SCENE_MS}ms var(--ease-scene), opacity ${K.SCENE_MS}ms var(--ease-scene)`;
    scene.style.transform = "translateX(0)";
    scene.style.opacity = "1";
  }

  if (bottom) {
    bottom.classList.remove("is-leaving");
    bottom.classList.add("is-entering");
    void bottom.offsetWidth;
    bottom.classList.add("is-in");
  }

  await sleep(Math.max(K.SCENE_MS, copyEnterDuration(next)));

  if (scene) {
    scene.classList.remove("is-animating");
    scene.style.transition = "";
    scene.style.transform = "";
    scene.style.opacity = "";
  }
  if (bottom) {
    bottom.classList.remove("is-entering", "is-in", "is-leaving");
  }

  transitioning = false;
  updateSideButtons();
}

function setCountry(id, opts = {}) {
  if (!COUNTRIES[id]) return;
  if (opts.animate === false || id === currentCountryId) {
    setCountryImmediate(id);
    return;
  }
  const from = COUNTRY_ORDER.indexOf(currentCountryId);
  const to = COUNTRY_ORDER.indexOf(id);
  // Prefer explicit direction; otherwise infer shortest path around the order loop
  let direction = opts.direction;
  if (direction == null) {
    if (from < 0 || to < 0) direction = 1;
    else {
      const n = COUNTRY_ORDER.length;
      const forward = (to - from + n) % n;
      const backward = (from - to + n) % n;
      direction = forward <= backward ? 1 : -1;
    }
  }
  transitionTo(id, direction);
}

const CONFIG = {
  ...K.DEFAULT_PHYSICS,
  width: K.AREA_W,
  height: K.AREA_H,
  gridW: K.DEFAULT_GRID_W,
  gridH: K.DEFAULT_GRID_H,
  contain: false,
  country: currentCountryId,
  chimes: true,
  chimeVolume: K.DEFAULT_CHIME_VOLUME
};

const pane = new Pane({ title: "Play" });
pane.hidden = true;
pane.element.classList.add("budarina-pane");

const fCountry = pane.addFolder({ title: "Destination", expanded: true });
countryBinding = fCountry
  .addBinding(CONFIG, "country", {
    label: "Country",
    options: Object.fromEntries(
      Object.values(COUNTRIES).map((c) => [c.name, c.id])
    )
  })
  .on("change", (ev) => {
    setCountry(ev.value);
  });

const fCloth = pane.addFolder({ title: "Cloth", expanded: true });
const fFeel = pane.addFolder({ title: "Motion & sound", expanded: true });

fCloth.addBinding(CONFIG, "width", {
  step: 1,
  min: 100,
  max: 800,
  label: "Width"
});
fCloth.addBinding(CONFIG, "height", {
  step: 1,
  min: 80,
  max: 700,
  label: "Height"
});
gridWBinding = fCloth.addBinding(CONFIG, "gridW", {
  step: 1,
  min: 2,
  max: 200,
  label: "Columns"
});
gridHBinding = fCloth.addBinding(CONFIG, "gridH", {
  step: 1,
  min: 2,
  max: 100,
  label: "Rows"
});
fFeel.addBinding(CONFIG, "gravity", {
  step: 0.05,
  min: 0,
  max: 2,
  label: "Gravity"
});
fFeel.addBinding(CONFIG, "damping", {
  step: 0.001,
  min: 0.5,
  max: 1.02,
  label: "Damping"
});
fFeel.addBinding(CONFIG, "iterationsPerFrame", {
  step: 1,
  min: 1,
  max: 20,
  label: "Precision"
});
fFeel.addBinding(CONFIG, "stretchFactor", {
  step: 0.01,
  min: 1.0,
  max: 2.0,
  label: "Stretch"
});
fFeel.addBinding(CONFIG, "compressFactor", {
  step: 0.01,
  min: 0.01,
  max: 1.0,
  label: "Compress"
});
fFeel.addBinding(CONFIG, "mouseSize", {
  step: 1,
  min: 100,
  max: 10000,
  label: "Touch radius"
});
fFeel.addBinding(CONFIG, "mouseStrength", {
  step: 1,
  min: 1,
  max: 10,
  label: "Touch force"
});
fFeel.addBinding(CONFIG, "chimes", { label: "Door chimes" }).on(
  "change",
  (ev) => {
    chimes.enabled = ev.value;
  }
);
fFeel
  .addBinding(CONFIG, "chimeVolume", {
    min: 0,
    max: 1,
    step: 0.01,
    label: "Chime volume"
  })
  .on("change", (ev) => {
    chimes.setVolume(ev.value);
  });
fFeel.addBinding(CONFIG, "contain", { label: "Keep in bounds" });

let rafID, input, c;
const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

function rerender() {
  if (input) input.unbind();
  cancelAnimationFrame(rafID);
  main();
}

fCloth.addButton({ title: "Rebuild cloth" }).on("click", rerender);

fCloth.on("change", (ev) => {
  if (ev.last) rerender();
});

// Constraint now reads CONFIG.compressFactor / stretchFactor live, so no
// dispatchEvent here is needed for the feel sliders.

function setPaneOpen(open) {
  pane.hidden = !open;
  const btn = document.getElementById("chatBtn");
  if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
}

document.getElementById("chatBtn")?.addEventListener("click", () => {
  setPaneOpen(pane.hidden);
});

const aboutModal = document.getElementById("aboutModal");
const aboutBtn = document.getElementById("aboutBtn");
let aboutLastFocus = null;

function isAboutOpen() {
  return !!(aboutModal && !aboutModal.hidden);
}

function mountModal(el) {
  if (el && el.parentElement !== document.body) {
    document.body.appendChild(el);
  }
}

function setAboutOpen(open) {
  if (!aboutModal) return;
  const want = !!open;
  if (want === isAboutOpen()) {
    if (want) {
      mountModal(aboutModal);
      const closeBtn = document.getElementById("aboutClose");
      (closeBtn || aboutModal).focus?.();
    }
    return;
  }
  if (want) {
    if (isContributionsView()) window.setView?.("home");
    aboutLastFocus = document.activeElement;
    mountModal(aboutModal);
    aboutModal.hidden = false;
    aboutModal.removeAttribute("hidden");
    aboutModal.setAttribute("aria-hidden", "false");
    aboutBtn?.setAttribute("aria-expanded", "true");
    const closeBtn = document.getElementById("aboutClose");
    (closeBtn || aboutModal).focus?.();
  } else {
    aboutModal.hidden = true;
    aboutModal.setAttribute("hidden", "");
    aboutModal.setAttribute("aria-hidden", "true");
    aboutBtn?.setAttribute("aria-expanded", "false");
    const restore = aboutLastFocus;
    aboutLastFocus = null;
    if (restore && typeof restore.focus === "function") {
      restore.focus();
    } else {
      aboutBtn?.focus?.();
    }
  }
}

aboutBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  setAboutOpen(true);
});
document.getElementById("aboutClose")?.addEventListener("click", () => {
  setAboutOpen(false);
});
document.getElementById("aboutCloseBg")?.addEventListener("click", () => {
  setAboutOpen(false);
});

mountModal(aboutModal);

/* ─── Contributions view wiring ─── */
const { enter: enterContributionsView, stop: stopContributionsCloth, isView: isContributionsView } =
  initContributionsView({ isAboutOpen, setAboutOpen });

/* ─── Main home cloth ─── */
function main() {
  const country = getCountry();
  const width = CONFIG.width;
  const height = CONFIG.height;
  const { gridW, gridH, iterationsPerFrame, compressFactor, stretchFactor } =
    CONFIG;
  const cellWidth = width / (gridW - 1);
  const cellHeight = height / (gridH - 1);
  const root = document.getElementById("container");
  const pad = K.STRINGS_PAD;
  const canvasW = K.AREA_W + pad * 2;
  const canvasH = K.AREA_H + pad * 2;
  const fontSize = Math.max(
    K.FONT_SIZE_MIN,
    Math.min(K.FONT_SIZE_MAX, cellHeight * K.CELL_TO_FONT_FACTOR)
  );
  const roofClearance = Math.ceil(fontSize * K.ROOF_OFFSET_FACTOR);
  const originX = pad + (K.AREA_W - width) / 2;
  const originY = pad + roofClearance;

  const fullCode = country.cloth;
  const writing = country.writing || "horizontal";
  const font = country.font || SERIF_FONT;
  const charCanvases = rasterizeChars(fullCode, font, fontSize, dpr);

  c = document.createElement("canvas");
  root.innerHTML = "";
  root.appendChild(c);
  sizeCanvas(c, canvasW, canvasH, dpr);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const { particles, constraints } = buildHangingGrid({
    gridW,
    gridH,
    width,
    height,
    fullCode,
    writing,
    config: CONFIG,
    vCompress: compressFactor,
    vStretch: stretchFactor
  });

  input = new Input({
    c,
    particles,
    originX,
    originY,
    canvasW,
    canvasH,
    config: CONFIG,
    isPaneEvent,
    onStrike: (opts) => {
      if (opts) chimes.strike(opts);
      else chimes.lastParticleId = -1;
    }
  });

  let lastDelta = performance.now();
  function runloop(delta) {
    rafID = requestAnimationFrame(runloop);
    const dt = Math.min(K.DT_MAX, Math.max(K.DT_MIN, delta - lastDelta));
    lastDelta = delta;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasW, canvasH);

    particles.forEach((p) => p.update(dt));
    for (let i = 0; i < iterationsPerFrame; i++) {
      for (let j = 0; j < constraints.length; j++) constraints[j].solve();
    }
    if (CONFIG.contain) particles.forEach((p) => p.contain());

    clearAndDrawCloth(
      ctx,
      particles,
      charCanvases,
      originX,
      originY,
      canvasW,
      canvasH,
      dpr
    );
  }

  rafID = requestAnimationFrame(runloop);
}

/* ─── Views: Home ↔ Destinations ↔ Contributions ─── */
function initViews() {
  const stage = document.getElementById("stage");
  const destView = document.getElementById("destinationsView");
  const contribView = document.getElementById("contributionsView");
  const links = document.querySelectorAll("a[data-view]");

  function normalizeView(view) {
    if (view === "destinations" || view === "contributions") return view;
    return "home";
  }

  function setView(view) {
    const next = normalizeView(view);
    const prev = stage.dataset.view || "home";

    if (next === "home" && prev === "destinations") {
      const centered = carousel?.centeredId?.();
      if (centered && centered !== currentCountryId) {
        setCountry(centered, { animate: false });
      }
    }

    if (prev === "contributions" && next !== "contributions") {
      stopContributionsCloth();
    }

    stage.dataset.view = next;
    if (destView) destView.hidden = next !== "destinations";
    if (contribView) contribView.hidden = next !== "contributions";
    links.forEach((a) => {
      a.classList.toggle("is-active", a.dataset.view === next);
    });

    if (next === "destinations") {
      if (isAboutOpen()) setAboutOpen(false);
      carousel?.syncToCountry(currentCountryId);
      carousel?.layout();
    }

    if (next === "contributions") {
      enterContributionsView();
    }

    layoutAreaAboveCopy();
    const hash = next === "home" ? "#home" : `#${next}`;
    if (location.hash !== hash) {
      history.replaceState(null, "", hash);
    }
  }

  links.forEach((a) => {
    a.addEventListener("click", (e) => {
      const view = a.dataset.view;
      e.preventDefault();
      setView(view);
    });
  });

  const initial = normalizeView(
    location.hash === "#destinations"
      ? "destinations"
      : location.hash === "#contributions"
        ? "contributions"
        : "home"
  );
  setView(initial);
  window.setView = setView;
}

/** Mobile: pin home area a fixed gap above the eyebrow. */
const AREA_COPY_GAP_PX = 64;

function layoutAreaAboveCopy() {
  const stage = document.getElementById("stage");
  const area = document.getElementById("area");
  const eyebrow = document.querySelector(".eyebrow");
  const carouselVp = document.getElementById("carouselViewport");
  if (!stage || !area || !eyebrow) return;

  const mobile = window.matchMedia("(max-width: 960px)").matches;
  if (!mobile) {
    area.style.bottom = "";
    area.style.top = "";
    if (carouselVp) {
      carouselVp.style.bottom = "";
      carouselVp.style.top = "";
    }
    return;
  }

  // Destinations / Contributions: let CSS own layout; clear any home pin
  if (stage.dataset.view !== "home") {
    area.style.bottom = "";
    area.style.top = "";
    if (carouselVp) {
      carouselVp.style.bottom = "";
      carouselVp.style.top = "";
    }
    return;
  }

  const stageRect = stage.getBoundingClientRect();
  const eyebrowTop = eyebrow.getBoundingClientRect().top - stageRect.top;
  // CSS `bottom` = distance from stage bottom to the area's bottom edge
  const bottom = Math.max(0, stageRect.height - eyebrowTop + AREA_COPY_GAP_PX);
  area.style.top = "auto";
  area.style.bottom = `${bottom}px`;
  if (carouselVp && stage.dataset.view !== "destinations") {
    carouselVp.style.top = "auto";
    carouselVp.style.bottom = `${bottom}px`;
  }
}

function bindAreaCopyLayout() {
  const run = () => layoutAreaAboveCopy();
  run();
  window.addEventListener("resize", run);
  window.addEventListener("orientationchange", run);
  const copy = document.getElementById("bottomCopy");
  if (copy && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(run).observe(copy);
  }
  document.fonts?.ready?.then?.(run);
}

/* ─── Carousel ─── */
const carousel = initCarousel({
  root: document.getElementById("carousel"),
  track: document.getElementById("carouselTrack"),
  countries: COUNTRIES,
  order: COUNTRY_ORDER,
  defaultCountry: DEFAULT_COUNTRY,
  config: CONFIG,
  currentCountryId: currentCountryId,
  setCountry,
  goHome: () => window.setView?.("home")
});

function isPaneEvent(e) {
  return !!(
    e.target?.closest?.(".tp-dfwv") ||
    e.target?.closest?.(".chat-btn") ||
    e.target?.closest?.(".topbar") ||
    e.target?.closest?.(".country-btn") ||
    e.target?.closest?.(".about") ||
    e.target?.closest?.(".about-btn") ||
    e.target?.closest?.(".contributions") ||
    e.target?.closest?.(".aside-block")
  );
}

window.addEventListener("keydown", (e) => {
  if (e.key === "`") setPaneOpen(pane.hidden);
  if (e.key === "Escape") {
    if (isAboutOpen()) {
      e.preventDefault();
      setAboutOpen(false);
      return;
    }
    setPaneOpen(false);
  }
});

/* ─── Boot ─── */
main();
applyClothSettings(getCountry());
applyCountryCopy(getCountry(), () => layoutAreaAboveCopy());
chimes.setCountry(getCountry().id);
updateSideButtons();
initViews();
bindAreaCopyLayout();

document.getElementById("btnLeft")?.addEventListener("click", () => {
  const id = document.getElementById("btnLeft")?.dataset.country;
  if (id) setCountry(id, { direction: -1 });
});
document.getElementById("btnRight")?.addEventListener("click", () => {
  const id = document.getElementById("btnRight")?.dataset.country;
  if (id) setCountry(id, { direction: 1 });
});