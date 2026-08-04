/**
 * Venue submission form.
 *
 * This was 803 lines of inline <script> in submit.html, with 20 function
 * definitions, 12 `on*` attributes reaching into them as globals, and its own
 * re-implementations of helpers the app already had — three more ways to escape
 * HTML, and a hand-rolled `generateVenueId` beside the unused `slugify` in
 * js/utils/string.js (#168).
 *
 * The two slug implementations diverged in both directions, and each could emit
 * ids the schema rejects:
 *
 *   "  Leading and trailing  "  generateVenueId -> "-leading-and-trailing-"  x
 *   "Cafe_Blue"                 slugify         -> "cafe_blue"              x
 *
 * The curator fixed those by hand. slugify is now the only one and is asserted
 * against schema/venue.schema.json's id pattern in test/string.test.mjs.
 */

import { escapeHtml, slugify } from './utils/string.js';
import { initTagConfig, renderTagBadge } from './utils/tags.js';

// Tag ids that are *not* user-selectable as checkboxes:
//   - 'dedicated' is set by venue.dedicated:true at the curator level
//   - 'special-event' is auto-applied to schedule entries with frequency:"once"
//   - age tags ('21+', '18+', 'all-ages', 'family-friendly') have their own
//     radio group below the checkbox grid and merge into the tags array
//     at submit time.
const TAG_GRID_EXCLUDE = new Set([
    'dedicated', 'special-event',
    '21+', '18+', 'all-ages', 'family-friendly',
]);

// Tag definitions and the host registries are fetched from js/data.json
// (ADR-008) and cached here, so the submit handler can read them without
// refetching. The venue listings are never needed on this page.
let tagDefinitions = {};
let knownKjs = {};        // id → { name, ... }  (ADR-007 registries)
let knownCompanies = {};

function getUserSelectableTagIds() {
    return Object.keys(tagDefinitions).filter(id => !TAG_GRID_EXCLUDE.has(id));
}

/**
 * Resolve a typed host name to a registry id, exact and case-insensitive.
 * A submitter who picks a datalist suggestion lands here; anyone typing a
 * new name doesn't, and their text is passed through for the curator to
 * reconcile. Returns null when there's no match.
 */
function matchRegistryId(registry, typed) {
    const q = (typed || '').trim().toLowerCase();
    if (!q) return null;
    const hit = Object.entries(registry).find(([, e]) => (e.name || '').trim().toLowerCase() === q);
    return hit ? hit[0] : null;
}

/** Fill a <datalist> with the registry's names, so typing suggests known hosts. */
function populateHostSuggestions() {
    for (const [listId, registry] of [['known-kjs', knownKjs], ['known-companies', knownCompanies]]) {
        const list = document.getElementById(listId);
        if (!list) continue;
        list.innerHTML = Object.values(registry)
            .map(e => e.name)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
            .map(n => `<option value="${n.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"></option>`)
            .join('');
    }
}

// Generate the tag-checkbox grid from data.json's tagDefinitions so that
// adding a tag there auto-surfaces in the submit form — no parallel
// hardcoded list to keep in sync (#101).
(async function populateTagCheckboxes() {
    const grid = document.getElementById('tag-checkbox-grid');
    if (!grid) return;

    try {
        const response = await fetch('js/data.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        tagDefinitions = data.tagDefinitions || {};
        knownKjs = data.kjs || {};
        knownCompanies = data.companies || {};
        populateHostSuggestions();
    } catch (error) {
        console.error('Could not load tag definitions from js/data.json:', error);
        grid.innerHTML = '<p class="validation-error">Could not load the tag list. Everything else on this form still works.</p>';
        return;
    }

    // Chips come from the directory's own renderer, so this form and the venue
    // cards cannot drift apart again (#166). initTagConfig also injects the
    // [data-tag] colour stylesheet, which replaced the inline style= that used
    // to sit on each badge. Now a static import — #168 made this file a module.
    initTagConfig(tagDefinitions);

    grid.innerHTML = getUserSelectableTagIds().map(id => `
            <label class="tag-checkbox-option">
                <input type="checkbox" name="tag-${id}" value="${id}">
                ${renderTagBadge(id)}
            </label>`).join('');
})();

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
    maxSubmissions: 3,      // Max submissions allowed
    windowMs: 60 * 60 * 1000, // Time window: 1 hour in milliseconds
    storageKey: 'karaoke-submit-history'
};

