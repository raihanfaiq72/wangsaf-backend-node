import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} from '@whiskeysockets/baileys'

import P from 'pino'
import QRCode from 'qrcode-terminal'
import fs from 'fs'
import path from 'path'

const SESSION_DIR = './storage/sessions'

if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true })
}

const sessions = {}

export function getSession(id) {
  return sessions[id] || null
}

export async function startBot(sessionId) {
  try {
    if (sessions[sessionId]) {
      console.log(`🔄 Cleaning up existing session for ${sessionId}`)
      sessions[sessionId].sock.ws?.close()
      delete sessions[sessionId]
    }

    const folder = path.join(SESSION_DIR, sessionId)

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true })
    }

    const { state, saveCreds } =
      await useMultiFileAuthState(folder)

    const { version } =
      await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: 'silent' }),

        printQRInTerminal: false,

        syncFullHistory: false,
        markOnlineOnConnect: false,
        fireInitQueries: true,
        generateHighQualityLinkPreview: false,
        defaultQueryTimeoutMs: 60000, // 60 second timeout
        connectTimeoutMs: 30000,     // 30 second connection timeout
        keepAliveIntervalMs: 25000,  // 25 second keep alive
        retryRequestDelayMs: 1000,   // 1 second retry delay
        maxRetries: 3                // Max retry attempts
    })

    sessions[sessionId] = {
      sock,
      qr: null,
      status: 'connecting'
    }

    sock.ev.on('connection.update', ({ connection, qr, lastDisconnect }) => {

      if (qr) {
        sessions[sessionId].qr = qr
        sessions[sessionId].status = 'scan_qr'

        console.log(`QR ${sessionId}`)
        QRCode.generate(qr, { small: true })
        
        setTimeout(() => {
          if (sessions[sessionId]?.status === 'scan_qr') {
            console.log(`⏰ QR timeout for ${sessionId}, restarting...`)
            sessions[sessionId].sock.ws.close()
          }
        }, 30000)
      }

      if (connection === 'open') {
        sessions[sessionId].status = 'connected'
        sessions[sessionId].qr = null

        console.log(`✅ ${sessionId} Connected`)
      }

      if (connection === 'close') {
        const code =
          lastDisconnect?.error?.output?.statusCode

        const shouldReconnect =
          code !== DisconnectReason.loggedOut

        sessions[sessionId].status = 'disconnected'
        
        console.log(`❌ ${sessionId} Disconnected - Code: ${code}, Should Reconnect: ${shouldReconnect}`)
        
        if (lastDisconnect?.error) {
          console.log(`Error details:`, lastDisconnect.error.message)
        }

        if (shouldReconnect) {
          console.log(`🔄 Reconnecting ${sessionId}...`)
          setTimeout(() => startBot(sessionId), 2000) 
        } else {
          console.log(`🗑️ Deleting session ${sessionId}`)
          delete sessions[sessionId]
          
          // Delete session folder
          const sessionFolder = path.join(SESSION_DIR, sessionId)
          if (fs.existsSync(sessionFolder)) {
            fs.rmSync(sessionFolder, { recursive: true, force: true })
            console.log(`🗑️ Deleted session folder: ${sessionFolder}`)
          }
        }
      }

    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0]

      if (!msg.message) return
      if (msg.key.fromMe) return

      const sender = msg.key.remoteJid

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        ''

      console.log(`[${sessionId}] ${sender}: ${text}`)

      if (text.toLowerCase() === 'hi') {
        await sock.sendMessage(sender, {
          text: `Hello from ${sessionId}`
        })
      }
    })

  } catch (err) {
    console.log(err)
  }
}

export async function restoreSessions() {
  const dirs = fs.readdirSync(SESSION_DIR)

  for (const dir of dirs) {
    await startBot(dir)
  }
}

export async function sendMessage(sessionId, number, message) {
  const session = sessions[sessionId]

  if (!session) {
    throw new Error('device not found')
  }

  const jid = number + '@s.whatsapp.net'

  await session.sock.sendMessage(jid, {
    text: message
  })
}

export async function logoutDevice(sessionId) {
  const session = sessions[sessionId]

  if (!session) {
    throw new Error('device not found')
  }

  await session.sock.logout()

  delete sessions[sessionId]

  // Delete session folder
  const sessionFolder = path.join(SESSION_DIR, sessionId)
  if (fs.existsSync(sessionFolder)) {
    fs.rmSync(sessionFolder, { recursive: true, force: true })
    console.log(`🗑️ Deleted session folder: ${sessionFolder}`)
  }
}