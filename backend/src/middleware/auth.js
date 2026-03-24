import jwt from 'jsonwebtoken';
import { getDb } from '../config/database.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];

  if (apiKey) {
    const db = getDb();
    const user = db.prepare('SELECT id, email, name, role, company_name, theme_color, is_active FROM users WHERE api_key = ? AND is_active = 1').get(apiKey);
    if (!user) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    req.user = user;
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT id, email, name, role, company_name, theme_color, is_active FROM users WHERE id = ? AND is_active = 1').get(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function authenticateWs(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDb();
    return db.prepare('SELECT id, email, name, role, is_active FROM users WHERE id = ? AND is_active = 1').get(decoded.userId);
  } catch {
    return null;
  }
}
