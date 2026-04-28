/**
 * auth.js
 * Token-based authentication middleware.
 * Token dibaca dari header Authorization: Bearer <token>
 * atau query param ?token=<token>
 */

export function authenticate(req, res, next) {
  const envToken = process.env.TOKEN_ACCESS

  if (!envToken) {
    console.warn('⚠️  TOKEN_ACCESS not set in .env — all requests are rejected')
    return res.status(500).json({ status: false, message: 'Server misconfiguration: TOKEN_ACCESS not set' })
  }

  // Support: Authorization: Bearer <token>  OR  ?token=<token>
  const authHeader = req.headers['authorization']
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const queryToken = req.query.token

  const provided = bearerToken || queryToken

  if (!provided) {
    return res.status(401).json({ status: false, message: 'Unauthorized: token required' })
  }

  if (provided !== envToken) {
    return res.status(403).json({ status: false, message: 'Forbidden: invalid token' })
  }

  next()
}
