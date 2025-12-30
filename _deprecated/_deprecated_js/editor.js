// Editor State
let editorState = {
    currentData: null,
    currentVenueId: null,
    venues: [],
    jsonTextarea: null,
    isUpdatingJSON: false
};

// Initialize Editor
function initEditor() {
    // Get DOM elements
    editorState.jsonTextarea = document.getElementById('json-textarea');
    
    // Load initial data from data.js
    loadDataFromGlobal();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initial render
    renderAll();
}

// Load data from the global karaokeData variable
function loadDataFromGlobal() {
    editorState.currentData = {
        listings: JSON.parse(JSON.stringify(karaokeData.listings))
    };
    editorState.venues = editorState.currentData.listings;
    updateJSONEditor();
}

// Set up all event listeners
function setupEventListeners() {
    // Control buttons
    document.getElementById('refresh-data').addEventListener('click', refreshFromJSON);
    document.getElementById('copy-json').addEventListener('click', copyJSON);
    document.getElementById('validate-json').addEventListener('click', validateJSON);
    document.getElementById('back-to-app').addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    
    // JSON editor events
    editorState.jsonTextarea.addEventListener('input', handleJSONChange);
    document.getElementById('format-json').addEventListener('click', formatJSON);
    document.getElementById('minify-json').addEventListener('click', minifyJSON);
    
    // Form events
    document.getElementById('venue-select').addEventListener('change', handleVenueSelect);
    document.getElementById('new-venue').addEventListener('click', createNewVenue);
    document.getElementById('venue-form').addEventListener('submit', saveCurrentVenue);
    document.getElementById('delete-venue').addEventListener('click', deleteCurrentVenue);
    document.getElementById('preview-venue').addEventListener('click', previewCurrentVenue);
    
    // Dynamic content buttons
    document.getElementById('add-schedule').addEventListener('click', addScheduleItem);
    document.getElementById('add-venue-social').addEventListener('click', addSocialItem.bind(null, 'venue'));
    document.getElementById('add-kj-social').addEventListener('click', addSocialItem.bind(null, 'kj'));
}

// Render everything
function renderAll() {
    renderVenueSelector();
    updateJSONEditor();
    updateVenueCount();
}

// Update JSON editor with current data
function updateJSONEditor() {
    if (editorState.isUpdatingJSON) return;
    
    editorState.isUpdatingJSON = true;
    
    const formattedJSON = JSON.stringify(editorState.currentData, null, 2);
    editorState.jsonTextarea.value = formattedJSON;
    
    // Highlight syntax (basic)
    highlightJSON();
    
    // Clear update flag after a short delay
    setTimeout(() => {
        editorState.isUpdatingJSON = false;
    }, 100);
}

// Handle JSON textarea changes
function handleJSONChange() {
    if (editorState.isUpdatingJSON) return;
    
    try {
        const newData = JSON.parse(editorState.jsonTextarea.value);
        
        // Validate structure
        if (!newData.listings || !Array.isArray(newData.listings)) {
            throw new Error('JSON must have a "listings" array');
        }
        
        // Update data
        editorState.currentData = newData;
        editorState.venues = newData.listings;
        
        // Update form if we're editing a venue that still exists
        if (editorState.currentVenueId) {
            const venue = editorState.venues.find(v => v.id === editorState.currentVenueId);
            if (venue) {
                fillVenueForm(venue);
            } else {
                // Venue was deleted in JSON
                editorState.currentVenueId = null;
                clearVenueForm();
            }
        }
        
        // Update selector
        renderVenueSelector();
        updateVenueCount();
        
        // Show success
        showJSONStatus('JSON is valid', true);
        
    } catch (error) {
        showJSONStatus('Invalid JSON: ' + error.message, false);
    }
}

// Refresh data from JSON textarea
function refreshFromJSON() {
    handleJSONChange();
    showStatus('Data refreshed from JSON', 'success');
}

