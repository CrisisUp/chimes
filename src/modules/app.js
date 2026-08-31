/**
 * App factory — wires all modules together.
 * Single entry point for bootstrapping the application.
 */
import { initTweakpane } from "./tweakpane.js";
import { initHomeCloth } from "./home-cloth.js";
import { initAboutModal } from "./about-modal.js";
import { initNavigation } from "./navigation.js";
import { initCarousel } from "./carousel.js";
import { initContributionsView } from "./contributions-view.js";
import { initViewManager } from "./view-manager.js";
import { layoutAreaAboveCopy } from "./layout.js";
import { COUNTRIES, COUNTRY_ORDER, DEFAULT_COUNTRY } from "../countries.js";

/**
 * Creates and initializes the entire application.
 * @returns {{ CONFIG, nav, carousel, view, setAboutOpen, isAboutOpen }}
 */
export function createApp() {
  /* ─── 1. Tweakpane (creates CONFIG, debug panel) ─── */
  const CONFIG = initTweakpane({
    rerender: () => doRerender?.(),
    onCountryChange: (id) => nav?.setCountry?.(id)
  });

  /* ─── 2. Home cloth (canvas, physics loop — starts immediately) ─── */
  const { rerender: doRerender } = initHomeCloth({
    config: CONFIG,
    isPaneEvent: initTweakpane.isPaneEvent
  });

  /* ─── 3. About modal (self-contained) ─── */
  const { isAboutOpen, setAboutOpen } = initAboutModal({
    onBeforeOpen: () => {
      if (isContributionsView()) view.setView("home");
    }
  });

  /* ─── 4. Country navigation (state, transitions, side buttons) ─── */
  const nav = initNavigation({
    config: CONFIG,
    refreshBindings: initTweakpane.refreshGridBindings,
    rerender: () => doRerender?.(),
    onLayout: layoutAreaAboveCopy
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
    goHome: () => view.setView("home")
  });

  /* ─── 7. View switching (extracted to view-manager) ─── */
  const view = initViewManager({
    nav,
    carousel,
    enterContributionsView,
    stopContributionsCloth,
    isContributionsView,
    isAboutOpen,
    setAboutOpen
  });

  // Make view setter globally accessible for carousel goHome
  window.setView = view.setView;

  return { CONFIG, nav, carousel, view, setAboutOpen, isAboutOpen };
}