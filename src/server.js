// src/server.js
const express = require('express');
const bodyParser = require('body-parser');
const sessionManager = require('./sessionManager');
require('./cronOutbox'); // aktifkan cron

const app = express();
app.use(bodyParser.json());

// init semua session di startup
sessionManager.initAllSessions()
  .then(() => console.log('Semua session di-load'))
  .catch(console.error);

// 1) Buat session baru (satu nomor WA baru)
app.post('/sessions', async (req, res) => {
  try {
    const { display_name } = req.body;
    if (!display_name) {
      return res.status(400).json({ error: 'display_name wajib' });
    }

    const session = await sessionManager.createSession(display_name);
    res.json({ success: true, session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2) List semua session
app.get('/sessions', async (req, res) => {
  try {
    const sessions = await sessionManager.listSessions();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2b) Hapus session
app.delete('/sessions/:id', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    if (!sessionId) {
      return res.status(400).json({ error: 'session_id tidak valid' });
    }

    await sessionManager.deleteSession(sessionId);
    res.json({ success: true, message: `Session ${sessionId} berhasil dihapus` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 3) Kirim pesan via DB (diproses cron)
app.post('/send', async (req, res) => {
  const db = require('./db');
  try {
    const { session_id, to, text, scheduled_at } = req.body;

    if (!session_id || !to || !text) {
      return res.status(400).json({ error: 'session_id, to, text wajib' });
    }

    await db.execute(`
  INSERT INTO wa_outbox
  (session_id, to_number, message_type, message_text, scheduled_at, max_retry)
  VALUES (?, ?, 'text', ?, COALESCE(?, NOW()), 3)
`, [session_id, to, text, scheduled_at || null]);


    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 4) Kirim langsung (tanpa lewat DB, langsung tembak Baileys)
app.post('/send-direct', async (req, res) => {
  try {
    const { session_id, to, text } = req.body;
    if (!session_id || !to || !text) {
      return res.status(400).json({ error: 'session_id, to, text wajib' });
    }

    const client = sessionManager.getClient(session_id);
    if (!client) {
      return res.status(400).json({ error: 'Session belum aktif / tidak ada' });
    }

    await client.sendText(to, text);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`HTTP API running on port ${PORT}`);
});
