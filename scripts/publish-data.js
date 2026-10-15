#!/usr/bin/env node
/**
 * Publish the curator's export to the live site (#277).
 *
 * Publishing venue data is daily operation, not development: no ticket, no
 * branch to name, no Claude session. This runs the gates, opens a pull
 * request, and prints its URL. A human merges it; Netlify deploys from main.
 *
 * It works against GitHub, not the local checkout, and that is deliberate:
 * the checkout may be mid-feature, on another branch, or dirty, and a routine
 * data publish has no business touching it. So it reads what `main` actually
 * holds, compares against that, and writes the new file through the API.
 *
 * The sequence:
 *   1. fetch js/data.json from main
 *   2. one writer (ADR-018, #336): main must be what we last published, unless a
 *      data PR is still merging — otherwise someone changed it outside the curator
 *   3. validate-data.js on the file we are about to publish
 *   4. nothing to do? say so and stop
 *   5. a data PR still open? commit to its branch and rewrite its description
 *      (#334: one PR, another commit). Otherwise branch, commit the one file,
 *      open the PR, and turn on auto-merge so it merges itself once CI is green
 *      (#338) — branch protection still holds
 *   6. remember what we published, so the next run (and the curator) can tell
 *
 * The description groups what changed against main the way the owner reads it
 * (#334): confirmed, changed, added, ended, removed, edited.
 *
 * Usage:
 *   node scripts/publish-data.js [--dry-run] [--export <file>] [--branch <name>]
 *                                [--repo owner/name] [--no-auto-merge]
 *
 * --export defaults to the curator's data.json (#331). --master and
 * --adopt-baseline are accepted and ignored, for curators older than #336.
 *
 * `gh` must be installed and authenticated. It is found on PATH, via GH_PATH,
 * or at the usual Windows location.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CURATOR_DIR = path.join(os.homedir(), 'karaoke-curator');

// ---------------------------------------------------------------- args

function parseArgs(argv) {
    const out = { dryRun: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--dry-run') out.dryRun = true;
        else if (a === '--no-auto-merge') out.noAutoMerge = true;
        else if (a === '--export') out.exportFile = argv[++i];
        else if (a === '--master') out.master = argv[++i];
        else if (a === '--branch') out.branch = argv[++i];
        else if (a === '--repo') out.repo = argv[++i];
        else if (a === '--adopt-baseline') out.adoptBaseline = true;
        else if (a === '--help' || a === '-h') out.help = true;
    }
    return out;
}

/** A branch name nobody has to think about: the date, plus a suffix if needed. */
function branchName(now = new Date(), suffix = 0) {
    const p = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
    return suffix ? `data/${stamp}-${suffix}` : `data/${stamp}`;
}

// ---------------------------------------------------------------- gh

function findGh() {
    if (process.env.GH_PATH) return process.env.GH_PATH;
    const probe = spawnSync('gh', ['--version'], { encoding: 'utf8', shell: true });
    if (probe.status === 0) return 'gh';
    const win = 'C:\\Program Files\\GitHub CLI\\gh.exe';
    if (fs.existsSync(win)) return win;
    return null;
}

function gh(bin, args, opts = {}) {
    const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
    if (r.error) throw new Error(`${path.basename(bin)} failed to start: ${r.error.message}`);
    if (r.status !== 0) throw new Error(`gh ${args[0]} ${args[1] || ''} failed:\n${(r.stderr || r.stdout || '').trim()}`);
    return r.stdout;
}

// ---------------------------------------------------------------- diffing

const canon = (v) => JSON.stringify(v === undefined ? null : v);

// ---- describing a show, the way the owner reads one -------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Nov 6" from "2026-11-06". */
function shortDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${MONTHS[parseInt(m[2], 10) - 1]} ${parseInt(m[3], 10)}` : String(iso || '');
}
/** "9 PM", "8:30 PM" from "21:00", "20:30". */
function time12(t) {
    const m = /^(\d{2}):(\d{2})$/.exec(t || '');
    if (!m) return '';
    const h = parseInt(m[1], 10);
    return `${(h % 12) || 12}${m[2] === '00' ? '' : ':' + m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}
