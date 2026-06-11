# ADR-005: Venue JSON Schema as the single source of truth

**Status:** Accepted
**Date:** 2026-06-10
**Issue:** [#100](https://github.com/Johnesco/karaokedirectory/issues/100)
**Related:** [ADR-001](001-supabase-schema-jsonb.md) (Supabase JSONB) · [ADR-004](004-parallel-data-source-flag.md) (parallel data source)

## Context

The venue data shape lived in **four places** that could drift independently:

1. CLAUDE.md prose, in the "Venue Data Format" section
2. `scripts/validate-data.js` — hand-rolled checks (frequencies, day casing, time format, empty-string fields, etc.)
3. `scripts/audit-for-supabase.js` — duplicates ~70% of those checks
4. The implicit shape `js/services/venues.js` reads at runtime

Adding a tag, changing a field's optionality, or accepting a new schedule pattern required hunting through all four. The external `~/karaoke-curator/` tool (see commit `f647790` and `bb82d73`) targets a fifth implicit copy of the same schema, and the public `submit.html` form drifts from the curator's shape every time a field changes (issue #101).

## Decision

`schema/venue.schema.json` is the **single contract**. JSON Schema draft 2020-12.

- `validate-data.js` consumes it via Ajv as the primary validation step
- `submit.html` will assemble venue objects that validate against it (#101)
- The external curator targets it
- A future Supabase JSONB column will mirror it (ADR-001)

### What the schema does cover

- Required fields per venue (id, name, address, schedule)
- Field types and shapes (coordinates as numbers, time as `HH:MM`, date as `YYYY-MM-DD`)
- Allowed values for enums (frequencies, day names — case-sensitive, social platforms)
- Conditional shapes (`once` events require `date`; recurring events require `day`)
- Nullable forms that exist in the data: `socials: null`, `endTime: null`, `host: null`
- The `exclusions` array on schedule entries (the "Exclusion Dates" feature already partially landed for one venue)

### What stays in `validate-data.js` as supplementary checks

Cross-row constraints and heuristics JSON Schema cannot express:

- **ID uniqueness** across all listings
- **Tag cross-reference** — every value in `venue.tags[]` must be a key in `tagDefinitions`
- **Minute-typo detection** — start times that aren't `:00`/`:15`/`:30`/`:45` get flagged as likely typos (e.g. `17:03` was meant to be `17:00`)
- **Noon-end after evening start** — an `endTime: "12:00"` paired with a `startTime` past 14:00 is almost certainly a misclick (`12:00` AM vs PM)

## Consequences

### Positive

- Adding a tag or field is one edit, not four
- CI now catches schema violations on every PR (`.github/workflows/ci.yml`)
- VSCode autocompletes inside `data.js` when `"$schema"` is referenced (lands with #102)
- `audit-for-supabase.js` becomes redundant — its checks are now in the schema or supplementary checks (cleanup in a follow-up)
- Curator and Supabase migration get a stable contract to target
- Submit.html alignment (#101) has something concrete to validate against

### Negative

- New runtime dependency: `ajv` and `ajv-formats` (~250kB unpacked, devDependency only)
- Required tracking `package.json` and `package-lock.json` (previously gitignored alongside Playwright test infra — see `.gitignore` history in commit 063a1719)
- Two layers of validation (schema + supplementary) means a contributor reading errors needs to understand both — mitigated by clear error formatting and prefixing

## Alternatives considered

- **Keep hand-rolled rules.** Status quo. Rejected because the four-place drift problem keeps coming back (issue #41 was triggered by it).
- **Vendor a tiny JSON Schema validator.** Avoids the npm dep. Rejected because we'd own ~150 lines of validator code with no real upside — Ajv is mature, well-tested, fast.
- **Schema as docs only, no Ajv refactor.** Compromise that ships the contract without the validator change. Rejected because the validator drift is half the value of doing this work.

## Related work

- **#99** introduced CI as the gate that runs the schema-driven validator
- **#101** aligns `submit.html` to emit shapes that validate against this schema
- **#102** migrates `data.js` → `data.json` so the file gets `"$schema"` for autocomplete and the four scripts that regex-parse it can read JSON directly
