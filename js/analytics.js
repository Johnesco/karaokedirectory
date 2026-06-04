/**
 * Consent-gated Microsoft Clarity loader.
 *
 * Why this lives in its own file:
 * Clarity sets non-essential cookies, so loading it before consent would
 * violate GDPR/ePrivacy. We render a banner on first visit and only
 * load the tag if the visitor clicks Accept. Choice persists in
 * localStorage so the banner only appears once.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'kd_analytics_consent';
    var CLARITY_ID = 'x1sfnv6zu4';

    function getConsent() {
        try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    }

    function setConsent(value) {
        try { localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* private mode etc. */ }
    }

    function loadClarity() {
        (function (c, l, a, r, i, t, y) {
            c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
            t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
            y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
        })(window, document, 'clarity', 'script', CLARITY_ID);
    }

    function renderBanner() {
        var banner = document.createElement('div');
        banner.className = 'consent-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-label', 'Analytics consent');
        banner.innerHTML =
            '<p class="consent-banner__text">' +
                'This site uses Microsoft Clarity for anonymous traffic analytics ' +
                '(pageviews, clicks, scrolling). No personal information is collected. ' +
                '<a href="about.html#privacy">Learn more</a>.' +
            '</p>' +
            '<div class="consent-banner__actions">' +
                '<button type="button" class="consent-banner__btn consent-banner__btn--decline" data-consent="declined">Decline</button>' +
                '<button type="button" class="consent-banner__btn consent-banner__btn--accept" data-consent="accepted">Accept</button>' +
            '</div>';
        banner.addEventListener('click', function (e) {
            var choice = e.target && e.target.getAttribute('data-consent');
            if (!choice) return;
            setConsent(choice);
            banner.remove();
            if (choice === 'accepted') loadClarity();
        });
        document.body.appendChild(banner);
    }

    var consent = getConsent();
    if (consent === 'accepted') {
        loadClarity();
    } else if (consent !== 'declined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', renderBanner);
        } else {
            renderBanner();
        }
    }
})();
