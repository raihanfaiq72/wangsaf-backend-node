import express from 'express'
import dotenv from 'dotenv'
import apiRoutes from './routes/api.js'
import { restoreSessions } from './services/WhatsAppService.js'

dotenv.config()

const app = express()
app.use(express.json())

app.use('/', apiRoutes)

const PORT = process.env.PORT || 3000

const HOST = "0.0.0.0";

app.listen(PORT, HOST, async () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`)
  await restoreSessions()
})