import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Mic, MicOff, ScreenShare, Send, Users, Video, VideoOff } from 'lucide-react';
import { apiRequest } from '../utils/api';
import './ProjectRealtimePanel.css';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000';
const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

const StreamTile = ({ label, stream, muted = false }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream || null;
    }
  }, [stream]);

  return (
    <div className="realtime-stream-tile">
      <span className="realtime-stream-label">{label}</span>
      {stream ? (
        <video ref={ref} autoPlay playsInline muted={muted} className="realtime-video" />
      ) : (
        <div className="realtime-stream-empty">No stream</div>
      )}
    </div>
  );
};

export const ProjectRealtimePanel = ({ projectId, projectName, projectMembers = [], activeLinkId = '', roleBasedCalls = true, onParticipantsChange }) => {
  const socketRef = useRef(null);
  const peersRef = useRef(new Map());
  const selfIdRef = useRef('');
  const localPreviewRef = useRef(null);
  const activeStreamRef = useRef(null);
  const resumeCallRef = useRef(typeof window !== 'undefined' && window.sessionStorage.getItem(`lattice:active-meet:${projectId}`) === '1');
  const isCallActiveRef = useRef(false);

  const [username, setUsername] = useState('Guest');
  const [status, setStatus] = useState('connecting');
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [error, setError] = useState('');
  const [callPermission, setCallPermission] = useState('view_only');
  const [roomCallActive, setRoomCallActive] = useState(false);
  const [screenShareOwner, setScreenShareOwner] = useState('');
  const enforceRoleBasedCalls = roleBasedCalls !== false;

  const attachLocalTracks = (peer, stream = localStream) => {
    if (!peer || !stream || peer.localTracksAttached) {
      return;
    }

    peer.senders = stream.getTracks().map((track) => peer.connection.addTrack(track, stream));
    peer.localTracksAttached = true;
  };

  const cleanupPeer = (peerId) => {
    const peer = peersRef.current.get(peerId);
    if (peer) {
      try {
        peer.connection.close();
      } catch {
        // no-op
      }
      peersRef.current.delete(peerId);
    }

    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  };

  const ensureMedia = async () => {
    if (localStream) {
      return localStream;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    activeStreamRef.current = stream;
    setLocalStream(stream);
    setMicEnabled(true);
    setCameraEnabled(true);

    if (localPreviewRef.current) {
      localPreviewRef.current.srcObject = stream;
    }

    peersRef.current.forEach((peer) => attachLocalTracks(peer, stream));
    return stream;
  };

  const stopActiveStream = (stream) => {
    if (!stream) {
      return;
    }

    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // no-op
      }
    });
  };

  const endCall = () => {
    peersRef.current.forEach((peer, peerId) => {
      try {
        peer.connection.close();
      } catch {
        // no-op
      }

      cleanupPeer(peerId);
    });

    stopActiveStream(activeStreamRef.current);
    activeStreamRef.current = null;

    if (localPreviewRef.current) {
      localPreviewRef.current.srcObject = null;
    }

    setLocalStream(null);
    setRemoteStreams({});
    setMicEnabled(true);
    setCameraEnabled(true);
    setError('');
    isCallActiveRef.current = false;
    resumeCallRef.current = false;
    setRoomCallActive(false);
    setScreenShareOwner('');
    window.sessionStorage.removeItem(`lattice:active-meet:${projectId}`);

    socketRef.current?.emit('call:leave', { roomId: projectId });
    socketRef.current?.emit('screen-share:stop', { roomId: projectId });
  };

  const createPeer = (remoteId) => {
    if (!remoteId || remoteId === selfIdRef.current) {
      return null;
    }

    if (peersRef.current.has(remoteId)) {
      return peersRef.current.get(remoteId);
    }

    const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer = {
      connection,
      polite: String(selfIdRef.current) < String(remoteId),
      makingOffer: false,
      ignoreOffer: false,
      pendingCandidates: [],
      localTracksAttached: false,
      senders: [],
    };

    attachLocalTracks(peer);

    connection.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) {
        return;
      }

      setRemoteStreams((prev) => ({ ...prev, [remoteId]: stream }));
    };

    connection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      socketRef.current?.emit('webrtc:signal', {
        roomId: projectId,
        targetId: remoteId,
        signal: {
          type: 'candidate',
          candidate: event.candidate,
        },
      });
    };

    connection.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await connection.setLocalDescription(await connection.createOffer());
        socketRef.current?.emit('webrtc:signal', {
          roomId: projectId,
          targetId: remoteId,
          signal: {
            type: 'offer',
            description: connection.localDescription,
          },
        });
      } catch {
        // ignore negotiation races
      } finally {
        peer.makingOffer = false;
      }
    };

    connection.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(connection.connectionState)) {
        cleanupPeer(remoteId);
      }
    };

    peersRef.current.set(remoteId, peer);
    return peer;
  };

  const handleSignal = async ({ from, targetId, signal }) => {
    if (!from || from === selfIdRef.current) {
      return;
    }

    const currentSocketId = selfIdRef.current || socketRef.current?.id || '';
    if (targetId && currentSocketId && targetId !== currentSocketId) {
      return;
    }

    const peer = peersRef.current.get(from) || createPeer(from);
    if (!peer) {
      return;
    }

    const connection = peer.connection;
    const flushPendingCandidates = async () => {
      if (!connection.remoteDescription) {
        return;
      }

      while (peer.pendingCandidates.length > 0) {
        const candidate = peer.pendingCandidates.shift();
        if (!candidate) {
          continue;
        }

        await connection.addIceCandidate(candidate);
      }
    };

    try {
      if (signal?.type === 'offer') {
        const offerCollision = peer.makingOffer || connection.signalingState !== 'stable';
        peer.ignoreOffer = !peer.polite && offerCollision;

        if (peer.ignoreOffer) {
          return;
        }

        await connection.setRemoteDescription(signal.description);
        await connection.setLocalDescription(await connection.createAnswer());
        await flushPendingCandidates();

        socketRef.current?.emit('webrtc:signal', {
          roomId: projectId,
          targetId: from,
          signal: {
            type: 'answer',
            description: connection.localDescription,
          },
        });
      } else if (signal?.type === 'answer') {
        await connection.setRemoteDescription(signal.description);
        await flushPendingCandidates();
      } else if (signal?.type === 'candidate' && signal.candidate) {
        if (!peer.ignoreOffer) {
          if (connection.remoteDescription) {
            await connection.addIceCandidate(signal.candidate);
          } else {
            peer.pendingCandidates.push(signal.candidate);
          }
        }
      }
    } catch (signalError) {
      setError(signalError.message || 'WebRTC signaling failed.');
    }
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
          const nextPermission = membership?.membership?.role?.permissions || 'view_only';
          if (mounted) {
            setCallPermission(nextPermission);
          }
        } catch {
          if (mounted) {
            setCallPermission('view_only');
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
          selfIdRef.current = socket.id || selfIdRef.current;
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
          selfIdRef.current = state?.me?.id || '';
          setParticipants(state?.users || []);
          setRoomCallActive(Boolean(state?.call?.active));
          setScreenShareOwner(state?.screenShare?.active ? state?.screenShare?.username || 'Collaborator' : '');
        });

        socket.on('presence:update', ({ users = [] }) => {
          setParticipants(users);
        });

        socket.on('room:user-left', ({ user }) => {
          if (user?.id) {
            cleanupPeer(user.id);
          }
        });

        socket.on('call:state', (payload = {}) => {
          setRoomCallActive(Boolean(payload?.active));
          if (!payload?.active) {
            setScreenShareOwner('');
            peersRef.current.forEach((_, id) => {
              cleanupPeer(id);
            });
          }
        });

        socket.on('call:leave', ({ userId }) => {
          if (userId) {
            cleanupPeer(userId);
          }
        });

        socket.on('chat:new', (entry) => {
          setMessages((prev) => [entry, ...prev].slice(0, 80));
        });

        socket.on('screen-share:state', (payload = {}) => {
          const ownerName = payload?.active ? payload?.username || 'Collaborator' : '';
          setScreenShareOwner(ownerName);
        });

        socket.on('webrtc:signal', (payload) => {
          void handleSignal(payload);
        });
      } catch (initError) {
        setStatus('offline');
        setError(initError.message || 'Unable to start collaborative room.');
      }
    };

    void init();

    return () => {
      mounted = false;
      if (isCallActiveRef.current) {
        window.sessionStorage.setItem(`lattice:active-meet:${projectId}`, '1');
      }
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      }
      peersRef.current.forEach((_, id) => cleanupPeer(id));
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    resumeCallRef.current = window.sessionStorage.getItem(`lattice:active-meet:${projectId}`) === '1';
  }, [projectId]);

  useEffect(() => {
    if (status === 'connected' && callPermission !== 'view_only' && (resumeCallRef.current || roomCallActive) && !isCallActiveRef.current) {
      void startCall();
    }
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
    if (!localStream) {
      peersRef.current.forEach((_, id) => {
        cleanupPeer(id);
      });
      return;
    }

    participants.forEach((participant) => {
      if (participant.id !== selfIdRef.current) {
        const peer = peersRef.current.get(participant.id) || createPeer(participant.id);
        attachLocalTracks(peer, localStream || undefined);
      }
    });

    const ids = new Set(participants.map((participant) => participant.id));

    Array.from(peersRef.current.keys()).forEach((id) => {
      if (!ids.has(id)) {
        cleanupPeer(id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, localStream]);

  useEffect(() => {
    if (typeof onParticipantsChange === 'function') {
      onParticipantsChange(participants);
    }
  }, [onParticipantsChange, participants]);

  useEffect(() => {
    if (!socketRef.current || !projectId) {
      return;
    }

    socketRef.current.emit('link:view', {
      roomId: projectId,
      linkId: activeLinkId || '',
    });
  }, [activeLinkId, projectId]);

  const startCall = async () => {
    try {
      if (enforceRoleBasedCalls && callPermission === 'view_only') {
        setError('Your role does not allow starting calls.');
        return;
      }

      setError('');
      resumeCallRef.current = true;
      isCallActiveRef.current = true;
      window.sessionStorage.setItem(`lattice:active-meet:${projectId}`, '1');
      await ensureMedia();
      socketRef.current?.emit('call:start', { roomId: projectId });
    } catch (mediaError) {
      setError(mediaError.message || 'Unable to access camera/microphone.');
    }
  };

  const toggleMic = async () => {
    const stream = await ensureMedia();
    const next = !micEnabled;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setMicEnabled(next);
  };

  const toggleCamera = async () => {
    const stream = await ensureMedia();
    const next = !cameraEnabled;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    setCameraEnabled(next);
  };

  const startShare = async () => {
    try {
      await ensureMedia();
      const shareStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const shareTrack = shareStream.getVideoTracks()[0];

      peersRef.current.forEach((peer) => {
        peer.senders?.forEach((sender) => {
          if (sender.track?.kind === 'video') {
            sender.replaceTrack(shareTrack).catch(() => { });
          }
        });
      });

      if (localPreviewRef.current) {
        localPreviewRef.current.srcObject = shareStream;
      }
      activeStreamRef.current = shareStream;
      setScreenShareOwner('You');
      socketRef.current?.emit('screen-share:start', { roomId: projectId });

      shareTrack.onended = () => {
        if (!localStream) {
          return;
        }

        peersRef.current.forEach((peer) => {
          peer.senders?.forEach((sender) => {
            if (sender.track?.kind === 'video') {
              sender.replaceTrack(localStream.getVideoTracks()[0] || null).catch(() => { });
            }
          });
        });

        if (localPreviewRef.current) {
          localPreviewRef.current.srcObject = localStream;
        }

        activeStreamRef.current = localStream;
        setScreenShareOwner('');
        socketRef.current?.emit('screen-share:stop', { roomId: projectId });
      };
    } catch (shareError) {
      setError(shareError.message || 'Unable to start screen sharing.');
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

  const activeRemoteStreams = Object.entries(remoteStreams).filter(([, stream]) => Boolean(stream));
  const isCallActive = Boolean(localStream);
  const canStartCall = !enforceRoleBasedCalls || callPermission !== 'view_only';
  const hasProjectMembers = Array.isArray(projectMembers) && projectMembers.length > 0;
  const participantCount = hasProjectMembers ? projectMembers.length : participants.length;
  const callAccessLabel = enforceRoleBasedCalls ? callPermission.replace(/_/g, ' ') : 'open';

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

      <div className="project-realtime-actions">
        <button
          type="button"
          onClick={isCallActive ? endCall : startCall}
          className={isCallActive ? 'danger' : ''}
          disabled={!canStartCall && !isCallActive}
          title={!canStartCall ? 'Your role is view-only' : ''}
        >
          <Video size={15} /> {isCallActive ? 'End Call' : 'Start Call'}
        </button>
        <button type="button" onClick={toggleMic}>{micEnabled ? <Mic size={15} /> : <MicOff size={15} />}{micEnabled ? 'Mute' : 'Unmute'}</button>
        <button type="button" onClick={toggleCamera}>{cameraEnabled ? <Video size={15} /> : <VideoOff size={15} />}{cameraEnabled ? 'Camera Off' : 'Camera On'}</button>
        <button type="button" onClick={startShare}><ScreenShare size={15} /> Share Screen</button>
      </div>

      {screenShareOwner ? <p className="project-realtime-share-status">{screenShareOwner} is sharing screen</p> : null}

      {error ? <p className="project-realtime-error">{error}</p> : null}

      <div className="project-realtime-grid">
        <div className="project-realtime-video-col">
          <StreamTile label="You" stream={localStream} muted />
          <div className="project-realtime-remote-list">
            {activeRemoteStreams.length > 0 ? (
              activeRemoteStreams.map(([id, stream]) => (
                <StreamTile
                  key={id}
                  label={participants.find((participant) => participant.id === id)?.username || 'Collaborator'}
                  stream={stream}
                />
              ))
            ) : (
              <div className="realtime-stream-empty">No remote participants in call</div>
            )}
          </div>
          <video ref={localPreviewRef} autoPlay playsInline muted className="project-realtime-hidden-video" />
        </div>

        <div className="project-realtime-side-col">
          <div className="project-realtime-participants">
            <h4><Users size={15} /> Participants ({participantCount})</h4>
            <div className="project-realtime-participant-list">
              {hasProjectMembers ? (
                projectMembers.map((member) => {
                  const isOnline = participants.some((participant) => {
                    const participantUserId = String(participant.userId || '').trim();
                    const memberUserId = String(member.id || member.userId || '').trim();

                    if (participantUserId && memberUserId) {
                      return participantUserId === memberUserId;
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
