import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/common/Toast';
import Modal from '../components/common/Modal';
import api from '../api/client';
import {
  Server, Play, Square, RotateCcw, Zap, Cpu, MemoryStick,
  HardDrive, Network, Terminal, Camera, Download, RotateCw,
  Trash2, Key, RefreshCw, Edit3, ArrowLeft, Clock, Share2,
  ChevronDown
} from 'lucide-react';

export default function VPSDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [container, setContainer] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [backups, setBackups] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [actionLoading, setActionLoading] = useState('');

  // Modals
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showReinstallModal, setShowReinstallModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [showTmate, setShowTmate] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const metricsInterval = useRef(null);

  useEffect(() => {
    loadContainer();
    return () => { if (metricsInterval.current) clearInterval(metricsInterval.current); };
  }, [id]);

  useEffect(() => {
    if (container?.status === 'running') {
      loadMetrics();
      metricsInterval.current = setInterval(loadMetrics, 5000);
    }
    return () => { if (metricsInterval.current) clearInterval(metricsInterval.current); };
  }, [container?.status]);

  const loadContainer = async () => {
    try {
      const res = await api.get(`/containers/${id}`);
      setContainer(res.data.container);
      loadBackups();
    } catch (err) {
      toast.error('Container not found');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    try {
      const res = await api.get(`/stats/container/${id}`);
      setMetrics(res.data.metrics);
    } catch {}
  };

  const loadBackups = async () => {
    try {
      const res = await api.get(`/backups/${id}`);
      setBackups(res.data.backups);
      setSchedule(res.data.schedule);
    } catch {}
  };

  const handlePower = async (action) => {
    setActionLoading(action);
    try {
      await api.post(`/containers/${id}/${action}`);
      toast.success(`Container ${action} initiated`);
      setTimeout(loadContainer, 2000);
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${action}`);
    } finally {
      setActionLoading('');
    }
  };

  const handleBackup = async () => {
    setActionLoading('backup');
    try {
      await api.post(`/backups/${id}`);
      toast.success('Backup started');
      setTimeout(loadBackups, 3000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Backup failed');
    } finally {
      setActionLoading('');
    }
  };

  const handleRestore = async (backupId) => {
    try {
      await api.post(`/backups/${id}/restore/${backupId}`);
      toast.success('Restore initiated');
      setTimeout(loadBackups, 3000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Restore failed');
    }
  };

  const handleDeleteBackup = async (backupId) => {
    try {
      await api.delete(`/backups/${id}/${backupId}`);
      toast.success('Backup deleted');
      loadBackups();
    } catch (err) {
      toast.error('Failed to delete backup');
    }
  };

  if (loading || !container) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><div className="spinner" style={{ width: 36, height: 36 }} /></div>;
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'console', label: 'Console' },
    { id: 'backups', label: 'Backups' },
    { id: 'tmate', label: 'TMATE' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => navigate('/')} className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }}>
          <ArrowLeft size={14} /> Back to Dashboard
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 'var(--radius-lg)',
              background: container.status === 'running' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Server size={22} style={{ color: container.status === 'running' ? 'var(--success)' : 'var(--danger)' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>{container.display_name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <span className={`badge badge-${container.status}`}>{container.status}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{container.image}</span>
                {container.ip_address && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>• {container.ip_address}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {container.status === 'stopped' && (
              <button className="btn btn-success" onClick={() => handlePower('start')} disabled={!!actionLoading}>
                {actionLoading === 'start' ? <span className="spinner" /> : <><Play size={16} /> Start</>}
              </button>
            )}
            {container.status === 'running' && (
              <>
                <button className="btn btn-danger" onClick={() => handlePower('stop')} disabled={!!actionLoading}>
                  {actionLoading === 'stop' ? <span className="spinner" /> : <><Square size={16} /> Stop</>}
                </button>
                <button className="btn btn-warning" onClick={() => handlePower('restart')} disabled={!!actionLoading}>
                  {actionLoading === 'restart' ? <span className="spinner" /> : <><RotateCcw size={16} /> Restart</>}
                </button>
                <button className="btn btn-danger" onClick={() => handlePower('kill')} disabled={!!actionLoading} title="Force Stop">
                  <Zap size={16} /> Kill
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        borderBottom: '1px solid var(--border)', paddingBottom: 0,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px', fontSize: 14, fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--primary-light)' : 'var(--text-muted)',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              transition: 'all 0.15s ease', marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab container={container} metrics={metrics} />
      )}
      {activeTab === 'console' && (
        <ConsoleTab container={container} />
      )}
      {activeTab === 'backups' && (
        <BackupsTab
          backups={backups} schedule={schedule}
          onBackup={handleBackup} onRestore={handleRestore}
          onDelete={handleDeleteBackup} actionLoading={actionLoading}
          containerId={id} onScheduleUpdate={loadBackups}
        />
      )}
      {activeTab === 'tmate' && (
        <TmateTab container={container} />
      )}
      {activeTab === 'settings' && (
        <SettingsTab container={container} onUpdate={loadContainer} />
      )}
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────

function OverviewTab({ container, metrics }) {
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const cpuPercent = metrics?.cpu_percent || 0;
  const memPercent = metrics?.memory?.percent || 0;
  const diskPercent = metrics?.disk?.percent || 0;

  return (
    <div>
      {/* Resource specs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>CPU Cores</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{container.cpu_limit}</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Memory</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{container.ram_limit} MB</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Disk</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{container.disk_limit} GB</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>IP Address</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{container.ip_address || 'N/A'}</div>
        </div>
      </div>

      {/* Performance metrics */}
      {container.status === 'running' && (
        <>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Live Performance</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <MetricCard
              icon={Cpu} label="CPU Usage" value={`${cpuPercent}%`} percent={cpuPercent}
              color={cpuPercent > 80 ? 'var(--danger)' : cpuPercent > 50 ? 'var(--warning)' : 'var(--success)'}
            />
            <MetricCard
              icon={MemoryStick} label="Memory Usage"
              value={metrics?.memory ? `${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.total)}` : '—'}
              percent={parseFloat(memPercent)}
              color={memPercent > 80 ? 'var(--danger)' : memPercent > 50 ? 'var(--warning)' : 'var(--success)'}
            />
            <MetricCard
              icon={HardDrive} label="Disk Usage"
              value={metrics?.disk ? `${formatBytes(metrics.disk.used)} / ${formatBytes(metrics.disk.total)}` : '—'}
              percent={parseFloat(diskPercent)}
              color={diskPercent > 80 ? 'var(--danger)' : diskPercent > 50 ? 'var(--warning)' : 'var(--success)'}
            />
            <MetricCard
              icon={Network} label="Network I/O"
              value={metrics?.network ? `↓${formatBytes(metrics.network.rx_bytes)} ↑${formatBytes(metrics.network.tx_bytes)}` : '—'}
              percent={0} hideBar
            />
          </div>
        </>
      )}

      {container.status !== 'running' && (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Start the container to see live performance metrics</p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, percent, color, hideBar }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Icon size={18} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>{value}</div>
      {!hideBar && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${Math.min(percent, 100)}%`, background: color }} />
        </div>
      )}
    </div>
  );
}

