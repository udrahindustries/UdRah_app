/**
 * Authentication & Security Token Management Service.
 * Implements HMAC SHA-256 Standard JWT Generation, Verification,
 * And Express AuthGuard Middleware.
 */

const crypto = require('node:crypto');
const { db } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'AirRoute-Secret-Key-Delhi-NCR-2026';

function Base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function Base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString('utf8');
}

function GenerateToken(payload, expiresInSeconds = 86400 * 7) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };

  const encodedHeader = Base64UrlEncode(JSON.stringify(header));
  const encodedPayload = Base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function VerifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(Base64UrlDecode(encodedPayload));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

function RequireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing Or Malformed Authorization Header' });
  }

  const token = authHeader.split(' ')[1];
  const payload = VerifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Or Expired Token' });
  }

  const user = db.prepare('SELECT id, email, full_name, role FROM users WHERE id = ?').get(payload.userId);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: User Account Not Found' });
  }

  req.user = user;
  next();
}

function OptionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const payload = VerifyToken(token);
    if (payload) {
      const user = db.prepare('SELECT id, email, full_name, role FROM users WHERE id = ?').get(payload.userId);
      if (user) req.user = user;
    }
  }
  next();
}

module.exports = {
  GenerateToken,
  VerifyToken,
  RequireAuth,
  OptionalAuth,
};
