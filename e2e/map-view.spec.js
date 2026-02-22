// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Map view — immersive mode & controls', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/?view=map');
    await expect(page.locator('.map-view')).toBeVisible({ timeout: 15000 });
  });

  test('map view enters immersive mode', async ({ page }) => {
    // Body should have view--map class
    await expect(page.locator('body')).toHaveClass(/view--map/);

    // Header and footer should be hidden
    await expect(page.locator('.site-header')).not.toBeVisible();
    await expect(page.locator('.site-footer')).not.toBeVisible();
  });

  test('map container renders', async ({ page }) => {
    const mapContainer = page.locator('.map-view__container');
    await expect(mapContainer).toBeVisible();
  });

  test('floating controls are visible', async ({ page }) => {
    await expect(page.locator('.map-controls')).toBeVisible();
    await expect(page.locator('.map-view-switcher')).toBeVisible();
  });

  test('view switcher has Calendar and A-Z buttons', async ({ page }) => {
    const calendarBtn = page.locator('.map-view-switcher [data-view="weekly"]');
    const alphaBtn = page.locator('.map-view-switcher [data-view="alphabetical"]');

    await expect(calendarBtn).toBeVisible();
    await expect(alphaBtn).toBeVisible();
  });

  test('view switcher — Calendar exits to weekly view', async ({ page }) => {
    await page.locator('.map-view-switcher [data-view="weekly"]').click();

    await expect(page.locator('.weekly-view')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('body')).not.toHaveClass(/view--map/);
  });

  test('view switcher — A-Z exits to alphabetical view', async ({ page }) => {
    await page.locator('.map-view-switcher [data-view="alphabetical"]').click();

    await expect(page.locator('.alphabetical-view')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('body')).not.toHaveClass(/view--map/);
  });

  test('Escape key exits map to weekly view (no card open)', async ({ page }) => {
    // Make sure no venue card is open
    await expect(page.locator('.map-venue-card--visible')).not.toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.locator('.weekly-view')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('body')).not.toHaveClass(/view--map/);
  });

  test('dedicated filter toggle button exists', async ({ page }) => {
    const dedicatedBtn = page.locator('[data-action="toggle-dedicated"]');
    await expect(dedicatedBtn).toBeVisible();
  });

});
