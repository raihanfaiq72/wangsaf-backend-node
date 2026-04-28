/**
 * DeviceController.js
 * Handles device (session) lifecycle: create, status, QR, list, delete.
 */

import {
  startSession,
  stopSession,
  getSession,
  getAllSessions
} from '../services/WhatsAppService.js'

import {
  createDevice,
  getDeviceBySessionId,
  getAllDevices,
  deleteDevice
} from '../services/DeviceService.js'

/**
 * POST /device
 * Create and start a new WhatsApp session.
 */
export async function create(req, res) {
  try {
    const { sessionId } = req.body

    if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return res.status(400).json({
        status: false,
        message: 'sessionId is required and must be alphanumeric (a-z, 0-9, _, -)'
      })
    }

    await createDevice(sessionId)
    await startSession(sessionId)

    return res.json({
      status: true,
      message: 'Session created, waiting for QR scan',
      sessionId
    })
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message })
  }
}

/**
 * GET /device
 * List all registered devices.
 */
export async function list(req, res) {
  try {
    const devices = await getAllDevices()
    const inMemory = getAllSessions()

    // Merge live status from memory
    const merged = devices.map(d => {
      const live = inMemory.find(s => s.sessionId === d.session_id)
      return {
        ...d,
        live_status: live?.status || 'offline'
      }
    })

    return res.json({ status: true, data: merged })
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message })
  }
}

/**
 * GET /device/:id
 * Get a single device detail.
 */
export async function show(req, res) {
  try {
    const device = await getDeviceBySessionId(req.params.id)

    if (!device) {
      return res.status(404).json({ status: false, message: 'Device not found' })
    }

    const session = getSession(req.params.id)

    return res.json({
      status: true,
      data: {
        ...device,
        qr_code: undefined, // don't expose in show, use /qr endpoint
        live_status: session?.status || 'offline'
      }
    })
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message })
  }
}

/**
 * GET /device/:id/qr
 * Get current QR code for a session.
 */
export async function qr(req, res) {
  try {
    const device = await getDeviceBySessionId(req.params.id)

    if (!device) {
      return res.status(404).json({ status: false, message: 'Device not found' })
    }

    if (device.status === 'connected') {
      return res.json({ status: true, message: 'Already connected', device_status: 'connected' })
    }

    if (!device.qr_code) {
      return res.json({
        status: false,
        message: 'QR not available yet, try again in a moment',
        device_status: device.status
      })
    }

    return res.json({
      status: true,
      sessionId: device.session_id,
      qr: device.qr_code,
      device_status: device.status
    })
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message })
  }
}

/**
 * GET /device/:id/status
 * Get connection status.
 */
export async function status(req, res) {
  try {
    const device = await getDeviceBySessionId(req.params.id)

    if (!device) {
      return res.status(404).json({ status: false, message: 'Device not found' })
    }

    const session = getSession(req.params.id)

    return res.json({
      status: true,
      sessionId: device.session_id,
      phone_number: device.phone_number,
      device_status: device.status,
      live_status: session?.status || 'offline'
    })
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message })
  }
}

/**
 * POST /device/:id/restart
 * Restart a session.
 */
export async function restart(req, res) {
  try {
    const device = await getDeviceBySessionId(req.params.id)

    if (!device) {
      return res.status(404).json({ status: false, message: 'Device not found' })
    }

    await startSession(req.params.id)

    return res.json({ status: true, message: 'Session restarted' })
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message })
  }
}

/**
 * DELETE /device/:id
 * Logout and remove a device.
 */
export async function destroy(req, res) {
  try {
    const device = await getDeviceBySessionId(req.params.id)

    if (!device) {
      return res.status(404).json({ status: false, message: 'Device not found' })
    }

    try {
      await stopSession(req.params.id)
    } catch {
      // Session may already be disconnected, continue
    }

    await deleteDevice(req.params.id)

    return res.json({ status: true, message: 'Device removed' })
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message })
  }
}
