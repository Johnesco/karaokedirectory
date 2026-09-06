// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * The freshness lens (#259): ?fresh=1 reveals each show's lastVerified.
 *
 * Data-agnostic on purpose — an unverified show renders "Not verified", so
 * every compact card carries the line whether or not js/data.json holds any
 * dates yet. The off-by-default test is the one that matters most: the public
 * page must not change.
 */
test.describe('Freshness lens (?fresh=1)', () => {

  test('is off by default — no indicator, no verified lines, no Verified column', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });

    await expect(page.locator('.fresh-indicator')).toHaveCount(0);
    await expect(page.locator('.venue-card__verified')).toHaveCount(0);

    await page.locator('.day-card:not(.day-card--past) .venue-card__link').first().click();
    await expect(page.locator('.venue-detail__schedule-table th', { hasText: 'Verified' })).toHaveCount(0);
  });

  test('shows the indicator and a verified line on every calendar card', async ({ page }) => {
    await page.goto('/?fresh=1');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });

    const indicator = page.locator('.fresh-indicator');
    await expect(indicator).toBeVisible();
    await expect(indicator).toContainText('Freshness lens');

    const cards = page.locator('.day-card .venue-card');
    const lines = page.locator('.day-card .venue-card .venue-card__verified');
    expect(await cards.count()).toBeGreaterThan(0);
    expect(await lines.count()).toBe(await cards.count());
    await expect(lines.first()).toContainText(/Verified|Announced|Not verified/);
  });

  test('adds a Verified column to the detail schedule table', async ({ page }) => {
    await page.goto('/?fresh=1');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });

    await page.locator('.day-card:not(.day-card--past) .venue-card__link').first().click();
    // Whichever surface opened at this viewport (modal or pane) renders the
    // same shared table; the other surface's copy is display:none.
    const th = page.locator('.venue-detail__schedule-table th:visible', { hasText: 'Verified' });
    await expect(th.first()).toBeVisible({ timeout: 5000 });
  });

  test('survives the KJ pages', async ({ page }) => {
    await page.goto('/?kj=all&fresh=1');
    await expect(page.locator('.fresh-indicator')).toBeVisible();
  });

});
