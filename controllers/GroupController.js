/**
 * GroupController.js
 * Handles all WhatsApp group management endpoints.
 */

import * as GroupService from '../services/GroupService.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(res, data = {}) {
  return res.json({ status: true, ...data })
}

function fail(res, err, code = 500) {
  return res.status(code).json({ status: false, message: err.message || err })
}

// ── Create & Leave ────────────────────────────────────────────────────────────

/**
 * POST /group/create
 * Body: { sessionId, title, participants: ['628xxx', ...] }
 */
export async function create(req, res) {
  try {
    const { sessionId, title, participants } = req.body
    if (!sessionId || !title || !Array.isArray(participants) || participants.length === 0) {
      return fail(res, { message: 'sessionId, title, and participants[] are required' }, 400)
    }
    const group = await GroupService.createGroup(sessionId, title, participants)
    return ok(res, { data: group })
  } catch (err) { return fail(res, err) }
}

/**
 * POST /group/:jid/leave
 * Body: { sessionId }
 */
export async function leave(req, res) {
  try {
    const { sessionId } = req.body
    if (!sessionId) return fail(res, { message: 'sessionId is required' }, 400)
    await GroupService.leaveGroup(sessionId, req.params.jid)
    return ok(res, { message: 'Left group' })
  } catch (err) { return fail(res, err) }
}

// ── Participants ──────────────────────────────────────────────────────────────

/**
 * POST /group/:jid/participants
 * Body: { sessionId, participants: ['628xxx', ...], action: 'add'|'remove'|'promote'|'demote' }
 */
export async function updateParticipants(req, res) {
  try {
    const { sessionId, participants, action } = req.body
    const validActions = ['add', 'remove', 'promote', 'demote']

    if (!sessionId || !Array.isArray(participants) || !action) {
      return fail(res, { message: 'sessionId, participants[], and action are required' }, 400)
    }
    if (!validActions.includes(action)) {
      return fail(res, { message: `action must be one of: ${validActions.join(', ')}` }, 400)
    }

    const result = await GroupService.updateParticipants(sessionId, req.params.jid, participants, action)
    return ok(res, { data: result })
  } catch (err) { return fail(res, err) }
}

// ── Group Info ────────────────────────────────────────────────────────────────

/**
 * GET /group/:jid/metadata?sessionId=xxx
 */
export async function metadata(req, res) {
  try {
    const { sessionId } = req.query
    if (!sessionId) return fail(res, { message: 'sessionId query param is required' }, 400)
    const data = await GroupService.getGroupMetadata(sessionId, req.params.jid)
    return ok(res, { data })
  } catch (err) { return fail(res, err) }
}

/**
 * GET /group/all?sessionId=xxx
 */
export async function allGroups(req, res) {
  try {
    const { sessionId } = req.query
    if (!sessionId) return fail(res, { message: 'sessionId query param is required' }, 400)
    const data = await GroupService.getAllParticipatingGroups(sessionId)
    return ok(res, { data })
  } catch (err) { return fail(res, err) }
}

// ── Subject & Description ─────────────────────────────────────────────────────

/**
 * PUT /group/:jid/subject
 * Body: { sessionId, subject }
 */
export async function updateSubject(req, res) {
  try {
    const { sessionId, subject } = req.body
    if (!sessionId || !subject) return fail(res, { message: 'sessionId and subject are required' }, 400)
    await GroupService.updateSubject(sessionId, req.params.jid, subject)
    return ok(res, { message: 'Subject updated' })
  } catch (err) { return fail(res, err) }
}

/**
 * PUT /group/:jid/description
 * Body: { sessionId, description }
 */
export async function updateDescription(req, res) {
  try {
    const { sessionId, description } = req.body
    if (!sessionId || !description) return fail(res, { message: 'sessionId and description are required' }, 400)
    await GroupService.updateDescription(sessionId, req.params.jid, description)
    return ok(res, { message: 'Description updated' })
  } catch (err) { return fail(res, err) }
}

// ── Settings ──────────────────────────────────────────────────────────────────

/**
 * PUT /group/:jid/setting
 * Body: { sessionId, setting: 'announcement'|'not_announcement'|'locked'|'unlocked' }
 */
export async function updateSetting(req, res) {
  try {
    const { sessionId, setting } = req.body
    const validSettings = ['announcement', 'not_announcement', 'locked', 'unlocked']

    if (!sessionId || !setting) return fail(res, { message: 'sessionId and setting are required' }, 400)
    if (!validSettings.includes(setting)) {
      return fail(res, { message: `setting must be one of: ${validSettings.join(', ')}` }, 400)
    }

    await GroupService.updateSetting(sessionId, req.params.jid, setting)
    return ok(res, { message: `Setting updated to: ${setting}` })
  } catch (err) { return fail(res, err) }
}

