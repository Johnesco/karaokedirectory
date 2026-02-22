// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Secondary pages load correctly', () => {

  test('about page loads with heading', async ({ page }) => {
    await page.goto('/about.html');
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('bingo page renders bingo card', async ({ page }) => {
    await page.goto('/bingo.html');
    const bingoCard = page.locator('#bingo-card');
    await expect(bingoCard).toBeVisible({ timeout: 10000 });
  });

  test('submit page has form content', async ({ page }) => {
    await page.goto('/submit.html');
    const submitForm = page.locator('.submit-form');
    await expect(submitForm).toBeVisible();
    const text = await submitForm.textContent();
    expect(text.toLowerCase()).toContain('venue');
  });

  test('editor page loads editor layout', async ({ page }) => {
    await page.goto('/editor.html');
    const editorMain = page.locator('.editor-main');
    await expect(editorMain).toBeVisible({ timeout: 10000 });
  });

  test('code explained page renders content', async ({ page }) => {
    await page.goto('/codeexplained.html');
    const docsContainer = page.locator('.docs-container');
    await expect(docsContainer).toBeVisible({ timeout: 5000 });
  });

});
