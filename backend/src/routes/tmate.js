import { Router } from 'express';
import { getDb } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import lxdService from '../services/lxd.js';

const router = Router();
router.use(authenticate);

function canAccessContainer(req, container) {
  return req.user.role === 'admin' || container.user_id === req.user.id;
}

// Check if tmate is installed
router.get('/:id/status', async (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (!canAccessContainer(req, container)) return res.status(403).json({ error: 'Access denied' });
    if (container.status !== 'running') return res.status(400).json({ error: 'Container must be running' });

    const installed = await lxdService.isTmateInstalled(container.lxd_name);
    res.json({ installed });
  } catch (err) {
    res.status(500).json({ error: `Failed to check tmate: ${err.message}` });
  }
});

// Install tmate
router.post('/:id/install', async (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (!canAccessContainer(req, container)) return res.status(403).json({ error: 'Access denied' });
    if (container.status !== 'running') return res.status(400).json({ error: 'Container must be running' });

    await lxdService.installTmate(container.lxd_name);
    res.json({ message: 'tmate installed successfully' });
  } catch (err) {
    res.status(500).json({ error: `Failed to install tmate: ${err.message}` });
  }
});

// Start tmate session
router.post('/:id/start', async (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (!canAccessContainer(req, container)) return res.status(403).json({ error: 'Access denied' });
    if (container.status !== 'running') return res.status(400).json({ error: 'Container must be running' });

    const sessions = await lxdService.startTmateSession(container.lxd_name);
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: `Failed to start tmate: ${err.message}` });
  }
});

// Stop tmate session
router.post('/:id/stop', async (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (!canAccessContainer(req, container)) return res.status(403).json({ error: 'Access denied' });

    await lxdService.stopTmateSession(container.lxd_name);
    res.json({ message: 'tmate session stopped' });
  } catch (err) {
    res.status(500).json({ error: `Failed to stop tmate: ${err.message}` });
  }
});

export default router;
