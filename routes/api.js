import express from 'express'

import * as DeviceController  from '../controllers/DeviceController.js'
import * as MessageController from '../controllers/MessageController.js'
import * as WebhookController from '../controllers/WebhookController.js'

const router = express.Router()

// ── Device ──────────────────────────────────────────────
router.post  ('/device',              DeviceController.create)
router.get   ('/device',              DeviceController.list)
router.get   ('/device/:id',          DeviceController.show)
router.get   ('/device/:id/qr',       DeviceController.qr)
router.get   ('/device/:id/status',   DeviceController.status)
router.post  ('/device/:id/restart',  DeviceController.restart)
router.delete('/device/:id',          DeviceController.destroy)

// ── Message ─────────────────────────────────────────────
router.post('/message/send',                    MessageController.send)
router.get ('/message/:sessionId/outbound',     MessageController.outbound)
router.get ('/message/:sessionId/incoming',     MessageController.incoming)

// ── Webhook ─────────────────────────────────────────────
router.get   ('/webhook/:sessionId', WebhookController.show)
router.post  ('/webhook/:sessionId', WebhookController.upsert)
router.delete('/webhook/:sessionId', WebhookController.destroy)

export default router
