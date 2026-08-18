import { Pane } from "https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js";
import {
  clampFontSize,
  clothConfigFor,
  createCloth,
  effectiveDPR,
  makeChimeHandler
} from "./cloth.js";
import {
  COUNTRY_MAP,
  COUNTRY_ORDER,
  DEFAULT_COUNTRY,
  FALLBACK_FONT,
  neighborsOf
} from "./countries.js";
import { chimes } from "./chimes.js";

/* Loaded on demand so a missing/broken contributions.js cannot kill About + home. */
let contribApi = null;
let contribApiPromise = null;
const CONTRIB_FALLBACK = {
  MAX_NAME_LEN: 40,
  loadContributions: () => [],
  addContribution: () => ({ ok: false, error: "unavailable" }),
  contributionsGrid: (names, stageW = 0) => ({
    gridW: Math.max(
      16,
      names.reduce((m, s) => Math.max(m, Array.from(s || "").length), 0),
      stageW > 40 ? Math.floor(stageW / 12) + 1 : 0,
      2
    ),
    gridH: Math.max(2, names.length),
    writing: "horizontal",
    cloth: "",
    font: '"JetBrains Mono", ui-monospace, monospace'
  })
};

function ensureContribApi() {
  if (contribApi) return Promise.resolve(contribApi);
  if (!contribApiPromise) {
    contribApiPromise = import("./contributions.js?v=seed-1")
      .then((mod) => {
        contribApi = mod;
        return mod;
      })
      .catch((err) => {
        console.error("contributions.js failed to load", err);
        contribApi = CONTRIB_FALLBACK;
        return contribApi;
      });
  }
  return contribApiPromise;
}

// Figma area 605:6463
const AREA_W = 492;
const AREA_H = 468;
const STRINGS_PAD = 420;
const SCENE_MS = 780;
const LAYER_GAP_MS = 100;
const CHAR_STAGGER_MS = 20;
const CHAR_ANIM_MS = 480;
const DEFAULT_GRID_W = 36;
const DEFAULT_GRID_H = 40;

/** Physics for cloths that settle once then hang (carousel + contributions). */
const SIMULATE_PHYSICS = { iterations: 4, settleFrames: 70 };

let currentCountryId = DEFAULT_COUNTRY;
let transitioning = false;
let countryBinding = null;
let gridWBinding = null;
let gridHBinding = null;

