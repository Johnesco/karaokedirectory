// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Map view — immersive mode & controls', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/?view=map');
    await expect(page.locator('.map-view')).toBeVisible({ timeout: 15000 });
  });

  test('map view enters immersive mode', async ({ page }) => {
    // Body should have view--map class
    await expect(page.locator('body')).toHaveClass(/view--map/);

    // Header and footer should be hidden
    await expect(page.locator('.site-header')).not.toBeVisible();
    await expect(page.locator('.site-footer')).not.toBeVisible();
  });

  test('map container renders', async ({ page }) => {
    const mapContainer = page.locator('.map-view__container');
    await expect(mapContainer).toBeVisible();
  });

  test('floating controls are visible', async ({ page }) => {
    await expect(page.locator('.map-controls')).toBeVisible();
    await expect(page.locator('.map-view-switcher')).toBeVisible();
  });

  test('view switcher has Calendar and A-Z buttons', async ({ page }) => {
    const calendarBtn = page.locator('.map-view-switcher [data-view="weekly"]');
    const alphaBtn = page.locator('.map-view-switcher [data-view="alphabetical"]');

    await expect(calendarBtn).toBeVisible();
    await expect(alphaBtn).toBeVisible();
  });

  test('view switcher — Calendar exits to weekly view', async ({ page }) => {
    await page.locator('.map-view-switcher [data-view="weekly"]').click();

    await expect(page.locator('.weekly-view')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('body')).not.toHaveClass(/view--map/);
  });

  test('view switcher — A-Z exits to alphabetical view', async ({ page }) => {
    await page.locator('.map-view-switcher [data-view="alphabetical"]').click();

    await expect(page.locator('.alphabetical-view')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('body')).not.toHaveClass(/view--map/);
  });

  test('Escape key exits map to weekly view (no card open)', async ({ page }) => {
    // Make sure no venue card is open
    await expect(page.locator('.map-venue-card--visible')).not.toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.locator('.weekly-view')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('body')).not.toHaveClass(/view--map/);
  });

  test('dedicated filter toggle button exists', async ({ page }) => {
    const dedicatedBtn = page.locator('[data-action="toggle-dedicated"]');
    await expect(dedicatedBtn).toBeVisible();
  });

  // Date filter (#215). These assert the control, not the marker set: which
  // venues get plotted is decided by venueHasShowInRange, which the unit suite
  // covers date by date without waiting on the Leaflet CDN.
  test('date filter offers All, This Week and Today', async ({ page }) => {
    const filter = page.locator('.map-date-filter');
    await expect(filter).toBeVisible();

    await expect(filter.locator('[data-date-filter]')).toHaveCount(3);
    await expect(filter.locator('[data-date-filter="all"]')).toHaveText('All');
    await expect(filter.locator('[data-date-filter="week"]')).toHaveText('This Week');
    await expect(filter.locator('[data-date-filter="today"]')).toHaveText('Today');
  });

  test('date filter starts on All', async ({ page }) => {
    const all = page.locator('[data-date-filter="all"]');
    await expect(all).toHaveClass(/map-date-filter__btn--active/);
    await expect(all).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-date-filter="today"]')).toHaveAttribute('aria-pressed', 'false');
  });

  test('clicking a date filter moves the active state', async ({ page }) => {
    await page.locator('[data-date-filter="today"]').click();

    await expect(page.locator('[data-date-filter="today"]')).toHaveClass(/map-date-filter__btn--active/);
    await expect(page.locator('[data-date-filter="all"]')).not.toHaveClass(/map-date-filter__btn--active/);
    await expect(page.locator('[data-date-filter="all"]')).toHaveAttribute('aria-pressed', 'false');

    await page.locator('[data-date-filter="week"]').click();

    await expect(page.locator('[data-date-filter="week"]')).toHaveClass(/map-date-filter__btn--active/);
    await expect(page.locator('[data-date-filter="today"]')).not.toHaveClass(/map-date-filter__btn--active/);
  });

  test('date filter does not tear the map down', async ({ page }) => {
    // The dedicated toggle stopped re-rendering in #157 because a re-render
    // rebuilds the Leaflet instance from scratch. The date filter follows the
    // same contract: patch the buttons, repaint the markers, keep the map.
    const mapContainer = page.locator('.map-view__container');
    await expect(mapContainer).toBeVisible();

    await page.locator('[data-date-filter="today"]').click();
    await page.locator('[data-date-filter="all"]').click();

    await expect(mapContainer).toBeVisible();
    await expect(page.locator('.map-view')).toHaveCount(1);
  });

  test('date filter and dedicated toggle are independent', async ({ page }) => {
    await page.locator('[data-date-filter="today"]').click();
    await page.locator('[data-action="toggle-dedicated"]').click();

    // Toggling one must not reset the other — they compose in updateMarkers().
    await expect(page.locator('[data-date-filter="today"]')).toHaveClass(/map-date-filter__btn--active/);
    await expect(page.locator('[data-action="toggle-dedicated"]')).toHaveText('Show Dedicated');
  });

});