// ─── Console Tab ─────────────────────────────────────────

function ConsoleTab({ container }) {
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const xtermRef = useRef(null);

  useEffect(() => {
    if (container.status !== 'running') return;

    let mounted = true;
    (async () => {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      await import('@xterm/xterm/css/xterm.css');

      if (!mounted || !termRef.current) return;

      const term = new Terminal({
        theme: {
          background: '#0d0d0d',
          foreground: '#e0e0e0',
          cursor: '#7c3aed',
          cursorAccent: '#0d0d0d',
          selectionBackground: 'rgba(124,58,237,0.3)',
        },
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 14,
        cursorBlink: true,
        cursorStyle: 'bar',
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      term.open(termRef.current);
      fitAddon.fit();
      xtermRef.current = term;

      const token = localStorage.getItem('token');
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = `${protocol}://${window.location.host}/ws/console?token=${token}&container_id=${container.id}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'output') {
            term.write(msg.data);
          } else if (msg.type === 'connected') {
            term.write(`\r\n\x1b[32mConnected to ${msg.container}\x1b[0m\r\n\r\n`);
          } else if (msg.type === 'exit') {
            term.write('\r\n\x1b[31mSession ended\x1b[0m\r\n');
          } else if (msg.type === 'error') {
            term.write(`\r\n\x1b[31mError: ${msg.message}\x1b[0m\r\n`);
          }
        } catch {}
      };

      ws.onerror = () => term.write('\r\n\x1b[31mConnection error\x1b[0m\r\n');
      ws.onclose = () => term.write('\r\n\x1b[33mDisconnected\x1b[0m\r\n');

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }));
        }
      });

      const resizeObserver = new ResizeObserver(() => { try { fitAddon.fit(); } catch {} });
      resizeObserver.observe(termRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    })();

    return () => {
      mounted = false;
      if (wsRef.current) wsRef.current.close();
      if (xtermRef.current) xtermRef.current.dispose();
    };
  }, [container.id, container.status]);

  if (container.status !== 'running') {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center' }}>
        <Terminal size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
        <p style={{ color: 'var(--text-muted)' }}>Container must be running to use the console</p>
      </div>
    );
  }

  return (
    <div>
      <div className="terminal-container" style={{ height: 480 }}>
        <div ref={termRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}

// ─── Backups Tab ─────────────────────────────────────────

function BackupsTab({ backups, schedule, onBackup, onRestore, onDelete, actionLoading, containerId, onScheduleUpdate }) {
  const toast = useToast();
  const [showSchedule, setShowSchedule] = useState(false);
  const [cronExpr, setCronExpr] = useState(schedule?.cron_expression || '0 2 * * *');
  const [maxKeep, setMaxKeep] = useState(schedule?.max_keep || 5);
  const [scheduleActive, setScheduleActive] = useState(schedule?.is_active ?? false);

  const saveSchedule = async () => {
    try {
      await api.put(`/backups/${containerId}/schedule`, {
        cron_expression: cronExpr,
        max_keep: maxKeep,
        is_active: scheduleActive,
      });
      toast.success('Backup schedule updated');
      setShowSchedule(false);
      onScheduleUpdate();
    } catch (err) {
      toast.error('Failed to update schedule');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Backups & Snapshots</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowSchedule(!showSchedule)}>
            <Clock size={14} /> Schedule
          </button>
          <button className="btn btn-primary btn-sm" onClick={onBackup} disabled={actionLoading === 'backup'}>
            {actionLoading === 'backup' ? <span className="spinner" /> : <><Camera size={14} /> Create Backup</>}
          </button>
        </div>
      </div>

      {/* Schedule config */}
      {showSchedule && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Backup Schedule</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label className="label">Cron Expression</label>
              <input className="input" value={cronExpr} onChange={e => setCronExpr(e.target.value)} placeholder="0 2 * * *" />
            </div>
            <div>
              <label className="label">Keep Last</label>
              <input className="input" type="number" value={maxKeep} onChange={e => setMaxKeep(parseInt(e.target.value) || 5)} min={1} max={20} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={scheduleActive ? '1' : '0'} onChange={e => setScheduleActive(e.target.value === '1')}>
                <option value="1">Active</option>
                <option value="0">Disabled</option>
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={saveSchedule}>Save</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Default: 2 AM daily. Uses standard cron syntax.</p>
        </div>
      )}

      {backups.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Camera size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <p style={{ color: 'var(--text-muted)' }}>No backups yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Snapshot</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map(b => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{b.snapshot_name}</td>
                  <td><span className={`badge ${b.type === 'scheduled' ? 'badge-admin' : 'badge-user'}`}>{b.type}</span></td>
                  <td><span className={`badge badge-${b.status === 'completed' ? 'running' : b.status === 'failed' ? 'error' : 'creating'}`}>{b.status}</span></td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(b.created_at).toLocaleString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {b.status === 'completed' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => onRestore(b.id)}>
                          <RotateCw size={12} /> Restore
                        </button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => onDelete(b.id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── TMATE Tab ───────────────────────────────────────────

function TmateTab({ container }) {
  const toast = useToast();
  const [installed, setInstalled] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [sessions, setSessions] = useState(null);
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (container.status === 'running') checkTmate();
    else setChecking(false);
  }, [container.id, container.status]);

  const checkTmate = async () => {
    setChecking(true);
    try {
      const res = await api.get(`/tmate/${container.id}/status`);
      setInstalled(res.data.installed);
    } catch {
      setInstalled(false);
    } finally {
      setChecking(false);
    }
  };

  const installTmate = async () => {
    setInstalling(true);
    try {
      await api.post(`/tmate/${container.id}/install`);
      toast.success('TMATE installed!');
      setInstalled(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Install failed');
    } finally {
      setInstalling(false);
    }
  };

  const startSession = async () => {
    setStarting(true);
    try {
      const res = await api.post(`/tmate/${container.id}/start`);
      setSessions(res.data.sessions);
      toast.success('TMATE session started');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start session');
    } finally {
      setStarting(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.info('Copied to clipboard');
  };

  if (container.status !== 'running') {
    return (
      <div className="card" style={{ padding: 32, textAlign: 'center' }}>
        <Share2 size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
        <p style={{ color: 'var(--text-muted)' }}>Container must be running for TMATE</p>
      </div>
    );
  }

  if (checking) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>;
  }

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>TMATE Remote Access</h3>

      {!installed ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <Share2 size={40} style={{ color: 'var(--primary-light)', marginBottom: 12 }} />
          <h4 style={{ fontSize: 16, marginBottom: 8 }}>TMATE Not Installed</h4>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: 14 }}>Install TMATE to enable remote terminal sharing</p>
          <button className="btn btn-primary" onClick={installTmate} disabled={installing}>
            {installing ? <><span className="spinner" /> Installing...</> : <><Download size={16} /> Install TMATE</>}
          </button>
        </div>
      ) : (
        <div>
          {!sessions ? (
            <div className="card" style={{ padding: 24 }}>
              <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>TMATE is installed. Start a session to get sharing links.</p>
              <button className="btn btn-primary" onClick={startSession} disabled={starting}>
                {starting ? <><span className="spinner" /> Starting...</> : <><Play size={16} /> Start Session</>}
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Read/Write Session</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <code style={{
                    flex: 1, padding: '10px 14px', background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)', fontSize: 13, wordBreak: 'break-all',
                  }}>
                    {sessions.read_write || 'Waiting...'}
                  </code>
                  <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(sessions.read_write)}>Copy</button>
                </div>
              </div>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Read Only Session</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <code style={{
                    flex: 1, padding: '10px 14px', background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)', fontSize: 13, wordBreak: 'break-all',
                  }}>
                    {sessions.read_only || 'Waiting...'}
                  </code>
                  <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(sessions.read_only)}>Copy</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ────────────────────────────────────────

function SettingsTab({ container, onUpdate }) {
  const toast = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState(container.display_name);
  const [selectedImage, setSelectedImage] = useState(container.image);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState('');

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      const res = await api.get('/containers/images/available');
      setImages(res.data.images);
    } catch {}
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 4) { toast.error('Password must be at least 4 characters'); return; }
    setLoading('password');
    try {
      await api.post(`/containers/${container.id}/password`, { password: newPassword });
      toast.success('Root password changed');
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading('');
    }
  };

  const handleRename = async () => {
    if (!newName.trim()) return;
    setLoading('rename');
    try {
      await api.put(`/containers/${container.id}/rename`, { display_name: newName.trim() });
      toast.success('VPS renamed');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to rename');
    } finally {
      setLoading('');
    }
  };

  const handleReinstall = async () => {
    if (!window.confirm(`This will DESTROY all data and reinstall with ${selectedImage}. Continue?`)) return;
    setLoading('reinstall');
    try {
      await api.post(`/containers/${container.id}/reinstall`, { image: selectedImage });
      toast.success('Reinstall started. This may take a few minutes.');
      setTimeout(onUpdate, 5000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reinstall failed');
    } finally {
      setLoading('');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 600 }}>
      {/* Rename */}
      <div className="card" style={{ padding: 20 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Edit3 size={16} /> Rename VPS
        </h4>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Display name" />
          <button className="btn btn-primary btn-sm" onClick={handleRename} disabled={loading === 'rename'}>
            {loading === 'rename' ? <span className="spinner" /> : 'Save'}
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="card" style={{ padding: 20 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Key size={16} /> Change Root Password
        </h4>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New root password" />
          <button className="btn btn-primary btn-sm" onClick={handleChangePassword} disabled={loading === 'password'}>
            {loading === 'password' ? <span className="spinner" /> : 'Change'}
          </button>
        </div>
      </div>

      {/* Reinstall */}
      <div className="card" style={{ padding: 20, borderColor: 'rgba(239,68,68,0.3)' }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}>
          <RefreshCw size={16} /> Reinstall OS
        </h4>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Warning: This will destroy all data on this VPS.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="input" value={selectedImage} onChange={e => setSelectedImage(e.target.value)}>
            {images.map(img => (
              <option key={img.alias} value={img.alias}>{img.label}</option>
            ))}
          </select>
          <button className="btn btn-danger btn-sm" onClick={handleReinstall} disabled={loading === 'reinstall'}>
            {loading === 'reinstall' ? <span className="spinner" /> : 'Reinstall'}
          </button>
        </div>
      </div>
    </div>
  );
}
