/**
 * Google Apps Script — Austin Karaoke Directory Submissions
 *
 * NOT DEPLOYED, AND NOTHING CALLS IT.
 *
 * submit.html does not post anywhere — it composes an email for the visitor to
 * send, and the curator reconciles it by hand. This file is the Apps Script
 * that would receive a POST if a server were stood up, kept as the source of
 * record so that day is a deploy rather than a rewrite. The payload
 * js/submit.js builds is already the shape doPost expects.
 *
 * It sits under backend/ so its status is obvious from the tree (#168). At the
 * repo root it read as part of the static site Netlify publishes, which it has
 * never been.
 *
 * Setup, when that day comes:
 * 1. Create a Google Sheet named "Karaoke Directory Submissions"
 * 2. Open Extensions > Apps Script
 * 3. Paste this entire file into the Code.gs editor
 * 4. Project Settings > Script Properties: add NOTIFICATION_EMAIL, a
 *    comma-separated list of recipients (see below)
 * 5. Save, then Deploy > New deployment > Web app
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 6. Authorize when prompted
 * 7. Point js/submit.js at the deployed URL — presentSubmission() is where
 *    the email-composing path lives and would gain a POST attempt
 */

/**
 * Recipients, from a Script Property rather than a literal.
 *
 * Two personal addresses used to be hardcoded here, which meant they were
 * published in a public repository and that changing them was a code edit.
 * Set NOTIFICATION_EMAIL under Project Settings > Script Properties.
 */
function getNotificationEmail() {
  var value = PropertiesService.getScriptProperties().getProperty('NOTIFICATION_EMAIL');
  if (!value) {
    throw new Error(
      'NOTIFICATION_EMAIL script property is not set. ' +
      'Add it under Project Settings > Script Properties.'
    );
  }
  return value;
}

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
    }

    // 'report' was handled here too, writing to an "Issue Reports" sheet.
    // Nothing ever sent it — the submit form posts only type: 'venue' — so the
    // handler and its branch went in #168.
    return buildResponse(400, { status: 'error', message: 'Unknown submission type.' });
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
    'Schedule JSON', 'Host Name', 'Host Affiliation', 'Host Website',
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
    host.affiliation || '',
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
      getNotificationEmail(),
      'New Venue Submission: ' + (venue.name || 'Unknown'),
      data.emailBody
    );
  }

  return buildResponse(200, { status: 'ok', message: 'Venue submission recorded.' });
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
