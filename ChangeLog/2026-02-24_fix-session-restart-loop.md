# Changelog - 24 Februari 2026

## Perbaikan Loop Restart Session Setelah Logout

### Perubahan

**File yang dimodifikasi:**
1. `src/sessionManager.js`
2. `src/baileysSession.js`
3. `src/server.js`

### Deskripsi Singkat Perubahan

Memperbaiki bug dimana session yang sudah dihapus dari database dan sudah logout masih terus mencoba restart secara otomatis, menyebabkan loop pesan "Re-starting session..." di console.

### Detail Perubahan

#### 1. `src/sessionManager.js`

**Penambahan validasi di `restartSession()`:**
- Menambahkan pengecekan apakah session masih ada di database sebelum restart
- Jika session tidak ditemukan, hapus dari memori dan batalkan restart
- Mencegah loop restart untuk session yang sudah dihapus

**Penambahan method `deleteSession()`:**
- Method baru untuk menghapus session secara proper
- Melakukan logout dari WhatsApp terlebih dahulu
- Menghapus session dari memori (`this.sessions`)
- Menghapus data session dari database
- Memberikan log konfirmasi penghapusan

#### 2. `src/baileysSession.js`

**Perbaikan logika event `connection.update`:**
- Menambahkan log eksplisit ketika logout terdeteksi
- Memastikan callback `onConnectionUpdate` TIDAK dipanggil saat logout
- Callback restart hanya dipanggil untuk disconnection yang bukan logout
- Mengubah error message menjadi lebih deskriptif ("Logged out")

#### 3. `src/server.js`

**Penambahan endpoint DELETE `/sessions/:id`:**
- Endpoint baru untuk menghapus session via API
- Validasi session_id
- Memanggil `sessionManager.deleteSession()`
- Mengembalikan response sukses dengan pesan konfirmasi

### Alasan Perubahan

**Masalah yang terjadi:**
- Session yang sudah logout dan dihapus dari database masih tersimpan di memori
- Callback `onConnectionUpdate` tetap dipanggil bahkan saat logout
- Menyebabkan loop restart yang tidak perlu
- Session mencoba restart meskipun sudah tidak ada di database

**Solusi yang diterapkan:**
- Memisahkan logika antara logout dan disconnection biasa
- Menambahkan validasi database sebelum restart
- Menyediakan method proper untuk menghapus session
- Membersihkan session dari memori saat tidak diperlukan

### Dampak Terhadap Modul Lain

**Positif:**
- Mengurangi beban CPU dari loop restart yang tidak perlu
- Mengurangi spam log di console
- Membersihkan memori dari session yang sudah tidak aktif
- API lebih lengkap dengan endpoint delete

**Perhatian:**
- Pastikan menggunakan endpoint DELETE `/sessions/:id` untuk menghapus session
- Jangan hanya menghapus dari database tanpa membersihkan memori
- Session yang logout tidak akan auto-restart (sesuai expected behavior)

### Cara Penggunaan

**Menghapus session dengan benar:**
```bash
# Via API
curl -X DELETE http://localhost:3001/sessions/1

# Response:
{
  "success": true,
  "message": "Session 1 berhasil dihapus"
}
```

**Behavior yang diharapkan:**
1. Session logout → Status DISCONNECTED, tidak restart
2. Session disconnect (bukan logout) → Auto restart
3. Session dihapus → Bersih dari memori dan database
4. Restart session yang tidak ada di DB → Dibatalkan dan dihapus dari memori

### Testing

**Skenario yang perlu ditest:**
1. ✅ Logout session → Tidak restart
2. ✅ Disconnect (internet loss) → Auto restart
3. ✅ Delete session via API → Bersih total
4. ✅ Restart session yang sudah dihapus → Dibatalkan

---

**Catatan:** Perubahan ini menyelesaikan issue loop restart session yang sudah logout dan dihapus dari database.
