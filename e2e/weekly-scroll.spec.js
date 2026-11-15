// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * #400. The calendar scrolls to today's card only when the week on screen
 * changes: the first render, or week navigation. It used to scroll on every
 * render, so someone reading Friday who flipped Dedicated or typed a search
 * letter was thrown back to today.
 *
 * The current date is pinned to a Sunday (Nov 8, 2026), so today is the first
 * card and the rest of the week sits below it.
 */
async function load(page) {
  await page.clock.setFixedTime(new Date(2026, 10, 8, 12, 0, 0));
  await page.goto('/');
  await expect(page.locator('.day-card--today')).toBeVisible({ timeout: 15000 });
}

/** Scroll the Next Week section to the top, well past today's card. */
async function scrollPastToday(page) {
  await page.locator('.extended-section').first().evaluate(el =>
    el.scrollIntoView({ behavior: 'instant', block: 'start' }));
  const y = await page.evaluate(() => window.scrollY);
  const todayTop = await page.locator('.day-card--today').evaluate(el =>
    el.getBoundingClientRect().top + window.scrollY);
  expect(y).toBeGreaterThan(todayTop + 500);
  return y;
}

test.describe('Weekly view — scroll position (#400)', () => {

  test('toggling Dedicated keeps the reader where they were', async ({ page }) => {
    await load(page);
    const before = await scrollPastToday(page);

    await page.locator('[data-filter="dedicated"]').uncheck();
    await expect(page.locator('[data-filter="dedicated"]')).not.toBeChecked();

    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });

  test('typing a search keeps the reader where they were', async ({ page }) => {
    await load(page);
    const before = await scrollPastToday(page);

    // Each keystroke re-renders the week. "a" matches the city of nearly every
    // venue, so the page stays long enough that the browser never clamps.
    const input = page.locator('[data-search="query"]');
    await input.focus();
    await page.evaluate(y => window.scrollTo(0, y), before);
    await input.pressSequentially('a');

    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });

  test('returning to the current week still scrolls to today', async ({ page }) => {
    await load(page);
    await scrollPastToday(page);

    const range = page.locator('.navigation__week-range');
    const thisWeek = await range.textContent();
    await page.locator('[data-week="1"]').click();
    await expect(range).not.toHaveText(thisWeek ?? '');
    await page.locator('[data-week="today"]').click();
    await expect(range).toHaveText(thisWeek ?? '');

    const top = await page.locator('.day-card--today').evaluate(el =>
      el.getBoundingClientRect().top);
    expect(Math.abs(top)).toBeLessThan(250);
  });
});
