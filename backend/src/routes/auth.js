import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { loginRules, registerRules, validate } from '../utils/validators.js';
import { logAudit, getClientIp } from '../utils/helpers.js';

const router = Router();
const SALT_ROUNDS = 12;

router.post('/register', authLimiter, registerRules, validate, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const db = getDb();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const result = db.prepare(
      'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)'
    ).run(email, hashedPassword, name, 'user');

    const token = jwt.sign(
      { userId: result.lastInsertRowid, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    logAudit(result.lastInsertRowid, 'register', 'user', String(result.lastInsertRowid), { email }, getClientIp(req));

    res.status(201).json({
      token,
      user: {
        id: result.lastInsertRowid,
        email,
        name,
        role: 'user',
        company_name: '',
        theme_color: '#7c3aed',
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', authLimiter, loginRules, validate, async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = getDb();

    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    logAudit(user.id, 'login', 'user', String(user.id), { email }, getClientIp(req));

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_name: user.company_name,
        theme_color: user.theme_color,
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

router.put('/me', authenticate, async (req, res) => {
  try {
    const { name, company_name, theme_color, current_password, new_password } = req.body;
    const db = getDb();
    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name); }
    if (company_name !== undefined) { updates.push('company_name = ?'); params.push(company_name); }
    if (theme_color && /^#[0-9a-fA-F]{6}$/.test(theme_color)) { updates.push('theme_color = ?'); params.push(theme_color); }

    if (new_password && current_password) {
      const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
      const isValid = await bcrypt.compare(current_password, user.password);
      if (!isValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
      const hashed = await bcrypt.hash(new_password, SALT_ROUNDS);
      updates.push('password = ?');
      params.push(hashed);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push("updated_at = datetime('now')");
    params.push(req.user.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT id, email, name, role, company_name, theme_color FROM users WHERE id = ?').get(req.user.id);
    logAudit(req.user.id, 'update_profile', 'user', String(req.user.id), {}, getClientIp(req));

    res.json({ user: updated });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

export default router;
