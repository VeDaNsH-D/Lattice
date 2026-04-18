import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph3D from 'react-force-graph-3d';
import { LatticeFrame } from './LatticeFrame';
import { BookOpen, PenTool, Code2, Share2, ArrowUpRight, Atom, Blocks, Plus, X, Link as LinkIcon, ChevronDown, SlidersHorizontal, ArrowDownUp, LayoutGrid, Command, Search, Users, GitFork, CircleUserRound, Sparkles } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { forkPublicProject, searchDiscover, getGlobalLatticeGraph } from '../services/latticeApi';
import './LatticePages.css';

const personalIcons = [BookOpen, PenTool, Code2, Share2];
const collaborativeIcons = [Blocks, ArrowUpRight, Atom, PenTool];

const graphNodeColor = (index, importance) => {
  if (index % 7 === 0) return '#2ecc71';
  if (importance > 0.7) return '#ffffff';
  return '#9e9e9e';
};

const normalizeHubLabel = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return 'General';
  }

  if (normalized.includes('reddit')) {
    return 'Reddit';
  }

  if (normalized.includes('tweet') || normalized.includes('twitter') || normalized.includes('x thread')) {
    return 'Tweets';
  }

  if (normalized.includes('education') || normalized.includes('learning') || normalized.includes('course')) {
    return 'Educational';
  }

  if (
    normalized.includes('tech')
    || normalized.includes('frontend')
    || normalized.includes('backend')
    || normalized.includes('react')
    || normalized.includes('engineering')
    || normalized.includes('software')
    || normalized.includes('product')
    || normalized.includes('programming')
    || normalized.includes('developer')
    || normalized.includes('api')
    || normalized.includes('saas')
  ) {
    return 'Tech';
  }

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const inferHubFromNode = (node = {}) => {
  const explicit = normalizeHubLabel(node.parentHub || '');
  if (explicit !== 'General') {
    return explicit;
  }

  const tags = (node.tags || []).map((tag) => String(tag || '').toLowerCase());
  const title = String(node.title || node.label || '').toLowerCase();
  const text = `${title} ${tags.join(' ')}`;

  if (text.includes('reddit')) return 'Reddit';
  if (text.includes('twitter') || text.includes('tweet')) return 'Tweets';
  if (text.includes('education') || text.includes('course') || text.includes('tutorial')) return 'Educational';
  if (/(tech|frontend|backend|react|javascript|engineering|coding|programming|software|product|developer|api|saas|devops|startup|github|gitlab|nodejs|node\.js|typescript|web\s?dev|leetcode|codeforces|hackerrank|atcoder|geeksforgeeks|competitive\s?programming|dsa|data\s?structures?|algorithms?)/.test(text)) return 'Tech';
  return 'General';
};