// Copy JSON to clipboard
function copyJSON() {
    editorState.jsonTextarea.select();
    editorState.jsonTextarea.setSelectionRange(0, 99999); // For mobile
    
    try {
        navigator.clipboard.writeText(editorState.jsonTextarea.value)
            .then(() => {
                showStatus('JSON copied to clipboard!', 'success');
            })
            .catch(() => {
                // Fallback for older browsers
                document.execCommand('copy');
                showStatus('JSON copied to clipboard!', 'success');
            });
    } catch (error) {
        showStatus('Failed to copy: ' + error.message, 'error');
    }
}

// Validate JSON
function validateJSON() {
    try {
        JSON.parse(editorState.jsonTextarea.value);
        showStatus('JSON is valid!', 'success');
        return true;
    } catch (error) {
        showStatus('Invalid JSON: ' + error.message, 'error');
        return false;
    }
}

// Format JSON
function formatJSON() {
    try {
        const parsed = JSON.parse(editorState.jsonTextarea.value);
        editorState.jsonTextarea.value = JSON.stringify(parsed, null, 2);
        highlightJSON();
        showStatus('JSON formatted', 'info');
    } catch (error) {
        showStatus('Cannot format invalid JSON', 'error');
    }
}

// Minify JSON
function minifyJSON() {
    try {
        const parsed = JSON.parse(editorState.jsonTextarea.value);
        editorState.jsonTextarea.value = JSON.stringify(parsed);
        highlightJSON();
        showStatus('JSON minified', 'info');
    } catch (error) {
        showStatus('Cannot minify invalid JSON', 'error');
    }
}

// Highlight JSON syntax (basic)
function highlightJSON() {
    const textarea = editorState.jsonTextarea;
    const json = textarea.value;
    
    // Basic highlighting - could be enhanced with a proper library
    const highlighted = json
        .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function(match) {
            let cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    
    // Note: This is a simplified approach. For production, use a proper syntax highlighter
}

// Show JSON status
function showJSONStatus(message, isValid) {
    const statusEl = document.getElementById('json-status');
    statusEl.textContent = message;
    statusEl.className = 'json-status ' + (isValid ? 'valid' : 'invalid');
    
    setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = 'json-status';
    }, 3000);
}

// Render venue selector dropdown
function renderVenueSelector() {
    const select = document.getElementById('venue-select');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">Select a venue to edit...</option>';
    
    editorState.venues.sort((a, b) => a.VenueName.localeCompare(b.VenueName));
    
    editorState.venues.forEach(venue => {
        const option = document.createElement('option');
        option.value = venue.id;
        option.textContent = venue.VenueName + ' (' + venue.Address.City + ')';
        select.appendChild(option);
    });
    
    // Restore selection if still valid
    if (currentValue && editorState.venues.find(v => v.id === currentValue)) {
        select.value = currentValue;
    } else if (editorState.currentVenueId) {
        select.value = editorState.currentVenueId;
    }
}

// Handle venue selection
function handleVenueSelect(event) {
    const venueId = event.target.value;
    
    if (!venueId) {
        editorState.currentVenueId = null;
        clearVenueForm();
        return;
    }
    
    const venue = editorState.venues.find(v => v.id === venueId);
    if (venue) {
        editorState.currentVenueId = venueId;
        fillVenueForm(venue);
    }
}

// Create new venue
function createNewVenue() {
    editorState.currentVenueId = null;
    clearVenueForm();
    
    // Generate a default ID
    const defaultId = 'new-venue-' + Date.now();
    document.getElementById('venue-id').value = defaultId;
    
    // Focus on name field
    document.getElementById('venue-name').focus();
    
    showStatus('New venue form ready', 'info');
}

