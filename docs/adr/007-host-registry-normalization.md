# ADR-007: Host normalization — KJ and company registries referenced by shows

**Status:** Accepted
**Date:** 2026-07-29
**Issue:** [#124](https://github.com/Johnesco/karaokedirectory/issues/124)
**Related:** [ADR-001](001-supabase-schema-jsonb.md) (Supabase JSONB) · [ADR-005](005-venue-json-schema.md) (schema as contract) · [ADR-006](006-data-json-canonical.md) (data.json canonical)

## Context

Hosts are stored as inline `host` objects (`{ name?, affiliation?, website?, socials? }`) duplicated wherever they appear — on venues and on individual schedule entries. A 2026-07-29 audit of `data.json` (77 venues, 52 host objects) found:

- **Xpider Cantu appears at 6 venues; only 2 copies carry his website.** One fact, six edit sites.
- **Companies duplicate hardest:** Diamond Karaoke Austin ×5 venues, Starling Karaoke ×4, Party Pipes ×2. "Karaoke Underground" vs "The Karaoke Underground" have already drifted apart, with the website on 1 of 3 copies.
- **Hosts have no identity, only spellings.** The KJ index and `?kj=` dossier group and match by lowercased/substring name — `?kj=Armando` also matches "KJ Armando and Paola", and "Average Joe" / "KJ Average Joe" (both Starling) are probably one person the data cannot connect.
- **The name/affiliation split is used inconsistently:** "Marshall Joshua Entertainment" is a host *name* at 2 venues and an *affiliation* at a third. 17 host objects are affiliation-only (a company runs the night, no named KJ).
- **One person under two companies is unrepresentable** (possibly Jen / KJ J3N) because the affiliation string is welded to each host copy.

The domain model is: a venue (the anchor, always present) has shows; a show *may* have a host; "who runs it" is a KJ, a company, or both; a company fields several KJs; a KJ may freelance across companies. Venue↔KJ is many-to-many through shows.

The codebase already solves this exact problem for tags: `tags: ["lgbtq"]` points into `tagDefinitions`, cross-checked by `validate-data.js` in CI.

## Decision

Two top-level registries in `data.json`, with shows referencing them by id:

```json
"companies": { "starling-karaoke": { "name": "Starling Karaoke", "website": "https://..." } },
"kjs":       { "kj-stephanie": { "name": "KJ Stephanie" } },
"listings":  [ { "id": "bar-a", "host": { "companyId": "starling-karaoke", "kjId": "kj-stephanie" } } ]
```

1. **Registries.** `kjs` (people/acts) and `companies`, object maps keyed by slug (the `tagDefinitions` pattern). Entries carry `name` plus optional `website`/`socials`. Duos ("DJ Cysum & Mo") are single KJ entries — the act is the entity.
2. **Host reference = `{ kjId?, companyId? }`, at least one required.** Company-only ("Starling runs it, roster rotates"), KJ-only (independent), or both. Mirrors the current schema's `anyOf: name | affiliation`.
3. **Specificity overrides, full-object swap.** The pair is valid at venue level (default) and per schedule entry (override). A show-level pair fully replaces the venue-level pair — the existing `entry.host ?? venue.host` rule, unchanged.
4. **No stored relationships between entities.** No `companyId` on a KJ, no roster array on a company. The KJ↔company association is a fact about each *gig*, recorded per show. Rosters, the KJ index, and dossiers are **derived** from per-show effective hosts — a KJ appears under a company exactly as long as real shows pair them, so rollups can never go stale and freelancers need no special case.
5. **Hydration at load.** The service layer resolves refs into the legacy display shape `{ name, affiliation, website, socials }` (KJ fields win, company fills gaps), keeping `resolveHostFor()`, components, search, and `?kj=` views unchanged.
6. **Transition window.** Schema and hydration accept both the legacy inline object and the ref pair, so the site, the external curator, and `submit.html` migrate independently; mixed data stays valid until a cleanup ticket drops the legacy shape.
7. **Migration merges are human-ruled.** The migration script auto-merges only exact (case-insensitive) duplicates; near-misses (Average Joe / KJ Average Joe, the two Karaoke Undergrounds, …) go into a review report for the curator. Name variants in this data have been intentional before; tooling flags, never decides.
8. **Public submissions stay free-text.** Submitters can't know registry ids; the form's KJ/Company fields emit free text that the curator reconciles (match-or-create) into the registries.

## Consequences

### Positive

- Each KJ and company is one record — fixing Xpider's website is one edit, not six.
- CI-enforced referential integrity: `kjId`/`companyId` cross-checks join the existing tag cross-reference in `validate-data.js`; a typo'd ref fails the build instead of silently dropping a host.
- Exact identity for KJ listings: the index and dossiers group by id, ending substring conflation and enabling stable `?kj=<slug>` URLs later.
- One person under multiple companies is now just one `kjId` with different `companyId`s per show.
- Registries map 1:1 to future Supabase `kjs`/`companies` tables (ADR-001); the JSON becomes a dry run for the relational model.
- The curator gains pickers instead of retyped strings — drift like "The Karaoke Underground" can't recur.

### Negative

- Indirection: adding a brand-new host is a two-place edit (registry entry + ref). Acceptable — the curator tool absorbs it.
- The external curator and `submit.html` must be updated (tracked in #124 Phases 3–4); until then the transition window carries dual-shape complexity in schema and hydration.
- Migration requires human merge rulings before the data flip ships.
- Derived rosters mean a company's KJ list is only as complete as its current shows — consistent with the "week is the heartbeat" display philosophy, but it is *not* an employment directory.

## Alternatives considered

- **Single flat `hosts` registry** (dedupe today's host object as-is). Halfway: collapses repeated hosts but company strings still duplicate across every KJ entry of the same company, and company-vs-person stays conflated.
- **`companyId` on the KJ entity.** Assumes one company per KJ, permanently. Breaks freelancers, forces a wrong answer for "company-booked, several possible KJs" (the Starling case), and stores an employment claim that rots.
- **Stored roster on the company.** Same staleness problem from the other side; derivation from shows self-heals.
- **Skip JSON normalization, go straight to Supabase.** The runtime flag is deliberately off (ADR-004); normalizing in JSON now yields the benefits immediately and de-risks the eventual schema.

## Related work

- **#124** — implementation ticket (phased: contract/runtime → migration → submit form → curator → cleanup)
- **ADR-005** — the schema this extends; **ADR-006** — migration edits `data.json`, `data.js` regenerated
- Tag system (`tagDefinitions` + `validate-data.js` cross-reference) — the in-repo precedent this generalizes
