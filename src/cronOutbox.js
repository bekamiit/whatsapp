// src/cronOutbox.js
const cron = require('node-cron');
const db = require('./db');
const sessionManager = require('./sessionManager');

function getNextRetryTime(retryCount) {
  // retry 1 = 30 detik, 2 = 60 detik, 3 = 120 detik
  const delays = [30, 60, 120];
  const delay = delays[retryCount - 1] || 300; // default 5 menit
  return new Date(Date.now() + delay * 1000);
}

cron.schedule('*/10 * * * * *', async () => {
  try {
    /**
     * Ambil:
     * - PENDING yang waktunya sudah lewat
     * - RETRY yang waktunya sudah tiba
     */
    const [rows] = await db.execute(`
      SELECT *
      FROM wa_outbox
      WHERE
        (
          status = 'PENDING'
          AND scheduled_at <= NOW()
        )
        OR
        (
          status = 'RETRY'
          AND next_retry_at <= NOW()
        )
      ORDER BY id ASC
      LIMIT 50
    `);

    for (const row of rows) {
      const client = sessionManager.getClient(row.session_id);

      // Jika session belum aktif
      if (!client) {
        await markRetry(row, 'Session client not available');
        continue;
      }

      try {
        await client.sendText(row.to_number, row.message_text || '');

        // ✅ SUKSES
        await db.execute(`
          UPDATE wa_outbox
          SET status='SENT', sent_at=NOW(), last_error=NULL
          WHERE id=?
        `, [row.id]);

        /*
		await db.execute(`
          INSERT INTO wa_messages
          (session_id, from_number, to_number, direction, message_type, message_text)
          VALUES (?, 'ME', ?, 'OUT', 'text', ?)
        `, [row.session_id, row.to_number, row.message_text]);
		*/
		
      } catch (err) {
        // ❌ GAGAL → MASUK MEKANISME RETRY
        await markRetry(row, err.message);
      }
    }

  } catch (e) {
    console.error('Cron fatal error:', e.message);
  }
});

/**
 * Handle retry logic
 */
async function markRetry(row, errorMessage) {
  const nextRetryCount = row.retry_count + 1;

  // Kalau sudah melewati batas retry → GAGAL PERMANEN
  if (nextRetryCount >= row.max_retry) {
    await db.execute(`
      UPDATE wa_outbox
      SET
        status = 'FAILED',
        retry_count = ?,
        last_error = ?
      WHERE id = ?
    `, [nextRetryCount, errorMessage, row.id]);

    console.error(`OUTBOX ${row.id} permanently FAILED`);
    return;
  }

  const nextRetryAt = getNextRetryTime(nextRetryCount);

  await db.execute(`
    UPDATE wa_outbox
    SET
      status = 'RETRY',
      retry_count = ?,
      last_error = ?,
      next_retry_at = ?
    WHERE id = ?
  `, [nextRetryCount, errorMessage, nextRetryAt, row.id]);

  console.warn(`OUTBOX ${row.id} scheduled RETRY ${nextRetryCount}`);
}
