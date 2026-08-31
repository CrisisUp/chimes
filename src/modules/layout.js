/**
 * Responsive layout helpers — pins the home area a fixed gap above the
 * eyebrow on mobile and binds resize observers to keep it in sync.
 */

/** Gap in px between the area's bottom edge and the eyebrow copy. */
const AREA_COPY_GAP_PX = 64;

/**
 * Position the home area (and carousel viewport) so the cloth sits
 * above the bottom copy on mobile.  On desktop this is a no-op — CSS
 * owns the layout.
 */
export function layoutAreaAboveCopy() {
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

/**
 * Bind resize / font-load listeners so the area position stays correct
 * when the viewport or bottom copy changes size.
 */
export function bindAreaCopyLayout() {
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
