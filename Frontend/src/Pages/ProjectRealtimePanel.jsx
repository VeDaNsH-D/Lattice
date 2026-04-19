import React, { useEffect, useMemo, useRef, useState } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { io } from 'socket.io-client';
import { Mic, MicOff, ScreenShare, Send, Users, Video, VideoOff } from 'lucide-react';
import { apiRequest, BACKEND_ORIGIN } from '../utils/api';
import './ProjectRealtimePanel.css';

const SOCKET_URL = String(import.meta.env.VITE_SOCKET_URL || '').trim() || BACKEND_ORIGIN;
const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID || '';
const AGORA_TEMP_TOKEN = import.meta.env.VITE_AGORA_TEMP_TOKEN || import.meta.env.VITE_AGORA_TOKEN || '';
const AGORA_CHANNEL_PREFIX = import.meta.env.VITE_AGORA_CHANNEL_PREFIX || 'lattice';
const AGORA_FORCE_NO_TOKEN = String(import.meta.env.VITE_AGORA_FORCE_NO_TOKEN || '').trim().toLowerCase() === 'true';
const AGORA_ALLOW_TEMP_TOKEN_FALLBACK = String(import.meta.env.VITE_AGORA_ALLOW_TEMP_TOKEN_FALLBACK || '').trim().toLowerCase() === 'true';
const IS_LOCAL_DEV_HOST = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
const SHELF_ACTIVITY_WINDOW_MS = 15 * 60 * 1000;

const buildAgoraChannelName = (projectId) => `${AGORA_CHANNEL_PREFIX}-${String(projectId || 'room')}`;

const resolveShelfWeather = ({ participantCount, activeRemoteCount, recentChatCount, isCallActive, roomCallActive, screenShareOwner }) => {
  const signalScore = (
    Math.min(participantCount, 5) * 2
    + Math.min(activeRemoteCount, 3) * 2
    + Math.min(recentChatCount, 6)
    + (isCallActive || roomCallActive ? 3 : 0)
    + (screenShareOwner ? 2 : 0)
  );

  if (signalScore >= 12 || (participantCount >= 3 && recentChatCount >= 2) || ((isCallActive || roomCallActive) && participantCount >= 2)) {
    return { label: 'Stormy', description: 'Heavy collaboration is rolling through the shelf.', tone: 'stormy', score: signalScore };
  }

  if (signalScore >= 6) {
    return { label: 'Breezy', description: 'The shelf is active with light collaboration.', tone: 'breezy', score: signalScore };
  }

  if (signalScore >= 2) {
    return { label: 'Hazy', description: 'A few signals are still drifting through.', tone: 'hazy', score: signalScore };
  }

  return { label: 'Foggy', description: 'The shelf is quiet and has been left alone.', tone: 'foggy', score: signalScore };
};

const isRecentActivity = (createdAt) => {
  if (!createdAt) {
    return false;
  }

  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return Date.now() - parsed.getTime() <= SHELF_ACTIVITY_WINDOW_MS;
};

const stopTrack = (track) => {
  if (!track) {
    return;
  }

  try {
    track.stop?.();
  } catch {
    // no-op
  }

  try {
    track.close?.();
  } catch {
    // no-op
  }
};

