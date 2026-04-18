import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markNotificationAsRead } from '../services/latticeApi';
import { Loader2, RefreshCw } from 'lucide-react';

const formatRelativeTime = (value) => {
  if (!value) {
    return 'Just now';
  }

  const targetDate = new Date(value);
  if (Number.isNaN(targetDate.getTime())) {
    return 'Just now';
  }

  const now = Date.now();
  const diffMs = now - targetDate.getTime();
  const absDiff = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absDiff < minute) {
    return 'Just now';
  }

  if (absDiff < hour) {
    return rtf.format(-Math.round(diffMs / minute), 'minute');
  }

  if (absDiff < day) {
    return rtf.format(-Math.round(diffMs / hour), 'hour');
  }

  if (absDiff < 2 * day) {
    return 'Yesterday';
  }

  return rtf.format(-Math.round(diffMs / day), 'day');
};

export const NotificationDropdown = ({
  isOpen = false,
  onUnreadCountChange,
  onRequestClose,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [markingMap, setMarkingMap] = useState({});
  const bodyRef = useRef(null);
  const isFetchingRef = useRef(false);
  const scrollTopRef = useRef(0);
  const mountedRef = useRef(true);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item?.isRead).length,
    [notifications]
  );

  useEffect(() => {
    if (typeof onUnreadCountChange === 'function') {
      onUnreadCountChange(unreadCount);
    }
  }, [onUnreadCountChange, unreadCount]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchNotifications = async ({ silent = false } = {}) => {
    if (isFetchingRef.current) {
      return false;
    }

    isFetchingRef.current = true;

    if (bodyRef.current) {
      scrollTopRef.current = bodyRef.current.scrollTop;
    }

    if (!silent) {
      setLoading(true);
    }

    setError('');

    try {
      const response = await getNotifications();

      if (!mountedRef.current) {
        return false;
      }

      setNotifications(Array.isArray(response?.notifications) ? response.notifications : []);

      window.requestAnimationFrame(() => {
        if (bodyRef.current) {
          bodyRef.current.scrollTop = scrollTopRef.current;
        }
      });

      return true;
    } catch (requestError) {
      if (mountedRef.current) {
        setError(requestError?.message || 'Unable to load notifications.');
      }
      return false;
    } finally {
      if (mountedRef.current && !silent) {
        setLoading(false);
      }

      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    void fetchNotifications({ silent: false });

    const intervalId = window.setInterval(() => {
      void fetchNotifications({ silent: true });
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isOpen]);

  const items = useMemo(() => {
    return notifications.map((item) => ({
      ...item,
      relativeTime: formatRelativeTime(item?.createdAt),
    }));
  }, [notifications]);

  const markSingleAsRead = async (notificationId) => {
    if (!notificationId) {
      return;
    }

    const target = notifications.find((entry) => String(entry?._id) === String(notificationId));
    if (!target || target.isRead || markingMap[notificationId]) {
      return;
    }

    setMarkingMap((previous) => ({ ...previous, [notificationId]: true }));

    try {
      await markNotificationAsRead(notificationId);
      setNotifications((previous) => previous.map((entry) => (
        String(entry?._id) === String(notificationId)
          ? { ...entry, isRead: true }
          : entry
      )));
    } catch {
      // Keep UI stable and continue navigation even if mark-as-read fails.
    } finally {
      setMarkingMap((previous) => {
        const next = { ...previous };
        delete next[notificationId];
        return next;
      });
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications
      .filter((entry) => !entry?.isRead)
      .map((entry) => entry?._id)
      .filter(Boolean);

    if (!unreadIds.length) {
      return;
    }

    setNotifications((previous) => previous.map((entry) => ({ ...entry, isRead: true })));

    await Promise.allSettled(
      unreadIds.map((id) => markNotificationAsRead(id))
    );
  };

  const handleManualRefresh = () => {
    void fetchNotifications({ silent: false });
  };

  const onNotificationClick = async (item) => {
    if (!item) {
      return;
    }

    if (typeof onRequestClose === 'function') {
      onRequestClose();
    }

    if (item.link) {
      navigate(item.link);
    }

    void markSingleAsRead(item._id);
  };

  const hasNotifications = items.length > 0;

  return (
    <div className={`notification-dropdown ${isOpen ? 'open' : ''}`} role="menu" aria-label="Notifications">
      <div className="notification-dropdown-header">
        <span>Notifications</span>
        <div className="notification-dropdown-header-actions">
          <button
            type="button"
            className="notification-refresh-btn"
            onClick={handleManualRefresh}
            disabled={loading || isFetchingRef.current}
            aria-label="Refresh notifications"
            title="Refresh notifications"
          >
            {loading ? <Loader2 size={13} className="notification-refresh-spinner" /> : <RefreshCw size={13} />}
          </button>
          {items.length > 0 && unreadCount > 0 ? (
            <button type="button" className="notification-mark-all-btn" onClick={() => void markAllAsRead()}>
              Mark all as read
            </button>
          ) : null}
        </div>
      </div>

      <div className="notification-dropdown-body" ref={bodyRef}>
        {loading ? <p className="notification-dropdown-state">Loading notifications...</p> : null}

        {!loading && error ? <p className="notification-dropdown-state error">{error}</p> : null}

        {!loading && !error && !hasNotifications ? (
          <div className="notification-empty-state">
            <div className="notification-empty-emoji">🎉</div>
            <p className="notification-empty-title">You're all caught up</p>
            <p className="notification-empty-subtitle">No new notifications</p>
          </div>
        ) : null}

        {!loading && !error && hasNotifications ? (
          <ul className="notification-list">
            {items.map((item) => (
              <li key={item._id}>
                <button
                  type="button"
                  className={`notification-item ${item.isRead ? 'read' : 'unread'} ${markingMap[item._id] ? 'marking' : ''}`}
                  onClick={() => void onNotificationClick(item)}
                >
                  <p className="notification-item-message">{item.message}</p>
                  <span className="notification-item-time">{item.relativeTime}</span>
                </button>
                <span className="notification-item-divider" aria-hidden="true" />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
};
