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
  const path = e.parameter && e.parameter.path ? e.parameter.path : "ui";

  if (path === "presence/status") {
    return handleCheckStatus(e.parameter);
  } else if (path === "presence/list") {
    return handleGetPresenceList(e.parameter);
  } else if (path === "telemetry/accel/latest") { 
    return handleGetLatestAccel(e.parameter);
  } else if (path === "telemetry/gps/latest") { // <--- ROUTE BARU MODUL 3 (MARKER/MULTIPLAYER)
    return handleGetLatestGPS(e.parameter);
  } else if (path === "telemetry/gps/history") { // <--- ROUTE BARU MODUL 3 (POLYLINE)
    return handleGetHistoryGPS(e.parameter);
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
    } else if (path === "telemetry/accel") { 
      return handlePostAccel(body);
    } else if (path === "telemetry/gps") { // <--- ROUTE BARU MODUL 3 (SIMPAN LOKASI)
      return handlePostGPS(body);
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
// function processGenerateQR(payload) {
//   try {
//     const token = "TKN-" + Utilities.getUuid().substring(0, 6).toUpperCase();
//     const requestTime = new Date(payload.ts);
    
//     // REVISI DOSEN: Ubah TTL menjadi 20 detik (20000 milidetik)
//     const expiresTime = new Date(requestTime.getTime() + 20000); 

//     const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("tokens");
    
//     // Header sheet ke-6 sekarang konsepnya adalah 'scan_count'
//     sheet.appendRow([
//       token,
//       payload.course_id,
//       payload.session_id,
//       requestTime.toISOString(),
//       expiresTime.toISOString(),
//       0, // <--- REVISI DOSEN: Ubah false menjadi 0 (jumlah scan awal)
//     ]);

//     return {
//       ok: true,
//       data: { qr_token: token, expires_at: expiresTime.toISOString() },
//     };
//   } catch (error) {
//     return { ok: false, error: error.message };
//   }
// }

// Dipanggil via google.script.run dari Index.html (Step 8)
function processGenerateQR(payload) {
  try {
    const token = "TKN-" + Utilities.getUuid().substring(0, 6).toUpperCase();
    const requestTime = new Date(payload.ts);
    
    // REVISI: Ubah TTL menjadi 25 detik + 5 detik toleransi jaringan = 30000 ms
    const expiresTime = new Date(requestTime.getTime() + 30000); 

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("tokens");
    
    // Menangkap batas kapasitas dari frontend (default 50 jika kosong)
    const maxCapacity = payload.max_capacity || 50; 

    // Header: qr_token | course_id | session_id | created_at | expires_at | max_capacity
    sheet.appendRow([
      token,
      payload.course_id,
      payload.session_id,
      requestTime.toISOString(),
      expiresTime.toISOString(),
      maxCapacity, // <--- Menyimpan batas maksimal kelas di kolom ke-6
    ]);

    return {
      ok: true,
      data: { qr_token: token, expires_at: expiresTime.toISOString() },
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// function handleCheckIn(body) {
//   if (!body.user_id || !body.device_id || !body.course_id || !body.session_id || !body.qr_token || !body.ts) {
//     return sendError("missing_field");
//   }

//   try {
//     const ss = SpreadsheetApp.getActiveSpreadsheet();
//     const tokenSheet = ss.getSheetByName("tokens");
//     const tokenData = tokenSheet.getDataRange().getValues();

//     let tokenRowIndex = -1;
//     let isValidToken = false;
//     let isExpired = false;
//     let isLimitReached = false; // <--- REVISI: Ganti isUsed jadi isLimitReached
    
//     let currentScans = 0;
//     const MAX_SCANS = 5; // <--- REVISI DOSEN: Batas maksimal 1 token untuk 5 orang

//     for (let i = 1; i < tokenData.length; i++) {
//       let row = tokenData[i];
//       if (row[0] === body.qr_token && row[1] === body.course_id && row[2] === body.session_id) {
//         isValidToken = true;
//         tokenRowIndex = i + 1;

//         const expiresAt = new Date(row[4]);
//         const scanTime = new Date(body.ts);

//         if (scanTime > expiresAt) isExpired = true;
        
//         // REVISI DOSEN: Hitung jumlah scan saat ini
//         currentScans = Number(row[5]) || 0;
//         if (currentScans >= MAX_SCANS) isLimitReached = true;
        
//         break;
//       }
//     }

//     if (!isValidToken) return sendError("token_invalid");
//     if (isExpired) return sendError("token_expired");
    
//     // REVISI DOSEN: Tolak jika sudah melebihi batas scan
//     if (isLimitReached) return sendError("token_limit_reached"); 

//     // REVISI DOSEN: Tambahkan jumlah scan (+1) lalu simpan ke database
//     tokenSheet.getRange(tokenRowIndex, 6).setValue(currentScans + 1);

//     // Simpan ke sheet presence
//     const presenceSheet = ss.getSheetByName("presence");
//     const presenceId = "PR-" + Utilities.getUuid().substring(0, 6).toUpperCase();

//     presenceSheet.appendRow([
//       presenceId,
//       body.user_id,
//       body.device_id,
//       body.course_id,
//       body.session_id,
//       body.qr_token,
//       body.ts,
//       new Date().toISOString(),
//     ]);

//     return sendSuccess({ presence_id: presenceId, status: "checked_in" });
//   } catch (error) {
//     return sendError("database_error");
//   }
// }

function handleCheckIn(body) {
  if (!body.user_id || !body.device_id || !body.course_id || !body.session_id || !body.qr_token || !body.ts) {
    return sendError("missing_field");
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tokenSheet = ss.getSheetByName("tokens");
    const tokenData = tokenSheet.getDataRange().getValues();

    let isValidToken = false;
    let isExpired = false;
    let maxCapacity = 0; 

    // 1. Validasi Token
    for (let i = 1; i < tokenData.length; i++) {
      let row = tokenData[i];
      if (row[0] === body.qr_token && row[1] === body.course_id && row[2] === body.session_id) {
        isValidToken = true;
        maxCapacity = Number(row[5]); // Mengambil batas kelas dari kolom ke-6
        const expiresAt = new Date(row[4]);
        const scanTime = new Date(body.ts);
        if (scanTime > expiresAt) isExpired = true;
        break;
      }
    }

    if (!isValidToken) return sendError("token_invalid");
    if (isExpired) return sendError("token_expired");

    // 2. Cek Duplikasi Mahasiswa & Hitung Kapasitas di Sheet Presence
    const presenceSheet = ss.getSheetByName("presence");
    const presenceData = presenceSheet.getDataRange().getValues();
    let currentAttendees = 0;

    for (let j = 1; j < presenceData.length; j++) {
      let pRow = presenceData[j];
      
      // PERBAIKAN: Paksa semua menjadi String agar pencocokan tidak meleset
      let sheetCourse = String(pRow[3]);
      let sheetSession = String(pRow[4]);
      let sheetNim = String(pRow[1]);
      
      let inputCourse = String(body.course_id);
      let inputSession = String(body.session_id);
      let inputNim = String(body.user_id);

      // Cek apakah ini sesi kelas yang sama
      if (sheetCourse === inputCourse && sheetSession === inputSession) {
        // Jika NIM mahasiswa sudah ada di sesi ini, tolak
        if (sheetNim === inputNim) {
          return sendError("already_checked_in"); 
        }
        currentAttendees++; // Hitung jumlah mahasiswa yang sudah absen
      }
    }

    // 3. Blokir jika kuota kelas sudah penuh
    if (currentAttendees >= maxCapacity) {
      return sendError("session_limit_reached");
    }

    // 4. Jika lulus semua ujian, simpan presensi
    const presenceId = "PR-" + Utilities.getUuid().substring(0, 6).toUpperCase();
    presenceSheet.appendRow([
      presenceId, body.user_id, body.device_id, body.course_id,
      body.session_id, body.qr_token, body.ts, new Date().toISOString(),
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

// ==========================================
// MODUL 2: Accelerometer Telemetry
// ==========================================

function handlePostAccel(body) {
  // 1. Validasi input
  if (!body.device_id || !body.ts || !body.samples || !Array.isArray(body.samples)) {
    return sendError("missing_field_or_invalid_format");
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("accel");
    const recordedAt = new Date().toISOString();
    const rows = []; // Array kosong untuk menampung rombongan data

    // 2. Siapkan data untuk Batch Insert
    // Header: device_id | x | y | z | sample_ts | batch_ts | recorded_at
    for (let i = 0; i < body.samples.length; i++) {
      let sample = body.samples[i];
      rows.push([
        body.device_id,
        sample.x,
        sample.y,
        sample.z,
        sample.t,
        body.ts,
        recordedAt
      ]);
    }

    // 3. Eksekusi Batch Insert ke Spreadsheet (Lebih cepat dari appendRow)
    if (rows.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      const numRows = rows.length;
      const numCols = rows[0].length;
      
      sheet.getRange(startRow, 1, numRows, numCols).setValues(rows);
    }

    // 4. Kembalikan respons sukses sesuai API Contract
    return sendSuccess({ accepted: rows.length });
  } catch (error) {
    return sendError("database_error");
  }
}

function handleGetLatestAccel(params) {
  if (!params.device_id) return sendError("missing_device_id");

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("accel");
    const data = sheet.getDataRange().getValues();

    // Loop mundur dari baris paling bawah (data terbaru) ke atas
    for (let i = data.length - 1; i > 0; i--) {
      let row = data[i];
      if (row[0] === params.device_id) {
        return sendSuccess({
          t: row[4], // Mengambil dari kolom sample_ts
          x: row[1],
          y: row[2],
          z: row[3]
        });
      }
    }
    
    // Jika tidak ditemukan
    return sendError("data_not_found");
  } catch (error) {
    return sendError("database_error");
  }
}

// ==========================================
// MODUL 3: GPS Telemetry & Map
// ==========================================

function handlePostGPS(body) {
  // Validasi format minimal GPS
  if (!body.device_id || !body.ts || typeof body.lat === 'undefined' || typeof body.lng === 'undefined') {
    return sendError("missing_field");
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("gps");
    const accuracy = body.accuracy_m || 0; // Opsional
    
    // Susunan kolom: device_id | ts | lat | lng | accuracy_m
    sheet.appendRow([
      body.device_id,
      body.ts,
      body.lat,
      body.lng,
      accuracy
    ]);

    return sendSuccess({ accepted: true });
  } catch (error) {
    return sendError("database_error");
  }
}

function handleGetLatestGPS(params) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("gps");
    const data = sheet.getDataRange().getValues();
    const targetDevice = params.device_id;

    if (data.length <= 1) return sendError("data_not_found");

    // Skenario A: Jika mencari 1 device spesifik
    if (targetDevice) {
      for (let i = data.length - 1; i > 0; i--) {
        if (data[i][0] === targetDevice) {
          return sendSuccess({
            ts: data[i][1],
            lat: data[i][2],
            lng: data[i][3],
            accuracy_m: data[i][4]
          });
        }
      }
      return sendError("device_not_found");
    } 
    // Skenario B (Multiplayer): Jika device_id kosong, ambil titik terakhir SEMUA device
    else {
      let allLatest = {};
      for (let i = data.length - 1; i > 0; i--) {
        let dev = data[i][0];
        // Simpan hanya jika device tersebut belum ada di object (mengambil yang paling bawah/terbaru)
        if (!allLatest[dev]) {
          allLatest[dev] = {
            device_id: dev,
            ts: data[i][1],
            lat: data[i][2],
            lng: data[i][3],
            accuracy_m: data[i][4]
          };
        }
      }
      // Ubah dari object menjadi array of objects
      return sendSuccess(Object.keys(allLatest).map(key => allLatest[key]));
    }
  } catch (error) {
    return sendError("database_error");
  }
}

function handleGetHistoryGPS(params) {
  if (!params.device_id) return sendError("missing_device_id");
  let limit = parseInt(params.limit) || 100; // Default limit 100 titik

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("gps");
    const data = sheet.getDataRange().getValues();
    let historyItems = [];

    // Loop dari bawah ke atas agar mendapat data terbaru dulu
    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][0] === params.device_id) {
        // Masukkan ke depan (unshift) agar format history urut dari lama ke baru
        historyItems.unshift({
          ts: data[i][1],
          lat: data[i][2],
          lng: data[i][3]
        });
        if (historyItems.length >= limit) break;
      }
    }

    return sendSuccess({
      device_id: params.device_id,
      items: historyItems
    });
  } catch (error) {
    return sendError("database_error");
  }
}