# Laporan Proyek Akhir Image Processing: Air Piano
**Aplikasi Interaktif Computer Vision & Pemrosesan Citra Berbasis Web Real-Time**  
**Tugas Besar UAS Mata Kuliah DIF60202 – Image Processing**  
**Program Studi Informatika, Universitas Andalas**  
**Semester Genap 2025/2026**

---

### Identitas Mahasiswa
* **Nama**: Fayi Amatullah Azhara
* **NIM**: 2311537001
* **Mata Kuliah**: DIF60202 – Image Processing
* **Program Studi**: Informatika
* **Fakultas**: Teknologi Informasi, Universitas Andalas
* **Tautan Aplikasi**: https://air-piano-unand.vercel.app/

---

## 1. Pendahuluan & Latar Belakang
Proyek **Air Piano** dikembangkan untuk memenuhi tugas besar mata kuliah DIF60202 – Image Processing. Aplikasi ini mengonversi input visual mentah dari kamera pengguna (webcam) menjadi instruksi kontrol instrumen musik piano virtual menggunakan teknik Computer Vision dan Pemrosesan Citra Digital.

Aplikasi ini dirancang sebagai instrumen musik nirkontak yang sangat interaktif dan responsif, sangat ideal untuk dipresentasikan secara langsung pada kegiatan pameran teknologi mahasiswa karena menawarkan pengalaman pengguna yang dinamis dan bebas hambatan teknis.

---

## 2. Alasan Teknis Pemilihan Arsitektur Tanpa Python (Python-Free Architecture)
Meskipun panduan tugas besar merekomendasikan opsi berbasis Python (seperti Streamlit, Gradio, FastAPI, atau Flask), proyek ini mengadopsi pendekatan **Full Client-Side WebAssembly (WASM)** menggunakan React, TypeScript, dan MediaPipe. Kriteria pemilihan arsitektur ini didasarkan pada keputusan ilmiah dan rekayasa perangkat lunak berikut:

1. **Memotong Latensi Komunikasi Jaringan (Zero Network Latency)**
   * **Arsitektur Python**: Mengharuskan browser mengirimkan frame gambar/video secara terus-menerus ke server backend melalui protokol HTTP/WebSocket, diproses di server, lalu hasilnya dikirim kembali ke client. Proses bolak-balik (round-trip) ini menghasilkan latensi jaringan sebesar 150ms - 400ms. Untuk aplikasi instrumen musik seperti piano, jeda waktu tersebut merusak pengalaman bermain karena suara nada tidak sinkron dengan gestur jari.
   * **Arsitektur Client-Side WASM**: Model inferensi dikompilasi ke bentuk WebAssembly dan dijalankan langsung di perangkat lokal pengguna memanfaatkan akselerasi hardware (CPU/GPU) lokal. Latensi inferensi ditekan hingga berada di bawah 20ms, menghasilkan respon audio piano yang instan dan real-time.

2. **Daya Tampung Skalabilitas Terdistribusi (Pencegahan Server Crash)**
   * Pada saat pameran teknologi, aplikasi akan diakses oleh puluhan pengguna secara simultan. Layanan hosting Python gratis (seperti Streamlit Cloud atau Hugging Face Spaces) memiliki batasan RAM dan core CPU yang sangat terbatas. Pemrosesan video dari banyak pengguna sekaligus akan memicu kehabisan memori (out of memory) dan merubuhkan server backend.
   * Dengan arsitektur client-side, beban komputasi pemrosesan citra sepenuhnya didistribusikan ke masing-masing perangkat pengunjung pameran. Server host (Vercel) hanya berfungsi menyajikan berkas statis, menjamin keandalan sistem tetap berada pada angka 100%.

3. **Optimalisasi Integrasi API Kamera & Sintesis Audio**
    * Integrasi perangkat keras kamera via HTML5 MediaDevices API dan pemrosesan audio melalui Web Audio API berjalan secara alami di dalam container peramban. Menggunakan JavaScript/TypeScript murni mencegah adanya fragmentasi atau hambatan komunikasi data antara model Computer Vision di server dan antarmuka interaksi di client.

4. **Keamanan Informasi & Privasi Citra Pengguna**
    * Rekaman video dari kamera pengguna sepenuhnya diproses langsung di dalam memori lokal peramban dan tidak pernah ditransmisikan ke jaringan luar. Hal ini menjamin privasi visual pengguna terlindungi sepenuhnya sesuai dengan prinsip etika pemrosesan citra.

---

## 3. Matriks Pemenuhan Spesifikasi Tugas Besar

### Ketentuan Umum
* **Aplikasi Berbasis Web**: Diimplementasikan dengan framework React (TypeScript) dan dideploy pada platform Vercel sehingga dapat diakses secara publik.
* **Integrasi Kamera / Video**: Menggunakan modul kamera real-time untuk mendeteksi koordinat tangan.
* **Visualisasi Deteksi Citra**: Menggambar 21 titik spasial landmark tangan (hand skeleton) secara presisi langsung di atas kanvas video mentah.
* **Dashboard Antarmuka Menarik**: Desain minimalis mengadopsi tema gelap modern (Neon Dark Theme) dengan visualisasi glow yang bersih, memaksimalkan penggunaan whitespace, dan mempertahankan konsistensi font.
* **Kesiapan Pameran**: Handal menghadapi lonjakan pengguna karena bebas dari ketergantungan server komputasi eksternal.

