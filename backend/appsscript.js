// ==========================================
// STEP 5: Standardisasi Format Response
// ==========================================
function sendSuccess(data) {
  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, data }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function sendError(error) {
  return ContentService.createTextOutput(
    JSON.stringify({ ok: false, error }),
  ).setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// STEP 1 & 8: Router GET & UI Frontend
// ==========================================
function doGet(e) {
  // Gunakan parameter ?path= (Default ke UI)
  const path = e.parameter && e.parameter.path ? e.parameter.path : "ui";

  if (path === "presence/status") {
    return handleCheckStatus(e.parameter);
  } else if (path === "presence/list") {
    return handleGetPresenceList(e.parameter);
  } else if (path === "ui") {
    return HtmlService.createHtmlOutputFromFile("Index")
      .setTitle("Dashboard Presensi QR")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  return sendError("Route not found");
}

// ==========================================
// STEP 1: Router POST API
// ==========================================
function doPost(e) {
  try {
    const path = e.parameter && e.parameter.path ? e.parameter.path : "";
    const body = JSON.parse(e.postData.contents);

    if (path === "presence/qr/generate") {
      return handleGenerateQR(body);
    } else if (path === "presence/checkin") {
      return handleCheckIn(body);
    } else {
      return sendError("Route not found");
    }
  } catch (error) {
    return sendError("bad_request");
  }
}

function handleGetPresenceList(params) {
  if (!params.course_id || !params.session_id) {
    return sendError("missing_parameter");
  }

  try {
    const presenceSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("presence");
    const data = presenceSheet.getDataRange().getValues();
    
    let attendees = [];
    
    // Mulai dari index 1 untuk melewati baris Header
    for (let i = 1; i < data.length; i++) {
      let row = data[i];
      // Cek kecocokan course_id dan session_id
      if (row[3] === params.course_id && row[4] === params.session_id) {
        attendees.push({
          user_id: row[1],
          time: row[7] // Timestamp dari kolom recorded_at
        });
      }
    }
    
    return sendSuccess(attendees);
  } catch (error) {
    return sendError("database_error");
  }
}

// ==========================================
// STEP 2: Modul Presensi QR Dinamis
// ==========================================

// Dipanggil via API (Postman/Client)
function handleGenerateQR(body) {
  if (!body.course_id || !body.session_id || !body.ts)
    return sendError("missing_field");

  // Menggunakan fungsi logika yang sama dengan UI
  const result = processGenerateQR(body);
  if (result.ok) {
    return sendSuccess(result.data);
  } else {
    return sendError(result.error);
  }
}

// Dipanggil via google.script.run dari Index.html (Step 8)
function processGenerateQR(payload) {
  try {
    const token = "TKN-" + Utilities.getUuid().substring(0, 6).toUpperCase();
    const requestTime = new Date(payload.ts);
    const expiresTime = new Date(requestTime.getTime() + 120000); // TTL 120 detik

    const sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName("tokens");
    // Header: qr_token, course_id, session_id, created_at, expires_at, used
    sheet.appendRow([
      token,
      payload.course_id,
      payload.session_id,
      requestTime.toISOString(),
      expiresTime.toISOString(),
      false,
    ]);

    return {
      ok: true,
      data: { qr_token: token, expires_at: expiresTime.toISOString() },
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function handleCheckIn(body) {
  if (
    !body.user_id ||
    !body.device_id ||
    !body.course_id ||
    !body.session_id ||
    !body.qr_token ||
    !body.ts
  ) {
    return sendError("missing_field");
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tokenSheet = ss.getSheetByName("tokens");
    const tokenData = tokenSheet.getDataRange().getValues();

    let tokenRowIndex = -1;
    let isValidToken = false;
    let isExpired = false;
    let isUsed = false;

    for (let i = 1; i < tokenData.length; i++) {
      let row = tokenData[i];
      if (
        row[0] === body.qr_token &&
        row[1] === body.course_id &&
        row[2] === body.session_id
      ) {
        isValidToken = true;
        tokenRowIndex = i + 1; // +1 karena index array vs baris sheet

        const expiresAt = new Date(row[4]);
        const scanTime = new Date(body.ts);

        if (scanTime > expiresAt) isExpired = true;
        if (row[5] === true) isUsed = true; // Cek status used
        break;
      }
    }

    if (!isValidToken) return sendError("token_invalid");
    if (isExpired) return sendError("token_expired");
    if (isUsed) return sendError("token_already_used");

    // Tandai token menjadi used = true
    tokenSheet.getRange(tokenRowIndex, 6).setValue(true);

    // Simpan ke sheet presence
    const presenceSheet = ss.getSheetByName("presence");
    const presenceId =
      "PR-" + Utilities.getUuid().substring(0, 6).toUpperCase();

    presenceSheet.appendRow([
      presenceId,
      body.user_id,
      body.device_id,
      body.course_id,
      body.session_id,
      body.qr_token,
      body.ts,
      new Date().toISOString(),
    ]);

    return sendSuccess({ presence_id: presenceId, status: "checked_in" });
  } catch (error) {
    return sendError("database_error");
  }
}

function handleCheckStatus(params) {
  if (!params.user_id || !params.course_id || !params.session_id)
    return sendError("missing_parameter");

  const presenceSheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName("presence");
  const data = presenceSheet.getDataRange().getValues();

  for (let i = data.length - 1; i > 0; i--) {
    let row = data[i];
    if (
      row[1] === params.user_id &&
      row[3] === params.course_id &&
      row[4] === params.session_id
    ) {
      return sendSuccess({
        user_id: row[1],
        course_id: row[3],
        session_id: row[4],
        status: "checked_in",
        last_ts: row[6],
      });
    }
  }
  return sendSuccess({ user_id: params.user_id, status: "not_checked_in" });
}
