/**
 * Venue Editor - Main Application
 */

import { renderVenueCard } from '../js/components/VenueCard.js';
import { formatTimeRange } from '../js/utils/date.js';
import { escapeHtml, getSortableName } from '../js/utils/string.js';
import { buildMapUrl, formatAddress, createSocialLinks } from '../js/utils/url.js';
import { renderTags, initTagConfig } from '../js/utils/tags.js';

// State
let venues = [];
let tagDefinitions = {};
let selectedVenueId = null;
let hasUnsavedChanges = false;
const STORAGE_KEY = 'karaoke-editor-draft';
const PREVIEW_STATE_KEY = 'karaoke-editor-preview';

// DOM Elements
const elements = {
    venueList: document.getElementById('venue-list'),
    venueCount: document.getElementById('venue-count'),
    venueSearch: document.getElementById('venue-search'),
    venueForm: document.getElementById('venue-form'),
    noVenueSelected: document.getElementById('no-venue-selected'),
    scheduleList: document.getElementById('schedule-list'),
    tagSelector: document.getElementById('tag-selector'),
    tagDefinitionsList: document.getElementById('tag-definitions-list'),
    tagDefinitionsEditor: document.getElementById('tag-definitions-editor'),
    previewCard: document.getElementById('preview-card'),
    previewModal: document.getElementById('preview-modal'),
    previewJson: document.getElementById('preview-json-content'),
    toastContainer: document.getElementById('toast-container')
};

/**
 * Toggle preview panel visibility
 */
function togglePreviewPanel() {
    const main = document.querySelector('.editor-main');
    const preview = document.querySelector('.editor-preview');
    const btn = document.getElementById('btn-toggle-preview');

    const isVisible = main.classList.toggle('preview-visible');
    main.classList.toggle('preview-hidden', !isVisible);
    preview.classList.toggle('hidden', !isVisible);
    btn.classList.toggle('preview-visible', isVisible);
    btn.classList.toggle('preview-hidden', !isVisible);

    // Update button icon
    const icon = btn.querySelector('i');
    icon.className = isVisible ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';

    // Save preference
    localStorage.setItem(PREVIEW_STATE_KEY, isVisible ? 'visible' : 'hidden');
}

/**
 * Initialize preview panel state from localStorage
 */
function initPreviewState() {
    const saved = localStorage.getItem(PREVIEW_STATE_KEY);
    const main = document.querySelector('.editor-main');
    const preview = document.querySelector('.editor-preview');
    const btn = document.getElementById('btn-toggle-preview');

    // Default to visible on large screens, hidden on small
    const isLargeScreen = window.innerWidth > 1200;
    const shouldShow = saved === 'visible' || (saved === null && isLargeScreen);

    main.classList.toggle('preview-visible', shouldShow);
    main.classList.toggle('preview-hidden', !shouldShow);
    preview.classList.toggle('hidden', !shouldShow);
    btn.classList.toggle('preview-visible', shouldShow);
    btn.classList.toggle('preview-hidden', !shouldShow);

    const icon = btn.querySelector('i');
    icon.className = shouldShow ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
}

/**
 * Initialize the editor
 */
function init() {
    loadData();
    setupEventListeners();
    initPreviewState();
    loadDraft();
    console.log('Editor initialized');
}

/**
 * Load venue data
 */
function loadData() {
    if (typeof karaokeData !== 'undefined') {
        venues = karaokeData.listings || [];
        tagDefinitions = karaokeData.tagDefinitions || {};
        initTagConfig(tagDefinitions);
        renderVenueList();
        updateVenueCount();
        renderTagSelector();
        renderTagDefinitionsEditor();
    } else {
        showToast('Failed to load venue data', 'error');
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // New venue button
    document.getElementById('btn-new-venue').addEventListener('click', createNewVenue);

    // Preview toggle
    document.getElementById('btn-toggle-preview').addEventListener('click', togglePreviewPanel);

    // Venue search
    elements.venueSearch.addEventListener('input', (e) => {
        renderVenueList(e.target.value);
    });

    // Form submission
    elements.venueForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveVenue();
    });

    // Form changes trigger preview update
    elements.venueForm.addEventListener('input', () => {
        hasUnsavedChanges = true;
        updatePreview();
        markVenueUnsaved();
    });

    // Delete venue
    document.getElementById('btn-delete-venue').addEventListener('click', deleteVenue);

    // Add schedule
    document.getElementById('btn-add-schedule').addEventListener('click', addScheduleRow);

    // Copy JSON
    document.getElementById('btn-copy-json').addEventListener('click', copyJson);

    // Save draft
    document.getElementById('btn-save-local').addEventListener('click', saveDraft);

    // Preview tabs
    document.querySelectorAll('.preview-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.preview-pane').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`preview-${tab.dataset.tab}`).classList.add('active');
        });
    });

    // Tag definitions editor toggle
    document.getElementById('btn-toggle-tag-editor').addEventListener('click', toggleTagDefinitionsEditor);

    // Add tag definition button
    document.getElementById('btn-add-tag-def').addEventListener('click', addTagDefinition);

    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