function getCountry() {
  return COUNTRY_MAP[currentCountryId] || COUNTRY_MAP[DEFAULT_COUNTRY];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function splitTitleChars(text) {
  let i = 0;
  return String(text)
    .split(/(\s+)/)
    .map((token) => {
      if (!token) return "";
      if (/^\s+$/.test(token)) {
        const idx = i++;
        return `<span class="char char--space" style="--i:${idx}" aria-hidden="true">&nbsp;</span>`;
      }
      const chars = Array.from(token)
        .map((ch) => {
          const idx = i++;
          return `<span class="char" style="--i:${idx}" aria-hidden="true">${escapeHtml(ch)}</span>`;
        })
        .join("");
      return `<span class="word">${chars}</span>`;
    })
    .join("");
}

function applyCountryCopy(country) {
  const eyebrow = document.getElementById("eyebrowText");
  const title = document.getElementById("pageTitle");
  const aside = document.getElementById("pageAside");
  if (title) {
    title.setAttribute("aria-label", country.title);
    title.innerHTML = splitTitleChars(country.title);
  }
  if (aside) aside.textContent = country.aside;
  if (eyebrow) {
    const native = country.eyebrowNative || "";
    const roman = country.eyebrowRoman || "";
    const gloss = country.eyebrow || "";
    if (native) {
      const romanBit = roman ? ` (${escapeHtml(roman)})` : "";
      const glossBit = gloss ? ` ${escapeHtml(gloss)}` : "";
      eyebrow.innerHTML = `<strong>${escapeHtml(native)}</strong>${romanBit}${glossBit}`;
    } else {
      eyebrow.textContent = gloss;
    }
  }
  document.title = `Budarina — ${country.name}`;
  requestAnimationFrame(() => layoutAreaAboveCopy());
}

function applyClothSettings(country) {
  CONFIG.gridW = country.gridW ?? DEFAULT_GRID_W;
  CONFIG.gridH = country.gridH ?? DEFAULT_GRID_H;
  try {
    gridWBinding?.refresh();
    gridHBinding?.refresh();
  } catch (_) {
    /* ignore */
  }
}

function copyEnterDuration(country) {
  const chars = Array.from(country.title || "").length;
  // subtitle @0, title chars start @0.1s, aside @0.2s; wait for last char finish
  return (
    LAYER_GAP_MS +
    chars * CHAR_STAGGER_MS +
    CHAR_ANIM_MS +
    LAYER_GAP_MS
  );
}

function updateSideButtons() {
  const { left, right } = neighborsOf(currentCountryId);
  const leftCountry = COUNTRY_MAP[left];
  const rightCountry = COUNTRY_MAP[right];

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
  applyCountryCopy(country);
  chimes.setCountry(country.id);
  updateSideButtons();
}

function setCountryImmediate(id) {
  if (!COUNTRY_MAP[id]) return;
  currentCountryId = id;
  CONFIG.country = id;
  try {
    countryBinding?.refresh();
  } catch (_) {
    /* tweakpane may already be in sync */
  }
  applyCountryVisuals(getCountry());
  rerender();
}

async function transitionTo(id, direction) {
  if (!COUNTRY_MAP[id] || id === currentCountryId || transitioning) return;

  // Respect reduced motion
  if (prefersReducedMotion) {
    setCountryImmediate(id);
    return;
  }

  transitioning = true;
  updateSideButtons();

  const scene = document.getElementById("scene");
  const bottom = document.getElementById("bottomCopy");
  const exitX = direction > 0 ? "-110vw" : "110vw";
  const enterX = direction > 0 ? "110vw" : "-110vw";
  const next = COUNTRY_MAP[id];

  if (bottom) {
    bottom.classList.remove("is-entering", "is-in");
    bottom.classList.add("is-leaving");
  }

  if (scene) {
    scene.classList.add("is-animating");
    scene.style.transition = `transform ${SCENE_MS}ms var(--ease-scene), opacity ${SCENE_MS}ms var(--ease-scene)`;
    scene.style.transform = `translateX(${exitX})`;
    scene.style.opacity = "0.25";
  }

  await sleep(SCENE_MS * 0.78);

  setCountryImmediate(id);

  if (scene) {
    scene.style.transition = "none";
    scene.style.transform = `translateX(${enterX})`;
    scene.style.opacity = "0.25";
    void scene.offsetWidth;
    scene.style.transition = `transform ${SCENE_MS}ms var(--ease-scene), opacity ${SCENE_MS}ms var(--ease-scene)`;
    scene.style.transform = "translateX(0)";
    scene.style.opacity = "1";
  }

  if (bottom) {
    bottom.classList.remove("is-leaving");
    bottom.classList.add("is-entering");
    void bottom.offsetWidth;
    bottom.classList.add("is-in");
  }

  await sleep(Math.max(SCENE_MS, copyEnterDuration(next)));

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
  if (!COUNTRY_MAP[id]) return;
  if (
    opts.animate === false ||
    id === currentCountryId ||
    prefersReducedMotion
  ) {
    setCountryImmediate(id);
    return;
  }
  const from = COUNTRY_ORDER_INDEX(currentCountryId);
  const to = COUNTRY_ORDER_INDEX(id);
  // Prefer explicit direction; otherwise infer the shortest way around the ring
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

function COUNTRY_ORDER_INDEX(id) {
  return COUNTRY_ORDER.indexOf(id);
}

const CONFIG = {
  width: AREA_W,
  height: AREA_H,
  gridW: DEFAULT_GRID_W,
  gridH: DEFAULT_GRID_H,
  gravity: 0.2,
  damping: 0.99,
  iterationsPerFrame: 5,
  compressFactor: 0.02,
  stretchFactor: 1.1,
  mouseSize: 5000,
  mouseStrength: 4,
  contain: false,
  country: currentCountryId,
  chimes: true,
  chimeVolume: 0.28
};

const pane = new Pane({ title: "Play" });
pane.hidden = true;
pane.element.classList.add("budarina-pane");

const fCountry = pane.addFolder({ title: "Destination", expanded: true });
countryBinding = fCountry
  .addBinding(CONFIG, "country", {
    label: "Country",
    options: Object.fromEntries(
      Object.values(COUNTRY_MAP).map((c) => [c.name, c.id])
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

function rerender() {
  homeCloth?.destroy?.();
  homeCloth = null;
  main();
}

fCloth.addButton({ title: "Rebuild cloth" }).on("click", rerender);

fCloth.on("change", (ev) => {
  if (ev.last) rerender();
});

fFeel.on("change", () => {
  homeCloth?.setPhysics?.({
    compressFactor: CONFIG.compressFactor,
    stretchFactor: CONFIG.stretchFactor
  });
});

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
    // Focus trap
    requestAnimationFrame(() => {
      const focusable = aboutModal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length) {
        aboutModal._firstFocusable = focusable[0];
        aboutModal._lastFocusable = focusable[focusable.length - 1];
      }
    });
  } else {
    aboutModal.hidden = true;
    aboutModal.setAttribute("hidden", "");
    aboutModal.setAttribute("aria-hidden", "true");
    aboutBtn?.setAttribute("aria-expanded", "false");
    aboutModal._firstFocusable = null;
    aboutModal._lastFocusable = null;
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

/* ─── Contributions view + hanging name cloth ─── */
const contributionsClothHost = document.getElementById("contributionsCloth");
const contributionsEmpty = document.getElementById("contributionsEmpty");
const contributionsInput = document.getElementById("contributionsInput");
const contributionsHint = document.getElementById("contributionsHint");
let contributionsCloth = null;
let contributionsRaf = 0;
let contributionsResizeObs = null;
let contributionsBuildId = 0;
let contributionsRebuildQuiet = false;

mountModal(aboutModal);

function isContributionsView() {
  return document.getElementById("stage")?.dataset.view === "contributions";
}

function setContributionsHint(msg) {
  if (!contributionsHint) return;
  if (!msg) {
    contributionsHint.hidden = true;
    contributionsHint.textContent = "";
    return;
  }
  contributionsHint.hidden = false;
  contributionsHint.textContent = msg;
}

function stopContributionsCloth() {
  if (contributionsRaf) {
    cancelAnimationFrame(contributionsRaf);
    contributionsRaf = 0;
  }
  contributionsCloth?.destroy?.();
  contributionsCloth = null;
  if (contributionsClothHost) contributionsClothHost.innerHTML = "";
}

function startContributionsLoop() {
  if (contributionsRaf) return;
  let last = performance.now();
  const loop = (now) => {
    contributionsRaf = 0;
    if (!isContributionsView() || !contributionsCloth) return;
    const dt = Math.min(32, now - last);
    last = now;
    contributionsCloth.tick(dt);
    contributionsRaf = requestAnimationFrame(loop);
  };
  contributionsRaf = requestAnimationFrame(loop);
}

function refreshContributionsCloth() {
  const buildId = ++contributionsBuildId;
  stopContributionsCloth();
  ensureContribApi().then((api) => {
    if (buildId !== contributionsBuildId) return;
    if (!isContributionsView()) return;
    const names = api.loadContributions();
    const hasNames = names.length > 0;
    if (contributionsEmpty) contributionsEmpty.hidden = hasNames;
    if (!contributionsClothHost || !hasNames) return;

    // Wait a frame so the stage has laid out (fill-width measurement).
    requestAnimationFrame(() => {
      if (buildId !== contributionsBuildId) return;
      if (!isContributionsView()) return;
      const stage = contributionsClothHost.parentElement;
      const w = stage?.clientWidth || contributionsClothHost.clientWidth;
      const h = stage?.clientHeight || contributionsClothHost.clientHeight;
      if (w < 40 || h < 40) return;
      contributionsRebuildQuiet = true;
      try {
        contributionsCloth = createContributionsCloth(
          contributionsClothHost,
          names,
          w,
          h,
          api.contributionsGrid
        );
      } finally {
        // Ignore ResizeObserver noise from swapping the canvas.
        requestAnimationFrame(() => {
          contributionsRebuildQuiet = false;
        });
      }
      if (buildId !== contributionsBuildId) {
        stopContributionsCloth();
        return;
      }
      startContributionsLoop();
    });
  });
}

function enterContributionsView() {
  if (isAboutOpen()) setAboutOpen(false);
  setContributionsHint("");
  refreshContributionsCloth();
  contributionsInput?.focus?.();
}

document.getElementById("contributionsForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  ensureContribApi().then((api) => {
    const result = api.addContribution(contributionsInput?.value ?? "");
    if (!result.ok) {
      if (result.error === "empty") {
        setContributionsHint("Enter a country name.");
      } else if (result.error === "too_long") {
        setContributionsHint(`Keep it under ${api.MAX_NAME_LEN} characters.`);
      } else if (result.error === "not_a_country") {
        setContributionsHint("Please enter a country name.");
      } else if (result.error === "full") {
        setContributionsHint("The cloth is full — thank you.");
      } else {
        setContributionsHint("Could not add that name.");
      }
      contributionsInput?.focus?.();
      return;
    }
    setContributionsHint("");
    if (contributionsInput) contributionsInput.value = "";
    refreshContributionsCloth();
    contributionsInput?.focus?.();
  });
});

if (contributionsClothHost && typeof ResizeObserver !== "undefined") {
  let resizeTimer = 0;
  contributionsResizeObs = new ResizeObserver(() => {
    if (!isContributionsView() || contributionsRebuildQuiet) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!contributionsRebuildQuiet && isContributionsView()) {
        refreshContributionsCloth();
      }
    }, 120);
  });
  contributionsResizeObs.observe(contributionsClothHost);
}

