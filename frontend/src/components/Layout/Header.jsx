import { useAuth } from '../../contexts/AuthContext';
import { Menu, Bell } from 'lucide-react';

export default function Header({ onMenuToggle, sidebarOpen }) {
  const { user } = useAuth();

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      right: 0,
      left: sidebarOpen ? 'var(--sidebar-width)' : 0,
      height: 'var(--header-height)',
      background: 'rgba(15, 15, 20, 0.8)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      zIndex: 40,
      transition: 'left 0.3s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={onMenuToggle}
          className="btn btn-icon btn-secondary"
          style={{ background: 'transparent', border: 'none' }}
        >
          <Menu size={20} />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          className="btn btn-icon btn-secondary"
          style={{ position: 'relative' }}
        >
          <Bell size={18} />
        </button>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '6px 12px', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-tertiary)',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: 'white',
          }}>
            {user?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{user?.name?.split(' ')[0] || user?.email}</span>
        </div>
      </div>
    </header>
  );
}