/**
 * PUT /group/:jid/ephemeral
 * Body: { sessionId, duration: 0|86400|604800|7776000 }
 */
export async function toggleEphemeral(req, res) {
  try {
    const { sessionId, duration } = req.body
    const validDurations = [0, 86400, 604800, 7776000]

    if (!sessionId || duration === undefined) {
      return fail(res, { message: 'sessionId and duration are required' }, 400)
    }
    if (!validDurations.includes(Number(duration))) {
      return fail(res, { message: `duration must be one of: ${validDurations.join(', ')} (0=off, 86400=24h, 604800=7d, 7776000=90d)` }, 400)
    }

    await GroupService.toggleEphemeral(sessionId, req.params.jid, Number(duration))
    return ok(res, { message: `Ephemeral set to ${duration}s` })
  } catch (err) { return fail(res, err) }
}

/**
 * PUT /group/:jid/add-mode
 * Body: { sessionId, mode: 'all_member_add'|'admin_add' }
 */
export async function updateAddMode(req, res) {
  try {
    const { sessionId, mode } = req.body
    const validModes = ['all_member_add', 'admin_add']

    if (!sessionId || !mode) return fail(res, { message: 'sessionId and mode are required' }, 400)
    if (!validModes.includes(mode)) {
      return fail(res, { message: `mode must be one of: ${validModes.join(', ')}` }, 400)
    }

    await GroupService.updateAddMode(sessionId, req.params.jid, mode)
    return ok(res, { message: `Add mode set to: ${mode}` })
  } catch (err) { return fail(res, err) }
}

// ── Invite Code ───────────────────────────────────────────────────────────────

/**
 * GET /group/:jid/invite?sessionId=xxx
 */
export async function getInviteCode(req, res) {
  try {
    const { sessionId } = req.query
    if (!sessionId) return fail(res, { message: 'sessionId query param is required' }, 400)
    const data = await GroupService.getInviteCode(sessionId, req.params.jid)
    return ok(res, { data })
  } catch (err) { return fail(res, err) }
}

/**
 * POST /group/:jid/invite/revoke
 * Body: { sessionId }
 */
export async function revokeInviteCode(req, res) {
  try {
    const { sessionId } = req.body
    if (!sessionId) return fail(res, { message: 'sessionId is required' }, 400)
    const data = await GroupService.revokeInviteCode(sessionId, req.params.jid)
    return ok(res, { data })
  } catch (err) { return fail(res, err) }
}

/**
 * POST /group/join
 * Body: { sessionId, code }
 */
export async function joinByCode(req, res) {
  try {
    const { sessionId, code } = req.body
    if (!sessionId || !code) return fail(res, { message: 'sessionId and code are required' }, 400)
    const data = await GroupService.joinByInviteCode(sessionId, code)
    return ok(res, { data })
  } catch (err) { return fail(res, err) }
}

/**
 * GET /group/invite-info?sessionId=xxx&code=xxx
 */
export async function inviteInfo(req, res) {
  try {
    const { sessionId, code } = req.query
    if (!sessionId || !code) return fail(res, { message: 'sessionId and code query params are required' }, 400)
    const data = await GroupService.getGroupInfoByInviteCode(sessionId, code)
    return ok(res, { data })
  } catch (err) { return fail(res, err) }
}

// ── Join Requests ─────────────────────────────────────────────────────────────

/**
 * GET /group/:jid/join-requests?sessionId=xxx
 */
export async function joinRequests(req, res) {
  try {
    const { sessionId } = req.query
    if (!sessionId) return fail(res, { message: 'sessionId query param is required' }, 400)
    const data = await GroupService.getJoinRequestList(sessionId, req.params.jid)
    return ok(res, { data })
  } catch (err) { return fail(res, err) }
}

/**
 * POST /group/:jid/join-requests
 * Body: { sessionId, participants: ['628xxx', ...], action: 'approve'|'reject' }
 */
export async function handleJoinRequests(req, res) {
  try {
    const { sessionId, participants, action } = req.body
    const validActions = ['approve', 'reject']

    if (!sessionId || !Array.isArray(participants) || !action) {
      return fail(res, { message: 'sessionId, participants[], and action are required' }, 400)
    }
    if (!validActions.includes(action)) {
      return fail(res, { message: `action must be one of: ${validActions.join(', ')}` }, 400)
    }

    const data = await GroupService.handleJoinRequests(sessionId, req.params.jid, participants, action)
    return ok(res, { data })
  } catch (err) { return fail(res, err) }
}