window.addEventListener("keydown", (e) => {
  // Focus trap for About modal
  if (isAboutOpen() && e.key === "Tab") {
    const first = aboutModal._firstFocusable;
    const last = aboutModal._lastFocusable;
    if (first && last) {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

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

let homeCloth = null;
const dpr = effectiveDPR();

// Reduced motion detection
const reducedMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
let prefersReducedMotion = reducedMotionQuery?.matches ?? false;

if (reducedMotionQuery?.addEventListener) {
  reducedMotionQuery.addEventListener("change", (e) => {
    prefersReducedMotion = e.matches;
    // Re-render cloths with new setting (home, carousel, contributions)
    refreshCloths();
  });
}

function refreshCloths() {
  rerender();
  carousel?.layout();
  refreshContributionsCloth();
}

function main() {
  const country = getCountry();

  homeCloth = createCloth(
    clothConfigFor({
      host: document.getElementById("container"),
      country,
      area: { width: AREA_W, height: AREA_H },
      pad: STRINGS_PAD,
      font: country.font || FALLBACK_FONT,
      dpr,
      config: CONFIG,
      reducedMotion: prefersReducedMotion,
      mode: "interact",
      onPointerGuard: isPaneEvent,
      chimeHandler: makeChimeHandler(chimes)
    })
  );
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

    // Pause/resume home cloth simulation
    if (prev === "home" && next !== "home") {
      if (homeSimRaf) {
        cancelAnimationFrame(homeSimRaf);
        homeSimRaf = 0;
      }
    }
    if (next === "home" && prev !== "home") {
      lastHomeSim = performance.now();
      homeSimRaf = requestAnimationFrame(homeSimLoop);
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
      // External destinations — let the browser follow href
      if (view === "knowledge" || view === "community") return;
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
const AREA_COPY_GAP_PX = 72;

function layoutAreaAboveCopy() {
  const stage = document.getElementById("stage");
  const area = document.getElementById("area");
  const bottomCopy = document.getElementById("bottomCopy");
  const carouselVp = document.getElementById("carouselViewport");
  if (!stage || !area || !bottomCopy) return;

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
  // Use bottom-copy bottom edge (includes heading + aside-block)
  const copyBottom = bottomCopy.getBoundingClientRect().bottom - stageRect.top;
  // CSS `bottom` = distance from stage bottom to the area’s bottom edge
  const bottom = Math.max(0, stageRect.height - copyBottom + AREA_COPY_GAP_PX);
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
  const bottomCopy = document.getElementById("bottomCopy");
  if (bottomCopy && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(run).observe(bottomCopy);
  }
  document.fonts?.ready?.then?.(run);
}

/* ─── Destinations carousel (Figma 605:6580) ─── */
// Desktop center gap ≈ 575px at area 492; side scale ≈ 290/492 ≈ 0.59
const CAROUSEL_GAP_DESKTOP = 575;
const CAROUSEL_AREA_DESKTOP = 492;
const CAROUSEL_SIDE_SCALE = 0.58;
const CAROUSEL_SNAP_MS = 520;
// Tuning: how far an item can drift before fading out / turning inactive,
// and the mid-point past which it's treated as the centered slide.
const CAROUSEL_HIDE_DIST = 1.65;
const CAROUSEL_CENTER_MAX = 0.35;
// Fling feel: velocity→step conversion, max fling steps, dead-zone nudge.
const FLICK_PX_PER_STEP = 140;
const FLICK_MAX_STEPS = 0.55;
const NUDGE_MAX_DIST = 0.22;
// Velocity smoothing (exponential moving average).
const VELOCITY_SMOOTH = 0.65;
const VELOCITY_BLEND = 0.35;

function carouselGapPx() {
  const sample =
    document.querySelector(".carousel__item") ||
    document.getElementById("area");
  // Prefer offsetWidth — getBoundingClientRect shrinks with transform:scale on
  // side items, which made spacing collapse whenever Vietnam wasn't centered.
  const w = sample?.offsetWidth || sample?.getBoundingClientRect?.().width;
  if (!w || !Number.isFinite(w) || w < 8) return CAROUSEL_GAP_DESKTOP;
  // On narrow screens the desktop 575/492 ratio leaves the side items almost
  // fully off-screen (a 226px center + 264px gap > 390px viewport). Use a gap
  // that keeps a sliver of each neighbor visible so they stay reachable.
  if (window.innerWidth < 560) return w * 0.68;
  return (CAROUSEL_GAP_DESKTOP / CAROUSEL_AREA_DESKTOP) * w;
}

let carousel = null;

/** Live cloth under a carousel roof — settles once, then reacts to hover. */
function createCarouselCloth(host, country) {
  if (!host || !country) return null;

  const cloth = createCloth(
    clothConfigFor({
      host,
      country,
      area: { width: AREA_W, height: AREA_H },
      pad: STRINGS_PAD,
      font: country.font || FALLBACK_FONT,
      dpr,
      config: {
        ...CONFIG,
        width: AREA_W,
        height: AREA_H,
        gridW: country.gridW ?? DEFAULT_GRID_W,
        gridH: country.gridH ?? DEFAULT_GRID_H,
        contain: false
      },
      reducedMotion: prefersReducedMotion,
      physicsOverrides: SIMULATE_PHYSICS,
      mode: "simulate",
      chimeHandler: ({ x, y, particle, gridW: g, intensity }) => {
        chimes.setCountry(country.id);
        chimes.strike({ x, y, particle, gridW: g, intensity });
      }
    })
  );

  return {
    countryId: country.id,
    tick: cloth.tick,
    brush: cloth.brush,
    setActive: cloth.setActive
  };
}

/**
 * Contributions cloth — each submitted country name is a horizontal hanging row.
 * Narrower canvas pad (56px) and no chimes.
 */
function createContributionsCloth(host, names, cssW, cssH, gridFn) {
  if (!host || !names?.length) return null;

  const width = Math.max(80, cssW);
  const height = Math.max(80, cssH);
  const pad = 56;
  const grid = (gridFn || CONTRIB_FALLBACK.contributionsGrid)(names, width);
  const fontSize = clampFontSize(
    Math.min(
      (width / Math.max(1, grid.gridW - 1)) * 0.95,
      (height / Math.max(1, grid.gridH - 1)) * 0.85
    )
  );
  return createCloth(
    clothConfigFor({
      host,
      country: { cloth: grid.cloth, writing: grid.writing || "horizontal" },
      area: { width, height },
      pad,
      fontSize,
      font: grid.font,
      dpr,
      config: {
        ...CONFIG,
        width,
        height,
        gridW: grid.gridW,
        gridH: grid.gridH,
        contain: false
      },
      reducedMotion: prefersReducedMotion,
      physicsOverrides: SIMULATE_PHYSICS,
      mode: "simulate",
      originX: pad,
      originY: pad + Math.ceil(fontSize * 0.35)
    })
  );
}

function initCarousel() {
  const root = document.getElementById("carousel");
  const track = document.getElementById("carouselTrack");
  if (!root || !track) return;

  const n = COUNTRY_ORDER.length;
  const items = [];
  const cloths = [];
  // country id → its item element + cloth, for hit-testing which item is on top.
  const clothByCountry = new Map();

  track.innerHTML = "";
  COUNTRY_ORDER.forEach((id) => {
    const country = COUNTRY_MAP[id];
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
    const cloth = createCarouselCloth(
      el.querySelector(".carousel__strings"),
      country
    );
    if (cloth) cloths.push(cloth);
    items.push(el);
    clothByCountry.set(id, { el, cloth });
  });

  let index = COUNTRY_ORDER.indexOf(currentCountryId);
  if (index < 0) index = COUNTRY_ORDER.indexOf(DEFAULT_COUNTRY);
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
      el.classList.toggle("is-center", absD < CAROUSEL_CENTER_MAX);
      el.setAttribute("aria-selected", absD < CAROUSEL_CENTER_MAX ? "true" : "false");
      el.style.opacity = absD > CAROUSEL_HIDE_DIST ? "0" : "1";
      el.style.pointerEvents = absD > CAROUSEL_HIDE_DIST ? "none" : "auto";
      if (cloths[i]) cloths[i].setActive(absD <= CAROUSEL_HIDE_DIST);
    });
  }

  function nearestIndex(v) {
    let best = Math.round(v);
    best = ((best % n) + n) % n;
    return best;
  }

  function syncToCountry(id) {
    const i = COUNTRY_ORDER.indexOf(id);
    if (i >= 0) index = i;
    layout();
  }

  function animateTo(target, duration = CAROUSEL_SNAP_MS) {
    cancelAnimationFrame(animRaf);
    // Respect reduced motion
    if (prefersReducedMotion) {
      let delta = wrapDelta(target - index);
      const from = index;
      const to = from + delta;
      index = nearestIndex(to);
      layout();
      return;
    }
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
    const dt = Math.min(32, Math.max(1, now - lastSim));
    lastSim = now;
    for (const cloth of cloths) cloth.tick(dt);
  }
  simRaf = requestAnimationFrame(simLoop);

  function brushFromEvent(e) {
    if (!isDestinationsView() || moved) return;
    // Which country's cloth is visually UNDER the cursor decides. The raw
    // canvas bounds overlap heavily (a centered cloth's wide canvas covers the
    // side items), so a bounds loop would always hand the hit to the center.
    const hit = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest?.(".carousel__item");
    if (!hit) return;
    const entry = clothByCountry.get(hit.dataset.country);
    if (!entry?.cloth) return;
    entry.cloth.brush(e.clientX, e.clientY);
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
        velocity = velocity * VELOCITY_SMOOTH + vx * VELOCITY_BLEND;
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
        const hitIndex = COUNTRY_ORDER.indexOf(id);
        if (hit.classList.contains("is-center") && id) {
          setCountry(id, { animate: false });
          window.setView?.("home");
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
      -FLICK_MAX_STEPS,
      Math.min(FLICK_MAX_STEPS, (-velocity * FLICK_PX_PER_STEP) / gap)
    );
    const releaseNearest = Math.round(index);
    let target = Math.round(index + flickIndex);

    // Never skip a country: settle at most one step from where the finger released
    target = Math.max(releaseNearest - 1, Math.min(releaseNearest + 1, target));

    // Tiny nudge without a real flick → stay on the slide you started from
    const dragged = index - startIndex;
    if (Math.abs(dragged) < NUDGE_MAX_DIST && Math.abs(flickIndex) < NUDGE_MAX_DIST) {
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
      const id = COUNTRY_ORDER[nearestIndex(index)];
      if (id) {
        setCountry(id, { animate: false });
        window.setView?.("home");
      }
    }
  });

  layout();
  carousel = {
    layout,
    syncToCountry,
    animateTo,
    centeredId: () => COUNTRY_ORDER[nearestIndex(index)]
  };
}

main();
applyClothSettings(getCountry());
applyCountryCopy(getCountry());
chimes.setCountry(getCountry().id);
updateSideButtons();
initCarousel();
initViews();
bindAreaCopyLayout();

/* ─── Home cloth simulation loop (settle + hover sway) ─── */
let homeSimRaf = 0;
let lastHomeSim = performance.now();
function homeSimLoop(now) {
  homeSimRaf = requestAnimationFrame(homeSimLoop);
  const dt = Math.min(32, Math.max(1, now - lastHomeSim));
  lastHomeSim = now;
  if (homeCloth) homeCloth.tick(dt);
}
homeSimRaf = requestAnimationFrame(homeSimLoop);

document.getElementById("btnLeft")?.addEventListener("click", () => {
  const id = document.getElementById("btnLeft")?.dataset.country;
  if (id) setCountry(id, { direction: -1 });
});
document.getElementById("btnRight")?.addEventListener("click", () => {
  const id = document.getElementById("btnRight")?.dataset.country;
  if (id) setCountry(id, { direction: 1 });
});