/**
 * Render venue list in sidebar
 */
function renderVenueList(filter = '') {
    const filterLower = filter.toLowerCase();
    const filtered = venues.filter(v =>
        v.name.toLowerCase().includes(filterLower) ||
        v.address.city.toLowerCase().includes(filterLower)
    ).sort((a, b) => getSortableName(a.name).localeCompare(getSortableName(b.name)));

    elements.venueList.innerHTML = filtered.map(venue => `
        <li class="venue-list-item ${venue.id === selectedVenueId ? 'active' : ''}"
            data-id="${escapeHtml(venue.id)}">
            <div class="venue-list-item__name">${escapeHtml(venue.name)}</div>
            <div class="venue-list-item__city">${escapeHtml(venue.address.city)}</div>
        </li>
    `).join('');

    // Add click handlers
    elements.venueList.querySelectorAll('.venue-list-item').forEach(item => {
        item.addEventListener('click', () => selectVenue(item.dataset.id));
    });
}

/**
 * Update venue count
 */
function updateVenueCount() {
    elements.venueCount.textContent = `${venues.length} venues`;
}

/**
 * Select a venue for editing
 */
function selectVenue(venueId) {
    if (hasUnsavedChanges && !confirm('You have unsaved changes. Discard them?')) {
        return;
    }

    selectedVenueId = venueId;
    hasUnsavedChanges = false;
    const venue = venues.find(v => v.id === venueId);

    if (!venue) {
        showToast('Venue not found', 'error');
        return;
    }

    // Update sidebar
    renderVenueList(elements.venueSearch.value);

    // Show form
    elements.noVenueSelected.hidden = true;
    elements.venueForm.hidden = false;

    // Fill form
    fillForm(venue);
    updatePreview();
}

/**
 * Fill form with venue data
 */
function fillForm(venue) {
    // Basic info
    document.getElementById('venue-id').value = venue.id || '';
    document.getElementById('venue-name').value = venue.name || '';
    document.getElementById('venue-dedicated').checked = venue.dedicated || false;
    document.getElementById('venue-active').checked = venue.active !== false;

    // Tags - check the appropriate checkboxes
    const venueTags = venue.tags || [];
    elements.tagSelector.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = venueTags.includes(checkbox.value);
    });

    // Address
    document.getElementById('address-street').value = venue.address?.street || '';
    document.getElementById('address-city').value = venue.address?.city || '';
    document.getElementById('address-state').value = venue.address?.state || 'TX';
    document.getElementById('address-zip').value = venue.address?.zip || '';
    document.getElementById('address-neighborhood').value = venue.address?.neighborhood || '';

    // Coordinates
    document.getElementById('coord-lat').value = venue.coordinates?.lat || '';
    document.getElementById('coord-lng').value = venue.coordinates?.lng || '';

    // Host
    document.getElementById('host-name').value = venue.host?.name || '';
    document.getElementById('host-company').value = venue.host?.company || '';
    document.getElementById('host-website').value = venue.host?.website || '';

    // Socials
    document.getElementById('social-website').value = venue.socials?.website || '';
    document.getElementById('social-facebook').value = venue.socials?.facebook || '';
    document.getElementById('social-instagram').value = venue.socials?.instagram || '';
    document.getElementById('social-twitter').value = venue.socials?.twitter || '';
    document.getElementById('social-tiktok').value = venue.socials?.tiktok || '';
    document.getElementById('social-youtube').value = venue.socials?.youtube || '';
    document.getElementById('social-bluesky').value = venue.socials?.bluesky || '';

    // Schedule
    renderScheduleList(venue.schedule || []);

    // Date Range
    document.getElementById('daterange-start').value = venue.dateRange?.start || '';
    document.getElementById('daterange-end').value = venue.dateRange?.end || '';
}

