/**
 * String manipulation utilities
 */

/**
 * Articles to ignore when sorting names alphabetically.
 * Add new articles here to affect sorting across the entire site.
 * Examples: English (the, a, an), Spanish (la, el, los, las)
 */
export const SORT_ARTICLES = ['a', 'an', 'the', 'le', 'la', 'l\'', 'les', 'un', 'une', 'des', 'el', 'lo', 'los', 'las', 'uno', 'una', 'unos', 'unas', 'il', 'i', 'gli', 'un\'', 'o', 'os', 'as', 'um', 'uma', 'uns', 'umas'];

const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

/**
 * Escape HTML special characters to prevent XSS.
 *
 * Safe in both text and quoted-attribute position — quotes are escaped, which
 * the previous implementation did not do. It set `textContent` and read back
 * `innerHTML`, and the HTML serializer only escapes `&`, `<`, `>` in a text
 * node; `"` and `'` came through untouched. Every
 * `attr="${escapeHtml(value)}"` site in the app was therefore one quote away
 * from attribute injection (see the regression cases in e2e/security.spec.js).
 *
 * `&quot;` and `&#39;` render as `"` and `'` in text position, so escaping
 * them costs nothing there.
 *
 * @param {*} str - Value to escape; non-strings are coerced
 * @returns {string} Escaped string, safe to interpolate into markup
 */
export function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

/**
 * Marker for values that are already trusted markup.
 *
 * `toString()` matters: `html` returns one of these, and `Component.render()`
 * does `container.innerHTML = this.template()`, which coerces. It also makes
 * nested `html` templates interpolate verbatim without needing `raw()` — the
 * outer tag recognises the marker.
 *
 * @see raw
 */
class RawMarkup {
    constructor(value) {
        this.value = value;
    }

    toString() {
        return this.value;
    }
}

/**
 * Mark a string as trusted markup so the `html` tag interpolates it verbatim.
 *
 * Use for nested template output — never for anything derived from a URL, a
 * form field, or venue data.
 *
 * @param {string} markup - Pre-rendered, already-safe HTML
 * @returns {RawMarkup}
 */
export function raw(markup) {
    return new RawMarkup(markup == null ? '' : String(markup));
}

/**
 * Tagged template that escapes every `${}` by default.
 *
 * Inverts the app's default: markup is safe unless a value is explicitly
 * wrapped in `raw()`, so forgetting to escape is no longer possible — you have
 * to opt in to danger.
 *
 *   html`<span>${userInput}</span>`              // escaped
 *   html`<div>${html`<b>${x}</b>`}</div>`        // nested: verbatim, x escaped
 *   html`<div>${raw(legacyStringBuilder())}</div>` // opt out explicitly
 *
 * Arrays are joined with no separator, each element escaped unless raw, which
 * makes `${items.map(...)}` behave as expected without a trailing `.join('')`.
 *
 * Only `null` and `undefined` collapse to an empty string. `false` and `0`
 * render as "false" and "0" — `aria-expanded="${isOpen}"` has to keep working,
 * so conditionals must be written as explicit ternaries ending in `: ''`,
 * which is the pattern this codebase already uses.
 *
 * @param {TemplateStringsArray} strings
 * @param {...*} values
 * @returns {RawMarkup} Assembled markup; stringifies on use
 */
export function html(strings, ...values) {
    return new RawMarkup(strings.reduce((out, chunk, i) => {
        const value = values[i - 1];
        return out + interpolate(value) + chunk;
    }));
}

function interpolate(value) {
    if (value instanceof RawMarkup) return value.value;
    if (Array.isArray(value)) return value.map(interpolate).join('');
    if (value == null) return '';
    // String() first: escapeHtml short-circuits on falsy input, so a bare
    // `false` or `0` would otherwise disappear from the output.
    return escapeHtml(String(value));
}

/**
 * Capitalize first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert string to title case
 * @param {string} str - String to convert
 * @returns {string} Title cased string
 */
export function titleCase(str) {
    if (!str) return '';
    return str.split(' ').map(capitalize).join(' ');
}

/**
 * Get sortable name (moves articles like "The" to end)
 * @param {string} name - Name to process
 * @returns {string} Sortable name
 */
export function getSortableName(name) {
    if (!name) return '';
    const words = name.trim().split(/\s+/);
    if (words.length > 1 && SORT_ARTICLES.includes(words[0].toLowerCase())) {
        return `${words.slice(1).join(' ')}, ${words[0]}`;
    }
    return name;
}

// Stage titles that precede a host's actual name. Sorting on the literal string
// scatters people by their prefix — "KJ Average Joe" lands under K, eight rows
// from "Average Joe" — so these are stripped for sort purposes only.
const HOST_TITLES = ['kj', 'dj', 'mc'];

/**
 * Get sortable host name: drops a leading stage title, then applies the same
 * article handling as venue names. Display is never changed — this is the sort
 * key only.
 *
 *   "KJ Average Joe"          → "Average Joe"
 *   "DJ Cysum & Mo"           → "Cysum & Mo"
 *   "The Karaoke Underground" → "Karaoke Underground, The"
 *
 * @param {string} name - Host or company name
 * @returns {string} Sortable form
 */
export function getSortableHostName(name) {
    if (!name) return '';
    const words = name.trim().split(/\s+/);
    const lead = words[0].toLowerCase().replace(/\./g, '');
    const withoutTitle = words.length > 1 && HOST_TITLES.includes(lead)
        ? words.slice(1).join(' ')
        : name;
    return getSortableName(withoutTitle);
}

/**
 * Convert string to URL-safe slug
 * @param {string} str - String to slugify
 * @returns {string} Slugified string
 */
export function slugify(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')  // Remove non-word chars
        .replace(/\s+/g, '-')       // Replace spaces with hyphens
        .replace(/-+/g, '-');       // Remove duplicate hyphens
}

/**
 * Truncate string to specified length with ellipsis
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
export function truncate(str, maxLength) {
    if (!str || str.length <= maxLength) return str || '';
    return str.slice(0, maxLength - 3) + '...';
}

/**
 * Check if string contains search term (case-insensitive)
 * @param {string} str - String to search in
 * @param {string} search - Search term
 * @returns {boolean} True if found
 */
export function containsIgnoreCase(str, search) {
    if (!str || !search) return false;
    return str.toLowerCase().includes(search.toLowerCase());
}

/**
 * Highlight search term in string with <mark> tags
 * @param {string} str - String to highlight in
 * @param {string} search - Search term
 * @returns {string} HTML string with highlights
 */
export function highlightSearch(str, search) {
    if (!str || !search) return escapeHtml(str);
    const escaped = escapeHtml(str);
    const regex = new RegExp(`(${escapeRegex(search)})`, 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
}

/**
 * Escape special regex characters in string
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for regex
 */
export function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format phone number to (XXX) XXX-XXXX
 * @param {string} phone - Phone number string
 * @returns {string} Formatted phone number
 */
export function formatPhone(phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits[0] === '1') {
        return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
}

/**
 * Strip HTML tags from string
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
export function stripHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}
