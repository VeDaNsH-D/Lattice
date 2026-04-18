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
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  CircleUserRound,
} from 'lucide-react';
import { LatticeSpotlight } from '../components/LatticeSpotlight';
import { apiRequest } from '../utils/api';
import './LatticePages.css';

const navItems = [
  { label: 'Home', to: '/lattice', icon: <LayoutDashboard size={16} />, end: true },
  { label: 'Lattice Map', to: '/lattice/graph', icon: <Network size={16} /> },
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
      <aside className={`lattice-secondary-sidebar${isSidebarCollapsed ? ' collapsed' : ''}`}>
        <div className="secondary-header">
          <div className="secondary-brand">
            <Command size={22} strokeWidth={2.4} />
            <h2>LATTICE</h2>
          </div>
          <button
            type="button"
            className="secondary-toggle-btn"
            onClick={() => setIsSidebarCollapsed((previous) => !previous)}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        <nav className="secondary-nav-list">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'secondary-nav-item active' : 'secondary-nav-item')}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="lattice-main-content">
        <header className="main-topbar">
          <div className="search-bar" onClick={() => setIsSpotlightOpen(true)} style={{ cursor: 'pointer' }}>
            <Search size={16} color="#9ca3af" />
            <input type="text" placeholder="Search your lattices..." readOnly style={{ cursor: 'pointer' }} />
            <span style={{ fontSize: '0.85rem', color: '#6b7280', marginLeft: '8px' }}>⌘K</span>
          </div>

          <div className="topbar-actions">
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