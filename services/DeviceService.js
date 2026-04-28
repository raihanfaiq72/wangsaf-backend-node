
import pool from '../database/db.js'

export async function createDevice(sessionId) {
  await pool.query(
    `INSERT INTO devices (session_id, status)
     VALUES (?, 'connecting')
     ON DUPLICATE KEY UPDATE status = 'connecting', updated_at = CURRENT_TIMESTAMP`,
    [sessionId]
  )
}

export async function getDeviceBySessionId(sessionId) {
  const [rows] = await pool.query(
    'SELECT * FROM devices WHERE session_id = ? LIMIT 1',
    [sessionId]
  )
  return rows[0] || null
}

export async function getAllDevices() {
  const [rows] = await pool.query(
    'SELECT id, session_id, phone_number, status, webhook_url, created_at, updated_at FROM devices ORDER BY created_at DESC'
  )
  return rows
}

export async function getActiveDevices() {
  const [rows] = await pool.query(
    `SELECT * FROM devices WHERE status NOT IN ('logged_out')`,
  )
  return rows
}

export async function updateDeviceStatus(sessionId, status, qrCode = null, phoneNumber = null) {
  const fields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP']
  const values = [status]

  if (qrCode !== undefined) {
    fields.push('qr_code = ?')
    values.push(qrCode)
  }

  if (phoneNumber !== null) {
    fields.push('phone_number = ?')
    values.push(phoneNumber)
  }

  if (status === 'connected') {
    fields.push('qr_code = NULL')
  }

  values.push(sessionId)

  await pool.query(
    `UPDATE devices SET ${fields.join(', ')} WHERE session_id = ?`,
    values
  )
}

export async function updateDeviceQR(sessionId, qrCode) {
  await pool.query(
    'UPDATE devices SET qr_code = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?',
    [qrCode, 'scan_qr', sessionId]
  )
}

export async function deleteDevice(sessionId) {
  await pool.query('DELETE FROM devices WHERE session_id = ?', [sessionId])
}

export async function setDeviceWebhook(sessionId, url) {
  await pool.query(
    'UPDATE devices SET webhook_url = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?',
    [url, sessionId]
  )
}
