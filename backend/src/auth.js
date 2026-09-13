import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import { pool } from './db.js'

const jwtSecret = process.env.JWT_SECRET || 'local-development-secret'
const allowedRoles = new Set(['FARMER', 'BUYER', 'TRANSPORTER'])
const otpLifetimeMinutes = 10

function mailTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_PORT) === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  })
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex')
}

function createPasswordActionToken(userId, otpId, purpose) {
  return jwt.sign({ userId, otpId, purpose }, jwtSecret, { expiresIn: '10m' })
}

async function sendOtp(user, purpose) {
  const transport = mailTransport()
  if (!transport) throw new Error('SMTP is not configured. Add SMTP settings before requesting an email OTP.')

  const otp = String(crypto.randomInt(100000, 1000000))
  const otpHash = hashOtp(otp)
  await pool.query('UPDATE email_otps SET used_at = NOW() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL', [user.id, purpose])
  await pool.query(
    `INSERT INTO email_otps (user_id, purpose, otp_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 minute'))`,
    [user.id, purpose, otpHash, otpLifetimeMinutes],
  )

  const action = purpose === 'VERIFY_EMAIL'
    ? 'verify your FASALYNK account'
    : purpose === 'RESET_PASSWORD'
      ? 'reset your FASALYNK password'
      : 'change your FASALYNK password'
  await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: `Your FASALYNK verification code: ${otp}`,
    text: `Your code to ${action} is ${otp}. It expires in ${otpLifetimeMinutes} minutes. If you did not request this, ignore this email.`,
    html: `<p>Your FASALYNK verification code to ${action} is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${otp}</p><p>This code expires in ${otpLifetimeMinutes} minutes.</p>`,
  })
}

function createToken(user) {
  return jwt.sign({ userId: user.id, role: user.role }, jwtSecret, { expiresIn: '7d' })
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isVerified: user.is_verified,
  }
}

export async function register(request, response) {
  const { fullName, username, email, password, phone, role } = request.body
  const normalizedEmail = email?.trim().toLowerCase()
  const normalizedUsername = username?.trim().toLowerCase()
  const normalizedRole = role?.trim().toUpperCase()

  if (!fullName?.trim() || !normalizedUsername || !normalizedEmail || !password || !allowedRoles.has(normalizedRole)) {
    return response.status(400).json({ message: 'Full name, username, email, password and a valid role are required.' })
  }

  if (!/^[a-z0-9_]{3,40}$/.test(normalizedUsername)) {
    return response.status(400).json({ message: 'Username must be 3-40 characters using only letters, numbers or underscores.' })
  }

  if (password.length < 8) {
    return response.status(400).json({ message: 'Password must contain at least 8 characters.' })
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12)
    const result = await pool.query(
      `INSERT INTO users (full_name, username, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, full_name, username, email, phone, role, is_verified`,
      [fullName.trim(), normalizedUsername, normalizedEmail, phone?.trim() || null, passwordHash, normalizedRole],
    )
    const user = result.rows[0]
    await sendOtp(user, 'VERIFY_EMAIL')
    return response.status(201).json({ message: 'Account created. Check your email for a verification code.', verificationRequired: true, email: user.email })
  } catch (error) {
    if (error.code !== '23505') {
      const emailToRemove = normalizedEmail
      await pool.query('DELETE FROM users WHERE email = $1 AND is_verified = FALSE', [emailToRemove]).catch(() => {})
    }
    if (error.code === '23505') {
      return response.status(409).json({ message: 'That username or email is already in use.' })
    }
    if (error.message?.includes('SMTP is not configured') || error.code === 'ESOCKET' || error.code === 'EAUTH') {
      return response.status(503).json({ message: 'Account email verification is not configured or is unavailable.' })
    }
    console.error(error)
    return response.status(500).json({ message: 'Could not create the account.' })
  }
}

export async function login(request, response) {
  const { identifier, email, password } = request.body
  const normalizedIdentifier = (identifier || email)?.trim().toLowerCase()

  if (!normalizedIdentifier || !password) {
    return response.status(400).json({ message: 'Username or email and password are required.' })
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 OR username = $1', [normalizedIdentifier])
    const user = result.rows[0]
    if (user && !user.is_verified) {
      return response.status(403).json({ message: 'Verify your email before signing in.' })
    }
    const passwordMatches = user && await bcrypt.compare(password, user.password_hash)

    if (!passwordMatches) {
      return response.status(401).json({ message: 'Email or password is incorrect.' })
    }

    return response.json({ user: publicUser(user), token: createToken(user) })
  } catch (error) {
    console.error(error)
    return response.status(500).json({ message: 'Could not sign in right now.' })
  }
}

