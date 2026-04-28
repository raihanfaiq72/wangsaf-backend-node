/**
 * MessageController.js
 * Handles sending messages and retrieving message history.
 */

import { sendAndLog, getOutboundMessages, getIncomingMessages } from '../services/MessageService.js'
import { getSession, sendTextMessage, sendPollMessage } from '../services/WhatsAppService.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getConnectedSession(sessionId, res) {
  const session = getSession(sessionId)
  if (!session) {
    res.status(404).json({ status: false, message: 'Device not found or not started' })
    return null
  }
  if (session.status !== 'connected') {
    res.status(422).json({
      status: false,
      message: `Device is not connected (current status: ${session.status})`
    })
    return null
  }
  return session
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /message/send
 * Send a text message.
 * Body: { sessionId, number, message }
 */
export async function send(req, res) {
  try {
    const { sessionId, number, message } = req.body

    if (!sessionId || !number || !message) {
      return res.status(400).json({
        status: false,
        message: 'sessionId, number, and message are required'
      })
    }

    if (!getConnectedSession(sessionId, res)) return

    await sendAndLog(
      sessionId,
      number,
      'text',
      message,
      null,
      () => sendTextMessage(sessionId, number, message)
    )

    return res.json({ status: true, message: 'Message sent' })
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message })
  }
}

/**
 * POST /message/poll
 * Send a poll message.
 * Body: { sessionId, number, question, options: [...], selectableCount?, toAnnouncementGroup? }
 */
export async function sendPoll(req, res) {
  try {
    const {
      sessionId,
      number,
      question,
      options,
      selectableCount = 1,
      toAnnouncementGroup = false
    } = req.body

    if (!sessionId || !number || !question || !options) {
      return res.status(400).json({
        status: false,
        message: 'sessionId, number, question, and options are required'
      })
    }

    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({
        status: false,
        message: 'options must be an array with at least 2 items'
      })
    }

    if (options.length > 12) {
      return res.status(400).json({
        status: false,
        message: 'options cannot exceed 12 items'
      })
    }

    if (!getConnectedSession(sessionId, res)) return

    const payload = { question, options, selectableCount, toAnnouncementGroup }

    await sendAndLog(
      sessionId,
      number,
      'poll',
      question,           // summary = judul poll
      payload,            // full payload disimpan di kolom payload (JSON)
      () => sendPollMessage(sessionId, number, question, options, selectableCount, toAnnouncementGroup)
    )

    return res.json({ status: true, message: 'Poll sent' })
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
    const limit  = Math.min(parseInt(req.query.limit)  || 50, 200)
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
    const limit  = Math.min(parseInt(req.query.limit)  || 50, 200)
    const offset = parseInt(req.query.offset) || 0

    const messages = await getIncomingMessages(sessionId, limit, offset)

    return res.json({ status: true, data: messages, limit, offset })
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message })
  }
}
