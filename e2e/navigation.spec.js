// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Navigation — view switching & week navigation', () => {

  test('switch between Weekly → Alphabetical → Map views', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 10000 });

    // Switch to Alphabetical
    await page.locator('[data-view="alphabetical"]').click();
    await expect(page.locator('.alphabetical-view')).toBeVisible();

    // Switch to Map (uses main nav tab)
    await page.locator('[data-view="map"]').click();
    await expect(page.locator('.map-view')).toBeVisible({ timeout: 10000 });

    // Map enters immersive mode — main nav is hidden.
    // Use the map's own view switcher to go back to Weekly.
    await page.locator('.map-view-switcher [data-view="weekly"]').click();
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 10000 });
  });

  test('correct view container renders for each tab', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 10000 });

    // Weekly is default — main grid has 7 day cards
    const mainGrid = page.locator('.weekly-view > .weekly-view__grid');
    await expect(mainGrid.locator('.day-card')).toHaveCount(7);

    // Alphabetical
    await page.locator('[data-view="alphabetical"]').click();
    await expect(page.locator('.alphabetical-view')).toBeVisible();

    // Map
    await page.locator('[data-view="map"]').click();
    await expect(page.locator('.map-view')).toBeVisible({ timeout: 10000 });
  });

  test('week navigation — next, previous, today', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 10000 });

    const weekRange = page.locator('.navigation__week-range');
    const initialText = await weekRange.textContent();

    // Navigate to next week
    await page.locator('[data-week="1"]').click();
    await expect(weekRange).not.toHaveText(initialText);
    const nextWeekText = await weekRange.textContent();

    // Navigate back (previous week)
    await page.locator('[data-week="-1"]').click();
    await expect(weekRange).toHaveText(initialText);

    // Navigate forward again, then use Today button
    await page.locator('[data-week="1"]').click();
    await expect(weekRange).toHaveText(nextWeekText);
    await page.locator('[data-week="today"]').click();
    await expect(weekRange).toHaveText(initialText);
  });

  test('deep link — ?view=alphabetical loads alphabetical view', async ({ page }) => {
    await page.goto('/?view=alphabetical');
    await expect(page.locator('.alphabetical-view')).toBeVisible({ timeout: 10000 });
  });

  test('deep link — ?view=map loads map view', async ({ page }) => {
    await page.goto('/?view=map');
    await expect(page.locator('.map-view')).toBeVisible({ timeout: 10000 });
  });

});
