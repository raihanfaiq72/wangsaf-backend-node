
import makeWASocket, {
  fetchLatestBaileysVersion,
  DisconnectReason
} from '@whiskeysockets/baileys'

import P from 'pino'
import { useDBAuthState } from './AuthStateService.js'
import { updateDeviceStatus, getActiveDevices } from './DeviceService.js'
import { saveIncomingMessage } from './MessageService.js'
import { dispatchWebhook } from './WebhookService.js'

let baileysVersion = null
async function getBaileysVersion() {
  if (!baileysVersion) {
    const { version } = await fetchLatestBaileysVersion()
    baileysVersion = version
    console.log(`📦 Baileys version: ${version.join('.')}`)
  }
  return baileysVersion
}
const sessions = {}

const reconnectAttempts = {}

export function getSession(sessionId) {
  return sessions[sessionId] || null
}

export function getAllSessions() {
  return Object.entries(sessions).map(([id, s]) => ({
    sessionId: id,
    status: s.status
  }))
}

const FATAL_CODES = new Set([
  DisconnectReason.loggedOut,        
  DisconnectReason.forbidden,        
  DisconnectReason.badSession,      
  DisconnectReason.connectionReplaced 
])

export async function startSession(sessionId) {
  if (sessions[sessionId]?.sock) {
    try {
      sessions[sessionId].sock.ev.removeAllListeners()
      sessions[sessionId].sock.ws?.terminate()
    } catch {}
    delete sessions[sessionId]
  }

  const { state, saveCreds, clearAll } = await useDBAuthState(sessionId)
  const version = await getBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    fireInitQueries: true,
    generateHighQualityLinkPreview: false,
    defaultQueryTimeoutMs: 60_000,
    connectTimeoutMs: 60_000,
    keepAliveIntervalMs: 30_000,
    retryRequestDelayMs: 2_000,
    maxRetries: 5
  })

  sessions[sessionId] = { sock, status: 'connecting' }
  await updateDeviceStatus(sessionId, 'connecting')

  let qrTimeout = null

  sock.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {

    if (qr) {
      sessions[sessionId].status = 'scan_qr'
      await updateDeviceStatus(sessionId, 'scan_qr', qr)
      console.log(`📱 [${sessionId}] QR ready — scan now`)

      clearTimeout(qrTimeout)
      qrTimeout = setTimeout(async () => {
        if (sessions[sessionId]?.status === 'scan_qr') {
          console.log(`⏰ [${sessionId}] QR expired, restarting...`)
          sock.ws?.terminate()
        }
      }, 60_000)
    }

    if (connection === 'open') {
      clearTimeout(qrTimeout)
      reconnectAttempts[sessionId] = 0  
      sessions[sessionId].status = 'connected'
      const phone = sock.user?.id?.split(':')[0] || null
      await updateDeviceStatus(sessionId, 'connected', null, phone)
      console.log(`✅ [${sessionId}] Connected — ${phone}`)
      await dispatchWebhook(sessionId, 'connection.open', { sessionId, phone })
    }

    if (connection === 'close') {
      clearTimeout(qrTimeout)
      const code = lastDisconnect?.error?.output?.statusCode
      const reason = DisconnectReason[code] || 'unknown'

      console.log(`❌ [${sessionId}] Disconnected — code: ${code} (${reason})`)

      await dispatchWebhook(sessionId, 'connection.close', { sessionId, code, reason })

      if (FATAL_CODES.has(code)) {
        sessions[sessionId].status = code === DisconnectReason.loggedOut ? 'logged_out' : 'disconnected'
        await updateDeviceStatus(sessionId, sessions[sessionId].status)

        if (code === DisconnectReason.loggedOut || code === DisconnectReason.badSession) {
          await clearAll()
          console.log(`🗑️  [${sessionId}] Auth cleared (${reason})`)
        }

        delete sessions[sessionId]
        delete reconnectAttempts[sessionId]
        console.log(`🛑 [${sessionId}] Session stopped — ${reason}`)
        return
      }

      if (code === DisconnectReason.restartRequired) {
        sessions[sessionId].status = 'connecting'
        await updateDeviceStatus(sessionId, 'connecting')
        console.log(`🔄 [${sessionId}] Restart required, reconnecting now...`)
        setTimeout(() => startSession(sessionId), 500)
        return
      }

      sessions[sessionId].status = 'disconnected'
      await updateDeviceStatus(sessionId, 'disconnected')

      const attempts = (reconnectAttempts[sessionId] || 0) + 1
      reconnectAttempts[sessionId] = attempts

      // Exponential backoff: 3s, 6s, 12s, 24s, max 30s
      const delay = Math.min(3_000 * Math.pow(2, attempts - 1), 30_000)
      console.log(`🔄 [${sessionId}] Reconnecting in ${delay / 1000}s (attempt ${attempts})...`)
      setTimeout(() => startSession(sessionId), delay)
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue

      const sender = msg.key.remoteJid
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        ''

      console.log(`[${sessionId}] ← ${sender}: ${text}`)

      await saveIncomingMessage(sessionId, sender, text, msg)
      await dispatchWebhook(sessionId, 'message.received', {
        sessionId,
        sender,
        message: text,
        raw: msg
      })
    }
  })
}

export async function stopSession(sessionId) {
  const session = sessions[sessionId]
  if (!session) throw new Error('Session not found')
  delete reconnectAttempts[sessionId]
  try {
    session.sock.ev.removeAllListeners()
    await session.sock.logout()
  } catch {}
  delete sessions[sessionId]
}

export async function restoreSessions() {
  const devices = await getActiveDevices()
  console.log(`🔁 Restoring ${devices.length} session(s)...`)
  for (const device of devices) {
    await startSession(device.session_id)
  }
}

export async function sendTextMessage(sessionId, number, text) {
  const session = sessions[sessionId]
  if (!session) throw new Error('Session not found')
  if (session.status !== 'connected') throw new Error('Session not connected')

  const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`

  session.sock.sendMessage(jid, { text }).catch(err => {
    console.error(`[${sessionId}] sendMessage failed to ${jid}: ${err.message}`)
  })
}

/**
 * Send a poll message.
 * @param {string}   sessionId
 * @param {string}   number            - phone number or JID
 * @param {string}   question          - poll question / name
 * @param {string[]} options           - poll choices (2–12 items)
 * @param {number}   selectableCount   - how many options can be selected (default 1)
 * @param {boolean}  toAnnouncementGroup
 */
export async function sendPollMessage(sessionId, number, question, options, selectableCount = 1, toAnnouncementGroup = false) {
  const session = sessions[sessionId]
  if (!session) throw new Error('Session not found')
  if (session.status !== 'connected') throw new Error('Session not connected')

  if (!Array.isArray(options) || options.length < 2) {
    throw new Error('Poll requires at least 2 options')
  }
  if (options.length > 12) {
    throw new Error('Poll supports a maximum of 12 options')
  }

  const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`

  session.sock.sendMessage(jid, {
    poll: {
      name: question,
      values: options,
      selectableCount,
      toAnnouncementGroup
    }
  }).catch(err => {
    console.error(`[${sessionId}] sendPoll failed to ${jid}: ${err.message}`)
  })
}
