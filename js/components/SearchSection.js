/**
 * SearchSection Component
 * Renders a collapsible section of day cards for a date range.
 * Used to show extended search results beyond the current week.
 *
 * Features:
 * - Section header with title and venue count badge
 * - Collapse toggle button with persistent state (localStorage)
 * - Day cards for each date in the range
 * - Deduplication via seenVenues Set (passed by reference)
 */

import { renderDayCard } from './DayCard.js';
import { getDateRange } from '../utils/date.js';
import { getVenuesForDate } from '../services/venues.js';
import { getState } from '../core/state.js';

/**
 * Get storage key for collapse state
 * @param {string} title - Section title
 * @returns {string} localStorage key
 */
function getStorageKey(title) {
    const slug = title.toLowerCase().replace(/\s+/g, '-');
    return `searchSection_${slug}_collapsed`;
}

/**
 * Check if section should be collapsed
 * @param {string} title - Section title
 * @returns {boolean} True if collapsed
 */
function isCollapsed(title) {
    return localStorage.getItem(getStorageKey(title)) === 'true';
}

/**
 * Toggle collapse state
 * @param {string} title - Section title
 */
function toggleCollapsed(title) {
    const key = getStorageKey(title);
    const current = localStorage.getItem(key) === 'true';
    localStorage.setItem(key, (!current).toString());
}

/**
 * Count unique venues in date range that match search and aren't already seen
 * @param {Date} startDate - Range start
 * @param {Date} endDate - Range end
 * @param {Set} seenVenues - Set of venue IDs already displayed
 * @param {boolean} deduplicate - Whether to skip already-seen venues
 * @returns {{ count: number, dedupedCount: number, venuesByDate: Map }} Venue count, deduped count, and map of date -> venues
 */
function countVenuesInRange(startDate, endDate, seenVenues, deduplicate = true) {
    const dates = getDateRange(startDate, endDate);
    const showDedicated = getState('showDedicated');
    const searchQuery = getState('searchQuery');
    const venuesByDate = new Map();
    const uniqueVenues = new Set();
    const dedupedVenues = new Set();

    dates.forEach(date => {
        const venues = getVenuesForDate(date, { includeDedicated: showDedicated, searchQuery });

        if (deduplicate) {
            venues.forEach(v => {
                if (seenVenues.has(v.id)) {
                    dedupedVenues.add(v.id);
                }
            });
        }

        const filteredVenues = deduplicate
            ? venues.filter(v => !seenVenues.has(v.id))
            : venues;

        if (filteredVenues.length > 0) {
            venuesByDate.set(date.toISOString(), { date, venues: filteredVenues });
            filteredVenues.forEach(v => uniqueVenues.add(v.id));
        }
    });

    return { count: uniqueVenues.size, dedupedCount: dedupedVenues.size, venuesByDate };
}

/**
 * Render a search section with day cards
 * @param {Object} options - Render options
 * @param {string} options.title - Section title (e.g., "Next Week")
 * @param {Date} options.startDate - Range start date
 * @param {Date} options.endDate - Range end date
 * @param {Set} options.seenVenues - Set of venue IDs already displayed (mutated)
 * @param {boolean} options.deduplicate - Whether to skip already-seen venues (default: true)
 * @returns {string} HTML string, or empty string if no venues
 */
export function renderSearchSection({ title, startDate, endDate, seenVenues, deduplicate = true }) {
    const { count, dedupedCount, venuesByDate } = countVenuesInRange(startDate, endDate, seenVenues, deduplicate);

    // No venues in this range
    if (count === 0) {
        return '';
    }

    const collapsed = isCollapsed(title);
    const collapsedClass = collapsed ? 'search-section--collapsed' : '';
    const chevronClass = collapsed ? '' : 'search-section__toggle--expanded';

    // Add venues to seenVenues set
    venuesByDate.forEach(({ venues }) => {
        venues.forEach(v => seenVenues.add(v.id));
    });

    // Render day cards for dates with venues
    const dayCardsHtml = Array.from(venuesByDate.values())
        .map(({ date }) => `
            <div class="weekly-view__day">
                ${renderDayCard(date)}
            </div>
        `)
        .join('');

    // Dedup notice when recurring venues were hidden
    const dedupNotice = (deduplicate && dedupedCount > 0)
        ? `<p class="search-section__dedup-notice">
                <i class="fa-solid fa-circle-info"></i>
                Plus ${dedupedCount} recurring venue${dedupedCount !== 1 ? 's' : ''} already shown above
           </p>`
        : '';

    return `
        <section class="search-section ${collapsedClass}" data-section-title="${title}">
            <header class="search-section__header">
                <h3 class="search-section__title">${title}</h3>
                <span class="search-section__count">${count} venue${count !== 1 ? 's' : ''}</span>
                <button class="search-section__toggle ${chevronClass}" aria-label="Toggle section">
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
            </header>
            <div class="search-section__content">
                ${dayCardsHtml ? `<div class="weekly-view__grid">${dayCardsHtml}</div>` : ''}
                ${dedupNotice}
            </div>
        </section>
    `;
}

/**
 * Attach event listeners for search section toggle buttons
 * @param {HTMLElement} container - Container element
 */
export function attachSearchSectionListeners(container) {
    container.querySelectorAll('.search-section__toggle').forEach(button => {
        button.addEventListener('click', (e) => {
            const section = e.target.closest('.search-section');
            if (section) {
                const title = section.dataset.sectionTitle;
                toggleCollapsed(title);
                section.classList.toggle('search-section--collapsed');
                button.classList.toggle('search-section__toggle--expanded');
            }
        });
    });
}
