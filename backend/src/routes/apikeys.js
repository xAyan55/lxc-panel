import { Router } from 'express';
import { getDb } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { generateApiKey, logAudit, getClientIp } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

// Get current API key
router.get('/', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT api_key, api_key_created_at FROM users WHERE id = ?').get(req.user.id);
  res.json({
    api_key: user.api_key,
    created_at: user.api_key_created_at,
  });
});

// Generate new API key
router.post('/generate', (req, res) => {
  try {
    const db = getDb();
    const apiKey = generateApiKey();
    db.prepare("UPDATE users SET api_key = ?, api_key_created_at = datetime('now') WHERE id = ?").run(apiKey, req.user.id);
    logAudit(req.user.id, 'generate_api_key', 'user', String(req.user.id), {}, getClientIp(req));

    res.json({ api_key: apiKey });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate API key' });
  }
});

// Revoke API key
router.delete('/', (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE users SET api_key = NULL, api_key_created_at = NULL WHERE id = ?').run(req.user.id);
    logAudit(req.user.id, 'revoke_api_key', 'user', String(req.user.id), {}, getClientIp(req));

    res.json({ message: 'API key revoked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

export default router;
