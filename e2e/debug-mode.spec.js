// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Debug mode', () => {

  test('loading with ?debug=1 shows debug indicator', async ({ page }) => {
    await page.goto('/?debug=1');
    await expect(page.locator('.day-card').first()).toBeVisible();

    const debugIndicator = page.locator('.debug-indicator');
    await expect(debugIndicator).toBeVisible();
    await expect(debugIndicator).toContainText('Debug Mode');
  });

  test('debug mode is not active by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible();

    const debugIndicator = page.locator('.debug-indicator');
    await expect(debugIndicator).not.toBeVisible();
  });

});
