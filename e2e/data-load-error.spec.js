// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * When js/data.json fails to load, the calendar must not render. Seven empty
 * day cards read as "no karaoke this week" — a wrong answer, not a missing
 * one (#399). The page says it couldn't load and offers a Retry.
 */
test.describe('Schedule fails to load', () => {

  test('shows an error with Retry instead of an empty week', async ({ page }) => {
    await page.route('**/js/data.json', (route) => route.abort('internetdisconnected'));
    await page.goto('/');

    const error = page.locator('#main-content .error-message');
    await expect(error).toBeVisible({ timeout: 10000 });
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(error.locator('h2')).toHaveText("Couldn't load the schedule");
    await expect(error).toContainText('Check your connection');
    await expect(error.locator('pre')).toHaveCount(0);

    // Nothing that implies an answer: no day cards, no view tabs or search.
    await expect(page.locator('.day-card')).toHaveCount(0);
    await expect(page.locator('[data-view="weekly"]')).toHaveCount(0);
    await expect(page.locator('.loading')).toHaveCount(0);
  });

  test('says "offline" when the browser reports it is offline', async ({ page }) => {
    // Going offline for real would also block the page itself, so only the
    // browser's verdict is faked; the data request is what actually fails.
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false });
    });
    await page.route('**/js/data.json', (route) => route.abort('internetdisconnected'));
    await page.goto('/');

    await expect(page.locator('.error-message')).toContainText('You appear to be offline', { timeout: 10000 });
  });

  test('an HTTP error is treated the same as a network failure', async ({ page }) => {
    await page.route('**/js/data.json', (route) => route.fulfill({ status: 500, body: 'boom' }));
    await page.goto('/');

    await expect(page.locator('.error-message h2')).toHaveText("Couldn't load the schedule", { timeout: 10000 });
    await expect(page.locator('.error-message')).not.toContainText('500');
    await expect(page.locator('.day-card')).toHaveCount(0);
  });

  test('Retry reloads the page and the calendar renders once data is back', async ({ page }) => {
    let fail = true;
    await page.route('**/js/data.json', (route) => (fail ? route.abort('internetdisconnected') : route.continue()));
    await page.goto('/');

    const retry = page.getByRole('button', { name: 'Retry' });
    await expect(retry).toBeVisible({ timeout: 10000 });

    fail = false;
    await retry.click();

    await expect(page.locator('.weekly-view > .weekly-view__grid .day-card')).toHaveCount(7, { timeout: 10000 });
    await expect(page.locator('.error-message')).toHaveCount(0);
  });
});
