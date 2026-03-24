import { Router } from 'express';
import { getDb } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import lxdService from '../services/lxd.js';
import metricsService from '../services/metrics.js';
import { createContainerRules, containerIdRule, changePasswordRules, reinstallRules, renameRules, validate } from '../utils/validators.js';
import { generateContainerName, logAudit, getClientIp } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

function canAccessContainer(req, container) {
  return req.user.role === 'admin' || container.user_id === req.user.id;
}

// List containers (filtered by user role)
router.get('/', (req, res) => {
  const db = getDb();
  let containers;

  if (req.user.role === 'admin') {
    containers = db.prepare(`
      SELECT c.*, u.email as owner_email, u.name as owner_name 
      FROM containers c JOIN users u ON c.user_id = u.id 
      ORDER BY c.created_at DESC
    `).all();
  } else {
    containers = db.prepare('SELECT * FROM containers WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  }

  res.json({ containers });
});

// Get single container
router.get('/:id', containerIdRule, validate, async (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (!canAccessContainer(req, container)) return res.status(403).json({ error: 'Access denied' });

    let lxdInfo = {};
    try {
      lxdInfo = await lxdService.getContainer(container.lxd_name);
      const newStatus = lxdInfo.status || container.status;
      if (newStatus !== container.status) {
        db.prepare('UPDATE containers SET status = ? WHERE id = ?').run(newStatus, container.id);
        container.status = newStatus;
      }
    } catch {}

    res.json({ container, lxd_info: lxdInfo });
  } catch (err) {
    console.error('Get container error:', err);
    res.status(500).json({ error: 'Failed to get container' });
  }
});

// Create container (admin only)
router.post('/', requireAdmin, createContainerRules, validate, async (req, res) => {
  try {
    const db = getDb();
    const { display_name, user_id, image = 'ubuntu:22.04', cpu_limit = 1, ram_limit = 512, disk_limit = 10 } = req.body;

    const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const userContainerCount = db.prepare('SELECT COUNT(*) as count FROM containers WHERE user_id = ?').get(user_id).count;
    if (userContainerCount >= targetUser.max_containers) {
      return res.status(400).json({ error: `User has reached container limit (${targetUser.max_containers})` });
    }

    const lxdName = generateContainerName(display_name, user_id);

    const result = db.prepare(
      'INSERT INTO containers (lxd_name, display_name, user_id, image, cpu_limit, ram_limit, disk_limit, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(lxdName, display_name, user_id, image, cpu_limit, ram_limit, disk_limit, 'creating');

    res.status(201).json({
      message: 'Container creation started',
      container: {
        id: result.lastInsertRowid,
        lxd_name: lxdName,
        display_name,
        status: 'creating',
      }
    });

    // Create container asynchronously
    (async () => {
      try {
        await lxdService.createContainer(lxdName, image, {
          cpuLimit: cpu_limit,
          ramLimit: ram_limit,
          diskLimit: disk_limit,
        });

        let ipAddress = null;
        try {
          const info = await lxdService.getContainer(lxdName);
          const list = await lxdService.listContainers();
          const match = list.find(c => c.name === lxdName);
          ipAddress = match?.ipv4 || null;
        } catch {}

        db.prepare('UPDATE containers SET status = ?, ip_address = ? WHERE id = ?').run('running', ipAddress, result.lastInsertRowid);
        logAudit(req.user.id, 'create_container', 'container', String(result.lastInsertRowid), { lxdName, image }, getClientIp(req));
      } catch (err) {
        console.error(`Failed to create container ${lxdName}:`, err);
        db.prepare('UPDATE containers SET status = ? WHERE id = ?').run('error', result.lastInsertRowid);
      }
    })();
  } catch (err) {
    console.error('Create container error:', err);
    res.status(500).json({ error: 'Failed to create container' });
  }
});

// Power actions
router.post('/:id/start', containerIdRule, validate, async (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (!canAccessContainer(req, container)) return res.status(403).json({ error: 'Access denied' });

    await lxdService.startContainer(container.lxd_name);
    db.prepare("UPDATE containers SET status = 'running' WHERE id = ?").run(container.id);
    metricsService.clearCache(container.lxd_name);
    logAudit(req.user.id, 'start_container', 'container', String(container.id), {}, getClientIp(req));

    res.json({ message: 'Container started', status: 'running' });
  } catch (err) {
    res.status(500).json({ error: `Failed to start container: ${err.message}` });
  }
});

router.post('/:id/stop', containerIdRule, validate, async (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (!canAccessContainer(req, container)) return res.status(403).json({ error: 'Access denied' });

    await lxdService.stopContainer(container.lxd_name);
    db.prepare("UPDATE containers SET status = 'stopped' WHERE id = ?").run(container.id);
    metricsService.clearCache(container.lxd_name);
    logAudit(req.user.id, 'stop_container', 'container', String(container.id), {}, getClientIp(req));

    res.json({ message: 'Container stopped', status: 'stopped' });
  } catch (err) {
    res.status(500).json({ error: `Failed to stop container: ${err.message}` });
  }
});

