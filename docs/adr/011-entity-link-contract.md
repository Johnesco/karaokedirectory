# ADR-011: Entity link contract — every linkable thing is `{type, id}`

**Status:** Accepted
**Date:** 2026-08-02
**Issue:** [#171](https://github.com/Johnesco/karaokedirectory/issues/171)
**Related:** [ADR-007](007-host-registry-normalization.md) (host registries) · [ADR-010](010-static-on-netlify-only-constraint.md) (static-on-Netlify is the only constraint) · [#174](https://github.com/Johnesco/karaokedirectory/issues/174) (SEO strategy — decides *rendering*, not identity)

## Context

The directory is close to letting you move between its entities — click a KJ, see their shows; click a tag, see that kind of venue. The destination for the KJ case already exists: `KJDossierView` renders one host's complete schedule across every venue.

What is missing is **identity**, and the gap is not theoretical.

ADR-007 gave every KJ and company a stable registry id. `js/utils/hosts.js:66-67` attaches `kjId`/`companyId` to every hydrated host, and its own docstring says why: *"The ids ride along on the result for id-aware consumers (KJ index, dossier links)."*

A grep for those keys outside `hosts.js` returns **one comment**. The substrate was built, documented for exactly this purpose, and never connected.

### The gap, measured against real data

- **`?kj=` carries four different meanings** in one namespace: the sentinel `all`, the sentinel `none`, a KJ *display name*, and a company *display name*. Two registries plus two magic values, resolved by one substring match.
- **Resolution is `containsIgnoreCase`, not lookup** (`js/services/venues.js:134-141`). This is a live defect, not a future risk:

  ```
  ?kj=Armando  →  3 venues, belonging to TWO different KJs
      Dog 'n' Bone Pub        <- Armando
      Hudson's On Mercer St.  <- Armando
      Feral Housewife Wine    <- KJ Armando and Paola
  ```

  `armando` and `kj-armando-and-paola` are distinct registry entries. The dossier silently merges them.
- **Links are built from display names** (`KJIndexView.js:242, :262, :274` all emit `?kj=${encodeURIComponent(name)}`), and `collectIndex()` keys on `name.toLowerCase()`, discarding the id it was handed. Renaming a KJ breaks every link to them.
- **Only two entity types are linkable at all.** Tags render as inert `<span>` (`js/utils/tags.js:37`) despite having stable ids; cities are free text; and the host name on a venue card is a plain `<p>` (`js/utils/render.js:180`) — so the obvious click target for "see this KJ's other nights" is not a link anywhere outside the KJ index.

[ADR-010](010-static-on-netlify-only-constraint.md) removed the constraint that made entity URLs impossible. The contract has to be settled before a router is written against the status quo.

## Decision

**Every linkable thing is a `{type, id}` pair, where `id` is a stable registry key — never a display name.**

### 1. The entity types

| Type | Id source | Count | Status |
|---|---|---|---|
| `venue` | `listings[].id` | 80 | exists, slug-safe |
| `kj` | `kjs` registry key | 24 | exists, slug-safe |
| `company` | `companies` registry key | 18 | exists, slug-safe |
| `tag` | `tagDefinitions` key | 19 | exists — **two are not slug-safe**, see below |
| `city` | *(none yet)* | — | blocked on [#170](https://github.com/Johnesco/karaokedirectory/issues/170) |

Audited against `js/data.json`: all 80 venue, 24 KJ, and 18 company ids already match `^[a-z0-9]+(-[a-z0-9]+)*$`, and there are **zero collisions across the four namespaces**.

### 2. Ids are the link, names are the label

A link is built from the id. A display name is never an identifier. `KJIndexView` must carry the registry id through `collectIndex()` instead of discarding it, and resolution becomes an exact lookup rather than a substring scan — which is what fixes the Armando collision.

### 3. Sentinels leave the id namespace

`all` and `none` are not entities and must stop sharing a namespace with them. They become distinct routes (an index route and a filter route), not values of an id parameter.

Both strings happen to be unused as ids today. That is luck, not design — the whole point is that a future KJ named "All" must not be able to break the index.

### 4. `kj` and `company` are separate types

They are two registries describing two different kinds of thing, and the KJ index already links both through the same `?kj=`. One namespace for two entity types is the same category error as the sentinels.

They stay separately addressable even though a company page and a KJ page may look similar. ADR-007's rule — *the KJ↔company link lives on the show, not on the entities* — means a roster is derived by scanning shows, and that derivation works the same either way.

### 5. Path-shaped URLs, not query parameters

Entity URLs take the form `/<type>/<id>` — `/kj/armando`, `/venue/dog-n-bone-pub`, `/tag/lgbtq`.

Query parameters describe a *filtered view of a page*; paths name a *thing*. That distinction is what makes an entity URL indexable, and Netlify already serves extensionless paths (`/bday` returns 200 today with no configuration).

`?kj=` and `#venue=` must keep working as permanent redirects — they are in the wild, in the sitemap discussion, and in at least one live nav link.

### 6. Two tag ids are not URL-safe

`21+` and `18+` contain a character that means "space" when a URL is decoded as a query string, and that reads as an encoding bug in a path. This blocks `/tag/21+`.

Resolve it in whichever way [#170](https://github.com/Johnesco/karaokedirectory/issues/170) prefers — a separate `slug` field on the tag definition, or renaming the ids to `age-21-plus`. **Do not** paper over it with percent-encoding: `/tag/21%2B` is not a URL anyone will type, share, or recognise.

### 7. What this ADR does NOT decide

**How entity pages get rendered for a crawler.** Pre-generated static files at build time, Netlify prerendering, or accepting client-side rendering are all still open, and they are [#174](https://github.com/Johnesco/karaokedirectory/issues/174)'s call.

This contract is deliberately compatible with every one of those. Naming the identity model does not commit to a rendering strategy — but a rendering strategy chosen *without* the identity model would bake display names into URLs, which is the mistake this ADR exists to prevent.

Also not decided: **which entity types actually get published pages.** `/tag/brewery` covering one venue is thin content, and 5 of 19 tags cover ≤2 venues while 3 cover none. Whether a type is *addressable* and whether it is *indexable* are separate questions; this ADR settles only the first.

## Consequences

### Positive

- **The Armando collision becomes unrepresentable**, not merely fixed. Exact-id lookup has no substring semantics to get wrong.
- **Renaming a KJ stops breaking links.** Ids are stable; display names are free to change, which matters for a directory whose hosts use stage names.
- **`hosts.js`'s ids finally have a consumer** — the thing they were added for in ADR-007.
- **Cross-linking and SEO stop being two projects.** `/kj/armando` is simultaneously the click target and the indexable page.
- **JSON-LD gets `@id` for free.** Stable entity URLs are exactly what structured data wants, so [#164](https://github.com/Johnesco/karaokedirectory/issues/164) gets easier rather than harder.

### Negative

- **`?kj=` links in the wild need permanent redirects**, and they must be maintained indefinitely. Cheap on Netlify, but real.
- **The tag id problem has to be solved before `/tag/` exists.** That is a data migration touching `tagDefinitions` and every `tags[]` array — small, but not free.
- **A `city` type cannot ship until cities have a registry** (#170). Place is the one entity with no stable ids at all.

### Neutral

- **This changes no behaviour on its own.** No links, views, or routes are added by this ADR. It constrains work that was going to happen anyway.

## Alternatives considered

- **Keep `?kj=<name>` and just fix the substring match.** Cheapest, and it does fix Armando. Rejected: it leaves display names as identifiers, so renames still break links, and query parameters remain the wrong shape for an indexable page. It fixes the symptom and preserves the cause.
- **One flat namespace for all entities** (`/e/armando`). Currently possible — there are zero cross-type id collisions. Rejected as fragile by construction: it makes the absence of collisions a permanent constraint on four independently-edited registries, and it loses the type information a reader gets free from `/kj/`.
- **Keep sentinels as reserved ids** (`all`, `none` disallowed as registry keys, enforced by `validate-data.js`). Workable and cheap. Rejected as strictly worse than routing them separately: it spends a validator rule to preserve a category error, and the reserved list grows every time a new magic value is wanted.

## Related work

- **#171** — this ADR
- **#124 Phase 5** — carries the "stable `?kj=<slug>` ids" bullet; this ADR is its contract
- **#155 / #156** — router and view registry, both of which should be built against this rather than the status quo
- **#174** — SEO strategy: decides rendering and which types get indexed
- **#170** — cities registry, which a `city` entity type depends on
- **#164** — JSON-LD, which gains `@id` from this