export async function verifyRegistrationOtp(request, response) {
  const { email, otp } = request.body
  const normalizedEmail = email?.trim().toLowerCase()
  if (!normalizedEmail || !/^\d{6}$/.test(otp || '')) return response.status(400).json({ message: 'Email and a 6-digit code are required.' })

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1 AND is_verified = FALSE', [normalizedEmail])
    const user = userResult.rows[0]
    if (!user) return response.status(400).json({ message: 'The code is invalid or the account is already verified.' })
    const otpResult = await pool.query("SELECT id FROM email_otps WHERE user_id = $1 AND purpose = 'VERIFY_EMAIL' AND otp_hash = $2 AND used_at IS NULL AND verified_at IS NULL AND expires_at > NOW() AND attempts < 5", [user.id, hashOtp(otp)])
    const record = otpResult.rows[0]
    if (!record) {
      await pool.query("UPDATE email_otps SET attempts = attempts + 1 WHERE user_id = $1 AND purpose = 'VERIFY_EMAIL' AND used_at IS NULL", [user.id])
      return response.status(400).json({ message: 'The code is invalid or expired.' })
    }
    await pool.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [user.id])
    await pool.query('UPDATE email_otps SET verified_at = NOW(), used_at = NOW() WHERE id = $1', [record.id])
    return response.json({ message: 'Email verified successfully.', user: publicUser({ ...user, is_verified: true }), token: createToken({ ...user, is_verified: true }) })
  } catch (error) {
    console.error(error)
    return response.status(500).json({ message: 'Could not verify the account.' })
  }
}

export async function requestPasswordReset(request, response) {
  const normalizedEmail = request.body.email?.trim().toLowerCase()
  const genericMessage = 'If an account uses that email, a verification code has been sent.'

  if (!normalizedEmail) return response.status(400).json({ message: 'Email is required.' })

  try {
    const userResult = await pool.query('SELECT id, email, full_name FROM users WHERE email = $1', [normalizedEmail])
    const user = userResult.rows[0]
    if (!user) return response.json({ message: genericMessage })

    await sendOtp(user, 'RESET_PASSWORD')
    return response.json({ message: genericMessage })
  } catch (error) {
    console.error(error)
    return response.status(503).json({ message: 'Email delivery is not configured or is unavailable.' })
  }
}

export async function verifyResetOtp(request, response) {
  const { email, otp } = request.body
  const normalizedEmail = email?.trim().toLowerCase()
  if (!normalizedEmail || !/^\d{6}$/.test(otp || '')) return response.status(400).json({ message: 'Email and a 6-digit code are required.' })

  try {
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail])
    const user = userResult.rows[0]
    if (!user) return response.status(400).json({ message: 'The code is invalid or expired.' })
    const otpResult = await pool.query(
      `SELECT id FROM email_otps WHERE user_id = $1 AND purpose = 'RESET_PASSWORD'
       AND otp_hash = $2 AND used_at IS NULL AND verified_at IS NULL
       AND expires_at > NOW() AND attempts < 5`,
      [user.id, hashOtp(otp)],
    )
    const record = otpResult.rows[0]
    if (!record) {
      await pool.query("UPDATE email_otps SET attempts = attempts + 1 WHERE user_id = $1 AND purpose = 'RESET_PASSWORD' AND used_at IS NULL", [user.id])
      return response.status(400).json({ message: 'The code is invalid or expired.' })
    }
    await pool.query('UPDATE email_otps SET verified_at = NOW() WHERE id = $1', [record.id])
    return response.json({ resetToken: createPasswordActionToken(user.id, record.id, 'RESET_PASSWORD') })
  } catch (error) {
    console.error(error)
    return response.status(500).json({ message: 'Could not verify the code.' })
  }
}

