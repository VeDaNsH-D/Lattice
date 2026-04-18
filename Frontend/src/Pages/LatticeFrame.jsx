import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  Command,
  LayoutDashboard,
  Folder,
  Users,
  Activity,
  Skull,
  Settings,
  Search,
  Bell,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  CircleUserRound,
} from 'lucide-react';
import { LatticeSpotlight } from '../components/LatticeSpotlight';
import { getCurrentSessionUser } from '../services/latticeApi';
import './LatticePages.css';

const navItems = [
  { label: 'Home', to: '/lattice', icon: <LayoutDashboard size={16} />, end: true },
  { label: 'My Lattices', to: '/lattice/personal', icon: <Folder size={16} /> },
  { label: 'Shared Spaces', to: '/lattice/shared', icon: <Users size={16} /> },
  { label: 'Recent Activity', to: '/lattice/activity', icon: <Activity size={16} /> },
  { label: 'Graveyard', to: '/lattice/graveyard', icon: <Skull size={16} /> },
  { label: 'Settings', to: '/lattice/settings', icon: <Settings size={16} /> },
];

export const LatticeFrame = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [userAvatarUrl, setUserAvatarUrl] = useState(null);
  const [userProfileId, setUserProfileId] = useState('');

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
      try {
        const response = await getCurrentSessionUser();

        if (isMounted) {
          setUserAvatarUrl(response?.avatarUrl || null);
          setUserProfileId(response?.id || response?._id || '');
        }
      } catch {
        if (isMounted) {
          setUserAvatarUrl(null);
          setUserProfileId('');
        }
      }
    };

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleProfileUpdate = (event) => {
      const nextAvatar = event?.detail?.avatar || event?.detail?.avatarUrl || null;
      const nextUserId = event?.detail?.id || event?.detail?._id || '';

      if (nextAvatar !== undefined) {
        setUserAvatarUrl(nextAvatar);
      }

      if (nextUserId) {
        setUserProfileId(String(nextUserId));
      }
    };

    window.addEventListener('lattice:current-user-updated', handleProfileUpdate);
    return () => window.removeEventListener('lattice:current-user-updated', handleProfileUpdate);
  }, []);

  return (
    <div className="lattice-dashboard">
      <main className="lattice-main-content">
        <header className="main-topbar">
          <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
            <div className="topbar-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#111827' }}>
              <Command size={22} strokeWidth={2.4} />
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, letterSpacing: '-0.025em', fontFamily: 'var(--font-display)' }}>LATTICE</h2>
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
            {userProfileId ? (
              <Link to={`/profile/${userProfileId}`} className="user-avatar user-avatar-link" aria-label="Open your profile">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt="User profile" className="user-avatar-image" />
                ) : (
                  <CircleUserRound size={20} strokeWidth={1.8} />
                )}
              </Link>
            ) : (
              <div className="user-avatar" aria-label="User profile">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt="User profile" className="user-avatar-image" />
                ) : (
                  <CircleUserRound size={20} strokeWidth={1.8} />
                )}
              </div>
            )}
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