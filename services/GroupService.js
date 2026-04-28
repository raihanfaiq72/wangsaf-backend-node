/**
 * GroupService.js
 * Wraps all Baileys group operations.
 * Every function throws if session not found or not connected.
 */

import { getSession } from './WhatsAppService.js'

function getSock(sessionId) {
  const session = getSession(sessionId)
  if (!session) throw new Error('Session not found')
  if (session.status !== 'connected') throw new Error('Session not connected')
  return session.sock
}

function toJid(number) {
  if (number.includes('@')) return number
  return number + '@s.whatsapp.net'
}

// ── Create & Leave ────────────────────────────────────────────────────────────

export async function createGroup(sessionId, title, participants) {
  const sock = getSock(sessionId)
  const jids = participants.map(toJid)
  return await sock.groupCreate(title, jids)
}

export async function leaveGroup(sessionId, jid) {
  const sock = getSock(sessionId)
  await sock.groupLeave(jid)
}

// ── Participants ──────────────────────────────────────────────────────────────

/**
 * @param {'add'|'remove'|'promote'|'demote'} action
 */
export async function updateParticipants(sessionId, jid, participants, action) {
  const sock = getSock(sessionId)
  const jids = participants.map(toJid)
  return await sock.groupParticipantsUpdate(jid, jids, action)
}

// ── Group Info ────────────────────────────────────────────────────────────────

export async function getGroupMetadata(sessionId, jid) {
  const sock = getSock(sessionId)
  return await sock.groupMetadata(jid)
}

export async function getAllParticipatingGroups(sessionId) {
  const sock = getSock(sessionId)
  return await sock.groupFetchAllParticipating()
}

// ── Subject & Description ─────────────────────────────────────────────────────

export async function updateSubject(sessionId, jid, subject) {
  const sock = getSock(sessionId)
  await sock.groupUpdateSubject(jid, subject)
}

export async function updateDescription(sessionId, jid, description) {
  const sock = getSock(sessionId)
  await sock.groupUpdateDescription(jid, description)
}

// ── Settings ──────────────────────────────────────────────────────────────────

/**
 * @param {'announcement'|'not_announcement'|'locked'|'unlocked'} setting
 */
export async function updateSetting(sessionId, jid, setting) {
  const sock = getSock(sessionId)
  await sock.groupSettingUpdate(jid, setting)
}

/**
 * Toggle ephemeral (disappearing messages).
 * @param {0|86400|604800|7776000} duration  - 0 = off, 86400 = 24h, 604800 = 7d, 7776000 = 90d
 */
export async function toggleEphemeral(sessionId, jid, duration) {
  const sock = getSock(sessionId)
  await sock.groupToggleEphemeral(jid, duration)
}

/**
 * @param {'all_member_add'|'admin_add'} mode
 */
export async function updateAddMode(sessionId, jid, mode) {
  const sock = getSock(sessionId)
  await sock.groupMemberAddMode(jid, mode)
}

// ── Invite Code ───────────────────────────────────────────────────────────────

export async function getInviteCode(sessionId, jid) {
  const sock = getSock(sessionId)
  const code = await sock.groupInviteCode(jid)
  return { code, link: `https://chat.whatsapp.com/${code}` }
}

export async function revokeInviteCode(sessionId, jid) {
  const sock = getSock(sessionId)
  const code = await sock.groupRevokeInvite(jid)
  return { code, link: `https://chat.whatsapp.com/${code}` }
}

export async function joinByInviteCode(sessionId, code) {
  const sock = getSock(sessionId)
  // Strip full URL if passed, keep only the code
  const cleanCode = code.replace('https://chat.whatsapp.com/', '')
  return await sock.groupAcceptInvite(cleanCode)
}

export async function getGroupInfoByInviteCode(sessionId, code) {
  const sock = getSock(sessionId)
  const cleanCode = code.replace('https://chat.whatsapp.com/', '')
  return await sock.groupGetInviteInfo(cleanCode)
}

// ── Join Requests ─────────────────────────────────────────────────────────────

export async function getJoinRequestList(sessionId, jid) {
  const sock = getSock(sessionId)
  return await sock.groupRequestParticipantsList(jid)
}

/**
 * @param {'approve'|'reject'} action
 */
export async function handleJoinRequests(sessionId, jid, participants, action) {
  const sock = getSock(sessionId)
  const jids = participants.map(toJid)
  return await sock.groupRequestParticipantsUpdate(jid, jids, action)
}
