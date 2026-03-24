import { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../components/common/Toast';
import Modal from '../components/common/Modal';
import { 
  Users, UserPlus, Search, Edit2, Trash2, Mail, Shield, 
  Settings as SettingsIcon, ChevronLeft, ChevronRight 
} from 'lucide-react';

export default function AdminUsers() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    email: '', name: '', password: '', role: 'user', max_containers: 3
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users', { params: { search, page, limit: 10 } });
      setUsers(res.data.users);
      setTotalPages(res.data.pagination.pages);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', formData);
      toast.success('User created successfully');
      setShowCreateModal(false);
      setFormData({ email: '', name: '', password: '', role: 'user', max_containers: 3 });
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/users/${selectedUser.id}`, formData);
      toast.success('User updated successfully');
      setShowEditModal(false);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user? This will also delete all their containers!')) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success('User deleted');
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const openEdit = (user) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      role: user.role,
      max_containers: user.max_containers,
      password: '', // Leave empty if no change
      is_active: user.is_active === 1
    });
    setShowEditModal(true);
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>User Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Manage users and their VPS limits</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <UserPlus size={18} /> Add User
        </button>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            className="input" 
            style={{ paddingLeft: 40 }} 
            placeholder="Search by name or email..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-secondary">Search</button>
      </form>

      {/* Users Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>VPS Count</th>
              <th>Limit</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No users found</td></tr>
            ) : users.map(user => (
              <tr key={user.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ 
                      width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-tertiary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600
                    }}>
                      {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500 }}>{user.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}`}>
                    {user.role}
                  </span>
                </td>
                <td>{user.container_count}</td>
                <td>{user.max_containers}</td>
                <td>
                  <span className={`badge ${user.is_active ? 'badge-running' : 'badge-stopped'}`}>
                    {user.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-icon btn-secondary" onClick={() => openEdit(user)}><Edit2 size={14} /></button>
                    <button className="btn btn-icon btn-danger" onClick={() => handleDelete(user.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 24 }}>
          <button 
            className="btn btn-secondary btn-icon" 
            disabled={page === 1} 
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Page {page} of {totalPages}
          </span>
          <button 
            className="btn btn-secondary btn-icon" 
            disabled={page === totalPages} 
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Create Modal */}
      <Modal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
        title="Create New User"
      >
        <form onSubmit={handleCreate}>
          <div style={{ marginBottom: 16 }}>
            <label className="label">Full Name</label>
            <input className="input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="label">Email Address</label>
            <input className="input" type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="label">Password</label>
            <input className="input" type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div>
              <label className="label">Role</label>
              <select className="input" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="label">VPS Limit</label>
              <input className="input" type="number" value={formData.max_containers} onChange={e => setFormData({...formData, max_containers: e.target.value})} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create User</button>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal 
        isOpen={showEditModal} 
        onClose={() => setShowEditModal(false)} 
        title="Edit User"
      >
        <form onSubmit={handleUpdate}>
          <div style={{ marginBottom: 16 }}>
            <label className="label">Full Name</label>
            <input className="input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="label">Email Address</label>
            <input className="input" type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="label">New Password (leave blank to keep current)</label>
            <input className="input" type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div>
              <label className="label">Role</label>
              <select className="input" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="label">VPS Limit</label>
              <input className="input" type="number" value={formData.max_containers} onChange={e => setFormData({...formData, max_containers: e.target.value})} />
            </div>
          </div>
          <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input 
              type="checkbox" 
              id="is_active" 
              checked={formData.is_active} 
              onChange={e => setFormData({...formData, is_active: e.target.checked})} 
            />
            <label htmlFor="is_active" style={{ fontSize: 14 }}>Active Account</label>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Update User</button>
        </form>
      </Modal>
    </div>
  );
}
