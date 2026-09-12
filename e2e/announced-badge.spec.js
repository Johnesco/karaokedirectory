// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * The Announced marker (ADR-015, #275): a calendar card for the night a show
 * was confirmed for carries a "📣 Announced" line — the one public,
 * per-occurrence signal besides the special-event star.
 *
 * `lastVerified` IS that night, so the marker is a date match and the tests
 * cover both directions of it: a night that is today, and a night still ahead.
 *
 * Which venues are confirmed for which nights changes with the data, so it is
 * shaped in flight: the served data.json is fetched, one recurring show is
 * stamped, and the page is fulfilled with that. The baseline test computes
 * what the REAL data implies rather than asserting a hard zero — the day a
 * real confirmation lands on the run date, zero would be wrong.
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The entries the real data would mark Announced today (ADR-015: a date match). */
function announcedToday(data, iso) {
  const out = [];
  for (const v of data.listings) {
    if (v.active === false) continue;
    for (const e of v.schedule || []) {
      if (e.lastVerified === iso) out.push(v.id);
    }
  }
  return out;
}

/** First active venue with an `every` show on today's weekday and no exclusion today. */
function pickCandidate(data, iso) {
  const weekday = WEEKDAYS[new Date().getDay()];
  for (const v of data.listings) {
    if (v.active === false) continue;
    const idx = (v.schedule || []).findIndex(e => e.frequency === 'every' && e.day === weekday
      && !(e.exclusions || []).some(x => x.date === iso));
    if (idx !== -1) return { venueId: v.id, idx };
  }
  return null;
}

test.describe('Announced marker (ADR-015, #275)', () => {

  test('the real data renders exactly the markers it implies (none today, most days)', async ({ page }) => {
    const data = await (await page.request.get('/js/data.json')).json();
    const expected = announcedToday(data, todayLocalISO());

    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });
    expect(await page.locator('.day-card--today .venue-card__announced').count()).toBe(expected.length);
  });

  test('a show announced for today gets the marker on today\'s card only', async ({ page }) => {
    const iso = todayLocalISO();
    let picked = null;

    await page.route('**/js/data.json', async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      picked = pickCandidate(data, iso);
      if (picked) {
        const entry = data.listings.find(v => v.id === picked.venueId).schedule[picked.idx];
        entry.lastVerified = iso;
      }
      await route.fulfill({ response, json: data });
    });

    await page.goto('/?fresh=1');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });
    test.skip(!picked, 'no active venue has an every-week show on today\'s weekday');

    const card = page.locator(`.day-card--today .venue-card[data-venue-id="${picked.venueId}"]`);
    await expect(card).toHaveCount(1);
    await expect(card.locator('.venue-card__announced')).toHaveCount(1);
    await expect(card.locator('.venue-card__announced')).toContainText('Announced');

    // The marker is per occurrence: the same venue's other weekday cards stay plain.
    const others = page.locator(`.day-card:not(.day-card--today) .venue-card[data-venue-id="${picked.venueId}"] .venue-card__announced`);
    await expect(others).toHaveCount(0);

    // And the lens says the night is now, not that it is coming.
    await expect(card.locator('.venue-card__verified')).toContainText('Verified today');
  });

  test('a show confirmed for a later night this week is marked on that card only', async ({ page }) => {
    // The forward half of the same rule: a poster read today can name next
    // week's night, and only that night's card carries the marker.
    let picked = null;
    let targetIso = null;

    await page.route('**/js/data.json', async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      const today = new Date();
      // A weekday still ahead of us inside the rendered week.
      for (let ahead = 1; ahead <= 6 && !picked; ahead += 1) {
        const d = new Date(today);
        d.setDate(d.getDate() + ahead);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const weekday = WEEKDAYS[d.getDay()];
        for (const v of data.listings) {
          if (v.active === false) continue;
          const idx = (v.schedule || []).findIndex(e => e.frequency === 'every' && e.day === weekday
            && !(e.exclusions || []).some(x => x.date === iso));
          if (idx !== -1) { picked = { venueId: v.id, idx }; targetIso = iso; break; }
        }
      }
      if (picked) data.listings.find(v => v.id === picked.venueId).schedule[picked.idx].lastVerified = targetIso;
      await route.fulfill({ response, json: data });
    });

    await page.goto('/?fresh=1');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });
    test.skip(!picked, 'no active venue has an every-week show later this week');

    const markers = page.locator(`.venue-card[data-venue-id="${picked.venueId}"] .venue-card__announced`);
    await expect(markers).toHaveCount(1);
    // Today's card for the same venue, if any, stays plain.
    await expect(page.locator(`.day-card--today .venue-card[data-venue-id="${picked.venueId}"] .venue-card__announced`)).toHaveCount(0);
    // The lens reads forwards ahead of the night.
    await expect(page.locator(`.venue-card[data-venue-id="${picked.venueId}"] .venue-card__verified`).first())
      .toContainText('Announced for');
  });

});
