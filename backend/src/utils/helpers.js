import crypto from 'crypto';
import { getDb } from '../config/database.js';

export function generateApiKey() {
  return 'vmp_' + crypto.randomBytes(32).toString('hex');
}

export function generateSnapshotName(prefix = 'backup') {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  return `${prefix}-${ts}`;
}

export function generateContainerName(displayName, userId) {
  const slug = displayName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const suffix = crypto.randomBytes(3).toString('hex');
  return `vps-${userId}-${slug}-${suffix}`.substring(0, 50);
}

export function logAudit(userId, action, targetType, targetId, details, ipAddress) {
  try {
    const db = getDb();
    db.prepare(
      'INSERT INTO audit_log (user_id, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, action, targetType, targetId, JSON.stringify(details), ipAddress);
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function parseMemoryString(str) {
  if (!str) return 0;
  const match = str.match(/^(\d+(?:\.\d+)?)\s*(B|KB|KiB|MB|MiB|GB|GiB|TB|TiB)?$/i);
  if (!match) return parseInt(str) || 0;
  const num = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();
  const multipliers = { B: 1, KB: 1024, KIB: 1024, MB: 1048576, MIB: 1048576, GB: 1073741824, GIB: 1073741824, TB: 1099511627776, TIB: 1099511627776 };
  return Math.round(num * (multipliers[unit] || 1));
}

export function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
}
