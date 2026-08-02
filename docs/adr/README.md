# Architecture Decision Records

Short docs that capture *why* we made a particular architectural choice — the context at the time, the options considered, and the consequences accepted. ADRs are append-only; if a decision changes, write a new ADR that supersedes the old one.

Format and threshold rule: see [sdlc-baseline `docs/adrs.md`](https://github.com/Johnesco/sdlc-baseline/blob/main/docs/adrs.md). Copy-paste skeleton: [`adr-template.md`](https://github.com/Johnesco/sdlc-baseline/blob/main/examples/adr-template.md).

## Index

| # | Title | Status |
|---|---|---|
| [001](001-supabase-schema-jsonb.md) | Supabase schema — JSONB venues over normalized relational | Superseded by [009](009-park-supabase.md) |
| [002](002-vanilla-js-no-build.md) | Vanilla JS, no framework, no build step | Accepted |
| [003](003-github-pages-deploy.md) | GitHub Pages as deploy target | Accepted |
| [004](004-parallel-data-source-flag.md) | Parallel data source via URL flag — production stays on JSON | Superseded by [009](009-park-supabase.md) |
| [005](005-venue-json-schema.md) | Venue JSON Schema as single source of truth | Accepted |
| [006](006-data-json-canonical.md) | `js/data.json` canonical, `js/data.js` auto-generated | Superseded by [008](008-fetch-data-json-directly.md) |
| [007](007-host-registry-normalization.md) | Host normalization — KJ and company registries referenced by shows | Accepted |
| [008](008-fetch-data-json-directly.md) | Browser fetches `js/data.json` — remove the generated `js/data.js` wrapper | Accepted |
| [009](009-park-supabase.md) | Park Supabase — remove the dormant runtime path, keep the design | Accepted |
