/**
 * Google Apps Script — Austin Karaoke Directory Submissions
 *
 * Setup:
 * 1. Create a Google Sheet named "Karaoke Directory Submissions"
 * 2. Open Extensions > Apps Script
 * 3. Paste this entire file into the Code.gs editor
 * 4. Save, then Deploy > New deployment > Web app
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 5. Authorize when prompted
 * 6. Copy the deployed URL into APPS_SCRIPT_URL in submit.html
 */

const NOTIFICATION_EMAIL = 'karaokedirectoryatx@gmail.com,letmeshowyou@gmail.com';

// ---- HTTP Handlers ----

function doGet(e) {
  return buildResponse(200, { status: 'ok', message: 'Karaoke Directory Submissions API is running.' });
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Honeypot check — bots fill hidden fields; silently accept but don't process
    if (data.honeypot) {
      return buildResponse(200, { status: 'ok' });
    }

    if (data.type === 'venue') {
      return handleVenueSubmission(data);
    } else if (data.type === 'report') {
      return handleReportSubmission(data);
    } else {
      return buildResponse(400, { status: 'error', message: 'Unknown submission type.' });
    }
  } catch (err) {
    return buildResponse(500, { status: 'error', message: err.toString() });
  }
}

// ---- Submission Handlers ----

function handleVenueSubmission(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, 'Venue Submissions', [
    'Timestamp', 'Venue Name', 'Venue ID', 'Dedicated', 'Tags',
    'Street', 'City', 'State', 'ZIP',
    'Schedule JSON', 'Host Name', 'Host Company', 'Host Website',
    'Website', 'Facebook', 'Instagram', 'Twitter',
    'Notes', 'Submitter Name', 'Submitter Type', 'Contact Methods',
    'Full Venue JSON', 'Status'
  ]);

  var venue = data.venue || {};
  var address = venue.address || {};
  var host = venue.host || {};
  var socials = venue.socials || {};

  sheet.appendRow([
    new Date(),
    venue.name || '',
    venue.id || '',
    venue.dedicated ? 'Yes' : 'No',
    (venue.tags || []).join(', '),
    address.street || '',
    address.city || '',
    address.state || '',
    address.zip || '',
    JSON.stringify(venue.schedule || []),
    host.name || '',
    host.company || '',
    host.website || '',
    socials.website || '',
    socials.facebook || '',
    socials.instagram || '',
    socials.twitter || '',
    data.notes || '',
    data.submitterName || '',
    data.submitterType || '',
    JSON.stringify(data.contactMethods || []),
    JSON.stringify(venue),
    'New'
  ]);

  // Send email notification
  if (data.emailBody) {
    GmailApp.sendEmail(
      NOTIFICATION_EMAIL,
      'New Venue Submission: ' + (venue.name || 'Unknown'),
      data.emailBody
    );
  }

  return buildResponse(200, { status: 'ok', message: 'Venue submission recorded.' });
}

function handleReportSubmission(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, 'Issue Reports', [
    'Timestamp', 'Venue Name', 'Issues', 'Details', 'Reporter Email', 'Status'
  ]);

  sheet.appendRow([
    new Date(),
    data.venueName || '',
    (data.issues || []).join(', '),
    data.details || '',
    data.contact || '',
    'New'
  ]);

  // Send email notification
  if (data.emailBody) {
    GmailApp.sendEmail(
      NOTIFICATION_EMAIL,
      'Issue Report: ' + (data.venueName || 'Unknown'),
      data.emailBody
    );
  }

  return buildResponse(200, { status: 'ok', message: 'Issue report recorded.' });
}

// ---- Helpers ----

function getOrCreateSheet(spreadsheet, name, headers) {
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

function buildResponse(statusCode, payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
