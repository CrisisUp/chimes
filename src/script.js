/**
 * Budarina — interactive string-cloth portfolio.
 * Main orchestrator: boots the home cloth, Tweakpane, country navigation,
 * modal About, carousel destinations, contributions view, and responsive layout.
 *
 * All logic lives in dedicated modules under ./modules/:
 *   tweakpane.js     — debug panel + CONFIG
 *   navigation.js    — country state, transitions, side buttons
 *   home-cloth.js    — canvas, Verlet physics loop, character rendering
 *   about-modal.js   — About modal open/close + focus management
 *   layout.js        — responsive area positioning
 *   carousel.js      — destination carousel drag/snap
 *   contributions-view.js — contributions form + cloth
 *   cloth-common.js  — shared grid/draw primitives
 *   cloths.js        — carousel + contributions cloth factories
 *   copy.js          — title splitting, country copy helpers
 *   constants.js     — physics/rendering constants
 */
import { COUNTRIES, COUNTRY_ORDER, DEFAULT_COUNTRY } from "./countries.js";
import { initTweakpane } from "./modules/tweakpane.js";
import { initHomeCloth } from "./modules/home-cloth.js";
import { initAboutModal } from "./modules/about-modal.js";
import { initNavigation } from "./modules/navigation.js";
import { layoutAreaAboveCopy, bindAreaCopyLayout } from "./modules/layout.js";
import { initCarousel } from "./modules/carousel.js";
import { initContributionsView } from "./modules/contributions-view.js";

/* ─── 1. Tweakpane (creates CONFIG, debug panel) ─── */
const CONFIG = initTweakpane({
  rerender: () => doRerender?.(),
  onCountryChange: (id) => nav?.setCountry?.(id)
});
const { isPaneEvent, refreshGridBindings } = initTweakpane;

/* ─── 2. Home cloth (canvas, physics loop — starts immediately) ─── */
const { rerender: doRerender } = initHomeCloth({
  config: CONFIG,
  isPaneEvent
});

/* ─── 3. About modal (self-contained) ─── */
const { isAboutOpen, setAboutOpen } = initAboutModal({
  onBeforeOpen: () => {
    if (isContributionsView()) window.setView?.("home");
  }
});

/* ─── 4. Country navigation (state, transitions, side buttons) ─── */
const nav = initNavigation({
  config: CONFIG,
  refreshBindings: refreshGridBindings,
  rerender: () => doRerender?.(),
  onLayout: () => layoutAreaAboveCopy()
});

/* ─── 5. Contributions view ─── */
const { enter: enterContributionsView, stop: stopContributionsCloth, isView: isContributionsView } =
  initContributionsView({ isAboutOpen, setAboutOpen });

/* ─── 6. Carousel ─── */
const carousel = initCarousel({
  root: document.getElementById("carousel"),
  track: document.getElementById("carouselTrack"),
  countries: COUNTRIES,
  order: COUNTRY_ORDER,
  defaultCountry: DEFAULT_COUNTRY,
  config: CONFIG,
  currentCountryId: nav.getCurrentCountryId(),
  setCountry: nav.setCountry,
  goHome: () => window.setView?.("home")
});

/* ─── 7. View switching ─── */
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
      if (centered && centered !== nav.getCurrentCountryId()) {
        nav.setCountry(centered, { animate: false });
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
      carousel?.syncToCountry(nav.getCurrentCountryId());
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

/* ─── Keyboard shortcuts ─── */
window.addEventListener("keydown", (e) => {
  if (e.key === "`") {
    document.getElementById("chatBtn")?.click();
  }
  if (e.key === "Escape") {
    if (isAboutOpen()) {
      e.preventDefault();
      setAboutOpen(false);
      return;
    }
    document.getElementById("chatBtn")?.click();
  }
});

/* ─── Boot ─── */
initViews();
bindAreaCopyLayout();
