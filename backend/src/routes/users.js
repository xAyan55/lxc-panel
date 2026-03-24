import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { createUserRules, updateUserRules, validate } from '../utils/validators.js';
import { logAudit, getClientIp } from '../utils/helpers.js';

const router = Router();
const SALT_ROUNDS = 12;

router.use(authenticate);
router.use(requireAdmin);

router.get('/', (req, res) => {
  const db = getDb();
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 25, 100);
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  let whereClause = '';
  const params = [];

  if (search) {
    whereClause = 'WHERE email LIKE ? OR name LIKE ?';
    params.push(`%${search}%`, `%${search}%`);
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM users ${whereClause}`).get(...params).count;
  const users = db.prepare(`
    SELECT id, email, name, role, company_name, theme_color, max_containers, is_active, created_at, updated_at 
    FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const usersWithContainerCount = users.map(u => {
    const count = db.prepare('SELECT COUNT(*) as count FROM containers WHERE user_id = ?').get(u.id).count;
    return { ...u, container_count: count };
  });

  res.json({
    users: usersWithContainerCount,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, email, name, role, company_name, theme_color, max_containers, is_active, created_at, updated_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const containers = db.prepare('SELECT id, lxd_name, display_name, status, image, created_at FROM containers WHERE user_id = ?').all(user.id);
  res.json({ user, containers });
});

router.post('/', createUserRules, validate, async (req, res) => {
  try {
    const { email, password, name, role = 'user', max_containers = 3 } = req.body;
    const db = getDb();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const result = db.prepare(
      'INSERT INTO users (email, password, name, role, max_containers) VALUES (?, ?, ?, ?, ?)'
    ).run(email, hashedPassword, name, role, max_containers);

    logAudit(req.user.id, 'create_user', 'user', String(result.lastInsertRowid), { email, role }, getClientIp(req));

    const user = db.prepare('SELECT id, email, name, role, max_containers, is_active, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ user });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/:id', updateUserRules, validate, async (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { email, name, role, max_containers, company_name, theme_color, is_active, password } = req.body;
    const updates = [];
    const params = [];

    if (email && email !== user.email) {
      const dup = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, user.id);
      if (dup) return res.status(409).json({ error: 'Email already in use' });
      updates.push('email = ?'); params.push(email);
    }
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (max_containers !== undefined) { updates.push('max_containers = ?'); params.push(max_containers); }
    if (company_name !== undefined) { updates.push('company_name = ?'); params.push(company_name); }
    if (theme_color !== undefined) { updates.push('theme_color = ?'); params.push(theme_color); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (password) {
      const hashed = await bcrypt.hash(password, SALT_ROUNDS);
      updates.push('password = ?'); params.push(hashed);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push("updated_at = datetime('now')");
    params.push(user.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    logAudit(req.user.id, 'update_user', 'user', String(user.id), { fields: Object.keys(req.body) }, getClientIp(req));

    const updated = db.prepare('SELECT id, email, name, role, company_name, theme_color, max_containers, is_active, created_at, updated_at FROM users WHERE id = ?').get(user.id);
    res.json({ user: updated });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });

    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
    if (user.role === 'admin' && adminCount <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last admin' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    logAudit(req.user.id, 'delete_user', 'user', String(user.id), { email: user.email }, getClientIp(req));

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
