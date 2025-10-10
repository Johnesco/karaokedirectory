// ======================
// MODULE IMPORTS
// ======================
import { 
    escapeHtml, 
    sanitizeUrl, 
    capitalizeFirstLetter, 
    getSortableName 
} from './modules/stringUtils.js';

import { 
    DEFAULT_VENUE 
} from './modules/constants.js';

// ======================
// EDITOR STATE
// ======================
let venueData = { listings: [] };
let selectedVenueIndex = -1;

// ======================
// DOM ELEMENTS
// ======================
const venueList = document.getElementById('venueList');
const venueEditor = document.getElementById('venueEditor');
const noSelection = document.getElementById('noSelection');
const jsonOutput = document.getElementById('jsonOutput');
const editorTab = document.getElementById('editorTab');
const jsonTab = document.getElementById('jsonTab');

// Form fields (abbreviated for clarity - you'd include all your form fields)
const venueName = document.getElementById('venueName');
const dedicated = document.getElementById('dedicated');
const street = document.getElementById('street');
const city = document.getElementById('city');
const state = document.getElementById('state');
const zip = document.getElementById('zip');
const startDate = document.getElementById('startDate');
const endDate = document.getElementById('endDate');
const kjHost = document.getElementById('kjHost');
const kjCompany = document.getElementById('kjCompany');
// ... include all other form fields

// Buttons
const addVenueBtn = document.getElementById('addVenue');
const saveVenueBtn = document.getElementById('saveVenue');
const deleteVenueBtn = document.getElementById('deleteVenue');
const addOrdinalDayBtn = document.getElementById('addOrdinalDay');
const copyJsonBtn = document.getElementById('copyJson');
const loadJsonBtn = document.getElementById('loadJson');
const jsonFileInput = document.getElementById('jsonFileInput');
const sortVenuesBtn = document.getElementById('sortVenues');

// Schedule elements
const ordinalItems = document.getElementById('ordinalItems');
const newOrdinalNumber = document.getElementById('newOrdinalNumber');
const newOrdinalDay = document.getElementById('newOrdinalDay');
const newOrdinalTime = document.getElementById('newOrdinalTime');
const newOrdinalDesc = document.getElementById('newOrdinalDesc');

// Tab buttons
const tabButtons = document.querySelectorAll('.tab-button');

// ======================
// EDITOR FUNCTIONS
// ======================

/**
 * Initialize the editor
 */
function init() {
    loadSampleData();
    setupEventListeners();
    renderVenueList();
    updateJsonOutput();
}

/**
 * Load sample data
 */
