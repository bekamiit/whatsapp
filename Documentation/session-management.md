# Dokumentasi Session Management

## 📖 Deskripsi

Modul Session Management mengelola siklus hidup session WhatsApp, termasuk pembuatan, inisialisasi, restart otomatis, dan penghapusan session.

---

## 🏗️ Arsitektur

### Komponen Utama

1. **SessionManager** (`src/sessionManager.js`)
   - Mengelola semua session dalam memori
   - Menyimpan mapping `session_id -> client`
   - Mengatur lifecycle session

2. **BaileysSession** (`src/baileysSession.js`)
   - Membuat koneksi WhatsApp menggunakan Baileys
   - Menangani event connection, messages, dan credentials
   - Menyimpan auth state ke folder sessions

3. **Database** (`wa_sessions` table)
   - Menyimpan metadata session
   - Status: PENDING_QR, CONNECTED, DISCONNECTED
   - Tracking error dan waktu update

---

## 🔄 Lifecycle Session

### 1. Pembuatan Session Baru

```javascript
POST /sessions
Body: { "display_name": "Customer Service 1" }
```

**Proses:**
1. Generate `session_key` unik (timestamp-based)
2. Insert ke database dengan status `PENDING_QR`
3. Buat folder auth di `./sessions/{session_key}`
4. Inisialisasi Baileys socket
5. Generate QR code di terminal
6. Tunggu scan dari WhatsApp mobile

### 2. Session Connected

**Trigger:** User scan QR code

**Proses:**
1. Event `connection.update` dengan `connection === 'open'`
2. Update database: `status = 'CONNECTED'`
3. Session siap menerima dan mengirim pesan
4. Auth credentials tersimpan otomatis

### 3. Session Disconnect (Bukan Logout)

**Trigger:** Internet loss, server restart, connection error

**Proses:**
1. Event `connection.update` dengan `connection === 'close'`
2. Cek `statusCode !== DisconnectReason.loggedOut`
3. Update database: `status = 'DISCONNECTED'`, `last_error = 'Reconnecting...'`
4. **Auto restart** via callback `onConnectionUpdate`
5. Re-inisialisasi socket dengan auth yang sama
6. Reconnect otomatis

### 4. Session Logout

**Trigger:** User logout dari WhatsApp mobile atau via API

**Proses:**
1. Event `connection.update` dengan `connection === 'close'`
2. Cek `statusCode === DisconnectReason.loggedOut`
3. Update database: `status = 'DISCONNECTED'`, `last_error = 'Logged out'`
4. **TIDAK restart** (behavior yang benar)
5. Session tetap di database dan memori (bisa di-delete manual)

### 5. Penghapusan Session

```javascript
DELETE /sessions/:id
```

**Proses:**
1. Ambil client dari memori
2. Panggil `sock.logout()` jika masih connected
3. Hapus dari `this.sessions` Map
4. Delete record dari database
5. Folder auth tetap ada (bisa dihapus manual jika perlu)

---

## 🛡️ Proteksi Anti-Loop

### Masalah yang Diperbaiki

Sebelumnya, session yang sudah logout dan dihapus dari database masih mencoba restart terus-menerus karena:
- Session masih ada di memori
- Callback restart tetap dipanggil
- Tidak ada validasi database sebelum restart

### Solusi Implementasi

**1. Validasi di `restartSession()`:**
```javascript
async restartSession(sessionId) {
  const [rows] = await db.execute(`SELECT * FROM wa_sessions WHERE id=?`, [sessionId]);
  if (!rows.length) {
    console.log(`Session id=${sessionId} tidak ditemukan di database, membatalkan restart.`);
    this.sessions.delete(sessionId);
    return; // STOP, tidak restart
  }
  // ... lanjut restart jika ada
}
```

