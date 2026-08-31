import { test, expect } from '@playwright/test';

test.describe('Responsive / Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('Home view works on mobile', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.strings canvas', { state: 'attached', timeout: 10000 });

    const area = page.locator('#area');
    const eyebrow = page.locator('.eyebrow');

    await expect(area).toBeVisible();
    await expect(eyebrow).toBeVisible();
  });

  test('Mobile tabs visible', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');

    const tabs = page.locator('.mobile-tabs');
    await expect(tabs).toBeVisible();
    await expect(tabs.locator('.mobile-tab')).toHaveCount(3);
  });

  test('Country buttons repositioned on mobile', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');

    const btnLeft = page.locator('#btnLeft');
    const btnRight = page.locator('#btnRight');

    await expect(btnLeft).toBeVisible();
    await expect(btnRight).toBeVisible();
  });

  test('Destinations carousel on mobile', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.strings canvas', { state: 'attached', timeout: 10000 });
    // Navigate via mobile tabs (menu is hidden on mobile)
    await page.click('.mobile-tab[data-view="destinations"]');
    await page.waitForTimeout(2000);

    await expect(page.locator('.carousel__viewport')).toBeVisible();
    const items = page.locator('.carousel__item');
    await expect(items).toHaveCount(13);
  });

  test('Contributions on mobile', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.strings canvas', { state: 'attached', timeout: 10000 });
    // Navigate via mobile tabs
    await page.click('.mobile-tab[data-view="contributions"]');
    await page.waitForTimeout(1000);

    await expect(page.locator('#contributionsInput')).toBeVisible();
  });

  test.skip('Visual: mobile home', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.strings canvas');
    await page.waitForTimeout(2000);
    await expect(page.locator('.stage')).toHaveScreenshot('mobile-home.png');
  });
});

test.describe('Tablet Viewport', () => {
  test.use({ viewport: { width: 768, height: 1024 } }); // iPad

  test('Home on tablet', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.strings canvas', { state: 'attached', timeout: 10000 });

    await expect(page.locator('.area')).toBeVisible();
    await expect(page.locator('.country-btn')).toHaveCount(2);
  });

  test.skip('Visual: tablet home', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.strings canvas');
    await page.waitForTimeout(2000);
    await expect(page.locator('.stage')).toHaveScreenshot('tablet-home.png');
  });
});
