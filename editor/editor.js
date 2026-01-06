/**
 * Venue Editor - Main Application
 */

import { renderVenueCard } from '../js/components/VenueCard.js';
import { formatTimeRange } from '../js/utils/date.js';
import { escapeHtml } from '../js/utils/string.js';
import { buildMapUrl, formatAddress, createSocialLinks } from '../js/utils/url.js';

// State
let venues = [];
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
        venues = karaokeData.listings;
        renderVenueList();
        updateVenueCount();
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
    ).sort((a, b) => a.name.localeCompare(b.name));

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

    // Schedule
    renderScheduleList(venue.schedule || []);
}

/**
 * Render schedule rows
 */
function renderScheduleList(schedules) {
    elements.scheduleList.innerHTML = schedules.map((s, i) => createScheduleRowHtml(s, i)).join('');
    attachScheduleListeners();
}

function createScheduleRowHtml(schedule = {}, index = 0) {
    const frequencies = ['every', 'first', 'second', 'third', 'fourth', 'last'];
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    return `
        <div class="schedule-item" data-index="${index}">
            <select name="schedule[${index}].frequency">
                ${frequencies.map(f => `<option value="${f}" ${schedule.frequency === f ? 'selected' : ''}>${f.charAt(0).toUpperCase() + f.slice(1)}</option>`).join('')}
            </select>
            <select name="schedule[${index}].day">
                ${days.map(d => `<option value="${d}" ${schedule.day === d ? 'selected' : ''}>${d.charAt(0).toUpperCase() + d.slice(1)}</option>`).join('')}
            </select>
            <input type="time" name="schedule[${index}].startTime" value="${schedule.startTime || '21:00'}">
            <input type="time" name="schedule[${index}].endTime" value="${schedule.endTime || ''}">
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

    // Get schedule data
    const schedules = [];
    elements.scheduleList.querySelectorAll('.schedule-item').forEach(item => {
        const frequency = item.querySelector('[name*="frequency"]').value;
        const day = item.querySelector('[name*="day"]').value;
        const startTime = item.querySelector('[name*="startTime"]').value;
        const endTime = item.querySelector('[name*="endTime"]').value || null;
        schedules.push({ frequency, day, startTime, endTime });
    });

    // Build socials object (only non-empty values)
    const socials = {};
    ['website', 'facebook', 'instagram', 'twitter', 'tiktok', 'youtube'].forEach(platform => {
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

    // Include coordinates if they exist
    if (coordinates) {
        result.coordinates = coordinates;
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
        address: { street: '', city: '', state: 'TX', zip: '', neighborhood: '' },
        schedule: [],
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

    return `
        <div class="venue-modal-preview">
            <h3>${escapeHtml(venue.name)}</h3>
            ${venue.dedicated ? '<span class="venue-card__badge">Dedicated</span>' : ''}
            <p><i class="fa-solid fa-location-dot"></i> ${addressHtml}</p>
            ${venue.schedule.length ? `
                <div class="schedule-preview">
                    <strong>Schedule:</strong>
                    ${venue.schedule.map(s =>
                        `<div>${s.frequency.charAt(0).toUpperCase() + s.frequency.slice(1)} ${s.day.charAt(0).toUpperCase() + s.day.slice(1)}: ${formatTimeRange(s.startTime, s.endTime)}</div>`
                    ).join('')}
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
    const output = { listings: venues };
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
                renderVenueList();
                updateVenueCount();
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

// Initialize
init();
