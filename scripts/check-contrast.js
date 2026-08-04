#!/usr/bin/env node
/**
 * Verify text/background contrast for the colour pairs the app hardcodes.
 *
 * The seven day headers are the reason this exists. They are the most
 * prominent text on the default view, their backgrounds are seven literal
 * gradients rather than tokens, and Tuesday's yellow sat at 1.45:1 under white
 * text for as long as the ROYGBIV band has existed — no tool in the repo could
 * have noticed (#165).
 *
 * WHAT IS MEASURED, AND THE HONEST CAVEAT
 *
 * The headers use outlined text: a white fill with a solid dark stroke. That
 * is deliberate — the bands span the whole hue wheel and vary hugely in
 * lightness, and darkening yellow enough for white text turns it brown and
 * breaks the rainbow. The outline puts the contrast on the glyph instead.
 *
 * WCAG 2.x's ratio formula models a flat fill on a flat background. It has no
 * concept of a stroke, so a literal reading still compares white to yellow and
 * still says 1.45:1. That reading does not describe what a reader sees: the
 * letterform is separated from the band by its outline.
 *
 * So when the text carries an outline, this script measures the EDGE — the
 * outline colour against the background — because that is the boundary doing
 * the work. It also checks fill-against-outline, so a "fix" that made the
 * stroke the same colour as the fill could not pass silently.
 *
 * This is a judgement call, recorded here rather than hidden: it is a
 * defensible model of outlined text, not a claim of formal WCAG conformance
 * for the fill/background pair.
 *
 * Thresholds are WCAG 2.1 AA:
 *   normal text  4.5:1
 *   large text   3.0:1   (>=18.66px bold, or >=24px)
 *
 * The day titles are 1.8rem/800 = 28.8px bold, so they are large text.
 *
 * Usage: node scripts/check-contrast.js
 * Exit code: 0 if every pair clears its threshold, 1 otherwise.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* ---------------------------------------------------------------- colour ---- */

