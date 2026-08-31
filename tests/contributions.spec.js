import { test, expect } from '@playwright/test';

test.describe('Contributions View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.strings canvas', { state: 'attached', timeout: 10000 });
    // Navigate to contributions via UI
    await page.click('a[data-view="contributions"]');
    await page.waitForTimeout(1000);
  });

  test('loads Contributions view', async ({ page }) => {
    await expect(page.locator('#stage')).toHaveAttribute('data-view', 'contributions');
    await expect(page.locator('#contributionsView')).toBeVisible();
  });

  test('shows form elements', async ({ page }) => {
    await expect(page.locator('#contributionsInput')).toBeVisible();
    await expect(page.locator('#contributionsSubmit')).toBeVisible();
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
    // Bypass HTML required validation to test JS validation
    await page.locator('#contributionsForm').evaluate(form => {
      form.querySelector('#contributionsInput').removeAttribute('required');
    });
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

  test('input maxlength prevents over-length input', async ({ page }) => {
    const input = page.locator('#contributionsInput');
    // The HTML maxlength="40" prevents typing more than 40 chars
    const maxlength = await input.getAttribute('maxlength');
    expect(maxlength).toBe('40');
  });
});
