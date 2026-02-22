// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Karaoke Bingo', () => {

  test.beforeEach(async ({ page }) => {
    // Clear any saved bingo state
    await page.goto('/bingo.html');
    await page.evaluate(() => localStorage.removeItem('karaokeBingoState'));
    await page.reload();
    await expect(page.locator('#bingo-card')).toBeVisible({ timeout: 10000 });
  });

  test('bingo card renders 25 cells', async ({ page }) => {
    const cells = page.locator('#bingo-card .cell');
    await expect(cells).toHaveCount(25);
  });

  test('center cell is FREE space', async ({ page }) => {
    const freeSpace = page.locator('#bingo-card .cell[data-index="12"]');
    await expect(freeSpace).toHaveClass(/free-space/);
    await expect(freeSpace).toHaveClass(/marked/);
  });

  test('clicking a cell marks it', async ({ page }) => {
    const cell = page.locator('#bingo-card .cell[data-index="0"]');

    // Cell should not be marked initially
    await expect(cell).not.toHaveClass(/marked/);

    // Click to mark
    await cell.click();
    await expect(cell).toHaveClass(/marked/);
    await expect(cell).toHaveClass(/flipped/);
  });

  test('clicking a marked cell unmarks it', async ({ page }) => {
    const cell = page.locator('#bingo-card .cell[data-index="0"]');

    // Mark, then unmark
    await cell.click();
    await expect(cell).toHaveClass(/marked/);

    await cell.click();
    await expect(cell).not.toHaveClass(/marked/);
  });

  test('undo button appears after first move', async ({ page }) => {
    const undoBtn = page.locator('#undo-button');

    // Initially not visible
    await expect(undoBtn).not.toHaveClass(/visible/);

    // Mark a cell
    await page.locator('#bingo-card .cell[data-index="0"]').click();

    // Undo button should appear
    await expect(undoBtn).toHaveClass(/visible/);
  });

  test('undo reverses the last move', async ({ page }) => {
    const cell = page.locator('#bingo-card .cell[data-index="0"]');

    await cell.click();
    await expect(cell).toHaveClass(/marked/);

    await page.locator('#undo-button').click();
    await expect(cell).not.toHaveClass(/marked/);
  });

  test('marking a full row triggers bingo', async ({ page }) => {
    // Mark the first row (indices 0-4), center cell (12) is FREE
    for (const index of [0, 1, 2, 3, 4]) {
      await page.locator(`#bingo-card .cell[data-index="${index}"]`).click();
    }

    // Bingo message should appear
    const bingoMsg = page.locator('#bingo-message');
    await expect(bingoMsg).toHaveClass(/show/, { timeout: 5000 });

    // Reset button should appear
    await expect(page.locator('#reset-button')).toHaveClass(/visible/);
  });

  test('marking a column through FREE space triggers bingo', async ({ page }) => {
    // Middle column: indices 2, 7, 12 (FREE), 17, 22
    for (const index of [2, 7, 17, 22]) {
      await page.locator(`#bingo-card .cell[data-index="${index}"]`).click();
    }

    // Bingo message should appear (FREE space at 12 counts automatically)
    const bingoMsg = page.locator('#bingo-message');
    await expect(bingoMsg).toHaveClass(/show/, { timeout: 5000 });
  });

  test('new card button generates fresh card', async ({ page }) => {
    // Mark a full row to get the reset button
    for (const index of [0, 1, 2, 3, 4]) {
      await page.locator(`#bingo-card .cell[data-index="${index}"]`).click();
    }

    await expect(page.locator('#reset-button')).toHaveClass(/visible/);

    // Get text of first cell before reset
    const firstCellText = await page.locator('#bingo-card .cell[data-index="0"] .front').textContent();

    // Click new card
    await page.locator('#reset-button').click();

    // Bingo message should be hidden
    await expect(page.locator('#bingo-message')).not.toHaveClass(/show/);

    // Previously marked cells should be unmarked
    await expect(page.locator('#bingo-card .cell[data-index="0"]')).not.toHaveClass(/marked/);

    // FREE space should still be marked
    await expect(page.locator('#bingo-card .cell[data-index="12"]')).toHaveClass(/free-space/);
  });

  test('game state persists across page reload', async ({ page }) => {
    // Mark a cell
    const cell = page.locator('#bingo-card .cell[data-index="3"]');
    await cell.click();
    await expect(cell).toHaveClass(/marked/);

    // Reload the page
    await page.reload();
    await expect(page.locator('#bingo-card')).toBeVisible({ timeout: 10000 });

    // Cell should still be marked
    await expect(page.locator('#bingo-card .cell[data-index="3"]')).toHaveClass(/marked/);
  });

});
