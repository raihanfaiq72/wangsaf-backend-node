
import { sendAndLog, getOutboundMessages, getIncomingMessages } from '../services/MessageService.js'
import { getSession, sendTextMessage } from '../services/WhatsAppService.js'


export async function send(req, res) {
  try {
    const { sessionId, number, message } = req.body

    if (!sessionId || !number || !message) {
      return res.status(400).json({
        status: false,
        message: 'sessionId, number, and message are required'
      })
    }

    // Check live in-memory status first — no DB round-trip needed
    const session = getSession(sessionId)
    if (!session) {
      return res.status(404).json({ status: false, message: 'Device not found or not started' })
    }

    if (session.status !== 'connected') {
      return res.status(422).json({
        status: false,
        message: `Device is not connected (current status: ${session.status})`
      })
    }

    await sendAndLog(sessionId, number, message, sendTextMessage)

    return res.json({ status: true, message: 'Message sent' })
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message })
  }
}

/**
 * GET /message/:sessionId/outbound
 * Get outbound message history for a session.
 */
export async function outbound(req, res) {
  try {
    const { sessionId } = req.params
    const limit = parseInt(req.query.limit) || 50
    const offset = parseInt(req.query.offset) || 0

    const messages = await getOutboundMessages(sessionId, limit, offset)

    return res.json({ status: true, data: messages, limit, offset })
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message })
  }
}

/**
 * GET /message/:sessionId/incoming
 * Get incoming message history for a session.
 */
export async function incoming(req, res) {
  try {
    const { sessionId } = req.params
    const limit = parseInt(req.query.limit) || 50
    const offset = parseInt(req.query.offset) || 0

    const messages = await getIncomingMessages(sessionId, limit, offset)

    return res.json({ status: true, data: messages, limit, offset })
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message })
  }
}
