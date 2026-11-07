# gilangranggaid · TikTok Downloader

Web untuk menyimpan video TikTok dari sebuah link: versi tanpa watermark, HD, versi asli, audio, cover, dan slide foto. Tombol unduhnya melewati endpoint proxy sendiri, jadi file benar-benar tersimpan di perangkat (bukan hanya membuka tab video).

## Cara jalan lokal

```bash
npm install
npm run dev
# buka http://localhost:3000
```

Build produksi:

```bash
npm run build
npm start
```

## Struktur

```
app/
  layout.tsx            metadata + shell
  page.tsx              UI downloader (client component)
  globals.css           styling
  api/resolve/route.ts  POST { url } -> detail video + daftar file
  api/download/route.ts GET ?url=&name= -> stream file sebagai attachment
lib/
  tiktok.ts             ekstraksi link, short link, pemetaan data
  types.ts              tipe bersama
```

## Cara kerja

1. `POST /api/resolve` menerima link TikTok, menormalkannya (termasuk link pendek `vm.tiktok.com`), lalu meminta detail video.
2. Endpoint mengembalikan deskripsi, penulis, statistik, dan daftar tautan file (CDN TikTok).
3. Tombol unduh memanggil `GET /api/download?url=<cdn>&name=<file>`; server mengambil file itu dan mengirimnya dengan header `Content-Disposition: attachment`, sehingga browser menyimpan filenya.

Hanya host CDN TikTok/ByteDance yang diizinkan lewat proxy, jadi endpoint tidak bisa dipakai untuk mengambil URL sembarang.

## Catatan

- Butuh koneksi keluar dari server ke API pihak ketiga (`tikwm.com`) dan ke CDN TikTok.
- Video privat, akun privat, atau region yang diblokir akan gagal diambil.
- Hanya pakai untuk konten yang kamu berhak simpan.
