/**
 * Country destinations — roof / cloth / writing / page copy.
 * Data lives in ./countries.json; this module imports it, joins cloth
 * arrays into strings, and exports the lookup helpers.
 */
import RAW from "./countries.json";

/** Processed country data — cloth arrays are joined with full-width space. */
export const COUNTRIES = Object.fromEntries(
  Object.entries(RAW).map(([key, country]) => {
    const cloth = Array.isArray(country.cloth)
      ? country.cloth.join("　")
      : country.cloth;
    return [key, { ...country, cloth }];
  })
);

/** Left → right order for side navigation */
export const COUNTRY_ORDER = [
  "vietnam",
  "china",
  "japan",
  "kazakhstan",
  "russia",
  "france",
  "india",
  "uk",
  "norway",
  "italy",
  "usa",
  "brazil",
  "iran"
];

export const DEFAULT_COUNTRY = "china";

export function neighborsOf(id) {
  const i = COUNTRY_ORDER.indexOf(id);
  if (i < 0) return { left: "vietnam", right: "japan" };
  const n = COUNTRY_ORDER.length;
  return {
    left: COUNTRY_ORDER[(i - 1 + n) % n],
    right: COUNTRY_ORDER[(i + 1) % n]
  };
}

/** Map grid cell (i=col left→right, j=row top→bottom) to a character. */
export function charForCell(text, i, j, gridW, gridH, writing = "horizontal") {
  if (!text || !text.length) return " ";
  let index;
  if (writing === "vertical") {
    const colFromRight = gridW - 1 - i;
    index = colFromRight * gridH + j;
  } else {
    index = j * gridW + i;
  }
  return text[index % text.length] || " ";
}
