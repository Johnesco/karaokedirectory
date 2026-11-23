// @ts-check
/**
 * The ?print= plain-text printout (#463).
 *
 * The data is patched: one made-up venue carries a ticketed special, a weekly
 * show with that night off, and a weekly show that ended, all on a fixed date
 * far enough ahead that real data cannot collide with the assertions about
 * these three. The real shows that night still print; nothing here counts them.
 */
const { test, expect } = require('@playwright/test');

const NIGHT = '2027-06-15'; // a Tuesday
const PRINT = '06152027';

test.describe('Print view', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/js/data.json', async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      data.listings.push({
        id: 'print-test-venue',
        name: 'Zzz Print Test Bar',
        address: { street: '1 Test St', city: 'Austin', state: 'TX', zip: '78701' },
        host: { name: 'KJ Test' },
        schedule: [
          { frequency: 'once', date: NIGHT, startTime: '20:00', endTime: '23:00', eventName: 'Test Gala', ticketed: true },
          { frequency: 'every', day: 'Tuesday', startTime: '21:00', endTime: '01:00', exclusions: [{ date: NIGHT }] },
          { frequency: 'every', day: 'Tuesday', startTime: '19:00', endTime: '22:00', activePeriod: { end: '2027-06-08' } },
        ],
      });
      await route.fulfill({ response, json: data });
    });
  });

  test('prints the night as text: heading, specials first, no night off, nothing ended', async ({ page }) => {
    await page.goto(`/?print=${PRINT}`);
    const text = page.locator('.print-view__text');
    await expect(text).toBeVisible({ timeout: 15000 });

    const body = await text.textContent() ?? '';
    const lines = body.split('\n');
    expect(lines[0]).toBe('Karaoke in Austin — Tuesday, June 15, 2027');
    expect(lines[2]).toBe('★ Test Gala at Zzz Print Test Bar — 8:00 PM - 11:00 PM, Austin · KJ Test (ticketed)');

    // The night off and the ended show are not listed; the special is the venue's only line.
    expect(lines.filter(l => l.includes('Zzz Print Test Bar'))).toHaveLength(1);
    expect(body).toMatch(/\n\d+ shows?\. /);
    expect(lines.at(-1)).toBe('Full schedule: https://karaokedirectory.com');

    // The app itself is not on the page.
    await expect(page.locator('.day-card')).toHaveCount(0);
    await expect(page.locator('.navigation-container')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Copy text' })).toBeVisible();
  });

  test('today, yesterday and tomorrow print a dated listing', async ({ page }) => {
    for (const word of ['today', 'Yesterday', 'TOMORROW']) {
      await page.goto(`/?print=${word}`);
      await expect(page.locator('.print-view__text')).toContainText('Karaoke in Austin — ', { timeout: 15000 });
    }
  });

  test('until 1 AM, today is the night under way, as on the calendar (#401)', async ({ page }) => {
    // 12:30 AM Saturday, Nov 14 2026: Friday is still Today.
    await page.clock.setFixedTime(new Date(2026, 10, 14, 0, 30));
    await page.goto('/?print=today');
    await expect(page.locator('.print-view__text')).toContainText('Karaoke in Austin — Friday, November 13, 2026', { timeout: 15000 });

    await page.goto('/?print=tomorrow');
    await expect(page.locator('.print-view__text')).toContainText('Karaoke in Austin — Saturday, November 14, 2026', { timeout: 15000 });

    // From 1 AM the date moves on.
    await page.clock.setFixedTime(new Date(2026, 10, 14, 1, 0));
    await page.goto('/?print=today');
    await expect(page.locator('.print-view__text')).toContainText('Karaoke in Austin — Saturday, November 14, 2026', { timeout: 15000 });
  });

  test('an unreadable value says what is accepted', async ({ page }) => {
    for (const bad of ['02302026', 'friday', '']) {
      await page.goto(`/?print=${bad}`);
      const error = page.locator('.print-view .error-message');
      await expect(error).toContainText("Can't read that date", { timeout: 15000 });
      await expect(error).toContainText('MMDDYYYY');
      await expect(page.locator('.print-view__text')).toHaveCount(0);
    }
  });
});
