/**
 * Site chrome — one header and one footer for every page.
 *
 * The header and footer were hand-copied into five HTML files, and had drifted
 * four separate ways by the time #162 collected them:
 *
 *   - the Documentation footer link existed on two pages of five
 *   - the copyright read 2025 on four pages and 2026 on the fifth
 *   - about.html had a shouty holiday warning sitting in the brand-tagline slot,
 *     where the tagline belongs
 *   - index.html mounted its nav from JS while the other four hand-wrote the
 *     same anchor markup
 *
 * None of that is a bug a test would catch; it is what copied markup does. The
 * renderers below write into `[data-site-header]` and `[data-site-footer]`, so
 * a page declares the mount point and its own title, and everything shared
 * comes from here.
 *
 * The year is `getFullYear()`. A hardcoded year is wrong on 1 January and stays
 * wrong until somebody notices — which is exactly what happened.
 */

import { escapeHtml } from './utils/string.js';

/** Footer link set. One list, so a new link cannot land on some pages only. */
const FOOTER_LINKS = [
    { href: 'about.html', label: 'About Us' },
    { href: 'submit.html', label: 'Submit Venue' },
    { href: 'docs/index.html', label: 'Documentation' },
];

const SOCIAL_LINKS = [
    {
        href: 'https://www.facebook.com/groups/2494105004273043',
        title: 'Facebook',
        icon: 'fa-brands fa-facebook fa-lg',
    },
    {
        href: 'https://www.instagram.com/karaokedirectory/',
        title: 'Instagram',
        icon: 'fa-brands fa-instagram fa-lg',
    },
];

const SITE_NAME = 'Austin Karaoke Directory';

/**
 * Render the site header into `[data-site-header]`.
 *
 * index.html does NOT use this — it has a video-background header of its own.
 * It shares the footer renderer, which is where the drift actually was.
 *
 * @param {Object} [options]
 * @param {string} [options.title] - Brand line
 * @param {string} [options.tagline] - The line under it. A page-level notice is
 *   NOT a tagline; put that in a `.notice` in <main> (see about.html).
 * @param {boolean} [options.compact=false] - Tighter padding (bingo, bday)
 * @param {string} [options.icon] - Font Awesome classes for a leading icon
 * @returns {HTMLElement|null} the mount, or null when the page has none
 */
export function renderSiteHeader({
    title = 'Greater Austin Karaoke Directory',
    tagline = '',
    compact = false,
    icon = '',
} = {}) {
    const mount = document.querySelector('[data-site-header]');
    if (!mount) return null;

    const iconHtml = icon ? `<i class="${escapeHtml(icon)}"></i> ` : '';

    mount.innerHTML = `
        <header class="site-header${compact ? ' site-header--compact' : ''}">
            <div class="site-header__content">
                <h1 class="site-header__title">${iconHtml}${escapeHtml(title)}</h1>
                ${tagline ? `<p class="site-header__tagline">${escapeHtml(tagline)}</p>` : ''}
            </div>
        </header>
    `;
    return mount;
}

/**
 * Render the site footer into `[data-site-footer]`.
 * @returns {HTMLElement|null} the mount, or null when the page has none
 */
export function renderSiteFooter() {
    const mount = document.querySelector('[data-site-footer]');
    if (!mount) return null;

    const socials = SOCIAL_LINKS.map(s => `
                        <a href="${s.href}" target="_blank" rel="noopener noreferrer" title="${s.title}">
                            <i class="${s.icon}"></i>
                        </a>`).join('');

    const links = FOOTER_LINKS.map(l =>
        `<a href="${l.href}">${escapeHtml(l.label)}</a>`).join('\n                    ');

    mount.innerHTML = `
        <footer class="site-footer">
            <div class="site-footer__social">
                <h2>Follow Us</h2>
                <div class="social-links">${socials}
                </div>
            </div>

            <div class="site-footer__links">
                    ${links}
            </div>

            <p class="site-footer__copyright">
                &copy; ${new Date().getFullYear()} ${escapeHtml(SITE_NAME)}
            </p>
        </footer>
    `;
    return mount;
}

/**
 * Render both, for the pages that want the standard header.
 * @param {Object} [headerOptions] - Passed to renderSiteHeader
 */
export function renderSiteChrome(headerOptions) {
    renderSiteHeader(headerOptions);
    renderSiteFooter();
}
