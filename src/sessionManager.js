// src/sessionManager.js
const db = require('./db');
const { createBaileysForSession } = require('./baileysSession');

class SessionManager {
  constructor() {
    this.sessions = new Map(); // session_id -> { sendText, sock }
  }

  async initAllSessions() {
    const [rows] = await db.execute(
      `SELECT * FROM wa_sessions WHERE status IN ('PENDING_QR','CONNECTED','DISCONNECTED')`
    );

    for (const row of rows) {
      await this.startSession(row);
    }
  }

  async startSession(sessionRow) {
    const id = sessionRow.id;
    console.log(`Starting session ${sessionRow.session_key} (id=${id})`);

    const client = await createBaileysForSession(sessionRow, async (row) => {
      // callback kalau koneksi close tapi bukan logout
      await this.restartSession(row.id);
    });

    this.sessions.set(id, client);
  }

  async restartSession(sessionId) {
    const [rows] = await db.execute(`SELECT * FROM wa_sessions WHERE id=?`, [sessionId]);
    if (!rows.length) {
      console.log(`Session id=${sessionId} tidak ditemukan di database, membatalkan restart.`);
      this.sessions.delete(sessionId);
      return;
    }
    const row = rows[0];

    console.log(`Re-starting session ${row.session_key}...`);
    await this.startSession(row);
  }

  getClient(sessionId) {
    return this.sessions.get(sessionId);
  }

  async createSession(displayName) {
    const sessionKey = `session_${Date.now()}`;

    const [result] = await db.execute(
      `INSERT INTO wa_sessions (session_key, display_name, status)
       VALUES (?, ?, 'PENDING_QR')`,
      [sessionKey, displayName]
    );

    const id = result.insertId;
    const [rows] = await db.execute(`SELECT * FROM wa_sessions WHERE id=?`, [id]);
    const row = rows[0];

    await this.startSession(row);
    return row;
  }

  async listSessions() {
    const [rows] = await db.execute(`SELECT * FROM wa_sessions ORDER BY id DESC`);
    return rows;
  }

  async deleteSession(sessionId) {
    // Hapus dari memori
    const client = this.sessions.get(sessionId);
    if (client && client.sock) {
      try {
        await client.sock.logout();
      } catch (err) {
        console.log(`Error saat logout session ${sessionId}:`, err.message);
      }
    }
    this.sessions.delete(sessionId);

    // Hapus dari database
    await db.execute(`DELETE FROM wa_sessions WHERE id=?`, [sessionId]);
    console.log(`Session id=${sessionId} berhasil dihapus dari memori dan database.`);
  }
}

const sessionManager = new SessionManager();
module.exports = sessionManager;
