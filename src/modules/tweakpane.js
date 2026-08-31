/**
 * Tweakpane debug panel — physics sliders, cloth rebuild, chime volume.
 * Hidden by default; toggled with the "Play" button.
 * Creates and owns the shared CONFIG object.
 */
import { Pane } from "https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js";
import * as K from "./constants.js";
import { COUNTRIES } from "../countries.js";
import { chimes } from "../chimes.js";

/**
 * @param {{ rerender: () => void, onCountryChange: (id: string) => void }} deps
 * @returns {object} CONFIG — the shared physics/rendering config object
 */
export function initTweakpane({ rerender, onCountryChange }) {
  const CONFIG = {
    ...K.DEFAULT_PHYSICS,
    width: K.AREA_W,
    height: K.AREA_H,
    gridW: K.DEFAULT_GRID_W,
    gridH: K.DEFAULT_GRID_H,
    contain: false,
    country: "china",
    chimes: true,
    chimeVolume: K.DEFAULT_CHIME_VOLUME
  };

  const pane = new Pane({ title: "Play" });
  pane.hidden = true;
  pane.element.classList.add("budarina-pane");

  /* ── Destination folder ── */
  const fCountry = pane.addFolder({ title: "Destination", expanded: true });
  fCountry
    .addBinding(CONFIG, "country", {
      label: "Country",
      options: Object.fromEntries(
        Object.values(COUNTRIES).map((c) => [c.name, c.id])
      )
    })
    .on("change", (ev) => {
      onCountryChange(ev.value);
    });

  /* ── Cloth folder ── */
  const fCloth = pane.addFolder({ title: "Cloth", expanded: true });
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
  const gridWBinding = fCloth.addBinding(CONFIG, "gridW", {
    step: 1,
    min: 2,
    max: 200,
    label: "Columns"
  });
  const gridHBinding = fCloth.addBinding(CONFIG, "gridH", {
    step: 1,
    min: 2,
    max: 100,
    label: "Rows"
  });

  fCloth.addButton({ title: "Rebuild cloth" }).on("click", rerender);
  fCloth.on("change", (ev) => {
    if (ev.last) rerender();
  });

  /* ── Motion & sound folder ── */
  const fFeel = pane.addFolder({ title: "Motion & sound", expanded: true });
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

  /* ── Chat / Play button ── */
  function setPaneOpen(open) {
    pane.hidden = !open;
    const btn = document.getElementById("chatBtn");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  document.getElementById("chatBtn")?.addEventListener("click", () => {
    setPaneOpen(pane.hidden);
  });

  /* ── Grid binding refresh (called by navigation after country switch) ── */
  function refreshGridBindings(gridW, gridH) {
    try { gridWBinding?.refresh(); } catch (_) { /* ignore */ }
    try { gridHBinding?.refresh(); } catch (_) { /* ignore */ }
  }

  /* ── Pointer event guard ── */
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

  /* Make functions available to script.js */
  initTweakpane.setPaneOpen = setPaneOpen;
  initTweakpane.isPaneEvent = isPaneEvent;
  initTweakpane.refreshGridBindings = refreshGridBindings;

  return CONFIG;
}