// Fill form with venue data
function fillVenueForm(venue) {
    // Basic info
    document.getElementById('venue-id').value = venue.id;
    document.getElementById('venue-name').value = venue.VenueName;
    document.getElementById('venue-dedicated').checked = venue.Dedicated || false;
    
    // Address
    document.getElementById('address-street').value = venue.Address.Street;
    document.getElementById('address-city').value = venue.Address.City;
    document.getElementById('address-state').value = venue.Address.State || 'TX';
    document.getElementById('address-zip').value = venue.Address.Zip;
    
    // Timeframe
    document.getElementById('timeframe-start').value = venue.Timeframe?.StartDate || '';
    document.getElementById('timeframe-end').value = venue.Timeframe?.EndDate || '';
    
    // KJ
    document.getElementById('kj-host').value = venue.KJ?.Host || '';
    document.getElementById('kj-company').value = venue.KJ?.Company || '';
    
    // Render schedule
    renderScheduleItems(venue.schedule || []);
    
    // Render socials
    renderSocialItems('venue', venue.socials || {});
    renderSocialItems('kj', venue.KJ?.KJsocials || {});
    
    // Enable delete button
    document.getElementById('delete-venue').disabled = false;
}

// Clear venue form
function clearVenueForm() {
    const form = document.getElementById('venue-form');
    form.reset();
    
    // Clear dynamic content
    document.getElementById('schedule-container').innerHTML = '';
    document.getElementById('venue-socials-container').innerHTML = '';
    document.getElementById('kj-socials-container').innerHTML = '';
    
    // Reset state
    document.getElementById('address-state').value = 'TX';
    
    // Disable delete button
    document.getElementById('delete-venue').disabled = true;
    
    // Clear selector
    document.getElementById('venue-select').value = '';
}

// Save current venue
function saveCurrentVenue(event) {
    event.preventDefault();
    
    if (!validateVenueForm()) return;
    
    const venueData = collectVenueFormData();
    const index = editorState.venues.findIndex(v => v.id === editorState.currentVenueId);
    
    if (index !== -1) {
        // Update existing venue
        editorState.venues[index] = venueData;
    } else {
        // Add new venue
        // Check for duplicate ID
        if (editorState.venues.find(v => v.id === venueData.id)) {
            showStatus('Venue ID already exists!', 'error');
            return;
        }
        editorState.venues.push(venueData);
        editorState.currentVenueId = venueData.id;
    }
    
    // Update JSON
    updateJSONEditor();
    
    // Update selector
    renderVenueSelector();
    updateVenueCount();
    
    showStatus('Venue saved', 'success');
}

// Collect data from form
function collectVenueFormData() {
    // Collect schedule
    const schedule = [];
    document.querySelectorAll('#schedule-container .dynamic-item').forEach(item => {
        const frequency = item.querySelector('[name="schedule-frequency"]').value;
        const day = item.querySelector('[name="schedule-day"]').value;
        const time = item.querySelector('[name="schedule-time"]').value;
        const description = item.querySelector('[name="schedule-description"]').value;
        
        schedule.push({
            day: [frequency, day],
            time: time,
            description: description || undefined
        });
    });
    
    // Collect venue socials
    const venueSocials = {};
    document.querySelectorAll('#venue-socials-container .dynamic-item').forEach(item => {
        const platform = item.querySelector('[name="social-platform"]').value;
        const url = item.querySelector('[name="social-url"]').value;
        if (platform && url) {
            venueSocials[platform] = url;
        }
    });
    
    // Collect KJ socials
    const kjSocials = {};
    document.querySelectorAll('#kj-socials-container .dynamic-item').forEach(item => {
        const platform = item.querySelector('[name="social-platform"]').value;
        const url = item.querySelector('[name="social-url"]').value;
        if (platform && url) {
            kjSocials[platform] = url;
        }
    });
    
    // Build venue object
    const venue = {
        id: document.getElementById('venue-id').value,
        VenueName: document.getElementById('venue-name').value,
        Dedicated: document.getElementById('venue-dedicated').checked || undefined,
        Address: {
            Street: document.getElementById('address-street').value,
            City: document.getElementById('address-city').value,
            State: document.getElementById('address-state').value,
            Zip: document.getElementById('address-zip').value
        },
        Timeframe: {
            StartDate: document.getElementById('timeframe-start').value || null,
            EndDate: document.getElementById('timeframe-end').value || null
        },
        KJ: {
            Host: document.getElementById('kj-host').value || '',
            Company: document.getElementById('kj-company').value || '',
            KJsocials: Object.keys(kjSocials).length > 0 ? kjSocials : undefined
        },
        socials: venueSocials,
        schedule: schedule
    };
    
    // Remove undefined properties
    return JSON.parse(JSON.stringify(venue));
}

