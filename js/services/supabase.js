/**
 * Supabase data service
 * Fetches venue data from Supabase (JSONB schema — issue #47) and returns
 * it in the same shape as karaokeData from data.js, so venues.js, views,
 * and components require zero changes.
 *
 * Data flow:
 *   Supabase query → transformVenue() → { tagDefinitions, listings } → initTagConfig + initVenues
 *
 * Caching:
 *   Transformed data is cached in sessionStorage with a configurable TTL.
 *   Cache clears when the tab closes (natural invalidation for a "what's tonight" directory).
 */

import { config } from '../config.js';

const CACHE_KEY = 'akd_venues';

// ---- Supabase Client ----

let db = null;

function getClient() {
    if (db) return db;
    if (typeof window.supabase === 'undefined') {
        throw new Error('Supabase JS client not loaded. Is the CDN script tag present?');
    }
    db = window.supabase.createClient(config.supabase.url, config.supabase.anonKey);
    return db;
}

// ---- Cache ----

function getCached() {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if (Date.now() - cached.timestamp > config.cache.ttlMs) {
            sessionStorage.removeItem(CACHE_KEY);
            return null;
        }
        return cached.data;
    } catch {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
    }
}

function setCache(data) {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data
        }));
    } catch {
        // sessionStorage full or unavailable — non-fatal
    }
}

// ---- Transform: Supabase row → data.js venue shape ----

function transformVenue(raw) {
    // The JSONB `data` column already holds the venue shape verbatim.
    // Spread it back together with the top-level columns.
    const venue = { id: raw.id, name: raw.name, ...(raw.data || {}) };
    if (raw.active === false) venue.active = false;
    return venue;
}

// ---- Transform: tags array → tagDefinitions object ----

function transformTagDefinitions(tags) {
    const definitions = {};
    for (const tag of tags) {
        definitions[tag.id] = {
            label: tag.label,
            color: tag.color,
            textColor: tag.text_color
        };
    }
    return definitions;
}

// ---- Public API ----

/**
 * Fetch venue data from Supabase, with sessionStorage caching.
 * Returns data in the same shape as karaokeData from data.js:
 *   { tagDefinitions: {...}, listings: [...] }
 *
 * @returns {Promise<{tagDefinitions: Object, listings: Object[], source: string}>}
 */
export async function fetchVenueData() {
    // Check cache first
    const cached = getCached();
    if (cached) {
        console.log('Data source: cache');
        return { ...cached, source: 'cache' };
    }

    const client = getClient();

    // Run both queries in parallel
    const [venuesResult, tagsResult] = await Promise.all([
        client
            .from('venues')
            .select('id, name, active, data')
            .order('name'),
        client
            .from('tags')
            .select('id, label, color, text_color')
    ]);

    if (venuesResult.error) throw new Error(`Venues query failed: ${venuesResult.error.message}`);
    if (tagsResult.error) throw new Error(`Tags query failed: ${tagsResult.error.message}`);

    const tagDefinitions = transformTagDefinitions(tagsResult.data);
    const listings = venuesResult.data.map(transformVenue);

    const data = { tagDefinitions, listings };

    // Cache the transformed result
    setCache(data);

    console.log(`Data source: supabase (${listings.length} venues)`);
    return { ...data, source: 'supabase' };
}
