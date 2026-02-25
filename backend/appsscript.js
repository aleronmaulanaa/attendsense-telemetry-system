// ==========================================
// 1. FUNGSI HELPER UNTUK FORMAT RESPONSE
// ==========================================
// Sesuai aturan PDF: 
// Sukses -> { "ok": true, "data": {} }
// Gagal  -> { "ok": false, "error": "pesan error singkat" }
function createResponse(isOk, dataOrError) {
  var response = {};
  if (isOk) {
    response = { "ok": true, "data": dataOrError };
  } else {
    response = { "ok": false, "error": dataOrError };
  }
  
  // Mengubah object menjadi teks JSON dan memberi tahu client bahwa ini adalah file JSON
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}


// ==========================================
// 2. ROUTER UNTUK REQUEST POST
// ==========================================
function doPost(e) {
  try {
    // Membaca path yang diakses client (misal: "presence/qr/generate")
    var path = e.pathInfo;
    
    // Membaca payload/body yang dikirim oleh client (dalam bentuk JSON)
    var body = JSON.parse(e.postData.contents);
    
    // Mengarahkan ke fungsi yang tepat sesuai path
    if (path === "presence/qr/generate") {
      return handleGenerateQR(body);
    } else if (path === "presence/checkin") {
      return handleCheckIn(body);
    } else {
      return createResponse(false, "endpoint_not_found");
    }
    
  } catch (error) {
    // Jika format JSON dari client salah, atau ada error server
    return createResponse(false, "bad_request");
  }
}


// ==========================================
// 3. ROUTER UNTUK REQUEST GET
// ==========================================
function doGet(e) {
  try {
    var path = e.pathInfo;
    
    // Untuk GET, data dikirim lewat parameter URL (misal: ?user_id=123)
    var params = e.parameter;
    
    if (path === "presence/status") {
      return handleCheckStatus(params);
    } else {
      return createResponse(false, "endpoint_not_found");
    }
    
  } catch (error) {
    return createResponse(false, "bad_request");
  }
}


// ==========================================
// 4. FUNGSI KERJA (PLACEHOLDER MODUL 1)
// ==========================================
// Kita buat wadahnya dulu, logika detailnya kita kerjakan di Tahap 3

// function handleGenerateQR(body) {
//   // TODO: Logika membuat QR Token akan ditulis di sini
//   return createResponse(true, { "message": "Fungsi Generate QR berhasil dipanggil!" });
// }

function handleGenerateQR(body) {
  // 1. Validasi Input Minimal
  // Memastikan dosen mengirimkan course_id, session_id, dan ts
  if (!body.course_id || !body.session_id || !body.ts) {
    return createResponse(false, "missing_field: course_id, session_id, atau ts");
  }

  // 2. Generate QR Token Acak
  // Membuat string acak (contoh hasil: TKN-8F2A19)
  var randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  var qrToken = "TKN-" + randomStr;

  // 3. Hitung Waktu Kedaluwarsa (expires_at)
  // Berdasarkan contoh di PDF, rentang waktunya adalah 2 menit dari 'ts' client
  var requestTime = new Date(body.ts);
  requestTime.setMinutes(requestTime.getMinutes() + 2); // Tambah 2 menit
  var expiresAt = requestTime.toISOString(); // Format wajib ISO-8601

  // 4. Simpan ke Google Sheets
  try {
    // Membuka file spreadsheet yang sedang aktif dan memilih sheet "tokens"
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("tokens");
    
    // Menyimpan data sebagai baris baru. 
    // Urutan ini HARUS SAMA dengan header yang kita buat di Tahap 1:
    // Kolom A: qr_token | Kolom B: course_id | Kolom C: session_id | Kolom D: expires_at
    sheet.appendRow([qrToken, body.course_id, body.session_id, expiresAt]);
    
  } catch (error) {
    // Menangkap error jika misalnya nama sheet salah atau ada kendala koneksi
    return createResponse(false, "database_error");
  }

  // 5. Kembalikan Response Sukses sesuai kontrak API
  var responseData = {
    "qr_token": qrToken,
    "expires_at": expiresAt
  };
  
  return createResponse(true, responseData);
}

// function handleCheckIn(body) {
//   // TODO: Logika validasi dan simpan presensi akan ditulis di sini
//   return createResponse(true, { "message": "Fungsi Check-in berhasil dipanggil!" });
// }

