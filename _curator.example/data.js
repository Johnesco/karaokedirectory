/**
 * Curator master data — TEMPLATE.
 *
 * Copy this file (along with the rest of _curator.example/) to a new
 * _curator/ folder, then replace the empty objects below with the contents
 * of the current js/data.js. After bootstrap, this is your single source of
 * truth — edit here, then run `node scripts/build-public-data.js` (or just
 * commit; the pre-commit hook runs the build for you) to regenerate js/data.js
 * with all _curatorMeta fields stripped.
 *
 * Each listing may carry an optional _curatorMeta field with your private
 * notes (source, contact, lastVerified, etc.). The build strips these from
 * the public output. They never leave your machine.
 *
 * Example _curatorMeta shape:
 *   _curatorMeta: {
 *     source: "https://facebook.com/venue/posts/12345",
 *     sourceNotes: "Saw their March 2025 announcement",
 *     contact: {
 *       name: "Sarah Manager",
 *       role: "Owner",
 *       phone: "512-555-1234",
 *       email: "sarah@example.com"
 *     },
 *     notes: "Confirmed via phone 5/15/26. Quiet on holidays.",
 *     lastVerified: "2026-05-15"
 *   }
 */
const curatorMasterData = {
    tagDefinitions: {
        // Paste tagDefinitions from js/data.js here on bootstrap
    },
    listings: [
        // Paste listings from js/data.js here on bootstrap; add _curatorMeta as you go
    ]
};

// Dual export so this file works in both the browser (editor.html, dashboard)
// and Node (build script, hook).
if (typeof window !== 'undefined') window.curatorMasterData = curatorMasterData;
if (typeof module !== 'undefined') module.exports = curatorMasterData;
