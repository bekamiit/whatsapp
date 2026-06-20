// src/baileysSession.js
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const P = require('pino');
const db = require('./db');
const path = require('path');
const qrcode = require('qrcode-terminal');

async function createBaileysForSession(sessionRow, onConnectionUpdate) {
  const sessionKey = sessionRow.session_key;
  const authFolder = path.join('./sessions', sessionKey);

  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  
  console.log(`[Session ${sessionKey}] Menggunakan WA v${version.join('.')}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    version,
    logger: P({ level: 'silent' }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' }))
    },
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    defaultQueryTimeoutMs: undefined,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    emitOwnEvents: true,
    markOnlineOnConnect: true
  });

  // update creds
  sock.ev.on('creds.update', saveCreds);

  // pesan masuk
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const isFromMe = msg.key.fromMe;
    const to = isFromMe ? from : 'ME';

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message?.ephemeralMessage?.message?.conversation ||
      '';

	if (to == 'ME'){
		await db.execute(`
		  INSERT INTO wa_messages
		  (session_id, from_number, to_number, direction, message_type, message_text, raw_payload)
		  VALUES (?, ?, ?, ?, ?, ?, ?)
		`, [
		  sessionRow.id,
		  from,
		  to,
		  isFromMe ? 'OUT' : 'IN',
		  'text',   // bisa diperluas, cek tipe lain: imageMessage, buttonsMessage, dsb
		  text,
		  JSON.stringify(msg)
		]);
		
		/*
		const pesan = 'Terima Kasih Telah Mengirim Pesan Kepada Kami, Pesan Anda Akan segera kami Proses';
		await db.execute(`
		  INSERT INTO wa_outbox
		  (session_id, to_number, message_type, message_text, scheduled_at, max_retry)
		  VALUES (?, ?, 'text', ?, NOW(), 3)
		`, [sessionRow.id, from, pesan]); 
		*/
	}
	
    console.log(`[Session ${sessionKey}] Pesan ${isFromMe ? 'OUT' : 'IN'}:`, from, text);
  });

  // status koneksi
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr, isNewLogin } = update;

    if (qr) {
      console.log(`\n[Session ${sessionKey}] QR Code muncul - Silakan scan dengan WhatsApp:`);
      await db.execute(
        `UPDATE wa_sessions SET status='PENDING_QR' WHERE id=?`,
        [sessionRow.id]
      );
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'connecting') {
      console.log(`[Session ${sessionKey}] Sedang menghubungkan...`);
    }

    if (connection === 'open') {
      console.log(`[Session ${sessionKey}] CONNECTED ${isNewLogin ? '(Login Baru)' : ''}`);
      await db.execute(
        `UPDATE wa_sessions SET status='CONNECTED', last_error=NULL WHERE id=?`,
        [sessionRow.id]
      );
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const errorMsg = lastDisconnect?.error?.message || 'Unknown error';
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      const restartRequired = statusCode === DisconnectReason.restartRequired;
      const timedOut = statusCode === DisconnectReason.timedOut;

      console.log(`[Session ${sessionKey}] CLOSED. Status: ${statusCode}, Error: ${errorMsg}`);
      console.log(`[Session ${sessionKey}] loggedOut=${loggedOut}, restartRequired=${restartRequired}, timedOut=${timedOut}`);

      if (loggedOut) {
        await db.execute(
          `UPDATE wa_sessions SET status='DISCONNECTED', last_error=? WHERE id=?`,
          [JSON.stringify({ message: 'Logged out', code: statusCode }), sessionRow.id]
        );
        console.log(`[Session ${sessionKey}] Logout terdeteksi, tidak akan restart.`);
      } else if (restartRequired || timedOut) {
        await db.execute(
          `UPDATE wa_sessions SET status='DISCONNECTED', last_error=? WHERE id=?`,
          [JSON.stringify({ message: 'Reconnecting...', code: statusCode }), sessionRow.id]
        );
        console.log(`[Session ${sessionKey}] Akan restart dalam 5 detik...`);
        setTimeout(() => {
          if (typeof onConnectionUpdate === 'function') {
            onConnectionUpdate(sessionRow);
          }
        }, 5000);
      } else {
        await db.execute(
          `UPDATE wa_sessions SET status='DISCONNECTED', last_error=? WHERE id=?`,
          [JSON.stringify({ message: errorMsg, code: statusCode }), sessionRow.id]
        );
        console.log(`[Session ${sessionKey}] Error tidak dikenal, akan restart dalam 10 detik...`);
        setTimeout(() => {
          if (typeof onConnectionUpdate === 'function') {
            onConnectionUpdate(sessionRow);
          }
        }, 10000);
      }
    }
  });

  async function sendText(toNumber, text) {
    // untuk JID normal
    const jid = toNumber.includes('@') ? toNumber : `${toNumber}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text });
  }

  return {
    sock,
    sendText
  };
}

module.exports = {
  createBaileysForSession
};
