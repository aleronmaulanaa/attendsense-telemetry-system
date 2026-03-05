# 🎯 AttendSense: Sistem Presensi & Telemetri Terintegrasi

**AttendSense** adalah sistem presensi mahasiswa modern dan pemantauan telemetri berbasis web. Proyek ini dikembangkan untuk memecahkan masalah presensi konvensional (seperti "titip absen") dengan memanfaatkan teknologi **QR Code Dinamis**, pemantauan gerak perangkat (**Accelerometer**), dan pelacakan lokasi (**GPS**).

Proyek ini dibangun menggunakan arsitektur *Serverless* yang ringan, di mana antarmuka pengguna (Frontend) dibangun murni menggunakan HTML/JS/CSS, dan logika server (Backend) dijalankan menggunakan **Google Apps Script (GAS)** dengan **Google Sheets** sebagai basis datanya.

---

## 👥 Tim Pengembang

Proyek ini dikembangkan secara kolaboratif dengan pembagian peran kerja (Role) sebagai berikut:

* **Backend / API Server**
  * Aleron Maulana F.
* **Client / Frontend UI**
  * Safrizal Huda K.
  * Felicia Paramdayani A. P.
* **QA & Swap Testing**
  * Nur Azizah Fitria
* **Dokumentasi & Deploy**
  * Noga Salsabilla Alalfala

---

## 🏗️ Arsitektur & Teknologi Terapan

* **Frontend (Client):** HTML5, CSS3, Vanilla JavaScript.
* **Library Eksternal:** * `qrcodejs` (Untuk *generate* QR Code)
  * `html5-qrcode` (Untuk *scanner* kamera ponsel)
* **Backend (API):** Google Apps Script (REST API via `doGet` dan `doPost`).
* **Database:** Google Sheets (Terdiri dari sheet `tokens`, `presence`, `accel`, `gps`).
* **Deployment & Version Control:** GitHub, GitHub Pages.

---

## 📦 Pembagian Modul Proyek

Pengembangan sistem dibagi menjadi tiga tahapan/modul utama:

### ✅ Modul 1: Presensi QR Dinamis (Branch: `modul-1-qr`)
Sistem kehadiran anti-kecurangan di mana Dosen memancarkan QR Code di layar depan kelas, dan Mahasiswa melakukan pemindaian menggunakan *smartphone* masing-masing.
* **Fitur Utama:** Auto-Refresh QR setiap 25 detik, Pengaturan Kapasitas Kelas, Pencegahan *Double Check-in* (Anti-Titip Absen), dan *Live Data Board*.

### 🚧 Modul 2: Sensor Accelerometer (Branch: `modul-2-accel`)
Sistem pemantauan gerak atau aktivitas perangkat menggunakan sensor bawaan *smartphone*.
* **Status:** Dalam tahap pengembangan.
* **Target:** Menangkap data sumbu X, Y, Z dan mengirimkannya ke server secara *batch* untuk meminimalisir beban jaringan.

### 🚧 Modul 3: Pelacakan GPS & Peta (Branch: `modul-3-gps`)
Sistem pelacakan koordinat geografis mahasiswa secara *real-time*.
* **Status:** Menunggu pengembangan.
* **Target:** Mencatat koordinat Latitude & Longitude dan menampilkannya di atas antarmuka Peta Digital (Polyline & Marker).

---

## 🗂️ Struktur Repositori
Untuk menjaga kerapian, kode dibagi ke dalam struktur folder berikut:
```text
/
├── backend/            # Salinan kode Google Apps Script (Code.gs)
├── client/             # Halaman antarmuka pengguna (HTML/CSS/JS)
│   ├── dosen.html      # Portal Dosen (Dashboard & Generate QR)
│   └── (file lainnya)
├── docs/               # Berkas presentasi, API Contract, dan rancangan sistem
└── README.md           # Dokumentasi utama proyek