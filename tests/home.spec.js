import { test, expect } from '@playwright/test';

test.describe('Home View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    // Wait for canvas to be ready
    await page.waitForSelector('.strings canvas', { state: 'attached', timeout: 10000 });
  });

  test('loads without errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.strings canvas');

    const filtered = errors.filter(e => !e.includes('favicon'));
    expect(filtered, `Console errors: ${JSON.stringify(filtered)}`).toHaveLength(0);
  });

  test('shows correct country (China by default)', async ({ page }) => {
    await expect(page.locator('#pageTitle')).toContainText('China');
    await expect(page.locator('#eyebrowText')).toContainText('缘分');
    await expect(page.locator('#roofImg')).toHaveAttribute('src', './roof-china.webp');
  });

  test('side buttons show correct neighbors', async ({ page }) => {
    // Left button = Vietnam (previous in COUNTRY_ORDER)
    await expect(page.locator('#btnLeftLabel')).toHaveText('Vietnam');
    // Right button = Japan (next in COUNTRY_ORDER)
    await expect(page.locator('#btnRightLabel')).toHaveText('Japan');
  });

  test('navigation menu has correct links', async ({ page }) => {
    await expect(page.locator('.menu a').nth(0)).toHaveText('Home');
    await expect(page.locator('.menu a').nth(1)).toHaveText('Destinations');
    await expect(page.locator('.menu a').nth(2)).toHaveText('Contributions');
    await expect(page.locator('.menu a').nth(0)).toHaveClass('is-active');
  });

  test('Play button opens Tweakpane panel', async ({ page }) => {
    const chatBtn = page.locator('#chatBtn');
    await expect(chatBtn).toBeVisible();
    await expect(chatBtn).toHaveAttribute('aria-expanded', 'false');

    await chatBtn.click();
    await expect(chatBtn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.tp-dfwv')).toBeVisible();
  });

  test('About modal opens and closes', async ({ page }) => {
    const aboutBtn = page.locator('#aboutBtn');
    await aboutBtn.click();

    const modal = page.locator('#aboutModal');
    await expect(modal).toBeVisible();
    await expect(modal).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#aboutTitle')).toContainText("Marina Budarina");

    await page.locator('#aboutClose').click();
    await expect(modal).toBeHidden();
    await expect(modal).toHaveAttribute('aria-hidden', 'true');
  });
});

test.describe('Home View - Country Transition', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.strings canvas');
  });

  test('clicking right button transitions to Japan', async ({ page }) => {
    await page.locator('#btnRight').click();
    await page.waitForTimeout(1000); // Wait for transition

    await expect(page.locator('#pageTitle')).toContainText('Japan');
    await expect(page.locator('#eyebrowText')).toContainText('一期一会');
    await expect(page.locator('#area')).toHaveAttribute('data-country', 'japan');
  });

  test('clicking left button transitions to Vietnam', async ({ page }) => {
    await page.locator('#btnLeft').click();
    await page.waitForTimeout(1000);

    await expect(page.locator('#pageTitle')).toContainText('Vietnam');
    await expect(page.locator('#eyebrowText')).toContainText('Duyên');
    await expect(page.locator('#area')).toHaveAttribute('data-country', 'vietnam');
  });
});

test.describe('Home View - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.strings canvas');
    // Wait for cloth to settle
    await page.waitForTimeout(2000);
  });

  test.skip('main area matches baseline', async ({ page }) => {
    await expect(page.locator('.area')).toHaveScreenshot('home-china.png');
  });

  test.skip('bottom copy matches baseline', async ({ page }) => {
    await expect(page.locator('.bottom-copy')).toHaveScreenshot('bottom-copy-china.png');
  });

  test.skip('topbar matches baseline', async ({ page }) => {
    await expect(page.locator('.topbar')).toHaveScreenshot('topbar.png');
  });
});