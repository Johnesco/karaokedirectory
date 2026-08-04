/**
 * Disclosure primitive — one way to build "click this to show that".
 *
 * The app had two, built to different standards (#167):
 *
 *   ExtendedSection  a real <button>, keyboard-operable, but with only an
 *                    aria-label — it never announced whether it was open
 *   DayCard          a <header> with a delegated click and no button, no
 *                    tabindex, no role and no aria-expanded, so the past-day
 *                    expand documented in spec §2 was mouse-only
 *
 * Both use this now. The contract is the ARIA disclosure pattern: a button that
 * owns `aria-expanded`, points at what it controls with `aria-controls`, and
 * carries a label that says what will happen.
 *
 * The visual state stays in CSS via a class on the container — this module only
 * owns the button and the ARIA. Callers decide what "expanded" looks like.
 */

import { escapeHtml } from './string.js';

/**
 * Render a disclosure button.
 *
 * @param {Object} options
 * @param {string} options.controls - id of the element this shows/hides
 * @param {boolean} options.expanded - current state
 * @param {string} options.label - what the button does, e.g. "Show venues for Sunday"
 * @param {string} [options.className=''] - extra classes for the caller's styling
 * @param {boolean} [options.labelVisible=false] - when false the label is
 *   screen-reader-only, for buttons whose meaning is carried by adjacent visuals
 * @param {string} [options.icon=''] - Font Awesome classes for a visible icon
 * @returns {string} HTML string
 */
export function renderDisclosureButton({
    controls,
    expanded = false,
    label,
    className = '',
    labelVisible = false,
    icon = '',
}) {
    const iconHtml = icon ? `<i class="${escapeHtml(icon)}" aria-hidden="true"></i>` : '';
    const labelHtml = labelVisible
        ? escapeHtml(label)
        : `<span class="sr-only">${escapeHtml(label)}</span>`;
    const classes = `disclosure ${className}`.trim();

    return `<button type="button" class="${escapeHtml(classes)}" `
        + `aria-expanded="${expanded}" aria-controls="${escapeHtml(controls)}">`
        + `${iconHtml}${labelHtml}</button>`;
}

/**
 * Wire every disclosure button inside `root`.
 *
 * Delegated from `root`, so it survives re-renders of the content inside it and
 * does not need re-binding per button.
 *
 * @param {HTMLElement} root - container to listen on
 * @param {Object} [options]
 * @param {(button: HTMLElement, expanded: boolean) => void} [options.onToggle]
 *   Called after the state flips, for callers that persist it or update classes.
 * @returns {() => void} unbind
 */
export function bindDisclosure(root, { onToggle } = {}) {
    if (!root) return () => {};

    const handler = (e) => {
        const button = e.target.closest('.disclosure');
        if (!button || !root.contains(button)) return;

        const expanded = button.getAttribute('aria-expanded') === 'true';
        const next = !expanded;
        button.setAttribute('aria-expanded', String(next));

        if (onToggle) onToggle(button, next);
    };

    root.addEventListener('click', handler);
    return () => root.removeEventListener('click', handler);
}

/**
 * The element a disclosure button controls.
 * @param {HTMLElement} button
 * @returns {HTMLElement|null}
 */
export function disclosureTarget(button) {
    const id = button?.getAttribute('aria-controls');
    return id ? document.getElementById(id) : null;
}
