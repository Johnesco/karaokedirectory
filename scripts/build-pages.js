#!/usr/bin/env node
/**
 * Generate static entity pages from js/data.json.
 *
 * Why this exists: the directory publishes four URLs while holding ~80 venues,
 * 24 KJs and 18 companies. Those entities are the whole SEO surface, and they
 * cannot be hand-authored at that count. More decisively, per-page metadata and
 * share cards CANNOT be client-rendered — Facebook, Slack, iMessage and most
 * social scrapers never execute JavaScript. A real <title>, description,
 * og:image and JSON-LD have to exist in the served HTML.
 *
 * Output shape follows ADR-011: every linkable thing is {type, id}, addressed
 * as /<type>/<id>/. Ids come from the registries, never from display names.
 *
 * Writes to the repo root (gitignored) and is run by Netlify's build command.
 * Deliberately dependency-free and synchronous — it is a file emitter, not a
 * framework. See ADR-012.
 *
 * Usage:
 *   node scripts/build-pages.js            # generate
 *   node scripts/build-pages.js --clean    # remove generated output
 *   node scripts/build-pages.js --dry-run  # report what would be written
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'js', 'data.json');
const ORIGIN = 'https://karaokedirectory.com';
const SITE = 'Austin Karaoke Directory';

/** Entity types that get a generated page. Tags are absent on purpose — see ADR-012. */
const TYPES = ['kj', 'company', 'venue'];

const WEEKDAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// ---------------------------------------------------------------- helpers

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Same contract as js/utils/string.js escapeHtml — safe in text and attributes. */
function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/[&<>"']/g, (c) => ESC[c]);
}

/** Collapse to a single line and clip, for meta descriptions. */
function clip(s, max = 155) {
    const t = String(s).replace(/\s+/g, ' ').trim();
    return t.length <= max ? t : t.slice(0, max - 1).replace(/[\s,;:.-]+\S*$/, '') + '…';
}

/**
 * Join a sentence to a trailing period without doubling it. Several venue names
 * legitimately end in one — "Hudson's On Mercer St." — and naive concatenation
 * produced "Hudson's On Mercer St..".
 */
function sentence(s) {
    const t = String(s).trim();
    return /[.!?…]$/.test(t) ? t : t + '.';
}

function titleCaseDay(d) {
    return d ? d.charAt(0).toUpperCase() + d.slice(1).toLowerCase() : '';
}

function time12(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}

function timeRange(start, end) {
    if (!start) return '';
    return `${time12(start)} – ${end ? time12(end) : 'Close'}`;
}

/** Human label for a schedule entry, matching how the app phrases them. */
function entryLabel(e) {
    if (e.frequency === 'once') return e.date ? `One-time · ${e.date}` : 'One-time event';
    const day = titleCaseDay(e.day);
    if (e.frequency === 'every') return `Every ${day}`;
    return `${titleCaseDay(e.frequency)} ${day}`;
}