**2. Conditional Callback di `baileysSession.js`:**
```javascript
if (loggedOut) {
  // Update DB saja, JANGAN panggil callback
  console.log(`[Session ${sessionKey}] Logout terdeteksi, tidak akan restart.`);
} else {
  // Panggil callback untuk restart
  if (typeof onConnectionUpdate === 'function') {
    onConnectionUpdate(sessionRow);
  }
}
```

---

## 📡 API Endpoints

### 1. Buat Session Baru
```bash
POST /sessions
Content-Type: application/json

{
  "display_name": "CS Team 1"
}
```

### 2. List Semua Session
```bash
GET /sessions
```

**Response:**
```json
[
  {
    "id": 1,
    "session_key": "session_1708754321000",
    "display_name": "CS Team 1",
    "status": "CONNECTED",
    "last_error": null,
    "created_at": "2026-02-24T10:00:00Z",
    "updated_at": "2026-02-24T10:05:00Z"
  }
]
```

### 3. Hapus Session
```bash
DELETE /sessions/1
```

**Response:**
```json
{
  "success": true,
  "message": "Session 1 berhasil dihapus"
}
```

---

## 🔍 Monitoring & Debugging

### Log Messages

**Session Starting:**
```
Starting session session_1708754321000 (id=1)
```

**QR Generated:**
```
QR untuk session session_1708754321000 muncul di terminal.
```

**Connected:**
```
[Session session_1708754321000] CONNECTED
```

**Disconnected (Auto Restart):**
```
[Session session_1708754321000] CLOSED. loggedOut=false
Re-starting session session_1708754321000...
```

**Logged Out (No Restart):**
```
[Session session_1708754321000] CLOSED. loggedOut=true
[Session session_1708754321000] Logout terdeteksi, tidak akan restart.
```

**Restart Cancelled:**
```
Session id=1 tidak ditemukan di database, membatalkan restart.
```

---

## 💡 Best Practices

### 1. Menghapus Session dengan Benar
❌ **JANGAN:**
```sql
DELETE FROM wa_sessions WHERE id=1;
```
Ini akan menyebabkan session tetap di memori dan mencoba restart.

✅ **LAKUKAN:**
```bash
curl -X DELETE http://localhost:3001/sessions/1
```
Ini akan membersihkan memori DAN database.

### 2. Handling Session Disconnect

- **Internet loss:** Session akan auto-restart ✅
- **Server restart:** Session akan di-load ulang dari `initAllSessions()` ✅
- **Logout:** Session TIDAK akan restart (expected) ✅

### 3. Cleanup Folder Auth

Folder `./sessions/{session_key}` tidak otomatis terhapus saat delete session. Untuk cleanup:

```bash
# Hapus folder auth session yang sudah dihapus
rm -rf ./sessions/session_1708754321000
```

---

## 🐛 Troubleshooting

### Session Terus Restart Setelah Logout

**Gejala:**
```
[Session BCTRX1] CLOSED. loggedOut=false
Re-starting session BCTRX1...
```

**Penyebab:** Session sudah dihapus dari database tapi masih di memori.

**Solusi:** Restart aplikasi atau gunakan endpoint DELETE yang proper.

### Session Tidak Auto-Restart Setelah Internet Loss

**Gejala:** Session disconnect dan tidak reconnect.

**Penyebab:** Mungkin terdeteksi sebagai logout.

**Solusi:** Cek log `loggedOut=true/false`. Jika true, memang tidak akan restart (expected).

### QR Code Tidak Muncul

**Gejala:** Session stuck di PENDING_QR.

**Penyebab:** Terminal tidak support QR rendering.

**Solusi:** Cek console log, QR tetap di-generate. Bisa enable `printQRInTerminal: true` di Baileys config.

---

## 🔗 Link Terkait

- [[index|Kembali ke Documentation Index]]
- [[../ChangeLog/2026-02-24_fix-session-restart-loop|Changelog: Fix Session Restart Loop]]

---

**Terakhir diupdate:** 24 Februari 2026
