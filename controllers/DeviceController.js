import {
  startBot,
  getSession,
  sendMessage,
  logoutDevice
} from '../services/WhatsAppService.js'

export default {

  async create(req, res) {
    try {
      const { sessionId } = req.body

      if (!sessionId) {
        return res.json({
          status: false,
          message: 'sessionId required'
        })
      }

      await startBot(sessionId)

      res.json({
        status: true,
        message: 'device created',
        sessionId
      })

    } catch (e) {
      res.json({
        status: false,
        message: e.message
      })
    }
  },

  qr(req, res) {
    const session = getSession(req.params.id)

    if (!session) {
      return res.json({
        status: false,
        message: 'device not found'
      })
    }

    res.json({
      status: true,
      sessionId: req.params.id,
      qr: session.qr,
      device_status: session.status
    })
  },

  status(req, res) {
    const session = getSession(req.params.id)

    if (!session) {
      return res.json({
        status: false
      })
    }

    res.json({
      status: true,
      sessionId: req.params.id,
      device_status: session.status
    })
  },

  async sendMessage(req, res) {
    try {
      const { sessionId, number, message } = req.body

      await sendMessage(sessionId, number, message)

      res.json({
        status: true,
        message: 'sent'
      })

    } catch (e) {
      res.json({
        status: false,
        message: e.message
      })
    }
  },

  async logout(req, res) {
    try {
      await logoutDevice(req.params.id)

      res.json({
        status: true,
        message: 'deleted'
      })

    } catch (e) {
      res.json({
        status: false,
        message: e.message
      })
    }
  }

}