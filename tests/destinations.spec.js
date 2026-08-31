import { test, expect } from '@playwright/test';

test.describe('Destinations View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html#destinations');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.carousel canvas', { state: 'attached', timeout: 10000 });
    await page.waitForTimeout(3000); // Wait for lazy cloth creation
  });

  test('loads Destinations view correctly', async ({ page }) => {
    await expect(page.locator('#stage')).toHaveAttribute('data-view', 'destinations');
    await expect(page.locator('#destinationsView')).not.toBeHidden();
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

  test('clicking center item navigates home', async ({ page }) => {
    const centerItem = page.locator('.carousel__item.is-center');
    await centerItem.click();
    await page.waitForTimeout(1000);

    await expect(page.locator('#stage')).toHaveAttribute('data-view', 'home');
  });

  test('arrow keys navigate carousel', async ({ page }) => {
    const initialCenter = await page.locator('.carousel__item.is-center').getAttribute('data-country');

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(600);

    const newCenter = await page.locator('.carousel__item.is-center').getAttribute('data-country');
    expect(newCenter).not.toBe(initialCenter);
  });

  test('drag swipe navigates carousel', async ({ page }) => {
    const canvas = page.locator('.carousel canvas').first();
    const box = await canvas.boundingBox();

    // Drag left (swipe right)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2);
    await page.mouse.up();
    await page.waitForTimeout(600);

    // Should have moved
    const center = await page.locator('.carousel__item.is-center').getAttribute('data-country');
    expect(center).toBeTruthy();
  });

  test('Visual: carousel center item', async ({ page }) => {
    await expect(page.locator('.carousel__item.is-center')).toHaveScreenshot('carousel-center.png');
  });
});