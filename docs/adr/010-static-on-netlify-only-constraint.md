# ADR-010: Static output on Netlify is the only architectural constraint

**Status:** Accepted
**Date:** 2026-08-02
**Issue:** [#173](https://github.com/Johnesco/karaokedirectory/issues/173)
**Supersedes:** [ADR-002](002-vanilla-js-no-build.md) (vanilla JS, no framework, no build step) · [ADR-003](003-github-pages-deploy.md) (GitHub Pages as deploy target)

## Context

Two constraints have shaped every technical decision in this repo, and both have stopped being true.

**ADR-003 named GitHub Pages as the deploy target and explicitly rejected Netlify** ("Option B — Netlify (rejected)"). Production is served by Netlify and has been for some time:

```
$ curl -sI https://karaokedirectory.com
HTTP/1.1 200 OK
Server: Netlify

$ curl -sI https://www.karaokedirectory.com
HTTP/1.1 301 Moved Permanently
Location: https://karaokedirectory.com/
```

Nothing in the repo recorded the move. The deploy was configured entirely in the Netlify dashboard, invisible to anyone reading the source, and ADR-003 stayed marked Accepted while describing a host the site does not use.

**ADR-002's "no build step" was reasoned from the GitHub Pages constraint** — Pages serves what is in the branch, so a build step meant either committing generated output or adding CI to generate it. That reasoning does not transfer. Netlify runs a build command as a first-class part of deploying, and still serves static files at the end.

The owner has since made the intent explicit: **the one thing to preserve is that the site works on Netlify as a static website.** Everything else that was written down as a limit was a limit inherited from a host we no longer use.

## Decision

**The only architectural constraint is that the deployed artifact is static files served by Netlify.**

Anything that satisfies that is permitted. Specifically now allowed, where previously forbidden:

| Previously forbidden | Now |
|---|---|
| A build step (ADR-002) | Allowed. Netlify runs it; the output is still static |
| A framework or bundler (ADR-002) | Allowed **if it compiles to static output**. Not adopted — see below |
| Entity URLs (`/kj/<slug>`, `/venue/<slug>`) | Allowed. Netlify serves extensionless paths, generated pages, and redirects |
| New user-facing features (tune-up non-goal) | Lifted |

### What is still constrained

- **Static output.** No server runtime, no SSR-at-request-time, no origin database read on page load. Netlify Functions and edge handlers are *not* in scope under this ADR — adding one would need a new decision, because it breaks "static website."
- **Single metro.** Austin-metro remains a fixed frame (affirmed 2026-08-01). This is a product decision, not a hosting one, and it is what keeps a cities registry a small finite file.
- **The Display Philosophy.** All nine principles stand, unchanged. They describe what the directory *is* — neutral, factual, week-shaped, intentionally minimal — and none of them were technical constraints.

### What this does not do

It does not adopt anything. A build step is now *permissible*, not *required*, and this project still has 7 components and ~6,000 lines of app JS — the scale at which ADR-002's reasoning was sound on its own merits, independent of the host. The same applies to frameworks.

The honest summary: **the option space widened; the current stack is still a reasonable choice for it.** Adopting tooling should be its own decision with its own justification, not something that follows automatically from this ADR.

## Consequences

### Positive

- **The repo can describe its own deploy.** A `netlify.toml` lands with this ADR, pinning the current behaviour (publish the repo root, no build command) so it is legible from the source rather than only from a dashboard.
- **The SEO ceiling lifts.** The directory publishes four URLs while holding ~80 venues, 24 KJs, and 19 tags. Entity pages were previously blocked by "no build step"; that blocker is gone. See [#174](https://github.com/Johnesco/karaokedirectory/issues/174).
- **Cross-linking and SEO become one decision instead of two.** Both wanted stable per-entity URLs and both were held up by the same constraint.
- **ADR-002's rejections become re-openable on their merits** rather than foreclosed by hosting. `#24` (Vite), `#42`/`#43` (framework spikes) were closed as non-goals citing ADR-002; if any is revisited, it now needs a real argument rather than a rule.

### Negative

- **"No build step" was a genuinely useful forcing function.** It kept the repo readable, made every file directly inspectable, and meant the served artifact and the source were the same thing. Losing it as a rule means losing that discipline unless it is chosen deliberately. This ADR keeps the current no-build setup precisely so that discipline is not abandoned by default.
- **Netlify is now a named dependency** rather than "any static host." Portability is reduced in exchange for the redirects, previews, and pretty URLs already being relied on.

### Neutral

- **Deploy previews on every PR** already work and are already relied on for verification. This ADR just makes that legitimate rather than accidental.

## Alternatives considered

- **Correct ADR-003 to Netlify and leave ADR-002 alone.** Minimal and accurate, but leaves "no build step" in force — which is the constraint that actually blocks entity URLs, and which only ever existed because of Pages. Rejected as half the fix.
- **Lift every documented limit, including single-metro and the Display Philosophy.** Rejected on the owner's direction: those are product decisions and stay. Only constraints inherited from the hosting choice were lifted.
- **Allow Netlify Functions / edge handlers too.** Rejected for now — "static website" is the stated constraint, and a serverless function is the point where that stops being true. Worth its own ADR if a write path ever needs one; note that is also [ADR-009](009-park-supabase.md)'s Supabase re-entry trigger.

## Related work

- **#173** found the ADR-003 contradiction and is closed by this ADR
- **#163** — its "record the canonical host in a `CNAME`" acceptance criterion is wrong; `CNAME` is a GitHub Pages mechanism and does nothing on Netlify
- **#174** — the SEO strategy spike, unblocked: entity pages are now permitted, so it can recommend rather than merely evaluate
- **#171** — the entity link contract, which becomes **ADR-011** now that this ADR has taken 010
- **ADR-009** parked Supabase; nothing here changes that, and its re-entry trigger is unaffected
