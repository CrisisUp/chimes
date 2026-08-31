import { test, expect } from '@playwright/test';

test.describe('Contributions View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html#contributions');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#contributionsCloth canvas', { state: 'attached', timeout: 15000 });
    await page.waitForTimeout(2000);
  });

  test('loads Contributions view', async ({ page }) => {
    await expect(page.locator('#stage')).toHaveAttribute('data-view', 'contributions');
    await expect(page.locator('#contributionsView')).not.toBeHidden();
  });

  test('shows seeded contributions cloth', async ({ page }) => {
    const canvas = page.locator('#contributionsCloth canvas');
    await expect(canvas).toBeVisible();
  });

  test('form accepts valid country name', async ({ page }) => {
    const input = page.locator('#contributionsInput');
    await input.fill('France');
    await page.locator('#contributionsSubmit').click();
    await page.waitForTimeout(1000);

    // Should show success (no error hint)
    await expect(page.locator('#contributionsHint')).toBeHidden();
    await expect(input).toHaveValue('');
  });

  test('form rejects empty input', async ({ page }) => {
    await page.locator('#contributionsSubmit').click();
    await page.waitForTimeout(500);

    await expect(page.locator('#contributionsHint')).toBeVisible();
    await expect(page.locator('#contributionsHint')).toContainText('Enter a country name');
  });

  test('form rejects non-country name', async ({ page }) => {
    const input = page.locator('#contributionsInput');
    await input.fill('NotACountry123');
    await page.locator('#contributionsSubmit').click();
    await page.waitForTimeout(500);

    await expect(page.locator('#contributionsHint')).toBeVisible();
    await expect(page.locator('#contributionsHint')).toContainText('Please enter a country name');
  });

  test('form rejects too long name', async ({ page }) => {
    const input = page.locator('#contributionsInput');
    await input.fill('A'.repeat(41));
    await page.locator('#contributionsSubmit').click();
    await page.waitForTimeout(500);

    await expect(page.locator('#contributionsHint')).toBeVisible();
    await expect(page.locator('#contributionsHint')).toContainText('40 characters');
  });

  test('Visual: contributions header', async ({ page }) => {
    await expect(page.locator('.contributions__header')).toHaveScreenshot('contributions-header.png');
  });
});