const normalizeHomeGraph = (graph = {}) => {
  const rawNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const rawEdges = Array.isArray(graph.edges) ? graph.edges : [];

  const mappedNodes = rawNodes.map((node, index) => ({
    id: String(node._id || node.id || `node-${index}`),
    label: node.title || node.label || 'Untitled',
    nodeType: node.nodeType || 'bookmark',
    parentHub: normalizeHubLabel(node.parentHub || ''),
    tags: Array.isArray(node.tags) ? node.tags : [],
    importanceScore: Number(node.importanceScore ?? 0.45),
    x: null,
    y: null,
    radius: node.nodeType === 'root' ? 3.2 : node.nodeType === 'hub' ? 2.8 : 1.7,
  }));

  const canonicalNodes = [];
  const canonicalIdByKey = new Map();
  const canonicalIdByOriginalId = new Map();

  mappedNodes.forEach((node) => {
    const hubName = normalizeHubLabel(node.parentHub || node.label || 'General');
    const key = node.nodeType === 'root'
      ? 'root:global'
      : node.nodeType === 'hub'
        ? `hub:${hubName}`
        : `node:${node.id}`;

    if (!canonicalIdByKey.has(key)) {
      const canonicalNode = {
        ...node,
        parentHub: node.nodeType === 'hub' ? hubName : node.parentHub,
        label: node.nodeType === 'hub' ? hubName : node.label,
      };

      canonicalNodes.push(canonicalNode);
      canonicalIdByKey.set(key, canonicalNode.id);
      canonicalIdByOriginalId.set(node.id, canonicalNode.id);
      return;
    }

    canonicalIdByOriginalId.set(node.id, canonicalIdByKey.get(key));
  });

  const nodes = canonicalNodes;

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = rawEdges
    .map((edge) => {
      const rawSource = String(edge.from?._id || edge.from || edge.source || '');
      const rawTarget = String(edge.to?._id || edge.to || edge.target || '');
      const source = canonicalIdByOriginalId.get(rawSource) || rawSource;
      const target = canonicalIdByOriginalId.get(rawTarget) || rawTarget;
      return { source, target, type: edge.type || 'semantic', weight: Number(edge.weight ?? 0) };
    })
    .filter((edge) => edge.source && edge.target && edge.source !== edge.target)
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  let rootNode = nodes.find((node) => node.nodeType === 'root');
  if (!rootNode) {
    rootNode = {
      id: 'synthetic-root',
      label: 'Knowledge Root',
      nodeType: 'root',
      parentHub: 'System',
      tags: ['root'],
      importanceScore: 1,
      x: 50,
      y: 50,
      radius: 3.2,
    };
    nodes.push(rootNode);
    nodeIds.add(rootNode.id);
  }

  // Keep the global root pinned to the center for a stable, readable hierarchy layout.
  rootNode.x = 50;
  rootNode.y = 50;
  rootNode.radius = 3.2;

  const hubsByName = new Map();
  nodes.forEach((node) => {
    if (node.nodeType === 'hub') {
      const hubName = normalizeHubLabel(node.parentHub || node.label || 'General');
      node.parentHub = hubName;
      hubsByName.set(hubName, node);
    }
  });

  const edgeSet = new Set(edges.map((edge) => `${edge.type}:${edge.source}->${edge.target}`));
  const addHierarchyEdge = (source, target) => {
    const forwardKey = `hierarchy:${source}->${target}`;
    const reverseKey = `hierarchy:${target}->${source}`;

    if (!edgeSet.has(forwardKey)) {
      edges.push({ source, target, type: 'hierarchy', weight: 1 });
      edgeSet.add(forwardKey);
    }

    if (!edgeSet.has(reverseKey)) {
      edges.push({ source: target, target: source, type: 'hierarchy', weight: 1 });
      edgeSet.add(reverseKey);
    }
  };

  nodes.forEach((node) => {
    if (node.nodeType === 'root' || node.nodeType === 'hub') {
      return;
    }

    const hubName = inferHubFromNode(node);
    node.parentHub = hubName;

    let hubNode = hubsByName.get(hubName);
    if (!hubNode) {
      hubNode = {
        id: `synthetic-hub-${hubName.toLowerCase().replace(/\s+/g, '-')}`,
        label: hubName,
        nodeType: 'hub',
        parentHub: hubName,
        tags: ['hub'],
        importanceScore: 0.8,
        x: null,
        y: null,
        radius: 2.8,
      };

      nodes.push(hubNode);
      nodeIds.add(hubNode.id);
      hubsByName.set(hubName, hubNode);
    }

    addHierarchyEdge(rootNode.id, hubNode.id);
    addHierarchyEdge(hubNode.id, node.id);
  });

  const hubs = Array.from(hubsByName.values());
  hubs.forEach((hub, index) => {
    if (typeof hub.x === 'number' && typeof hub.y === 'number') {
      return;
    }

    const angle = (index / Math.max(hubs.length, 1)) * Math.PI * 2;
    hub.x = 50 + Math.cos(angle) * 31;
    hub.y = 50 + Math.sin(angle) * 24;
  });

  hubs.forEach((hub) => {
    const children = nodes.filter((node) => node.nodeType !== 'root' && node.nodeType !== 'hub' && node.parentHub === hub.parentHub);
    children.forEach((child, childIndex) => {
      if (typeof child.x === 'number' && typeof child.y === 'number') {
        return;
      }

      const angle = (childIndex / Math.max(children.length, 1)) * Math.PI * 2;
      const spread = 8 + Math.min(children.length * 0.9, 7);
      child.x = hub.x + Math.cos(angle) * spread;
      child.y = hub.y + Math.sin(angle) * spread;
      child.radius = 1.7;
    });
  });

  nodes.forEach((node, index) => {
    if (typeof node.x === 'number' && typeof node.y === 'number') {
      return;
    }

    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
    node.x = 50 + Math.cos(angle) * 34;
    node.y = 50 + Math.sin(angle) * 30;
  });

  const hierarchyEdges = edges.filter((edge) => edge.type === 'hierarchy');
  const candidateEdges = hierarchyEdges.length > 0 ? hierarchyEdges : edges;
  const selectedEdges = [];
  const connectionKeys = new Set();

  candidateEdges.forEach((edge) => {
    const key = [edge.source, edge.target].sort().join(':');
    if (connectionKeys.has(key)) {
      return;
    }

    connectionKeys.add(key);
    selectedEdges.push(edge);
  });

  return { nodes, edges: selectedEdges };
};

const hashString = (value = '') => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
};

const nodeColorByType = (node, index) => {
  if (node.nodeType === 'root') {
    return '#f1f5f9';
  }

  if (node.nodeType === 'hub') {
    return '#4cd964';
  }

  return graphNodeColor(index, Math.max(0.2, Math.min(1, Number(node.importanceScore ?? 0.45))));
};

const nodeSizeByType = (node) => {
  if (node.nodeType === 'root') {
    return 14;
  }

  if (node.nodeType === 'hub') {
    return 11;
  }

  return 7;
};

const toRadians = (degrees) => (degrees * Math.PI) / 180;
const GRAPH_VISUAL_SCALE = 1.75;