/**
 * Render schedule rows
 */
function renderScheduleList(schedules) {
    elements.scheduleList.innerHTML = schedules.map((s, i) => createScheduleRowHtml(s, i)).join('');
    attachScheduleListeners();
}

function createScheduleRowHtml(schedule = {}, index = 0) {
    const frequencies = ['every', 'first', 'second', 'third', 'fourth', 'last', 'once'];
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const isOnce = schedule.frequency === 'once';

    return `
        <div class="schedule-item ${isOnce ? 'schedule-item--once' : ''}" data-index="${index}">
            <select name="schedule[${index}].frequency" class="schedule-frequency">
                ${frequencies.map(f => `<option value="${f}" ${schedule.frequency === f ? 'selected' : ''}>${f.charAt(0).toUpperCase() + f.slice(1)}</option>`).join('')}
            </select>
            <select name="schedule[${index}].day" class="schedule-day" ${isOnce ? 'hidden' : ''}>
                ${days.map(d => `<option value="${d}" ${schedule.day?.toLowerCase() === d ? 'selected' : ''}>${d.charAt(0).toUpperCase() + d.slice(1)}</option>`).join('')}
            </select>
            <input type="date" name="schedule[${index}].date" class="schedule-date" value="${schedule.date || ''}" ${isOnce ? '' : 'hidden'} placeholder="Date">
            <input type="text" name="schedule[${index}].eventName" class="schedule-event-name" value="${escapeHtml(schedule.eventName || '')}" ${isOnce ? '' : 'hidden'} placeholder="Event name (optional)">
            <input type="time" name="schedule[${index}].startTime" value="${schedule.startTime || '21:00'}">
            <input type="time" name="schedule[${index}].endTime" value="${schedule.endTime || ''}">
            <input type="url" name="schedule[${index}].eventUrl" class="schedule-event-url" value="${escapeHtml(schedule.eventUrl || '')}" placeholder="Event URL (optional)">
            <button type="button" class="btn btn--icon btn-remove-schedule" title="Remove">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `;
}

function attachScheduleListeners() {
    elements.scheduleList.querySelectorAll('.btn-remove-schedule').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.schedule-item').remove();
            hasUnsavedChanges = true;
            updatePreview();
        });
    });

    // Toggle day/date/eventName visibility when frequency changes
    elements.scheduleList.querySelectorAll('.schedule-frequency').forEach(select => {
        select.addEventListener('change', (e) => {
            const row = e.target.closest('.schedule-item');
            const isOnce = e.target.value === 'once';
            row.classList.toggle('schedule-item--once', isOnce);
            row.querySelector('.schedule-day').hidden = isOnce;
            row.querySelector('.schedule-date').hidden = !isOnce;
            row.querySelector('.schedule-event-name').hidden = !isOnce;
            hasUnsavedChanges = true;
            updatePreview();
        });
    });
}

function addScheduleRow() {
    const index = elements.scheduleList.children.length;
    elements.scheduleList.insertAdjacentHTML('beforeend', createScheduleRowHtml({}, index));
    attachScheduleListeners();
    hasUnsavedChanges = true;
}

/**
 * Get form data as venue object
 */
