import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Command,
  SquarePlus,
  Lightbulb,
  Users,
  Target,
  Activity,
  Zap,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  CircleUserRound,
} from 'lucide-react';
import { apiRequest } from '../utils/api';
import './LatticePages.css';

const navItems = [
  { label: 'Home', to: '/lattice', icon: <Lightbulb size={18} /> },
  { label: 'Problem-Solving', to: '/lattice/problem', icon: <Zap size={18} /> },
  { label: 'Iterate and Refine', to: '/lattice/iterate', icon: <Activity size={18} /> },
  { label: 'Industry Trends', to: '/lattice/trends', icon: <Users size={18} /> },
  { label: 'Embrace Design Thinking', to: '/lattice/design', icon: <Target size={18} /> },
  { label: 'Promote Collaboration', to: '/lattice/collab', icon: <Users size={18} /> },
  { label: 'Encourage Diversity', to: '/lattice/diversity', icon: <SquarePlus size={18} /> },
  { label: 'Identify Market Needs', to: '/lattice/needs', icon: <Activity size={18} /> },
];

export const LatticeFrame = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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
            <h2>Lattice</h2>
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
          {navItems.map((item, idx) => (
            <NavLink
              key={idx}
              to={item.to}
              end={item.to === '/lattice'}
              className={({ isActive }) =>
                isActive ? 'secondary-nav-item active' : 'secondary-nav-item'
              }
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="lattice-main-content">
        <header className="main-topbar">
          <div className="search-bar">
            <Search size={16} />
            <input type="text" placeholder="Search" />
          </div>
          <div className="topbar-actions">
            <button className="action-circle" aria-label="Notifications"><Bell size={18} /></button>
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
    </div>
  );
};