function sortEntries(entries) {
    return [...entries].sort((a, b) => {
        const ai = WEEKDAY_ORDER.indexOf((a.day || '').toLowerCase());
        const bi = WEEKDAY_ORDER.indexOf((b.day || '').toLowerCase());
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
}

// ---------------------------------------------------------------- model

/**
 * Every (venue, scheduleEntry) pair with its effective host ids.
 * Host resolution mirrors js/utils/render.js resolveHostFor: an entry-level
 * host is a full swap, not a field merge.
 */
function showsOf(data) {
    const out = [];
    for (const venue of data.listings || []) {
        if (venue.active === false) continue;
        for (const entry of venue.schedule || []) {
            const host = entry.host || venue.host || null;
            out.push({
                venue,
                entry,
                kjId: host && host.kjId ? host.kjId : null,
                companyId: host && host.companyId ? host.companyId : null,
            });
        }
    }
    return out;
}

/** Build the addressable entity set from the registries. Ids only — never names. */
function entitiesOf(data) {
    const shows = showsOf(data);
    const byVenue = new Map();
    for (const s of shows) {
        if (!byVenue.has(s.venue.id)) byVenue.set(s.venue.id, []);
        byVenue.get(s.venue.id).push(s);
    }

    const entities = [];

    for (const [id, kj] of Object.entries(data.kjs || {})) {
        const mine = shows.filter((s) => s.kjId === id);
        if (!mine.length) continue;
        entities.push({ type: 'kj', id, name: kj.name, website: kj.website, socials: kj.socials, shows: mine });
    }

    for (const [id, co] of Object.entries(data.companies || {})) {
        const mine = shows.filter((s) => s.companyId === id);
        if (!mine.length) continue;
        entities.push({ type: 'company', id, name: co.name, website: co.website, socials: co.socials, shows: mine });
    }

    for (const venue of data.listings || []) {
        if (venue.active === false) continue;
        entities.push({ type: 'venue', id: venue.id, name: venue.name, venue, shows: byVenue.get(venue.id) || [] });
    }

    return entities;
}

// ---------------------------------------------------------------- rendering

function urlFor(e) {
    return `${ORIGIN}/${e.type}/${e.id}/`;
}

function describe(e) {
    const venueNames = [...new Set(e.shows.map((s) => s.venue.name))];
    if (e.type === 'venue') {
        const a = e.venue.address || {};
        const where = [a.street, a.city].filter(Boolean).join(', ');
        const nights = sortEntries(e.shows.map((s) => s.entry)).map(entryLabel);
        const lead = sentence(`Karaoke at ${e.name}${where ? ` — ${where}` : ''}`);
        return clip(lead + (nights.length ? ` ${sentence(nights.slice(0, 3).join('. '))}` : ''));
    }
    const noun = e.type === 'kj' ? 'Karaoke hosted by' : 'Karaoke run by';
    const lead = sentence(`${noun} ${e.name} in Austin, TX`);
    if (!venueNames.length) return clip(lead);
    const list = sentence(`${venueNames.length} venue${venueNames.length === 1 ? '' : 's'}: ${venueNames.slice(0, 4).join(', ')}`);
    return clip(`${lead} ${list}`);
}

function titleFor(e) {
    if (e.type === 'venue') return `Karaoke at ${e.name} — ${SITE}`;
    if (e.type === 'kj') return `${e.name} — Karaoke KJ in Austin — ${SITE}`;
    return `${e.name} — Karaoke Company in Austin — ${SITE}`;
}

/** JSON-LD. @id is the entity URL, which is exactly what ADR-011's ids buy. */
function jsonLd(e) {
    const url = urlFor(e);
    if (e.type === 'venue') {
        const a = e.venue.address || {};
        const node = {
            '@context': 'https://schema.org',
            '@type': 'BarOrPub',
            '@id': url,
            name: e.name,
            url,
        };
        if (a.street || a.city) {
            node.address = {
                '@type': 'PostalAddress',
                streetAddress: a.street || undefined,
                addressLocality: a.city || undefined,
                addressRegion: a.state || undefined,
                postalCode: a.zip || undefined,
                addressCountry: 'US',
            };
        }
        if (e.venue.coordinates) {
            node.geo = {
                '@type': 'GeoCoordinates',
                latitude: e.venue.coordinates.lat,
                longitude: e.venue.coordinates.lng,
            };
        }
        if (e.venue.phone) node.telephone = e.venue.phone;
        if (e.venue.socials && e.venue.socials.website) node.sameAs = [e.venue.socials.website];
        return node;
    }

    const node = {
        '@context': 'https://schema.org',
        '@type': e.type === 'kj' ? 'Person' : 'Organization',
        '@id': url,
        name: e.name,
        url,
        jobTitle: e.type === 'kj' ? 'Karaoke Host' : undefined,
        areaServed: 'Austin, TX',
    };
    if (e.website) node.sameAs = [e.website];
    return JSON.parse(JSON.stringify(node)); // drop undefined
}

/**
 * Serialise JSON-LD for embedding in a <script> element.
 *
 * `JSON.stringify` does not escape `<`, so a value containing `</script>`
 * closes the element early and everything after it is parsed as markup — a
 * venue named `</script><img src=x onerror=…>` injects a live element. Not
 * reachable from curated data today, but the generator should not have that
 * property at all.
 *
 * `<` is valid JSON and parses back to `<`, so consumers are unaffected.
 * U+2028/U+2029 are legal in JSON but not in JS string literals, and are
 * escaped for the same reason.
 */
function jsonLdScript(node) {
    return JSON.stringify(node)
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

function renderShowRows(shows, { showVenue }) {
    const rows = sortEntries(shows.map((s) => ({ ...s.entry, __venue: s.venue })))
        .map((entry) => {
            const cells = [`<td>${esc(entryLabel(entry))}</td>`];
            if (showVenue) {
                cells.push(`<td><a href="/venue/${esc(entry.__venue.id)}/">${esc(entry.__venue.name)}</a></td>`);
            }
            cells.push(`<td>${esc(timeRange(entry.startTime, entry.endTime))}</td>`);
            return `<tr>${cells.join('')}</tr>`;
        });
    if (!rows.length) return '<p>No scheduled nights listed.</p>';
    const head = showVenue
        ? '<tr><th>When</th><th>Venue</th><th>Time</th></tr>'
        : '<tr><th>When</th><th>Time</th></tr>';
    return `<table class="schedule-table"><thead>${head}</thead><tbody>${rows.join('')}</tbody></table>`;
}

/** Links from this entity to the others it is connected to — the cross-linking ADR-011 enables. */
function renderRelated(e, data) {
    const links = [];
    if (e.type === 'venue') {
        const kjIds = [...new Set(e.shows.map((s) => s.kjId).filter(Boolean))];
        const coIds = [...new Set(e.shows.map((s) => s.companyId).filter(Boolean))];
        for (const id of kjIds) if (data.kjs[id]) links.push(`<a href="/kj/${esc(id)}/">${esc(data.kjs[id].name)}</a>`);
        for (const id of coIds) if (data.companies[id]) links.push(`<a href="/company/${esc(id)}/">${esc(data.companies[id].name)}</a>`);
        if (!links.length) return '';
        return `<section class="entity-related"><h2>Hosted by</h2><p>${links.join(' · ')}</p></section>`;
    }
    // kj / company -> the companies or KJs they work alongside
    const otherKey = e.type === 'kj' ? 'companyId' : 'kjId';
    const registry = e.type === 'kj' ? data.companies : data.kjs;
    const otherType = e.type === 'kj' ? 'company' : 'kj';
    const ids = [...new Set(e.shows.map((s) => s[otherKey]).filter(Boolean))];
    for (const id of ids) if (registry[id]) links.push(`<a href="/${otherType}/${esc(id)}/">${esc(registry[id].name)}</a>`);
    if (!links.length) return '';
    const heading = e.type === 'kj' ? 'Works with' : 'KJs';
    return `<section class="entity-related"><h2>${heading}</h2><p>${links.join(' · ')}</p></section>`;
}

function renderPage(e, data) {
    const url = urlFor(e);
    const title = titleFor(e);
    const desc = describe(e);
    const venueCount = new Set(e.shows.map((s) => s.venue.id)).size;

    let body = '';
    if (e.type === 'venue') {
        const a = e.venue.address || {};
        const addr = [a.street, [a.city, a.state].filter(Boolean).join(', '), a.zip].filter(Boolean).join(' · ');
        body += addr ? `<p class="entity-page__meta">${esc(addr)}</p>` : '';
        if (e.venue.phone) body += `<p class="entity-page__meta"><a href="tel:${esc(e.venue.phone)}">${esc(e.venue.phone)}</a></p>`;
        body += `<h2>Karaoke schedule</h2>${renderShowRows(e.shows, { showVenue: false })}`;
    } else {
        body += `<p class="entity-page__meta">${venueCount} venue${venueCount === 1 ? '' : 's'} in the Austin area</p>`;
        body += `<h2>Where ${esc(e.name)} hosts</h2>${renderShowRows(e.shows, { showVenue: true })}`;
    }
    body += renderRelated(e, data);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<title>${esc(title)}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/layout.css">
<link rel="stylesheet" href="/css/components.css">
<link rel="stylesheet" href="/css/views.css">
<script type="application/ld+json">${jsonLdScript(jsonLd(e))}</script>
</head>
<body class="page--readable">
<header class="site-header">
  <div class="site-header__content">
    <h1 class="site-header__title">${esc(e.name)}</h1>
    <p class="site-header__tagline">${esc(e.type === 'venue' ? 'Karaoke venue' : e.type === 'kj' ? 'Karaoke KJ' : 'Karaoke company')} · Austin, TX</p>
  </div>
</header>

<nav class="navigation-container">
  <div class="navigation">
    <a href="/" class="nav-btn"><i class="fa-solid fa-arrow-left"></i><span>Back to Directory</span></a>
  </div>
</nav>

<main class="main-content">
  <article class="entity-page">
    ${body}
  </article>
</main>

<footer class="site-footer">
  <div class="site-footer__links">
    <a href="/">Directory</a>
    <a href="/about.html">About</a>
    <a href="/submit.html">Submit a Venue</a>
  </div>
  <p class="site-footer__copyright">&copy; ${new Date().getFullYear()} ${SITE}</p>
</footer>
<script src="/js/analytics.js" defer></script>
</body>
</html>
`;
}

// ---------------------------------------------------------------- sitemap

const STATIC_URLS = ['/', '/about.html', '/submit.html', '/bingo.html'];

function renderSitemap(entities) {
    const urls = [
        ...STATIC_URLS.map((u) => ORIGIN + u),
        ...entities.map(urlFor),
    ];
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n')
        + '\n</urlset>\n';
}

// ---------------------------------------------------------------- main

function main() {
    const args = process.argv.slice(2);
    const clean = args.includes('--clean');
    const dryRun = args.includes('--dry-run');

    if (clean) {
        for (const t of TYPES) fs.rmSync(path.join(ROOT, t), { recursive: true, force: true });
        console.log('Removed generated directories: ' + TYPES.join(', '));
        return;
    }

    const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    const entities = entitiesOf(data);

    const counts = {};
    for (const e of entities) counts[e.type] = (counts[e.type] || 0) + 1;

    if (dryRun) {
        console.log('Would generate:');
        for (const t of TYPES) console.log(`  /${t}/  ${counts[t] || 0} pages`);
        console.log(`  sitemap.xml  ${STATIC_URLS.length + entities.length} urls`);
        return;
    }

    for (const t of TYPES) fs.rmSync(path.join(ROOT, t), { recursive: true, force: true });

    for (const e of entities) {
        const dir = path.join(ROOT, e.type, e.id);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'index.html'), renderPage(e, data));
    }

    fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), renderSitemap(entities));

    const total = entities.length;
    console.log(`Generated ${total} entity pages:`);
    for (const t of TYPES) console.log(`  /${t}/  ${counts[t] || 0}`);
    console.log(`sitemap.xml: ${STATIC_URLS.length + total} urls`);
}

if (require.main === module) main();

module.exports = { entitiesOf, showsOf, renderPage, renderSitemap, describe, titleFor, jsonLd, jsonLdScript, urlFor, esc, clip, sentence };
