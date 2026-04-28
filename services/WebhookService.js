/**
 * WebhookService.js
 * Dispatches events to registered webhook URLs.
 */

import pool from '../database/db.js'

export async function getWebhook(sessionId) {
  const [rows] = await pool.query(
    'SELECT * FROM webhooks WHERE session_id = ? AND is_active = 1 LIMIT 1',
    [sessionId]
  )
  return rows[0] || null
}

export async function setWebhook(sessionId, url, secret = null, events = null) {
  await pool.query(
    `INSERT INTO webhooks (session_id, url, secret, events)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE url = VALUES(url), secret = VALUES(secret),
       events = VALUES(events), is_active = 1, updated_at = CURRENT_TIMESTAMP`,
    [sessionId, url, secret, events ? JSON.stringify(events) : null]
  )
}

export async function deleteWebhook(sessionId) {
  await pool.query(
    'UPDATE webhooks SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?',
    [sessionId]
  )
}

export async function dispatchWebhook(sessionId, event, payload) {
  const webhook = await getWebhook(sessionId)
  if (!webhook) return

  // Filter by subscribed events if configured
  if (webhook.events) {
    const allowed = typeof webhook.events === 'string'
      ? JSON.parse(webhook.events)
      : webhook.events
    if (Array.isArray(allowed) && !allowed.includes(event)) return
  }

  const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload })

  const headers = {
    'Content-Type': 'application/json',
    'X-WA-Event': event
  }

  if (webhook.secret) {
    headers['X-WA-Secret'] = webhook.secret
  }

  try {
    const res = await fetch(webhook.url, { method: 'POST', headers, body })
    if (!res.ok) {
      console.warn(`⚠️  Webhook [${sessionId}] ${event} → HTTP ${res.status}`)
    }
  } catch (err) {
    console.warn(`⚠️  Webhook [${sessionId}] ${event} failed: ${err.message}`)
  }
}
