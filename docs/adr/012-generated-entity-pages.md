# ADR-012: Adopt a build step to generate static entity pages

**Status:** Accepted
**Date:** 2026-08-02
**Issue:** [#174](https://github.com/Johnesco/karaokedirectory/issues/174)
**Depends on:** [ADR-010](010-static-on-netlify-only-constraint.md) (a build step is permitted) · [ADR-011](011-entity-link-contract.md) (what a URL means)

## Context

The directory publishes **four URLs** while holding ~80 venues, 24 KJs, and 18 companies. Those entities are the entire SEO surface — "karaoke at [venue]", "[KJ] karaoke austin" — and none of them were addressable.

[ADR-011](011-entity-link-contract.md) settled *what* an entity URL means. It deliberately left open *how* such a page reaches a crawler. That is this decision.

### Why client-side rendering is not sufficient

Google executes JavaScript and would eventually index a client-rendered route. That is not the binding constraint.

**Facebook, Slack, iMessage, LinkedIn, WhatsApp and Bluesky do not execute JavaScript at all.** They read the HTML as served. A `<title>`, `description`, `og:image` or JSON-LD written by JS after load does not exist as far as any of them are concerned.

Sharing a venue link in a group chat is the single most plausible way this directory spreads. Client-rendered metadata makes every one of those shares a blank card. That alone decides it.

Two supporting reasons:

- **~116 pages cannot be hand-authored.** They have to be generated from `js/data.json` or they will drift from it, which is the failure mode this whole tune-up has been unwinding.
- **A hand-maintained `sitemap.xml` had already drifted** — 4 URLs, last touched when the site had a different shape.

## Decision

**Generate static entity pages at deploy time from `js/data.json`.**

- `scripts/build-pages.js` reads the canonical data and emits `/<type>/<id>/index.html` for `venue`, `kj`, and `company`, plus a regenerated `sitemap.xml`.
- Netlify runs it as the build command. Output is **gitignored** — the repo stays the source, and generated pages exist only in the deploy.
- The script is dependency-free, synchronous, and ~350 lines. It is a file emitter, not a framework.

### What each page contains

Real content, not a stub: address and schedule for a venue; the venues and nights for a KJ or company. Plus its own `<title>`, description, canonical, Open Graph and Twitter tags, and a JSON-LD node whose `@id` is the page's canonical URL — `BarOrPub`, `Person`, `Organization` respectively.

Pages **cross-link**: a venue lists the KJs and companies hosting there, each linking back to the venues they play. This is the cross-linking that motivated ADR-011, and it now exists as a side effect of generating the pages rather than as separate work.

### What is deliberately not generated

- **`/tag/` pages.** Two tag ids (`21+`, `18+`) are not URL-safe, and 5 of 19 tags cover two or fewer venues. Blocked on the slug decision in [#170](https://github.com/Johnesco/karaokedirectory/issues/170), and thin-content risk regardless.
- **Inactive venues**, and registry entries whose only shows are at inactive venues. One KJ (`shelly-dowdy`) falls in the second category today: referenced in the data, so `validate-data.js` does not warn, but with nothing public to show. A page would be empty.

### Failure mode

If the build fails, Netlify fails the deploy and the previous version stays live. The site is never published without its entity pages, and never publishes a half-generated set.

## Consequences

### Positive

- **Share cards work.** The reason this decision was forced.
- **The sitemap went from 4 URLs to 120**, and can no longer drift — it is derived from the same file the site reads.
- **Cross-linking shipped with it**, rather than as a separate project.
- **The Armando collision is unrepresentable here.** `/kj/armando/` is built from the registry id, so it cannot pick up `kj-armando-and-paola`'s venue the way `?kj=Armando` does.
- **JSON-LD arrives with correct `@id` values**, which is what [#164](https://github.com/Johnesco/karaokedirectory/issues/164) wanted and could not have had without stable entity URLs.

### Negative

- **This is the project's first build step.** ADR-002's "edit a file, refresh the browser" property is now partly gone: entity pages require `npm run build` to see locally. The SPA itself is unaffected — `index.html` still runs with no build.
- **A second rendering path exists.** The SPA renders venue detail one way; the generated page renders it another. They can diverge. Mitigated by both reading `js/data.json` and by unit tests over the generator, but it is a real seam and should be watched — arguably the generator should eventually consume `js/utils/render.js` rather than reimplement.
- **Netlify build minutes are now consumed** on every deploy. Trivial at this size.

### Neutral

- **`sitemap.xml` is no longer tracked in git.** It became a build artifact; keeping a committed copy would have meant two sources of truth for the same list.

## Alternatives considered

- **Netlify prerendering.** Netlify can serve a pre-rendered snapshot to bots. Rejected: it is a legacy feature, it renders on demand rather than at build time, and it does nothing for the ~116 URLs that do not exist in the first place. Prerendering solves "this page is not visible to a crawler"; the problem here is "this page does not exist."
- **Client-side routing plus JS-injected meta tags.** Rejected on the social-scraper argument above. No amount of client-side work produces an `og:image` for Slack.
- **Hand-author the pages.** Rejected at 116 and growing, and it reintroduces exactly the data/doc drift this program has been removing.
- **A static-site generator (Eleventy, Astro).** Genuinely reasonable now that ADR-010 permits it, and would bring templating and asset handling for free. Rejected *for this step* because it is a large dependency and a new authoring model for a job a 350-line script does with zero dependencies. Worth revisiting if generation grows — that is a real revisit trigger, not a polite gesture.

## Related work

- **#174** — the SEO spike this decision closes out
- **#164** — JSON-LD, now shipped for entity pages; the SPA's own pages are still uncovered
- **#163** — brand assets; `og:image` is still missing, so share cards will render without artwork until it lands
- **#170** — cities registry and the tag-slug fix, which unblocks `/tag/`
- **#155 / #156** — router and view registry; the SPA still owns `?kj=`, and reconciling it with these paths is their work