function handleCheckIn(body) {
  // 1. Validasi Input Minimal [cite: 128-133]
  if (!body.user_id || !body.device_id || !body.course_id || !body.session_id || !body.qr_token || !body.ts) {
    return createResponse(false, "missing_field: data_tidak_lengkap"); // [cite: 79]
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tokenSheet = ss.getSheetByName("tokens");
    var presenceSheet = ss.getSheetByName("presence");
    
    // 2. Baca Semua Data di Sheet "tokens"
    var tokenData = tokenSheet.getDataRange().getValues(); 
    // tokenData adalah array 2 dimensi. Baris index 0 adalah Header.
    
    var isValidToken = false;
    var isExpired = false;

    // 3. Cari Token yang Dikirim Client di Dalam Database
    // Kita mulai loop dari index 1 karena index 0 adalah baris judul kolom
    for (var i = 1; i < tokenData.length; i++) {
      var row = tokenData[i];
      // Urutan kolom: qr_token(0) | course_id(1) | session_id(2) | expires_at(3)
      
      // Jika token, kelas, dan sesinya cocok
      if (row[0] === body.qr_token && row[1] === body.course_id && row[2] === body.session_id) {
        isValidToken = true;
        
        // 4. Validasi Waktu (Apakah sudah expired?)
        var expiresAt = new Date(row[3]); // Waktu kedaluwarsa di database
        var scanTime = new Date(body.ts); // Waktu mahasiswa scan
        
        if (scanTime > expiresAt) {
          isExpired = true;
        }
        break; // Hentikan pencarian karena token sudah ditemukan
      }
    }

    // 5. Tangani Error Token [cite: 77-78]
    if (!isValidToken) {
      return createResponse(false, "token_invalid");
    }
    if (isExpired) {
      return createResponse(false, "token_expired");
    }

    // 6. Simpan Presensi Jika Semua Valid
    // Membuat ID Presensi acak
    var presenceId = "PR-" + Math.random().toString(36).substring(2, 6).toUpperCase();
    var status = "checked_in"; // [cite: 141]
    
    // Urutan kolom di sheet 'presence': 
    // presence_id | user_id | device_id | course_id | session_id | status | ts
    presenceSheet.appendRow([
      presenceId, 
      body.user_id, 
      body.device_id, 
      body.course_id, 
      body.session_id, 
      status, 
      body.ts
    ]);

    // 7. Kembalikan Response Sukses [cite: 137-142]
    var responseData = {
      "presence_id": presenceId,
      "status": status
    };
    
    return createResponse(true, responseData);

  } catch (error) {
    return createResponse(false, "database_error");
  }
}

// function handleCheckStatus(params) {
//   // TODO: Logika cek status presensi akan ditulis di sini
//   return createResponse(true, { "message": "Fungsi Cek Status berhasil dipanggil!" });
// }

function handleCheckStatus(params) {
  // 1. Validasi Parameter URL [cite: 145]
  // Mengecek apakah parameter user_id, course_id, dan session_id dikirimkan
  if (!params.user_id || !params.course_id || !params.session_id) {
    return createResponse(false, "missing_parameter: user_id, course_id, atau session_id");
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var presenceSheet = ss.getSheetByName("presence");
    var presenceData = presenceSheet.getDataRange().getValues();
    
    var statusData = null;

    // 2. Cari Data Presensi Mahasiswa
    // Kita melakukan loop dari bawah ke atas agar mendapatkan data presensi yang paling baru (jika ada duplikat)
    for (var i = presenceData.length - 1; i > 0; i--) {
      var row = presenceData[i];
      // Kolom: presence_id(0) | user_id(1) | device_id(2) | course_id(3) | session_id(4) | status(5) | ts(6)
      
      if (row[1] === params.user_id && row[3] === params.course_id && row[4] === params.session_id) {
        statusData = {
          "user_id": row[1],
          "course_id": row[3],
          "session_id": row[4],
          "status": row[5],
          "last_ts": row[6]
        };
        break; // Data ditemukan, hentikan pencarian
      }
    }

    // 3. Kembalikan Response [cite: 147-157]
    if (statusData !== null) {
      // Jika mahasiswa sudah check-in
      return createResponse(true, statusData);
    } else {
      // Jika mahasiswa belum ada di data presensi
      return createResponse(true, {
        "user_id": params.user_id,
        "course_id": params.course_id,
        "session_id": params.session_id,
        "status": "not_checked_in",
        "last_ts": null
      });
    }

  } catch (error) {
    return createResponse(false, "database_error");
  }
}