/**
 * Event bus — for genuine one-shots only.
 *
 * This bus once carried eleven event names. Eight of them had only one end:
 * emitted with nothing listening, or listened for with nothing emitting. The
 * ninth, `filter:changed`, was emitted immediately after a `setState` that
 * already notified the same subscribers, so every filter change rendered each
 * view twice.
 *
 * The rule now (#157): **state changes go through `state.js`.** If a view needs
 * to react to something, it subscribes to the state key. The bus is only for
 * events that are not state transitions — right now that is exactly two, both
 * about a venue being opened or dismissed.
 *
 * Before adding a name here, check that the thing being announced is not
 * already a state key. If it is, subscribe to the key instead.
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
 * The complete set of events.
 *
 * Both of these have a real emitter and a real listener, and neither duplicates
 * a state key. A venue being selected is a one-shot announcement that several
 * unrelated components (modal, detail pane, card highlighting) each act on
 * differently — that is what a bus is for.
 *
 * Deleted in #157, with the reason each was dead:
 *   VENUE_DETAIL_SHOWN, VIEW_CHANGED, WEEK_CHANGED,
 *   MODAL_OPEN, DATA_LOADED, DATA_ERROR ... emitted, never listened for
 *   MODAL_CLOSE ......................... listened for, never emitted
 *   SEARCH_CHANGED ...................... neither
 *   FILTER_CHANGED ...................... redundant with the state keys
 *                                         (showDedicated, searchQuery,
 *                                         hostFilter) it was emitted alongside
 */
export const Events = {
    VENUE_SELECTED: 'venue:selected',
    VENUE_CLOSED: 'venue:closed',
};
