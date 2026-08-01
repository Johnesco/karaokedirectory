// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * The New Venue / Report Issue tab UI these specs were written against was
 * removed by the mobile-first redesign — `#new-mode`, `#report-mode`,
 * `.submission-tab`, `#report-venue-name` and `.quick-report-options` no longer
 * appear anywhere in submit.html. The four tests covering it are gone.
 *
 * The form is now a single flow with optional fields behind a
 * `<details class="more-details">` disclosure, so anything below "Add more
 * details" has to be expanded before it can be interacted with.
 */

/** Expand the optional-fields disclosure. Tags, age, and contact live inside it. */
async function openMoreDetails(page) {
  const details = page.locator('details.more-details');
  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open', '');
}

test.describe('Venue submission form', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/submit.html');
    await expect(page.locator('.submit-form')).toBeVisible({ timeout: 10000 });
  });

  test('required fields are present', async ({ page }) => {
    await expect(page.locator('#venue-name')).toBeVisible();
    await expect(page.locator('#street')).toBeVisible();
    await expect(page.locator('#city')).toBeVisible();
  });

  test('city defaults to Austin', async ({ page }) => {
    await expect(page.locator('#city')).toHaveValue('Austin');
  });

  test('state defaults to TX', async ({ page }) => {
    await expect(page.locator('#state')).toHaveValue('TX');
  });

  test('schedule entry is present with default times', async ({ page }) => {
    const startTime = page.locator('[name="startTime-0"]');
    const endTime = page.locator('[name="endTime-0"]');

    await expect(startTime).toHaveValue('21:00');
    await expect(endTime).toHaveValue('01:00');
  });

  test('add another schedule entry', async ({ page }) => {
    const entries = page.locator('.schedule-entry');
    const initialCount = await entries.count();

    await page.locator('.add-schedule-btn').click();

    await expect(entries).toHaveCount(initialCount + 1);
  });

  test('remove schedule entry', async ({ page }) => {
    const entries = page.locator('.schedule-entry');
    await page.locator('.add-schedule-btn').click();
    await expect(entries).toHaveCount(2);

    // Only added entries carry a remove button — the first one cannot be removed
    await entries.last().locator('.remove-schedule-btn').click();

    await expect(entries).toHaveCount(1);
  });

  test('frequency "once" shows date field instead of day', async ({ page }) => {
    const frequencySelect = page.locator('[name="frequency-0"]');

    // Default: day selector should be visible, date should be hidden
    await expect(page.locator('[name="day-0"]')).toBeVisible();

    // Switch to "once"
    await frequencySelect.selectOption('once');

    // Date input should now be visible
    await expect(page.locator('[name="date-0"]')).toBeVisible();
  });

  test('submitter type toggle shows KJ-specific fields', async ({ page }) => {
    // Select KJ radio
    const kjRadio = page.locator('input[name="submitter-type"][value="kj"]');
    await kjRadio.check();

    // Name should now be required
    const nameRequired = page.locator('#name-required');
    await expect(nameRequired).toBeVisible();

    // Contact required indicator should appear
    const contactRequired = page.locator('#contact-required');
    await expect(contactRequired).toBeVisible();
  });

  test('contact method checkbox reveals input', async ({ page }) => {
    await openMoreDetails(page);

    await page.locator('input[name="contact-email-check"]').check();

    await expect(page.locator('input[name="contact-email"]')).toBeVisible();
  });

  test('tag checkboxes can be selected', async ({ page }) => {
    await openMoreDetails(page);

    const tagGrid = page.locator('#tag-checkbox-grid');
    await expect(tagGrid).toBeVisible();
    // Grid is built from data.json's tagDefinitions at load, so wait for a row
    await expect(tagGrid.locator('input[type="checkbox"]').first()).toBeAttached();

    const lgbtqTag = page.locator('#tag-checkbox-grid input[value="lgbtq"]');
    await lgbtqTag.check();
    await expect(lgbtqTag).toBeChecked();
  });

  test('age restriction radios are mutually exclusive', async ({ page }) => {
    await openMoreDetails(page);

    const radio21 = page.locator('input[name="age-restriction"][value="21+"]');
    const radioAll = page.locator('input[name="age-restriction"][value="all-ages"]');

    await radio21.check();
    await expect(radio21).toBeChecked();

    await radioAll.check();
    await expect(radioAll).toBeChecked();
    await expect(radio21).not.toBeChecked();
  });

  test('optional fields stay collapsed until the disclosure is opened', async ({ page }) => {
    const details = page.locator('details.more-details');
    await expect(details).not.toHaveAttribute('open', '');
    await expect(page.locator('#tag-checkbox-grid')).not.toBeVisible();

    await openMoreDetails(page);

    await expect(page.locator('#tag-checkbox-grid')).toBeVisible();
  });

});
