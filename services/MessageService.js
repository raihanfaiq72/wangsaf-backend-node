/**
 * MessageService.js
 * Handles outbound & inbound message logging.
 * Supports all message types: text, poll, image, etc.
 */

import pool from '../database/db.js'

// ── Outbound ─────────────────────────────────────────────────────────────────

/**
 * Log an outbound message to DB.
 * @param {string} sessionId
 * @param {string} recipient
 * @param {string} type       - 'text' | 'poll' | 'image' | 'video' | 'audio' | 'document' | etc.
 * @param {string|null} message  - human-readable summary (e.g. text content, poll question)
 * @param {object|null} payload  - full structured payload (stored as JSON)
 * @param {string} status
 */
export async function logOutboundMessage(sessionId, recipient, type, message, payload = null, status = 'pending') {
  const [result] = await pool.query(
    `INSERT INTO messages (session_id, recipient, type, message, payload, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, recipient, type, message, payload ? JSON.stringify(payload) : null, status]
  )
  return result.insertId
}

export async function updateMessageStatus(id, status, error = null) {
  await pool.query(
    'UPDATE messages SET status = ?, error = ?, sent_at = IF(? = "sent", NOW(), NULL) WHERE id = ?',
    [status, error, status, id]
  )
}

/**
 * Generic send-and-log wrapper.
 * sendFn is fire-and-forget — we log optimistically as 'sent'.
 * Synchronous errors (session not found, not connected) are caught and logged as 'failed'.
 *
 * @param {string}        sessionId
 * @param {string}        recipient
 * @param {string}        type       - message type key
 * @param {string|null}   summary    - short human-readable label for the message column
 * @param {object|null}   payload    - full payload stored as JSON
 * @param {Function}      sendFn     - () => void  (already fire-and-forget in WhatsAppService)
 */
export async function sendAndLog(sessionId, recipient, type, summary, payload, sendFn) {
  const msgId = await logOutboundMessage(sessionId, recipient, type, summary, payload, 'pending')
  try {
    sendFn()  // intentionally not awaited — fire-and-forget
    await updateMessageStatus(msgId, 'sent')
  } catch (err) {
    await updateMessageStatus(msgId, 'failed', err.message)
    throw err
  }
}

export async function getOutboundMessages(sessionId, limit = 50, offset = 0) {
  const [rows] = await pool.query(
    `SELECT id, recipient, type, message, payload, status, error, sent_at, created_at
     FROM messages
     WHERE session_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [sessionId, limit, offset]
  )
  return rows
}

// ── Inbound ──────────────────────────────────────────────────────────────────

export async function saveIncomingMessage(sessionId, sender, message, raw = null) {
  await pool.query(
    `INSERT INTO incoming_messages (session_id, sender, message, raw)
     VALUES (?, ?, ?, ?)`,
    [sessionId, sender, message, raw ? JSON.stringify(raw) : null]
  )
}

export async function getIncomingMessages(sessionId, limit = 50, offset = 0) {
  const [rows] = await pool.query(
    `SELECT id, sender, message, received_at
     FROM incoming_messages
     WHERE session_id = ?
     ORDER BY received_at DESC
     LIMIT ? OFFSET ?`,
    [sessionId, limit, offset]
  )
  return rows
}
