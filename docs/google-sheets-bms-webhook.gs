/**
 * BMS approved-order append webhook.
 * Deploy as a Google Apps Script Web App (execute as owner; access: anyone with URL).
 * Set Script Properties: BMS_WEBHOOK_SECRET, BMS_SHEET_ID, BMS_TAB_NAME.
 * Column A is the unique idempotency key; duplicate requests do not append twice.
 */
function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  const expected = props.getProperty("BMS_WEBHOOK_SECRET");
  const sheetId = props.getProperty("BMS_SHEET_ID");
  const tabName = props.getProperty("BMS_TAB_NAME") || "BMS Orders";
  let data;
  try { data = JSON.parse(e.postData.contents || "{}"); }
  catch (_) { return json({ ok: false, error: "Invalid JSON" }); }
  if (!expected || !sheetId || data.webhookSecret !== expected) {
    return json({ ok: false, error: "Unauthorized" });
  }
  if (!data.idempotencyKey || !data.submissionId || !data.projectTitle || !data.clientUsername) {
    return json({ ok: false, error: "Missing required fields" });
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const book = SpreadsheetApp.openById(sheetId);
    const sheet = book.getSheetByName(tabName) || book.insertSheet(tabName);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Idempotency Key","Submission ID","Client","Project","Category","Amount","Fee","Order URL","Notes","Submitted At","Approved At","Synced At"]);
    }
    const last = sheet.getLastRow();
    if (last > 1) {
      const keys = sheet.getRange(2, 1, last - 1, 1).getDisplayValues().flat();
      const found = keys.indexOf(String(data.idempotencyKey));
      if (found !== -1) return json({ ok: true, rowKey: "row-" + (found + 2), duplicate: true });
    }
    sheet.appendRow([
      String(data.idempotencyKey), Number(data.submissionId), String(data.clientUsername),
      String(data.projectTitle), String(data.category || "General"), Number(data.amount || 0),
      Number(data.fiverrFee || 0), String(data.orderUrl || ""), String(data.notes || ""),
      String(data.submittedAt || ""), String(data.approvedAt || ""), new Date().toISOString()
    ]);
    return json({ ok: true, rowKey: "row-" + sheet.getLastRow(), duplicate: false });
  } catch (err) {
    return json({ ok: false, error: "Could not append row" });
  } finally {
    lock.releaseLock();
  }
}
function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
