import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Command, LayoutDashboard, Folder, Users, Activity, Settings,
  Search, Bell, Plus, Network, PanelLeftClose, PanelLeftOpen,
  Leaf, User
} from 'lucide-react';
import { LatticeSpotlight } from '../components/LatticeSpotlight';
import './LatticePages.css';

export const LatticeFrame = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);

  // Global Cmd+K Listener
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSpotlightOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
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
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        <nav className="secondary-nav-list">
          <NavLink to="/lattice" end className={({ isActive }) => isActive ? 'secondary-nav-item active' : 'secondary-nav-item'}>
            <span className="nav-icon"><LayoutDashboard size={16} /></span>
            <span className="nav-label">Dashboard</span>
          </NavLink>
          <NavLink to="/lattice/compost" className={({ isActive }) => isActive ? 'secondary-nav-item active' : 'secondary-nav-item'}>
            <span className="nav-icon"><Leaf size={16} /></span>
            <span className="nav-label">Compost</span>
          </NavLink>
          <NavLink to="/lattice/community" className={({ isActive }) => isActive ? 'secondary-nav-item active' : 'secondary-nav-item'}>
            <span className="nav-icon"><Users size={16} /></span>
            <span className="nav-label">Community</span>
          </NavLink>
          
          <div style={{ flex: 1 }}></div>

          <NavLink to="/lattice/profile" className={({ isActive }) => isActive ? 'secondary-nav-item active' : 'secondary-nav-item'}>
            <span className="nav-icon"><User size={16} /></span>
            <span className="nav-label">Profile</span>
          </NavLink>
          <NavLink to="/lattice/settings" className={({ isActive }) => isActive ? 'secondary-nav-item active' : 'secondary-nav-item'}>
            <span className="nav-icon"><Settings size={16} /></span>
            <span className="nav-label">Settings</span>
          </NavLink>
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
