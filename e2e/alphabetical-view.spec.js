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
  //
  // A host is a KJ, a company, or both (ADR-007). A company-only host renders
  // its company line and no name line, so "names someone" means either. This
  // test used to require a name line, and went red on Alcove Cantina — shows
  // run by a company with no KJ named — although its page was right (#318).
  // The per-show host shapes are pinned one by one in test/render.test.mjs.
  test('a venue with per-show hosts presents every host in its Host column', async ({ page }) => {
    await expect(page.locator('.alphabetical-view .venue-card').first()).toBeVisible({ timeout: 10000 });

    const result = await page.evaluate(() => {
      const text = (el) => (el ? el.textContent.trim() : '');
      // The same "Name (Company)" / "Name" / "Company" form the Host cell uses
      // (formatHostDisplay), so a cell can be matched to its block.
      const label = (block) => {
        const name = text(block.querySelector('.venue-detail__host-name'));
        const company = text(block.querySelector('.venue-detail__host-affiliation'));
        return name && company ? `${name} (${company})` : name || company;
      };
      const cards = [...document.querySelectorAll('.venue-card--full')].filter((c) =>
        [...c.querySelectorAll('.venue-detail__schedule-table th')].some((h) => h.textContent.trim() === 'Host'));
      const problems = [];
      for (const card of cards) {
        const venue = text(card.querySelector('.venue-card__link'));
        const blocks = [...card.querySelectorAll('.venue-detail__host')];
        if (!blocks.length) { problems.push(`${venue}: no Presented By block`); continue; }
        const presented = new Set(blocks.map(label));
        if (presented.has('')) problems.push(`${venue}: a host block names nobody`);
        for (const cell of card.querySelectorAll('.venue-detail__schedule-table td[data-label="Host"]')) {
          const host = text(cell);
          if (host && !presented.has(host)) problems.push(`${venue}: "${host}" hosts a show but is not under Presented By`);
        }
      }
      return { found: cards.length, problems };
    });

    expect(result.found).toBeGreaterThan(0);
    expect(result.problems).toEqual([]);
  });

});
