// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * The freshness lens (#259): ?fresh=1 reveals each show's lastVerified.
 *
 * An unverified show renders NOTHING, lens on or off (#267) — the lens is an
 * internal testing aid. So the off-by-default test, the one that matters most,
 * runs on the real data, and the lens-on tests stamp every served entry with
 * today's date in flight so their assertions hold whatever js/data.json says.
 */

function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Serve data.json with lastVerified = today on every schedule entry. */
async function stampEveryEntry(page) {
  const iso = todayLocalISO();
  await page.route('**/js/data.json', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    for (const v of data.listings) for (const e of v.schedule || []) e.lastVerified = iso;
    await route.fulfill({ response, json: data });
  });
}

test.describe('Freshness lens (?fresh=1)', () => {

  test('is off by default — no indicator, no verified lines, no Verified column', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });

    await expect(page.locator('.fresh-indicator')).toHaveCount(0);
    await expect(page.locator('.venue-card__verified')).toHaveCount(0);

    await page.locator('.day-card:not(.day-card--past) .venue-card__link').first().click();
    await expect(page.locator('.venue-detail__schedule-table th', { hasText: 'Verified' })).toHaveCount(0);

    // The A–Z cards' per-show lines (#271) are lens-only too.
    await page.goto('/?view=alphabetical');
    await expect(page.locator('.venue-card--full').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.venue-card__verified-row')).toHaveCount(0);
  });

  test('lists one labelled line per verified show on the A–Z cards once shows are stamped (#271)', async ({ page }) => {
    await stampEveryEntry(page);
    await page.goto('/?view=alphabetical&fresh=1');
    await expect(page.locator('.venue-card--full').first()).toBeVisible({ timeout: 15000 });

    // Every show is stamped, so each card has exactly one line per schedule row.
    const mismatched = await page.evaluate(() => [...document.querySelectorAll('.venue-card--full')]
      .map(c => [c.querySelectorAll('.venue-detail__schedule-table tbody tr').length, c.querySelectorAll('.venue-card__verified-row').length])
      .filter(([rows, lines]) => rows !== lines).length);
    expect(mismatched).toBe(0);
    await expect(page.locator('.venue-card--full .venue-card__verified-row').first()).toContainText(/Verified .* · today/);
    await expect(page.locator('.venue-card--full .venue-card__verified-row .venue-card__verified-show').first()).not.toBeEmpty();
  });

  test('with the lens on, an unverified show still says nothing (#267)', async ({ page }) => {
    const data = await (await page.request.get('/js/data.json')).json();
    const anyVerified = data.listings.some(v => (v.schedule || []).some(e => e.lastVerified));

    await page.goto('/?fresh=1');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.fresh-indicator')).toBeVisible();

    test.skip(anyVerified, 'js/data.json now carries verified shows; the stamped tests below cover the lens');
    await expect(page.locator('.venue-card__verified')).toHaveCount(0);
    await page.locator('.day-card:not(.day-card--past) .venue-card__link').first().click();
    await expect(page.locator('.venue-detail__schedule-table th', { hasText: 'Verified' })).toHaveCount(0);
  });

  test('shows the indicator and a verified line on every calendar card once every show is stamped', async ({ page }) => {
    await stampEveryEntry(page);
    await page.goto('/?fresh=1');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });

    const indicator = page.locator('.fresh-indicator');
    await expect(indicator).toBeVisible();
    await expect(indicator).toContainText('Freshness lens');

    const cards = page.locator('.day-card .venue-card');
    const lines = page.locator('.day-card .venue-card .venue-card__verified');
    expect(await cards.count()).toBeGreaterThan(0);
    expect(await lines.count()).toBe(await cards.count());
    await expect(lines.first()).toContainText(/Verified .* · today/);
  });

  test('adds a Verified column to the detail schedule table once shows are stamped', async ({ page }) => {
    await stampEveryEntry(page);
    await page.goto('/?fresh=1');
    await expect(page.locator('.day-card').first()).toBeVisible({ timeout: 15000 });

    await page.locator('.day-card:not(.day-card--past) .venue-card__link').first().click();
    // Whichever surface opened at this viewport (modal or pane) renders the
    // same shared table; the other surface's copy is display:none.
    const th = page.locator('.venue-detail__schedule-table th:visible', { hasText: 'Verified' });
    await expect(th.first()).toBeVisible({ timeout: 5000 });
  });

  test('survives the KJ pages', async ({ page }) => {
    await page.goto('/?kj=all&fresh=1');
    await expect(page.locator('.fresh-indicator')).toBeVisible();
  });

});
