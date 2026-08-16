/**
 * Country copy helpers: escaping, title splitting into animated spans, and
 * applying a country's copy to the DOM (title, eyebrow, aside). The layout
 * hook `onLayout` is called after the DOM is updated so the caller can
 * reposition the area relative to the (possibly different) copy height.
 */
import * as K from "./constants.js";

export function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function splitTitleChars(text) {
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

export function applyCountryCopy(country, onLayout) {
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
  if (onLayout) requestAnimationFrame(onLayout);
}

/** Copy entrance duration — subtitle @0, title chars start @0.1s, aside @0.2s. */
export function copyEnterDuration(country) {
  const chars = Array.from(country.title || "").length;
  return (
    K.LAYER_GAP_MS +
    chars * K.CHAR_STAGGER_MS +
    K.CHAR_ANIM_MS +
    K.LAYER_GAP_MS
  );
}