import { execFile, spawn } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * LXD Service - Interfaces with LXD via CLI commands.
 * Uses `lxc` CLI for reliability across all LXD versions.
 */
class LxdService {
  constructor() {
    this.ready = false;
  }

  async init() {
    try {
      await this.exec('lxc', ['version']);
      this.ready = true;
      console.log('[LXD] Service initialized successfully');
    } catch (err) {
      console.error('[LXD] Failed to initialize:', err.message);
      console.error('[LXD] Make sure LXD is installed and initialized (run: lxd init)');
      this.ready = false;
    }
  }

  async exec(cmd, args, options = {}) {
    const timeout = options.timeout || 120000;
    try {
      const { stdout, stderr } = await execFileAsync(cmd, args, {
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        ...options,
      });
      return { stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (err) {
      const message = err.stderr?.trim() || err.message;
      throw new Error(`LXD command failed: ${message}`);
    }
  }

  // ─── Container Lifecycle ────────────────────────────────

  async createContainer(name, image, config = {}) {
    const args = ['launch', image, name];

    if (config.cpuLimit) {
      args.push('-c', `limits.cpu=${config.cpuLimit}`);
    }
    if (config.ramLimit) {
      args.push('-c', `limits.memory=${config.ramLimit}MB`);
    }

    await this.exec('lxc', args, { timeout: 300000 });

    if (config.diskLimit) {
      try {
        await this.exec('lxc', ['config', 'device', 'set', name, 'root', `size=${config.diskLimit}GB`]);
      } catch (e) {
        console.warn(`[LXD] Could not set disk limit for ${name}:`, e.message);
      }
    }

    return this.getContainer(name);
  }

  async deleteContainer(name, force = true) {
    try {
      await this.stopContainer(name).catch(() => {});
    } catch {}
    const args = ['delete', name];
    if (force) args.push('--force');
    await this.exec('lxc', args);
  }

  async startContainer(name) {
    await this.exec('lxc', ['start', name]);
  }

  async stopContainer(name) {
    await this.exec('lxc', ['stop', name], { timeout: 60000 });
  }

  async restartContainer(name) {
    await this.exec('lxc', ['restart', name], { timeout: 60000 });
  }

  async forceStopContainer(name) {
    await this.exec('lxc', ['stop', name, '--force']);
  }

  // ─── Container Info ─────────────────────────────────────

  async getContainer(name) {
    const { stdout } = await this.exec('lxc', ['info', name]);
    return this.parseContainerInfo(stdout, name);
  }

  async listContainers() {
    const { stdout } = await this.exec('lxc', ['list', '--format', 'json']);
    try {
      const containers = JSON.parse(stdout);
      return containers.map(c => ({
        name: c.name,
        status: c.status?.toLowerCase() || 'unknown',
        type: c.type,
        ipv4: this.extractIp(c, 'inet'),
        ipv6: this.extractIp(c, 'inet6'),
        created_at: c.created_at,
      }));
    } catch {
      return [];
    }
  }

  async getContainerState(name) {
    const { stdout } = await this.exec('lxc', ['info', name, '--resources']);
    return this.parseContainerInfo(stdout, name);
  }

  extractIp(container, family) {
    if (!container.state?.network) return null;
    for (const [iface, data] of Object.entries(container.state.network)) {
      if (iface === 'lo') continue;
      const addr = data.addresses?.find(a => a.family === family && a.scope === 'global');
      if (addr) return addr.address;
    }
    return null;
  }

  parseContainerInfo(output, name) {
    const lines = output.split('\n');
    const info = { name, raw: output };

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('Status:')) {
        info.status = trimmed.split(':')[1]?.trim().toLowerCase() || 'unknown';
      } else if (trimmed.startsWith('Type:')) {
        info.type = trimmed.split(':')[1]?.trim();
      } else if (trimmed.startsWith('Architecture:')) {
        info.architecture = trimmed.split(':')[1]?.trim();
      } else if (trimmed.startsWith('PID:')) {
        info.pid = parseInt(trimmed.split(':')[1]?.trim()) || 0;
      } else if (trimmed.startsWith('Created:')) {
        info.created_at = trimmed.split(':').slice(1).join(':').trim();
      } else if (trimmed.startsWith('Memory (current):')) {
        info.memory_current = trimmed.split(':')[1]?.trim();
      } else if (trimmed.startsWith('Memory (peak):')) {
        info.memory_peak = trimmed.split(':')[1]?.trim();
      } else if (trimmed.startsWith('CPU usage (in seconds):')) {
        info.cpu_seconds = parseFloat(trimmed.split(':')[1]?.trim()) || 0;
      } else if (trimmed.startsWith('Disk usage:')) {
        info.disk_usage = trimmed.split(':')[1]?.trim();
      }
    }
    return info;
  }

