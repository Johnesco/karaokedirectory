// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Smoke tests', () => {

  test('homepage loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Austin Karaoke Directory');
  });

  test('day cards render in weekly view', async ({ page }) => {
    await page.goto('/');
    // Wait for the app to initialize and render day cards
    const dayCards = page.locator('.day-card');
    await expect(dayCards.first()).toBeVisible({ timeout: 10000 });
    // Main weekly grid should show 7 day cards (extended sections have additional day cards)
    const mainGrid = page.locator('.weekly-view > .weekly-view__grid');
    await expect(mainGrid.locator('.day-card')).toHaveCount(7);
  });

  test('venue cards appear within day cards', async ({ page }) => {
    await page.goto('/');
    // At least one visible venue card should render (skip collapsed past-day cards)
    const visibleVenue = page.locator('.day-card:not(.day-card--past) .venue-card').first();
    await expect(visibleVenue).toBeVisible({ timeout: 10000 });
    // Directory has 70+ venues, so there should be many cards total
    expect(await page.locator('.venue-card').count()).toBeGreaterThan(0);
  });

  test('navigation tabs are present and clickable', async ({ page }) => {
    await page.goto('/');

    const weeklyTab = page.locator('[data-view="weekly"]');
    const alphaTab = page.locator('[data-view="alphabetical"]');
    const mapTab = page.locator('[data-view="map"]');

    await expect(weeklyTab).toBeVisible();
    await expect(alphaTab).toBeVisible();
    await expect(mapTab).toBeVisible();

    // Switch to alphabetical view
    await alphaTab.click();
    // Venue list should appear (alphabetical view renders venue cards differently)
    await expect(page.locator('.venue-card').first()).toBeVisible({ timeout: 5000 });
  });

  test('search filters venues', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('[data-search="query"]');
    await expect(searchInput).toBeVisible();

    // Type a search query — "Ego's" is a well-known Austin karaoke venue
    await searchInput.fill('Ego');
    // Give the filter a moment to apply
    await page.waitForTimeout(300);

    // Visible venue cards should be filtered down
    const visibleVenues = page.locator('.venue-card:visible');
    const count = await visibleVenues.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(70);
  });

});
