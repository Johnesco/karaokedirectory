// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * #380. The extended sections follow the VIEWED week: Next Week, then "Later
 * in [Month]", then the month after that. Only the third section's 60-day cap
 * counts from the current date. The third section used to be computed from the
 * current date alone, so navigating forward repeated a month ("Later in
 * December", then "December") or put one out of order ("Later in January",
 * then "December").
 *
 * The current date is pinned (Thu Nov 5, 2026), and four fixture venues each
 * get one special event in a known month. A section renders only when it holds
 * a venue not shown above it, so without them which titles appear would depend
 * on the live data rather than on the ranges.
 */
const EVENTS = ['2026-11-20', '2026-12-15', '2027-01-03', '2027-01-20'];

async function load(page) {
  await page.clock.setFixedTime(new Date(2026, 10, 5, 12, 0, 0));
  await page.route('**/js/data.json', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    EVENTS.forEach((date, i) => data.listings.push({
      id: `e2e-extended-${i}`,
      name: `Extended Sections Test ${i}`,
      address: { street: '1 Test St', city: 'Austin', state: 'TX', zip: '78701' },
      schedule: [{ frequency: 'once', date, startTime: '20:00', endTime: '23:00' }],
    }));
    await route.fulfill({ response, json: data });
  });
  await page.goto('/');
  await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });
}

async function forward(page, weeks) {
  const range = page.locator('.navigation__week-range');
  for (let i = 0; i < weeks; i++) {
    const before = await range.textContent();
    await page.locator('[data-week="1"]').click();
    await expect(range).not.toHaveText(before || '');
  }
}

const titles = (page) => page.locator('.extended-section__title').allTextContents()
  .then(list => list.map(t => t.trim()));

test.describe('Extended sections — anchored on the viewed week (#380)', () => {

  test.beforeEach(async ({ page }) => { await load(page); });

  test('the current week: Next Week, the rest of November, December', async ({ page }) => {
    expect(await titles(page)).toEqual(['Next Week', 'Later in November', 'December']);
  });

  test('three weeks ahead: no month twice', async ({ page }) => {
    await forward(page, 3); // viewing Nov 22–28; January is capped at Jan 4
    expect(await titles(page)).toEqual(['Next Week', 'Later in December', 'January']);
  });

  test('seven weeks ahead: no month out of order', async ({ page }) => {
    await forward(page, 7); // viewing Dec 20–26; February is beyond the 60-day cap
    expect(await titles(page)).toEqual(['Next Week', 'Later in January']);
  });
});
