// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Debug mode', () => {

  test('loading with ?debug=1 shows debug indicator', async ({ page }) => {
    await page.goto('/?debug=1');
    await expect(page.locator('.day-card').first()).toBeVisible();

    const debugIndicator = page.locator('.debug-indicator');
    await expect(debugIndicator).toBeVisible();
    await expect(debugIndicator).toContainText('Debug Mode');
  });

  test('debug mode is not active by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible();

    const debugIndicator = page.locator('.debug-indicator');
    await expect(debugIndicator).not.toBeVisible();
  });

});

// Source links (#305): private post links the curator preview serves as
// js/sources.local.json. Stubbed here — the real file never exists in the repo.
test.describe('Debug mode source links', () => {
  const fs = require('fs');
  const path = require('path');
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.json'), 'utf8'));

  // A weekly show with no lifespan at an active venue: on this week's calendar
  // whatever today is.
  const venue = data.listings.find(v => v.active !== false
    && (v.schedule || []).some(e => e.frequency === 'every' && !e.activePeriod));
  const entry = venue.schedule.find(e => e.frequency === 'every' && !e.activePeriod);
  const key = [venue.id, entry.frequency, entry.day, entry.startTime].join('|');
  const POST = 'https://www.facebook.com/groups/example/posts/1/';

  async function stubSources(page) {
    const requested = [];
    await page.route('**/js/sources.local.json', route => {
      requested.push(route.request().url());
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ [key]: { url: POST, for: '2026-10-12' } }) });
    });
    return requested;
  }

  test('debug mode shows the source link on the show\'s card', async ({ page }) => {
    await stubSources(page);
    await page.goto('/?debug=1');
    const link = page.locator(`.venue-card[data-venue-id="${venue.id}"] .debug-source`).first();
    await expect(link).toHaveAttribute('href', POST);
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('normal mode never asks for the file and adds no markup', async ({ page }) => {
    const requested = await stubSources(page);
    await page.goto('/');
    await expect(page.locator('.day-card').first()).toBeVisible();
    await expect(page.locator('.debug-source')).toHaveCount(0);
    expect(requested).toEqual([]);
  });

  test('debug mode without the file shows no links', async ({ page }) => {
    await page.route('**/js/sources.local.json', route => route.fulfill({ status: 404, body: '' }));
    await page.goto('/?debug=1');
    await expect(page.locator('.day-card').first()).toBeVisible();
    await expect(page.locator('.debug-source')).toHaveCount(0);
  });

});
