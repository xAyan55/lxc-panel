import cron from 'node-cron';
import { getDb } from '../config/database.js';
import lxdService from './lxd.js';
import { generateSnapshotName } from '../utils/helpers.js';

class BackupScheduler {
  constructor() {
    this.jobs = new Map();
  }

  init() {
    const db = getDb();
    const schedules = db.prepare(`
      SELECT bs.*, c.lxd_name 
      FROM backup_schedules bs 
      JOIN containers c ON bs.container_id = c.id 
      WHERE bs.is_active = 1
    `).all();

    for (const schedule of schedules) {
      this.addJob(schedule);
    }

    console.log(`[Backup] Initialized ${schedules.length} scheduled backup jobs`);
  }

  addJob(schedule) {
    if (this.jobs.has(schedule.container_id)) {
      this.removeJob(schedule.container_id);
    }

    if (!cron.validate(schedule.cron_expression)) {
      console.error(`[Backup] Invalid cron expression for container ${schedule.container_id}: ${schedule.cron_expression}`);
      return;
    }

    const job = cron.schedule(schedule.cron_expression, async () => {
      await this.runBackup(schedule.container_id, schedule.lxd_name, schedule.max_keep);
    });

    this.jobs.set(schedule.container_id, job);
    console.log(`[Backup] Scheduled backup for container ${schedule.container_id} (${schedule.cron_expression})`);
  }

  removeJob(containerId) {
    const job = this.jobs.get(containerId);
    if (job) {
      job.stop();
      this.jobs.delete(containerId);
    }
  }

  async runBackup(containerId, lxdName, maxKeep = 5) {
    const db = getDb();
    const snapshotName = generateSnapshotName('scheduled');

    const backupRecord = db.prepare(
      'INSERT INTO backups (container_id, snapshot_name, type, status) VALUES (?, ?, ?, ?)'
    ).run(containerId, snapshotName, 'scheduled', 'pending');

    try {
      await lxdService.createSnapshot(lxdName, snapshotName);

      db.prepare('UPDATE backups SET status = ? WHERE id = ?').run('completed', backupRecord.lastInsertRowid);
      db.prepare('UPDATE backup_schedules SET last_run = datetime(\'now\') WHERE container_id = ?').run(containerId);

      console.log(`[Backup] Completed scheduled backup: ${lxdName}/${snapshotName}`);

      await this.cleanOldBackups(containerId, lxdName, maxKeep);
    } catch (err) {
      db.prepare('UPDATE backups SET status = ? WHERE id = ?').run('failed', backupRecord.lastInsertRowid);
      console.error(`[Backup] Failed scheduled backup for ${lxdName}:`, err.message);
    }
  }

  async cleanOldBackups(containerId, lxdName, maxKeep) {
    const db = getDb();
    const backups = db.prepare(
      'SELECT * FROM backups WHERE container_id = ? AND type = ? AND status = ? ORDER BY created_at DESC'
    ).all(containerId, 'scheduled', 'completed');

    if (backups.length > maxKeep) {
      const toRemove = backups.slice(maxKeep);
      for (const backup of toRemove) {
        try {
          await lxdService.deleteSnapshot(lxdName, backup.snapshot_name);
          db.prepare('DELETE FROM backups WHERE id = ?').run(backup.id);
          console.log(`[Backup] Cleaned old backup: ${lxdName}/${backup.snapshot_name}`);
        } catch (err) {
          console.warn(`[Backup] Failed to clean backup ${backup.snapshot_name}:`, err.message);
        }
      }
    }
  }

  stopAll() {
    for (const [id, job] of this.jobs) {
      job.stop();
    }
    this.jobs.clear();
  }
}

const backupScheduler = new BackupScheduler();
export default backupScheduler;
