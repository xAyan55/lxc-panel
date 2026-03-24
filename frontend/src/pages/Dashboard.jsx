import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/common/Toast';
import api from '../api/client';
import {
  Server, Play, Square, RotateCcw, Cpu, MemoryStick, HardDrive,
  Users, Activity, Plus, ArrowRight, Wifi
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [containers, setContainers] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/containers');
      setContainers(res.data.containers);

      if (user.role === 'admin') {
        const ov = await api.get('/stats/overview');
        setOverview(ov.data.overview);
      }
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handlePower = async (id, action) => {
    try {
      await api.post(`/containers/${id}/${action}`);
      toast.success(`Container ${action} initiated`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${action}`);
    }
  };

  const statusColor = (status) => {
    switch (status) {
      case 'running': return 'var(--success)';
      case 'stopped': return 'var(--danger)';
      case 'creating': case 'reinstalling': return 'var(--warning)';
      default: return 'var(--text-muted)';
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Page Title */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Welcome back, {user.name || user.email}
        </p>
      </div>

      {/* Admin Stats */}
      {user.role === 'admin' && overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
          <StatCard icon={Server} label="Total VPS" value={overview.total_containers} color="var(--primary)" />
          <StatCard icon={Activity} label="Running" value={overview.running_containers} color="var(--success)" />
          <StatCard icon={Square} label="Stopped" value={overview.stopped_containers} color="var(--danger)" />
          <StatCard icon={Users} label="Total Users" value={overview.total_users} color="var(--info)" />
        </div>
      )}

      {/* VPS Cards */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>
          {user.role === 'admin' ? 'All Containers' : 'Your Servers'}
        </h2>
      </div>

      {containers.length === 0 ? (
        <div className="card" style={{
          padding: 48, textAlign: 'center',
        }}>
          <Server size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No servers yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {user.role === 'admin' ? 'Create a container from the admin panel' : 'Contact your administrator to get a VPS assigned'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {containers.map(c => (
            <div key={c.id} className="card" style={{ padding: 0, cursor: 'pointer' }} onClick={() => navigate(`/vps/${c.id}`)}>
              <div style={{ padding: '20px 22px' }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 'var(--radius-md)',
                      background: `rgba(${c.status === 'running' ? '34,197,94' : '239,68,68'}, 0.1)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Server size={18} style={{ color: statusColor(c.status) }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{c.display_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{c.image}</div>
                    </div>
                  </div>
                  <span className={`badge badge-${c.status}`}>{c.status}</span>
                </div>

                {/* Info */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                  padding: '12px 0', borderTop: '1px solid var(--border)',
                }}>
                  <InfoItem icon={Cpu} label="CPU" value={`${c.cpu_limit} Core${c.cpu_limit > 1 ? 's' : ''}`} />
                  <InfoItem icon={MemoryStick} label="RAM" value={`${c.ram_limit} MB`} />
                  <InfoItem icon={HardDrive} label="Disk" value={`${c.disk_limit} GB`} />
                  <InfoItem icon={Wifi} label="IP" value={c.ip_address || '—'} />
                </div>

                {/* Owner (admin) */}
                {c.owner_email && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    Owner: {c.owner_name || c.owner_email}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{
                display: 'flex', gap: 6, padding: '12px 22px',
                borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)',
                borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
              }}>
                {c.status === 'stopped' ? (
                  <button className="btn btn-success btn-sm" onClick={e => { e.stopPropagation(); handlePower(c.id, 'start'); }}>
                    <Play size={14} /> Start
                  </button>
                ) : c.status === 'running' ? (
                  <>
                    <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handlePower(c.id, 'stop'); }}>
                      <Square size={14} /> Stop
                    </button>
                    <button className="btn btn-warning btn-sm" onClick={e => { e.stopPropagation(); handlePower(c.id, 'restart'); }}>
                      <RotateCcw size={14} /> Restart
                    </button>
                  </>
                ) : null}
                <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={e => { e.stopPropagation(); navigate(`/vps/${c.id}`); }}>
                  Manage <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 'var(--radius-md)',
          background: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} style={{ color }} />
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon size={14} style={{ color: 'var(--text-muted)' }} />
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );
}
