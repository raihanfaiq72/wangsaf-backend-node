import express from 'express'

import { authenticate } from '../middleware/auth.js'
import * as DeviceController  from '../controllers/DeviceController.js'
import * as MessageController from '../controllers/MessageController.js'
import * as WebhookController from '../controllers/WebhookController.js'
import * as GroupController   from '../controllers/GroupController.js'

const router = express.Router()

// ── Auth — semua route di bawah ini wajib token ──────────
router.use(authenticate)

// ── Device ──────────────────────────────────────────────
router.post  ('/device',              DeviceController.create)
router.get   ('/device',              DeviceController.list)
router.get   ('/device/:id',          DeviceController.show)
router.get   ('/device/:id/qr',       DeviceController.qr)
router.get   ('/device/:id/status',   DeviceController.status)
router.post  ('/device/:id/restart',  DeviceController.restart)
router.post  ('/device/:id/reset',    DeviceController.reset)
router.delete('/device/:id',          DeviceController.destroy)

// ── Message ─────────────────────────────────────────────
router.post('/message/send',                    MessageController.send)
router.post('/message/poll',                    MessageController.sendPoll)
router.get ('/message/:sessionId/outbound',     MessageController.outbound)
router.get ('/message/:sessionId/incoming',     MessageController.incoming)

// ── Group ────────────────────────────────────────────────
router.get  ('/group/all',                  GroupController.allGroups)
router.get  ('/group/invite-info',          GroupController.inviteInfo)
router.post ('/group/create',               GroupController.create)
router.post ('/group/join',                 GroupController.joinByCode)

router.get  ('/group/:jid/metadata',        GroupController.metadata)
router.post ('/group/:jid/leave',           GroupController.leave)
router.post ('/group/:jid/participants',    GroupController.updateParticipants)
router.put  ('/group/:jid/subject',         GroupController.updateSubject)
router.put  ('/group/:jid/description',     GroupController.updateDescription)
router.put  ('/group/:jid/setting',         GroupController.updateSetting)
router.put  ('/group/:jid/ephemeral',       GroupController.toggleEphemeral)
router.put  ('/group/:jid/add-mode',        GroupController.updateAddMode)
router.get  ('/group/:jid/invite',          GroupController.getInviteCode)
router.post ('/group/:jid/invite/revoke',   GroupController.revokeInviteCode)
router.get  ('/group/:jid/join-requests',   GroupController.joinRequests)
router.post ('/group/:jid/join-requests',   GroupController.handleJoinRequests)

// ── Webhook ─────────────────────────────────────────────
router.get   ('/webhook/:sessionId', WebhookController.show)
router.post  ('/webhook/:sessionId', WebhookController.upsert)
router.delete('/webhook/:sessionId', WebhookController.destroy)

export default router
