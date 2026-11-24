/**
 * Authentication Endpoints: Register, Login, Current User Profile.
 */

const express = require('express');
const router = express.Router();
const { db, HashPassword, VerifyPassword } = require('../database');
const { GenerateToken, RequireAuth } = require('../auth');

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { email, password, full_name } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Missing Required Fields: email, password, full_name' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'User With This Email Already Exists' });
  }

  const { hash, salt } = HashPassword(password);
  const result = db.prepare(`
    INSERT INTO users (email, password_hash, salt, full_name, role)
    VALUES (?, ?, ?, ?, 'user')
  `).run(normalizedEmail, hash, salt, full_name.trim());

  const user = {
    id: Number(result.lastInsertRowid),
    email: normalizedEmail,
    full_name: full_name.trim(),
    role: 'user',
  };

  const token = GenerateToken({ userId: user.id, email: user.email, role: user.role });
  return res.status(201).json({
    message: 'User Registered Successfully',
    user,
    token,
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing Required Fields: email, password' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare('SELECT id, email, password_hash, salt, full_name, role FROM users WHERE email = ?').get(normalizedEmail);
  if (!user || !VerifyPassword(password, user.password_hash, user.salt)) {
    return res.status(401).json({ error: 'Invalid Email Or Password' });
  }

  const token = GenerateToken({ userId: user.id, email: user.email, role: user.role });
  return res.json({
    message: 'Login Successful',
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    },
    token,
  });
});

// GET /api/auth/me
router.get('/me', RequireAuth, (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
