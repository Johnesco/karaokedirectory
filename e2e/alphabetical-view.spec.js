// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Alphabetical view', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-view="alphabetical"]').click();
    await expect(page.locator('.alphabetical-view')).toBeVisible();
  });

  test('alphabetical view renders', async ({ page }) => {
    await expect(page.locator('.alphabetical-view')).toBeVisible();
  });

  test('A-Z index links are present', async ({ page }) => {
    const indexLinks = page.locator('.alphabetical-view__index-link');
    expect(await indexLinks.count()).toBeGreaterThan(0);
  });

  test('venues appear in the list', async ({ page }) => {
    const venueCards = page.locator('.alphabetical-view .venue-card');
    await expect(venueCards.first()).toBeVisible({ timeout: 5000 });
    expect(await venueCards.count()).toBeGreaterThan(0);
  });

  test('search works within alphabetical view', async ({ page }) => {
    const venuesBefore = await page.locator('.alphabetical-view .venue-card:visible').count();

    const searchInput = page.locator('[data-search="query"]');
    await searchInput.fill('Ego');
    await page.waitForTimeout(300);

    const venuesAfter = await page.locator('.alphabetical-view .venue-card:visible').count();
    expect(venuesAfter).toBeLessThan(venuesBefore);
    expect(venuesAfter).toBeGreaterThan(0);
  });

});
