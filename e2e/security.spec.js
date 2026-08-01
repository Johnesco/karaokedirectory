const { test, expect } = require('@playwright/test');

/**
 * Escaping regressions.
 *
 * `?kj=` and the live search box are the only two attacker-reachable inputs in
 * the app — `app.js` reads `?kj=` straight off the query string into state, and
 * `Navigation.js` renders both into markup. Both were unescaped, and the
 * escapeHtml() they should have used did not escape quotes, so wrapping them in
 * it would not have been enough on its own.
 */

// Breaks out of a quoted attribute, then out of the element.
const ATTR_PAYLOAD = '" onfocus="window.__xss=1" autofocus x="';
const TAG_PAYLOAD = '<img src=x onerror="window.__xss=1">';

test.describe('escaping — URL and search input', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', (d) => d.dismiss());
  });

  test('?kj= tag payload renders as text, injects no element', async ({ page }) => {
    await page.goto(`/?kj=${encodeURIComponent(TAG_PAYLOAD)}`);
    await page.waitForSelector('.filter-chip__value');

    // No injected node anywhere in the document
    expect(await page.locator('img[src="x"]').count()).toBe(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();

    // ...and the payload survived intact as visible text
    await expect(page.locator('.filter-chip__value')).toHaveText(TAG_PAYLOAD);
  });

  test('?kj= attribute-breakout payload does not create attributes', async ({ page }) => {
    await page.goto(`/?kj=${encodeURIComponent(ATTR_PAYLOAD)}`);
    const chip = page.locator('.filter-chip__value');
    await chip.waitFor();

    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    await expect(chip).toHaveText(ATTR_PAYLOAD);

    // The chip must carry no attribute the payload tried to smuggle in
    const attrs = await chip.evaluate((el) => [...el.attributes].map((a) => a.name));
    expect(attrs).not.toContain('onfocus');
    expect(attrs).not.toContain('autofocus');
    expect(attrs).not.toContain('x');
  });

  test('search value survives a quote payload without breaking out', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-search="query"]').fill(ATTR_PAYLOAD);

    // Navigation deliberately does NOT re-render on searchQuery, to preserve
    // input focus — so typing alone never regenerates the markup. Toggling the
    // dedicated filter does, and that is the render that writes searchQuery
    // back into value="...". Without this the test passes vacuously.
    await page.locator('[data-filter="dedicated"]').click();
    await expect(page.locator('[data-search="query"]')).toHaveValue(ATTR_PAYLOAD);

    const input = page.locator('[data-search="query"]');
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();

    const attrs = await input.evaluate((el) => [...el.attributes].map((a) => a.name));
    expect(attrs).not.toContain('onfocus');
    expect(attrs).not.toContain('autofocus');
    expect(attrs).not.toContain('x');
  });

  test('escapeHtml escapes quotes as well as angle brackets', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const { escapeHtml, html, raw } = await import('/js/utils/string.js');
      const probe = document.createElement('div');
      probe.innerHTML = `<input value="${escapeHtml('" onfocus=x autofocus y="')}">`;
      return {
        quote: escapeHtml('"'),
        apostrophe: escapeHtml("'"),
        angle: escapeHtml('<b>'),
        amp: escapeHtml('a & b'),
        brokeOut: probe.querySelector('input').hasAttribute('autofocus'),
        // the tagged template escapes by default and honours raw()
        tagEscapes: String(html`<p>${'<b>x</b>'}</p>`),
        tagRaw: String(html`<p>${raw('<b>x</b>')}</p>`),
        // false and 0 must survive — aria-expanded="${bool}" depends on it
        tagFalse: String(html`<i a="${false}" b="${0}"></i>`),
      };
    });

    expect(result.quote).toBe('&quot;');
    expect(result.apostrophe).toBe('&#39;');
    expect(result.angle).toBe('&lt;b&gt;');
    expect(result.amp).toBe('a &amp; b');
    expect(result.brokeOut).toBe(false);
    expect(result.tagEscapes).toBe('<p>&lt;b&gt;x&lt;/b&gt;</p>');
    expect(result.tagRaw).toBe('<p><b>x</b></p>');
    expect(result.tagFalse).toBe('<i a="false" b="0"></i>');
  });
});
