/**
 * Country navigation — state, animated transitions, side buttons, and
 * localStorage persistence.  Exports only `setCountry` and
 * `getCurrentCountryId`; all transition machinery stays private.
 */
import * as K from "./constants.js";
import {
  COUNTRIES,
  COUNTRY_ORDER,
  DEFAULT_COUNTRY,
  neighborsOf
} from "../countries.js";
import { applyCountryCopy, copyEnterDuration } from "./copy.js";
import { chimes } from "../chimes.js";

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {{
 *   config: object,
 *   refreshBindings: (gridW: number, gridH: number) => void,
 *   rerender: () => void,
 *   onLayout: () => void
 * }} deps
 */
export function initNavigation({ config, refreshBindings, rerender, onLayout }) {
  let currentCountryId = loadSavedCountry();
  let transitioning = false;

  function getCountry() {
    return COUNTRIES[currentCountryId] || COUNTRIES[DEFAULT_COUNTRY];
  }

  function getCurrentCountryId() {
    return currentCountryId;
  }

  function applyClothSettings(country) {
    config.gridW = country.gridW ?? K.DEFAULT_GRID_W;
    config.gridH = country.gridH ?? K.DEFAULT_GRID_H;
    try {
      refreshBindings(config.gridW, config.gridH);
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
    applyCountryCopy(country, onLayout);
    chimes.setCountry(country.id);
    updateSideButtons();
  }

  function setCountryImmediate(id) {
    if (!COUNTRIES[id]) return;
    currentCountryId = id;
    config.country = id;
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (_) {
      /* ignore - localStorage blocked */
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

  /* ── Apply initial country visuals at boot ── */
  applyCountryVisuals(getCountry());

  /* ── Side button click listeners ── */
  document.getElementById("btnLeft")?.addEventListener("click", () => {
    const id = document.getElementById("btnLeft")?.dataset.country;
    if (id) setCountry(id, { direction: -1 });
  });
  document.getElementById("btnRight")?.addEventListener("click", () => {
    const id = document.getElementById("btnRight")?.dataset.country;
    if (id) setCountry(id, { direction: 1 });
  });

  return { getCurrentCountryId, setCountry };
}