function getFormData() {
    const form = elements.venueForm;

    // Get selected tags
    const tags = [];
    elements.tagSelector.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
        tags.push(checkbox.value);
    });

    // Get schedule data
    const schedules = [];
    elements.scheduleList.querySelectorAll('.schedule-item').forEach(item => {
        const frequency = item.querySelector('[name*="frequency"]').value;
        const startTime = item.querySelector('[name*="startTime"]').value;
        const endTime = item.querySelector('[name*="endTime"]').value || null;

        const eventUrl = item.querySelector('[name*="eventUrl"]').value.trim();

        if (frequency === 'once') {
            const entry = {
                frequency,
                date: item.querySelector('[name*=".date"]').value,
                startTime,
                endTime
            };
            const eventName = item.querySelector('[name*="eventName"]').value.trim();
            if (eventName) entry.eventName = eventName;
            if (eventUrl) entry.eventUrl = eventUrl;
            schedules.push(entry);
        } else {
            const entry = { frequency, day: item.querySelector('[name*=".day"]').value, startTime, endTime };
            if (eventUrl) entry.eventUrl = eventUrl;
            schedules.push(entry);
        }
    });

    // Build socials object (only non-empty values)
    const socials = {};
    ['website', 'facebook', 'instagram', 'twitter', 'tiktok', 'youtube', 'bluesky'].forEach(platform => {
        const value = document.getElementById(`social-${platform}`).value.trim();
        if (value) socials[platform] = value;
    });

    // Build host object
    const hostName = document.getElementById('host-name').value.trim();
    const hostCompany = document.getElementById('host-company').value.trim();
    const hostWebsite = document.getElementById('host-website').value.trim();
    const host = (hostName || hostCompany || hostWebsite) ? {
        name: hostName || undefined,
        company: hostCompany || undefined,
        website: hostWebsite || undefined
    } : null;

    // Get coordinates from form fields
    const latValue = document.getElementById('coord-lat').value.trim();
    const lngValue = document.getElementById('coord-lng').value.trim();
    const coordinates = (latValue && lngValue) ? {
        lat: parseFloat(latValue),
        lng: parseFloat(lngValue)
    } : null;

    // Get date range
    const dateRangeStart = document.getElementById('daterange-start').value;
    const dateRangeEnd = document.getElementById('daterange-end').value;
    const dateRange = (dateRangeStart || dateRangeEnd) ? {
        start: dateRangeStart || undefined,
        end: dateRangeEnd || undefined
    } : null;

    const result = {
        id: document.getElementById('venue-id').value.trim(),
        name: document.getElementById('venue-name').value.trim(),
        active: document.getElementById('venue-active').checked,
        dedicated: document.getElementById('venue-dedicated').checked,
        address: {
            street: document.getElementById('address-street').value.trim(),
            city: document.getElementById('address-city').value.trim(),
            state: document.getElementById('address-state').value.trim() || 'TX',
            zip: document.getElementById('address-zip').value.trim(),
            neighborhood: document.getElementById('address-neighborhood').value.trim()
        },
        schedule: schedules,
        host: host,
        socials: Object.keys(socials).length ? socials : undefined
    };

    // Include tags if any are selected
    if (tags.length > 0) {
        result.tags = tags;
    }

    // Include coordinates if they exist
    if (coordinates) {
        result.coordinates = coordinates;
    }

    // Include date range if set
    if (dateRange) {
        result.dateRange = dateRange;
    }

    return result;
}

/**
 * Validate form
 */
function validateForm() {
    const data = getFormData();
    const errors = [];

    if (!data.id) errors.push('ID is required');
    else if (!/^[a-z0-9-]+$/.test(data.id)) errors.push('ID must be lowercase letters, numbers, and hyphens only');

    if (!data.name) errors.push('Name is required');
    if (!data.address.street) errors.push('Street address is required');
    if (!data.address.city) errors.push('City is required');
    if (data.schedule.length === 0) errors.push('At least one schedule entry is required');

    // Check for duplicate ID (except for current venue)
    const duplicate = venues.find(v => v.id === data.id && v.id !== selectedVenueId);
    if (duplicate) errors.push('A venue with this ID already exists');

    return errors;
}

/**
 * Save venue
 */
function saveVenue() {
    const errors = validateForm();

    if (errors.length > 0) {
        showToast(errors.join('\n'), 'error');
        return;
    }

    const data = getFormData();
    const existingIndex = venues.findIndex(v => v.id === selectedVenueId);

    if (existingIndex >= 0) {
        venues[existingIndex] = data;
    } else {
        venues.push(data);
    }

    selectedVenueId = data.id;
    hasUnsavedChanges = false;

    renderVenueList(elements.venueSearch.value);
    updateVenueCount();
    updatePreview();
    showToast('Venue saved successfully', 'success');
}

/**
 * Delete venue
 */