// Email configuration
const EMAIL_ADDRESS = 'karaokedirectoryatx@gmail.com';

// No APPS_SCRIPT_URL here any more. The form does not post anywhere — it
// composes an email (see presentSubmission). The Apps Script source is kept in
// backend/Code.gs for when a server exists; until then a URL constant in this
// file only invited an attempt that could not succeed (#168).

let scheduleCount = 1;

// Toggle submitter type - show/hide required indicators, auto-expand details for KJ
function toggleSubmitterType() {
    const isKJ = document.querySelector('input[name="submitter-type"]:checked')?.value === 'kj';

    // Toggle required indicators
    document.getElementById('name-required').style.display = isKJ ? 'inline' : 'none';
    document.getElementById('contact-required').style.display = isKJ ? 'inline' : 'none';

    // Update hint text
    const hint = document.getElementById('contact-hint');
    hint.textContent = isKJ
        ? 'Required - please provide at least one contact method'
        : 'Optional - provide if you\'d like us to reach out';

    // Auto-expand the optional details when KJ identifies themselves,
    // and scroll the contact section into view so they see what's needed.
    if (isKJ) {
        const details = document.querySelector('.more-details');
        if (details && !details.open) details.open = true;
        const submitterField = document.getElementById('submitter-name');
        if (submitterField) {
            setTimeout(() => submitterField.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        }
    }

    // Clear errors when switching
    document.getElementById('name-error').style.display = 'none';
    document.getElementById('contact-error').style.display = 'none';
}

// Toggle individual contact input visibility
function toggleContactInput(type) {
    const checkbox = document.querySelector(`input[name="contact-${type}-check"]`);
    const inputDiv = document.getElementById(`contact-${type}-input`);

    if (checkbox.checked) {
        inputDiv.classList.remove('hidden');
        inputDiv.querySelector('input, textarea')?.focus();
    } else {
        inputDiv.classList.add('hidden');
        const input = inputDiv.querySelector('input, textarea');
        if (input) input.value = '';
    }

    // Clear contact error when any checkbox is checked
    document.getElementById('contact-error').style.display = 'none';
}

// Validate submitter info (name required for KJ, contact required for KJ)
function validateSubmitterInfo() {
    const isKJ = document.querySelector('input[name="submitter-type"]:checked')?.value === 'kj';

    if (!isKJ) return true; // No validation needed for fans

    let isValid = true;

    // Make sure the optional details panel is open so errors are visible
    const details = document.querySelector('.more-details');
    if (details && !details.open) details.open = true;

    // Validate name for KJ
    const name = document.getElementById('submitter-name').value.trim();
    if (!name) {
        document.getElementById('name-error').style.display = 'block';
        document.getElementById('submitter-name').scrollIntoView({ behavior: 'smooth', block: 'center' });
        isValid = false;
    } else {
        document.getElementById('name-error').style.display = 'none';
    }

    // Validate contact for KJ
    const emailCheck = document.querySelector('input[name="contact-email-check"]').checked;
    const textCheck = document.querySelector('input[name="contact-text-check"]').checked;
    const callCheck = document.querySelector('input[name="contact-call-check"]').checked;
    const otherCheck = document.querySelector('input[name="contact-other-check"]').checked;

    const email = document.querySelector('input[name="contact-email"]').value.trim();
    const text = document.querySelector('input[name="contact-text"]').value.trim();
    const call = document.querySelector('input[name="contact-call"]').value.trim();
    const other = document.querySelector('textarea[name="contact-other"]').value.trim();

    const hasValidContact =
        (emailCheck && email) ||
        (textCheck && text) ||
        (callCheck && call) ||
        (otherCheck && other);

    if (!hasValidContact) {
        document.getElementById('contact-error').style.display = 'block';
        if (isValid) {
            document.getElementById('contact-error').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        isValid = false;
    } else {
        document.getElementById('contact-error').style.display = 'none';
    }

    return isValid;
}

// Check rate limit on page load
document.addEventListener('DOMContentLoaded', function() {
    checkRateLimit();
});

function getSubmissionHistory() {
    try {
        const history = localStorage.getItem(RATE_LIMIT_CONFIG.storageKey);
        return history ? JSON.parse(history) : [];
    } catch (e) {
        return [];
    }
}

function saveSubmission() {
    const history = getSubmissionHistory();
    history.push(Date.now());
    localStorage.setItem(RATE_LIMIT_CONFIG.storageKey, JSON.stringify(history));
}

function checkRateLimit() {
    const history = getSubmissionHistory();
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_CONFIG.windowMs;

    const recentSubmissions = history.filter(timestamp => timestamp > windowStart);
    localStorage.setItem(RATE_LIMIT_CONFIG.storageKey, JSON.stringify(recentSubmissions));

    const messageEl = document.getElementById('rate-limit-message');
    const submitBtn = document.getElementById('submit-btn');

    if (recentSubmissions.length >= RATE_LIMIT_CONFIG.maxSubmissions) {
        const oldestRecent = Math.min(...recentSubmissions);
        const resetTime = new Date(oldestRecent + RATE_LIMIT_CONFIG.windowMs);
        const minutesRemaining = Math.ceil((resetTime - now) / (60 * 1000));

        messageEl.textContent = `You've reached the submission limit (${RATE_LIMIT_CONFIG.maxSubmissions} per hour). Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`;
        messageEl.classList.add('error');
        messageEl.style.display = 'block';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        submitBtn.style.cursor = 'not-allowed';
        return false;
    } else if (recentSubmissions.length >= RATE_LIMIT_CONFIG.maxSubmissions - 1) {
        messageEl.textContent = `You have 1 submission remaining this hour.`;
        messageEl.classList.remove('error');
        messageEl.style.display = 'block';
    } else {
        messageEl.style.display = 'none';
    }

    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitBtn.style.cursor = 'pointer';
    return true;
}

function addScheduleEntry() {
    const container = document.getElementById('schedule-entries');
    const entry = document.createElement('div');
    entry.className = 'schedule-entry';
    entry.dataset.index = scheduleCount;

    entry.innerHTML = `
        <div class="form-group">
            <label>Frequency</label>
            <select name="frequency-${scheduleCount}">
                <option value="every">Every</option>
                <option value="first">First</option>
                <option value="second">Second</option>
                <option value="third">Third</option>
                <option value="fourth">Fourth</option>
                <option value="last">Last</option>
                <option value="once">One-Time Event</option>
            </select>
        </div>
        <div class="form-group schedule-day-group">
            <label>Day</label>
            <select name="day-${scheduleCount}">
                <option value="">Select day...</option>
                <option value="Sunday">Sunday</option>
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
            </select>
        </div>
        <div class="form-group schedule-date-group" style="display: none;">
            <label>Date</label>
            <input type="date" name="date-${scheduleCount}">
        </div>
        <div class="form-group schedule-event-name-group" style="display: none;">
            <label>Event Name</label>
            <input type="text" name="eventName-${scheduleCount}" placeholder="e.g., Birthday Bash">
        </div>
        <div class="form-group">
            <label>Start Time</label>
            <input type="time" name="startTime-${scheduleCount}" value="21:00">
        </div>
        <div class="form-group">
            <label>End Time</label>
            <input type="time" name="endTime-${scheduleCount}" value="01:00">
        </div>
        <div class="form-group schedule-event-url-group">
            <label>Event URL</label>
            <input type="url" name="eventUrl-${scheduleCount}" inputmode="url" placeholder="https://...">
        </div>
        <button type="button" class="remove-schedule-btn">
            <i class="fa-solid fa-trash"></i> Remove
        </button>
    `;

    container.appendChild(entry);
    scheduleCount++;
}

// Toggle schedule fields based on frequency selection
function toggleScheduleFields(select) {
    const entry = select.closest('.schedule-entry');
    const isOnce = select.value === 'once';

    const dayGroup = entry.querySelector('.schedule-day-group');
    const dateGroup = entry.querySelector('.schedule-date-group');
    const eventNameGroup = entry.querySelector('.schedule-event-name-group');

    if (dayGroup) dayGroup.style.display = isOnce ? 'none' : '';
    if (dateGroup) dateGroup.style.display = isOnce ? '' : 'none';
    if (eventNameGroup) eventNameGroup.style.display = isOnce ? '' : 'none';

    const daySelect = entry.querySelector('[name^="day-"]');
    const dateInput = entry.querySelector('[name^="date-"]');
    if (daySelect) daySelect.required = !isOnce;
    if (dateInput) dateInput.required = isOnce;
}

function removeScheduleEntry(btn) {
    btn.closest('.schedule-entry').remove();
}

function collectFormData() {
    const form = document.getElementById('venue-form');
    const formData = new FormData(form);

    // Check honeypot
    if (formData.get('website_url')) {
        return null; // Bot detected
    }

    const venueName = formData.get('venue-name')?.trim();
    if (!venueName) return null;

    // Collect schedule entries
    const scheduleEntries = document.querySelectorAll('.schedule-entry');
    const schedule = [];

    scheduleEntries.forEach((entry) => {
        const index = entry.dataset.index;
        const frequency = formData.get(`frequency-${index}`);
        const day = formData.get(`day-${index}`);
        const date = formData.get(`date-${index}`);
        const eventName = formData.get(`eventName-${index}`)?.trim();
        const eventUrl = formData.get(`eventUrl-${index}`)?.trim();
        const startTime = formData.get(`startTime-${index}`) || '21:00';
        const endTime = formData.get(`endTime-${index}`) || '01:00';

        if (frequency === 'once') {
            if (date) {
                const scheduleEntry = {
                    frequency: 'once',
                    date: date,
                    startTime: startTime,
                    endTime: endTime
                };
                if (eventName) scheduleEntry.eventName = eventName;
                if (eventUrl) scheduleEntry.eventUrl = eventUrl;
                schedule.push(scheduleEntry);
            }
        } else if (day) {
            const scheduleEntry = {
                frequency: frequency,
                day: day,
                startTime: startTime,
                endTime: endTime
            };
            if (eventUrl) scheduleEntry.eventUrl = eventUrl;
            schedule.push(scheduleEntry);
        }
    });

    // Collect tags — iterate the same id list used to render the grid
    // so adding a tag in data.json flows through both directions automatically.
    const tags = [];
    getUserSelectableTagIds().forEach(tag => {
        if (formData.get(`tag-${tag}`)) tags.push(tag);
    });

    // Age restriction is a radio, but it merges into the tags array — the
    // schema represents age as a tag, not a separate field (#101 shape parity).
    const ageRestriction = formData.get('age-restriction');
    if (ageRestriction) tags.push(ageRestriction);

    // Build venue object matching schema/venue.schema.json. Required
    // fields (street, city, zip) are guarded by validation before this
    // function runs, so we don't fall back to empty strings — that would
    // emit a shape the curator and CI would reject.
    const venue = {
        id: slugify(venueName),
        name: venueName,
        address: {
            street: formData.get('street').trim(),
            city: formData.get('city').trim() || 'Austin',
            state: (formData.get('state')?.trim() || 'TX'),
            zip: formData.get('zip').trim(),
        },
        schedule: schedule
    };

    // Optional fields — only set when there's something to set so the
    // emitted shape contains no empty strings or empty arrays.
    const neighborhood = formData.get('neighborhood')?.trim();
    if (neighborhood) venue.address.neighborhood = neighborhood;

    if (tags.length > 0) venue.tags = tags;

    // activePeriod inputs aren't in the slim submit form (curator handles
    // seasonal windows) — leaving the read in case they come back later.
    const activePeriodStart = formData.get('active-period-start')?.trim();
    const activePeriodEnd = formData.get('active-period-end')?.trim();
    if (activePeriodStart) {
        venue.activePeriod = { start: activePeriodStart };
        if (activePeriodEnd) venue.activePeriod.end = activePeriodEnd;
    }

    // Optional: host info. Schema requires name OR affiliation when host
    // exists, so we don't emit a website-only host — the curator would
    // need at least one identifying field to do anything with it.
    const hostName = formData.get('host-name')?.trim();
    const affiliation = formData.get('affiliation')?.trim();
    const hostWebsite = formData.get('host-website')?.trim();

    // Prefer a registry ref (ADR-007) when the typed names resolve to known
    // hosts — that's a submission the curator can accept as-is. Anything
    // unrecognised falls back to the legacy inline shape for reconciliation.
    //
    // It's all-or-nothing per host: the schema's oneOf forbids mixing ids
    // with free text, so one new name means the whole host stays inline.
    const kjId = matchRegistryId(knownKjs, hostName);
    const companyId = matchRegistryId(knownCompanies, affiliation);
    const kjResolved = !hostName || kjId;
    const companyResolved = !affiliation || companyId;

    let hostNote = '';
    if (hostName || affiliation) {
        if (kjResolved && companyResolved) {
            venue.host = {};
            if (kjId) venue.host.kjId = kjId;
            if (companyId) venue.host.companyId = companyId;

            const matched = [
                kjId ? `KJ "${hostName}" → kjs/${kjId}` : null,
                companyId ? `company "${affiliation}" → companies/${companyId}` : null,
            ].filter(Boolean).join('\n');
            hostNote = `Matched existing registry entries — host can be accepted as-is:\n${matched}`;

            // The website is deliberately dropped from the JSON: it belongs on
            // the registry record, not the venue, and the submitter can't say
            // which of the two it's for. Carried here so it isn't lost.
            if (hostWebsite) {
                hostNote += `\n\nSubmitter also gave a website: ${hostWebsite}`
                    + `\n(Not in the JSON — add it to whichever registry entry it belongs to.)`;
            }
        } else {
            venue.host = {};
            if (hostName) venue.host.name = hostName;
            if (affiliation) venue.host.affiliation = affiliation;
            if (hostWebsite) venue.host.website = hostWebsite;

            const unknown = [
                hostName && !kjId ? `KJ "${hostName}"` : null,
                affiliation && !companyId ? `company "${affiliation}"` : null,
            ].filter(Boolean).join(' and ');
            hostNote = `NOT in the registries yet: ${unknown}.`
                + `\nHost is written inline below — create the registry entry (or pick the right existing one) before adding.`;
        }
    }

    // Optional: Venue socials
    const venueWebsite = formData.get('venue-website')?.trim();
    const venueFacebook = formData.get('venue-facebook')?.trim();
    const venueInstagram = formData.get('venue-instagram')?.trim();
    const venueTwitter = formData.get('venue-twitter')?.trim();
    const venueTiktok = formData.get('venue-tiktok')?.trim();
    const venueYoutube = formData.get('venue-youtube')?.trim();
    const venueBluesky = formData.get('venue-bluesky')?.trim();

    if (venueWebsite || venueFacebook || venueInstagram || venueTwitter || venueTiktok || venueYoutube || venueBluesky) {
        venue.socials = {};
        if (venueWebsite) venue.socials.website = venueWebsite;
        if (venueFacebook) venue.socials.facebook = venueFacebook;
        if (venueInstagram) venue.socials.instagram = venueInstagram;
        if (venueTwitter) venue.socials.twitter = venueTwitter;
        if (venueTiktok) venue.socials.tiktok = venueTiktok;
        if (venueYoutube) venue.socials.youtube = venueYoutube;
        if (venueBluesky) venue.socials.bluesky = venueBluesky;
    }

    // Collect metadata
    const notes = formData.get('notes')?.trim();
    const submitterName = formData.get('submitter-name')?.trim();
    const submitterType = formData.get('submitter-type');

    // Collect contact info (for both fans and KJs)
    const contactMethods = [];
    if (formData.get('contact-email-check')) {
        const email = formData.get('contact-email')?.trim();
        if (email) contactMethods.push({ type: 'email', value: email });
    }
    if (formData.get('contact-text-check')) {
        const text = formData.get('contact-text')?.trim();
        if (text) contactMethods.push({ type: 'text', value: text });
    }
    if (formData.get('contact-call-check')) {
        const call = formData.get('contact-call')?.trim();
        if (call) contactMethods.push({ type: 'call', value: call });
    }
    if (formData.get('contact-other-check')) {
        const other = formData.get('contact-other')?.trim();
        if (other) contactMethods.push({ type: 'other', value: other });
    }

    return {
        venue,
        notes,
        submitterName,
        submitterType,
        contactMethods,
        hostNote
    };
}

function formatEmailBody(data) {
    if (!data) return null;

    const isKJ = data.submitterType === 'kj';

    let body = 'NEW VENUE SUBMISSION\n';
    body += '='.repeat(40) + '\n\n';

    // Submitter info
    body += 'SUBMITTED BY:\n';
    if (data.submitterName) {
        body += `Name: ${data.submitterName}\n`;
    }
    body += `Type: ${isKJ ? 'KJ / Host' : 'Fan / Patron'}\n`;

    // Contact info (for both fans and KJs)
    if (data.contactMethods && data.contactMethods.length > 0) {
        body += `\n${isKJ ? 'KJ ' : ''}CONTACT PREFERENCES:\n`;
        data.contactMethods.forEach(method => {
            const labels = {
                email: 'Email',
                text: 'Phone (Text)',
                call: 'Phone (Call)',
                other: 'Other'
            };
            body += `- ${labels[method.type]}: ${method.value}\n`;
        });
    }
    body += '\n';

    // Host note: say whether the JSON below carries registry refs (accept
    // as-is) or free text (needs reconciling), and carry any website that
    // the ref shape can't hold.
    if (data.hostNote) {
        body += 'HOST:\n' + data.hostNote + '\n\n';
    }

    body += 'VENUE JSON (copy/paste ready):\n';
    body += '-'.repeat(40) + '\n';
    body += JSON.stringify(data.venue, null, 2);
    body += '\n' + '-'.repeat(40) + '\n\n';

    if (data.notes) {
        body += 'ADDITIONAL NOTES:\n';
        body += data.notes + '\n\n';
    }

    body += 'TODO:\n';
    body += '- [ ] Verify venue information\n';
    body += '- [ ] Add coordinates (lat/lng)\n';
    body += '- [ ] Add to data.json (validate with: node scripts/validate-data.js)\n';
    if (isKJ) {
        body += '- [ ] Contact KJ to confirm details\n';
    }

    return body;
}

// ---- API Submission with Fallback ----

/**
 * Hand the finished submission to the visitor's email client.
 *
 * This form does not post anywhere. There is no server yet: it composes a
 * message and offers two ways to send it — open the mail app, or copy the text.
 *
 * It used to POST to an Apps Script endpoint first and only fall back to email
 * when that threw, which meant the normal path announced "Couldn't reach the
 * server" in an error style over a submission that was fine. The email IS the
 * submission (#168).
 *
 * `payload` is still built and still shaped by the schema — the curator
 * reconciles it by hand, and keeping the shape means it can be posted the day a
 * server exists. See backend/Code.gs.
 */
function presentSubmission(payload, emailSubject, emailBody, submitBtn) {
    saveSubmission();
    checkRateLimit();

    const mailtoLink = `mailto:${EMAIL_ADDRESS}?subject=${encodeURIComponent(emailSubject)}`
        + `&body=${encodeURIComponent(emailBody)}`;

    const successEl = document.getElementById('success-message');
    successEl.className = 'success-message';
    successEl.innerHTML = `
        <i class="fa-solid fa-envelope-circle-check"></i>
        <strong>Your submission is ready to send.</strong><br>
        Send it with either option below and we'll take it from there.
        <div class="fallback-options">
            <a href="${mailtoLink}" class="btn btn--primary">
                <i class="fa-solid fa-envelope"></i> Open in Email App
            </a>
            <button type="button" class="btn btn--secondary" data-action="show-copy-fallback">
                <i class="fa-solid fa-copy"></i> Copy the Text Instead
            </button>
        </div>
        <div id="copy-fallback" class="copy-fallback" style="display: none;">
            <p class="copy-fallback__label">Copy the text below and email it to <strong>${EMAIL_ADDRESS}</strong>:</p>
            <textarea class="copy-fallback__text" readonly>${escapeHtml(emailBody)}</textarea>
            <button type="button" class="btn btn--primary" data-action="copy-fallback-text">
                <i class="fa-solid fa-copy"></i> Copy Text
            </button>
        </div>
    `;
    successEl.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Show the copy-paste fallback area
function showCopyFallback() {
    const el = document.getElementById('copy-fallback');
    if (el) el.style.display = 'block';
}

// Copy fallback textarea contents to clipboard
function copyFallbackText() {
    const textarea = document.querySelector('.copy-fallback__text');
    if (!textarea) return;
    navigator.clipboard.writeText(textarea.value)
        .then(() => {
            const btn = textarea.nextElementSibling;
            if (btn) {
                const original = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                setTimeout(() => { btn.innerHTML = original; }, 2000);
            }
        })
        .catch(() => {
            textarea.select();
            alert('Please press Ctrl+C / Cmd+C to copy the selected text.');
        });
}

// Inline error helper - shows a message and scrolls the offender into view
function showInlineError(target, message) {
    // Remove existing inline error if present
    target.parentElement.querySelectorAll('.field-error--inline').forEach(el => el.remove());

    const err = document.createElement('div');
    err.className = 'field-error--inline validation-error';
    err.textContent = message;
    target.parentElement.appendChild(err);
    target.setAttribute('aria-invalid', 'true');
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Auto-clear when user starts typing/selecting
    const clear = () => {
        err.remove();
        target.removeAttribute('aria-invalid');
        target.removeEventListener('input', clear);
        target.removeEventListener('change', clear);
    };
    target.addEventListener('input', clear);
    target.addEventListener('change', clear);
}

// Form submission
document.getElementById('venue-form').addEventListener('submit', function(e) {
    e.preventDefault();

    // Check rate limit
    if (!checkRateLimit()) {
        return;
    }

    // Validate required fields inline (we use novalidate on the form so we control the UX)
    const requiredFields = [
        ['venue-name', 'Venue name is required'],
        ['street', 'Street address is required'],
        ['city', 'City is required'],
        ['zip', 'ZIP code is required']
    ];

    for (const [id, msg] of requiredFields) {
        const el = document.getElementById(id);
        if (!el.value.trim()) {
            showInlineError(el, msg);
            return;
        }
    }

    // Schedule must have at least one valid day or date
    const firstSchedule = document.querySelector('.schedule-entry');
    const firstFrequency = firstSchedule?.querySelector('[name^="frequency-"]')?.value;
    const firstDay = firstSchedule?.querySelector('[name^="day-"]')?.value;
    const firstDate = firstSchedule?.querySelector('[name^="date-"]')?.value;
    if (firstFrequency === 'once' && !firstDate) {
        showInlineError(firstSchedule.querySelector('[name^="date-"]'), 'Pick a date for the one-time event');
        return;
    }
    if (firstFrequency !== 'once' && !firstDay) {
        showInlineError(firstSchedule.querySelector('[name^="day-"]'), 'Pick the day of the week');
        return;
    }

    // Validate submitter info (name and contact required for KJs)
    if (!validateSubmitterInfo()) {
        return;
    }

    const data = collectFormData();

    if (!data) {
        // Honeypot tripped or empty — fail silently
        return;
    }

    const emailBody = formatEmailBody(data);
    const subject = `New Venue Submission: ${data.venue.name}`;
    const submitBtn = document.getElementById('submit-btn');

    const payload = {
        type: 'venue',
        venue: data.venue,
        notes: data.notes,
        submitterName: data.submitterName,
        submitterType: data.submitterType,
        contactMethods: data.contactMethods,
        honeypot: document.getElementById('website_url').value,
        emailBody: emailBody
    };

    presentSubmission(payload, subject, emailBody, submitBtn);
});

/* ------------------------------------------------------------------ events --
 *
 * The markup used to carry 12 `on*` attributes, which only work because every
 * handler was a global — the one thing a module cannot provide, and the reason
 * this file could not become one until now.
 *
 * Delegated from document, so entries added later (schedule rows, the fallback
 * panel built in a catch block) are covered without rebinding.
 */

document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('select[name^="frequency-"]')) {
        toggleScheduleFields(t);
    } else if (t.matches('input[name="submitter-type"]')) {
        toggleSubmitterType();
    } else if (t.matches('[data-contact-toggle]')) {
        toggleContactInput(t.dataset.contactToggle);
    }
});

document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    if (btn.matches('.add-schedule-btn')) {
        addScheduleEntry();
    } else if (btn.matches('.remove-schedule-btn')) {
        removeScheduleEntry(btn);
    } else if (btn.matches('[data-action="show-copy-fallback"]')) {
        showCopyFallback();
    } else if (btn.matches('[data-action="copy-fallback-text"]')) {
        copyFallbackText();
    }
});
