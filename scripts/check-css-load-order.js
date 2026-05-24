#!/usr/bin/env node
/**
 * Verify each top-level HTML page loads CSS in the canonical order:
 *
 *   base.css -> layout.css -> components.css -> [views.css] -> [page-specific]
 *
 * The order matters because later files override variables and components
 * defined in earlier ones. CLAUDE.md documents the rule; this script
 * enforces it.
 *
 * Usage: node scripts/check-css-load-order.js
 * Exit code: 0 if all pages comply, 1 otherwise.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL = ['base.css', 'layout.css', 'components.css'];
const VIEWS = 'views.css';

// Pages that may load a page-specific stylesheet after views (or after components if no views).
const PAGE_SPECIFIC = {
    'submit.html': 'submit.css',
    'bingo.html': 'bingo.css',
    'editor.html': 'editor.css',
};

function extractCssOrder(html) {
    // Strip HTML comments so commented-out <link> tags (e.g., seasonal snowflakes.css) don't count
    const stripped = html.replace(/<!--[\s\S]*?-->/g, '');
    // Match relative href="css/<file>.css" only — skip CDN and font sheets
    const matches = [...stripped.matchAll(/<link[^>]+href="css\/([^"]+\.css)"/g)];
    return matches.map(m => m[1]);
}

function checkPage(file) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const order = extractCssOrder(html);
    const errors = [];

    // First three must be base, layout, components in that order
    for (let i = 0; i < CANONICAL.length; i++) {
        if (order[i] !== CANONICAL[i]) {
            errors.push(`expected position ${i + 1} to be ${CANONICAL[i]}, got ${order[i] || '(missing)'}`);
        }
    }

    // Remaining: optional views.css, optional page-specific
    const tail = order.slice(CANONICAL.length);
    let cursor = 0;

    if (tail[cursor] === VIEWS) cursor++;

    const expectedPageCss = PAGE_SPECIFIC[file];
    if (expectedPageCss) {
        if (tail[cursor] !== expectedPageCss) {
            errors.push(`expected ${expectedPageCss} after components/views, got ${tail[cursor] || '(missing)'}`);
        } else {
            cursor++;
        }
    }

    if (cursor < tail.length) {
        errors.push(`unexpected extra stylesheet(s) after page-specific: ${tail.slice(cursor).join(', ')}`);
    }

    return { file, order, errors };
}

const pages = fs.readdirSync(ROOT)
    .filter(f => f.endsWith('.html') && !f.startsWith('_'));

let failed = false;
for (const page of pages) {
    const { order, errors } = checkPage(page);
    if (errors.length > 0) {
        failed = true;
        console.log(`FAIL ${page}`);
        console.log(`     loaded: ${order.join(' -> ')}`);
        for (const err of errors) console.log(`     - ${err}`);
    } else {
        console.log(`OK   ${page}  (${order.join(' -> ')})`);
    }
}

if (failed) {
    console.log('\nSome pages violate the canonical CSS load order. See CLAUDE.md "CSS Loading Order".');
    process.exit(1);
}
