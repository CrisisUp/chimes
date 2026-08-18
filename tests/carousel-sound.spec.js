import { test, expect } from "@playwright/test";

/**
 * Regression: the carousel's chime hit-test used canvas bounds, and a centered
 * country's wide canvas overlapped its side neighbors — so hovering the left
 * item never produced sound. The fix hit-tests the visible item at the cursor
 * (elementFromPoint → closest .carousel__item).
 *
 * These assertions stub the chimes module to record which country's profile
 * each strike belonged to, then teleport the mouse to the CENTER of each side
 * item's canvas and assert that side's own country strikes (and never the
 * neighbor that the bounds bug handed the point to).
 */
test("carousel chimes follow the visible country on all three sides", async ({
  page
}) => {
  await page.goto("/index.html", { waitUntil: "networkidle" });
  await page.click('a[data-view="destinations"]');
  await page.waitForTimeout(1000);

  // Instrument the chimes module: remember which country was active per strike.
  await page.evaluate(async () => {
    const mod = await import("./chimes.js");
    window.__hits = [];
    const origSet = mod.chimes.setCountry.bind(mod.chimes);
    mod.chimes.setCountry = (id) => {
      window.__cur = id;
      return origSet(id);
    };
    const origStrike = mod.chimes.strike.bind(mod.chimes);
    mod.chimes.strike = (o) => {
      if (!o?.reset) window.__hits.push(window.__cur);
      return origStrike(o);
    };
  });

  const clear = () => page.evaluate(() => (window.__hits = []));
  const hits = () => page.evaluate(() => window.__hits);

  const assertSideCenter = async (country) => {
    // Teleport straight to the CENTER of the side item's canvas. This is the
    // point the bounds bug swallowed: the wide center canvas claimed it, so the
    // side either went silent or struck the neighbor. Fixed build strikes the
    // side's own country here.
    const rect = await page.evaluate((c) => {
      const cv = document.querySelector(`.carousel__item[data-country="${c}"] canvas`);
      if (!cv) return null;
      const r = cv.getBoundingClientRect();
      return { x: Math.round(r.left + r.width * 0.5), y: Math.round(r.top + r.height * 0.5) };
    }, country);
    if (!rect) throw new Error(`canvas not found for ${country}`);

    await clear();
    await page.mouse.move(rect.x, rect.y, { steps: 1 });
    await page.mouse.move(rect.x, rect.y, { steps: 1 });
    await page.waitForTimeout(250);
    const h = await hits();
    const unique = [...new Set(h)];
    expect(
      h.length,
      `${country} center should strike at least once (bug made it silent)`
    ).toBeGreaterThan(0);
    expect(
      unique,
      `${country} center should strike ${country} only (not the neighbor)`
    ).toEqual([country]);
  };

  await assertSideCenter("vietnam");
  await assertSideCenter("china");
  await assertSideCenter("japan");
});