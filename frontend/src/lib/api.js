const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('fasalynk_token')
  const isFormData = options.body instanceof FormData
  const headers = { ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
  const response = await fetch(`${apiBase}${path}`, { ...options, headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Something went wrong.')
  return data
}

export function saveSession(data) {
  localStorage.setItem('fasalynk_token', data.token)
  localStorage.setItem('fasalynk_user', JSON.stringify(data.user))
}

export function clearSession() {
  localStorage.removeItem('fasalynk_token')
  localStorage.removeItem('fasalynk_user')
}

export function readSession() {
  const storedUser = localStorage.getItem('fasalynk_user')
  if (!storedUser || storedUser === 'undefined' || storedUser === 'null') return null
  try {
    return JSON.parse(storedUser)
  } catch {
    clearSession()
    return null
  }
}
