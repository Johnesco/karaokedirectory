// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Debug mode', () => {

  test('loading with ?debug=1 shows debug indicator', async ({ page }) => {
    await page.goto('/?debug=1');
    await expect(page.locator('.day-card').first()).toBeVisible();

    const debugIndicator = page.locator('.debug-indicator');
    await expect(debugIndicator).toBeVisible();
    await expect(debugIndicator).toContainText('Debug Mode');
  });

  test('debug mode is not active by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible();

    const debugIndicator = page.locator('.debug-indicator');
    await expect(debugIndicator).not.toBeVisible();
  });

});

// Source links (#305) were retired by #336: the curator keeps no confirmation
// records any more (#331), so there is nothing to link to. Debug mode must not
// ask for the old local file, and no link may render.
test.describe('Debug mode', () => {
  test('never asks for the retired sources.local.json, and renders no source link (#336)', async ({ page }) => {
    const requested = [];
    await page.route('**/js/sources.local.json', route => { requested.push(route.request().url()); route.fulfill({ status: 404, body: '' }); });
    await page.goto('/?debug=1');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.debug-source')).toHaveCount(0);
    expect(requested).toEqual([]);
  });

  test('each calendar card says why it is in its section (#325)', async ({ page }) => {
    await page.goto('/?debug=1');
    const today = page.locator('.day-card--today');
    await expect(today).toBeVisible({ timeout: 15000 });
    const cards = today.locator('.venue-card');
    const reasons = today.locator('.venue-card__debug-section');
    // One reason per card, and it names the section the card actually sits in.
    expect(await reasons.count()).toBe(await cards.count());
    const mismatched = await today.locator('.day-card__section').evaluateAll(sections =>
      sections.flatMap(s => [...s.querySelectorAll('.venue-card__debug-section')]
        .filter(r => r.dataset.sectionReason !== s.dataset.section).map(r => r.textContent)));
    expect(mismatched).toEqual([]);
  });

  test('without debug mode no section reason is emitted at all (#325)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.venue-card__debug-section')).toHaveCount(0);
  });

});
