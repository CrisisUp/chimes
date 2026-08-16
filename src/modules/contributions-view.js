/**
 * Contributions view — the hanging name cloth and its form wiring.
 * Contributions data is loaded on demand (`./contributions.js`) so a missing or
 * broken module can never take down the About modal or the home cloth: the API
 * falls back to a no-op object instead.
 */
import * as K from "./constants.js";
import { createContributionsCloth } from "./cloths.js";

/**
 * Create the contributions view controller. `isAboutOpen` / `setAboutOpen` are
 * injected so opening the About modal from this view can switch back home first.
 */
export function initContributionsView({ isAboutOpen, setAboutOpen }) {
  const host = document.getElementById("contributionsCloth");
  const empty = document.getElementById("contributionsEmpty");
  const input = document.getElementById("contributionsInput");
  const hint = document.getElementById("contributionsHint");
  if (!host && !input) return null;

  /* ── Lazy contributions API with a safe fallback ── */
  const FALLBACK = {
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
  let api = null;
  let apiPromise = null;
  function ensureApi() {
    if (api) return Promise.resolve(api);
    if (!apiPromise) {
      apiPromise = import("../contributions.js?v=seed-1")
        .then((mod) => {
          api = mod;
          return mod;
        })
        .catch((err) => {
          console.error("contributions.js failed to load", err);
          api = FALLBACK;
          return api;
        });
    }
    return apiPromise;
  }

  /* ── View state ── */
  let cloth = null;
  let raf = 0;
  let resizeObs = null;
  let buildId = 0;
  let rebuildQuiet = false;

  function isView() {
    return document.getElementById("stage")?.dataset.view === "contributions";
  }

  function setHint(msg) {
    if (!hint) return;
    if (!msg) {
      hint.hidden = true;
      hint.textContent = "";
      return;
    }
    hint.hidden = false;
    hint.textContent = msg;
  }

  function stop() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    cloth?.destroy?.();
    cloth = null;
    if (host) host.innerHTML = "";
  }

  function startLoop() {
    if (raf) return;
    let last = performance.now();
    const loop = (now) => {
      raf = 0;
      if (!isView() || !cloth) return;
      const dt = Math.min(K.DT_MAX, now - last);
      last = now;
      cloth.tick(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  function refresh() {
    const id = ++buildId;
    stop();
    ensureApi().then((api) => {
      if (id !== buildId) return;
      if (!isView()) return;
      const names = api.loadContributions();
      const hasNames = names.length > 0;
      if (empty) empty.hidden = hasNames;
      if (!host || !hasNames) return;

      // Wait a frame so the stage has laid out (fill-width measurement).
      requestAnimationFrame(() => {
        if (id !== buildId) return;
        if (!isView()) return;
        const stage = host.parentElement;
        const w = stage?.clientWidth || host.clientWidth;
        const h = stage?.clientHeight || host.clientHeight;
        if (w < K.CONTRIB_MIN_STAGE || h < K.CONTRIB_MIN_STAGE) return;
        rebuildQuiet = true;
        try {
          cloth = createContributionsCloth(host, names, w, h, api.contributionsGrid);
        } finally {
          // Ignore ResizeObserver noise from swapping the canvas.
          requestAnimationFrame(() => {
            rebuildQuiet = false;
          });
        }
        if (id !== buildId) {
          stop();
          return;
        }
        startLoop();
      });
    });
  }

  function enter() {
    if (isAboutOpen()) setAboutOpen(false);
    setHint("");
    refresh();
    input?.focus?.();
  }

  function submit(value) {
    ensureApi().then((api) => {
      const result = api.addContribution(value ?? "");
      if (!result.ok) {
        if (result.error === "empty") {
          setHint("Enter a country name.");
        } else if (result.error === "too_long") {
          setHint(`Keep it under ${api.MAX_NAME_LEN} characters.`);
        } else if (result.error === "not_a_country") {
          setHint("Please enter a country name.");
        } else if (result.error === "full") {
          setHint("The cloth is full — thank you.");
        } else {
          setHint("Could not add that name.");
        }
        input?.focus?.();
        return;
      }
      setHint("");
      if (input) input.value = "";
      refresh();
      input?.focus?.();
    });
  }

  document.getElementById("contributionsForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    submit(input?.value ?? "");
  });

  if (host && typeof ResizeObserver !== "undefined") {
    let resizeTimer = 0;
    resizeObs = new ResizeObserver(() => {
      if (!isView() || rebuildQuiet) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!rebuildQuiet && isView()) refresh();
      }, 120);
    });
    resizeObs.observe(host);
  }

  return {
    enter,
    stop,
    isView
  };
}