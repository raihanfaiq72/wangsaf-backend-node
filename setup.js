/**
 * setup.js
 * Run once to create all required tables in MariaDB.
 * Usage: node setup.js
 */

import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true
})

console.log('🔌 Connected to MariaDB')

const schema = `
-- -------------------------------------------------------
-- devices
-- Stores registered WhatsApp sessions / numbers
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id    VARCHAR(100) NOT NULL UNIQUE,
  phone_number  VARCHAR(30)  DEFAULT NULL,
  status        ENUM('connecting','scan_qr','connected','disconnected','logged_out')
                NOT NULL DEFAULT 'connecting',
  qr_code       TEXT         DEFAULT NULL,
  webhook_url   VARCHAR(500) DEFAULT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- session_auth
-- Stores Baileys auth state (replaces file-based storage)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_auth (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id  VARCHAR(100) NOT NULL,
  data_key    VARCHAR(200) NOT NULL,
  data_value  LONGTEXT     NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
              ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_session_key (session_id, data_key),
  INDEX idx_session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- messages
-- Outbound message log
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id  VARCHAR(100) NOT NULL,
  recipient   VARCHAR(50)  NOT NULL,
  message     TEXT         NOT NULL,
  status      ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  error       TEXT         DEFAULT NULL,
  sent_at     DATETIME     DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_id  (session_id),
  INDEX idx_recipient   (recipient),
  INDEX idx_status      (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- incoming_messages
-- Inbound message log (received from WhatsApp)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS incoming_messages (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id  VARCHAR(100) NOT NULL,
  sender      VARCHAR(50)  NOT NULL,
  message     TEXT         DEFAULT NULL,
  raw         LONGTEXT     DEFAULT NULL,
  received_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_id (session_id),
  INDEX idx_sender     (sender)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- webhooks
-- Per-device webhook configuration
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhooks (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id  VARCHAR(100) NOT NULL UNIQUE,
  url         VARCHAR(500) NOT NULL,
  secret      VARCHAR(200) DEFAULT NULL,
  events      JSON         DEFAULT NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
              ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`

try {
  await connection.query(schema)
  console.log('✅ All tables created successfully:')
  console.log('   - devices')
  console.log('   - session_auth')
  console.log('   - messages')
  console.log('   - incoming_messages')
  console.log('   - webhooks')
} catch (err) {
  console.error('❌ Error creating tables:', err.message)
  process.exit(1)
} finally {
  await connection.end()
  console.log('🔌 Connection closed')
}