/** "Every Friday", "Second Saturday", "One-time Oct 31 (Halloween Bash)". */
function whenOf(s) {
    if (s.frequency === 'once') return `One-time ${shortDate(s.date)}${s.eventName ? ` (${s.eventName})` : ''}`;
    const f = String(s.frequency || '');
    return `${f.charAt(0).toUpperCase()}${f.slice(1)} ${s.day || '?'}`;
}
function showName(s) {
    const t = time12(s.startTime);
    return t ? `${whenOf(s)} ${t}` : whenOf(s);
}
/** A host ref by its registry names: "Xpider Cantu \u00b7 Starling Karaoke". */
function hostName(h, data) {
    if (!h) return 'the venue\'s host';
    const bits = [];
    if (h.kjId) bits.push(((data.kjs || {})[h.kjId] || {}).name || h.kjId);
    if (h.companyId) bits.push(((data.companies || {})[h.companyId] || {}).name || h.companyId);
    if (h.name) bits.push(h.name);
    return bits.join(' \u00b7 ') || 'no host';
}

/** What changed about a show, as "Every Friday \u2192 Every Thursday; 9 PM \u2192 8 PM". */
function describeShowChange(b, a, data, { withStart = true } = {}) {
    const parts = [];
    if (whenOf(b) !== whenOf(a)) parts.push(`${whenOf(b)} \u2192 ${whenOf(a)}`);
    if ((b.startTime || '') !== (a.startTime || '') || (b.endTime || '') !== (a.endTime || '')) {
        const span = (s) => [time12(s.startTime), time12(s.endTime)].filter(Boolean).join('\u2013');
        parts.push(`${span(b)} \u2192 ${span(a)}`);
    }
    if (canon(b.host) !== canon(a.host)) parts.push(`host ${hostName(b.host, data)} \u2192 ${hostName(a.host, data)}`);
    if ((b.eventUrl || '') !== (a.eventUrl || '')) parts.push(a.eventUrl ? 'event link updated' : 'event link removed');
    if (withStart && (b.activePeriod || {}).start !== (a.activePeriod || {}).start && (a.activePeriod || {}).start) parts.push(`first night ${shortDate(a.activePeriod.start)}`);
    return parts.join('; ');
}

// ---- lining up a venue's shows before and after ------------------------------

// What a show IS, as opposed to what has been said about it lately. Two
// entries with the same identity are the same show; a correction changes its
// identity, a confirmation, an ending, a night off or a placement do not.
const VOLATILE = new Set(['lastVerified', 'changed', 'activePeriod', 'exclusions', 'featured', 'eventUrl', 'socials']);
function identity(s) {
    const c = {};
    for (const k of Object.keys(s || {}).sort()) if (!VOLATILE.has(k)) c[k] = s[k];
    return canon(c);
}

/**
 * Pair a venue's schedule entries across a publish. Entries whose identity is
 * unchanged line up first (longest common subsequence, so order is kept);
 * what is left between two anchors is paired in order, as an edit in place \u2014
 * except an entry that is plainly new (a fresh `created`, or a Split's copy:
 * `changed` with a first night), which never stands in for an old one.
 * Returns { pairs: [[b, a]], added: [a], removed: [b] }.
 */
