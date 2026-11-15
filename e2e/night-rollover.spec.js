// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * #401. Karaoke runs past midnight, so the calendar keeps the night under way
 * as Today until 1 AM: at 12:45 AM Saturday, Friday is still Today, expanded,
 * and the page scrolls to it. From 1 AM Saturday takes over.
 *
 * Nov 2026: Fri 13, Sat 14, Sun 15. Sun 15 starts a new week.
 */
const grid = '.weekly-view > .weekly-view__grid';

async function loadAt(page, when) {
  await page.clock.setFixedTime(when);
  await page.goto('/');
  await expect(page.locator(`${grid} .day-card--today`)).toBeVisible({ timeout: 15000 });
}

test.describe('Night rollover (#401)', () => {

  test('at 12:45 AM Saturday, Friday is still Today and not past', async ({ page }) => {
    await loadAt(page, new Date(2026, 10, 14, 0, 45));
    const today = page.locator(`${grid} .day-card--today`);
    await expect(today).toHaveCount(1);
    await expect(today).toHaveClass(/day-card--friday/);
    await expect(today).not.toHaveClass(/day-card--past/);
    await expect(today.locator('.day-card__today-badge')).toHaveText('Today');
    // Saturday is ahead, not today.
    await expect(page.locator(`${grid} .day-card--saturday`)).not.toHaveClass(/day-card--today|day-card--past/);
    // Thursday is past.
    await expect(page.locator(`${grid} .day-card--thursday`)).toHaveClass(/day-card--past/);
  });

  test('at 1:00 AM Saturday, Saturday is Today and Friday is past', async ({ page }) => {
    await loadAt(page, new Date(2026, 10, 14, 1, 0));
    await expect(page.locator(`${grid} .day-card--today`)).toHaveClass(/day-card--saturday/);
    await expect(page.locator(`${grid} .day-card--friday`)).toHaveClass(/day-card--past/);
  });

  test('at 12:30 AM Sunday, the calendar opens on the week that holds Saturday night', async ({ page }) => {
    await loadAt(page, new Date(2026, 10, 15, 0, 30));
    const today = page.locator(`${grid} .day-card--today`);
    await expect(today).toHaveClass(/day-card--saturday/);
    await expect(today.locator('.day-card__date')).toHaveText('Sat 11/14');
    // On the current week, so the jump-to-today button stays hidden while
    // the Today card is on screen.
    await expect(page.locator('#jump-to-today')).toBeHidden();
  });
});
