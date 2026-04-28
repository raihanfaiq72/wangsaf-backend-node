import express from 'express'
import dotenv from 'dotenv'
import apiRoutes from './routes/api.js'
import { restoreSessions } from './services/WhatsAppService.js'

dotenv.config()

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Basic request logger
app.use((req, _res, next) => {
  console.log(`→ ${req.method} ${req.path}`)
  next()
})

app.use('/api', apiRoutes)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: true, uptime: process.uptime() })
})

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ status: false, message: 'Route not found' })
})

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ status: false, message: 'Internal server error' })
})

const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '0.0.0.0'

app.listen(PORT, HOST, async () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`)
  await restoreSessions()
})
