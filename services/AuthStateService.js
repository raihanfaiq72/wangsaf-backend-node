/**
 * AuthStateService.js
 * Baileys auth state adapter backed by MariaDB.
 * Drop-in replacement for useMultiFileAuthState.
 */

import {
  initAuthCreds,
  BufferJSON,
  proto
} from '@whiskeysockets/baileys'
import pool from '../database/db.js'

export async function useDBAuthState(sessionId) {

  async function readData(key) {
    const [rows] = await pool.query(
      'SELECT data_value FROM session_auth WHERE session_id = ? AND data_key = ? LIMIT 1',
      [sessionId, key]
    )
    if (!rows.length) return null
    try {
      return JSON.parse(rows[0].data_value, BufferJSON.reviver)
    } catch {
      return null
    }
  }

  async function writeData(key, value) {
    const json = JSON.stringify(value, BufferJSON.replacer)
    await pool.query(
      `INSERT INTO session_auth (session_id, data_key, data_value)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE data_value = VALUES(data_value), updated_at = CURRENT_TIMESTAMP`,
      [sessionId, key, json]
    )
  }

  async function removeData(key) {
    await pool.query(
      'DELETE FROM session_auth WHERE session_id = ? AND data_key = ?',
      [sessionId, key]
    )
  }

  async function clearAll() {
    await pool.query(
      'DELETE FROM session_auth WHERE session_id = ?',
      [sessionId]
    )
  }

  // Load or init credentials
  const creds = (await readData('creds')) || initAuthCreds()

  const state = {
    creds,
    keys: {
      get: async (type, ids) => {
        const data = {}
        for (const id of ids) {
          let value = await readData(`${type}-${id}`)
          if (type === 'app-state-sync-key' && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value)
          }
          data[id] = value
        }
        return data
      },
      set: async (data) => {
        for (const category of Object.keys(data)) {
          for (const id of Object.keys(data[category])) {
            const value = data[category][id]
            if (value) {
              await writeData(`${category}-${id}`, value)
            } else {
              await removeData(`${category}-${id}`)
            }
          }
        }
      }
    }
  }

  const saveCreds = async () => {
    await writeData('creds', state.creds)
  }

  return { state, saveCreds, clearAll }
}