function deleteVenue() {
    if (!selectedVenueId) return;

    if (!confirm('Are you sure you want to delete this venue?')) return;

    venues = venues.filter(v => v.id !== selectedVenueId);
    selectedVenueId = null;
    hasUnsavedChanges = false;

    elements.venueForm.hidden = true;
    elements.noVenueSelected.hidden = false;

    renderVenueList();
    updateVenueCount();
    clearPreview();
    showToast('Venue deleted', 'success');
}

/**
 * Create new venue
 */
function createNewVenue() {
    if (hasUnsavedChanges && !confirm('You have unsaved changes. Discard them?')) {
        return;
    }

    selectedVenueId = null;
    hasUnsavedChanges = false;

    elements.noVenueSelected.hidden = true;
    elements.venueForm.hidden = false;

    fillForm({
        id: '',
        name: '',
        active: true,
        dedicated: false,
        tags: [],
        address: { street: '', city: '', state: 'TX', zip: '', neighborhood: '' },
        schedule: [],
        dateRange: null,
        host: null,
        socials: {}
    });

    clearPreview();
    document.getElementById('venue-id').focus();
}

/**
 * Update preview
 */
function updatePreview() {
    const data = getFormData();

    // Card preview
    if (data.name) {
        elements.previewCard.innerHTML = renderVenueCard(data, { mode: 'compact' });
    } else {
        elements.previewCard.innerHTML = '<p class="preview-empty">Enter venue details to preview</p>';
    }

    // Modal preview
    if (data.name) {
        elements.previewModal.innerHTML = renderModalPreview(data);
    } else {
        elements.previewModal.innerHTML = '<p class="preview-empty">Enter venue details to preview</p>';
    }

    // JSON preview
    elements.previewJson.textContent = JSON.stringify(data, null, 2);
}

function renderModalPreview(venue) {
    const addressHtml = formatAddress(venue.address);
    const socialLinksHtml = venue.socials ? createSocialLinks(venue.socials) : '';
    const tagsHtml = renderTags(venue.tags, { dedicated: venue.dedicated });

    return `
        <div class="venue-modal-preview">
            <h3>${escapeHtml(venue.name)}</h3>
            ${tagsHtml}
            <p><i class="fa-solid fa-location-dot"></i> ${addressHtml}</p>
            ${venue.dateRange ? `
                <div class="daterange-preview">
                    <i class="fa-solid fa-calendar-days"></i>
                    <strong>Season:</strong> ${venue.dateRange.start || '?'} to ${venue.dateRange.end || '?'}
                </div>
            ` : ''}
            ${venue.schedule.length ? `
                <div class="schedule-preview">
                    <strong>Schedule:</strong>
                    ${venue.schedule.map(s => {
                        if (s.frequency === 'once') {
                            const label = s.eventName || 'Special Event';
                            return `<div>${escapeHtml(label)} — ${s.date}: ${formatTimeRange(s.startTime, s.endTime)}</div>`;
                        }
                        return `<div>${s.frequency.charAt(0).toUpperCase() + s.frequency.slice(1)} ${s.day.charAt(0).toUpperCase() + s.day.slice(1)}: ${formatTimeRange(s.startTime, s.endTime)}</div>`;
                    }).join('')}
                </div>
            ` : ''}
            ${venue.host ? `
                <div class="host-preview">
                    <strong>Host:</strong>
                    ${venue.host.name || ''} ${venue.host.company ? `(${venue.host.company})` : ''}
                </div>
            ` : ''}
            ${socialLinksHtml ? `<div class="socials-preview">${socialLinksHtml}</div>` : ''}
        </div>
    `;
}

function clearPreview() {
    elements.previewCard.innerHTML = '<p class="preview-empty">Select a venue to preview</p>';
    elements.previewModal.innerHTML = '<p class="preview-empty">Select a venue to preview</p>';
    elements.previewJson.textContent = '{}';
}

/**
 * Mark venue as unsaved in sidebar
 */
function markVenueUnsaved() {
    const item = elements.venueList.querySelector(`[data-id="${selectedVenueId}"]`);
    if (item) item.classList.add('unsaved');
}

/**
 * Copy JSON to clipboard
 */