// Validate venue form
function validateVenueForm() {
    const venueId = document.getElementById('venue-id').value;
    const venueName = document.getElementById('venue-name').value;
    
    if (!venueId.trim()) {
        showStatus('Venue ID is required', 'error');
        return false;
    }
    
    if (!venueName.trim()) {
        showStatus('Venue name is required', 'error');
        return false;
    }
    
    // Check ID format
    const idRegex = /^[a-z0-9-]+$/;
    if (!idRegex.test(venueId)) {
        showStatus('Venue ID must be lowercase with hyphens only', 'error');
        return false;
    }
    
    return true;
}

// Delete current venue
function deleteCurrentVenue() {
    if (!editorState.currentVenueId) return;
    
    if (!confirm('Delete this venue?')) return;
    
    const index = editorState.venues.findIndex(v => v.id === editorState.currentVenueId);
    if (index !== -1) {
        editorState.venues.splice(index, 1);
        editorState.currentVenueId = null;
        
        // Update everything
        updateJSONEditor();
        renderVenueSelector();
        clearVenueForm();
        updateVenueCount();
        
        showStatus('Venue deleted', 'success');
    }
}

// Preview current venue
function previewCurrentVenue() {
    // Implementation similar to your main app's preview
    showStatus('Preview feature coming soon', 'info');
}

// Render schedule items
function renderScheduleItems(schedule) {
    const container = document.getElementById('schedule-container');
    container.innerHTML = '';
    
    schedule.forEach((item, index) => {
        container.appendChild(createScheduleItemElement(item, index));
    });
}

// Create schedule item element
function createScheduleItemElement(item, index) {
    const div = document.createElement('div');
    div.className = 'dynamic-item';
    
    div.innerHTML = `
        <div class="dynamic-item-header">
            <span class="dynamic-item-title">Schedule Item ${index + 1}</span>
            <div class="dynamic-item-actions">
                <button type="button" class="btn-small remove-item"><i class="fas fa-trash"></i></button>
            </div>
        </div>
        <div class="dynamic-item-content">
            <div class="form-row">
                <div class="form-group">
                    <label>Frequency</label>
                    <select name="schedule-frequency" required>
                        <option value="every" ${item.day[0] === 'every' ? 'selected' : ''}>Every</option>
                        <option value="first" ${item.day[0] === 'first' ? 'selected' : ''}>First</option>
                        <option value="second" ${item.day[0] === 'second' ? 'selected' : ''}>Second</option>
                        <option value="third" ${item.day[0] === 'third' ? 'selected' : ''}>Third</option>
                        <option value="fourth" ${item.day[0] === 'fourth' ? 'selected' : ''}>Fourth</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Day</label>
                    <select name="schedule-day" required>
                        <option value="Sunday" ${item.day[1] === 'Sunday' ? 'selected' : ''}>Sunday</option>
                        <option value="Monday" ${item.day[1] === 'Monday' ? 'selected' : ''}>Monday</option>
                        <option value="Tuesday" ${item.day[1] === 'Tuesday' ? 'selected' : ''}>Tuesday</option>
                        <option value="Wednesday" ${item.day[1] === 'Wednesday' ? 'selected' : ''}>Wednesday</option>
                        <option value="Thursday" ${item.day[1] === 'Thursday' ? 'selected' : ''}>Thursday</option>
                        <option value="Friday" ${item.day[1] === 'Friday' ? 'selected' : ''}>Friday</option>
                        <option value="Saturday" ${item.day[1] === 'Saturday' ? 'selected' : ''}>Saturday</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Time</label>
                <input type="text" name="schedule-time" value="${item.time || ''}" 
                       placeholder="7:00 PM - 10:00 PM" required>
            </div>
            <div class="form-group">
                <label>Description (Optional)</label>
                <input type="text" name="schedule-description" value="${item.description || ''}" 
                       placeholder="Every Wednesday and Friday">
            </div>
        </div>
    `;
    
    // Add remove event
    div.querySelector('.remove-item').addEventListener('click', () => {
        div.remove();
    });
    
    return div;
}

