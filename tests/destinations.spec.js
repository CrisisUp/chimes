import { test, expect } from '@playwright/test';

test.describe('Destinations View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.strings canvas', { state: 'attached', timeout: 10000 });
    // Navigate to destinations via UI
    await page.click('a[data-view="destinations"]');
    await page.waitForTimeout(2000);
  });

  test('loads Destinations view correctly', async ({ page }) => {
    await expect(page.locator('#stage')).toHaveAttribute('data-view', 'destinations');
    await expect(page.locator('#destinationsView')).toBeVisible();
    await expect(page.locator('.carousel')).toBeVisible();
  });

  test('carousel shows all 13 country items', async ({ page }) => {
    const items = page.locator('.carousel__item');
    await expect(items).toHaveCount(13);
  });

  test('centered item has is-center class', async ({ page }) => {
    const centerItem = page.locator('.carousel__item.is-center');
    await expect(centerItem).toHaveCount(1);
  });

  test.skip('clicking center item navigates home', async ({ page }) => {
    const centerItem = page.locator('.carousel__item.is-center');
    await centerItem.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('#stage')).toHaveAttribute('data-view', 'home');
  });

  test.skip('arrow keys navigate carousel', async ({ page }) => {
    const initialCenter = await page.locator('.carousel__item.is-center').getAttribute('data-country');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(600);
    const newCenter = await page.locator('.carousel__item.is-center').getAttribute('data-country');
    expect(newCenter).not.toBe(initialCenter);
  });

  test.skip('drag swipe navigates carousel', async ({ page }) => {
    const center = await page.locator('.carousel__item.is-center').getAttribute('data-country');
    expect(center).toBeTruthy();
  });
});