function loadSampleData() {
    venueData = karaokeData;
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    addVenueBtn.addEventListener('click', addNewVenue);
    saveVenueBtn.addEventListener('click', saveVenue);
    deleteVenueBtn.addEventListener('click', deleteVenue);
    addOrdinalDayBtn.addEventListener('click', addOrdinalDay);
    copyJsonBtn.addEventListener('click', copyJsonToClipboard);
    loadJsonBtn.addEventListener('click', () => jsonFileInput.click());
    jsonFileInput.addEventListener('change', handleFileUpload);
    sortVenuesBtn.addEventListener('click', sortVenuesAlphabetically);
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

/**
 * Render the venue list
 */
function renderVenueList() {
    venueList.innerHTML = '';
    
    venueData.listings.forEach((venue, index) => {
        const venueItem = document.createElement('div');
        venueItem.className = 'venue-item';
        if (index === selectedVenueIndex) {
            venueItem.classList.add('selected');
        }
        
        const venueNameDiv = document.createElement('div');
        venueNameDiv.className = 'venue-name';
        venueNameDiv.textContent = venue.VenueName;
        
        const venueDetailsDiv = document.createElement('div');
        venueDetailsDiv.className = 'venue-details';
        
        const addressDiv = document.createElement('div');
        addressDiv.className = 'venue-address';
        addressDiv.textContent = `${venue.Address.Street}, ${venue.Address.City}, ${venue.Address.State} ${venue.Address.Zip}`;
        
        const kjDiv = document.createElement('div');
        kjDiv.className = 'venue-kj';
        let kjText = '';
        if (venue.KJ.Host) kjText += `Host: ${venue.KJ.Host}`;
        if (venue.KJ.Company) {
            if (kjText) kjText += ' | ';
            kjText += `Company: ${venue.KJ.Company}`;
        }
        kjDiv.textContent = kjText || 'No KJ info';
        
        venueDetailsDiv.appendChild(addressDiv);
        venueDetailsDiv.appendChild(kjDiv);
        
        venueItem.appendChild(venueNameDiv);
        venueItem.appendChild(venueDetailsDiv);
        
        venueItem.addEventListener('click', () => selectVenue(index));
        
        venueList.appendChild(venueItem);
    });
}

/**
 * Select a venue to edit
 */
function selectVenue(index) {
    selectedVenueIndex = index;
    renderVenueList();
    
    const venue = venueData.listings[index];
    
    // Show editor and hide no selection message
    venueEditor.style.display = 'block';
    noSelection.style.display = 'none';
    
    // Populate form fields with venue data
    populateFormFields(venue);
    
    // Render schedule
    renderSchedule(venue.schedule);
    
    updateJsonOutput();
}

/**
 * Populate form fields with venue data
 */
function populateFormFields(venue) {
    // Basic info
    venueName.value = venue.VenueName;
    dedicated.checked = venue.Dedicated || false;
    
    // Address
    street.value = venue.Address.Street || '';
    city.value = venue.Address.City || '';
    state.value = venue.Address.State || '';
    zip.value = venue.Address.Zip || '';
    
    // Timeframe
    startDate.value = venue.Timeframe?.StartDate || '';
    endDate.value = venue.Timeframe?.EndDate || '';
    
    // KJ info
    kjHost.value = venue.KJ.Host || '';
    kjCompany.value = venue.KJ.Company || '';
    
    // KJ socials
    const kjSocials = venue.KJ.KJsocials || venue.KJ.socials || {};
    populateSocialFields(kjSocials, 'kj');
    
    // Venue socials
    populateSocialFields(venue.socials || {}, '');
}

/**
 * Populate social media fields
 */
function populateSocialFields(socials, prefix) {
    const fields = ['Facebook', 'Instagram', 'Twitter', 'Website', 'Bluesky', 'Tiktok', 'Youtube'];
    fields.forEach(field => {
        const element = document.getElementById(prefix + field.toLowerCase());
        if (element) {
            element.value = socials[field] || '';
        }
    });
}

/**
 * Render schedule
 */
function renderSchedule(schedule) {
    ordinalItems.innerHTML = '';
    
    if (!schedule) return;
    
    schedule.forEach((item, index) => {
        const scheduleItem = document.createElement('div');
        scheduleItem.className = 'ordinal-item';
        
        const scheduleText = document.createElement('div');
        scheduleText.textContent = `${capitalizeFirstLetter(item.day[0])} ${item.day[1]}: ${item.time}`;
        
        if (item.description) {
            const descText = document.createElement('div');
            descText.textContent = item.description;
            descText.style.fontSize = '0.9em';
            descText.style.color = '#666';
            scheduleText.appendChild(descText);
        }
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'danger';
        deleteBtn.style.marginTop = '5px';
        deleteBtn.addEventListener('click', () => {
            deleteScheduleItem(index);
        });
        
        scheduleItem.appendChild(scheduleText);
        scheduleItem.appendChild(deleteBtn);
        ordinalItems.appendChild(scheduleItem);
    });
}

/**
 * Add a new venue
 */
function addNewVenue() {
    const newVenue = JSON.parse(JSON.stringify(DEFAULT_VENUE));
    venueData.listings.push(newVenue);
    selectedVenueIndex = venueData.listings.length - 1;
    renderVenueList();
    selectVenue(selectedVenueIndex);
    updateJsonOutput();
}

/**
 * Save venue changes
 */
function saveVenue() {
    if (selectedVenueIndex === -1) return;
    
    const venue = venueData.listings[selectedVenueIndex];
    
    // Update all venue data from form fields
    updateVenueFromForm(venue);
    
    renderVenueList();
    updateJsonOutput();
}

/**
 * Update venue data from form fields
 */
function updateVenueFromForm(venue) {
    // Basic info
    venue.VenueName = venueName.value;
    venue.Dedicated = dedicated.checked;
    
    // Address
    venue.Address = {
        Street: street.value,
        City: city.value,
        State: state.value,
        Zip: zip.value
    };
    
    // Timeframe
    venue.Timeframe = {
        StartDate: startDate.value || null,
        EndDate: endDate.value || null
    };
    
    // KJ info and socials
    venue.KJ = {
        Host: kjHost.value,
        Company: kjCompany.value,
        KJsocials: getSocialsData('kj')
    };
    
    // Venue socials
    venue.socials = getSocialsData('');
}

/**
 * Get social media data from form fields
 */
function getSocialsData(prefix) {
    return {
        Facebook: document.getElementById(prefix + 'facebook').value || null,
        Instagram: document.getElementById(prefix + 'instagram').value || null,
        Twitter: document.getElementById(prefix + 'twitter').value || null,
        Website: document.getElementById(prefix + 'website').value || null,
        Bluesky: document.getElementById(prefix + 'bluesky').value || null,
        Tiktok: document.getElementById(prefix + 'tiktok').value || null,
        Youtube: document.getElementById(prefix + 'youtube').value || null
    };
}

/**
 * Delete a venue
 */
function deleteVenue() {
    if (selectedVenueIndex === -1) return;
    
    if (confirm('Are you sure you want to delete this venue?')) {
        venueData.listings.splice(selectedVenueIndex, 1);
        selectedVenueIndex = -1;
        renderVenueList();
        
        venueEditor.style.display = 'none';
        noSelection.style.display = 'block';
        
        updateJsonOutput();
    }
}

/**
 * Add a schedule day
 */
function addOrdinalDay() {
    if (selectedVenueIndex === -1) return;
    
    const number = newOrdinalNumber.value;
    const day = newOrdinalDay.value;
    const time = newOrdinalTime.value.trim();
    const description = newOrdinalDesc.value.trim();
    
    if (!time) {
        alert('Please enter a time range');
        return;
    }
    
    const newScheduleItem = {
        day: [number, day],
        time: time
    };
    
    if (description) {
        newScheduleItem.description = description;
    }
    
    if (!venueData.listings[selectedVenueIndex].schedule) {
        venueData.listings[selectedVenueIndex].schedule = [];
    }
    
    venueData.listings[selectedVenueIndex].schedule.push(newScheduleItem);
    renderSchedule(venueData.listings[selectedVenueIndex].schedule);
    
    newOrdinalTime.value = '';
    newOrdinalDesc.value = '';
    
    updateJsonOutput();
}

/**
 * Delete a schedule item
 */
function deleteScheduleItem(index) {
    if (selectedVenueIndex === -1) return;
    
    venueData.listings[selectedVenueIndex].schedule.splice(index, 1);
    renderSchedule(venueData.listings[selectedVenueIndex].schedule);
    updateJsonOutput();
}

/**
 * Sort venues alphabetically
 */
function sortVenuesAlphabetically() {
    venueData.listings.sort((a, b) => {
        const nameA = getSortableName(a.VenueName);
        const nameB = getSortableName(b.VenueName);
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    });
    
    renderVenueList();
    updateJsonOutput();
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
    tabButtons.forEach(button => {
        if (button.getAttribute('data-tab') === tabName) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    
    if (tabName === 'editor') {
        editorTab.style.display = 'block';
        jsonTab.style.display = 'none';
    } else if (tabName === 'json') {
        editorTab.style.display = 'none';
        jsonTab.style.display = 'block';
    }
}

/**
 * Update the JSON output
 */
function updateJsonOutput() {
    jsonOutput.value = "const karaokeData = " + JSON.stringify(venueData, null, 2) + ";";
}

/**
 * Copy JSON to clipboard
 */
function copyJsonToClipboard() {
    jsonOutput.select();
    document.execCommand('copy');
    alert('JSON copied to clipboard!');
}

/**
 * Handle file upload
 */
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data && data.listings) {
                venueData = data;
                selectedVenueIndex = -1;
                renderVenueList();
                
                venueEditor.style.display = 'none';
                noSelection.style.display = 'block';
                
                updateJsonOutput();
                alert('File loaded successfully!');
            } else {
                alert('Invalid JSON format. Expected a "listings" array.');
            }
        } catch (error) {
            alert('Error parsing JSON: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// Initialize the app when the page loads
window.addEventListener('DOMContentLoaded', init);