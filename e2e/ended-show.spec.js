// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Ended shows (#373, #378): a recurring show whose last night has arrived
 * (activePeriod.end today or earlier, and no entry starting the day after) is
 * labelled, and the nights after a last night always are. Every
 * calendar card for it carries one diagonal "Ended" banner — its past nights
 * too — and for 14 days after the last night it keeps appearing, bannered, on
 * the nights it would have run.
 *
 * Three venues are added in flight, each with a show on today's weekday:
 *   - ENDED: last night a week ago, so tonight is a grace night
 *   - SPLIT: the old half of a Split ended a week ago and the new half started
 *     the next day — a change, not an ending, so no banner anywhere
 *   - LONG: last night three weeks ago, past the grace, so not listed tonight
 *   - FUTURE (#378): last night a week ahead — reads normally on its own
 *     nights, and "Ended" on the nights after it already
 *   - TODAY_END (#378): last night is tonight — it has arrived, so bannered
 */

const ENDED = 'zz-ended-e2e';
const SPLIT = 'zz-split-e2e';
const LONG = 'zz-long-ended-e2e';
const FUTURE = 'zz-future-end-e2e';
const TODAY_END = 'zz-ends-today-e2e';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayOffset(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const todayName = WEEKDAYS[dayOffset(0).getDay()];

async function serveWithEndedVenues(page) {
  await page.route('**/js/data.json', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const city = Object.values(data.cities)[0].name;
    const address = { street: '1 Test St', city, state: 'TX', zip: '78701' };
    const weekly = (over) => ({ frequency: 'every', day: todayName, startTime: '19:00', endTime: '23:00', ...over });
    data.listings.push(
      { id: ENDED, name: 'Aaa Ended Test Bar', address,
        schedule: [weekly({ activePeriod: { end: localISO(dayOffset(-7)) } })] },
      { id: SPLIT, name: 'Aaa Split Test Bar', address,
        schedule: [
          weekly({ activePeriod: { end: localISO(dayOffset(-7)) } }),
          weekly({ startTime: '20:00', activePeriod: { start: localISO(dayOffset(-6)) } }),
        ] },
      { id: LONG, name: 'Aaa Long Ended Test Bar', address,
        schedule: [weekly({ activePeriod: { end: localISO(dayOffset(-21)) } })] },
      { id: FUTURE, name: 'Aaa Future End Test Bar', address,
        schedule: [weekly({ activePeriod: { end: localISO(dayOffset(7)) } })] },
      { id: TODAY_END, name: 'Aaa Ends Today Test Bar', address,
        schedule: [weekly({ activePeriod: { end: localISO(dayOffset(0)) } })] },
    );
    await route.fulfill({ response, json: data });
  });
}

// The week itself, not the extended sections below it (see show-lifespan.spec.js).
const card = (scope, id) => `.weekly-view > .weekly-view__grid ${scope} .venue-card[data-venue-id="${id}"]`;

test.describe('Ended shows (#373, #378)', () => {

  test.beforeEach(async ({ page }) => {
    await serveWithEndedVenues(page);
    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });
  });

  test('tonight lists the ended show under a diagonal "Ended" banner, last in the card', async ({ page }) => {
    const tonight = page.locator(card('.day-card--today', ENDED));
    await expect(tonight).toHaveCount(1);
    await expect(tonight).toHaveClass(/venue-card--ended/);
    const banner = tonight.locator('.venue-card__ended-banner');
    await expect(banner).toHaveText('Ended');

    // Diagonal: the band is rotated, not a flat strip.
    const transform = await banner.evaluate(el => getComputedStyle(el).transform);
    expect(transform).not.toBe('none');

    // Its own section, after every other show that night.
    const lastSection = page.locator('.weekly-view > .weekly-view__grid .day-card--today .day-card__section').last();
    await expect(lastSection).toHaveAttribute('data-section', 'ended');
    await expect(lastSection.locator(`[data-venue-id="${ENDED}"]`)).toHaveCount(1);
  });

  test('its last night, a week back, carries the banner too', async ({ page }) => {
    await page.locator('[data-week="-1"]').click();
    const then = page.locator(card(`.day-card--${todayName.toLowerCase()}`, ENDED));
    await expect(then).toHaveCount(1);
    await expect(then.locator('.venue-card__ended-banner')).toHaveText('Ended');
  });

  test('the old half of a Split is not labelled', async ({ page }) => {
    await expect(page.locator(card('.day-card--today', SPLIT))).toHaveCount(1);
    await expect(page.locator(`${card('.day-card--today', SPLIT)} .venue-card__ended-banner`)).toHaveCount(0);

    await page.locator('[data-week="-1"]').click();
    await expect(page.locator(`${card(`.day-card--${todayName.toLowerCase()}`, SPLIT)} .venue-card__ended-banner`)).toHaveCount(0);
  });

  test('past the 14-day grace, the show is not listed', async ({ page }) => {
    await expect(page.locator(card('.day-card--today', LONG))).toHaveCount(0);
  });

  test('two weeks out it is still listed; three weeks out it is gone', async ({ page }) => {
    await page.locator('[data-week="1"]').click(); // +7: end + 14, the last grace night
    await expect(page.locator(card(`.day-card--${todayName.toLowerCase()}`, ENDED))).toHaveCount(1);
    await page.locator('[data-week="1"]').click(); // +14: end + 21
    await expect(page.locator(card(`.day-card--${todayName.toLowerCase()}`, ENDED))).toHaveCount(0);
  });

  test('a last night still ahead: its own nights read normally, the nights after read Ended (#378)', async ({ page }) => {
    const weekday = `.day-card--${todayName.toLowerCase()}`;
    await expect(page.locator(card('.day-card--today', FUTURE))).toHaveCount(1);
    await expect(page.locator(`${card('.day-card--today', FUTURE)} .venue-card__ended-banner`)).toHaveCount(0);

    await page.locator('[data-week="1"]').click(); // +7: the last night itself
    await expect(page.locator(card(weekday, FUTURE))).toHaveCount(1);
    await expect(page.locator(`${card(weekday, FUTURE)} .venue-card__ended-banner`)).toHaveCount(0);

    await page.locator('[data-week="1"]').click(); // +14: a night after it
    await expect(page.locator(`${card(weekday, FUTURE)} .venue-card__ended-banner`)).toHaveText('Ended');
  });

  test('on its last night the show reads Ended: the day has arrived (#378)', async ({ page }) => {
    await expect(page.locator(`${card('.day-card--today', TODAY_END)} .venue-card__ended-banner`)).toHaveText('Ended');
  });

});
