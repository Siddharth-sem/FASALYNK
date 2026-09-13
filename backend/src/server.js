import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import multer from 'multer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { changePassword, getCurrentUser, login, register, requestChangePasswordOtp, requestPasswordReset, resetPassword, requireAuth, requireRole, verifyChangePasswordOtp, verifyRegistrationOtp, verifyResetOtp } from './auth.js'
import { checkDatabaseConnection } from './db.js'
import { acceptBid, createBid, createCropLot, getCropLot, listCropLots } from './marketplace.js'

const app = express()
const port = process.env.PORT || 4000
const uploadDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '../uploads')
const upload = multer({
  dest: uploadDirectory,
  limits: { files: 5, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => callback(['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) ? null : new Error('File type is not supported.'), true),
})

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(uploadDirectory))

app.post('/api/auth/register', register)
app.post('/api/auth/login', login)
app.post('/api/auth/register/verify', verifyRegistrationOtp)
app.post('/api/auth/forgot-password', requestPasswordReset)
app.post('/api/auth/forgot-password/verify', verifyResetOtp)
app.post('/api/auth/reset-password', resetPassword)
app.post('/api/auth/change-password/request-otp', requireAuth, requestChangePasswordOtp)
app.post('/api/auth/change-password/verify', requireAuth, verifyChangePasswordOtp)
app.post('/api/auth/change-password', requireAuth, changePassword)
app.get('/api/auth/me', requireAuth, getCurrentUser)

app.get('/api/workspace', requireAuth, (request, response) => {
  const workspaceByRole = {
    FARMER: { title: 'Farmer workspace', primaryAction: 'Post a crop lot', sections: ['My crop lots', 'Buyer bids', 'Orders', 'Earnings'] },
    BUYER: { title: 'Buyer workspace', primaryAction: 'Browse crop lots', sections: ['Marketplace', 'My bids', 'Won deals', 'Orders'] },
    TRANSPORTER: { title: 'Transporter workspace', primaryAction: 'Find transport jobs', sections: ['Available jobs', 'My bids', 'Active delivery', 'Earnings'] },
  }
  response.json({ role: request.auth.role, ...workspaceByRole[request.auth.role] })
})

app.get('/api/workspace/farmer-only', requireAuth, requireRole('FARMER'), (_request, response) => {
  response.json({ message: 'Farmer-only workspace access confirmed.' })
})

app.post('/api/crop-lots', requireAuth, requireRole('FARMER'), upload.array('photos', 5), createCropLot)
app.get('/api/crop-lots', requireAuth, listCropLots)
app.get('/api/crop-lots/:id', requireAuth, getCropLot)
app.post('/api/crop-lots/:id/bids', requireAuth, requireRole('BUYER'), createBid)
app.post('/api/crop-lots/:id/bids/:bidId/accept', requireAuth, requireRole('FARMER'), acceptBid)

app.use((error, _request, response, next) => {
  if (error instanceof multer.MulterError || error.message === 'File type is not supported.') {
    return response.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Each photo must be 5 MB or smaller.' : 'Only JPG, PNG and WebP photos are supported.' })
  }
  return next(error)
})

app.get('/api/health', (_request, response) => {
  response.json({
    service: 'fasalynk-api',
    status: 'ok',
    message: 'The backend is ready for the first marketplace feature.',
  })
})

app.get('/api/health/database', async (_request, response) => {
  try {
    const currentTime = await checkDatabaseConnection()
    response.json({ service: 'postgresql', status: 'ok', currentTime })
  } catch (error) {
    response.status(503).json({
      service: 'postgresql',
      status: 'unavailable',
      message: 'Set DATABASE_URL and make sure PostgreSQL is running.',
      error: error.message,
    })
  }
})

app.listen(port, () => {
  console.log(`FASALYNK API listening on http://localhost:${port}`)
})