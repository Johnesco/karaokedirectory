/**
 * Simple event bus for component communication
 * Allows components to communicate without direct dependencies
 */

const listeners = new Map();

/**
 * Subscribe to an event
 * @param {string} event - Event name (e.g., 'venue:selected', 'filter:changed')
 * @param {Function} callback - Handler function
 * @returns {Function} Unsubscribe function
 */
export function on(event, callback) {
    if (!listeners.has(event)) {
        listeners.set(event, new Set());
    }
    listeners.get(event).add(callback);

    // Return unsubscribe function
    return () => off(event, callback);
}

/**
 * Subscribe to an event for one-time execution
 * @param {string} event - Event name
 * @param {Function} callback - Handler function
 * @returns {Function} Unsubscribe function
 */
export function once(event, callback) {
    const wrapper = (...args) => {
        off(event, wrapper);
        callback(...args);
    };
    return on(event, wrapper);
}

/**
 * Unsubscribe from an event
 * @param {string} event - Event name
 * @param {Function} callback - Handler to remove
 */
export function off(event, callback) {
    if (listeners.has(event)) {
        listeners.get(event).delete(callback);
    }
}

/**
 * Emit an event to all subscribers
 * @param {string} event - Event name
 * @param {*} data - Data to pass to handlers
 */
export function emit(event, data) {
    if (listeners.has(event)) {
        listeners.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event handler for "${event}":`, error);
            }
        });
    }
}

/**
 * Remove all listeners for an event (or all events)
 * @param {string} [event] - Event name (optional, clears all if not provided)
 */
export function clear(event) {
    if (event) {
        listeners.delete(event);
    } else {
        listeners.clear();
    }
}

// Common event names (for reference)
export const Events = {
    // Venue events
    VENUE_SELECTED: 'venue:selected',
    VENUE_CLOSED: 'venue:closed',

    // View events
    VIEW_CHANGED: 'view:changed',
    WEEK_CHANGED: 'week:changed',

    // Filter events
    FILTER_CHANGED: 'filter:changed',
    SEARCH_CHANGED: 'search:changed',

    // UI events
    MODAL_OPEN: 'modal:open',
    MODAL_CLOSE: 'modal:close',

    // Data events
    DATA_LOADED: 'data:loaded',
    DATA_ERROR: 'data:error'
};
