// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Weekly view — calendar behavior', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });
  });

  test('7 day cards render in main grid', async ({ page }) => {
    const mainGrid = page.locator('.weekly-view > .weekly-view__grid');
    await expect(mainGrid.locator('.day-card')).toHaveCount(7);
  });

  test('today card has .day-card--today class', async ({ page }) => {
    const todayCard = page.locator('.day-card--today');
    await expect(todayCard).toHaveCount(1);
    await expect(todayCard).toBeVisible();
  });

  test('past days have .day-card--past and are collapsed', async ({ page }) => {
    const mainGrid = page.locator('.weekly-view > .weekly-view__grid');
    const pastCards = mainGrid.locator('.day-card--past');
    const count = await pastCards.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const card = pastCards.nth(i);
        // Past cards exist but should NOT have expanded class by default
        await expect(card).not.toHaveClass(/day-card--expanded/);
      }
    }
    // If today is Monday/Sunday, there may be no past cards — that's fine
  });

  test('click past day header expands and collapses it', async ({ page }) => {
    const mainGrid = page.locator('.weekly-view > .weekly-view__grid');
    const pastCards = mainGrid.locator('.day-card--past');
    const count = await pastCards.count();

    if (count === 0) {
      test.skip();
      return;
    }

    const firstPast = pastCards.first();
    const header = firstPast.locator('.day-card__header');

    // Click to expand
    await header.click();
    await expect(firstPast).toHaveClass(/day-card--expanded/);

    // Click to collapse
    await header.click();
    await expect(firstPast).not.toHaveClass(/day-card--expanded/);
  });

  test('venue cards show name and time', async ({ page }) => {
    // Find a visible venue card (skip collapsed past-day cards)
    const visibleVenue = page.locator('.day-card:not(.day-card--past) .venue-card').first();
    await expect(visibleVenue).toBeVisible({ timeout: 10000 });

    await expect(visibleVenue.locator('.venue-card__name')).toBeVisible();
    await expect(visibleVenue.locator('.venue-card__time')).toBeVisible();
  });

  test('extended sections render below the grid', async ({ page }) => {
    const extendedSections = page.locator('.extended-section');
    await expect(extendedSections.first()).toBeVisible({ timeout: 10000 });
    expect(await extendedSections.count()).toBeGreaterThan(0);
  });

  test('extended section toggle collapses and expands content', async ({ page }) => {
    // Clear any persisted collapse state
    await page.evaluate(() => {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('extendedSection_')) {
          localStorage.removeItem(key);
        }
      }
    });
    await page.reload();
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });

    const section = page.locator('.extended-section').first();
    await expect(section).toBeVisible({ timeout: 10000 });

    // Section starts expanded (no collapsed class)
    await expect(section).not.toHaveClass(/extended-section--collapsed/);

    // Click toggle button to collapse
    const toggle = section.locator('.extended-section__toggle');
    await toggle.click();
    await expect(section).toHaveClass(/extended-section--collapsed/);

    // Click again to expand
    await toggle.click();
    await expect(section).not.toHaveClass(/extended-section--collapsed/);
  });

});