export async function resetPassword(request, response) {
  const { resetToken, newPassword } = request.body
  if (!resetToken || !newPassword || newPassword.length < 8) return response.status(400).json({ message: 'A verified reset code and a password of at least 8 characters are required.' })

  try {
    const action = jwt.verify(resetToken, jwtSecret)
    if (action.purpose !== 'RESET_PASSWORD') return response.status(400).json({ message: 'This reset permission is invalid.' })
    const tokenResult = await pool.query("SELECT id, user_id FROM email_otps WHERE id = $1 AND user_id = $2 AND purpose = 'RESET_PASSWORD' AND verified_at IS NOT NULL AND used_at IS NULL AND expires_at > NOW()", [action.otpId, action.userId])
    const reset = tokenResult.rows[0]
    if (!reset) return response.status(400).json({ message: 'This reset permission is invalid or expired.' })

    const passwordHash = await bcrypt.hash(newPassword, 12)
    const userResult = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, full_name, username, email, phone, role, is_verified',
      [passwordHash, reset.user_id],
    )
    await pool.query('UPDATE email_otps SET used_at = NOW() WHERE id = $1', [reset.id])
    const user = userResult.rows[0]
    return response.json({ message: 'Password reset successfully.', user: publicUser(user), token: createToken(user) })
  } catch (error) {
    return response.status(400).json({ message: 'This reset permission is invalid or expired.' })
  }
}

export async function requestChangePasswordOtp(request, response) {
  try {
    const result = await pool.query('SELECT id, email, full_name FROM users WHERE id = $1', [request.auth.userId])
    if (!result.rows[0]) return response.status(404).json({ message: 'User account not found.' })
    await sendOtp(result.rows[0], 'CHANGE_PASSWORD')
    return response.json({ message: 'A verification code was sent to your email.' })
  } catch (error) {
    console.error(error)
    return response.status(503).json({ message: 'Email delivery is not configured or is unavailable.' })
  }
}

export async function verifyChangePasswordOtp(request, response) {
  const { otp } = request.body
  if (!/^\d{6}$/.test(otp || '')) return response.status(400).json({ message: 'A 6-digit code is required.' })
  try {
    const result = await pool.query("SELECT id FROM email_otps WHERE user_id = $1 AND purpose = 'CHANGE_PASSWORD' AND otp_hash = $2 AND used_at IS NULL AND verified_at IS NULL AND expires_at > NOW() AND attempts < 5", [request.auth.userId, hashOtp(otp)])
    const record = result.rows[0]
    if (!record) return response.status(400).json({ message: 'The code is invalid or expired.' })
    await pool.query('UPDATE email_otps SET verified_at = NOW() WHERE id = $1', [record.id])
    return response.json({ changeToken: createPasswordActionToken(request.auth.userId, record.id, 'CHANGE_PASSWORD') })
  } catch (error) {
    console.error(error)
    return response.status(500).json({ message: 'Could not verify the code.' })
  }
}

export async function changePassword(request, response) {
  const { changeToken, newPassword } = request.body
  if (!changeToken || !newPassword || newPassword.length < 8) return response.status(400).json({ message: 'A verified email code and a password of at least 8 characters are required.' })
  try {
    const action = jwt.verify(changeToken, jwtSecret)
    if (action.purpose !== 'CHANGE_PASSWORD' || action.userId !== request.auth.userId) return response.status(400).json({ message: 'This change permission is invalid.' })
    const result = await pool.query("SELECT id, user_id FROM email_otps WHERE id = $1 AND user_id = $2 AND purpose = 'CHANGE_PASSWORD' AND verified_at IS NOT NULL AND used_at IS NULL AND expires_at > NOW()", [action.otpId, request.auth.userId])
    if (!result.rows[0]) return response.status(400).json({ message: 'This change permission is invalid or expired.' })
    const passwordHash = await bcrypt.hash(newPassword, 12)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, request.auth.userId])
    await pool.query('UPDATE email_otps SET used_at = NOW() WHERE id = $1', [action.otpId])
    return response.json({ message: 'Password changed successfully.' })
  } catch {
    return response.status(400).json({ message: 'This change permission is invalid or expired.' })
  }
}

export function requireAuth(request, response, next) {
  const authorization = request.headers.authorization
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null

  if (!token) {
    return response.status(401).json({ message: 'A login token is required.' })
  }

  try {
    request.auth = jwt.verify(token, jwtSecret)
    return next()
  } catch {
    return response.status(401).json({ message: 'Your login session has expired.' })
  }
}

export function requireRole(...roles) {
  return (request, response, next) => {
    if (!request.auth || !roles.includes(request.auth.role)) {
      return response.status(403).json({ message: 'Your role cannot access this area.' })
    }
    return next()
  }
}

export async function getCurrentUser(request, response) {
  try {
    const result = await pool.query(
      'SELECT id, full_name, username, email, phone, role, is_verified FROM users WHERE id = $1',
      [request.auth.userId],
    )
    const user = result.rows[0]
    if (!user) return response.status(404).json({ message: 'User account not found.' })
    return response.json({ user: publicUser(user) })
  } catch (error) {
    console.error(error)
    return response.status(500).json({ message: 'Could not load your account.' })
  }
}