import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Command,
  LayoutDashboard,
  Folder,
  Users,
  Activity,
  Settings,
  Search,
  Bell,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  CircleUserRound,
} from 'lucide-react';
import { LatticeSpotlight } from '../components/LatticeSpotlight';
import { apiRequest } from '../utils/api';
import './LatticePages.css';

const navItems = [
  { label: 'Home', to: '/lattice', icon: <LayoutDashboard size={16} />, end: true },
  { label: 'My Lattices', to: '/lattice/personal', icon: <Folder size={16} /> },
  { label: 'Shared Spaces', to: '/lattice/shared', icon: <Users size={16} /> },
  { label: 'Recent Activity', to: '/lattice/activity', icon: <Activity size={16} /> },
  { label: 'Settings', to: '/lattice/settings', icon: <Settings size={16} /> },
];

export const LatticeFrame = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [userAvatarUrl, setUserAvatarUrl] = useState(null);

  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSpotlightOpen((previous) => !previous);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        return;
      }

      try {
        const response = await apiRequest('/auth/me', { method: 'GET' });

        if (isMounted) {
          setUserAvatarUrl(response?.user?.avatarUrl || null);
        }
      } catch {
        if (isMounted) {
          setUserAvatarUrl(null);
        }
      }
    };

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="lattice-dashboard">
      <main className="lattice-main-content">
        <header className="main-topbar">
          <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
            <div className="topbar-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#111827' }}>
              <Command size={22} strokeWidth={2.4} />
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, letterSpacing: '-0.025em' }}>LATTICE</h2>
            </div>
            
            <nav className="topbar-nav-list" style={{ display: 'flex', gap: '6px' }}>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? 'topbar-nav-item active' : 'topbar-nav-item')}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="topbar-actions">
            <button className="action-circle" onClick={() => setIsSpotlightOpen(true)} aria-label="Search">
              <Search size={18} />
            </button>
            <button className="action-circle" aria-label="Create">
              <Plus size={18} />
            </button>
            <button className="action-circle" aria-label="Notifications">
              <Bell size={18} />
            </button>
            <div className="user-avatar" aria-label="User profile">
              {userAvatarUrl ? (
                <img src={userAvatarUrl} alt="User profile" className="user-avatar-image" />
              ) : (
                <CircleUserRound size={20} strokeWidth={1.8} />
              )}
            </div>
          </div>
        </header>

        <div className="main-scrollable">
          {children}
        </div>
      </main>

      <LatticeSpotlight isOpen={isSpotlightOpen} onClose={() => setIsSpotlightOpen(false)} />
    </div>
  );
};