/**
 * About modal — open/close, focus management, and backdrop click handling.
 * The modal element is expected to already exist in the DOM (index.html).
 */

let aboutLastFocus = null;

function mountModal(el) {
  if (el && el.parentElement !== document.body) {
    document.body.appendChild(el);
  }
}

/**
 * @param {{ onBeforeOpen?: () => void }} deps
 *   `onBeforeOpen` is called before the modal opens so the caller can
 *   close any overlapping view (e.g. contributions) first.
 */
export function initAboutModal({ onBeforeOpen } = {}) {
  const aboutModal = document.getElementById("aboutModal");
  const aboutBtn = document.getElementById("aboutBtn");

  function isAboutOpen() {
    return !!(aboutModal && !aboutModal.hidden);
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
      onBeforeOpen?.();
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

  return { setAboutOpen, isAboutOpen };
}
