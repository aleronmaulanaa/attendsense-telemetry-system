# Modul 1: Sistem Presensi QR Dinamis (AttendSense)

Repositori ini berisi implementasi **Modul 1** dari sistem AttendSense, yang mencakup Backend menggunakan Google Apps Script (GAS) dan Frontend menggunakan HTML/JS murni. Sistem ini mendukung *Auto-Refresh* QR Code setiap 25 detik, pencegahan presensi ganda (Anti-Titip Absen), serta pembatasan kapasitas kelas.

## 👥 Tim Project

*Backend / API* - Aleron Maulana F.

*Client* - Safrizal Huda K.  
- Felicia Paramdayani A. P.

*QA & Swap Testing* - Nur Azizah Fitria

*Dokumentasi & Deploy* - Noga Salsabilla Alalfala

---

## 🚀 Cara Menjalankan (How to Run)

### 1. Backend (Google Apps Script)
1. Buka [Google Apps Script](https://script.google.com/).
2. Buat proyek baru dan *paste* seluruh kode dari `backend/Code.gs`.
3. Pastikan Anda memiliki *spreadsheet* aktif yang terhubung dengan 4 *sheet*: `tokens`, `presence`, `accel`, `gps`.
4. Klik **Terapkan (Deploy) > Penerapan Baru (New Deployment)**.
5. Pilih jenis **Aplikasi Web**.
6. Set "Jalankan sebagai" ke akun Anda, dan "Yang memiliki akses" ke **Siapa saja (Anyone)**.
7. Salin URL Web App yang berakhiran `/exec`.

### 2. Frontend (Client HTML)
1. Buka file `client/dosen.html` di kode editor (VS Code).
2. Ganti nilai variabel `BASE_URL` di dalam tag `<script>` dengan URL Web App dari langkah sebelumnya.
3. Jalankan file `dosen.html` menggunakan ekstensi **Live Server** di VS Code, atau akses melalui **GitHub Pages** jika sudah di-*hosting*.

---

## 📄 API Contract Simple v1

Dokumen ini menjelaskan cara berkomunikasi dengan Backend API AttendSense.

**Base URL:**
`https://script.google.com/macros/s/AKfycbwpXGxBBT8gE11OSskATkK2INTdk06XSULJ5g4LwV_UOfTPI88q5WKXyji3dbMbDM-0/exec`

*(Catatan: URL selalu menggunakan metode `?path=` untuk routing internal).*

### 1. Generate QR Token
Membuat token presensi unik dengan TTL 25 detik dan mengatur batas maksimal absensi per sesi kelas.

* **URL:** `?path=presence/qr/generate`
* **Method:** `POST`
* **Headers:** `Content-Type: text/plain;charset=utf-8` (Untuk bypass CORS)
* **Request Body:**
  ```json
  {
    "course_id": "cloud-101",
    "session_id": "sesi-02",
    "max_capacity": 40,
    "ts": "2026-03-05T10:00:00Z"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "ok": true,
    "data": {
      "qr_token": "TKN-A1B2C3",
      "expires_at": "2026-03-05T10:00:30Z"
    }
  }
  ```

### 2. Check-In Mahasiswa
Memproses presensi mahasiswa dari hasil *scan* QR Code. Dilengkapi dengan validasi kedaluwarsa, duplikasi (NIM sama), dan kapasitas kelas.

* **URL:** `?path=presence/checkin`
* **Method:** `POST`
* **Headers:** `Content-Type: text/plain;charset=utf-8`
* **Request Body:**
  ```json
  {
    "user_id": "111",
    "device_id": "DEV-XYZ123",
    "course_id": "cloud-101",
    "session_id": "sesi-02",
    "qr_token": "TKN-A1B2C3",
    "ts": "2026-03-05T10:00:15Z"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "ok": true,
    "data": {
      "presence_id": "PR-D4E5F6",
      "status": "checked_in"
    }
  }
  ```
* **Error Responses (Contoh):**
  * `{ "ok": false, "error": "token_expired" }`
  * `{ "ok": false, "error": "already_checked_in" }`
  * `{ "ok": false, "error": "session_limit_reached" }`

### 3. List Kehadiran
Mengambil data kehadiran *real-time* untuk sebuah sesi kelas tertentu.

* **URL:** `?path=presence/list&course_id={courseId}&session_id={sessionId}`
* **Method:** `GET`
* **Success Response (200 OK):**
  ```json
  {
    "ok": true,
    "data": [
      {
        "user_id": "111",
        "time": "2026-03-05T10:00:15.000Z"
      },
      {
        "user_id": "222",
        "time": "2026-03-05T10:00:18.000Z"
      }
    ]
  }
  ```

### 4. Cek Status Personal
Mengecek apakah mahasiswa tertentu sudah melakukan presensi di kelas tertentu.

* **URL:** `?path=presence/status&user_id={userId}&course_id={courseId}&session_id={sessionId}`
* **Method:** `GET`
* **Success Response (Jika sudah absen):**
  ```json
  {
    "ok": true,
    "data": {
      "user_id": "111",
      "course_id": "cloud-101",
      "session_id": "sesi-02",
      "status": "checked_in",
      "last_ts": "2026-03-05T10:00:15.000Z"
    }
  }
  ```