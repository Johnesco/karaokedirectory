// @ts-check
/**
 * Data smoke test (#395) — what a data publish runs instead of the full suite.
 *
 * A curator publish changes one file, js/data.json. The validator proves the
 * file is well-formed; this proves the site still renders it. It deliberately
 * asserts nothing about WHICH shows are listed, so it cannot fail because the
 * data or the date moved — only because the site could not show the data.
 *
 * Tagged @data-smoke: `npm run test:smoke` runs just this file, and CI runs it
 * alone on a PR whose only changed file is js/data.json. It also runs as part
 * of the full suite.
 */
const { test, expect } = require('@playwright/test');

/** Fail on any uncaught page error; the app swallowing bad data is the bug. */
function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

test.describe('Data smoke @data-smoke', () => {
  test('the calendar renders seven days and at least one show', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.weekly-view > .weekly-view__grid .day-card')).toHaveCount(7);
    expect(await page.locator('.venue-card').count()).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('the A to Z view lists every active venue in the data', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?view=alphabetical');
    await expect(page.locator('.venue-card').first()).toBeVisible({ timeout: 15000 });

    // Venues with their own activePeriod are left out of the expectation: the
    // view decides those by today's date, which is not this test's business.
    const expected = await page.evaluate(async () => {
      const data = await (await fetch('js/data.json')).json();
      return data.listings.filter(v => v.active !== false && !v.activePeriod).map(v => v.id);
    });
    expect(expected.length).toBeGreaterThan(0);

    const rendered = new Set(await page.locator('.venue-card[data-venue-id]').evaluateAll(
      (cards) => cards.map(c => c.getAttribute('data-venue-id'))
    ));
    expect(expected.filter(id => !rendered.has(id))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('a venue opens its detail view', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/?view=alphabetical');
    const link = page.locator('.venue-card__link').first();
    await expect(link).toBeVisible({ timeout: 15000 });
    await link.click();
    await expect(page.locator('.venue-modal__title')).toBeVisible({ timeout: 5000 });
    expect(errors).toEqual([]);
  });

  test('the submit page builds its tag list from the data', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/submit.html');
    await expect(page.locator('#tag-checkbox-grid input[type="checkbox"]').first()).toBeAttached({ timeout: 15000 });
    expect(errors).toEqual([]);
  });
});
