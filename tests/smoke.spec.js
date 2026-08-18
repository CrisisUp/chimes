import { test, expect } from "@playwright/test";

/**
 * End-to-end smoke: the app bootstraps and the main flows work without console
 * errors. Covers home → destinations → contributions round-trip, the chime
 * strike path, a contributions submit, and the Tweakpane country switch.
 */
test("app boots and every view works without console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("requestfailed", (r) => errors.push("REQFAIL: " + r.url()));

  // HOME
  await page.goto("/index.html", { waitUntil: "networkidle" });
  await expect(page).toHaveTitle(/Budarina/);
  await expect(page.locator("#container canvas")).toHaveCount(1);

  // Grab-drag on the home cloth exercises the chime strike path without errors.
  const box = await page.locator("#container canvas").boundingBox();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.mouse.down();
  for (let i = 0; i < 6; i++) {
    await page.mouse.move(box.x + box.width * (0.4 + i * 0.02), box.y + box.height * 0.5, { steps: 3 });
    await page.waitForTimeout(25);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);

  // DESTINATIONS
  await page.click('a[data-view="destinations"]');
  await page.waitForTimeout(900);
  await expect(page.locator(".carousel__item")).toHaveCount(13);

  // CONTRIBUTIONS
  await page.click('a[data-view="contributions"]');
  await page.waitForTimeout(900);
  await expect(page.locator("#contributionsCloth canvas")).toHaveCount(1);
  await page.fill("#contributionsInput", "Argentina");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  await expect(page.locator("#contributionsInput")).toHaveValue("");
  await page.fill("#contributionsInput", "Atlantis");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  await expect(page.locator("#contributionsHint")).toHaveText("Please enter a country name.");

  // BACK HOME + Tweakpane dropdown
  await page.click('a[data-view="home"]');
  await page.waitForTimeout(700);
  await page.keyboard.press("`");
  await page.waitForTimeout(400);
  await expect(page.locator(".tp-dfwv select option")).toHaveCount(13);
  await page.evaluate((n) => {
    const sel = document.querySelector(".tp-dfwv select");
    sel.value = n;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, "Brazil");
  await page.waitForTimeout(2800);
  await expect(page).toHaveTitle("Budarina — Brazil");

  expect(errors, "no console errors across the whole flow:\n" + errors.join("\n")).toEqual([]);
});