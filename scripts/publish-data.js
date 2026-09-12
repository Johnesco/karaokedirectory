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
 *   2. curator:check against it, three-way against our last publish, so an
 *      ordinary edit is informational and only someone else's work is fatal
 *   3. validate-data.js on the file we are about to publish
 *   4. nothing to do? say so and stop
 *   5. branch, commit the one file, open the PR
 *   6. remember what we published, as the base for next time
 *
 * Usage:
 *   node scripts/publish-data.js [--dry-run] [--export <file>] [--master <file>]
 *                                [--branch <name>] [--repo owner/name]
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
        else if (a === '--export') out.exportFile = argv[++i];
        else if (a === '--master') out.master = argv[++i];
        else if (a === '--branch') out.branch = argv[++i];
        else if (a === '--repo') out.repo = argv[++i];
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

/**
 * What this publish changes, in the terms the owner thinks in: venues added,
 * removed or edited, and shows newly confirmed. Pure, so it is unit-testable.
 */
function summarizeDiff(before, after) {
    const b = new Map((before.listings || []).map((v) => [v.id, v]));
    const a = new Map((after.listings || []).map((v) => [v.id, v]));
    const added = [];
    const removed = [];
    const edited = [];
    const confirmed = [];

    for (const [id, av] of a) {
        const bv = b.get(id);
        if (!bv) { added.push(av.name || id); continue; }

        // Confirmations first: they are the common case and deserve their own line.
        const bNights = new Map((bv.schedule || []).map((s, i) => [i, s.lastVerified || '']));
        (av.schedule || []).forEach((s, i) => {
            const was = bNights.get(i) || '';
            if ((s.lastVerified || '') !== was && s.lastVerified) {
                confirmed.push(`${av.name || id} \u2014 ${s.frequency === 'once' ? s.date : (s.frequency + ' ' + s.day)} \u2192 ${s.lastVerified}`);
            }
        });

        // Anything else about the venue that moved.
        const keys = new Set([...Object.keys(bv), ...Object.keys(av)]);
        for (const k of keys) {
            if (k === 'schedule') continue;
            if (canon(bv[k]) !== canon(av[k])) { edited.push(av.name || id); break; }
        }
        // A schedule change that is not just a confirmation.
        const strip = (arr) => (arr || []).map((s) => { const c = { ...s }; delete c.lastVerified; return canon(c); });
        if (canon(strip(bv.schedule)) !== canon(strip(av.schedule)) && !edited.includes(av.name || id)) {
            edited.push(av.name || id);
        }
    }
    for (const [id, bv] of b) if (!a.has(id)) removed.push(bv.name || id);

    return { added, removed, edited, confirmed };
}

function prTitle(sum, now = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
    const bits = [];
    if (sum.confirmed.length) bits.push(`${sum.confirmed.length} show${sum.confirmed.length === 1 ? '' : 's'} confirmed`);
    if (sum.added.length) bits.push(`${sum.added.length} venue${sum.added.length === 1 ? '' : 's'} added`);
    if (sum.removed.length) bits.push(`${sum.removed.length} removed`);
    if (sum.edited.length) bits.push(`${sum.edited.length} edited`);
    return `Curator publish ${stamp}${bits.length ? ' \u2014 ' + bits.join(', ') : ''}`;
}

function prBody(sum, pending) {
    const lines = ['Routine data publish from the curator.', ''];
    const section = (title, items) => {
        if (!items.length) return;
        lines.push(`**${title}**`, '');
        items.slice(0, 40).forEach((i) => lines.push(`- ${i}`));
        if (items.length > 40) lines.push(`- \u2026and ${items.length - 40} more`);
        lines.push('');
    };
    section('Shows confirmed', sum.confirmed);
    section('Venues added', sum.added);
    section('Venues edited', sum.edited);
    section('Venues removed', sum.removed);
    if (pending && pending.length) {
        lines.push('<details><summary>curator:check detail</summary>', '');
        pending.slice(0, 60).forEach((l) => lines.push(`- ${l}`));
        lines.push('', '</details>', '');
    }
    lines.push(
        '---',
        '',
        'No ticket by design: publishing venue data is daily operation, not development',
        '(see CLAUDE.md, "Project-specific deviations"). `validate-data.js` and',
        '`check-curator-drift.js` both passed before this was opened. Netlify deploys on merge.',
    );
    return lines.join('\n');
}

// ---------------------------------------------------------------- main

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log('Usage: node scripts/publish-data.js [--dry-run] [--export <file>] [--master <file>] [--branch <name>] [--repo owner/name]');
        return 0;
    }

    const exportFile = args.exportFile || path.join(CURATOR_DIR, 'last-export.json');
    const master = args.master || path.join(CURATOR_DIR, 'data-curated.js');
    const basePath = path.join(path.dirname(master), 'last-published.json');

    console.log('=== Publish venue data ===');
    if (!fs.existsSync(exportFile)) {
        console.error(`Nothing to publish: ${exportFile} does not exist.`);
        console.error('Press Export in the curator first \u2014 that writes the file this publishes.');
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

    // ---- 2. drift, against main and our last publish -----------------------
    const drift = spawnSync(process.execPath, [path.join(__dirname, 'check-curator-drift.js'), master], {
        encoding: 'utf8',
        env: { ...process.env, REPO_DATA: mainFile, CURATOR_BASE: basePath },
    });
    process.stdout.write(drift.stdout || '');
    if (drift.status !== 0) {
        console.error('\nPublish stopped: the live site holds content this export would destroy (above).');
        console.error('Someone changed js/data.json since your last publish. Reconcile, then try again.');
        return 1;
    }
    const pending = (drift.stdout || '').split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2));

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

    const sum = summarizeDiff(mainJson, exported);
    const title = prTitle(sum);
    const body = prBody(sum, pending);

    console.log('');
    if (sum.confirmed.length) console.log(`shows confirmed: ${sum.confirmed.length}`);
    if (sum.added.length) console.log(`venues added:    ${sum.added.join(', ')}`);
    if (sum.edited.length) console.log(`venues edited:   ${sum.edited.join(', ')}`);
    if (sum.removed.length) console.log(`venues removed:  ${sum.removed.join(', ')}`);

    let branch = args.branch || branchName();

    if (args.dryRun) {
        console.log('\n--- dry run, nothing created ---');
        console.log(`branch: ${branch}`);
        console.log(`title:  ${title}`);
        console.log('body:');
        console.log(body);
        return 0;
    }

    // ---- 5. branch, commit, PR ---------------------------------------------
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

        // ---- 6. remember what we published ---------------------------------
        fs.writeFileSync(basePath, content);

        console.log('\nOpened a pull request. CI runs for a few minutes, then merge it:');
        console.log(`PR: ${url}`);
        return 0;
    } catch (err) {
        console.error(`\nPublish failed: ${err.message}`);
        return 1;
    } finally {
        try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
    }
}

module.exports = { summarizeDiff, prTitle, prBody, branchName, parseArgs };

if (require.main === module) process.exit(main());