function copyJson() {
    // Sort venues alphabetically (ignoring articles) before export
    const sortedVenues = [...venues].sort((a, b) => {
        const nameA = getSortableName(a.name).toLowerCase();
        const nameB = getSortableName(b.name).toLowerCase();
        return nameA.localeCompare(nameB);
    });

    const output = {
        tagDefinitions: tagDefinitions,
        listings: sortedVenues
    };
    const json = JSON.stringify(output, null, 2);

    navigator.clipboard.writeText(`const karaokeData = ${json};`).then(() => {
        showToast('JSON copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Failed to copy to clipboard', 'error');
    });
}

/**
 * Save draft to localStorage
 */
function saveDraft() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            venues,
            tagDefinitions,
            selectedVenueId,
            timestamp: new Date().toISOString()
        }));
        showToast('Draft saved to browser', 'success');
    } catch (e) {
        showToast('Failed to save draft', 'error');
    }
}

/**
 * Load draft from localStorage
 */
function loadDraft() {
    try {
        const draft = localStorage.getItem(STORAGE_KEY);
        if (draft) {
            const data = JSON.parse(draft);
            const draftDate = new Date(data.timestamp).toLocaleString();
            if (confirm(`Found a saved draft from ${draftDate}. Load it?`)) {
                venues = data.venues;
                if (data.tagDefinitions) {
                    tagDefinitions = data.tagDefinitions;
                    initTagConfig(tagDefinitions);
                }
                renderVenueList();
                updateVenueCount();
                renderTagSelector();
                renderTagDefinitionsEditor();
                if (data.selectedVenueId) {
                    selectVenue(data.selectedVenueId);
                }
                showToast('Draft loaded', 'success');
            }
        }
    } catch (e) {
        console.warn('Failed to load draft:', e);
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}

/**
 * Render tag selector checkboxes
 */
function renderTagSelector() {
    if (!elements.tagSelector) return;

    const tagIds = Object.keys(tagDefinitions).filter(id => id !== 'dedicated');

    elements.tagSelector.innerHTML = tagIds.map(tagId => {
        const tag = tagDefinitions[tagId];
        return `
            <label class="tag-chip" style="--tag-color: ${tag.color}; --tag-text: ${tag.textColor};">
                <input type="checkbox" name="tags" value="${escapeHtml(tagId)}">
                <span class="tag-chip__label">${escapeHtml(tag.label)}</span>
            </label>
        `;
    }).join('');

    // Add change listeners for preview updates
    elements.tagSelector.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', () => {
            hasUnsavedChanges = true;
            updatePreview();
            markVenueUnsaved();
        });
    });
}

/**
 * Toggle tag definitions editor visibility
 */
function toggleTagDefinitionsEditor() {
    const editor = elements.tagDefinitionsEditor;
    const btn = document.getElementById('btn-toggle-tag-editor');
    const icon = btn.querySelector('.toggle-icon');

    const isHidden = editor.hidden;
    editor.hidden = !isHidden;
    icon.classList.toggle('fa-chevron-down', !isHidden);
    icon.classList.toggle('fa-chevron-up', isHidden);
}

/**
 * Render tag definitions editor
 */
