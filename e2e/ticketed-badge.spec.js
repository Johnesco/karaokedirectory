// @ts-check
/**
 * The Ticketed badge (#390).
 *
 * A show whose schedule entry has `ticketed: true` carries a derived "Ticketed"
 * badge in its calendar card's tag row, and its event link reads as tickets.
 * The flag is patched into the fetched data, so the test does not depend on
 * any real show being ticketed.
 */
const { test, expect } = require('@playwright/test');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** A venue with exactly one plain every-week show on today's weekday. */
function pickCandidate(data) {
  const today = DAYS[new Date().getDay()];
  for (const venue of data.listings) {
    if (venue.active === false || venue.activePeriod) continue;
    const todays = venue.schedule.filter(s => s.day === today || s.frequency === 'once');
    if (todays.length !== 1) continue;
    const entry = todays[0];
    if (entry.frequency !== 'every' || entry.activePeriod || entry.exclusions) continue;
    return { venueId: venue.id, idx: venue.schedule.indexOf(entry) };
  }
  return null;
}

test.describe('Ticketed badge', () => {
  test('a ticketed show carries the badge and a Tickets link; an unflagged one does not', async ({ page }) => {
    let picked = null;

    await page.route('**/js/data.json', async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      picked = pickCandidate(data);
      if (picked) {
        const entry = data.listings.find(v => v.id === picked.venueId).schedule[picked.idx];
        entry.ticketed = true;
        entry.eventUrl = 'https://example.com/tickets';
      }
      await route.fulfill({ response, json: data });
    });

    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });
    test.skip(!picked, 'no venue has a single plain every-week show on today\'s weekday');

    const card = page.locator(`.day-card--today .venue-card[data-venue-id="${picked.venueId}"]`);
    await expect(card).toHaveCount(1);
    const badge = card.locator('.tag[data-tag="ticketed"]');
    await expect(badge).toHaveCount(1);
    await expect(badge).toHaveText('Ticketed');

    const link = card.locator('.venue-card__event-link');
    await expect(link).toHaveAttribute('title', 'Tickets');
    await expect(link.locator('.fa-ticket')).toHaveCount(1);

    // Derived from that one show: no other venue's card carries it. (The
    // same show legitimately repeats under Next Week, so count by venue.)
    await expect(page.locator(`.venue-card:not([data-venue-id="${picked.venueId}"]) .tag[data-tag="ticketed"]`)).toHaveCount(0);
  });

  test('nothing is ticketed unless the data says so', async ({ page }) => {
    await page.route('**/js/data.json', async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      for (const venue of data.listings) for (const entry of venue.schedule) delete entry.ticketed;
      await route.fulfill({ response, json: data });
    });

    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.tag[data-tag="ticketed"]')).toHaveCount(0);
    await expect(page.locator('[title="Tickets"]')).toHaveCount(0);
  });
});
