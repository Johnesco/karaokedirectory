// @ts-check

/**
 * Pin the page's clock to noon of the current date (#401).
 *
 * Specs that read the real data work out "today" in Node with `new Date()` and
 * then look for it on the page as `.day-card--today`. Since #401 the calendar
 * keeps the night under way as Today until 1 AM, so between midnight and 1 AM
 * the two disagree by a day and those specs fail. At noon there is no
 * disagreement: the calendar's Today and the calendar date are the same.
 *
 * Call before `page.goto`. Only the browser's clock is pinned; time still
 * passes for timers, so nothing else about the page changes.
 *
 * @param {import('@playwright/test').Page} page
 */
async function pinToNoon(page) {
  const noon = new Date();
  noon.setHours(12, 0, 0, 0);
  await page.clock.setFixedTime(noon);
}

module.exports = { pinToNoon };
