# ADR-003: GitHub Pages as deploy target

- **Status:** Accepted
- **Date:** 2026-04-30 (backfilled — first deploy went live mid-April 2026)
- **Issue:** [#56](https://github.com/Johnesco/karaokedirectory/issues/56) (backfill)
- **Related:** [ADR-002](002-vanilla-js-no-build.md) — vanilla JS / no build step

## Context

The site is a static SPA (see [ADR-002](002-vanilla-js-no-build.md)) — all assets are hand-authored HTML, CSS, JS, and images checked into the repo. We need a host that:

- Serves arbitrary static files
- Costs nothing for the current scale (single curator, hobby project)
- Deploys from GitHub on push (no separate CI/CD to maintain)
- Supports a custom domain if/when we get one
- Has reasonable uptime and CDN performance

Constraints:
- The repo is already on GitHub, so any host that pulls from GitHub is friction-free
- No SSR, no edge functions, no API routes needed in v1
- Solo developer — fewer moving pieces wins

## Decision

**GitHub Pages**, deploying from `main` branch root (`/`). Enabled via `gh api -X POST repos/Johnesco/karaokedirectory/pages -f "source[branch]=main" -f "source[path]=/"`. Site is available at `https://johnesco.github.io/karaokedirectory/`.

No GitHub Actions workflow — Pages' built-in Jekyll-free static serving handles the repo as-is. Push to `main` → Pages rebuilds in ~30 seconds → live.

## Consequences

**Positive**
- **Zero deploy config.** No `vercel.json`, no `netlify.toml`, no GitHub Actions workflow. The site is whatever's at the root of `main`.
- **Free.** No billing surface area.
- **Native to the repo.** Same auth, same permissions, same dashboard as the issues and project board.
- **Push-to-deploy** without a CI/CD round-trip — Pages picks up the commit directly.
- **Custom domain support** when needed: add a `CNAME` file, configure DNS, done.
- **HTTPS automatic** with the default `*.github.io` domain.
- **Bot-friendly URLs** for the directory's audience (search engines index static HTML happily).

**Negative / accepted tradeoffs**
- **No serverless functions.** If we ever need an API endpoint (form submission backend, contact form), we'd need a second host or a third-party service. Mitigated: form submissions go to email/Formspree-style services without us hosting code.
- **No edge logic.** Can't do A/B tests, geographic redirects, or auth at the edge. Not currently needed.
- **No build step option** (without setting up Actions). If we ever need a bundler, we'd add a workflow — small cost.
- **Pages-specific quirks:** `.nojekyll` required to serve files starting with `_` (we use it for `docs/.nojekyll`). Path-prefix awareness needed in URLs (the site lives under `/karaokedirectory/`, not the domain root) until we get a custom domain.
- **No instant rollback.** Reverting requires a new commit. Mitigated by small commit cadence.
- **Tied to GitHub.** If GitHub goes away or changes the offering, we'd migrate. Risk is low.

**Future revisit triggers**
- Need server-side logic (form processing, auth, dynamic data) → consider Cloudflare Pages + Workers, Netlify, or Vercel.
- Custom domain pricing/DNS friction with Pages becomes annoying → reconsider.
- Pages outage history degrades — not currently a problem, but a year of reliability data would inform a switch.
- Build step required for a future feature → either Actions deploy from `gh-pages`, or migrate to a host with native build support.

## Options considered

### Option A — Cloudflare Pages (rejected)

Free, fast CDN, optional Workers for edge logic, generous limits.

Rejected because:
- Adds a second account/dashboard to manage.
- Workers we don't need yet are the main differentiator; without them, it's parity with Pages plus complexity.
- Domain-prefix-clean URLs are nice but not worth the migration cost from a simpler default.

### Option B — Netlify (rejected)

Free tier, good DX, drag-and-drop deploys, native form handling, built-in identity if we ever need auth.

Rejected because:
- Form handling and identity are features we don't need yet — paying for them in account complexity now is premature.
- Build minutes are a meter we'd have to watch.
- Pages-specific quirks of GitHub Pages are smaller than the cumulative quirks of an additional service.

### Option C — Vercel (rejected)

Excellent DX, fastest network, deep integration with Next.js.

Rejected because:
- Heavily optimized for frameworks we don't use ([ADR-002](002-vanilla-js-no-build.md)).
- Free tier has commercial-use restrictions worth being cautious about even for hobby projects.
- Solving framework problems we don't have.

### Option D — Self-hosted (rejected)

VPS + nginx, full control.

Rejected because:
- Ongoing maintenance, OS patches, TLS renewal, monitoring — none of which serve the directory's mission.
- Costs money.
- Contradicts the "minimum moving parts" philosophy.

### Option E — GitHub Pages (accepted)

What we picked. Enough host for a static SPA with zero deploy config and no second account to manage.

## Rejected sub-decisions

- **Deploy from a `gh-pages` branch instead of `main` root:** considered; rejected because it adds a manual sync step (or a workflow) for no benefit when the entire repo is already deployable.
- **Set up a GitHub Actions deploy workflow:** rejected; Pages' default direct-from-branch serving covers our needs. We'd add Actions only if we needed a build step.
- **Use a custom domain on day one:** deferred; the `johnesco.github.io/karaokedirectory/` URL works. Custom domain is a low-cost migration when we want it.

## Implementation notes

- **Enabled via REST:** `gh api -X POST repos/Johnesco/karaokedirectory/pages -f "source[branch]=main" -f "source[path]=/"`.
- **Build status check:** `gh api repos/Johnesco/karaokedirectory/pages/builds/latest`.
- **`.nojekyll`:** placed in `docs/` so Docsify-served files starting with `_` (`_sidebar.md`) are not stripped by Jekyll's default rules.
- **Site root:** `index.html` at repo root; supplementary pages (`about.html`, `submit.html`, `bingo.html`, `editor.html`) also at root.
- **Path-prefix awareness:** internal links use relative paths (no leading `/`) so they resolve correctly under `/karaokedirectory/` and would also work under a future custom domain.
