/**
 * WebhookController.js
 * Manage per-device webhook configuration.
 */

import { getWebhook, setWebhook, deleteWebhook } from '../services/WebhookService.js'
import { getDeviceBySessionId } from '../services/DeviceService.js'

/**
 * GET /webhook/:sessionId
 * Get webhook config for a device.
 */
export async function show(req, res) {
  try {
    const webhook = await getWebhook(req.params.sessionId)

    if (!webhook) {
      return res.status(404).json({ status: false, message: 'No webhook configured' })
    }

    return res.json({ status: true, data: webhook })
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message })
  }
}

/**
 * POST /webhook/:sessionId
 * Set or update webhook for a device.
 * Body: { url, secret?, events? }
 */
export async function upsert(req, res) {
  try {
    const { sessionId } = req.params
    const { url, secret, events } = req.body

    if (!url) {
      return res.status(400).json({ status: false, message: 'url is required' })
    }

    const device = await getDeviceBySessionId(sessionId)
    if (!device) {
      return res.status(404).json({ status: false, message: 'Device not found' })
    }

    await setWebhook(sessionId, url, secret || null, events || null)

    return res.json({ status: true, message: 'Webhook saved' })
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message })
  }
}

/**
 * DELETE /webhook/:sessionId
 * Disable webhook for a device.
 */
export async function destroy(req, res) {
  try {
    await deleteWebhook(req.params.sessionId)
    return res.json({ status: true, message: 'Webhook disabled' })
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message })
  }
}