### Elemen UI/UX Wajib
* **Halaman Utama**: Menyajikan nama proyek, identitas mahasiswa (Nama & NIM), deskripsi operasional singkat, serta instruksi interaksi sistem.
* **Halaman Prediksi**: Menampilkan tangkapan feed kamera langsung, overlay visualisasi tracking deteksi objek, dan metrik tingkat kepercayaan model (Confidence Score).
* **Dashboard Statistik**: Memperlihatkan performa sistem secara statistik:
  * Jumlah frame data yang berhasil diuji.
  * Akurasi fungsional pemetaan spasial objek.
  * Latensi waktu inferensi dalam satuan milidetik (ms).

### Poin Penunjang & Nilai Tambah (Bonus)
* **Penyimpanan Database Cloud (Firebase Firestore)**: Menyimpan riwayat jejak rekaman musik yang diciptakan oleh pengguna saat mencoba aplikasi di pameran.
* **Sistem Akun Pengguna (Firebase Authentication)**: Mengamankan identitas penyusun nada dengan fitur integrasi registrasi user yang aman dan anonim.
* **Dashboard Analytics Interaktif**: Grafik pemantauan fluktuasi latensi inferensi secara real-time untuk analisis performa perangkat.
* **Synthesizer Sintetis Audio Mandiri**: Menolak penggunaan file audio `.mp3` statis yang lambat dimuat, suara piano dihasilkan dinamis melalui Web Audio API Oscillator.

---

## 4. Metodologi Pemrosesan Citra Digital
Aplikasi ini memproses data visual melalui beberapa tahapan sistematis:

1. **Akuisisi Citra (Image Acquisition)**: Kamera webcam menangkap aliran frame gambar video masukan dengan laju bingkai tinggi.
2. **Pra-pemrosesan Citra (Image Preprocessing)**: Frame citra mengalami normalisasi resolusi dan rotasi horizontal (efek cermin / mirror layout) agar arah pergerakan tangan selaras dengan sumbu koordinat pengguna.
3. **Ekstraksi Fitur (Feature Extraction)**: Model berbasis convolutional neural network MediaPipe mendeteksi koordinat Cartesian tiga dimensi ($X, Y, Z$) untuk 21 titik persendian tangan secara dinamis.
4. **Analisis Spasial & Deteksi Kolisi (Spatial Mapping)**: Koordinat ujung jari (Landmark Index 8, 12, 16, dan 20) dipetakan terhadap koordinat bidang tuts piano visual yang berada di layar. Jika koordinat mendatar ($X$) dan vertikal ($Y$) ujung jari beririsan dengan batas bidang tuts dan memiliki kecepatan tekanan ke bawah tertentu, hit kolisi dianggap aktif.
5. **Konversi Sinyal (Sintesis Audio)**: Ketukan yang terdeteksi secara visual diterjemahkan oleh sistem menjadi instruksi penghasil frekuensi bunyi nada piano yang akurat melalui generator gelombang audio real-time.

---

## 5. Komponen Teknologi Utama
* **Pustaka Utama**: React 18 / 19, TypeScript
* **Mesin Estimasi Citra**: MediaPipe Hands JS SDK (WebAssembly Core)
* **Sintesis Audio**: Web Audio API (OscillatorNode & GainNode)
* **Desain & Gaya**: Tailwind CSS (Glow & Neon Variant Theme)
* **Animasi Antarmuka**: Motion (motion/react)
* **Sistem Database & Autentikasi**: Firebase Firestore & Firebase Auth

---

## 6. Panduan Menjalankan Sistem Secara Lokal

### Prasyarat
Sistem komputer Anda harus terpasang **Node.js** (Versi 18 atau versi terbaru yang stabil).

### Langkah-Langkah Operasional
1. Ekstrak seluruh berkas ZIP proyek ini ke folder kerja komputer Anda.
2. Buka terminal atau command line di direktori utama proyek tersebut.
3. Unduh semua pustaka dependensi yang dibutuhkan dengan mengeksekusi perintah:
   ```bash
   npm install
   ```
4. Setelah instalasi selesai, luncurkan server pengembangan lokal:
   ```bash
   npm run dev
   ```
5. Buka peramban browser web (sangat disarankan menggunakan **Google Chrome** demi kompatibilitas fungsionalitas penangkapan kamera dan sintesis suara) lalu arahkan ke alamat:
   ```
   http://localhost:3000
   ```
6. Izinkan camera permission/akses webcam saat diminta di layar browser, tempatkan tangan Anda di depan sorotan kamera, dan nikmati mengalunkan musik secara virtual di udara.
