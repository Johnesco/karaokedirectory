/**
 * Reactive state store — the single channel for anything that changes.
 *
 * Change something with `setState`, react to it with `subscribe(key, fn)`. That
 * is the whole protocol. Do not announce a state change on the event bus as
 * well: subscribers already ran, and the second notification renders everything
 * a second time (#157).
 *
 * State keys — every one is read and written by real code:
 * - view: Current base view ('weekly', 'alphabetical', 'map'). What is actually
 *   on screen also depends on hostFilter; router.resolveView() combines them.
 * - weekStart: Date for current week in weekly view
 * - showDedicated: Whether to show dedicated karaoke venues
 * - mapDateFilter: Which date span the map plots — 'all' | 'week' | 'today'.
 *   Map-only, so it stays out of the URL; entering the map always starts at 'all'.
 * - searchQuery: Global search filter text
 * - hostFilter: KJ/host name filter, URL-driven via ?kj= (substring match against host name/company only)
 * - selectedVenue: Currently selected venue object (for modal/detail pane)
 * - isLoading: Loading indicator state
 *
 * `venues`, `filteredVenues`, and `filters` used to sit here too. Nothing ever
 * read or wrote them — venue data lives in services/venues.js — but the spec
 * documented them as live, so they read as the app's data model to anyone
 * arriving cold. Removed in #157.
 */

const subscribers = new Map();

const state = {
    view: 'weekly',
    weekStart: new Date(),
    showDedicated: true,
    mapDateFilter: 'all',
    searchQuery: '',
    hostFilter: '',
    selectedVenue: null,
    isLoading: false
};

/**
 * Subscribe to state changes for a specific key
 * @param {string} key - State key to watch
 * @param {Function} callback - Called with new value when state changes
 * @returns {Function} Unsubscribe function
 */
export function subscribe(key, callback) {
    if (!subscribers.has(key)) {
        subscribers.set(key, new Set());
    }
    subscribers.get(key).add(callback);

    // Return unsubscribe function
    return () => {
        subscribers.get(key).delete(callback);
    };
}

/**
 * Notify subscribers of a state change
 * @param {string} key - State key that changed
 * @param {*} value - New value
 */
function notify(key, value) {
    if (subscribers.has(key)) {
        subscribers.get(key).forEach(callback => callback(value, key));
    }
}

/**
 * Update state and notify subscribers
 * @param {Object} updates - Object with state updates
 */
export function setState(updates) {
    const changedKeys = [];

    for (const [key, value] of Object.entries(updates)) {
        if (state[key] !== value) {
            state[key] = value;
            changedKeys.push(key);
        }
    }

    // Notify after all updates are applied
    changedKeys.forEach(key => notify(key, state[key]));
}

/**
 * Get current state value
 * @param {string} key - State key
 * @returns {*} Current value
 */
export function getState(key) {
    return key ? state[key] : { ...state };
}

/**
 * Navigate week forward or backward
 * @param {number} weeks - Number of weeks to move (positive = forward)
 */
export function navigateWeek(weeks) {
    const newDate = new Date(state.weekStart);
    newDate.setDate(newDate.getDate() + (weeks * 7));
    setState({ weekStart: newDate });
}

/**
 * Go to current week
 */
export function goToCurrentWeek() {
    setState({ weekStart: new Date() });
}

export { state };
