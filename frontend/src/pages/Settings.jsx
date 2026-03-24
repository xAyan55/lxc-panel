import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../components/common/Toast';
import { 
  User, Shield, Key, Palette, Briefcase, 
  RefreshCw, Copy, Trash2, CheckCircle2, AlertTriangle, Eye, EyeOff 
} from 'lucide-react';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { companyName, themeColor, updateTheme } = useTheme();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState('');
  
  // Profile form
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    company_name: user?.company_name || '',
    theme_color: user?.theme_color || '#7c3aed'
  });

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  // API Key state
  const [apiKeyData, setApiKeyData] = useState({ api_key: '', created_at: '' });
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (activeTab === 'api') loadApiKey();
  }, [activeTab]);

  const loadApiKey = async () => {
    try {
      const res = await api.get('/apikeys');
      setApiKeyData(res.data);
    } catch {}
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading('profile');
    try {
      const res = await api.put('/auth/me', profileForm);
      updateUser(res.data.user);
      updateTheme(profileForm.theme_color, profileForm.company_name);
      toast.success('Profile and branding updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading('');
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      return toast.error('Passwords do not match');
    }
    setLoading('password');
    try {
      await api.put('/auth/me', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      toast.success('Password changed successfully');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading('');
    }
  };

  const generateApiKey = async () => {
    setLoading('api');
    try {
      const res = await api.post('/apikeys/generate');
      setApiKeyData(res.data);
      toast.success('New API key generated');
      setShowApiKey(true);
    } catch (err) {
      toast.error('Failed to generate API key');
    } finally {
      setLoading('');
    }
  };

  const revokeApiKey = async () => {
    if (!window.confirm('Are you sure you want to revoke your API key?')) return;
    try {
      await api.delete('/apikeys');
      setApiKeyData({ api_key: '', created_at: '' });
      toast.success('API key revoked');
    } catch (err) {
      toast.error('Failed to revoke API key');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.info('Copied to clipboard');
  };

  const tabs = [
    { id: 'profile', label: 'Profile & Branding', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'api', label: 'API Keys', icon: Key }
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Manage your account and panel experience</p>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 32 }}>
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 14, fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--primary-light)' : 'var(--text-muted)',
              border: 'none', background: 'none', borderBottom: `2px solid ${activeTab === tab.id ? 'var(--primary)' : 'transparent'}`,
              cursor: 'pointer', transition: 'all 0.15s ease'
            }}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Profile & Branding */}
      {activeTab === 'profile' && (
        <form onSubmit={handleProfileUpdate} style={{ display: 'grid', gap: 24 }}>
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Personal Information</h3>
            <div style={{ marginBottom: 16 }}>
              <label className="label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="input" style={{ paddingLeft: 40 }} value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="label">Email Address</label>
              <input className="input" value={user?.email} disabled style={{ opacity: 0.6 }} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Email cannot be changed manually. Contact admin.</p>
            </div>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Branding & Theme</h3>
            <div style={{ marginBottom: 16 }}>
              <label className="label">Company Name</label>
              <div style={{ position: 'relative' }}>
                <Briefcase size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="input" style={{ paddingLeft: 40 }} value={profileForm.company_name} onChange={e => setProfileForm({...profileForm, company_name: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="label">Primary Theme Color</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input 
                  type="color" 
                  value={profileForm.theme_color} 
                  onChange={e => setProfileForm({...profileForm, theme_color: e.target.value})}
                  style={{ width: 44, height: 44, border: 'none', background: 'none', cursor: 'pointer' }}
                />
                <input className="input" value={profileForm.theme_color} onChange={e => setProfileForm({...profileForm, theme_color: e.target.value})} style={{ maxWidth: 120, fontFamily: 'monospace' }} />
                <div style={{ width: 32, height: 32, borderRadius: 8, background: profileForm.theme_color }} />
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading === 'profile'} style={{ width: 'fit-content' }}>
            {loading === 'profile' ? <span className="spinner" /> : 'Save Changes'}
          </button>
        </form>
      )}

      {/* Security */}
      {activeTab === 'security' && (
        <form onSubmit={handlePasswordUpdate}>
          <div className="card" style={{ padding: 24, display: 'grid', gap: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Change Password</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Update your password to keep your account secure.</p>
            
            <div>
              <label className="label">Current Password</label>
              <input className="input" type="password" value={passwordForm.current_password} onChange={e => setPasswordForm({...passwordForm, current_password: e.target.value})} required />
            </div>
            <div>
              <label className="label">New Password</label>
              <input className="input" type="password" value={passwordForm.new_password} onChange={e => setPasswordForm({...passwordForm, new_password: e.target.value})} required />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input className="input" type="password" value={passwordForm.confirm_password} onChange={e => setPasswordForm({...passwordForm, confirm_password: e.target.value})} required />
            </div>
            
            <button type="submit" className="btn btn-primary" disabled={loading === 'password'} style={{ width: 'fit-content', marginTop: 8 }}>
              {loading === 'password' ? <span className="spinner" /> : 'Update Password'}
            </button>
          </div>
        </form>
      )}

      {/* API Keys */}
      {activeTab === 'api' && (
        <div style={{ display: 'grid', gap: 24 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Your API Key</h3>
              {!apiKeyData.api_key && (
                <button className="btn btn-primary btn-sm" onClick={generateApiKey} disabled={loading === 'api'}>
                  {loading === 'api' ? <span className="spinner" /> : 'Generate Key'}
                </button>
              )}
            </div>

            {apiKeyData.api_key ? (
              <div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input 
                      className="input" 
                      type={showApiKey ? 'text' : 'password'} 
                      value={apiKeyData.api_key} 
                      readOnly 
                      style={{ paddingRight: 40, fontFamily: 'monospace', fontSize: 13 }}
                    />
                    <button 
                      onClick={() => setShowApiKey(!showApiKey)} 
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button className="btn btn-secondary btn-icon" onClick={() => copyToClipboard(apiKeyData.api_key)}>
                    <Copy size={16} />
                  </button>
                  <button className="btn btn-danger btn-icon" onClick={revokeApiKey}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={12} color="var(--success)" />
                  Created on {new Date(apiKeyData.created_at).toLocaleDateString()} at {new Date(apiKeyData.created_at).toLocaleTimeString()}
                </div>
                <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--info)', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    <Shield size={14} /> Quick usage
                  </div>
                  <code style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    curl -H "X-API-Key: {showApiKey ? apiKeyData.api_key : '••••••••'}" http://this-server/api/containers
                  </code>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Key size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>You haven't generated an API key yet.</p>
              </div>
            )}
          </div>

          <div style={{ padding: 16, borderRadius: 'var(--radius-lg)', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <AlertTriangle size={20} color="var(--warning)" style={{ flexShrink: 0 }} />
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--warning)', marginBottom: 4 }}>Security Warning</h4>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  API keys provide full access to your account and VPS controls. 
                  Never share your key or commit it to version control. 
                  If compromised, revoke it immediately and generate a new one.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
