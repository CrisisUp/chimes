import { test, expect } from "@playwright/test";

/**
 * Reduced-motion path: when prefers-reduced-motion is on, the app must still
 * boot and reach every view — with physics disabled / settle-fast, no console
 * errors, and no hanging animations blocking interaction.
 */
test("app works with prefers-reduced-motion", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("requestfailed", (r) => errors.push("REQFAIL: " + r.url()));

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/index.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  // Home renders and is interactive.
  await expect(page).toHaveTitle(/Budarina/);
  await expect(page.locator("#container canvas")).toHaveCount(1);
  const settle = await page.evaluate(
    () =>
      document.querySelector("#container canvas")?.getBoundingClientRect().width
  );
  expect(settle).toBeGreaterThan(0);

  // Drag doesn't throw under reduced motion.
  const box = await page.locator("#container canvas").boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.52, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(400);

  // Views still switch.
  await page.click('a[data-view="destinations"]');
  await page.waitForTimeout(900);
  await expect(page.locator(".carousel__item")).toHaveCount(13);

  await page.click('a[data-view="contributions"]');
  await page.waitForTimeout(900);
  await expect(page.locator("#contributionsCloth canvas")).toHaveCount(1);

  // Contrib submit still validates.
  await page.fill("#contributionsInput", "Brazil");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  await expect(page.locator("#contributionsInput")).toHaveValue("");

  expect(errors, "no console errors under reduced motion:\n" + errors.join("\n")).toEqual([]);
});