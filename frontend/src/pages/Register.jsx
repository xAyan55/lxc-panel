import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Server, Eye, EyeOff } from 'lucide-react';

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showApiSettings, setShowApiSettings] = useState(false);
  const [apiUrl, setApiUrl] = useState(localStorage.getItem('api_url') || '');

  const saveApiUrl = () => {
    if (apiUrl) {
      localStorage.setItem('api_url', apiUrl);
    } else {
      localStorage.removeItem('api_url');
    }
    window.location.reload();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await register(email, password, name);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', padding: 20,
    }}>
      <div style={{
        position: 'fixed', top: '-20%', right: '-10%', width: 600, height: 600,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="animate-fade-in" style={{
        width: '100%', maxWidth: 420,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', padding: 36,
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, boxShadow: '0 0 30px rgba(124,58,237,0.2)',
          }}>
            <Server size={24} color="white" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Create account</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Get started with your panel</p>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', marginBottom: 16, borderRadius: 'var(--radius-md)',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            color: 'var(--danger)', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="label">Full Name</label>
            <input id="register-name" className="input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="label">Email</label>
            <input id="register-email" className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label className="label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="register-password" className="input"
                type={showPw ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 characters" required autoComplete="new-password"
                style={{ paddingRight: 40 }}
              />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
              }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button id="register-submit" className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '12px 20px', fontSize: 15 }}>
            {loading ? <span className="spinner" /> : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--primary-light)', fontWeight: 500 }}>Sign in</Link>
        </p>

        {/* API Settings Section */}
        <div style={{ marginTop: 24, padding: 12, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <button 
            type="button"
            onClick={() => setShowApiSettings(!showApiSettings)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
          >
            {showApiSettings ? 'Hide API Config' : 'Connection Issues? Set API URL'}
          </button>
          
          {showApiSettings && (
            <div style={{ marginTop: 12, textAlign: 'left' }}>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
                Enter your Backend Tunnel URL (including /api):
              </p>
              <input 
                type="text" 
                className="input" 
                style={{ fontSize: 12, height: 32, marginBottom: 8 }}
                placeholder="https://your-api.pinggy.link/api"
                value={apiUrl}
                onChange={e => setApiUrl(e.target.value)}
              />
              <button 
                type="button"
                onClick={saveApiUrl}
                className="btn btn-primary" 
                style={{ width: '100%', height: 32, fontSize: 12, padding: 0 }}
              >
                Save & Update
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
