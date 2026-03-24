import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useToast } from '../components/common/Toast';
import Modal from '../components/common/Modal';
import { 
  Server, Plus, Search, Info, Play, Square, 
  RotateCcw, Trash2, Box, Cpu, MemoryStick, HardDrive 
} from 'lucide-react';

export default function AdminContainers() {
  const navigate = useNavigate();
  const toast = useToast();
  const [containers, setContainers] = useState([]);
  const [users, setUsers] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Create Form states
  const [formData, setFormData] = useState({
    display_name: '', user_id: '', image: 'ubuntu:22.04',
    cpu_limit: 1, ram_limit: 512, disk_limit: 10
  });

  const loadContainers = async () => {
    try {
      const res = await api.get('/containers');
      setContainers(res.data.containers);
    } catch (err) {
      toast.error('Failed to load containers');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [uRes, iRes] = await Promise.all([
        api.get('/users', { params: { limit: 100 } }),
        api.get('/containers/images/available')
      ]);
      setUsers(uRes.data.users);
      setImages(iRes.data.images);
    } catch (err) {
      toast.error('Failed to load initial data');
    }
  };

  useEffect(() => {
    loadContainers();
    loadData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/containers', formData);
      toast.success('Container creation initiated');
      setShowCreateModal(false);
      setFormData({ display_name: '', user_id: '', image: 'ubuntu:22.04', cpu_limit: 1, ram_limit: 512, disk_limit: 10 });
      loadContainers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create container');
    }
  };

  const handleDelete = async (id, lxdName) => {
    if (!window.confirm(`Are you sure you want to delete ${lxdName}? This action is permanent!`)) return;
    try {
      await api.delete(`/containers/${id}`);
      toast.success('Container deleted');
      loadContainers();
    } catch (err) {
      toast.error('Failed to delete container');
    }
  };

  const filteredContainers = containers.filter(c => 
    c.display_name.toLowerCase().includes(search.toLowerCase()) || 
    c.lxd_name.toLowerCase().includes(search.toLowerCase()) ||
    c.owner_email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Global Containers</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Manage every VPS across the system</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={18} /> New Container
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input 
          className="input" 
          style={{ paddingLeft: 40 }} 
          placeholder="Search by name, LXD name, or owner email..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Containers Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>VPS / LXD Name</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Resources</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
            ) : filteredContainers.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No containers found</td></tr>
            ) : filteredContainers.map(c => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.display_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{c.lxd_name}</div>
                </td>
                <td>
                  <div style={{ fontSize: 13 }}>{c.owner_name || 'Admin'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.owner_email}</div>
                </td>
                <td>
                  <span className={`badge badge-${c.status}`}>{c.status}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <Cpu size={12} /> {c.cpu_limit}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <MemoryStick size={12} /> {c.ram_limit}M
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <HardDrive size={12} /> {c.disk_limit}G
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-icon btn-secondary" onClick={() => navigate(`/vps/${c.id}`)}>
                      <Info size={14} />
                    </button>
                    <button className="btn btn-icon btn-danger" onClick={() => handleDelete(c.id, c.lxd_name)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <Modal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
        title="Deploy New Container"
      >
        <form onSubmit={handleCreate}>
          <div style={{ marginBottom: 16 }}>
            <label className="label">Display Name</label>
            <input className="input" required placeholder="My Awesome VPS" value={formData.display_name} onChange={e => setFormData({...formData, display_name: e.target.value})} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="label">Owner (User)</label>
            <select className="input" required value={formData.user_id} onChange={e => setFormData({...formData, user_id: e.target.value})}>
              <option value="">Select a user...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.email} ({u.name})</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="label">OS Image</label>
            <select className="input" value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})}>
              {images.map(img => (
                <option key={img.alias} value={img.alias}>{img.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
            <div>
              <label className="label">CPUs</label>
              <input className="input" type="number" min="1" max="16" value={formData.cpu_limit} onChange={e => setFormData({...formData, cpu_limit: parseInt(e.target.value)})} />
            </div>
            <div>
              <label className="label">RAM (MB)</label>
              <input className="input" type="number" min="128" step="128" value={formData.ram_limit} onChange={e => setFormData({...formData, ram_limit: parseInt(e.target.value)})} />
            </div>
            <div>
              <label className="label">Disk (GB)</label>
              <input className="input" type="number" min="1" value={formData.disk_limit} onChange={e => setFormData({...formData, disk_limit: parseInt(e.target.value)})} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Launch VPS</button>
        </form>
      </Modal>
    </div>
  );
}
