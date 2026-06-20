# Quick Start Guide

## 🚀 Menjalankan Server dan Membuat Session

### 1. Jalankan Server

**Cara 1: Di Terminal (Recommended untuk melihat QR Code)**
```bash
cd /home/webserver/node/whatsapp
node src/server.js
```

**Cara 2: Di Background**
```bash
cd /home/webserver/node/whatsapp
nohup node src/server.js > server.log 2>&1 &
```

### 2. Buat Session Baru

Di terminal baru, jalankan:
```bash
curl -X POST http://localhost:3001/sessions \
  -H "Content-Type: application/json" \
  -d '{"display_name": "CS Team 1"}'
```

**Response:**
```json
{
  "success": true,
  "session": {
    "id": 6,
    "session_key": "session_1771909587860",
    "display_name": "CS Team 1",
    "status": "PENDING_QR"
  }
}
```

### 3. Scan QR Code

QR Code akan muncul di terminal tempat server berjalan. Scan dengan WhatsApp mobile:
1. Buka WhatsApp di HP
2. Tap menu (3 titik) → **Perangkat Tertaut**
3. Tap **Tautkan Perangkat**
4. Scan QR Code yang muncul di terminal

### 4. Verifikasi Session Connected

```bash
curl http://localhost:3001/sessions
```

Cek status session berubah menjadi `CONNECTED`.

---

## 🛠️ Troubleshooting

### QR Code Tidak Muncul

**Penyebab:** Server berjalan di background atau output tidak terlihat.

**Solusi:**
1. Stop server yang berjalan:
   ```bash
   pkill -f "node.*whatsapp/src/server.js"
   ```

2. Jalankan server di foreground:
   ```bash
   node src/server.js
   ```

3. Buat session baru di terminal lain

### Session Terus Restart dalam Loop

**Gejala:**
```
[Session xxx] CLOSED. loggedOut=false
Re-starting session xxx...
```

**Penyebab:** Session tidak memiliki auth credentials yang valid.

**Solusi:**
1. Hapus session yang bermasalah:
   ```bash
   curl -X DELETE http://localhost:3001/sessions/[ID]
   ```

2. Atau hapus semua session dan mulai fresh:
   ```bash
   mysql -u root -p'M0n1tASW123' -e "DELETE FROM monitoring.wa_sessions;"
   rm -rf /home/webserver/node/whatsapp/sessions/*
   ```

3. Restart server dan buat session baru

### Session Tidak Auto-Restart Setelah Disconnect

**Penyebab:** Session terdeteksi sebagai logout.

**Behavior yang Benar:**
- Logout → Tidak restart ✅
- Disconnect (internet loss) → Auto restart ✅

---

## 📋 Perintah Berguna

### Cek Server Berjalan
```bash
ps aux | grep "node.*whatsapp/src/server.js"
```

### Stop Server
```bash
pkill -f "node.*whatsapp/src/server.js"
```

### List Semua Session
```bash
curl http://localhost:3001/sessions
```

### Hapus Session
```bash
curl -X DELETE http://localhost:3001/sessions/[ID]
```

### Kirim Pesan Test
```bash
curl -X POST http://localhost:3001/send-direct \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": 6,
    "to": "628123456789",
    "text": "Halo, ini pesan test"
  }'
```

---

## 🔗 Link Terkait

- [[index|Kembali ke Documentation Index]]
- [[session-management|Session Management Detail]]

---

**Terakhir diupdate:** 24 Februari 2026
