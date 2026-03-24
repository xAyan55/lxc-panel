import { Router } from 'express';
import { getDb } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import metricsService from '../services/metrics.js';

const router = Router();
router.use(authenticate);

// Get metrics for a specific container
router.get('/container/:id', async (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (req.user.role !== 'admin' && container.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const metrics = await metricsService.getContainerMetrics(container.lxd_name);
    res.json({ metrics });
  } catch (err) {
    res.status(500).json({ error: `Failed to get metrics: ${err.message}` });
  }
});

// Get all container metrics for current user
router.get('/user', async (req, res) => {
  try {
    const metrics = await metricsService.getAllMetricsForUser(req.user.id);
    res.json({ metrics });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Get system overview (admin)
router.get('/overview', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const overview = await metricsService.getSystemOverview();
    res.json({ overview });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get overview' });
  }
});

export default router;
