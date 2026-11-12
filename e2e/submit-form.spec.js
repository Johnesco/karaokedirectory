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

/** Fill the three required things: name, address, one karaoke night. */
async function fillRequired(page, { street = '123 Main Street', frequency = 'every', day = 'Friday' } = {}) {
  await page.locator('#venue-name').fill('Test Theater');
  await page.locator('#street').fill(street);
  await page.locator('#zip').fill('78702');
  await page.locator('[name="frequency-0"]').selectOption(frequency);
  await page.locator('[name="day-0"]').selectOption(day);
}

/**
 * Submit and return what the visitor would send: the email text, and the venue
 * JSON parsed back out of it. The form posts nowhere, so the composed email is
 * the whole output.
 */
async function submitAndRead(page) {
  await page.locator('#submit-btn').click();
  const textarea = page.locator('.copy-fallback__text');
  await expect(textarea).toBeAttached();
  const body = await textarea.inputValue();
  const rule = '-'.repeat(40);
  const venue = JSON.parse(body.split(rule)[1]);
  return { body, venue };
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

  // ---- #388: what a real submission got wrong ----

  test('a clean submission tidies the street and points the TODO at the curator', async ({ page }) => {
    await fillRequired(page, { street: '1700  e 2nd st' });

    const { body, venue } = await submitAndRead(page);

    expect(venue.address.street).toBe('1700 E 2nd St');
    expect(body).toContain('VENUE JSON (copy/paste ready):');
    expect(body).toContain('Enter it in the curator: Input → Email');
    // The old TODO told the reader to hand-edit the data file (ADR-018 forbids it)
    expect(body).not.toContain('Add to data.json');
    expect(body).not.toContain('Add coordinates');
  });

  test('street tidy leaves names and existing capitals alone', async ({ page }) => {
    await fillRequired(page, { street: '4715 st elmo RD, suite 4' });

    const { venue } = await submitAndRead(page);

    // Only a lower-case suffix is touched: "st" here is a name (St. Elmo),
    // and "RD" was typed with capitals.
    expect(venue.address.street).toBe('4715 st elmo RD, suite 4');
  });

  test('a social link to the wrong site is hinted, kept out of the JSON, and flagged in the email', async ({ page }) => {
    await fillRequired(page);
    await openMoreDetails(page);

    const instagram = page.locator('#venue-instagram');
    await instagram.fill('https://example.com/events/2026-11-28-big-show');
    await instagram.blur();
    await expect(page.locator('.field-flag')).toContainText('Instagram link');

    await page.locator('#venue-facebook').fill('facebook.com/testtheater');
    await page.locator('#venue-website').fill('https://example.com');

    const { body, venue } = await submitAndRead(page);

    // Not blocked: the email exists. The bad link is reported, not published.
    expect(venue.socials.instagram).toBeUndefined();
    expect(venue.socials.facebook).toBe('https://facebook.com/testtheater');
    expect(venue.socials.website).toBe('https://example.com');
    expect(body).toContain('SOCIAL LINKS:');
    expect(body).toContain('instagram field: https://example.com/events/2026-11-28-big-show');
    expect(body).toContain('VENUE JSON (NOT ready as-is: see SOCIAL LINKS above):');
  });

  test('the hint clears once the social link is fixed', async ({ page }) => {
    await openMoreDetails(page);
    const instagram = page.locator('#venue-instagram');

    await instagram.fill('@testtheater');
    await instagram.blur();
    await expect(page.locator('.field-flag')).toBeVisible();

    await instagram.fill('https://www.instagram.com/testtheater/');
    await instagram.blur();
    await expect(page.locator('.field-flag')).toHaveCount(0);
  });

  test('a recurring show can carry its name and next date into the email', async ({ page }) => {
    await fillRequired(page, { frequency: 'fourth', day: 'Saturday' });

    // The name field is offered on recurring shows too, not just one-time events
    const showName = page.locator('[name="eventName-0"]');
    await expect(showName).toBeVisible();
    await showName.fill('The Big Variety Hour');

    const nextDate = page.locator('[name="nextDate-0"]');
    await expect(nextDate).toBeVisible();
    await nextDate.fill('2026-11-28');   // the fourth Saturday of November 2026

    const { body, venue } = await submitAndRead(page);

    expect(body).toContain('Show name: The Big Variety Hour');
    expect(body).toContain('Next date: 2026-11-28 (fits "Fourth Saturday")');
    // Email-only: neither is venue data
    expect(venue.schedule[0].eventName).toBeUndefined();
    expect(venue.schedule[0].nextDate).toBeUndefined();
    expect(venue.schedule[0]).toMatchObject({ frequency: 'fourth', day: 'Saturday' });
  });

  test('a next date that does not fit the pattern is called out', async ({ page }) => {
    await fillRequired(page, { frequency: 'fourth', day: 'Saturday' });
    await page.locator('[name="nextDate-0"]').fill('2026-11-21');   // the third Saturday

    const { body } = await submitAndRead(page);

    expect(body).toContain('Next date: 2026-11-21. That is NOT a "Fourth Saturday"');
  });

  test('a weekly show is not asked for a next date; a one-time event keeps its name in the JSON', async ({ page }) => {
    await expect(page.locator('[name="nextDate-0"]')).toBeHidden();

    await fillRequired(page);
    await page.locator('[name="frequency-0"]').selectOption('once');
    await expect(page.locator('[name="nextDate-0"]')).toBeHidden();
    await page.locator('[name="date-0"]').fill('2026-12-31');
    await page.locator('[name="eventName-0"]').fill('New Year Bash');

    const { venue } = await submitAndRead(page);

    expect(venue.schedule[0]).toMatchObject({ frequency: 'once', date: '2026-12-31', eventName: 'New Year Bash' });
  });

  test('a dated event link on a recurring show is hinted and flagged', async ({ page }) => {
    await fillRequired(page);
    const eventUrl = page.locator('[name="eventUrl-0"]');
    await eventUrl.fill('https://example.com/shows/karaoke-2026-11-28');
    await eventUrl.blur();
    await expect(page.locator('.schedule-entry .field-flag')).toContainText('single date');

    const { body, venue } = await submitAndRead(page);

    expect(body).toContain('Event link looks dated: https://example.com/shows/karaoke-2026-11-28');
    // Flagged, not removed: the curator decides
    expect(venue.schedule[0].eventUrl).toBe('https://example.com/shows/karaoke-2026-11-28');
  });

  test('a KJ is asked whether they are the host named, and the answers reach the email', async ({ page }) => {
    await fillRequired(page);
    await expect(page.locator('#host-self-row')).toBeHidden();

    await page.locator('input[name="karaoke-scope"][value="part"]').check();
    await page.locator('input[name="submitter-type"][value="kj"]').check();
    await expect(page.locator('#host-self-row')).toBeVisible();

    await page.locator('#host-name').fill('KJ Brand New Name');
    await page.locator('input[name="host-self"][value="yes"]').check();
    await page.locator('#submitter-name').fill('Pat Example');
    await page.locator('input[name="contact-email-check"]').check();
    await page.locator('input[name="contact-email"]').fill('pat@example.com');

    const { body, venue } = await submitAndRead(page);

    expect(body).toContain('Submitter is the KJ named below: Yes ("KJ Brand New Name")');
    expect(body).toContain('Karaoke is PART OF A BIGGER SHOW');
    // A host the registries don't know stops the JSON being ready as it stands
    expect(body).toContain('VENUE JSON (NOT ready as-is: see HOST above):');
    expect(JSON.stringify(venue)).not.toContain('PART OF');
  });

});
