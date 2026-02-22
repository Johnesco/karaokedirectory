// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Search & dedicated filter', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });
  });

  test('typing in search reduces visible venue count', async ({ page }) => {
    const searchInput = page.locator('[data-search="query"]');
    await expect(searchInput).toBeVisible();

    const venuesBefore = await page.locator('.venue-card:visible').count();

    await searchInput.fill('Ego');
    await page.waitForTimeout(300);

    const venuesAfter = await page.locator('.venue-card:visible').count();
    expect(venuesAfter).toBeLessThan(venuesBefore);
    expect(venuesAfter).toBeGreaterThan(0);
  });

  test('clear button appears and resets search', async ({ page }) => {
    const searchInput = page.locator('[data-search="query"]');

    await searchInput.fill('Ego');
    await page.waitForTimeout(300);

    const clearBtn = page.locator('[data-search="clear"]');
    await expect(clearBtn).toBeVisible();

    const filteredCount = await page.locator('.venue-card:visible').count();

    await clearBtn.click();
    await page.waitForTimeout(300);

    await expect(searchInput).toHaveValue('');

    const restoredCount = await page.locator('.venue-card:visible').count();
    expect(restoredCount).toBeGreaterThan(filteredCount);
  });

  test('search by venue name', async ({ page }) => {
    const searchInput = page.locator('[data-search="query"]');
    await searchInput.fill('Ego');
    await page.waitForTimeout(300);

    const matchingCards = page.locator('.venue-card:visible .venue-card__name');
    await expect(matchingCards.first()).toBeVisible();

    const firstName = await matchingCards.first().textContent();
    expect(firstName.toLowerCase()).toContain('ego');
  });

  test('search with no results shows empty day cards', async ({ page }) => {
    const searchInput = page.locator('[data-search="query"]');
    await searchInput.fill('zzzzxxxxxnovenuehere');
    await page.waitForTimeout(300);

    const mainGrid = page.locator('.weekly-view > .weekly-view__grid');
    const emptyCards = mainGrid.locator('.day-card--empty');
    const totalCards = mainGrid.locator('.day-card');
    expect(await emptyCards.count()).toBe(await totalCards.count());
  });

  test('dedicated filter toggle changes venue display', async ({ page }) => {
    const toggle = page.locator('[data-filter="dedicated"]');
    await expect(toggle).toBeVisible();

    // Default state: showDedicated is true (checkbox checked)
    await expect(toggle).toBeChecked();

    // Count venues in non-past day cards before toggling
    const venueSelector = '.day-card:not(.day-card--past) .venue-card';
    const countBefore = await page.locator(venueSelector).count();

    // Uncheck to hide dedicated venues — count should decrease
    await toggle.uncheck();
    await page.waitForTimeout(300);

    const countAfter = await page.locator(venueSelector).count();
    expect(countAfter).toBeLessThan(countBefore);

    // Re-check should restore original count
    await toggle.check();
    await page.waitForTimeout(300);
    const countRestored = await page.locator(venueSelector).count();
    expect(countRestored).toBe(countBefore);
  });

  test('search persists when switching views', async ({ page }) => {
    const searchInput = page.locator('[data-search="query"]');
    await searchInput.fill('Ego');
    await page.waitForTimeout(300);

    // Switch to alphabetical
    await page.locator('[data-view="alphabetical"]').click();
    await expect(page.locator('.alphabetical-view')).toBeVisible();

    // Search input should still have the query
    await expect(searchInput).toHaveValue('Ego');

    // Filtered results should show in alphabetical view
    const visibleVenues = page.locator('.venue-card:visible');
    const count = await visibleVenues.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(70);
  });

});