function matchShows(before, after) {
    const B = before || [], A = after || [];
    const kb = B.map(identity), ka = A.map(identity);
    const L = Array.from({ length: B.length + 1 }, () => new Array(A.length + 1).fill(0));
    for (let i = B.length - 1; i >= 0; i -= 1) {
        for (let j = A.length - 1; j >= 0; j -= 1) {
            L[i][j] = kb[i] === ka[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
        }
    }
    const anchors = [];
    for (let i = 0, j = 0; i < B.length && j < A.length;) {
        if (kb[i] === ka[j]) { anchors.push([i, j]); i += 1; j += 1; }
        else if (L[i + 1][j] >= L[i][j + 1]) i += 1;
        else j += 1;
    }
    const pairs = [], added = [], removed = [];
    const plainlyNew = (a, b) => (a.created && a.created !== b.created)
        || (a.changed && (a.activePeriod || {}).start && (a.activePeriod || {}).start !== (b.activePeriod || {}).start);
    let pi = 0, pj = 0;
    for (const [ai, aj] of [...anchors, [B.length, A.length]]) {
        const gapB = B.slice(pi, ai), gapA = A.slice(pj, aj);
        let k = 0;
        for (const a of gapA) {
            if (k < gapB.length && !plainlyNew(a, gapB[k])) { pairs.push([gapB[k], a]); k += 1; }
            else added.push(a);
        }
        for (; k < gapB.length; k += 1) removed.push(gapB[k]);
        if (ai < B.length) pairs.push([B[ai], A[aj]]);
        pi = ai + 1; pj = aj + 1;
    }
    return { pairs, added, removed };
}

function addDays(iso, n) {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

/**
 * What this publish changes, in the terms the owner thinks in (#334):
 *   confirmed  a show's lastVerified moved later
 *   changed    a correction (`changed` moved) or a change on a date (a new
 *              entry carrying `changed`, usually a Split)
 *   added      a new venue, or a new show
 *   ended      a show given a last night (activePeriod.end)
 *   removed    a venue or show taken out (pruned)
 *   edited     anything else: venue facts, nights off, placements, links
 * One show can appear in two groups (confirmed AND ended, say). Pure, so it is
 * unit-tested; `after` also supplies the registry names for hosts.
 */
function summarizeDiff(before, after) {
    const b = new Map((before.listings || []).map((v) => [v.id, v]));
    const a = new Map((after.listings || []).map((v) => [v.id, v]));
    const sum = { confirmed: [], changed: [], added: [], ended: [], removed: [], edited: [] };

    for (const [id, av] of a) {
        const name = av.name || id;
        const bv = b.get(id);
        if (!bv) {
            const n = (av.schedule || []).length;
            sum.added.push(`${name} (new venue${n ? `, ${n} show${n === 1 ? '' : 's'}: ${(av.schedule || []).map(showName).join(', ')}` : ''})`);
            continue;
        }

        const { pairs, added, removed } = matchShows(bv.schedule, av.schedule);
        for (const [bs, as] of pairs) {
            // Named as main knows it: the changed line says what it became.
            const label = `${name}, ${showName(bs)}`;
            if ((as.lastVerified || '') > (bs.lastVerified || '')) sum.confirmed.push(`${label} \u2192 ${shortDate(as.lastVerified)}`);
            const endA = (as.activePeriod || {}).end, endB = (bs.activePeriod || {}).end;
            if (endA && endA !== endB) sum.ended.push(`${name}, ${showName(bs)} \u2014 last night ${shortDate(endA)}`);
            if (as.changed && as.changed !== bs.changed) {
                const what = describeShowChange(bs, as, after);
                sum.changed.push(`${name}, ${showName(bs)}${what ? ` \u2014 ${what}` : ' \u2014 corrected'}`);
            }
            // Whatever else moved, by field name. The groups above own their fields.
            const rest = [];
            const keys = new Set([...Object.keys(bs), ...Object.keys(as)]);
            for (const k of keys) {
                if (['lastVerified', 'changed'].includes(k)) continue;
                if (k === 'activePeriod' && canon({ ...bs.activePeriod, end: undefined }) === canon({ ...as.activePeriod, end: undefined })) continue;
                if (as.changed && as.changed !== bs.changed && !['exclusions', 'featured'].includes(k)) continue;   // the change line says it
                if (canon(bs[k]) !== canon(as[k])) rest.push(k === 'exclusions' ? 'nights off' : k === 'featured' ? 'placement' : k);
            }
            if (rest.length) sum.edited.push(`${label} \u2014 ${rest.join(', ')}`);
        }
        for (const as of added) {
            // A change on a date (a Split): a new entry carrying `changed`, whose
            // predecessor ends the night before it starts. Anything else that is
            // new here — `created`, or nothing at all — is an addition, even if
            // it was corrected before it was ever published.
            const start = (as.activePeriod || {}).start;
            const prev = as.changed && start && (av.schedule || []).find((s) => s !== as && (s.activePeriod || {}).end === addDays(start, -1));
            if (prev) {
                const what = describeShowChange(prev, as, after, { withStart: false });   // "from …" says the start
                sum.changed.push(`${name}, ${showName(prev)} \u2014 ${what || showName(as)} from ${shortDate(start)}`);
            } else if (as.changed && !as.created) {
                sum.changed.push(`${name}, ${showName(as)}${start ? ` from ${shortDate(start)}` : ''}`);
            } else {
                sum.added.push(`${name}, ${showName(as)}`);
            }
        }
        for (const bs of removed) sum.removed.push(`${name}, ${showName(bs)}`);

        // Venue facts.
        const facts = [];
        const keys = new Set([...Object.keys(bv), ...Object.keys(av)]);
        for (const k of keys) if (k !== 'schedule' && canon(bv[k]) !== canon(av[k])) facts.push(k);
        if (facts.length) sum.edited.push(`${name} \u2014 ${facts.join(', ')}`);
    }
    for (const [id, bv] of b) if (!a.has(id)) sum.removed.push(`${bv.name || id} (venue)`);

    // The shared records shows point at.
    for (const k of ['kjs', 'companies', 'cities', 'tagDefinitions']) {
        if (canon(before[k] || {}) !== canon(after[k] || {})) sum.edited.push(`${k} registry`);
    }
    return sum;
}

const GROUPS = [
    ['confirmed', 'Confirmed', 'confirmed'],
    ['changed', 'Changed', 'changed'],
    ['added', 'Added', 'added'],
    ['ended', 'Ended', 'ended'],
    ['removed', 'Removed', 'removed'],
    ['edited', 'Edited', 'edited'],
];

function prTitle(sum, now = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
    const bits = GROUPS.filter(([k]) => (sum[k] || []).length).map(([k, , word]) => `${sum[k].length} ${word}`);
    return `Curator publish ${stamp}${bits.length ? ' \u2014 ' + bits.join(', ') : ''}`;
}

function prBody(sum) {
    const lines = ['Routine data publish from the curator.', ''];
    const section = (title, items) => {
        if (!items || !items.length) return;
        lines.push(`**${title} (${items.length})**`, '');
        items.slice(0, 40).forEach((i) => lines.push(`- ${i}`));
        if (items.length > 40) lines.push(`- \u2026and ${items.length - 40} more`);
        lines.push('');
    };
    for (const [k, title] of GROUPS) section(title, sum[k]);
    lines.push(
        '---',
        '',
        'No ticket by design: publishing venue data is daily operation, not development',
        '(see CLAUDE.md, "Project-specific deviations"). `validate-data.js` passed, and',
        'main held what the curator last published, before this was opened. It merges',
        'itself once CI is green; Netlify deploys on merge.',
    );
    return lines.join('\n');
}

/**
 * One writer (ADR-018, #336): may we publish over what main holds?
 *
 * Only the curator changes the venue data, so main should hold exactly what it
 * last published. Two exceptions are normal: no record yet (nothing to compare),
 * and a data PR still merging (main has not caught up). Anything else means
 * someone changed js/data.json outside the curator — publishing would silently
 * overwrite it, so refuse; the curator's one offer is "take main's data".
 * Pure, so it is unit-tested.
 * @param {{ base: object|null, main: object, inFlight: boolean }} p
 * @returns {'ok'|'no-base'|'in-flight'|'refuse'}
 */
function mainGuard({ base, main, inFlight }) {
    if (!base) return 'no-base';
    if (canon(base) === canon(main)) return 'ok';
    return inFlight ? 'in-flight' : 'refuse';
}

// ---------------------------------------------------------------- main

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log('Usage: node scripts/publish-data.js [--dry-run] [--export <file>] [--branch <name>] [--repo owner/name] [--no-auto-merge]');
        return 0;
    }

    // The curator's data.json is the public file (#331); the record of the last
    // publish sits beside it, where the curator's own main-check reads it.
    const exportFile = args.exportFile || path.join(CURATOR_DIR, 'data.json');
    const basePath = path.join(path.dirname(exportFile), 'last-published.json');

    console.log('=== Publish venue data ===');
    if (!fs.existsSync(exportFile)) {
        console.error(`Nothing to publish: ${exportFile} does not exist.`);
        console.error('Save in the curator first \u2014 that writes the file this publishes.');
        return 1;
    }

    let exported;
    try { exported = JSON.parse(fs.readFileSync(exportFile, 'utf8')); }
    catch (err) { console.error(`Cannot read the export: ${err.message}`); return 1; }

    const bin = findGh();
    if (!bin) {
        console.error('The GitHub CLI (gh) was not found. Install it, or set GH_PATH to its full path.');
        return 1;
    }

    // `gh repo view` reads the checkout's remote, which is usually enough. A
    // clone made from a local path has no GitHub remote, so fall back to
    // parsing one, and then to being told.
    const repo = args.repo || (() => {
        try { return JSON.parse(gh(bin, ['repo', 'view', '--json', 'nameWithOwner'])).nameWithOwner; }
        catch { /* fall through */ }
        try {
            const r = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT, encoding: 'utf8' });
            const m = (r.stdout || '').match(/github\.com[:/]([^/]+\/[^/\s.]+)/);
            return m ? m[1] : null;
        } catch { return null; }
    })();
    if (!repo) { console.error('Could not work out the repository. Pass --repo owner/name.'); return 1; }
    console.log(`repo:   ${repo}`);
    console.log(`export: ${exportFile}`);

    // ---- 1. what main actually holds --------------------------------------
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kd-publish-'));
    const mainFile = path.join(tmp, 'main-data.json');
    let mainJson;
    try {
        const meta = JSON.parse(gh(bin, ['api', `repos/${repo}/contents/js/data.json?ref=main`]));
        fs.writeFileSync(mainFile, Buffer.from(meta.content, 'base64'));
        mainJson = JSON.parse(fs.readFileSync(mainFile, 'utf8'));
    } catch (err) {
        console.error(`Could not read js/data.json from main: ${err.message}`);
        return 1;
    }

    // ---- 2. one writer: main is what we last published (ADR-018, #336) ------
    let base = null;
    try { if (fs.existsSync(basePath)) base = JSON.parse(fs.readFileSync(basePath, 'utf8')); }
    catch (err) { console.error(`Cannot read ${basePath}: ${err.message}`); return 1; }
    // An open data PR (#334): a publish before it merges adds to it instead of
    // opening a second one. Newest first, should there ever be two.
    let openPr = null;
    try {
        const open = JSON.parse(gh(bin, ['pr', 'list', '--repo', repo, '--state', 'open', '--json', 'number,url,headRefName,createdAt']))
            .filter((p) => /^data\//.test(p.headRefName))
            .sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
        openPr = open[0] || null;
    } catch { /* unknown: treat as not in flight, which is the stricter answer */ }
    const inFlight = !!openPr;
    const guard = mainGuard({ base, main: mainJson, inFlight });
    if (guard === 'refuse') {
        console.error('\nPublish stopped: js/data.json on main is not what the curator last published.');
        console.error('Someone changed it outside the curator. In the curator, press "Take main\'s data",');
        console.error('redo any edits you still want, and publish again.');
        return 1;
    }
    console.log(guard === 'ok' ? '\nmain holds the last publish: ok'
        : guard === 'in-flight' ? '\nmain has not caught up with an open data PR yet: ok'
        : '\nno record of a previous publish: nothing to compare');

    // ---- 3. the repo's own validator on what we are publishing -------------
    const val = spawnSync(process.execPath, [path.join(__dirname, 'validate-data.js'), exportFile], { encoding: 'utf8' });
    if (val.status !== 0) {
        process.stdout.write(val.stdout || '');
        console.error('\nPublish stopped: the export fails validation (above). Fix it in the curator.');
        return 1;
    }
    console.log('\nvalidate-data.js: passed');

    // ---- 4. anything to do? ------------------------------------------------
    const content = JSON.stringify(exported, null, 2) + '\n';
    if (canon(exported) === canon(mainJson)) {
        console.log('\nNothing to publish \u2014 main already has this data.');
        fs.writeFileSync(basePath, content);
        console.log(`Recorded it as the base for next time: ${basePath}`);
        return 0;
    }

    // The PR's diff is against main, so its summary is too — even when this
    // publish only adds to an open PR.
    const sum = summarizeDiff(mainJson, exported);
    const title = prTitle(sum);
    const body = prBody(sum);

    // What the open data PR already holds: the same file means nothing new.
    let openSha = null;
    if (openPr && !args.branch) {
        try {
            const meta = JSON.parse(gh(bin, ['api', `repos/${repo}/contents/js/data.json?ref=${encodeURIComponent(openPr.headRefName)}`]));
            if (canon(JSON.parse(Buffer.from(meta.content, 'base64').toString('utf8'))) === canon(exported)) {
                console.log(`\nNothing new — the open data PR already has this: ${openPr.url}`);
                fs.writeFileSync(basePath, content);
                return 0;
            }
            openSha = meta.sha;
        } catch { openSha = null; /* gone or unreadable: open a new PR below */ }
    }

    console.log('');
    for (const [k, label] of GROUPS) {
        if (!sum[k].length) continue;
        console.log(`${label} (${sum[k].length}):`);
        sum[k].slice(0, 15).forEach((line) => console.log(`  - ${line}`));
        if (sum[k].length > 15) console.log(`  - …and ${sum[k].length - 15} more`);
    }

    let branch = args.branch || branchName();

    if (args.dryRun) {
        console.log('\n--- dry run, nothing created ---');
        console.log(openSha ? `adds to the open data PR #${openPr.number} (${openPr.headRefName})` : `branch: ${branch}`);
        console.log(`title:  ${title}`);
        console.log('body:');
        console.log(body);
        return 0;
    }

    // ---- 5a. add to the open data PR (#334) ----------------------------------
    // One PR, another commit: the title and description are rewritten to cover
    // everything it now sends. If the PR merged in the meantime, the write fails
    // and a fresh PR is opened below instead.
    if (openSha) {
        try {
            const putBody = path.join(tmp, 'put.json');
            fs.writeFileSync(putBody, JSON.stringify({
                message: `${title}\n\nRoutine data publish from the curator. No ticket by design.`,
                content: Buffer.from(content, 'utf8').toString('base64'),
                branch: openPr.headRefName,
                sha: openSha,
            }));
            gh(bin, ['api', '-X', 'PUT', `repos/${repo}/contents/js/data.json`, '--input', putBody]);
            const bodyFile = path.join(tmp, 'body.md');
            fs.writeFileSync(bodyFile, body);
            gh(bin, ['pr', 'edit', openPr.url, '--repo', repo, '--title', title, '--body-file', bodyFile]);
            let autoMerge = false;
            if (!args.noAutoMerge) {
                try { gh(bin, ['pr', 'merge', openPr.url, '--repo', repo, '--auto', '--merge']); autoMerge = true; }
                catch (err) { console.warn(`\nCould not confirm auto-merge (${err.message.split('\n')[0]}).`); }
            }
            fs.writeFileSync(basePath, content);
            console.log(`\nAdded to the open data PR #${openPr.number} — one PR, another commit.`);
            console.log(autoMerge ? 'Auto-merge is on: it goes live by itself once CI passes.' : 'Merge it once CI passes.');
            console.log(`PR: ${openPr.url}`);
            fs.rmSync(tmp, { recursive: true, force: true });
            return 0;
        } catch (err) {
            console.warn(`\nCould not add to the open data PR (${err.message.split('\n')[0]}); opening a new one.`);
        }
    }

    // ---- 5b. branch, commit, PR ----------------------------------------------
    try {
        const mainSha = JSON.parse(gh(bin, ['api', `repos/${repo}/git/ref/heads/main`])).object.sha;
        for (let i = 0; i < 20; i += 1) {
            const refBody = path.join(tmp, 'ref.json');
            fs.writeFileSync(refBody, JSON.stringify({ ref: `refs/heads/${branch}`, sha: mainSha }));
            try { gh(bin, ['api', '-X', 'POST', `repos/${repo}/git/refs`, '--input', refBody]); break; }
            catch (err) {
                if (!/already exists/i.test(err.message) || args.branch) throw err;
                branch = branchName(new Date(), i + 2);
            }
        }
        console.log(`\nbranch: ${branch}`);

        // The file's blob sha on main, so the API knows what we are replacing.
        const meta = JSON.parse(gh(bin, ['api', `repos/${repo}/contents/js/data.json?ref=main`]));
        const putBody = path.join(tmp, 'put.json');
        // --input, not an argument: 100 KB of base64 blows past the Windows
        // command-line limit.
        fs.writeFileSync(putBody, JSON.stringify({
            message: `${title}\n\nRoutine data publish from the curator. No ticket by design.`,
            content: Buffer.from(content, 'utf8').toString('base64'),
            branch,
            sha: meta.sha,
        }));
        gh(bin, ['api', '-X', 'PUT', `repos/${repo}/contents/js/data.json`, '--input', putBody]);

        const bodyFile = path.join(tmp, 'body.md');
        fs.writeFileSync(bodyFile, body);
        const url = gh(bin, ['pr', 'create', '--repo', repo, '--base', 'main', '--head', branch,
            '--title', title, '--body-file', bodyFile]).trim().split('\n').pop();

        // Auto-merge (#338): the PR merges itself the moment both required
        // checks pass, so a publish needs no trip to GitHub. Protection is
        // unchanged — a red check means it never merges. Best effort: if the
        // repo setting is off or gh refuses, the publish has still succeeded,
        // and the owner merges by hand as before.
        let autoMerge = false;
        if (!args.noAutoMerge) {
            try { gh(bin, ['pr', 'merge', url, '--repo', repo, '--auto', '--merge']); autoMerge = true; }
            catch (err) { console.warn(`\nCould not turn on auto-merge (${err.message.split('\n')[0]}).`); }
        }

        // ---- 6. remember what we published ---------------------------------
        fs.writeFileSync(basePath, content);

        console.log(autoMerge
            ? '\nOpened a pull request with auto-merge on. It goes live by itself once CI passes (a few minutes):'
            : '\nOpened a pull request. CI runs for a few minutes, then merge it:');
        console.log(`PR: ${url}`);
        return 0;
    } catch (err) {
        console.error(`\nPublish failed: ${err.message}`);
        return 1;
    } finally {
        try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
    }
}

module.exports = { summarizeDiff, matchShows, prTitle, prBody, branchName, parseArgs, mainGuard };

if (require.main === module) process.exit(main());
