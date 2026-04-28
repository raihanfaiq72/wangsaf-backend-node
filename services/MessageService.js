/**
 * MessageService.js
 * Handles outbound & inbound message logging.
 */

import pool from '../database/db.js'

export async function logOutboundMessage(sessionId, recipient, message, status = 'pending') {
  const [result] = await pool.query(
    `INSERT INTO messages (session_id, recipient, message, status)
     VALUES (?, ?, ?, ?)`,
    [sessionId, recipient, message, status]
  )
  return result.insertId
}

export async function updateMessageStatus(id, status, error = null) {
  await pool.query(
    'UPDATE messages SET status = ?, error = ?, sent_at = IF(? = "sent", NOW(), NULL) WHERE id = ?',
    [status, error, status, id]
  )
}

export async function saveIncomingMessage(sessionId, sender, message, raw = null) {
  await pool.query(
    `INSERT INTO incoming_messages (session_id, sender, message, raw)
     VALUES (?, ?, ?, ?)`,
    [sessionId, sender, message, raw ? JSON.stringify(raw) : null]
  )
}

export async function getOutboundMessages(sessionId, limit = 50, offset = 0) {
  const [rows] = await pool.query(
    `SELECT id, recipient, message, status, error, sent_at, created_at
     FROM messages
     WHERE session_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [sessionId, limit, offset]
  )
  return rows
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

/**
 * Send a message and log it to DB.
 * sendFn is fire-and-forget — we log optimistically as 'sent'.
 * If sendFn throws synchronously (session not found, not connected), we catch it.
 */
export async function sendAndLog(sessionId, recipient, message, sendFn) {
  const msgId = await logOutboundMessage(sessionId, recipient, message, 'pending')
  try {
    sendFn(sessionId, recipient, message)  // intentionally not awaited
    await updateMessageStatus(msgId, 'sent')
  } catch (err) {
    await updateMessageStatus(msgId, 'failed', err.message)
    throw err
  }
}
