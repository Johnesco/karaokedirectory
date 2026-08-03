/**
 * Floating action buttons: back-to-top, and jump-to-today.
 *
 * This used to be an inline <script> in index.html that called
 * `setInterval(updateTodayButtonVisibility, 500)` — forever, on every page
 * load — because an inline script cannot import `subscribe` and therefore had
 * no way to learn that `weekStart` had changed. It also reached the app through
 * two `window.*` globals (`window.isCurrentWeek`, `window.jumpToToday`) that
 * existed solely to bridge that gap.
 *
 * As a module it subscribes directly, so the timer and both globals are gone.
 */

import { getState, setState, subscribe } from '../core/state.js';
import { isCurrentWeek } from '../utils/date.js';

const SCROLL_SHOW_AT = 300;

/** Today's card is worth offering when it exists but is scrolled out of view. */
function todayCardOffscreen() {
    const card = document.querySelector('.day-card--today');
    if (!card) return false;
    const rect = card.getBoundingClientRect();
    return !(rect.top < window.innerHeight && rect.bottom > 0);
}

export function initFabs() {
    const backToTop = document.getElementById('back-to-top');
    const jumpToToday = document.getElementById('jump-to-today');
    if (!backToTop || !jumpToToday) return () => {};

    function updateTodayVisibility() {
        // Off the current week entirely — always offer the way back.
        if (!isCurrentWeek(getState('weekStart'))) {
            jumpToToday.hidden = false;
            return;
        }
        jumpToToday.hidden = !todayCardOffscreen();
    }

    function onScroll() {
        backToTop.hidden = window.scrollY < SCROLL_SHOW_AT;
        updateTodayVisibility();
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    // What the 500ms poll was actually waiting for: week changes that happen
    // without a scroll, e.g. the prev/next/Today nav buttons.
    const unsubWeek = subscribe('weekStart', updateTodayVisibility);
    const unsubView = subscribe('view', updateTodayVisibility);

    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    jumpToToday.addEventListener('click', () => {
        setState({ view: 'weekly', weekStart: new Date() });

        // Let the view re-render before scrolling to the card it creates.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const card = document.querySelector('.day-card--today');
                if (card) card.scrollIntoView({ behavior: 'instant', block: 'start' });
            });
        });
    });

    updateTodayVisibility();

    return () => {
        window.removeEventListener('scroll', onScroll);
        unsubWeek();
        unsubView();
    };
}