  // ─── Container Configuration ────────────────────────────

  async setRootPassword(name, password) {
    const proc = spawn('lxc', ['exec', name, '--', 'bash', '-c', `echo "root:${password}" | chpasswd`]);
    return new Promise((resolve, reject) => {
      let stderr = '';
      proc.stderr.on('data', d => stderr += d);
      proc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`Failed to set password: ${stderr}`));
      });
      proc.on('error', reject);
    });
  }

  async renameContainer(oldName, newName) {
    await this.stopContainer(oldName).catch(() => {});
    await this.exec('lxc', ['rename', oldName, newName]);
    await this.startContainer(newName).catch(() => {});
  }

  async setResourceLimits(name, limits) {
    const args = [];
    if (limits.cpu) args.push('-c', `limits.cpu=${limits.cpu}`);
    if (limits.memory) args.push('-c', `limits.memory=${limits.memory}MB`);

    if (args.length > 0) {
      await this.exec('lxc', ['config', 'set', name, ...args]);
    }

    if (limits.disk) {
      try {
        await this.exec('lxc', ['config', 'device', 'set', name, 'root', `size=${limits.disk}GB`]);
      } catch (e) {
        console.warn(`[LXD] Could not update disk limit for ${name}:`, e.message);
      }
    }
  }

  // ─── Snapshots / Backups ────────────────────────────────

  async createSnapshot(containerName, snapshotName) {
    await this.exec('lxc', ['snapshot', containerName, snapshotName], { timeout: 300000 });
  }

  async deleteSnapshot(containerName, snapshotName) {
    await this.exec('lxc', ['delete', `${containerName}/${snapshotName}`]);
  }

  async restoreSnapshot(containerName, snapshotName) {
    await this.exec('lxc', ['restore', containerName, snapshotName], { timeout: 300000 });
  }

  async listSnapshots(containerName) {
    try {
      const { stdout } = await this.exec('lxc', ['info', containerName]);
      const snapshots = [];
      let inSnapshotSection = false;

      for (const line of stdout.split('\n')) {
        if (line.trim() === 'Snapshots:') {
          inSnapshotSection = true;
          continue;
        }
        if (inSnapshotSection && line.trim()) {
          const match = line.trim().match(/^(\S+)\s+.*\((\S+)\)\s*$/);
          if (match) {
            snapshots.push({ name: match[1], created_at: match[2] });
          } else if (line.trim().startsWith(containerName + '/') || /^\w/.test(line.trim())) {
            const parts = line.trim().split(/\s+/);
            snapshots.push({ name: parts[0]?.replace(containerName + '/', '') || parts[0] });
          }
        }
      }
      return snapshots;
    } catch {
      return [];
    }
  }

  async exportContainer(name, outputPath) {
    await this.exec('lxc', ['export', name, outputPath, '--optimized-storage'], { timeout: 600000 });
  }

  // ─── Metrics ────────────────────────────────────────────

  async getContainerMetrics(name) {
    try {
      const { stdout: infoOut } = await this.exec('lxc', ['info', name]);
      const metrics = this.parseContainerInfo(infoOut, name);

      if (metrics.status === 'running') {
        try {
          const { stdout: cpuOut } = await this.exec('lxc', [
            'exec', name, '--', 'bash', '-c',
            "top -bn1 | grep 'Cpu(s)' | awk '{print $2}'"
          ]);
          metrics.cpu_percent = parseFloat(cpuOut) || 0;
        } catch {
          metrics.cpu_percent = 0;
        }

        try {
          const { stdout: memOut } = await this.exec('lxc', [
            'exec', name, '--', 'bash', '-c',
            "free -b | awk '/Mem:/{printf \"%s %s %s\", $2, $3, $7}'"
          ]);
          const [total, used, available] = memOut.split(' ').map(Number);
          metrics.memory = { total, used, available, percent: total ? ((used / total) * 100).toFixed(1) : 0 };
        } catch {
          metrics.memory = { total: 0, used: 0, available: 0, percent: 0 };
        }

        try {
          const { stdout: diskOut } = await this.exec('lxc', [
            'exec', name, '--', 'bash', '-c',
            "df -B1 / | awk 'NR==2{printf \"%s %s %s %s\", $2, $3, $4, $5}'"
          ]);
          const [total, used, avail, pct] = diskOut.split(' ');
          metrics.disk = {
            total: parseInt(total) || 0,
            used: parseInt(used) || 0,
            available: parseInt(avail) || 0,
            percent: parseFloat(pct) || 0
          };
        } catch {
          metrics.disk = { total: 0, used: 0, available: 0, percent: 0 };
        }

        try {
          const { stdout: netOut } = await this.exec('lxc', [
            'exec', name, '--', 'bash', '-c',
            "cat /proc/net/dev | awk '/eth0/{printf \"%s %s\", $2, $10}'"
          ]);
          const [rxBytes, txBytes] = netOut.split(' ').map(Number);
          metrics.network = { rx_bytes: rxBytes || 0, tx_bytes: txBytes || 0 };
        } catch {
          metrics.network = { rx_bytes: 0, tx_bytes: 0 };
        }
      }

      return metrics;
    } catch (err) {
      throw new Error(`Failed to get metrics for ${name}: ${err.message}`);
    }
  }

  // ─── Console ────────────────────────────────────────────

  spawnConsole(containerName) {
    return spawn('lxc', ['exec', containerName, '--', '/bin/bash'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, TERM: 'xterm-256color' },
    });
  }

  // ─── TMATE ──────────────────────────────────────────────

  async isTmateInstalled(containerName) {
    try {
      await this.exec('lxc', ['exec', containerName, '--', 'which', 'tmate']);
      return true;
    } catch {
      return false;
    }
  }

  async installTmate(containerName) {
    await this.exec('lxc', [
      'exec', containerName, '--', 'bash', '-c',
      'apt-get update -qq && apt-get install -y -qq tmate'
    ], { timeout: 120000 });
  }

  async startTmateSession(containerName) {
    await this.exec('lxc', [
      'exec', containerName, '--', 'bash', '-c',
      'tmux kill-server 2>/dev/null; tmate -S /tmp/tmate.sock new-session -d'
    ]);

    await new Promise(r => setTimeout(r, 3000));

    const { stdout } = await this.exec('lxc', [
      'exec', containerName, '--', 'bash', '-c',
      'tmate -S /tmp/tmate.sock display -p "#{tmate_ssh}|||#{tmate_ssh_ro}"'
    ]);

    const [rw, ro] = stdout.split('|||');
    return {
      read_write: rw?.trim() || '',
      read_only: ro?.trim() || '',
    };
  }

  async stopTmateSession(containerName) {
    try {
      await this.exec('lxc', ['exec', containerName, '--', 'bash', '-c', 'tmux kill-server 2>/dev/null']);
    } catch {}
  }

  // ─── Images ─────────────────────────────────────────────

  async listImages() {
    try {
      const { stdout } = await this.exec('lxc', ['image', 'list', 'images:', '--format', 'json']);
      const images = JSON.parse(stdout);
      const filtered = images
        .filter(i => i.aliases?.length > 0)
        .slice(0, 50)
        .map(i => ({
          aliases: i.aliases?.map(a => a.name) || [],
          description: i.properties?.description || '',
          size: i.size,
          architecture: i.architecture,
        }));
      return filtered;
    } catch {
      return [
        { aliases: ['ubuntu:22.04'], description: 'Ubuntu 22.04 LTS' },
        { aliases: ['ubuntu:24.04'], description: 'Ubuntu 24.04 LTS' },
        { aliases: ['debian:12'], description: 'Debian 12 Bookworm' },
        { aliases: ['centos:9-Stream'], description: 'CentOS 9 Stream' },
        { aliases: ['alpine:3.19'], description: 'Alpine Linux 3.19' },
        { aliases: ['fedora:39'], description: 'Fedora 39' },
      ];
    }
  }

  async getCommonImages() {
    return [
      { alias: 'ubuntu:22.04', label: 'Ubuntu 22.04 LTS' },
      { alias: 'ubuntu:24.04', label: 'Ubuntu 24.04 LTS' },
      { alias: 'debian:12', label: 'Debian 12' },
      { alias: 'debian:11', label: 'Debian 11' },
      { alias: 'centos:9-Stream', label: 'CentOS 9 Stream' },
      { alias: 'alpine:3.19', label: 'Alpine 3.19' },
      { alias: 'fedora:39', label: 'Fedora 39' },
      { alias: 'rocky:9', label: 'Rocky Linux 9' },
    ];
  }
}

const lxdService = new LxdService();
export default lxdService;
