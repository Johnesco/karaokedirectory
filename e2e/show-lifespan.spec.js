// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * A show's lifespan (ADR-016, #288): a schedule entry may carry its own
 * `activePeriod`, and a change is an end plus a start. The calendar answers
 * for each date; surfaces with no date of their own answer for today, so the
 * switch just happens — nothing announces it.
 *
 * No real venue carries a lifespan yet, so one is added in flight: a venue
 * whose show moved from 8 PM to 9 PM today (the old entry ended yesterday),
 * plus a third show that starts fifteen days out. Times are distinct on
 * purpose, so each assertion can tell the three apart by text alone.
 */

const VENUE_ID = 'zz-lifespan-e2e';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const OLD = '8:00 PM - 10:00 PM';
const NEW = '9:00 PM - 11:30 PM';
const LATER = '6:30 PM - 8:30 PM';

function dayOffset(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Weeks between the calendar week holding today and the one holding `d`. */
function weeksAhead(d) {
  const sunday = (x) => { const s = new Date(x); s.setDate(s.getDate() - s.getDay()); return s; };
  return Math.round((sunday(d) - sunday(dayOffset(0))) / (7 * 86400000));
}

const today = dayOffset(0);
const laterStart = dayOffset(15);
const todayName = WEEKDAYS[today.getDay()];
const laterName = WEEKDAYS[laterStart.getDay()];

async function serveWithLifespanVenue(page) {
  await page.route('**/js/data.json', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const city = Object.values(data.cities)[0].name;
    data.listings.push({
      id: VENUE_ID,
      name: 'Lifespan Test Bar',
      address: { street: '1 Test St', city, state: 'TX', zip: '78701' },
      schedule: [
        { frequency: 'every', day: todayName, startTime: '20:00', endTime: '22:00', activePeriod: { end: localISO(dayOffset(-1)) } },
        { frequency: 'every', day: todayName, startTime: '21:00', endTime: '23:30', activePeriod: { start: localISO(today) } },
        { frequency: 'every', day: laterName, startTime: '18:30', endTime: '20:30', activePeriod: { start: localISO(laterStart) } },
      ],
    });
    await route.fulfill({ response, json: data });
  });
}

// The week itself, not the extended sections below it — those reuse
// `.weekly-view__grid` for their own day cards (Next Week holds this week's
// weekday names again), so the grid is taken only as the view's direct child.
const card = (scope) => `.weekly-view > .weekly-view__grid ${scope} .venue-card[data-venue-id="${VENUE_ID}"]`;

test.describe('Show lifespan (ADR-016)', () => {

  test.beforeEach(async ({ page }) => {
    await serveWithLifespanVenue(page);
    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });
  });

  test('tonight shows the show that starts today, not the one that ended yesterday', async ({ page }) => {
    const tonight = page.locator(card('.day-card--today'));
    await expect(tonight).toHaveCount(1);
    await expect(tonight).toContainText(NEW);
    await expect(tonight).not.toContainText(OLD);
  });

  test('last week shows the show that was running then', async ({ page }) => {
    await page.locator('[data-week="-1"]').click();
    const then = page.locator(card(`.day-card--${todayName.toLowerCase()}`));
    await expect(then).toHaveCount(1);
    await expect(then).toContainText(OLD);
    await expect(then).not.toContainText(NEW);
  });

  test('a show still to come appears from its first night, not before', async ({ page }) => {
    const ahead = weeksAhead(laterStart);
    const laterDay = card(`.day-card--${laterName.toLowerCase()}`);

    // The week before it starts: that weekday's card does not carry it.
    for (let i = 0; i < ahead - 1; i += 1) await page.locator('[data-week="1"]').click();
    await expect(page.locator(`${laterDay}:has-text("${LATER}")`)).toHaveCount(0);

    // The week it starts: it does.
    await page.locator('[data-week="1"]').click();
    await expect(page.locator(`${laterDay}:has-text("${LATER}")`)).toHaveCount(1);
  });

  test.describe('detail view', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('lists only the show running today — no ended row, no announcement', async ({ page }) => {
      await page.locator(`${card('.day-card--today')} .venue-card__link`).click();
      const table = page.locator('.venue-modal__content .venue-detail__schedule-table');
      await expect(table).toBeVisible({ timeout: 5000 });
      await expect(table.locator('tbody tr')).toHaveCount(1);
      await expect(table).toContainText('9:00 PM');
      await expect(table).not.toContainText('8:00 PM');
      await expect(table).not.toContainText('6:30 PM');
    });
  });

});
