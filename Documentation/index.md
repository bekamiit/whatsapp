# 📚 Dokumentasi Proyek WhatsApp Gateway

Selamat datang di dokumentasi lengkap proyek WhatsApp Gateway berbasis Node.js dan Baileys.

---

## 🎯 Tujuan Proyek

Membangun gateway WhatsApp yang dapat:
- Mengelola multiple session WhatsApp
- Mengirim dan menerima pesan otomatis
- Menyimpan riwayat pesan ke database
- Menyediakan REST API untuk integrasi
- Auto-restart session saat disconnect (kecuali logout)

---

## 📖 Daftar Dokumentasi

### Getting Started
- [[quick-start|Quick Start Guide]] - Cara menjalankan server dan membuat session

### Core Modules
- [[session-management|Session Management]] - Pengelolaan lifecycle session WhatsApp

### API Documentation
- Coming soon: API Reference
- Coming soon: Message Handling

### Database Schema
- Coming soon: Database Structure

### Deployment
- Coming soon: Installation Guide
- Coming soon: Production Setup

---

## 🏗️ Struktur Proyek

```
/home/webserver/node/whatsapp/
├── src/
│   ├── server.js           # HTTP API server
│   ├── sessionManager.js   # Session lifecycle manager
│   ├── baileysSession.js   # WhatsApp connection handler
│   ├── cronOutbox.js       # Scheduled message sender
│   └── db.js               # Database connection
├── sessions/               # Auth state storage
├── Documentation/          # Dokumentasi proyek
├── ChangeLog/             # Catatan perubahan
└── package.json           # Dependencies
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database
```sql
CREATE DATABASE whatsapp_gateway;
-- Import schema (lihat Database Documentation)
```

### 3. Jalankan Server
```bash
node src/server.js
```

### 4. Buat Session Baru
```bash
curl -X POST http://localhost:3001/sessions \
  -H "Content-Type: application/json" \
  -d '{"display_name": "My First Session"}'
```

### 5. Scan QR Code
Lihat terminal untuk QR code, scan dengan WhatsApp mobile.

---

## 📡 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/sessions` | Buat session baru |
| GET | `/sessions` | List semua session |
| DELETE | `/sessions/:id` | Hapus session |
| POST | `/send` | Kirim pesan via queue |
| POST | `/send-direct` | Kirim pesan langsung |

Detail lengkap: [[api-reference|API Reference]]

---

## 🔧 Tech Stack

- **Runtime:** Node.js
- **WhatsApp Library:** @whiskeysockets/baileys
- **Database:** MySQL
- **Web Framework:** Express.js
- **QR Code:** qrcode-terminal
- **Logger:** Pino

---

## 📝 Changelog

Lihat semua perubahan di [[../ChangeLog/index|ChangeLog Index]]

---

## 🤝 Kontribusi

Dokumentasi ini dibuat untuk memudahkan pengembangan kolaboratif antara manusia dan AI.

**Aturan Dokumentasi:**
- Gunakan Bahasa Indonesia
- Format Markdown untuk Obsidian
- Sertakan contoh kode
- Update changelog setiap perubahan

---

**Terakhir diupdate:** 24 Februari 2026