const MediaTile = ({ label, videoTrack, audioTrack = null, muted = false, emptyLabel = 'No stream', preferNativeVideo = false }) => {
  const containerRef = useRef(null);
  const videoElementRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const nativeVideo = videoElementRef.current;
    if (!container) {
      return undefined;
    }

    container.innerHTML = '';

    if (nativeVideo) {
      nativeVideo.srcObject = null;
    }

    if (videoTrack) {
      const mediaStreamTrack = videoTrack.getMediaStreamTrack?.();
      const canUseNativeVideo = preferNativeVideo && mediaStreamTrack && nativeVideo;

      if (canUseNativeVideo) {
        try {
          nativeVideo.srcObject = new MediaStream([mediaStreamTrack]);
          const playPromise = nativeVideo.play?.();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
              // Local preview fallback is handled by SDK playback below.
            });
          }
        } catch {
          try {
            videoTrack.play(container);
          } catch {
            // keep the empty state if play fails
          }
        }
      } else {
        try {
          videoTrack.play(container);
        } catch {
          // keep the empty state if play fails
        }
      }
    }

    return () => {
      // Do not stop tracks here. Track lifecycle is handled by join/leave helpers.
      if (container) {
        container.innerHTML = '';
      }

      if (nativeVideo) {
        nativeVideo.srcObject = null;
      }
    };
  }, [preferNativeVideo, videoTrack]);

  useEffect(() => {
    if (!audioTrack || muted) {
      return undefined;
    }

    try {
      audioTrack.play();
    } catch {
      // autoplay can be blocked by the browser
    }

    return undefined;
  }, [audioTrack, muted]);

  return (
    <div className="realtime-stream-tile">
      <span className="realtime-stream-label">{label}</span>
      {videoTrack ? (
        <>
          {preferNativeVideo ? <video ref={videoElementRef} className="realtime-video" autoPlay playsInline muted={muted} /> : null}
          <div ref={containerRef} className={preferNativeVideo ? 'realtime-video-fallback' : 'realtime-video'} />
        </>
      ) : <div className="realtime-stream-empty">{emptyLabel}</div>}
    </div>
  );
};

const normalizeParticipantName = (participant) => participant?.username || participant?.name || 'Guest';
const normalizeParticipantIdentity = (participant) => participant?.agoraUid || participant?.userId || participant?.id || '';
const toUidKey = (value) => String(value ?? '').trim();

