// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Helper: click the venue name button (not the whole card) to reliably trigger
 * the modal/detail-pane. Clicking the whole .venue-card can land on the address
 * <a> tag, which the WeeklyView click handler intentionally ignores.
 */
async function openFirstVenue(page) {
  const venueLink = page.locator('.day-card:not(.day-card--past) .venue-card__link').first();
  await expect(venueLink).toBeVisible({ timeout: 15000 });
  await venueLink.click();
}

test.describe('Venue detail — modal & detail pane', () => {

  test.describe('Mobile modal (375x812)', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    // The .venue-modal--open wrapper has zero height because its children are
    // position:fixed. Check .venue-modal__content for visibility instead.
    const modalContent = '.venue-modal__content';

    test('clicking venue opens modal', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });

      await openFirstVenue(page);

      await expect(page.locator(modalContent)).toBeVisible({ timeout: 5000 });
    });

    test('modal shows title', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });

      await openFirstVenue(page);
      await expect(page.locator(modalContent)).toBeVisible({ timeout: 5000 });

      const title = page.locator('.venue-modal__title');
      await expect(title).toBeVisible();
      const titleText = await title.textContent();
      expect(titleText.length).toBeGreaterThan(0);
    });

    test('modal shows address and schedule sections', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });

      await openFirstVenue(page);
      await expect(page.locator(modalContent)).toBeVisible({ timeout: 5000 });

      await expect(page.locator('.venue-modal__address')).toBeVisible();
      // At least 2 sections: Location and Schedule
      expect(await page.locator('.venue-modal__section').count()).toBeGreaterThanOrEqual(2);
    });

    test('close modal via close button', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });

      await openFirstVenue(page);
      await expect(page.locator(modalContent)).toBeVisible({ timeout: 5000 });

      await page.locator('.venue-modal__close').click();
      await expect(page.locator(modalContent)).not.toBeVisible();
    });

    test('close modal via backdrop click', async ({ page }) => {
      // Use a wider mobile viewport so backdrop is visible around the content
      await page.setViewportSize({ width: 600, height: 800 });
      await page.goto('/');
      await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });

      await openFirstVenue(page);
      await expect(page.locator(modalContent)).toBeVisible({ timeout: 5000 });

      // Click the backdrop area outside the centered modal content
      await page.locator('.venue-modal__backdrop').click({ position: { x: 10, y: 10 }, force: true });
      await expect(page.locator(modalContent)).not.toBeVisible();
    });

    test('close modal via Escape key', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });

      await openFirstVenue(page);
      await expect(page.locator(modalContent)).toBeVisible({ timeout: 5000 });

      await page.keyboard.press('Escape');
      await expect(page.locator(modalContent)).not.toBeVisible();
    });
  });

  test.describe('Desktop detail pane (1400x900)', () => {
    test.use({ viewport: { width: 1400, height: 900 } });

    test('clicking venue populates detail pane', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });

      const detailPane = page.locator('#venue-detail-pane');

      await openFirstVenue(page);

      // Detail pane should have content
      await expect(detailPane).not.toBeEmpty();
      const paneText = await detailPane.textContent();
      expect(paneText.length).toBeGreaterThan(0);
    });

    test('venue card gets selected class when clicked', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });

      await openFirstVenue(page);

      // The selected card may be inside a collapsed past-day card (not visible),
      // so check that the class was applied via count rather than visibility
      const selectedCards = page.locator('.venue-card--selected');
      await expect(selectedCards).not.toHaveCount(0, { timeout: 5000 });
    });
  });

});
