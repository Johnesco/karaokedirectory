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

  /*
   * #206. An extended section's header count, its "plus N already shown above"
   * notice, and the venues in its cards are three statements about one thing,
   * and they used to disagree: the dedup was computed, used to write the first
   * two, then discarded because renderDayCard(date) re-derived the full day.
   * A section reading "1 venue / plus 67 already shown above" rendered 17.
   *
   * These assert the agreement rather than any particular number, so they hold
   * as the dataset changes.
   */
  test('every extended section renders exactly the venue count it advertises', async ({ page }) => {
    const sections = page.locator('.extended-section');
    const n = await sections.count();
    expect(n).toBeGreaterThan(0);

    for (let i = 0; i < n; i++) {
      const section = sections.nth(i);
      const title = (await section.locator('.extended-section__title').textContent())?.trim();
      const advertised = parseInt(
        (await section.locator('.extended-section__count').textContent()) || '', 10);

      const names = await section.locator('.venue-card__link').allTextContents();
      const rendered = new Set(names.map((s) => s.trim()));

      expect(rendered.size, `${title}: header says ${advertised}`).toBe(advertised);
    }
  });

  test('a deduplicating section never repeats a venue shown above it', async ({ page }) => {
    // "Next Week" is exempt by design — WeeklyView passes deduplicate:false so
    // it shows the whole week. The dedup notice is what marks the others.
    const seen = new Set(
      (await page.locator('.weekly-view > .weekly-view__grid .venue-card__link').allTextContents())
        .map((s) => s.trim()));

    const sections = page.locator('.extended-section');
    for (let i = 0; i < await sections.count(); i++) {
      const section = sections.nth(i);
      const title = (await section.locator('.extended-section__title').textContent())?.trim();
      const names = (await section.locator('.venue-card__link').allTextContents()).map((s) => s.trim());
      const dedupes = await section.locator('.extended-section__dedup-notice').count() > 0;

      if (dedupes) {
        const repeats = [...new Set(names)].filter((v) => seen.has(v));
        expect(repeats, `${title} repeats venues its notice says are above`).toEqual([]);
      }
      names.forEach((v) => seen.add(v));
    }
  });

  test('the day-card footer count matches the cards the day actually shows', async ({ page }) => {
    // The footer counts unique OPEN venues, so a card whose only event is
    // excluded that day is deliberately not counted. Assert footer <= unique
    // rendered, and equal whenever nothing is closed.
    const cards = page.locator('.extended-section .day-card');
    for (let i = 0; i < await cards.count(); i++) {
      const card = cards.nth(i);
      const footer = await card.locator('.day-card__count').textContent();
      if (!footer) continue;
      const stated = parseInt(footer, 10);
      const names = (await card.locator('.venue-card__link').allTextContents()).map((s) => s.trim());
      const closed = await card.locator('.venue-card--excluded').count();
      const unique = new Set(names).size;
      expect(stated).toBeLessThanOrEqual(unique);
      if (closed === 0) expect(stated).toBe(unique);
    }
  });

});
