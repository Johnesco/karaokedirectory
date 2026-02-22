// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Venue submission form', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/submit.html');
    await expect(page.locator('.submit-form')).toBeVisible({ timeout: 10000 });
  });

  test('new venue form is shown by default', async ({ page }) => {
    const newMode = page.locator('#new-mode');
    await expect(newMode).toHaveClass(/active/);

    const reportMode = page.locator('#report-mode');
    await expect(reportMode).not.toHaveClass(/active/);
  });

  test('tab switching — New Venue to Report Issue', async ({ page }) => {
    // Click report issue tab
    const reportTab = page.locator('.submission-tab').filter({ hasText: 'Report' });
    await reportTab.click();

    await expect(page.locator('#report-mode')).toHaveClass(/active/);
    await expect(page.locator('#new-mode')).not.toHaveClass(/active/);

    // Switch back
    const newTab = page.locator('.submission-tab').filter({ hasText: 'New' });
    await newTab.click();

    await expect(page.locator('#new-mode')).toHaveClass(/active/);
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
    // Should start with 1 schedule entry
    const entries = page.locator('.schedule-entry');
    const initialCount = await entries.count();

    // Click add button
    const addBtn = page.getByText('Add Another Day');
    await addBtn.click();

    // Should have one more entry
    await expect(entries).toHaveCount(initialCount + 1);
  });

  test('remove schedule entry', async ({ page }) => {
    // Add a second entry first
    await page.getByText('Add Another Day').click();
    const entries = page.locator('.schedule-entry');
    await expect(entries).toHaveCount(2);

    // Remove the last one
    const removeBtn = entries.last().locator('button', { hasText: 'Remove' });
    await removeBtn.click();

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
    const emailCheck = page.locator('input[name="contact-email-check"]');
    await emailCheck.check();

    // Email input should become visible
    const emailInput = page.locator('input[name="contact-email"]');
    await expect(emailInput).toBeVisible();
  });

  test('tag checkboxes can be selected', async ({ page }) => {
    const tagGrid = page.locator('.tag-checkbox-grid');
    await expect(tagGrid).toBeVisible();

    // Check a tag
    const lgbtqTag = page.locator('input[value="lgbtq"]');
    await lgbtqTag.check();
    await expect(lgbtqTag).toBeChecked();
  });

  test('age restriction radios are mutually exclusive', async ({ page }) => {
    const radio21 = page.locator('input[name="age-restriction"][value="21+"]');
    const radioAll = page.locator('input[name="age-restriction"][value="all-ages"]');

    await radio21.check();
    await expect(radio21).toBeChecked();

    await radioAll.check();
    await expect(radioAll).toBeChecked();
    await expect(radio21).not.toBeChecked();
  });

  test('report form has required venue name and issue checkboxes', async ({ page }) => {
    // Switch to report tab
    const reportTab = page.locator('.submission-tab').filter({ hasText: 'Report' });
    await reportTab.click();
    await expect(page.locator('#report-mode')).toHaveClass(/active/);

    await expect(page.locator('#report-venue-name')).toBeVisible();
    await expect(page.locator('.quick-report-options')).toBeVisible();
  });

  test('report issue checkboxes toggle selected state', async ({ page }) => {
    const reportTab = page.locator('.submission-tab').filter({ hasText: 'Report' });
    await reportTab.click();

    const option = page.locator('.quick-report-option').first();
    const checkbox = option.locator('input[type="checkbox"]');

    await option.click();
    await expect(checkbox).toBeChecked();
  });

});