router.post('/:id/restart', containerIdRule, validate, async (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (!canAccessContainer(req, container)) return res.status(403).json({ error: 'Access denied' });

    await lxdService.restartContainer(container.lxd_name);
    db.prepare("UPDATE containers SET status = 'running' WHERE id = ?").run(container.id);
    metricsService.clearCache(container.lxd_name);
    logAudit(req.user.id, 'restart_container', 'container', String(container.id), {}, getClientIp(req));

    res.json({ message: 'Container restarted', status: 'running' });
  } catch (err) {
    res.status(500).json({ error: `Failed to restart container: ${err.message}` });
  }
});

router.post('/:id/kill', containerIdRule, validate, async (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (!canAccessContainer(req, container)) return res.status(403).json({ error: 'Access denied' });

    await lxdService.forceStopContainer(container.lxd_name);
    db.prepare("UPDATE containers SET status = 'stopped' WHERE id = ?").run(container.id);
    metricsService.clearCache(container.lxd_name);
    logAudit(req.user.id, 'kill_container', 'container', String(container.id), {}, getClientIp(req));

    res.json({ message: 'Container force stopped', status: 'stopped' });
  } catch (err) {
    res.status(500).json({ error: `Failed to kill container: ${err.message}` });
  }
});

// Change root password
router.post('/:id/password', changePasswordRules, validate, async (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (!canAccessContainer(req, container)) return res.status(403).json({ error: 'Access denied' });
    if (container.status !== 'running') return res.status(400).json({ error: 'Container must be running' });

    await lxdService.setRootPassword(container.lxd_name, req.body.password);
    logAudit(req.user.id, 'change_password', 'container', String(container.id), {}, getClientIp(req));

    res.json({ message: 'Root password updated' });
  } catch (err) {
    res.status(500).json({ error: `Failed to change password: ${err.message}` });
  }
});

// Reinstall OS
router.post('/:id/reinstall', reinstallRules, validate, async (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (!canAccessContainer(req, container)) return res.status(403).json({ error: 'Access denied' });

    const { image } = req.body;
    db.prepare("UPDATE containers SET status = 'reinstalling' WHERE id = ?").run(container.id);

    res.json({ message: 'Reinstall started' });

    (async () => {
      try {
        await lxdService.deleteContainer(container.lxd_name, true);
        await lxdService.createContainer(container.lxd_name, image, {
          cpuLimit: container.cpu_limit,
          ramLimit: container.ram_limit,
          diskLimit: container.disk_limit,
        });
        db.prepare("UPDATE containers SET status = 'running', image = ? WHERE id = ?").run(image, container.id);
        logAudit(req.user.id, 'reinstall_container', 'container', String(container.id), { image }, getClientIp(req));
      } catch (err) {
        console.error(`Reinstall failed for ${container.lxd_name}:`, err);
        db.prepare("UPDATE containers SET status = 'error' WHERE id = ?").run(container.id);
      }
    })();
  } catch (err) {
    res.status(500).json({ error: `Failed to reinstall: ${err.message}` });
  }
});

// Rename VPS
router.put('/:id/rename', renameRules, validate, (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (!canAccessContainer(req, container)) return res.status(403).json({ error: 'Access denied' });

    db.prepare("UPDATE containers SET display_name = ?, updated_at = datetime('now') WHERE id = ?").run(req.body.display_name, container.id);
    logAudit(req.user.id, 'rename_container', 'container', String(container.id), { new_name: req.body.display_name }, getClientIp(req));

    res.json({ message: 'Container renamed', display_name: req.body.display_name });
  } catch (err) {
    res.status(500).json({ error: 'Failed to rename' });
  }
});

// Update resource limits
router.put('/:id/limits', containerIdRule, validate, async (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const { cpu_limit, ram_limit, disk_limit } = req.body;
    const limits = {};
    const dbUpdates = [];
    const dbParams = [];

    if (cpu_limit) { limits.cpu = cpu_limit; dbUpdates.push('cpu_limit = ?'); dbParams.push(cpu_limit); }
    if (ram_limit) { limits.memory = ram_limit; dbUpdates.push('ram_limit = ?'); dbParams.push(ram_limit); }
    if (disk_limit) { limits.disk = disk_limit; dbUpdates.push('disk_limit = ?'); dbParams.push(disk_limit); }

    if (Object.keys(limits).length > 0) {
      await lxdService.setResourceLimits(container.lxd_name, limits);
    }

    if (dbUpdates.length > 0) {
      dbUpdates.push("updated_at = datetime('now')");
      dbParams.push(container.id);
      db.prepare(`UPDATE containers SET ${dbUpdates.join(', ')} WHERE id = ?`).run(...dbParams);
    }

    res.json({ message: 'Resource limits updated' });
  } catch (err) {
    res.status(500).json({ error: `Failed to update limits: ${err.message}` });
  }
});

// Delete container (admin only)
router.delete('/:id', requireAdmin, containerIdRule, validate, async (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });

    try {
      await lxdService.deleteContainer(container.lxd_name, true);
    } catch (err) {
      console.warn(`LXD delete warning for ${container.lxd_name}:`, err.message);
    }

    db.prepare('DELETE FROM containers WHERE id = ?').run(container.id);
    logAudit(req.user.id, 'delete_container', 'container', String(container.id), { lxd_name: container.lxd_name }, getClientIp(req));

    res.json({ message: 'Container deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete container' });
  }
});

// Get available images
router.get('/images/available', async (req, res) => {
  try {
    const images = await lxdService.getCommonImages();
    res.json({ images });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list images' });
  }
});

export default router;
