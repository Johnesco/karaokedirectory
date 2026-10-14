# ADR-018: The curator keeps current state only

**Status:** Proposed
**Date:** 2026-10-14
**Supersedes:** the curator half of [ADR-015](015-one-confirmation-per-show-date.md), where `lastVerified` is derived from private announcement records. ADR-015's *meaning* of `lastVerified` (the night the latest evidence confirms) stands.
**Tickets:** #327 (spike), #331 (curator), #336 (repo retirements), #332–#334
**Related:** [ADR-016](016-show-lifespan.md) (lifespans), [ADR-017](017-day-card-sections-and-featured-placement.md) (sections, `created`, `featured`)

## Context

The site is about to say three things in public: a show is **new**, it
**changed**, and it was **recently verified** (ADR-017, #329, #335). Spike
#327 first proposed answering all three from a private, append-only journal in
the curator: one record per action, with every public date derived from it.

The owner rejected the journal. What matters is having the latest information.
A change only needs to be known well enough to mark a show new, changed or
verified, and nobody needs a history of how a show got to its current state.

That rejection also exposed the cost the curator already carries. Its master
(`data-curated.js`) is a **second full copy** of the public data, plus private
keys that are stripped on export. Keeping two copies honest takes:

- `curator:check`;
- a three-way baseline (`last-published.json`);
- "the export would destroy N items" reports;
- per-field direction rules for `lastVerified`.

All of that is machinery for a problem that only exists because the copies are
separate.

## Decision

1. **One copy of the public data.** The curator edits a `data.json` in exactly
   the public shape, and Publish sends that file as it is. Nothing is
   exported, nothing is stripped, and nothing can drift.
2. **Private data is personal notes only.** `notes.json` holds venue-level
   contact details and notes, the Facebook catch-up list, and draft venues
   that aren't yet valid enough to publish. It never mixes with the public
   file.
3. **Each action sets the current public fields at the moment you take it.**
   - Confirm sets `lastVerified` to the night, never moving it backwards.
   - Correct fixes the fields and confirms the next night.
   - Changes from… splits the show and sets `changed`.
   - Add sets `created`.
   - Night off and Last night set the exclusion and the lifespan end.

   No history is kept. **Git is the only history:** every version of the
   public file that was ever published.
4. **Announcement records are retired:** the `_announcements` list, the
   Announcements tab and the 📣 panel, along with the per-show source links in
   debug mode (#305). Poster images stay as files.
5. **One writer.** Only the curator changes the venue data. Under
   [ADR-019](019-data-deploys-from-its-own-branch.md) the data lives on its
   own `data` branch, which only the curator pushes to, and code branches
   don't contain the file at all. The curator's copy can't fall behind, so
   there is nothing to reconcile.
   - A code change that needs a data change is split in two: the code PR makes
     the new data valid, then the change is made in the curator and published.
   - Safety net: if the tip of `data` is ever not the curator's last push, the
     curator stops and offers one action: take the `data` tip.

## Consequences

- **Good.** One copy, so `curator:check`, the three-way baseline and the
  underscore-stripping rules can go (#336).
- **Good.** Losing the curator folder no longer threatens public data. The
  public data is in git, and only personal notes are local.
- **Good.** Every public date is written by the action it describes. Nothing
  has to be recomputed, so there's no "export wiped the dates" failure mode.
- **Cost.** `lastVerified` is a stored value again. The "it can't move
  backwards" guarantee becomes a rule at the moment it's written (keep the
  later date), not a property of a maximum over records.
- **Cost.** There's no evidence trail. Why a show was marked verified isn't
  recorded beyond the poster files themselves.
- **Cost.** Contributors (and Claude sessions) can no longer edit
  `js/data.json` in a code PR. A data change goes through the owner's curator.
  A schema change that needs new data takes two steps: the code PR first, then
  a publish. #322 would have been split this way.

## Alternatives considered

- **An append-only journal with every date derived from it** (the spike's
  first proposal). Rejected by the owner: history isn't needed. It also
  brought growth, compaction and backup problems with it.
- **Keep today's master and only retire the records.** Rejected: it keeps the
  second copy, and with it all the drift machinery.
- **Let code PRs keep editing the data, and reconcile venue by venue when both
  have moved.** Rejected by the owner: it builds a state that shouldn't exist,
  and the drift machinery comes back.
- **Edit the developer checkout's `js/data.json` directly.** Rejected: the
  checkout may be mid-feature, on another branch, or dirty, which is the same
  reason `publish-data.js` already works through the GitHub API.
