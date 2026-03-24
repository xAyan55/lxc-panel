import { Router } from 'express';
import { getDb } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import lxdService from '../services/lxd.js';
import backupScheduler from '../services/backup.js';
import { containerIdRule, backupScheduleRules, validate } from '../utils/validators.js';
import { generateSnapshotName, logAudit, getClientIp } from '../utils/helpers.js';

const router = Router();
router.use(authenticate);

function canAccessContainer(req, container) {
  return req.user.role === 'admin' || container.user_id === req.user.id;
}

// List backups for a container
router.get('/:id', containerIdRule, validate, (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (!canAccessContainer(req, container)) return res.status(403).json({ error: 'Access denied' });

    const backups = db.prepare('SELECT * FROM backups WHERE container_id = ? ORDER BY created_at DESC').all(container.id);
    const schedule = db.prepare('SELECT * FROM backup_schedules WHERE container_id = ?').get(container.id);

    res.json({ backups, schedule });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

// Create manual backup
router.post('/:id', containerIdRule, validate, async (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (!canAccessContainer(req, container)) return res.status(403).json({ error: 'Access denied' });

    const snapshotName = generateSnapshotName('manual');

    const result = db.prepare(
      'INSERT INTO backups (container_id, snapshot_name, type, status) VALUES (?, ?, ?, ?)'
    ).run(container.id, snapshotName, 'manual', 'pending');

    res.status(201).json({ message: 'Backup started', backup_id: result.lastInsertRowid, snapshot_name: snapshotName });

    (async () => {
      try {
        await lxdService.createSnapshot(container.lxd_name, snapshotName);
        db.prepare('UPDATE backups SET status = ? WHERE id = ?').run('completed', result.lastInsertRowid);
        logAudit(req.user.id, 'create_backup', 'backup', String(result.lastInsertRowid), { container: container.lxd_name, snapshot: snapshotName }, getClientIp(req));
      } catch (err) {
        db.prepare('UPDATE backups SET status = ? WHERE id = ?').run('failed', result.lastInsertRowid);
        console.error(`Backup failed for ${container.lxd_name}:`, err.message);
      }
    })();
  } catch (err) {
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// Restore backup
router.post('/:id/restore/:backupId', async (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (!canAccessContainer(req, container)) return res.status(403).json({ error: 'Access denied' });

    const backup = db.prepare('SELECT * FROM backups WHERE id = ? AND container_id = ?').get(req.params.backupId, container.id);
    if (!backup) return res.status(404).json({ error: 'Backup not found' });
    if (backup.status !== 'completed') return res.status(400).json({ error: 'Backup is not in completed state' });

    db.prepare('UPDATE backups SET status = ? WHERE id = ?').run('restoring', backup.id);
    res.json({ message: 'Restore started' });

    (async () => {
      try {
        await lxdService.restoreSnapshot(container.lxd_name, backup.snapshot_name);
        db.prepare('UPDATE backups SET status = ? WHERE id = ?').run('completed', backup.id);
        logAudit(req.user.id, 'restore_backup', 'backup', String(backup.id), { container: container.lxd_name }, getClientIp(req));
      } catch (err) {
        db.prepare('UPDATE backups SET status = ? WHERE id = ?').run('completed', backup.id);
        console.error(`Restore failed:`, err.message);
      }
    })();
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// Delete backup
router.delete('/:id/:backupId', async (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (!canAccessContainer(req, container)) return res.status(403).json({ error: 'Access denied' });

    const backup = db.prepare('SELECT * FROM backups WHERE id = ? AND container_id = ?').get(req.params.backupId, container.id);
    if (!backup) return res.status(404).json({ error: 'Backup not found' });

    try {
      await lxdService.deleteSnapshot(container.lxd_name, backup.snapshot_name);
    } catch {}

    db.prepare('DELETE FROM backups WHERE id = ?').run(backup.id);
    logAudit(req.user.id, 'delete_backup', 'backup', String(backup.id), {}, getClientIp(req));

    res.json({ message: 'Backup deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete backup' });
  }
});

// Manage backup schedule
router.put('/:id/schedule', backupScheduleRules, validate, (req, res) => {
  try {
    const db = getDb();
    const container = db.prepare('SELECT * FROM containers WHERE id = ?').get(req.params.id);
    if (!container) return res.status(404).json({ error: 'Container not found' });
    if (!canAccessContainer(req, container)) return res.status(403).json({ error: 'Access denied' });

    const { cron_expression = '0 2 * * *', max_keep = 5, is_active = true } = req.body;

    const existing = db.prepare('SELECT * FROM backup_schedules WHERE container_id = ?').get(container.id);

    if (existing) {
      db.prepare(
        'UPDATE backup_schedules SET cron_expression = ?, max_keep = ?, is_active = ? WHERE container_id = ?'
      ).run(cron_expression, max_keep, is_active ? 1 : 0, container.id);
    } else {
      db.prepare(
        'INSERT INTO backup_schedules (container_id, cron_expression, max_keep, is_active) VALUES (?, ?, ?, ?)'
      ).run(container.id, cron_expression, max_keep, is_active ? 1 : 0);
    }

    if (is_active) {
      backupScheduler.addJob({ container_id: container.id, lxd_name: container.lxd_name, cron_expression, max_keep });
    } else {
      backupScheduler.removeJob(container.id);
    }

    res.json({ message: 'Backup schedule updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

export default router;
