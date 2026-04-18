import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  SquarePlus, Lightbulb, Users, Target, Activity, Zap, 
  Search, PanelLeftClose, Upload
} from 'lucide-react';
import './LatticePages.css';

const navItems = [
  { label: 'Generate Ideas', to: '/lattice', icon: <Lightbulb size={18} /> },
  { label: 'Problem-Solving', to: '/lattice/problem', icon: <Zap size={18} /> },
  { label: 'Iterate and Refine', to: '/lattice/iterate', icon: <Activity size={18} /> },
  { label: 'Industry Trends', to: '/lattice/trends', icon: <Users size={18} /> },
  { label: 'Embrace Design Thinking', to: '/lattice/design', icon: <Target size={18} /> },
  { label: 'Promote Collaboration', to: '/lattice/collab', icon: <Users size={18} /> },
  { label: 'Encourage Diversity', to: '/lattice/diversity', icon: <SquarePlus size={18} /> },
  { label: 'Identify Market Needs', to: '/lattice/needs', icon: <Activity size={18} /> },
];

export const LatticeFrame = ({ children }) => {
  return (
    <div className="lattice-dashboard">
      
      {/* 1. Micro Sidebar */}
      <aside className="lattice-micro-sidebar">
        <div className="micro-brand">L W</div>
        <div className="micro-icons">
          <div className="micro-icon active" style={{background: 'linear-gradient(135deg, #a6c1ee, #fbc2eb)'}}></div>
          <div className="micro-icon" style={{background: 'linear-gradient(135deg, #ffafbd, #ffc3a0)'}}></div>
          <div className="micro-icon" style={{background: 'linear-gradient(135deg, #2af598, #009efd)'}}></div>
          <div className="micro-icon" style={{background: 'linear-gradient(135deg, #a18cd1, #fbc2eb)'}}></div>
          <div className="micro-icon" style={{background: 'linear-gradient(135deg, #ff9a9e, #fecfef)'}}></div>
          <div className="micro-icon" style={{background: 'linear-gradient(135deg, #f6d365, #fda085)'}}></div>
          <div className="micro-icon" style={{background: 'linear-gradient(135deg, #ff0844, #ffb199)'}}></div>
        </div>
        <button className="micro-add-btn">
          <SquarePlus size={20} />
        </button>
      </aside>

      {/* 2. Secondary Navigation */}
      <aside className="lattice-secondary-sidebar">
        <div className="secondary-header">
          <h2>LatticeWriter™</h2>
          <PanelLeftClose size={18} color="#9ca3af" />
        </div>
        <nav className="secondary-nav-list">
          {navItems.map((item, idx) => (
            <NavLink
              key={idx}
              to={item.to}
              end={item.to === '/lattice'}
              className={({ isActive }) =>
                isActive || item.to === '/lattice' ? 'secondary-nav-item active' : 'secondary-nav-item'
              }
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* 3. Main Content Area */}
      <main className="lattice-main-content">
        <header className="main-topbar">
          <div className="search-bar">
            <Search size={16} />
            <input type="text" placeholder="Search" />
          </div>
          <div className="topbar-actions">
            <button className="action-circle"><Upload size={18} /></button>
            <div className="user-avatar"></div>
          </div>
        </header>

        <div className="main-scrollable">
          {children}
        </div>
      </main>

      {/* 4. Context Panel (Bookmarks) */}
      <aside className="lattice-context-panel">
        <div className="context-header">
          <h3>Bookmarks</h3>
        </div>
        <div className="context-scrollable">
          
          <div className="bookmark-card">
            <div className="bookmark-icon" style={{background: 'linear-gradient(135deg, #f6d365, #fda085)'}}></div>
            <h4>Problem-Solving</h4>
            <p>Focus on solving real-world problems rather than chasing trends or gimmicks. Encourage team members to think critically.</p>
          </div>

          <div className="bookmark-card">
            <div className="bookmark-icon" style={{background: 'linear-gradient(135deg, #ff0844, #ffb199)'}}></div>
            <h4>Iterate and Refine</h4>
            <p>Embrace an iterative approach to idea generation, where concepts are refined through feedback and iteration.</p>
          </div>

        </div>
      </aside>

    </div>
  );
};
