/**
 * WhatsAppService.js
 * Core Baileys session manager.
 * Handles connect, reconnect, QR, and event routing.
 */

import makeWASocket, {
  fetchLatestBaileysVersion,
  DisconnectReason
} from '@whiskeysockets/baileys'

import P from 'pino'
import { useDBAuthState } from './AuthStateService.js'
import { updateDeviceStatus, getActiveDevices } from './DeviceService.js'
import { saveIncomingMessage } from './MessageService.js'
import { dispatchWebhook } from './WebhookService.js'

// Cache Baileys version — fetched once, reused on reconnects
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

// Track reconnect attempts per session to apply backoff
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

/**
 * Codes that should NOT trigger a reconnect.
 * The session is either permanently gone or needs manual intervention.
 */
const FATAL_CODES = new Set([
  DisconnectReason.loggedOut,        // 401 — user logged out from phone
  DisconnectReason.forbidden,        // 403 — banned
  DisconnectReason.badSession,       // 500 — corrupted session
  DisconnectReason.connectionReplaced // 440 — another device took over
])

export async function startSession(sessionId) {
  // Guard: if a socket is already connecting/connected, skip
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

  // ── QR timeout handle
  let qrTimeout = null

  sock.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {

    if (qr) {
      sessions[sessionId].status = 'scan_qr'
      await updateDeviceStatus(sessionId, 'scan_qr', qr)
      console.log(`📱 [${sessionId}] QR ready — scan now`)

      // Auto-restart if QR not scanned in 60s
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
      reconnectAttempts[sessionId] = 0  // reset backoff on successful connect
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

      // Fatal: clear session and stop
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

      // restartRequired (515): reconnect immediately, no backoff
      if (code === DisconnectReason.restartRequired) {
        sessions[sessionId].status = 'connecting'
        await updateDeviceStatus(sessionId, 'connecting')
        console.log(`🔄 [${sessionId}] Restart required, reconnecting now...`)
        setTimeout(() => startSession(sessionId), 500)
        return
      }

      // connectionClosed (428) / connectionLost (408) / timedOut: reconnect with backoff
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

  // Fire-and-forget — don't await WA delivery ack, it can take seconds
  session.sock.sendMessage(jid, { text }).catch(err => {
    console.error(`[${sessionId}] sendMessage failed to ${jid}: ${err.message}`)
  })
}
