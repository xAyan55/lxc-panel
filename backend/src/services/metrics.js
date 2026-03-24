import lxdService from './lxd.js';
import { getDb } from '../config/database.js';

class MetricsService {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 5000;
  }

  async getContainerMetrics(containerName) {
    const cached = this.cache.get(containerName);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    const metrics = await lxdService.getContainerMetrics(containerName);
    this.cache.set(containerName, { data: metrics, timestamp: Date.now() });
    return metrics;
  }

  async getAllMetricsForUser(userId) {
    const db = getDb();
    const containers = db.prepare('SELECT * FROM containers WHERE user_id = ?').all(userId);
    const results = [];

    for (const container of containers) {
      try {
        const metrics = await this.getContainerMetrics(container.lxd_name);
        results.push({
          container_id: container.id,
          display_name: container.display_name,
          lxd_name: container.lxd_name,
          ...metrics
        });
      } catch (err) {
        results.push({
          container_id: container.id,
          display_name: container.display_name,
          lxd_name: container.lxd_name,
          status: 'error',
          error: err.message
        });
      }
    }

    return results;
  }

  async getSystemOverview() {
    const db = getDb();
    const totalContainers = db.prepare('SELECT COUNT(*) as count FROM containers').get().count;
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const runningContainers = db.prepare("SELECT COUNT(*) as count FROM containers WHERE status = 'running'").get().count;

    return {
      total_containers: totalContainers,
      running_containers: runningContainers,
      stopped_containers: totalContainers - runningContainers,
      total_users: totalUsers,
    };
  }

  clearCache(containerName) {
    if (containerName) {
      this.cache.delete(containerName);
    } else {
      this.cache.clear();
    }
  }
}

const metricsService = new MetricsService();
export default metricsService;
