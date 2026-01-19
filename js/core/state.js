/**
 * Simple reactive state management
 * No framework, just plain JavaScript
 */

const subscribers = new Map();

const state = {
    venues: [],
    filteredVenues: [],
    filters: {
        day: null,
        city: null,
        search: '',
        dedicatedOnly: false
    },
    view: 'weekly',
    weekStart: new Date(),
    showDedicated: true,
    searchQuery: '',
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
 * Subscribe to any state change
 * @param {Function} callback - Called with full state when any value changes
 * @returns {Function} Unsubscribe function
 */
export function subscribeAll(callback) {
    return subscribe('*', callback);
}

/**
 * Notify subscribers of a state change
 * @param {string} key - State key that changed
 * @param {*} value - New value
 */
function notify(key, value) {
    // Notify specific key subscribers
    if (subscribers.has(key)) {
        subscribers.get(key).forEach(callback => callback(value, key));
    }
    // Notify wildcard subscribers
    if (subscribers.has('*')) {
        subscribers.get('*').forEach(callback => callback(state, key));
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
 * Reset state to initial values
 */
export function resetState() {
    setState({
        venues: [],
        filteredVenues: [],
        filters: {
            day: null,
            city: null,
            search: '',
            dedicatedOnly: false
        },
        view: 'weekly',
        weekStart: new Date(),
        showDedicated: true,
        selectedVenue: null,
        isLoading: false
    });
}

/**
 * Update filters and trigger filtering
 * @param {Object} filterUpdates - Filter updates
 */
export function setFilters(filterUpdates) {
    const newFilters = { ...state.filters, ...filterUpdates };
    setState({ filters: newFilters });
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
