import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Command, LayoutDashboard, Folder, Users, Activity, Settings, 
  Search, Bell, Plus, Menu, X, Network
} from 'lucide-react';
import { LatticeSpotlight } from '../components/LatticeSpotlight';
import './LatticePages.css';

export const LatticeFrame = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    <div className="lat-dashboard-wrapper">
      
      {/* Mobile Overlay */}
      {sidebarOpen && <div className="lat-sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}

      {/* Left Sidebar */}
      <aside className={`lat-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="lat-sidebar-header">
          <div className="lat-logo-container">
            <Command size={20} strokeWidth={2.5} color="#2d3748" />
            <span className="lat-logo-text">LATTICE</span>
          </div>
          <button className="lat-mobile-close" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="lat-sidebar-search">
          <Search size={16} color="#a0aec0" />
          <input type="text" placeholder="Search your lattices" />
        </div>

        <nav className="lat-sidebar-nav">
          <div className="lat-nav-group">
            <NavLink to="/lattice" end className={({isActive}) => isActive ? "lat-nav-item active" : "lat-nav-item"}>
              <LayoutDashboard size={16} /> Home
            </NavLink>
            <NavLink to="/lattice/graph" className={({isActive}) => isActive ? "lat-nav-item active" : "lat-nav-item"}>
              <Network size={16} /> Lattice Map
            </NavLink>
            <NavLink to="/lattice/personal" className={({isActive}) => isActive ? "lat-nav-item active" : "lat-nav-item"}>
              <Folder size={16} /> My Lattices
            </NavLink>
            <NavLink to="/lattice/shared" className={({isActive}) => isActive ? "lat-nav-item active" : "lat-nav-item"}>
              <Users size={16} /> Shared Spaces
            </NavLink>
            <NavLink to="/lattice/activity" className={({isActive}) => isActive ? "lat-nav-item active" : "lat-nav-item"}>
              <Activity size={16} /> Recent Activity
            </NavLink>
          </div>

          <div className="lat-nav-group" style={{marginTop: 'auto'}}>
            <NavLink to="/lattice/settings" className={({isActive}) => isActive ? "lat-nav-item active" : "lat-nav-item"}>
              <Settings size={16} /> Settings
            </NavLink>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="lat-main">
        {/* Top Header */}
        <header className="lat-header">
          <div className="lat-header-left">
            <button className="lat-mobile-toggle" onClick={() => setSidebarOpen(true)}>
              <Menu size={22} />
            </button>
            <div className="lat-global-search" onClick={() => setIsSpotlightOpen(true)} style={{cursor: 'pointer'}}>
              <Search size={16} color="#a0aec0" />
              <input type="text" placeholder="Search your lattices..." readOnly style={{cursor: 'pointer'}} />
              <kbd className="lat-shortcut">⌘K</kbd>
            </div>
          </div>
          <div className="lat-header-right">
            <button className="lat-btn-primary">
              <Plus size={16} /> New Lattice
            </button>
            <button className="lat-icon-btn">
              <Bell size={18} />
              <span className="lat-notification-dot"></span>
            </button>
            <div className="lat-avatar"></div>
          </div>
        </header>

        {/* Scrollable Canvas for Children */}
        <div className="lat-content-scroll">
          {children}
        </div>
      </main>

      <LatticeSpotlight isOpen={isSpotlightOpen} onClose={() => setIsSpotlightOpen(false)} />
    </div>
  );
};
