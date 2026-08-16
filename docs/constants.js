/**
 * Shared tuning constants for the physics engine, cloth construction, character
 * rendering, and interaction. Single source of truth so the main app
 * (script.js), the standalone China stage (stage-strings.js), and the shared
 * primitives (physics.js, chimes.js) can't drift from one another.
 *
 * "Live" physics values (gravity, damping, mouse feel…) are seeded from
 * DEFAULT_PHYSICS into each app's CONFIG, so Tweakpane-style sliders can
 * override them at runtime; everything else here is a fixed build value.
 */

/* ── Area / grid ──────────────────────────────────────────────────────────── */
export const AREA_W = 492; // Figma area 605:6463
export const AREA_H = 468;
export const STRINGS_PAD = 420; // canvas pad so cloth sway isn't cropped at edges
export const DEFAULT_GRID_W = 36;
export const DEFAULT_GRID_H = 40;

/* ── Vertical strand stiffness (non-live cloths) ─────────────────────────── */
export const VERTICAL_COMPRESS_FACTOR = 0.02;
export const VERTICAL_STRETCH_FACTOR = 1.1;

/* ── Rigid horizontal spacers ────────────────────────────────────────────── */
export const SPACER_COMPRESS_FACTOR = 0.6;
export const SPACER_STRETCH_FACTOR = 4;

/* ── Simulation budget ───────────────────────────────────────────────────── */
// One documented per-frame pass count for every *live* cloth. The home cloth,
// the 13 carousel cloths, and the contributions cloth all resolve with 4 passes:
// enough to hold a hanging curtain together, and it keeps 13 simultaneous
// carousel cloths at 60fps. (The one-time settle below uses 5 for better
// pre-paint hang quality — that happens once, not per frame.)
export const SOLVE_ITERATIONS = 4;
// One-time settle so cloths hang before first paint.
export const PRE_SETTLE_FRAMES = 70;
export const PRE_SETTLE_DT = 16;
export const PRE_SETTLE_ITERATIONS = 5;
// Frame delta clamp — keeps the sim stable and cheap on slow frames.
export const DT_MIN = 1;
export const DT_MAX = 32;

/* ── Scene / copy animation ──────────────────────────────────────────────── */
export const SCENE_MS = 780; // scene slide during a country transition
export const LAYER_GAP_MS = 100; // gap between copy layer animations
export const CHAR_STAGGER_MS = 20; // per-character title stagger
export const CHAR_ANIM_MS = 480; // title character entrance duration

/* ── Character rendering ─────────────────────────────────────────────────── */
export const FONT_SIZE_MIN = 9;
export const FONT_SIZE_MAX = 14;
export const CELL_TO_FONT_FACTOR = 0.95; // horizontal cell size → font size
export const CONTRIB_CELL_HEIGHT_FACTOR = 0.85; // contributions also caps by height
export const CHAR_FACTOR = 1.35; // glyph canvas is fontSize × this
export const ROOF_OFFSET_FACTOR = 0.7; // drop of the first row below the roof
export const CONTRIB_ROOF_OFFSET_FACTOR = 0.35; // contributions cloth has no roof

/* ── Contributions cloth ─────────────────────────────────────────────────── */
export const CONTRIB_MIN_SIZE = 80; // stage must be at least this to build
export const CONTRIB_MIN_STAGE = 40; // cloth not built below this stage size
export const CONTRIB_PAD = 56; // canvas pad (tighter than STRINGS_PAD)

/* ── Pointer interaction / chimes ────────────────────────────────────────── */
export const GRAB_RADIUS = 24; // pointerdown grab distance
export const CHIME_RADIUS = 55; // pointer → chime trigger ring
export const CHIME_RADIUS_SQ = CHIME_RADIUS * CHIME_RADIUS;
export const CHIME_CLOSENESS_MIN = 0.2; // intensity at the ring's edge
export const CHIME_CLOSENESS_SPAN = 0.7; // intensity growth toward the center
export const STRIKE_POP_INTENSITY = 0.85; // pointerdown strike (a firm pop)
export const MOUSE_FORCE_DIVISOR = 300;
export const MOUSE_SMOOTH_END = -2000; // easing anchor — smoothstep falls off
export const DEFAULT_CHIME_VOLUME = 0.28; // default master gain

/* ── Containment (config.contain) ────────────────────────────────────────── */
export const CONTAIN_BOUND_RADIUS = 4; // keep the cloth inside the box
export const CONTAIN_EDGE_RESTITUTION = 0.8; // bounce when hitting an edge

/* ── Default tuning sheet (seeded into each CONFIG) ──────────────────────── */
export const DEFAULT_PHYSICS = {
  gravity: 0.2,
  damping: 0.99,
  iterationsPerFrame: SOLVE_ITERATIONS,
  compressFactor: VERTICAL_COMPRESS_FACTOR,
  stretchFactor: VERTICAL_STRETCH_FACTOR,
  mouseSize: 5000,
  mouseStrength: 4
};