export const ProjectRealtimePanel = ({ projectId, projectName, projectMembers = [], activeLinkId = '', roleBasedCalls = true, onParticipantsChange }) => {
  const socketRef = useRef(null);
  const agoraClientRef = useRef(null);
  const localAudioTrackRef = useRef(null);
  const localVideoTrackRef = useRef(null);
  const screenVideoTrackRef = useRef(null);
  const screenSourceStreamRef = useRef(null);
  const agoraUidRef = useRef('');
  const joinInFlightRef = useRef(false);
  const resumeCallRef = useRef(typeof window !== 'undefined' && window.sessionStorage.getItem(`lattice:active-meet:${projectId}`) === '1');

  const [username, setUsername] = useState('Guest');
  const [status, setStatus] = useState('connecting');
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [remoteMediaByUid, setRemoteMediaByUid] = useState({});
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [error, setError] = useState('');
  const [callPermission, setCallPermission] = useState('view_only');
  const [roomCallActive, setRoomCallActive] = useState(false);
  const [screenShareOwner, setScreenShareOwner] = useState('');
  const enforceRoleBasedCalls = roleBasedCalls !== false;

  const isAgoraConfigured = Boolean(AGORA_APP_ID.trim());

  const activeRemoteEntries = useMemo(
    () => Object.entries(remoteMediaByUid).filter(([, media]) => Boolean(media?.videoTrack || media?.audioTrack)),
    [remoteMediaByUid],
  );

  const resolveRemoteLabel = (uid) => {
    const uidKey = toUidKey(uid);
    const participant = participants.find((entry) => toUidKey(normalizeParticipantIdentity(entry)) === uidKey);
    return normalizeParticipantName(participant) || 'Collaborator';
  };

  const syncParticipants = (nextParticipants, snapshot = null) => {
    const safeParticipants = Array.isArray(nextParticipants) ? nextParticipants : [];
    setParticipants(safeParticipants);

    if (typeof onParticipantsChange === 'function') {
      onParticipantsChange(safeParticipants, snapshot);
    }
  };

  const clearRemoteMedia = (uid) => {
    const uidKey = toUidKey(uid);
    setRemoteMediaByUid((previous) => {
      const next = { ...previous };
      delete next[uidKey];
      return next;
    });
  };

  const ensureAgoraClient = () => {
    if (agoraClientRef.current) {
      return agoraClientRef.current;
    }

    if (!AgoraRTC.checkSystemRequirements()) {
      throw new Error('This browser does not support the Agora Web SDK.');
    }

    AgoraRTC.setLogLevel(2);

    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

    client.on('user-published', async (user, mediaType) => {
      const uid = toUidKey(user.uid);
      if (!uid || uid === toUidKey(agoraUidRef.current)) {
        return;
      }

      try {
        await client.subscribe(user, mediaType);
      } catch (subscribeError) {
        setError(subscribeError?.message || 'Unable to subscribe to remote media.');
        return;
      }

      if (mediaType === 'audio') {
        try {
          user.audioTrack?.play();
        } catch {
          // autoplay may be blocked until the user interacts with the page
        }
      }

      setRemoteMediaByUid((previous) => {
        const current = previous[uid] || { videoTrack: null, audioTrack: null };
        return {
          ...previous,
          [uid]: {
            videoTrack: mediaType === 'video' ? user.videoTrack : current.videoTrack,
            audioTrack: mediaType === 'audio' ? user.audioTrack : current.audioTrack,
          },
        };
      });
    });

    client.on('user-unpublished', (user, mediaType) => {
      const uid = toUidKey(user.uid);
      if (!uid) {
        return;
      }

      setRemoteMediaByUid((previous) => {
        const current = previous[uid];
        if (!current) {
          return previous;
        }

        const next = { ...previous };
        const updated = {
          videoTrack: mediaType === 'video' ? null : current.videoTrack,
          audioTrack: mediaType === 'audio' ? null : current.audioTrack,
        };

        if (!updated.videoTrack && !updated.audioTrack) {
          delete next[uid];
        } else {
          next[uid] = updated;
        }

        return next;
      });
    });

    client.on('user-left', (user) => {
      clearRemoteMedia(user?.uid);
    });

    client.on('connection-state-change', (currentState) => {
      if (currentState === 'DISCONNECTED') {
        setStatus('offline');
      }
    });

    agoraClientRef.current = client;
    return client;
  };

  const leaveAgoraCall = async ({ announce = true } = {}) => {
    const client = agoraClientRef.current;
    const audioTrack = localAudioTrackRef.current;
    const videoTrack = localVideoTrackRef.current;
    const screenTrack = screenVideoTrackRef.current;

    try {
      if (client) {
        const tracksToUnpublish = [audioTrack, videoTrack, screenTrack].filter(Boolean);
        if (tracksToUnpublish.length > 0) {
          await client.unpublish(tracksToUnpublish);
        }
      }
    } catch {
      // ignore cleanup failures
    }

    stopTrack(audioTrack);
    stopTrack(videoTrack);
    stopTrack(screenTrack);

    if (screenSourceStreamRef.current) {
      screenSourceStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // no-op
        }
      });
    }

    try {
      if (client && agoraUidRef.current) {
        await client.leave();
      }
    } catch {
      // ignore leave failures
    }

    localAudioTrackRef.current = null;
    localVideoTrackRef.current = null;
    screenVideoTrackRef.current = null;
    screenSourceStreamRef.current = null;
    agoraUidRef.current = '';
    joinInFlightRef.current = false;

    setLocalVideoTrack(null);
    setMicEnabled(true);
    setCameraEnabled(true);
    setRoomCallActive(false);
    setScreenShareOwner('');
    setRemoteMediaByUid({});

    if (announce) {
      socketRef.current?.emit('call:leave', { roomId: projectId });
      socketRef.current?.emit('screen-share:stop', { roomId: projectId });
    }

    window.sessionStorage.removeItem(`lattice:active-meet:${projectId}`);
  };

  const joinAgoraCall = async () => {
    if (joinInFlightRef.current || agoraUidRef.current) {
      return agoraUidRef.current;
    }

    if (AGORA_FORCE_NO_TOKEN && !IS_LOCAL_DEV_HOST) {
      throw new Error('VITE_AGORA_FORCE_NO_TOKEN=true is only allowed on localhost. Disable it in deployed environments and use backend-signed tokens.');
    }

    joinInFlightRef.current = true;
    setError('');

    try {
      const client = ensureAgoraClient();
      let channel = buildAgoraChannelName(projectId);
      let joinAppId = AGORA_APP_ID.trim();
      let initialToken = null;
      let agoraUid = 0;
      let usesSignedToken = false;

      // Try to get a fresh token from the backend (recommended approach)
      if (!AGORA_FORCE_NO_TOKEN) {
        try {
          const tokenResponse = await apiRequest('/agora/token', {
            method: 'POST',
            body: JSON.stringify({
              projectId,
              role: 'publisher',
            }),
          });

          if (tokenResponse?.success && tokenResponse?.token) {
            initialToken = tokenResponse.token;
            agoraUid = tokenResponse.uid; // IMPORTANT: Use the exact UID from token
            if (typeof tokenResponse?.channel === 'string' && tokenResponse.channel.trim()) {
              channel = tokenResponse.channel.trim();
            }

            if (typeof tokenResponse?.appId === 'string' && tokenResponse.appId.trim()) {
              if (joinAppId && joinAppId !== tokenResponse.appId.trim()) {
                console.warn('[Agora] Frontend VITE_AGORA_APP_ID differs from backend token appId. Using backend appId for join.');
              }
              joinAppId = tokenResponse.appId.trim();
            }

            usesSignedToken = true;
            console.log('[Agora] Got signed token from backend with UID:', agoraUid, 'channel:', channel);
          }
        } catch (tokenError) {
          console.warn('Failed to fetch token from backend:', tokenError?.message);

          if (AGORA_ALLOW_TEMP_TOKEN_FALLBACK && AGORA_TEMP_TOKEN.trim()) {
            initialToken = AGORA_TEMP_TOKEN.trim();
          } else if (!AGORA_FORCE_NO_TOKEN) {
            throw new Error(`Unable to fetch signed Agora token from backend: ${tokenError?.message || 'unknown error'}`);
          }
        }
      }

      if (!joinAppId) {
        throw new Error('Missing Agora App ID. Set VITE_AGORA_APP_ID or ensure backend /agora/token returns appId.');
      }

      if (!usesSignedToken && !AGORA_FORCE_NO_TOKEN && !initialToken) {
        throw new Error('Agora call requires a signed token. Backend token fetch failed and temp-token fallback is disabled.');
      }

      let uid;

      try {
        uid = await client.join(joinAppId, channel, initialToken, agoraUid);
      } catch (joinError) {
        const message = String(joinError?.message || '').toLowerCase();
        const tokenLikelyInvalid = message.includes('invalid token') || message.includes('can_not_get_gateway_server') || message.includes('authorized failed');

        if (tokenLikelyInvalid) {
          if (usesSignedToken) {
            throw new Error('Agora rejected the signed token. Verify AGORA_APP_ID/AGORA_APP_CERTIFICATE pair on backend and restart the server.');
          }
          throw new Error('Agora token join failed. Temp token appears invalid or from a different Agora app.');
        }

        throw joinError;
      }

      agoraUidRef.current = String(uid);

      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      localAudioTrackRef.current = audioTrack;
      localVideoTrackRef.current = videoTrack;
      setLocalVideoTrack(videoTrack);

      await client.publish([audioTrack, videoTrack]);

      socketRef.current?.emit('agora:sync', {
        roomId: projectId,
        agoraUid: String(uid),
      });

      setMicEnabled(true);
      setCameraEnabled(true);
      setRoomCallActive(true);
      resumeCallRef.current = true;
      window.sessionStorage.setItem(`lattice:active-meet:${projectId}`, '1');

      return uid;
    } finally {
      joinInFlightRef.current = false;
    }
  };

  const startCall = async () => {
    try {
      if (enforceRoleBasedCalls && callPermission === 'view_only') {
        setError('Your role does not allow starting calls.');
        return;
      }

      const uid = await joinAgoraCall();
      socketRef.current?.emit('call:start', { roomId: projectId, agoraUid: String(uid) });
    } catch (mediaError) {
      await leaveAgoraCall({ announce: false });
      setError(mediaError?.message || 'Unable to start the Agora call.');
    }
  };

  const endCall = async () => {
    await leaveAgoraCall({ announce: true });
  };

  const ensureJoinedForMedia = async () => {
    if (!agoraUidRef.current) {
      await startCall();
    }
  };

  const toggleMic = async () => {
    await ensureJoinedForMedia();
    const next = !micEnabled;

    try {
      await localAudioTrackRef.current?.setEnabled?.(next);
      setMicEnabled(next);
    } catch (toggleError) {
      setError(toggleError?.message || 'Unable to toggle microphone.');
    }
  };

  const toggleCamera = async () => {
    await ensureJoinedForMedia();
    const next = !cameraEnabled;

    try {
      await localVideoTrackRef.current?.setEnabled?.(next);
      setCameraEnabled(next);
    } catch (toggleError) {
      setError(toggleError?.message || 'Unable to toggle camera.');
    }
  };

  const stopScreenShare = async ({ announce = true } = {}) => {
    const client = agoraClientRef.current;
    const screenTrack = screenVideoTrackRef.current;
    const cameraTrack = localVideoTrackRef.current;

    if (!screenTrack) {
      return;
    }

    try {
      if (client) {
        await client.unpublish(screenTrack);
      }
    } catch {
      // ignore cleanup failures
    }

    stopTrack(screenTrack);
    screenVideoTrackRef.current = null;

    if (screenSourceStreamRef.current) {
      screenSourceStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // no-op
        }
      });
    }
    screenSourceStreamRef.current = null;

    if (cameraTrack && client) {
      try {
        await client.publish(cameraTrack);
      } catch {
        // ignore republish failures
      }
    }

    setLocalVideoTrack(cameraTrack || null);
    setScreenShareOwner('');

    if (announce) {
      socketRef.current?.emit('screen-share:stop', { roomId: projectId });
    }
  };

  const startShare = async () => {
    try {
      await ensureJoinedForMedia();

      if (screenVideoTrackRef.current) {
        return;
      }

      const client = agoraClientRef.current;
      const shareStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const nativeVideoTrack = shareStream.getVideoTracks()[0];

      if (!nativeVideoTrack) {
        throw new Error('Screen capture did not return a video track.');
      }

      screenSourceStreamRef.current = shareStream;
      const screenTrack = AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: nativeVideoTrack });
      screenVideoTrackRef.current = screenTrack;

      if (localVideoTrackRef.current) {
        await client.unpublish(localVideoTrackRef.current);
      }
      await client.publish(screenTrack);

      setLocalVideoTrack(screenTrack);
      setScreenShareOwner('You');
      socketRef.current?.emit('screen-share:start', { roomId: projectId });

      nativeVideoTrack.addEventListener('ended', () => {
        void stopScreenShare({ announce: true });
      }, { once: true });
    } catch (shareError) {
      setError(shareError?.message || 'Unable to start screen sharing.');
    }
  };

  const sendMessage = (event) => {
    event.preventDefault();

    const text = input.trim();
    if (!text) {
      return;
    }

    socketRef.current?.emit('chat:send', {
      roomId: projectId,
      message: text,
    });

    setInput('');
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const me = await apiRequest('/auth/me', { method: 'GET' });
        const nextName = me?.user?.name || me?.user?.username || me?.user?.email || 'Guest';
        const nextUserId = me?.user?.id || me?.user?._id || '';
        const nextAvatarUrl = me?.user?.avatarUrl || '';

        if (!mounted) {
          return;
        }

        setUsername(nextName);

        try {
          const membership = await apiRequest(`/projects/${projectId}/membership`, { method: 'GET' });
          const nextPermission = membership?.membership?.role?.permissions || 'edit';
          if (mounted) {
            setCallPermission(nextPermission);
          }
        } catch {
          if (mounted) {
            // Do not block calling if membership endpoint is unavailable.
            setCallPermission('edit');
          }
        }

        const authToken = window.localStorage.getItem('token') || window.localStorage.getItem('latticeToken') || '';

        const socket = io(SOCKET_URL, {
          transports: ['websocket', 'polling'],
          autoConnect: true,
          auth: authToken ? { token: authToken } : {},
        });

        socketRef.current = socket;

        socket.on('connect', () => {
          setStatus('connected');
          socket.emit('room:join', {
            roomId: projectId,
            username: nextName,
            userId: nextUserId,
            avatarUrl: nextAvatarUrl,
          });
        });

        socket.on('connect_error', () => setStatus('offline'));
        socket.on('disconnect', () => setStatus('offline'));

        socket.on('room:state', (state) => {
          syncParticipants(state?.users || [], state);
          setRoomCallActive(Boolean(state?.call?.active));
          setScreenShareOwner(state?.screenShare?.active ? state?.screenShare?.username || 'Collaborator' : '');
        });

        socket.on('presence:update', ({ users = [] }) => {
          syncParticipants(users, null);
        });

        socket.on('chat:new', (entry) => {
          setMessages((previous) => [entry, ...previous].slice(0, 80));
        });

        socket.on('call:state', (payload = {}) => {
          setRoomCallActive(Boolean(payload?.active));

          if (!payload?.active) {
            setScreenShareOwner('');
            void leaveAgoraCall({ announce: false });
          }
        });

        socket.on('screen-share:state', (payload = {}) => {
          setScreenShareOwner(payload?.active ? payload?.username || 'Collaborator' : '');
        });
      } catch (initError) {
        setStatus('offline');
        setError(initError?.message || 'Unable to start collaborative room.');
      }
    };

    void init();

    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      }
      void leaveAgoraCall({ announce: false });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    resumeCallRef.current = window.sessionStorage.getItem(`lattice:active-meet:${projectId}`) === '1';
  }, [projectId]);

  useEffect(() => {
    if (status === 'connected' && callPermission !== 'view_only' && (resumeCallRef.current || roomCallActive) && !agoraUidRef.current && !joinInFlightRef.current) {
      void startCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callPermission, roomCallActive, status]);

  useEffect(() => {
    const onOpenChat = (event) => {
      const nextProjectId = event?.detail?.projectId;
      const nextQuery = event?.detail?.query;

      if (nextProjectId && String(nextProjectId) !== String(projectId)) {
        return;
      }

      if (typeof nextQuery === 'string' && nextQuery.trim()) {
        setInput(nextQuery.trim());
      }
    };

    window.addEventListener('lattice:open-chat', onOpenChat);
    return () => window.removeEventListener('lattice:open-chat', onOpenChat);
  }, [projectId]);

  useEffect(() => {
    if (!socketRef.current || !projectId) {
      return;
    }

    socketRef.current.emit('link:view', {
      roomId: projectId,
      linkId: activeLinkId || '',
    });
  }, [activeLinkId, projectId]);

  const isCallActive = Boolean(localVideoTrack);
  const canStartCall = !enforceRoleBasedCalls || callPermission !== 'view_only';
  const hasProjectMembers = Array.isArray(projectMembers) && projectMembers.length > 0;
  const participantCount = hasProjectMembers ? projectMembers.length : participants.length;
  const callAccessLabel = enforceRoleBasedCalls ? callPermission.replace(/_/g, ' ') : 'open';
  const networkNote = isAgoraConfigured
    ? 'Agora RTC is configured for global voice, video, and screen sharing.'
    : 'Add VITE_AGORA_APP_ID to the frontend environment.';
  const recentChatCount = messages.filter((message) => isRecentActivity(message.createdAt)).length;
  const shelfWeather = resolveShelfWeather({
    participantCount: participants.length,
    activeRemoteCount: activeRemoteEntries.length,
    recentChatCount,
    isCallActive,
    roomCallActive,
    screenShareOwner,
  });

  return (
    <section className="project-realtime-wrap">
      <div className="project-realtime-head">
        <div>
          <p className="project-realtime-kicker">Collaborative Realtime Room</p>
          <h3>{projectName} Call + Chat</h3>
          <p className="project-realtime-access-label">Call access: {callAccessLabel}</p>
        </div>
        <div className={`project-realtime-status status-${status}`}>{status}</div>
      </div>

      <div className="project-realtime-badges">
        {isCallActive || roomCallActive ? <span className="project-realtime-badge is-live">Meet live</span> : null}
        {screenShareOwner ? <span className="project-realtime-badge is-share">Shared screen: {screenShareOwner}</span> : null}
      </div>

      <p className={`project-realtime-network-note ${isAgoraConfigured ? 'has-turn' : 'needs-turn'}`}>
        {networkNote}
      </p>

      <div className={`project-shelf-weather tone-${shelfWeather.tone}`} aria-label={`Shelf Weather ${shelfWeather.label}`}>
        <div className="project-shelf-weather-copy">
          <span className="project-shelf-weather-kicker">Shelf Weather</span>
          <strong>{shelfWeather.label}</strong>
          <p>{shelfWeather.description}</p>
        </div>
        <div className="project-shelf-weather-metrics" aria-hidden="true">
          <span>{participants.length} online</span>
          <span>{recentChatCount} recent chat{recentChatCount === 1 ? '' : 's'}</span>
          <span>{(isCallActive || roomCallActive) ? 'Call live' : 'Call idle'}</span>
        </div>
      </div>

      <div className="project-realtime-actions">
        <button
          type="button"
          onClick={isCallActive ? () => void endCall() : () => void startCall()}
          className={isCallActive ? 'danger' : ''}
          disabled={!canStartCall && !isCallActive}
          title={!canStartCall ? 'Your role is view-only' : ''}
        >
          <Video size={15} /> {isCallActive ? 'End Call' : 'Start Call'}
        </button>
        <button type="button" onClick={() => void toggleMic()}>{micEnabled ? <Mic size={15} /> : <MicOff size={15} />}{micEnabled ? 'Mute' : 'Unmute'}</button>
        <button type="button" onClick={() => void toggleCamera()}>{cameraEnabled ? <Video size={15} /> : <VideoOff size={15} />}{cameraEnabled ? 'Camera Off' : 'Camera On'}</button>
        <button type="button" onClick={() => void startShare()}><ScreenShare size={15} /> Share Screen</button>
      </div>

      {screenShareOwner ? <p className="project-realtime-share-status">{screenShareOwner} is sharing screen</p> : null}
      {error ? <p className="project-realtime-error">{error}</p> : null}

      <div className="project-realtime-grid">
        <div className="project-realtime-video-col">
          <MediaTile label="You" videoTrack={localVideoTrack} muted preferNativeVideo />
          <div className="project-realtime-remote-list">
            {activeRemoteEntries.length > 0 ? (
              activeRemoteEntries.map(([uid, media]) => (
                <MediaTile
                  key={uid}
                  label={resolveRemoteLabel(uid)}
                  videoTrack={media.videoTrack}
                  audioTrack={media.audioTrack}
                  emptyLabel={media.audioTrack ? 'Audio only' : 'No stream'}
                />
              ))
            ) : (
              <div className="realtime-stream-empty">No remote participants in call</div>
            )}
          </div>
        </div>

        <div className="project-realtime-side-col">
          <div className="project-realtime-participants">
            <h4><Users size={15} /> Participants ({participantCount})</h4>
            <div className="project-realtime-participant-list">
              {hasProjectMembers ? (
                projectMembers.map((member) => {
                  const isOnline = participants.some((participant) => {
                    const participantUserId = toUidKey(participant.userId);
                    const participantAgoraUid = toUidKey(participant.agoraUid);
                    const memberUserId = toUidKey(member.id || member.userId);

                    if (participantUserId && memberUserId && participantUserId === memberUserId) {
                      return true;
                    }

                    if (participantAgoraUid && member.agoraUid && toUidKey(member.agoraUid) === participantAgoraUid) {
                      return true;
                    }

                    const participantName = String(participant.username || participant.name || '').trim().toLowerCase();
                    const memberName = String(member.name || '').trim().toLowerCase();
                    return participantName && memberName && participantName === memberName;
                  });

                  return (
                    <div key={member.id} className="project-realtime-participant-item">
                      {member.name || member.email || 'Member'}
                      {member.isOwner ? ' (Owner)' : ''}
                      {isOnline ? ' • online' : ''}
                    </div>
                  );
                })
              ) : participants.length > 0 ? (
                participants.map((participant) => (
                  <div key={participant.id} className="project-realtime-participant-item">
                    {participant.username || participant.name || 'Guest'}
                  </div>
                ))
              ) : (
                <div className="project-realtime-empty">No participants yet.</div>
              )}
            </div>
          </div>

          <div className="project-realtime-chat">
            <h4>Room Chat</h4>
            <div className="project-realtime-chat-feed">
              {messages.length > 0 ? (
                messages.map((message) => (
                  <div key={message.id} className="project-realtime-chat-item">
                    <strong>{message.sender?.username || 'Guest'}</strong>
                    <span>{message.message}</span>
                  </div>
                ))
              ) : (
                <div className="project-realtime-empty">No messages yet.</div>
              )}
            </div>
            <form onSubmit={sendMessage} className="project-realtime-chat-form">
              <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Message ${username}`} />
              <button type="submit"><Send size={15} /></button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
