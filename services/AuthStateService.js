/**
 * AuthStateService.js
 * Baileys auth state adapter backed by MariaDB.
 *
 * Key fixes vs naive implementation:
 * - keys.get  → single batch SELECT (no N+1 queries)
 * - keys.set  → single batch INSERT ... ON DUPLICATE KEY UPDATE (atomic)
 * - keys.set  → deletes batched in one DELETE ... WHERE IN (...)
 */

import {
  initAuthCreds,
  BufferJSON,
  proto
} from '@whiskeysockets/baileys'
import pool from '../database/db.js'

export async function useDBAuthState(sessionId) {

  // ── Single-key helpers (used for creds only) ────────────────────────────────

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

  async function clearAll() {
    await pool.query(
      'DELETE FROM session_auth WHERE session_id = ?',
      [sessionId]
    )
  }

  // ── Batch key helpers ───────────────────────────────────────────────────────

  /**
   * Fetch multiple keys in ONE query instead of N queries.
   */
  async function readManyData(dbKeys) {
    if (!dbKeys.length) return {}
    const placeholders = dbKeys.map(() => '?').join(', ')
    const [rows] = await pool.query(
      `SELECT data_key, data_value FROM session_auth
       WHERE session_id = ? AND data_key IN (${placeholders})`,
      [sessionId, ...dbKeys]
    )
    const result = {}
    for (const row of rows) {
      try {
        result[row.data_key] = JSON.parse(row.data_value, BufferJSON.reviver)
      } catch {
        result[row.data_key] = null
      }
    }
    return result
  }

  /**
   * Write multiple keys in ONE batch INSERT ... ON DUPLICATE KEY UPDATE.
   * This is atomic — either all succeed or none do.
   */
  async function writeManyData(entries) {
    if (!entries.length) return
    // entries: [{ key, value }]
    const values = entries.map(e => [sessionId, e.key, JSON.stringify(e.value, BufferJSON.replacer)])
    await pool.query(
      `INSERT INTO session_auth (session_id, data_key, data_value) VALUES ?
       ON DUPLICATE KEY UPDATE data_value = VALUES(data_value), updated_at = CURRENT_TIMESTAMP`,
      [values]
    )
  }

  /**
   * Delete multiple keys in ONE query.
   */
  async function deleteManyData(dbKeys) {
    if (!dbKeys.length) return
    const placeholders = dbKeys.map(() => '?').join(', ')
    await pool.query(
      `DELETE FROM session_auth WHERE session_id = ? AND data_key IN (${placeholders})`,
      [sessionId, ...dbKeys]
    )
  }

  // ── Load or init credentials ────────────────────────────────────────────────

  const creds = (await readData('creds')) || initAuthCreds()

  // ── Auth state ──────────────────────────────────────────────────────────────

  const state = {
    creds,
    keys: {
      /**
       * Batch GET — one DB query for all requested ids.
       */
      get: async (type, ids) => {
        const dbKeys = ids.map(id => `${type}-${id}`)
        const rows = await readManyData(dbKeys)

        const data = {}
        for (const id of ids) {
          let value = rows[`${type}-${id}`] ?? null
          if (type === 'app-state-sync-key' && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value)
          }
          data[id] = value
        }
        return data
      },

      /**
       * Batch SET — one INSERT for all writes, one DELETE for all removals.
       */
      set: async (data) => {
        const toWrite  = []
        const toDelete = []

        for (const category of Object.keys(data)) {
          for (const id of Object.keys(data[category])) {
            const value = data[category][id]
            const dbKey = `${category}-${id}`
            if (value) {
              toWrite.push({ key: dbKey, value })
            } else {
              toDelete.push(dbKey)
            }
          }
        }

        // Run both in parallel — they touch different rows
        await Promise.all([
          writeManyData(toWrite),
          deleteManyData(toDelete)
        ])
      }
    }
  }

  const saveCreds = async () => {
    await writeData('creds', state.creds)
  }

  return { state, saveCreds, clearAll }
}
