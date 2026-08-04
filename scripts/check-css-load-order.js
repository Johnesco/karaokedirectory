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

/* -------------------------------------------------------- reachability ----
 *
 * Loading the right files in the right order is not enough: a page can use a
 * class that is only defined in a stylesheet it never loads, and nothing goes
 * red. `.site-header--compact` did exactly that — it lived in bingo.css, and
 * bday.html used it without loading that file, so one of its two consumers
 * was unstyled (#162).
 */

/** Every class selector a stylesheet defines. */
function classesDefinedIn(cssFile) {
    const css = fs.readFileSync(path.join(ROOT, 'css', cssFile), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '');          // strip comments
    const defined = new Set();
    // selector text is everything before each `{` that is not an at-rule body
    for (const m of css.matchAll(/([^{}]+)\{/g)) {
        const sel = m[1].trim();
        if (sel.startsWith('@')) continue;
        for (const c of sel.matchAll(/\.([A-Za-z0-9_-]+)/g)) defined.add(c[1]);
    }
    return defined;
}

/**
 * Every class a page's markup uses, from static `class="..."` attributes.
 *
 * Comments are stripped first, same as extractCssOrder does — index.html keeps
 * the seasonal snowfall markup commented out alongside its commented-out
 * <link>, and counting it would report a stylesheet the page deliberately
 * does not load.
 */
function classesUsedIn(html) {
    const used = new Set();
    const stripped = html.replace(/<!--[\s\S]*?-->/g, '');
    for (const m of stripped.matchAll(/\sclass="([^"]*)"/g)) {
        for (const c of m[1].split(/\s+/)) {
            if (!c || c.includes('${')) continue;    // skip template placeholders
            used.add(c);
        }
    }
    return used;
}

const ALL_CSS = fs.readdirSync(path.join(ROOT, 'css')).filter(f => f.endsWith('.css'));
const DEFINED = new Map(ALL_CSS.map(f => [f, classesDefinedIn(f)]));

/**
 * Class names emitted by the first-party modules a page imports, one level deep.
 *
 * Static markup alone is not enough any more, and #162 is why: it moved the
 * header and footer out of five HTML files and into js/chrome.js, so the very
 * classes that motivated this check (`.site-header--compact`) stopped appearing
 * in any `class="..."` attribute. A check that could not see them would have
 * passed the exact bug it was written for.
 *
 * One level, first-party only. Classes rendered deeper in the module graph —
 * most of index.html — are out of scope; this is a drift guard for page
 * chrome, not a whole-app reachability prover.
 */
function classesFromImportedModules(html) {
    const used = new Set();
    const specs = new Set();

    for (const m of html.matchAll(/<script[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/g)) {
        for (const im of m[1].matchAll(/from\s+['"]\.?\/?(js\/[^'"]+)['"]/g)) specs.add(im[1]);
    }
    for (const m of html.matchAll(/<script[^>]*\ssrc="(js\/[^"]+)"/g)) specs.add(m[1]);

    for (const spec of specs) {
        const p = path.join(ROOT, spec);
        if (!fs.existsSync(p)) continue;
        const src = fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

        // Over-collect: every whitespace-separated token that could be a class
        // name, from anywhere in the file. A class attribute in a template
        // literal is routinely interpolated —
        //   class="site-header${compact ? ' site-header--compact' : ''}"
        // — so the name that matters sits inside the expression, not in the
        // literal part of the attribute. Matching the attribute alone misses it.
        //
        // Restricted to hyphenated tokens. Collecting every identifier turned up
        // `hidden`, `error` and `back` from app.js — ordinary words that happen
        // to be class names in a stylesheet index.html does not load. A hyphen
        // is what separates a BEM class from English, and every chrome class
        // this guards has one.
        for (const m of src.matchAll(/[A-Za-z][A-Za-z0-9_]*(?:-{1,2}[A-Za-z0-9_]+)+/g)) {
            used.add(m[0]);
        }
    }
    return used;
}

function checkReachability(file, order) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const used = new Set([...classesUsedIn(html), ...classesFromImportedModules(html)]);
    const loaded = new Set(order);

    const reachable = new Set();
    for (const f of order) for (const c of DEFINED.get(f) || []) reachable.add(c);

    const errors = [];
    for (const cls of used) {
        if (reachable.has(cls)) continue;
        // Where else is it defined? Only report if some stylesheet has it —
        // otherwise it is a utility/JS-only hook, not a load-order problem.
        const elsewhere = ALL_CSS.filter(f => !loaded.has(f) && DEFINED.get(f).has(cls));
        if (elsewhere.length) {
            errors.push(`uses .${cls}, defined only in ${elsewhere.join(', ')} which it does not load`);
        }
    }
    return errors;
}

const pages = fs.readdirSync(ROOT)
    .filter(f => f.endsWith('.html') && !f.startsWith('_'));

let failed = false;
for (const page of pages) {
    const { order, errors } = checkPage(page);
    const reachErrors = checkReachability(page, order);
    const all = [...errors, ...reachErrors];
    if (all.length > 0) {
        failed = true;
        console.log(`FAIL ${page}`);
        console.log(`     loaded: ${order.join(' -> ')}`);
        for (const err of all) console.log(`     - ${err}`);
    } else {
        console.log(`OK   ${page}  (${order.join(' -> ')})`);
    }
}

if (failed) {
    console.log('\nSome pages violate the canonical CSS load order or use unreachable classes.');
    console.log('See CLAUDE.md "CSS Loading Order".');
    process.exit(1);
}