// Add new schedule item
function addScheduleItem() {
    const container = document.getElementById('schedule-container');
    const newItem = {
        day: ['every', 'Sunday'],
        time: '',
        description: ''
    };
    container.appendChild(createScheduleItemElement(newItem, container.children.length));
}

// Render social items
function renderSocialItems(type, socials) {
    const containerId = type === 'venue' ? 'venue-socials-container' : 'kj-socials-container';
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    Object.entries(socials).forEach(([platform, url], index) => {
        if (url) {
            container.appendChild(createSocialItemElement(platform, url, index));
        }
    });
}

// Create social item element
function createSocialItemElement(platform, url, index) {
    const div = document.createElement('div');
    div.className = 'dynamic-item';
    
    div.innerHTML = `
        <div class="dynamic-item-header">
            <span class="dynamic-item-title">${platform}</span>
            <div class="dynamic-item-actions">
                <button type="button" class="btn-small remove-item"><i class="fas fa-trash"></i></button>
            </div>
        </div>
        <div class="dynamic-item-content">
            <div class="form-row">
                <div class="form-group">
                    <label>Platform</label>
                    <select name="social-platform" required>
                        <option value="">Select Platform</option>
                        <option value="Facebook" ${platform === 'Facebook' ? 'selected' : ''}>Facebook</option>
                        <option value="Instagram" ${platform === 'Instagram' ? 'selected' : ''}>Instagram</option>
                        <option value="Twitter" ${platform === 'Twitter' ? 'selected' : ''}>Twitter</option>
                        <option value="Website" ${platform === 'Website' ? 'selected' : ''}>Website</option>
                        <option value="Bluesky" ${platform === 'Bluesky' ? 'selected' : ''}>Bluesky</option>
                        <option value="Tiktok" ${platform === 'Tiktok' ? 'selected' : ''}>TikTok</option>
                        <option value="Youtube" ${platform === 'Youtube' ? 'selected' : ''}>YouTube</option>
                        <option value="Other" ${platform === 'Other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>URL</label>
                    <input type="url" name="social-url" value="${url || ''}" 
                           placeholder="https://example.com/page" required>
                </div>
            </div>
        </div>
    `;
    
    div.querySelector('.remove-item').addEventListener('click', () => {
        div.remove();
    });
    
    return div;
}

// Add social item
function addSocialItem(type) {
    const containerId = type === 'venue' ? 'venue-socials-container' : 'kj-socials-container';
    const container = document.getElementById(containerId);
    
    const newItem = createSocialItemElement('', '', container.children.length);
    container.appendChild(newItem);
}

// Update venue count
function updateVenueCount() {
    document.getElementById('venue-count').textContent = editorState.venues.length;
}

// Show status message
function showStatus(message, type = 'info') {
    const el = document.getElementById('status-message');
    el.textContent = message;
    el.className = type + ' show';
    
    setTimeout(() => {
        el.className = '';
    }, 3000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initEditor);