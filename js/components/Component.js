/**
 * Base Component class for UI components
 * Provides a lightweight component pattern without a framework
 */

export class Component {
    /**
     * Create a component
     * @param {HTMLElement|string} container - DOM element or selector
     * @param {Object} [props={}] - Initial properties
     */
    constructor(container, props = {}) {
        this.container = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        if (!this.container) {
            console.warn(`Component container not found: ${container}`);
        }

        this.props = props;
        this.state = {};
        this._subscriptions = [];
        this._eventListeners = [];
        this._isMounted = false;

        this.init();
    }

    /**
     * Initialize component (override in subclass)
     * Called once when component is created
     */
    init() {}

    /**
     * Update component state and re-render
     * @param {Object} newState - State updates
     */
    setState(newState) {
        const prevState = { ...this.state };
        this.state = { ...this.state, ...newState };

        if (this._isMounted) {
            this.render();
            this.onStateChange(prevState, this.state);
        }
    }

    /**
     * Update props and re-render
     * @param {Object} newProps - Props updates
     */
    setProps(newProps) {
        this.props = { ...this.props, ...newProps };
        if (this._isMounted) {
            this.render();
        }
    }

    /**
     * Render the component
     * Calls template() and injects into container
     */
    render() {
        if (!this.container) return;

        const html = this.template();
        this.container.innerHTML = html;
        this._isMounted = true;
        this.afterRender();
    }

    /**
     * Generate HTML template (override in subclass)
     * @returns {string} HTML string
     */
    template() {
        return '';
    }

    /**
     * Called after render completes (override in subclass)
     * Use for attaching event listeners, initializing third-party libs, etc.
     */
    afterRender() {}

    /**
     * Called when state changes (override in subclass)
     * @param {Object} prevState - Previous state
     * @param {Object} newState - New state
     */
    onStateChange(prevState, newState) {}

    /**
     * Add a DOM event listener (auto-cleaned on destroy)
     * @param {HTMLElement|string} target - Element or selector
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @param {Object} [options] - addEventListener options
     */
    addEventListener(target, event, handler, options) {
        const element = typeof target === 'string'
            ? this.container?.querySelector(target)
            : target;

        if (!element) return;

        const boundHandler = handler.bind(this);
        element.addEventListener(event, boundHandler, options);
        this._eventListeners.push({ element, event, handler: boundHandler, options });
    }

    /**
     * Add event delegation (handles dynamically added elements)
     * @param {string} event - Event name
     * @param {string} selector - CSS selector to match
     * @param {Function} handler - Event handler
     */
    delegate(event, selector, handler) {
        const delegatedHandler = (e) => {
            const target = e.target.closest(selector);
            if (target && this.container?.contains(target)) {
                handler.call(this, e, target);
            }
        };

        this.container?.addEventListener(event, delegatedHandler);
        this._eventListeners.push({
            element: this.container,
            event,
            handler: delegatedHandler
        });
    }

    /**
     * Subscribe to state/event (auto-cleaned on destroy)
     * @param {Function} subscribeFn - Subscribe function that returns unsubscribe
     */
    subscribe(subscribeFn) {
        const unsubscribe = subscribeFn;
        if (typeof unsubscribe === 'function') {
            this._subscriptions.push(unsubscribe);
        }
    }

    /**
     * Query element within component
     * @param {string} selector - CSS selector
     * @returns {HTMLElement|null}
     */
    $(selector) {
        return this.container?.querySelector(selector);
    }

    /**
     * Query all elements within component
     * @param {string} selector - CSS selector
     * @returns {NodeList}
     */
    $$(selector) {
        return this.container?.querySelectorAll(selector) || [];
    }

    /**
     * Emit a custom event from this component
     * @param {string} eventName - Event name
     * @param {*} detail - Event detail data
     */
    emit(eventName, detail) {
        const event = new CustomEvent(eventName, {
            bubbles: true,
            detail
        });
        this.container?.dispatchEvent(event);
    }

    /**
     * Show the component
     */
    show() {
        if (this.container) {
            this.container.style.display = '';
            this.container.hidden = false;
        }
    }

    /**
     * Hide the component
     */
    hide() {
        if (this.container) {
            this.container.hidden = true;
        }
    }

    /**
     * Clean up component (remove listeners, subscriptions)
     */
    destroy() {
        // Remove event listeners
        this._eventListeners.forEach(({ element, event, handler, options }) => {
            element?.removeEventListener(event, handler, options);
        });
        this._eventListeners = [];

        // Unsubscribe from state/events
        this._subscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this._subscriptions = [];

        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
        }

        this._isMounted = false;
        this.onDestroy();
    }

    /**
     * Called when component is destroyed (override in subclass)
     */
    onDestroy() {}
}
