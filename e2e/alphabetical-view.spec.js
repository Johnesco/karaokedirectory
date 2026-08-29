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

  // #223: renderVenueDetailSections read venue.host, so a venue whose hosts all
  // live on schedule entries got no "Presented By" block at all — on every one
  // of the four detail surfaces that share this renderer.
  //
  // Data-agnostic on purpose: a schedule table only grows a Host column when
  // some entry carries its own host, so that column is the signal for "this
  // venue has per-show hosts" without naming a venue the data might drop.
  test('a venue with per-show hosts still shows a Presented By block', async ({ page }) => {
    await expect(page.locator('.alphabetical-view .venue-card').first()).toBeVisible({ timeout: 10000 });

    const result = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.venue-card--full')].filter((c) => {
        const heads = [...c.querySelectorAll('.venue-detail__schedule-table th')];
        return heads.some((h) => h.textContent.trim() === 'Host');
      });
      if (!cards.length) return { found: 0 };
      return {
        found: cards.length,
        withoutHostBlock: cards
          .filter((c) => !c.querySelector('.venue-detail__host-name'))
          .map((c) => c.querySelector('.venue-card__link')?.textContent.trim()),
      };
    });

    expect(result.found).toBeGreaterThan(0);
    expect(result.withoutHostBlock).toEqual([]);
  });

});