/** #rgb / #rrggbb -> [r,g,b] */
function parseHex(hex) {
    let h = hex.replace('#', '').trim();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/**
 * hwb(H W% B%) -> [r,g,b]. Only the space-separated form the stylesheet uses.
 * Tuesday's gradient is authored as hwb(), so a hex-only parser would skip
 * exactly the value that motivated this check.
 */
function parseHwb(str) {
    const m = str.match(/hwb\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i);
    if (!m) return null;
    const [h, w, b] = [parseFloat(m[1]), parseFloat(m[2]) / 100, parseFloat(m[3]) / 100];

    // Hue at full saturation, mid lightness — the standard HSL helper with
    // s=1, l=0.5, so a = s * min(l, 1-l) = 0.5.
    const f = (n) => {
        const k = (n + h / 30) % 12;
        const a = Math.min(k - 3, 9 - k, 1);
        return 0.5 - 0.5 * Math.max(-1, Math.min(a, 1));
    };
    const base = [f(0), f(8), f(4)];

    // HWB: each channel scaled by the remaining room, then lifted by whiteness.
    // Degenerate case w + b >= 1 collapses to a grey.
    if (w + b >= 1) {
        const grey = Math.round((w / (w + b)) * 255);
        return [grey, grey, grey];
    }
    const scale = 1 - w - b;
    return base.map((c) => Math.round((c * scale + w) * 255));
}

function parseColor(str) {
    const s = str.trim();
    if (s.startsWith('#')) return parseHex(s);
    if (s.toLowerCase().startsWith('hwb(')) return parseHwb(s);
    const rgb = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (rgb) return [rgb[1], rgb[2], rgb[3]].map(Number);
    const named = { white: [255, 255, 255], black: [0, 0, 0] };
    return named[s.toLowerCase()] || null;
}

function relativeLuminance([r, g, b]) {
    const f = (v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(fg, bg) {
    const [hi, lo] = [relativeLuminance(fg), relativeLuminance(bg)].sort((a, b) => b - a);
    return (hi + 0.05) / (lo + 0.05);
}

/* ------------------------------------------------------------- extraction ---- */

const views = fs.readFileSync(path.join(ROOT, 'css/views.css'), 'utf8');
const base = fs.readFileSync(path.join(ROOT, 'css/base.css'), 'utf8');

/** Resolve a `var(--token)` reference against base.css's :root block. */
function resolveToken(name, seen = new Set()) {
    if (seen.has(name)) return null;
    seen.add(name);
    const m = base.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
    if (!m) return null;
    const value = m[1].trim();
    const varRef = value.match(/var\(\s*--([\w-]+)\s*\)/);
    if (varRef) return resolveToken(varRef[1], seen);
    return value;
}

function resolveColor(value) {
    const varRef = value.match(/var\(\s*--([\w-]+)\s*\)/);
    if (varRef) {
        const resolved = resolveToken(varRef[1]);
        return resolved ? parseColor(resolved) : null;
    }
    return parseColor(value);
}

/**
 * Pull each day's header gradient stops out of views.css, plus the foreground
 * that applies to that day (the shared white rule, or a per-day override).
 */
function extractDayHeaders() {
    const days = [];
    // Find each rule, then scan the gradient with brace/paren balancing rather
    // than a regex. Tuesday's stop is authored as `hwb(55 0% 7%)`, and a naive
    // `[^)]*` stops at the inner `)` — which silently dropped the one day that
    // actually failed. A checker that skips the failing case is worse than none.
    const re = /\.day-card--(\w+)\s+\.day-card__header\s*\{\s*background:\s*linear-gradient\(/g;
    let m;
    while ((m = re.exec(views)) !== null) {
        const day = m[1];
        let i = re.lastIndex;
        let depth = 1;
        let body = '';
        while (i < views.length && depth > 0) {
            const ch = views[i];
            if (ch === '(') depth++;
            else if (ch === ')') { depth--; if (depth === 0) break; }
            body += ch;
            i++;
        }
        // stops: hex, hwb(...), or rgb(...) — ignore the leading angle
        const stops = (body.match(/#[0-9a-f]{3,8}|hwb\([^)]*\)|rgba?\([^)]*\)/gi) || []);
        if (!stops.length) continue;

        // Foreground: a per-day override wins over the shared white rule.
        const overrideRe = new RegExp(
            `\\.day-card--${day}\\s+\\.day-card__header\\s+\\.day-card__day[\\s\\S]{0,400}?color:\\s*([^;]+);`
        );
        const override = views.match(overrideRe);
        const sharedRe = /\.day-card__header\s+\.day-card__day,[\s\S]{0,300}?color:\s*([^;]+);/;
        const shared = views.match(sharedRe);
        const fgValue = (override ? override[1] : shared && shared[1]) || '#ffffff';

        // Outline, if the shared rule declares one.
        const strokeRe = /\.day-card__header\s+\.day-card__day,[\s\S]{0,600}?-webkit-text-stroke:\s*[\d.]+px\s+([^;]+);/;
        const strokeMatch = views.match(strokeRe);
        const outlineValue = strokeMatch ? strokeMatch[1].trim() : null;

        days.push({ day, stops, fgValue, outlineValue });
    }
    return days;
}

/* ------------------------------------------------------------------ check ---- */

// Two pieces of text sit in a day header, at different WCAG thresholds:
//
//   .day-card__day   1.8rem/800 = 28.8px bold -> large text -> 3.0:1  (gate)
//   .day-card__date  0.875rem   = 14px        -> normal text -> 4.5:1 (warn)
//
// The gate is the large-text bar, which is the failure the ticket describes and
// the one that is unambiguous. The 14px date is reported separately: Monday and
// Wednesday sit just under 4.5:1 on their light stop, which is a real but far
// milder issue than Tuesday's 1.45:1, and fixing it means restyling bands
// nobody asked to change. Surfaced, not silently enforced.
const LARGE_TEXT_AA = 3.0;
const NORMAL_TEXT_AA = 4.5;

const failures = [];
const warnings = [];
const rows = [];

let outlined = false;

for (const { day, stops, fgValue, outlineValue } of extractDayHeaders()) {
    const fg = resolveColor(fgValue);
    if (!fg) {
        failures.push(`${day}: could not resolve foreground "${fgValue}"`);
        continue;
    }

    // With an outline, the boundary between glyph and band is the stroke.
    const outline = outlineValue ? resolveColor(outlineValue) : null;
    if (outlineValue && !outline) {
        failures.push(`${day}: could not resolve outline "${outlineValue}"`);
        continue;
    }
    if (outline) outlined = true;

    // A stroke the same colour as the fill would separate nothing.
    if (outline) {
        const edge = contrastRatio(fg, outline);
        if (edge < LARGE_TEXT_AA) {
            failures.push(
                `${day} header: fill ${fgValue.trim()} against its own outline ` +
                `${outlineValue} = ${edge.toFixed(2)}:1 — the outline must contrast ` +
                `with the fill to delimit the letterform`
            );
        }
    }

    for (const stopStr of stops) {
        const bg = parseColor(stopStr);
        if (!bg) {
            failures.push(`${day}: could not parse gradient stop "${stopStr}"`);
            continue;
        }

        // Outlined text has two colours facing the background, and the glyph
        // is delimited by whichever one contrasts with it. On the dark bands
        // the white fill does that work and the dark outline is nearly
        // invisible; on Tuesday's yellow it is the other way round. Taking the
        // better of the two is what makes one treatment work across the whole
        // hue wheel — measuring the outline alone would fail Friday's indigo,
        // which is perfectly legible.
        const fillRatio = contrastRatio(fg, bg);
        const edgeRatio = outline ? contrastRatio(outline, bg) : 0;
        const ratio = Math.max(fillRatio, edgeRatio);
        const via = !outline || fillRatio >= edgeRatio ? 'fill' : 'outline';
        const label = via === 'fill' ? fgValue.trim() : `outline ${outlineValue}`;

        const ok = ratio >= LARGE_TEXT_AA;
        rows.push({ day, stop: stopStr, ratio: ratio.toFixed(2), ok, via });
        if (!ok) {
            failures.push(
                `${day} header: ${label} on ${stopStr} = ${ratio.toFixed(2)}:1 ` +
                `(needs ${LARGE_TEXT_AA}:1 for the 28.8px day name)`
            );
        } else if (ratio < NORMAL_TEXT_AA) {
            warnings.push(
                `${day} header: ${ratio.toFixed(2)}:1 on ${stopStr} — clears the ` +
                `${LARGE_TEXT_AA}:1 bar for the day name but not ${NORMAL_TEXT_AA}:1 ` +
                `for the 14px date beside it`
            );
        }
    }
}

if (!rows.length) {
    console.error('FAIL  no day-header gradients found — did the selectors change?');
    process.exit(1);
}

console.log(`Day header contrast (WCAG AA large text, >= ${LARGE_TEXT_AA}:1)`);
if (outlined) {
    console.log('Text is outlined — measuring whichever of the glyph\'s two colours');
    console.log('(white fill / dark outline) contrasts better with each band.');
}
console.log('');
for (const r of rows) {
    const via = r.via ? `  (via ${r.via})` : '';
    console.log(`  ${r.ok ? 'OK  ' : 'FAIL'}  ${r.day.padEnd(10)} ${String(r.stop).padEnd(22)} ${String(r.ratio).padStart(5)}:1${via}`);
}

if (warnings.length) {
    console.log(`\n=== ${warnings.length} warning(s) — not fatal ===`);
    for (const w of warnings) console.log(`- ${w}`);
}

if (failures.length) {
    console.error(`\n=== ${failures.length} contrast failure(s) ===`);
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
}

console.log(`\n${rows.length} pairs checked against the ${LARGE_TEXT_AA}:1 gate, all pass.`);
