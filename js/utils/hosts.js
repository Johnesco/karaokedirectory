/**
 * Host reference hydration (ADR-007)
 *
 * During the transition window data.json stores a host two ways:
 *   - Legacy inline object: { name?, affiliation?, website?, socials? }
 *   - Registry ref pair:    { kjId?, companyId? } pointing into the top-level
 *                           `kjs` / `companies` maps
 *
 * Views, components, search, and the KJ pages only ever see the inline display
 * shape — refs are resolved once in initVenues(), so nothing downstream needs to
 * know which storage form a venue used.
 *
 * Key exports:
 * - isHostRef(host): true when a host value is a registry ref pair
 * - resolveHostRef(ref, registries): one ref pair → display host object
 * - hydrateVenues(data): full listings array with every ref resolved
 */

/**
 * A host value is a registry ref when it carries either id key. Legacy inline
 * hosts never do, so the two shapes are unambiguous (the schema enforces this
 * with mutually exclusive additionalProperties).
 * @param {Object|null} host
 * @returns {boolean}
 */
export function isHostRef(host) {
    return !!host && ('kjId' in host || 'companyId' in host);
}

/**
 * Resolve a { kjId?, companyId? } pair into the display host shape.
 *
 * KJ fields win and the company fills gaps: a KJ with no website of their own
 * shows the company's, which matches how the single legacy `website` field
 * ("Host / Affiliation Website") has always been used.
 *
 * The ids ride along on the result for id-aware consumers (KJ index, dossier
 * links); rendering ignores them.
 *
 * @param {Object} ref - { kjId?, companyId? }
 * @param {Object} registries - { kjs, companies } id → { name, website?, socials? }
 * @param {string} [context] - Venue id, used only in the unresolved-ref warning
 * @returns {Object|null} { name?, affiliation?, website?, socials?, kjId?, companyId? }, or null if neither id resolves
 */
export function resolveHostRef(ref, { kjs = {}, companies = {} } = {}, context = '') {
    const kj = ref.kjId ? kjs[ref.kjId] : null;
    const company = ref.companyId ? companies[ref.companyId] : null;

    // Unresolved ids mean data.json and its registries disagree. validate-data.js
    // fails CI on this, so at runtime we warn and render what we can rather than
    // dropping the venue's whole host block.
    if (ref.kjId && !kj) warnMissing('kjs', ref.kjId, context);
    if (ref.companyId && !company) warnMissing('companies', ref.companyId, context);
    if (!kj && !company) return null;

    const host = {};
    if (kj?.name) host.name = kj.name;
    if (company?.name) host.affiliation = company.name;

    const website = kj?.website || company?.website;
    if (website) host.website = website;

    const socials = kj?.socials || company?.socials;
    if (socials) host.socials = socials;

    if (ref.kjId) host.kjId = ref.kjId;
    if (ref.companyId) host.companyId = ref.companyId;

    return host;
}

function warnMissing(registry, id, context) {
    console.warn(`Unknown ${registry} id "${id}"${context ? ` (referenced by ${context})` : ''} — host info will be incomplete.`);
}

/**
 * Resolve every host ref in the listings array.
 *
 * Venues that carry no refs are returned untouched (same object identity), so
 * data that predates the migration behaves exactly as before.
 *
 * @param {Object} data - { listings, kjs?, companies? }
 * @returns {Object[]} Listings with hosts in display shape
 */
export function hydrateVenues(data) {
    const registries = { kjs: data?.kjs || {}, companies: data?.companies || {} };
    return (data?.listings || []).map(venue => hydrateVenue(venue, registries));
}

/**
 * @param {Object} venue
 * @param {Object} registries - { kjs, companies }
 * @returns {Object} Hydrated copy, or the original when there was nothing to resolve
 */
function hydrateVenue(venue, registries) {
    const venueHostIsRef = isHostRef(venue.host);
    const scheduleHasRef = (venue.schedule || []).some(entry => isHostRef(entry.host));
    if (!venueHostIsRef && !scheduleHasRef) return venue;

    const hydrated = { ...venue };

    if (venueHostIsRef) {
        hydrated.host = resolveHostRef(venue.host, registries, venue.id);
    }

    if (scheduleHasRef) {
        hydrated.schedule = venue.schedule.map(entry => (
            isHostRef(entry.host)
                ? { ...entry, host: resolveHostRef(entry.host, registries, venue.id) }
                : entry
        ));
    }

    return hydrated;
}
