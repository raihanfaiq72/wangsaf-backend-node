import express from 'express'
import DeviceController from '../controllers/DeviceController.js'

const router = express.Router()

router.post('/device/create', DeviceController.create)
router.get('/device/qr/:id', DeviceController.qr)
router.get('/device/status/:id', DeviceController.status)
router.post('/send-message', DeviceController.sendMessage)
router.delete('/device/:id', DeviceController.logout)

export default router