// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Day-card sections (ADR-017, #324): every day card groups its shows as
 * specials (no heading) → New → Featured → Verified → the rest (no heading),
 * each show in exactly one section, empty sections not rendered.
 *
 * Which shows are new, featured or confirmed changes with the data, so the
 * fixture is shaped in flight, as in announced-badge.spec.js: the served
 * data.json is fetched, four of today's shows are stamped, and the page is
 * fulfilled with that. Every other show is first stripped of the three signals
 * so the expected placement is exact.
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDER = ['special', 'new', 'featured', 'verified', 'rest'];

function isoOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Strip the section signals everywhere, then stamp one show per section on today's card. */
function shape(data) {
  const today = new Date();
  const iso = isoOf(today);
  const weekday = WEEKDAYS[today.getDay()];
  const old = isoOf(new Date(today.getFullYear() - 1, today.getMonth(), 1));

  for (const v of data.listings) {
    delete v.created;
    // A venue opened in the last 30 days would make all its shows New.
    if (v.activePeriod?.start) v.activePeriod.start = v.activePeriod.start < old ? v.activePeriod.start : old;
    for (const e of v.schedule || []) {
      delete e.created; delete e.lastVerified; delete e.featured;
      // Same for a show whose first night is recent; push it back a year.
      if (e.activePeriod?.start && e.activePeriod.start > old) e.activePeriod.start = old;
    }
  }

  // Four different venues, each with a plain weekly show tonight.
  const picks = [];
  for (const v of data.listings) {
    if (v.active === false || picks.length === 4) continue;
    if (v.activePeriod && ((v.activePeriod.end && v.activePeriod.end < iso))) continue;
    const idx = (v.schedule || []).findIndex(e => e.frequency === 'every' && e.day === weekday
      && !(e.activePeriod?.end && e.activePeriod.end < iso)
      && !(e.exclusions || []).some(x => x.date === iso));
    if (idx !== -1) picks.push({ venue: v, entry: v.schedule[idx] });
  }
  if (picks.length < 4) return null;

  const [isNew, isFeatured, isVerified, special] = picks;
  isNew.entry.created = iso;
  isFeatured.entry.featured = true;
  isVerified.entry.lastVerified = iso;
  special.venue.schedule.push({ frequency: 'once', date: iso, startTime: '20:00', endTime: '23:00', eventName: 'Sections test special' });

  return {
    new: isNew.venue.id,
    featured: isFeatured.venue.id,
    verified: isVerified.venue.id,
    special: special.venue.id,
    verifiedName: isVerified.venue.name,
  };
}

async function load(page) {
  let picked = null;
  await page.route('**/js/data.json', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    picked = shape(data);
    await route.fulfill({ response, json: data });
  });
  await page.goto('/');
  await expect(page.locator('.day-card--today')).toBeVisible({ timeout: 15000 });
  return picked;
}

test.describe('Day-card sections (ADR-017, #324)', () => {

  test('today\'s card renders the sections in order, each show in the right one', async ({ page }) => {
    const picked = await load(page);
    test.skip(!picked, 'fewer than four venues have a weekly show today');
    const card = page.locator('.day-card--today');

    const keys = await card.locator('.day-card__section').evaluateAll(els => els.map(e => e.dataset.section));
    expect(keys).toEqual(ORDER);   // all five present, in order

    for (const key of ['special', 'new', 'featured', 'verified']) {
      await expect(card.locator(`.day-card__section--${key} .venue-card[data-venue-id="${picked[key]}"]`).first()).toBeVisible();
    }

    // Headings: the three named sections only, in their own words.
    await expect(card.locator('.day-card__section-title')).toHaveText(['New', 'Featured', 'Verified']);
    await expect(card.locator('.day-card__section--special .day-card__section-title')).toHaveCount(0);
    await expect(card.locator('.day-card__section--rest .day-card__section-title')).toHaveCount(0);
  });

  test('a show sits in exactly one section', async ({ page }) => {
    const picked = await load(page);
    test.skip(!picked, 'fewer than four venues have a weekly show today');
    const card = page.locator('.day-card--today');
    // The New venue's only show tonight appears once, in New, and nowhere else.
    await expect(card.locator(`.venue-card[data-venue-id="${picked.new}"]`)).toHaveCount(1);
    await expect(card.locator(`.day-card__section--new .venue-card[data-venue-id="${picked.new}"]`)).toHaveCount(1);
  });

  test('a section with nothing in it is not rendered', async ({ page }) => {
    const picked = await load(page);
    test.skip(!picked, 'fewer than four venues have a weekly show today');
    // Search for the Verified venue only: New and Featured empty out and go.
    await page.locator('[data-search="query"]').fill(picked.verifiedName);
    const card = page.locator('.day-card--today');
    await expect(card.locator(`.day-card__section--verified .venue-card[data-venue-id="${picked.verified}"]`)).toHaveCount(1);
    await expect(card.locator('.day-card__section--new')).toHaveCount(0);
    await expect(card.locator('.day-card__section--featured')).toHaveCount(0);
  });

  test('the footer counts unique venues across all sections', async ({ page }) => {
    const picked = await load(page);
    test.skip(!picked, 'fewer than four venues have a weekly show today');
    const card = page.locator('.day-card--today');
    const stated = parseInt(await card.locator('.day-card__count').textContent() || '0', 10);
    const ids = await card.locator('.day-card__section .venue-card').evaluateAll(els => els.map(e => e.dataset.venueId));
    const closed = await card.locator('.venue-card--excluded').count();
    if (closed === 0) expect(stated).toBe(new Set(ids).size);
    else expect(stated).toBeLessThanOrEqual(new Set(ids).size);
  });
});