const renderProjectCards = (projects, icons, onProjectClick, idOffset = 0) => {
  if (!projects.length) {
    return <p className="directory-empty">No active projects yet.</p>;
  }

  return (
    <section className="directory-grid">
      {projects.map((project, index) => {
        const IconComponent = icons[index % icons.length];
        const displayIndex = String(index + 1 + idOffset).padStart(2, '0');
        const variantIndex = index % 6;

        return (
          <div
            className={`dir-card dir-variant-${variantIndex}`}
            key={project.id}
            role="button"
            tabIndex={0}
            onClick={() => onProjectClick(project)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onProjectClick(project);
              }
            }}
          >
            <div className="dir-top-meta">
              <span className="dir-lessons-badge">{project.memberCount * 2 + 10} modules</span>
              <div className="dir-action-circle" style={{ opacity: 1, position: 'relative', bottom: 'auto', right: 'auto', transform: 'none', background: 'transparent', boxShadow: 'none', width: 'auto', height: 'auto'}}>
                <span style={{fontSize: '0.8rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500'}}>
                  {project.projectType === 'collaborative' ? 'Shared' : 'Private'} <ArrowUpRight size={14} strokeWidth={2.5} color="#6b7280" />
                </span>
              </div>
            </div>

            <div className="dir-icon-area">
               <div className="dir-icon-squircle">
                 <IconComponent size={32} />
               </div>
            </div>

            <div className="dir-tags">
              <span className="dir-tag">{project.projectType === 'personal' ? 'UX design' : 'Architecture'}</span>
              <span className="dir-tag">{index % 2 === 0 ? 'Visual design' : 'System logic'}</span>
            </div>

            <h3 className="dir-title">{project.name}</h3>

            <div className="dir-bottom">
              <span className="dir-level">Level: <strong style={{color: '#374151'}}>{index % 3 === 0 ? 'Advance' : index % 2 === 0 ? 'Medium' : 'Junior'}</strong></span>
              <div className="dir-progress-wrap">
                <span style={{color: '#6b7280', fontWeight: '500'}}>Progress:</span>
                <div className="dir-progress-ring"></div>
                <span>{index * 15 + 10}%</span>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
};

export const LatticeHomePage = () => {
  const navigate = useNavigate();
  const forceGraphRef = useRef(null);
  const [personalProjects, setPersonalProjects] = useState([]);
  const [collaborativeProjects, setCollaborativeProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [creatingType, setCreatingType] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [modalError, setModalError] = useState('');
  const [bookmarkUrl, setBookmarkUrl] = useState('');
  const [bookmarkProjectSelection, setBookmarkProjectSelection] = useState('');
  const [bookmarkProjectType, setBookmarkProjectType] = useState('personal');
  const [bookmarkNewProjectName, setBookmarkNewProjectName] = useState('');
  const [bookmarkAccessType, setBookmarkAccessType] = useState('public');
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [rolesByProject, setRolesByProject] = useState({});
  const [bookmarkSubmitting, setBookmarkSubmitting] = useState(false);
  const [bookmarkError, setBookmarkError] = useState('');
  const [bookmarkSuccess, setBookmarkSuccess] = useState('');
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [discoverUsers, setDiscoverUsers] = useState([]);
  const [discoverProjects, setDiscoverProjects] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState('');
  const [selectedDiscoverUserId, setSelectedDiscoverUserId] = useState('');
  const [heroGraphData, setHeroGraphData] = useState({ nodes: [], edges: [] });
  const [heroGraphLoading, setHeroGraphLoading] = useState(false);
  const [heroGraphError, setHeroGraphError] = useState('');

  const [expandedHubs, setExpandedHubs] = useState({});
  const [activePreviewNode, setActivePreviewNode] = useState(null);
  const [graphViewMode, setGraphViewMode] = useState('3d');
  const [graphViewport, setGraphViewport] = useState({ width: 0, height: 0 });
  const graphCanvasRef = useRef(null);

  const isModalOpen = modalType !== null;

  const hasProjects = useMemo(
    () => personalProjects.length > 0 || collaborativeProjects.length > 0,
    [personalProjects.length, collaborativeProjects.length]
  );

  const allProjects = useMemo(
    () => [...personalProjects, ...collaborativeProjects],
    [personalProjects, collaborativeProjects]
  );

  const isBookmarkNewProject = bookmarkProjectSelection === '__new__';
  const selectedProjectRoles = !isBookmarkNewProject
    ? rolesByProject[bookmarkProjectSelection] || []
    : [];

  const selectedDiscoverUser = useMemo(
    () => discoverUsers.find((user) => user.id === selectedDiscoverUserId) || null,
    [discoverUsers, selectedDiscoverUserId]
  );

  const filteredDiscoverProjects = useMemo(() => {
    if (!selectedDiscoverUserId) {
      return discoverProjects;
    }

    return discoverProjects.filter((project) => String(project.createdBy?.id || project.createdBy?._id || '') === String(selectedDiscoverUserId));
  }, [discoverProjects, selectedDiscoverUserId]);
  const graphProjectId = useMemo(() => {
    if (!allProjects.length) {
      return '';
    }

    if (bookmarkProjectSelection && bookmarkProjectSelection !== '__new__') {
      return bookmarkProjectSelection;
    }

    return allProjects[0]?.id || '';
  }, [allProjects, bookmarkProjectSelection]);

  const selectedGraphProject = useMemo(
    () => allProjects.find((project) => project.id === graphProjectId) || null,
    [allProjects, graphProjectId]
  );

  const heroGraph = useMemo(() => normalizeHomeGraph(heroGraphData), [heroGraphData]);

  const graph3dData = useMemo(() => {
    const hubConnections = {};

    heroGraph.edges.forEach((edge) => {
      const source = heroGraph.nodes.find((node) => node.id === edge.source);
      const target = heroGraph.nodes.find((node) => node.id === edge.target);

      if (!source || !target) {
        return;
      }

      if (source.nodeType === 'hub' && target.nodeType !== 'hub') {
        if (!hubConnections[target.id]) {
          hubConnections[target.id] = [];
        }
        hubConnections[target.id].push(source.id);
      }

      if (target.nodeType === 'hub' && source.nodeType !== 'hub') {
        if (!hubConnections[source.id]) {
          hubConnections[source.id] = [];
        }
        hubConnections[source.id].push(target.id);
      }
    });

    const isNodeVisible = (node) => {
      if (node.nodeType === 'root' || node.nodeType === 'hub') {
        return true;
      }

      const hubs = hubConnections[node.id];
      if (!hubs || hubs.length === 0) {
        return true;
      }

      return hubs.some((hubId) => expandedHubs[hubId]);
    };

    const visibleNodes = heroGraph.nodes.filter(isNodeVisible);
    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
    const visibleEdges = heroGraph.edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));

    const rootNode = visibleNodes.find((node) => node.nodeType === 'root') || null;
    const hubNodes = visibleNodes.filter((node) => node.nodeType === 'hub');

    const positioned = new Map();

    if (rootNode) {
      positioned.set(String(rootNode.id), {
        ...rootNode,
        x: 0,
        y: 0,
        z: 12,
      });
    }

    const hubRingRadius = Math.max(34, 22 + (hubNodes.length * 4));
    hubNodes.forEach((hub, index) => {
      const angle = (index / Math.max(hubNodes.length, 1)) * Math.PI * 2;
      const x = Math.cos(angle) * hubRingRadius;
      const y = Math.sin(angle) * (hubRingRadius * 0.62);

      positioned.set(String(hub.id), {
        ...hub,
        x,
        y,
        z: -6,
      });
    });

    hubNodes.forEach((hub, hubIndex) => {
      const children = visibleNodes.filter((node) => node.nodeType === 'bookmark' && node.parentHub === hub.parentHub);
      const baseAngle = (hubIndex / Math.max(hubNodes.length, 1)) * 360;

      children.forEach((child, childIndex) => {
        const angle = toRadians(baseAngle + (childIndex * (360 / Math.max(children.length, 1))));
        const spread = 14 + Math.min(children.length * 0.9, 10);
        const hubPos = positioned.get(String(hub.id));

        positioned.set(String(child.id), {
          ...child,
          x: (hubPos?.x || 0) + Math.cos(angle) * spread,
          y: (hubPos?.y || 0) + Math.sin(angle) * (spread * 0.72),
          z: -24,
        });
      });
    });

    const leftovers = visibleNodes.filter((node) => !positioned.has(String(node.id)));
    leftovers.forEach((node, index) => {
      const angle = (index / Math.max(leftovers.length, 1)) * Math.PI * 2;
      positioned.set(String(node.id), {
        ...node,
        x: Math.cos(angle) * 52,
        y: Math.sin(angle) * 28,
        z: -18,
      });
    });

    const nodes = Array.from(positioned.values()).map((node, index) => {
      const sx = Number(node.x || 0) * GRAPH_VISUAL_SCALE;
      const sy = Number(node.y || 0) * GRAPH_VISUAL_SCALE;
      const sz = Number(node.z || 0) * GRAPH_VISUAL_SCALE;

      return {
        ...node,
        id: String(node.id),
        color: nodeColorByType(node, index),
        val: nodeSizeByType(node),
        x: sx,
        y: sy,
        z: sz,
        // Keep hierarchy positions stable so the graph doesn't collapse into a tiny center cluster.
        fx: sx,
        fy: sy,
        fz: sz,
      };
    });

    const nodeById = new Map(nodes.map((node) => [String(node.id), node]));

    const links = visibleEdges.map((edge) => {
      const source = nodeById.get(String(edge.source));
      const target = nodeById.get(String(edge.target));
      const rootHub = Boolean(source && target)
        && ((source.nodeType === 'root' && target.nodeType === 'hub') || (source.nodeType === 'hub' && target.nodeType === 'root'));
      const hubBookmark = Boolean(source && target)
        && ((source.nodeType === 'hub' && target.nodeType === 'bookmark') || (source.nodeType === 'bookmark' && target.nodeType === 'hub'));

      return {
        source: String(edge.source),
        target: String(edge.target),
        color: rootHub ? 'rgba(226, 232, 240, 0.75)' : hubBookmark ? 'rgba(148, 163, 184, 0.48)' : 'rgba(100, 116, 139, 0.25)',
        width: rootHub ? 2.8 : hubBookmark ? 1.6 : 1.1,
        particles: rootHub ? 2 : hubBookmark ? 1 : 0,
      };
    });

    return { nodes, links };
  }, [heroGraph.edges, heroGraph.nodes, expandedHubs]);

  const graph2dData = useMemo(() => {
    if (!graph3dData.nodes.length) {
      return { nodes: [], links: [] };
    }

    const bounds = graph3dData.nodes.reduce((acc, node) => {
      acc.minX = Math.min(acc.minX, node.x);
      acc.maxX = Math.max(acc.maxX, node.x);
      acc.minY = Math.min(acc.minY, node.y);
      acc.maxY = Math.max(acc.maxY, node.y);
      return acc;
    }, {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    });

    const sourceWidth = Math.max(1, bounds.maxX - bounds.minX);
    const sourceHeight = Math.max(1, bounds.maxY - bounds.minY);
    const targetWidth = 180;
    const targetHeight = 120;
    const padding = 14;
    const scaleX = (targetWidth - (padding * 2)) / sourceWidth;
    const scaleY = (targetHeight - (padding * 2)) / sourceHeight;
    const scale = Math.min(scaleX, scaleY);

    const centerSourceX = (bounds.minX + bounds.maxX) / 2;
    const centerSourceY = (bounds.minY + bounds.maxY) / 2;

    const nodes = graph3dData.nodes.map((node) => {
      const nx = ((node.x - centerSourceX) * scale);
      const ny = ((node.y - centerSourceY) * scale);

      return {
        ...node,
        x2d: nx,
        y2d: ny,
      };
    });

    const nodeById = new Map(nodes.map((node) => [String(node.id), node]));
    const links = graph3dData.links
      .map((link) => {
        const source = nodeById.get(String(link.source));
        const target = nodeById.get(String(link.target));

        if (!source || !target) {
          return null;
        }

        return {
          ...link,
          source,
          target,
        };
      })
      .filter(Boolean);

    return { nodes, links };
  }, [graph3dData]);

  useEffect(() => {
    if (!heroGraph.nodes.length) {
      setExpandedHubs({});
      setActivePreviewNode(null);
      return;
    }

    const nextExpanded = {};
    heroGraph.nodes.forEach((node) => {
      if (node.nodeType === 'hub') {
        nextExpanded[node.id] = true;
      }
    });

    setExpandedHubs(nextExpanded);
    setActivePreviewNode(null);
  }, [heroGraph.nodes]);

  useEffect(() => {
    const element = graphCanvasRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      setGraphViewport({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (graphViewMode !== '3d' || !forceGraphRef.current || !graph3dData.nodes.length) {
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        forceGraphRef.current?.zoomToFit(700, 28);
      } catch {
        // no-op: keep default camera if zoomToFit isn't ready yet
      }
    }, 240);

    return () => {
      window.clearTimeout(timer);
    };
  }, [graph3dData.nodes.length, graphViewMode, graphViewport.height, graphViewport.width]);

  const loadProjects = useCallback(async () => {
    setErrorMessage('');

    try {
      const response = await apiRequest('/projects', { method: 'GET' });
      const nextPersonal = response?.personalProjects || [];
      const nextCollaborative = response?.collaborativeProjects || [];

      setPersonalProjects(nextPersonal);
      setCollaborativeProjects(nextCollaborative);

      const nextAllProjects = [...nextPersonal, ...nextCollaborative];
      if (nextAllProjects.length > 0) {
        setBookmarkProjectSelection((previousSelection) => {
          if (previousSelection === '__new__') {
            return previousSelection;
          }

          if (nextAllProjects.some((project) => project.id === previousSelection)) {
            return previousSelection;
          }

          return nextAllProjects[0].id;
        });
      }
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRolesForProject = useCallback(async (projectId) => {
    if (!projectId || projectId === '__new__') {
      return;
    }

    try {
      const response = await apiRequest(`/roles?projectId=${projectId}`, { method: 'GET' });
      setRolesByProject((previous) => ({
        ...previous,
        [projectId]: response?.roles || []
      }));
    } catch {
      setRolesByProject((previous) => ({
        ...previous,
        [projectId]: []
      }));
    }
  }, []);

  const loadHeroGraph = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setHeroGraphLoading(true);
      }

      setHeroGraphError('');
      const response = await getGlobalLatticeGraph();
      setHeroGraphData(response?.graph || { nodes: [], edges: [] });
    } catch (error) {
      setHeroGraphData({ nodes: [], edges: [] });
      setHeroGraphError(error.message || 'Unable to load graph preview.');
    } finally {
      if (!silent) {
        setHeroGraphLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProjects();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadProjects]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (bookmarkProjectSelection && bookmarkProjectSelection !== '__new__') {
        setSelectedRoleIds([]);
        setBookmarkAccessType('public');
        void loadRolesForProject(bookmarkProjectSelection);
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [bookmarkProjectSelection, loadRolesForProject]);

  useEffect(() => {
    let isMounted = true;

    const loadDiscover = async () => {
      setDiscoverLoading(true);
      setDiscoverError('');

      try {
        const response = await searchDiscover({
          query: discoverQuery.trim(),
          limit: 12,
        });

        if (!isMounted) {
          return;
        }

        const nextUsers = Array.isArray(response?.users) ? response.users : [];
        const nextProjects = Array.isArray(response?.projects) ? response.projects : [];

        setDiscoverUsers(nextUsers);
        setDiscoverProjects(nextProjects);
        setSelectedDiscoverUserId((previous) => {
          if (nextUsers.some((user) => user.id === previous)) {
            return previous;
          }

          return nextUsers[0]?.id || '';
        });
      } catch (error) {
        if (isMounted) {
          setDiscoverUsers([]);
          setDiscoverProjects([]);
          setDiscoverError(error.message || 'Unable to search public people and projects.');
        }
      } finally {
        if (isMounted) {
          setDiscoverLoading(false);
        }
      }
    };

    const timer = window.setTimeout(() => {
      void loadDiscover();
    }, 240);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [discoverQuery]);

  useEffect(() => {
    void loadHeroGraph();
  }, [loadHeroGraph]);

  const handleForkPublicProject = async (project) => {
    const projectId = project?.id;
    if (!projectId) {
      return;
    }

    try {
      setDiscoverError('');
      const response = await forkPublicProject(projectId);
      const forkedProject = response?.project;

      if (forkedProject?.id) {
        navigate(`/lattice/project/${forkedProject.id}`, {
          state: {
            projectName: forkedProject.name,
            projectType: forkedProject.projectType,
          },
        });
      }
    } catch (error) {
      setDiscoverError(error.message || 'Unable to fork project.');
    }
  };


  const onSubmitBookmark = async (event) => {
    event.preventDefault();

    const trimmedUrl = bookmarkUrl.trim();
    if (!trimmedUrl) {
      setBookmarkError('Bookmark URL is required.');
      return;
    }

    let resolvedProjectId = bookmarkProjectSelection;

    if (!bookmarkProjectSelection) {
      setBookmarkError('Select a project or create a new one.');
      return;
    }

    if (isBookmarkNewProject) {
      const trimmedProjectName = bookmarkNewProjectName.trim();

      if (!trimmedProjectName) {
        setBookmarkError('New project name is required.');
        return;
      }

      setBookmarkSubmitting(true);
      setBookmarkError('');
      setBookmarkSuccess('');

      try {
        const createdProjectResponse = await apiRequest('/projects', {
          method: 'POST',
          body: JSON.stringify({
            name: trimmedProjectName,
            projectType: bookmarkProjectType,
          }),
        });

        resolvedProjectId = createdProjectResponse?.project?.id;

        if (!resolvedProjectId) {
          throw new Error('Failed to create project for bookmark.');
        }

        await loadProjects();
        setBookmarkProjectSelection(resolvedProjectId);
      } catch (error) {
        setBookmarkError(error.message || 'Unable to create project for bookmark.');
        setBookmarkSubmitting(false);
        return;
      }
    }

    if (!resolvedProjectId || resolvedProjectId === '__new__') {
      setBookmarkError('Please choose a valid project.');
      setBookmarkSubmitting(false);
      return;
    }

    if (bookmarkAccessType === 'role_based' && selectedRoleIds.length === 0) {
      setBookmarkError('Select at least one role for role-based access.');
      setBookmarkSubmitting(false);
      return;
    }

    setBookmarkSubmitting(true);
    setBookmarkError('');
    setBookmarkSuccess('');

    try {
      await apiRequest('/links', {
        method: 'POST',
        body: JSON.stringify({
          projectId: resolvedProjectId,
          url: trimmedUrl,
          accessType: bookmarkAccessType,
          allowedRoles: bookmarkAccessType === 'role_based' ? selectedRoleIds : [],
        }),
      });

      setBookmarkUrl('');
      setSelectedRoleIds([]);
      setBookmarkAccessType('public');
      setBookmarkSuccess('Bookmark added successfully.');

      // Graph building happens in backend background tasks; refresh now and again shortly after.
      void loadHeroGraph({ silent: true });
      window.setTimeout(() => {
        void loadHeroGraph({ silent: true });
      }, 1200);
      window.setTimeout(() => {
        void loadHeroGraph({ silent: true });
      }, 3000);
    } catch (error) {
      setBookmarkError(error.message || 'Unable to add bookmark.');
    } finally {
      setBookmarkSubmitting(false);
    }
  };

  const onRoleToggle = (roleId) => {
    setSelectedRoleIds((previous) => {
      if (previous.includes(roleId)) {
        return previous.filter((currentRoleId) => currentRoleId !== roleId);
      }

      return [...previous, roleId];
    });
  };

  const onProjectOpen = (project) => {
    navigate(`/lattice/project/${project.id}`, {
      state: {
        projectName: project.name,
        projectType: project.projectType,
      },
    });
  };

  const handleGraphNodeClick = (node) => {
    setActivePreviewNode(node);

    if (graphViewMode === '3d') {
      const distance = 80;
      const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
      forceGraphRef.current?.cameraPosition(
        {
          x: (node.x || 0) * distRatio,
          y: (node.y || 0) * distRatio,
          z: (node.z || 0) * distRatio,
        },
        node,
        700
      );
    }

    if (node.nodeType === 'hub') {
      setExpandedHubs((previous) => ({ ...previous, [node.id]: !previous[node.id] }));
    }
  };

  return (
    <LatticeFrame>
      <div className="lattice-home-hero">
        <div className="lattice-home-mesh" />
        <div className="lattice-home-split">
          <div className="lattice-home-hero-content">
            <div className="lattice-hero-rings" style={{ marginBottom: '16px' }}>
              <Command size={64} strokeWidth={1.2} color="#111" />
            </div>

            <p className="lattice-hero-subtitle">Capture a link and assign access in one step.</p>
            <h1 className="lattice-hero-title">Data-Powered<br />Workspace Intelligence.</h1>

            <form className="lattice-hero-form" onSubmit={onSubmitBookmark}>
              <div className="lattice-hero-input-group tall">
                <input
                  type="url"
                  placeholder="Type a link or URL..."
                  value={bookmarkUrl}
                  onChange={(e) => setBookmarkUrl(e.target.value)}
                  className="lattice-hero-input"
                  required
                />

                <div className="lattice-hero-options-inline">
                  <div className="lattice-hero-select-wrap" style={{ width: '200px', flexShrink: 0 }}>
                    <select
                      value={bookmarkProjectSelection}
                      onChange={(e) => setBookmarkProjectSelection(e.target.value)}
                      className="lattice-hero-select-subtle"
                    >
                      <option value="">Select project...</option>
                      {allProjects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                      <option value="__new__">+ New project...</option>
                    </select>
                    <ChevronDown size={14} className="hero-select-chevron" />
                  </div>

                  {isBookmarkNewProject && (
                    <>
                      <input
                        type="text"
                        placeholder="Project name"
                        value={bookmarkNewProjectName}
                        onChange={(e) => setBookmarkNewProjectName(e.target.value)}
                        className="lattice-hero-select-subtle name-input"
                      />
                      <div className="lattice-hero-select-wrap" style={{ width: '120px', flexShrink: 0 }}>
                        <select
                          value={bookmarkProjectType}
                          onChange={(e) => setBookmarkProjectType(e.target.value)}
                          className="lattice-hero-select-subtle"
                        >
                          <option value="personal">Personal</option>
                          <option value="collaborative">Group</option>
                        </select>
                        <ChevronDown size={14} className="hero-select-chevron" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <button type="submit" className="lattice-hero-submit" disabled={bookmarkSubmitting}>
                {bookmarkSubmitting ? 'Saving...' : 'Add Link \u2192'}
              </button>

              {bookmarkError && <p className="hero-feedback-error">{bookmarkError}</p>}
              {bookmarkSuccess && <p className="hero-feedback-success">{bookmarkSuccess}</p>}
            </form>
          </div>

          <aside className="lattice-home-graph-pane">
            <div className="lattice-home-graph-head">
              <p>Knowledge Graph</p>
              <h3>Global network preview</h3>
              <div className="lattice-home-graph-toggle" role="group" aria-label="Graph view mode">
                <button
                  type="button"
                  className={`graph-toggle-btn ${graphViewMode === '2d' ? 'active' : ''}`}
                  onClick={() => setGraphViewMode('2d')}
                >
                  2D
                </button>
                <button
                  type="button"
                  className={`graph-toggle-btn ${graphViewMode === '3d' ? 'active' : ''}`}
                  onClick={() => setGraphViewMode('3d')}
                >
                  3D
                </button>
              </div>
            </div>

            <div className="lattice-home-graph-canvas" ref={graphCanvasRef}>
              {heroGraphLoading ? <p className="lattice-home-graph-state">Loading graph…</p> : null}
              {!heroGraphLoading && heroGraphError ? <p className="lattice-home-graph-state error">{heroGraphError}</p> : null}
              {!heroGraphLoading && !heroGraphError && heroGraph.nodes.length === 0 ? (
                <p className="lattice-home-graph-state">Saved bookmarks will map here.</p>
              ) : null}

              {!heroGraphLoading && !heroGraphError && graph3dData.nodes.length > 0 && graphViewport.width > 0 && graphViewport.height > 0 && graphViewMode === '3d' ? (
                <ForceGraph3D
                  ref={forceGraphRef}
                  graphData={graph3dData}
                  width={graphViewport.width}
                  height={graphViewport.height}
                  backgroundColor="#1e1e1e"
                  showNavInfo={false}
                  enablePointerInteraction
                  nodeLabel={(node) => `${node.label} (${node.nodeType})`}
                  nodeColor={(node) => node.color}
                  nodeVal={(node) => node.val}
                  nodeResolution={18}
                  linkColor={(link) => link.color}
                  linkWidth={(link) => link.width}
                  linkOpacity={0.7}
                  linkDirectionalParticles={(link) => link.particles || 0}
                  linkDirectionalParticleWidth={1.7}
                  linkDirectionalParticleSpeed={0.008}
                  cooldownTicks={30}
                  d3VelocityDecay={0.72}
                  enableNodeDrag={false}
                  onEngineStop={() => {
                    if (graphViewMode !== '3d') {
                      return;
                    }

                    try {
                      forceGraphRef.current?.zoomToFit(420, 24);
                    } catch {
                      // no-op
                    }
                  }}
                  onNodeClick={handleGraphNodeClick}
                />
              ) : null}

              {!heroGraphLoading && !heroGraphError && graph2dData.nodes.length > 0 && graphViewMode === '2d' ? (
                <svg className="lattice-home-graph-svg-2d" viewBox="-90 -60 180 120" role="img" aria-label="Knowledge graph 2D preview">
                  {graph2dData.links.map((link, index) => {
                    return (
                      <line
                        key={`line-${index}-${link.source.id}-${link.target.id}`}
                        x1={link.source.x2d}
                        y1={link.source.y2d}
                        x2={link.target.x2d}
                        y2={link.target.y2d}
                        stroke={link.color}
                        strokeWidth={Math.max(0.8, Number(link.width || 1))}
                      />
                    );
                  })}

                  {graph2dData.nodes.map((node) => {
                    const isActive = activePreviewNode?.id === node.id;
                    const radius = node.nodeType === 'root' ? 5.4 : node.nodeType === 'hub' ? 4.5 : 3.2;
                    const showLabel = node.nodeType !== 'bookmark' || isActive;

                    return (
                      <g
                        key={`node-${node.id}`}
                        className="graph-2d-node"
                        onClick={() => handleGraphNodeClick(node)}
                      >
                        <circle
                          cx={node.x2d}
                          cy={node.y2d}
                          r={radius + 2.2}
                          fill="transparent"
                        />
                        <circle
                          cx={node.x2d}
                          cy={node.y2d}
                          r={radius}
                          fill={node.color}
                          stroke={isActive ? 'rgba(241, 245, 249, 0.95)' : 'transparent'}
                          strokeWidth={isActive ? 1 : 0}
                        />
                        {showLabel ? (
                          <text
                            x={node.x2d}
                            y={node.y2d + radius + 4}
                            textAnchor="middle"
                            className="graph-2d-label"
                          >
                            {node.label.length > 16 ? `${node.label.slice(0, 16)}...` : node.label}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </svg>
              ) : null}

              {!heroGraphLoading && !heroGraphError && graph3dData.nodes.length > 0 ? (
                <div className="lattice-home-graph-legend" aria-hidden="true">
                  <span><i className="dot root" /> Root</span>
                  <span><i className="dot hub" /> Hubs</span>
                  <span><i className="dot bookmark" /> Bookmarks</span>
                </div>
              ) : null}

              {!heroGraphLoading && !heroGraphError ? (
                <p className="lattice-home-graph-overlay-note">
                  {activePreviewNode
                    ? `Selected: ${activePreviewNode.label} (${activePreviewNode.nodeType})`
                    : `Tip: ${graphViewMode === '3d' ? 'drag to orbit and click nodes to inspect.' : 'click nodes to inspect and click green hub nodes to expand/collapse.'}`}
                </p>
              ) : null}
            </div>

            {/* The full-screen interactive component for global isn't built yet, so we omit the button. */}
          </aside>
        </div>
      </div>

      <section className="home-discovery-panel">
        <div className="home-discovery-header">
          <div>
            <p className="home-discovery-kicker">Discover people & public spaces</p>
            <h2>Search another user's profile and fork a public project</h2>
          </div>

          <div className="home-discovery-searchbar">
            <Search size={16} />
            <input
              type="search"
              value={discoverQuery}
              onChange={(event) => setDiscoverQuery(event.target.value)}
              placeholder="Search a person or public project..."
              aria-label="Search users and public projects"
            />
          </div>
        </div>

        {discoverError ? <p className="home-discovery-error">{discoverError}</p> : null}

        <div className="home-discovery-grid">
          <section className="home-discovery-column">
            <div className="home-discovery-section-head">
              <h3><Users size={16} /> User profiles</h3>
              <span>{discoverUsers.length}</span>
            </div>

            <div className="home-user-grid">
              {discoverLoading ? (
                <div className="home-discovery-empty">Searching profiles...</div>
              ) : discoverUsers.length ? discoverUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className={`home-user-card ${selectedDiscoverUserId === user.id ? 'active' : ''}`}
                  onClick={() => setSelectedDiscoverUserId(user.id)}
                >
                  <span className="home-user-avatar">
                    {user.avatarUrl ? <img src={user.avatarUrl} alt={user.name} /> : <CircleUserRound size={18} />}
                  </span>
                  <span className="home-user-copy">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                    <em>{user.publicProjectCount || 0} public project{(user.publicProjectCount || 0) === 1 ? '' : 's'}</em>
                  </span>
                  <span className="home-user-chip">{user.publicProjectCount || 0}</span>
                </button>
              )) : (
                <div className="home-discovery-empty">No profiles matched.</div>
              )}
            </div>

            {selectedDiscoverUser ? (
              <div className="home-selected-user-projects">
                <p className="home-discovery-section-subhead">
                  Public spaces by {selectedDiscoverUser.name}
                </p>

                {selectedDiscoverUser.publicProjects?.length ? (
                  <div className="home-mini-project-list">
                    {selectedDiscoverUser.publicProjects.map((project) => (
                      <div key={project.id} className="home-mini-project-item">
                        <div>
                          <strong>{project.name}</strong>
                          <span>{project.lineageDepth > 0 ? `Remix depth ${project.lineageDepth}` : 'Original shelf'}</span>
                        </div>
                        <button type="button" onClick={() => void handleForkPublicProject(project)}>
                          <GitFork size={14} /> Fork
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="home-discovery-empty">This user has no public projects yet.</div>
                )}
              </div>
            ) : null}
          </section>

          <section className="home-discovery-column wide">
            <div className="home-discovery-section-head">
              <h3><Sparkles size={16} /> Public projects</h3>
              <span>{filteredDiscoverProjects.length}</span>
            </div>

            <div className="home-public-project-grid">
              {discoverLoading ? (
                <div className="home-discovery-empty">Loading public projects...</div>
              ) : filteredDiscoverProjects.length ? filteredDiscoverProjects.map((project) => (
                <article key={project.id} className="home-public-project-card">
                  <div className="home-public-project-topline">
                    <span className="home-public-project-owner">
                      {project.createdBy?.avatarUrl ? <img src={project.createdBy.avatarUrl} alt={project.createdBy.name} /> : <CircleUserRound size={14} />}
                      {project.createdBy?.name || 'Unknown curator'}
                    </span>
                    <span className="home-public-project-pill">Public</span>
                  </div>
                  <h4>{project.name}</h4>
                  <p>{project.kind === 'collaborative' ? 'Collaborative public shelf' : 'Personal public shelf'}</p>
                  <div className="home-public-project-footer">
                    <span>{project.remixCount || 0} remixes</span>
                    <button type="button" onClick={() => void handleForkPublicProject(project)}>
                      <GitFork size={14} /> Fork for me
                    </button>
                  </div>
                </article>
              )) : (
                <div className="home-discovery-empty">No public projects found.</div>
              )}
            </div>
          </section>
        </div>
      </section>
    </LatticeFrame>
  );
};
