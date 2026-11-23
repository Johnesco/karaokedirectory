/**
 * GoatCounter page-view analytics (#467, spec §23).
 *
 * GoatCounter sets no cookies and collects no personal data, so there is no
 * consent banner: the script loads on every page view. It replaced Microsoft
 * Clarity, which recorded sessions, set cookies and needed the banner.
 *
 * Production only. Dev servers, the e2e server and Netlify deploy previews
 * never request gc.zgo.at, so they are neither counted nor dependent on it.
 *
 * One file, loaded with `defer` by every page (the four public pages and the
 * generated entity pages), so changing the counter is a one-file change.
 */
(function () {
    'use strict';

    var PRODUCTION_HOSTS = ['karaokedirectory.com', 'www.karaokedirectory.com'];
    var COUNT_URL = 'https://karaokedirectory.goatcounter.com/count';
    var SCRIPT_URL = 'https://gc.zgo.at/count.js';

    // The consent choice Clarity's banner stored. Nothing reads it now.
    try { localStorage.removeItem('kd_analytics_consent'); } catch (e) { /* private mode etc. */ }

    if (PRODUCTION_HOSTS.indexOf(location.hostname) === -1) return;

    var script = document.createElement('script');
    script.async = true;
    script.src = SCRIPT_URL;
    script.setAttribute('data-goatcounter', COUNT_URL);
    document.head.appendChild(script);
})();
