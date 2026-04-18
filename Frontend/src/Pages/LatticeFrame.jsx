import React, { useEffect, useRef, useState } from 'react';
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
import { NotificationDropdown } from '../components/NotificationDropdown';
import { getCurrentSessionUser, getForkActivity } from '../services/latticeApi';
import './LatticePages.css';

const LAST_SEEN_ACTIVITY_KEY = 'latticeActivityLastSeenAt';

const navItems = [
  { label: 'Home', to: '/lattice', icon: <LayoutDashboard size={16} />, end: true },
  { label: 'My Lattices', to: '/lattice/personal', icon: <Folder size={16} /> },
  { label: 'Forked Lattices', to: '/lattice/shared', icon: <Users size={16} /> },
  { label: 'Recent Activity', to: '/lattice/activity', icon: <Activity size={16} /> },
  { label: 'Graveyard', to: '/lattice/graveyard', icon: <Skull size={16} /> },
  { label: 'Settings', to: '/lattice/settings', icon: <Settings size={16} /> },
];

export const LatticeFrame = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [userAvatarUrl, setUserAvatarUrl] = useState(null);
  const [userProfileId, setUserProfileId] = useState('');
  const [hasUnreadActivity, setHasUnreadActivity] = useState(false);
  const notificationWrapRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const syncUnreadActivity = async () => {
      if (window.location.pathname === '/lattice/activity') {
        if (isMounted) {
          setHasUnreadActivity(false);
        }
        return;
      }

      const lastSeen = window.localStorage.getItem(LAST_SEEN_ACTIVITY_KEY);
      if (!lastSeen) {
        if (isMounted) {
          setHasUnreadActivity(false);
        }
        return;
      }

      try {
        const response = await getForkActivity();
        const events = Array.isArray(response?.events) ? response.events : [];
        const newestEvent = events[0];
        const newestEventTime = newestEvent?.createdAt ? new Date(newestEvent.createdAt).getTime() : 0;
        const lastSeenTime = new Date(lastSeen).getTime();
        const hasUnread = Number.isFinite(newestEventTime)
          && Number.isFinite(lastSeenTime)
          && newestEventTime > lastSeenTime;

        if (isMounted) {
          setHasUnreadActivity(hasUnread);
        }
      } catch {
        // Ignore unread check failures so nav stays responsive.
      }
    };

    void syncUnreadActivity();

    const intervalId = window.setInterval(() => {
      void syncUnreadActivity();
    }, 15000);

    const onSeen = () => {
      if (isMounted) {
        setHasUnreadActivity(false);
      }
    };

    const onFocus = () => {
      void syncUnreadActivity();
    };

    window.addEventListener('lattice:activity-seen', onSeen);
    window.addEventListener('focus', onFocus);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('lattice:activity-seen', onSeen);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

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

  useEffect(() => {
    if (!isNotificationOpen) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (!notificationWrapRef.current?.contains(event.target)) {
        setIsNotificationOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isNotificationOpen]);

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
                  {item.to === '/lattice/activity' && hasUnreadActivity ? <span className="topbar-nav-unread-dot" aria-label="Unread activity" /> : null}
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
            <div className="topbar-notification-wrap" ref={notificationWrapRef}>
              <button
                className="action-circle"
                aria-label="Notifications"
                aria-expanded={isNotificationOpen}
                onClick={() => setIsNotificationOpen((previous) => !previous)}
              >
                <Bell size={18} />
                {unreadNotificationCount > 0 ? (
                  <span className="notification-badge" aria-label={`${unreadNotificationCount} unread notifications`}>
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </span>
                ) : null}
              </button>
              <NotificationDropdown
                isOpen={isNotificationOpen}
                onUnreadCountChange={setUnreadNotificationCount}
                onRequestClose={() => setIsNotificationOpen(false)}
                prefetchOnMount
              />
            </div>
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

      <LatticeSpotlight
        isOpen={isSpotlightOpen}
        onClose={() => setIsSpotlightOpen(false)}
        currentUserId={userProfileId}
      />
    </div>
  );
};