/**
 * Google Apps Script — RSVP → Google Sheet (real-time)
 *
 * Setup:
 * 1. Create a Google Sheet with headers in row 1:
 *    Timestamp | Name | Email | Phone | Attendance | Guests | Guest Names | Notes
 * 2. Extensions → Apps Script
 * 3. Paste this file's contents into Code.gs and save
 * 4. Deploy → New deployment → Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web App URL into script.js → GOOGLE_SCRIPT_URL
 */

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    const data = JSON.parse(e.postData.contents);

    sheet.appendRow([
      new Date(),
      data.name || "",
      data.email || "",
      data.phone || "",
      data.attendance || "",
      data.guests || "",
      data.guestNames || "",
      data.notes || "",
    ]);

    return ContentService.createTextOutput(
      JSON.stringify({ ok: true })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput("RSVP endpoint is live.");
}
