/**
 * View switching logic extracted from script.js.
 * Manages Home / Destinations / Contributions views and hash routing.
 */
import { layoutAreaAboveCopy, bindAreaCopyLayout } from "./layout.js";

/**
 * @param {{
 *   nav: { getCurrentCountryId: () => string, setCountry: (id: string, opts?: object) => void },
 *   carousel: { layout: () => void, syncToCountry: (id: string) => void, centeredId: () => string },
 *   enterContributionsView: () => void,
 *   stopContributionsCloth: () => void,
 *   isContributionsView: () => boolean,
 *   isAboutOpen: () => boolean,
 *   setAboutOpen: (open: boolean) => void
 * }} deps
 */
export function initViewManager({
  nav,
  carousel,
  enterContributionsView,
  stopContributionsCloth,
  isContributionsView,
  isAboutOpen,
  setAboutOpen
}) {
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

  // Keyboard shortcuts
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

  bindAreaCopyLayout();

  return { setView };
}