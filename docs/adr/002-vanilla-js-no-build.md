# ADR-002: Vanilla JS, no framework, no build step

- **Status:** Accepted
- **Date:** 2026-04-30 (backfilled — decision made at project inception, late 2025)
- **Issue:** [#56](https://github.com/Johnesco/karaokedirectory/issues/56) (backfill)

## Context

The directory is a small SPA — three views (calendar / alphabetical / map), ~70 venues, no auth, no backend. At project inception we had to choose:

- **A framework** — React / Vue / Svelte, with Vite or similar bundling
- **A lightweight stack** — vanilla JS with ES modules, served as static files
- **Plain HTML pages** — no SPA at all, multiple HTML files, full reloads

Constraints:
- Solo developer, hobby/community project
- Low ongoing maintenance budget
- Must be hostable on free static hosting
- Should be approachable to contributors who haven't used a particular framework
- Mobile performance matters — Austinites checking "where's karaoke tonight" on a phone in a bar
- The data is small (~70 venues, all in memory) and the interactions are simple (filtering, day navigation, map)

## Decision

**Vanilla JS, ES6 modules, no build step, no framework.** HTML files are authored by hand and served as-is. JS is loaded via `<script type="module">`. CSS is hand-authored, organized by file (base / layout / components / views), with CSS variables in `base.css`.

External libraries are loaded from CDN (Leaflet, Font Awesome). No `node_modules`, no `package.json` for runtime dependencies, no `dist/`, no transpilation.

A small component pattern (`Component` base class, observer-pattern state, event bus) provides structure without framework overhead.

## Consequences

**Positive**
- **Zero build complexity.** Edit a file, refresh the browser. No Vite dev server, no HMR debugging, no framework version churn.
- **Deploys are file copies.** Whatever's in the repo is what runs. GitHub Pages just serves it.
- **Forever-readable.** ES2015+ runs in every modern browser without polyfills. The code that works today will work in 10 years.
- **No supply-chain surface area.** No npm dependencies in the runtime path means no Dependabot churn, no transitive vulnerabilities, no "framework X had a CVE this week."
- **Approachable.** A contributor who knows JavaScript can read every file. No framework idioms to learn.
- **Tiny payloads.** No framework runtime; total JS is small enough that the network is rarely the bottleneck.
- **Debuggable.** What you write is what runs. No source maps lying about line numbers; no transpiled output to grep through.

**Negative / accepted tradeoffs**
- **No JSX or template DSL.** Components build DOM via `template()` returning HTML strings (then `innerHTML` + listener wiring) or by manual DOM construction. More verbose than JSX.
- **No reactivity.** Updates require explicit calls — `setState`, `emit`, `render`. Forgetting to wire one up is a class of bug a framework would prevent.
- **No router.** View switching is hand-rolled in `app.js` with `?view=` and `#` params.
- **No type system.** Bugs that TypeScript would catch are caught at runtime instead. Mitigated by JSDoc on key utilities.
- **Cannot adopt framework-only ecosystems** (React component libraries, Tailwind plugins, etc.). Not currently a constraint that hurts.
- **Manual bundling if scale demands it.** ~30 modules over HTTP/2 is fine for now; if the file count exploded, we'd have to introduce a bundler.

**Future revisit triggers**
- Component count grows past ~50 and the manual lifecycle wiring becomes a recurring source of bugs.
- A feature requires server-side rendering (SEO becomes a priority).
- Type errors become a regular cause of regressions and JSDoc isn't enough.
- Mobile performance regresses despite no framework — would imply the bottleneck is elsewhere and a framework wouldn't fix it.

## Options considered

### Option A — React + Vite (rejected)

The default modern choice. Familiar component model, large ecosystem, type safety via TypeScript.

Rejected because:
- Solves problems we don't have (state management at scale, complex component composition, server interaction).
- Forces a build step, lockfiles, dependency churn, and a deploy pipeline more complex than "push to main."
- Framework runtime adds payload size disproportionate to app complexity.
- Onboarding a non-React contributor is a learning curve before they can fix a typo.

### Option B — Svelte (rejected)

Compiles away — no runtime — addressing the React payload concern. Reactivity is built in.

Rejected because:
- Still requires a build step and deploy pipeline.
- Svelte 4 → 5 migration anxiety mirrors React's; framework churn is the issue, not the specific framework.
- The reactivity benefits don't earn their keep at this scale.

### Option C — Vanilla JS, ES modules, no build (accepted)

What we picked. Trades a small amount of authoring ergonomics (no JSX, no reactivity, no types) for zero build complexity, zero supply-chain churn, and a forever-readable codebase.

### Option D — Multi-page HTML, no SPA (rejected)

Maximum simplicity. Each view is its own HTML page; no client-side routing.

Rejected because:
- Full page reloads break the "swipe through days" feel of the calendar view.
- The map view's state (zoom, selected venue) doesn't survive a reload cleanly.
- Sharing state across pages (which day is selected, search query) requires URL/storage gymnastics that an SPA handles trivially.

## Rejected sub-decisions

- **TypeScript:** rejected because it requires a compile step. Reconsidered if/when JSDoc proves insufficient.
- **CSS preprocessor (Sass / PostCSS):** rejected; CSS variables and modern CSS cover everything we need without a build step.
- **Web Components:** considered as a "vanilla framework"; rejected because the imperative `Component` base class and observer state are simpler for this app's size and don't tie us to Shadow DOM trade-offs.
- **htmx:** considered; rejected because it shines for server-driven HTML and we have no server.

## Implementation notes

- **Entry:** `index.html` loads `js/data.js` as a global, then imports `js/app.js` as a module.
- **Component pattern:** `js/components/Component.js` — base class. Lifecycle: `constructor → init → template → render → afterRender → destroy`.
- **State:** `js/core/state.js` — `getState`, `setState`, `subscribe` (observer pattern).
- **Events:** `js/core/events.js` — `emit`, `on` with `Events` constants (pub/sub).
- **CSS:** `css/base.css` (variables, reset) → `css/layout.css` → `css/components.css` → `css/views.css`. BEM naming.
- **External libs:** Leaflet + Font Awesome via CDN; no other runtime dependencies.

This decision is reaffirmed implicitly every time we say "no, we're not adopting X" — recording it here so the cumulative weight is legible to future contributors.