function renderTagDefinitionsEditor() {
    if (!elements.tagDefinitionsList) return;

    const tagIds = Object.keys(tagDefinitions);

    elements.tagDefinitionsList.innerHTML = tagIds.map(tagId => {
        const tag = tagDefinitions[tagId];
        return `
            <div class="tag-def-row" data-tag-id="${escapeHtml(tagId)}">
                <input type="text" class="tag-def-id" value="${escapeHtml(tagId)}" readonly title="Tag ID (read-only)">
                <input type="text" class="tag-def-label" value="${escapeHtml(tag.label)}" placeholder="Label" title="Display label">
                <input type="color" class="tag-def-color" value="${tag.color}" title="Background color">
                <input type="color" class="tag-def-text" value="${tag.textColor}" title="Text color">
                <button type="button" class="btn btn--icon btn-remove-tag-def" title="Remove tag">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');

    // Add event listeners
    elements.tagDefinitionsList.querySelectorAll('.tag-def-row').forEach(row => {
        const tagId = row.dataset.tagId;

        // Label change
        row.querySelector('.tag-def-label').addEventListener('change', (e) => {
            updateTagDefinition(tagId, 'label', e.target.value);
        });

        // Color change
        row.querySelector('.tag-def-color').addEventListener('change', (e) => {
            updateTagDefinition(tagId, 'color', e.target.value);
        });

        // Text color change
        row.querySelector('.tag-def-text').addEventListener('change', (e) => {
            updateTagDefinition(tagId, 'textColor', e.target.value);
        });

        // Remove button
        row.querySelector('.btn-remove-tag-def').addEventListener('click', () => {
            removeTagDefinition(tagId);
        });
    });
}

/**
 * Add a new tag definition
 */
function addTagDefinition() {
    const tagId = prompt('Enter tag ID (lowercase, hyphens allowed):');
    if (!tagId) return;

    const cleanId = tagId.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    if (tagDefinitions[cleanId]) {
        showToast('A tag with this ID already exists', 'error');
        return;
    }

    tagDefinitions[cleanId] = {
        label: cleanId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        color: '#607d8b',
        textColor: '#fff'
    };

    initTagConfig(tagDefinitions);
    renderTagDefinitionsEditor();
    renderTagSelector();
    hasUnsavedChanges = true;
    showToast(`Tag "${cleanId}" added`, 'success');
}

/**
 * Update a tag definition property
 */
function updateTagDefinition(tagId, property, value) {
    if (!tagDefinitions[tagId]) return;

    tagDefinitions[tagId][property] = value;
    initTagConfig(tagDefinitions);
    renderTagSelector();
    hasUnsavedChanges = true;

    // Re-check the tags that were selected before re-render
    if (selectedVenueId) {
        const venue = venues.find(v => v.id === selectedVenueId);
        if (venue && venue.tags) {
            elements.tagSelector.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = venue.tags.includes(checkbox.value);
            });
        }
    }

    updatePreview();
}

/**
 * Remove a tag definition
 */
function removeTagDefinition(tagId) {
    if (!confirm(`Delete tag "${tagId}"? This will remove it from all venues.`)) return;

    delete tagDefinitions[tagId];

    // Remove from all venues
    venues.forEach(venue => {
        if (venue.tags) {
            venue.tags = venue.tags.filter(t => t !== tagId);
            if (venue.tags.length === 0) delete venue.tags;
        }
    });

    initTagConfig(tagDefinitions);
    renderTagDefinitionsEditor();
    renderTagSelector();
    hasUnsavedChanges = true;
    updatePreview();
    showToast(`Tag "${tagId}" removed`, 'success');
}

/**
 * Geocode address using US Census Geocoder API
 */
async function geocodeAddress() {
    const street = document.getElementById('address-street').value.trim();
    const city = document.getElementById('address-city').value.trim();
    const state = document.getElementById('address-state').value.trim();
    const zip = document.getElementById('address-zip').value.trim();
    const statusEl = document.getElementById('geocode-status');
    const btn = document.getElementById('btn-geocode');

    if (!street || !city) {
        statusEl.textContent = 'Street and city are required';
        statusEl.style.color = 'var(--color-error)';
        return;
    }

    const address = `${street}, ${city}, ${state} ${zip}`.trim();
    const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;

    btn.disabled = true;
    statusEl.textContent = 'Looking up coordinates...';
    statusEl.style.color = 'var(--text-muted)';

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        const matches = data.result?.addressMatches;
        if (!matches || matches.length === 0) {
            statusEl.textContent = 'No matches found for this address';
            statusEl.style.color = 'var(--color-warning)';
            return;
        }

        const coords = matches[0].coordinates;
        document.getElementById('coord-lat').value = coords.y;
        document.getElementById('coord-lng').value = coords.x;

        hasUnsavedChanges = true;
        updatePreview();
        markVenueUnsaved();

        statusEl.textContent = `Found: ${coords.y.toFixed(6)}, ${coords.x.toFixed(6)}`;
        statusEl.style.color = 'var(--color-success)';
    } catch (err) {
        statusEl.textContent = `Geocoding failed: ${err.message}`;
        statusEl.style.color = 'var(--color-error)';
    } finally {
        btn.disabled = false;
    }
}

// Expose to global scope for onclick handler
window.geocodeAddress = geocodeAddress;

// Initialize
init();
