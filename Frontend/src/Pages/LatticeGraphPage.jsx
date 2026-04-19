import React, { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import {
  ArrowRight,
  ArrowLeft,
  CornerRightUp,
  Loader2,
  Network,
  Search,
  Share2,
  Tag,
  X,
  ChevronRight,
} from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { LatticeFrame } from './LatticeFrame';
import { getBackendBaseUrl, getLatticeGraph, getRelatedNodes, getLattices, queryLattice } from '../services/latticeApi';
import './LatticePages.css';

const demoNodes = [
  { id: 'demo-1', label: 'Cognitive Architectures', x: 50, y: 50, radius: 32, category: 'core', summary: 'Central thesis on merging biological memory paradigms with LLM state routing.', tags: ['architecture', 'ai', 'research'], importanceScore: 0.91 },
  { id: 'demo-2', label: 'Sparse Autoencoders', x: 32, y: 28, radius: 22, category: 'research', summary: 'Breaking down dense model representations into mathematically interpretable features.', tags: ['ml', 'interpretability'], importanceScore: 0.72 },
  { id: 'demo-3', label: 'Episodic Memory', x: 68, y: 35, radius: 20, category: 'dev', summary: 'Techniques allowing models to retrieve specific past instances vs procedural loops.', tags: ['memory', 'agents'], importanceScore: 0.64 },
  { id: 'demo-4', label: 'Rust Ownership', x: 82, y: 75, radius: 12, category: 'decay', summary: 'Basic notes on Rust. Fading due to inactivity.', tags: ['rust', 'learning'], importanceScore: 0.19 },
  { id: 'demo-5', label: 'Agentic Workflows', x: 28, y: 65, radius: 24, category: 'dev', summary: 'Patterns for implementing multi-agent loops with isolated tool access.', tags: ['workflows', 'python'], importanceScore: 0.79 },
  { id: 'demo-6', label: 'Phenomenology', x: 85, y: 15, radius: 16, category: 'concept', summary: 'Philosophical foundations regarding the structures of conscious experience.', tags: ['philosophy'], importanceScore: 0.55 },
  { id: 'demo-7', label: 'Vector Benchmarks', x: 45, y: 80, radius: 18, category: 'data', summary: 'Latency comparisons between Pinecone, Weaviate, and pgvector.', tags: ['database', 'infra'], importanceScore: 0.66 },
];

const demoEdges = [
  { from: 'demo-1', to: 'demo-2', weight: 0.91, type: 'semantic' },
  { from: 'demo-1', to: 'demo-3', weight: 0.88, type: 'semantic' },
  { from: 'demo-1', to: 'demo-5', weight: 0.82, type: 'semantic' },
  { from: 'demo-2', to: 'demo-3', weight: 0.74, type: 'tag' },
  { from: 'demo-3', to: 'demo-6', weight: 0.63, type: 'semantic' },
  { from: 'demo-5', to: 'demo-7', weight: 0.7, type: 'behavior' },
  { from: 'demo-7', to: 'demo-1', weight: 0.69, type: 'semantic' },
];

const colorMap = {
  root: '#f8fafc',
  hub: '#2ecc71',
  educational: '#60a5fa',
  tech: '#22c55e',
  reddit: '#f97316',
  tweets: '#06b6d4',
  core: '#ffffff',
  research: '#9e9e9e',
  dev: '#b0b0b0',
  data: '#888888',
  concept: '#e0e0e0',
  decay: '#555555',
  collab: '#2ecc71',
};

const fallbackGraph = {
  nodes: demoNodes,
  edges: demoEdges,
};

const GRAPH_CACHE_PREFIX = 'lattice:graph-cache:';
const GRAPH_CACHE_TTL_MS = 5 * 60 * 1000;

const readGraphCache = (latticeId) => {
  if (typeof window === 'undefined' || !latticeId) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(`${GRAPH_CACHE_PREFIX}${latticeId}`);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const cachedAt = Number(parsed?.cachedAt || 0);
    const graph = parsed?.graph;

    if (!graph || !cachedAt || (Date.now() - cachedAt) > GRAPH_CACHE_TTL_MS) {
      return null;
    }

    return graph;
  } catch {
    return null;
  }
};

const writeGraphCache = (latticeId, graph) => {
  if (typeof window === 'undefined' || !latticeId || !graph) {
    return;
  }

  try {
    window.localStorage.setItem(`${GRAPH_CACHE_PREFIX}${latticeId}`, JSON.stringify({
      cachedAt: Date.now(),
      graph,
    }));
  } catch {
    // Ignore storage failures.
  }
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const isObjectId = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);

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

  if (text.includes('reddit')) {
    return 'Reddit';
  }

  if (text.includes('twitter') || text.includes('tweet')) {
    return 'Tweets';
  }

  if (text.includes('education') || text.includes('course') || text.includes('tutorial')) {
    return 'Educational';
  }

  if (/(tech|frontend|backend|react|javascript|engineering|coding|programming|software|product|developer|api|saas|devops|startup|github|gitlab|nodejs|node\.js|typescript|web\s?dev|leetcode|codeforces|hackerrank|atcoder|geeksforgeeks|competitive\s?programming|dsa|data\s?structures?|algorithms?)/.test(text)) {
    return 'Tech';
  }

  return 'General';
};

const getNodeCategory = (node) => {
  if (node.nodeType === 'root') {
    return 'root';
  }

  if (node.nodeType === 'hub') {
    const hub = normalizeHubLabel(node.parentHub || node.title || 'General').toLowerCase();
    return colorMap[hub] ? hub : 'hub';
  }

  const tags = (node.tags || []).map((tag) => String(tag).toLowerCase());
  const score = Number(node.importanceScore ?? 0);
  const ageDays = node.lastAccessed
    ? (Date.now() - new Date(node.lastAccessed).getTime()) / (1000 * 60 * 60 * 24)
    : 0;

  if (score < 0.25 || ageDays > 30) {
    return 'decay';
  }

  if (tags.some((tag) => ['team', 'shared', 'collab', 'collaborative', 'project'].includes(tag))) {
    return 'collab';
  }

  if (tags.some((tag) => ['research', 'ai', 'ml', 'architecture'].includes(tag))) {
    return 'research';
  }

  if (tags.some((tag) => ['data', 'database', 'infra'].includes(tag))) {
    return 'data';
  }

  if (score >= 0.8) {
    return 'core';
  }

  return 'dev';
};

const createBaseNode = (node, index) => {
  const importance = clamp(Number(node.importanceScore ?? 0.4), 0.15, 1);
  const nodeType = node.nodeType || 'bookmark';
  const compactRadius = nodeType === 'root'
    ? Math.round(7 + importance * 3)
    : nodeType === 'hub'
      ? Math.round(5 + importance * 2)
      : Math.round(3 + importance * 4);

  return {
    ...node,
    id: String(node._id || node.id || `node-${index}`),
    label: node.title || node.label || 'Untitled',
    title: node.title || node.label || 'Untitled',
    nodeType,
    parentHub: normalizeHubLabel(node.parentHub || ''),
    category: node.category || getNodeCategory(node),
    summary: node.summary || '',
    tags: node.tags || [],
    radius: node.radius || compactRadius,
    x: typeof node.x === 'number' ? node.x : null,
    y: typeof node.y === 'number' ? node.y : null,
  };
};

const ensureHierarchyNodes = (nodes, edges) => {
  const nextNodes = [...nodes];
  const nextEdges = [...edges];
  const nodeMap = new Map(nextNodes.map((node) => [String(node.id), node]));

  let rootNode = nextNodes.find((node) => node.nodeType === 'root');
  if (!rootNode) {
    rootNode = createBaseNode({ id: 'synthetic-root', title: 'Knowledge Root', nodeType: 'root', tags: ['root', 'lattice'], importanceScore: 1 }, 0);
    nextNodes.push(rootNode);
    nodeMap.set(rootNode.id, rootNode);
  }

  const hubsByName = new Map();
  nextNodes.forEach((node) => {
    if (node.nodeType === 'hub') {
      const name = normalizeHubLabel(node.parentHub || node.title || 'General');
      node.parentHub = name;
      hubsByName.set(name, node);
    }
  });

  const edgeKeys = new Set(nextEdges.map((edge) => `${edge.type || 'semantic'}:${edge.source}->${edge.target}`));

  const addHierarchyEdge = (source, target) => {
    const forwardKey = `hierarchy:${source}->${target}`;
    const reverseKey = `hierarchy:${target}->${source}`;

    if (!edgeKeys.has(forwardKey)) {
      nextEdges.push({ source, target, weight: 1, type: 'hierarchy' });
      edgeKeys.add(forwardKey);
    }

    if (!edgeKeys.has(reverseKey)) {
      nextEdges.push({ source: target, target: source, weight: 1, type: 'hierarchy' });
      edgeKeys.add(reverseKey);
    }
  };

  nextNodes.forEach((node) => {
    if (node.nodeType === 'root' || node.nodeType === 'hub') {
      return;
    }

    const hubName = inferHubFromNode(node);
    node.parentHub = hubName;

    let hubNode = hubsByName.get(hubName);
    if (!hubNode) {
      hubNode = createBaseNode({
        id: `synthetic-hub-${hubName.toLowerCase().replace(/\s+/g, '-')}`,
        title: hubName,
        nodeType: 'hub',
        parentHub: hubName,
        importanceScore: 0.85,
        tags: [hubName.toLowerCase(), 'hub'],
      }, nextNodes.length + 1);

      nextNodes.push(hubNode);
      nodeMap.set(hubNode.id, hubNode);
      hubsByName.set(hubName, hubNode);
    }

    addHierarchyEdge(rootNode.id, hubNode.id);
    addHierarchyEdge(hubNode.id, node.id);
  });

  return {
    nodes: nextNodes,
    edges: nextEdges,
  };
};

const layoutHierarchyNodes = (nodes, edges) => {
  const rootNode = nodes.find((node) => node.nodeType === 'root');
  const hierarchyEdges = edges.filter((edge) => edge.type === 'hierarchy');

  const childrenBySource = new Map();
  hierarchyEdges.forEach((edge) => {
    const source = String(edge.source);
    const target = String(edge.target);
    const list = childrenBySource.get(source) || [];
    list.push(target);
    childrenBySource.set(source, list);
  });

  const positioned = new Map();

  if (rootNode) {
    positioned.set(rootNode.id, {
      ...rootNode,
      x: 50,
      y: 50,
      radius: Math.max(rootNode.radius || 10, 10),
    });
  }

  const hubIds = rootNode
    ? (childrenBySource.get(String(rootNode.id)) || []).filter((id, index, arr) => arr.indexOf(id) === index)
    : [];

  const hubs = hubIds
    .map((id) => nodes.find((node) => String(node.id) === String(id)))
    .filter(Boolean);

  hubs.forEach((hub, index) => {
    const angle = (index / Math.max(hubs.length, 1)) * Math.PI * 2;
    const x = clamp(50 + Math.cos(angle) * 28, 12, 88);
    const y = clamp(50 + Math.sin(angle) * 22, 12, 88);

    positioned.set(hub.id, {
      ...hub,
      x,
      y,
      radius: Math.max(hub.radius || 7, 7),
    });

    const childIds = (childrenBySource.get(String(hub.id)) || []).filter((id) => id !== String(rootNode?.id));
    const children = childIds
      .map((id) => nodes.find((node) => String(node.id) === String(id)))
      .filter((node) => node && node.nodeType !== 'hub' && node.nodeType !== 'root');

    children.forEach((child, childIndex) => {
      const childAngle = (childIndex / Math.max(children.length, 1)) * Math.PI * 2;
      const childRadius = 10 + Math.min(children.length * 1.4, 10);

      positioned.set(child.id, {
        ...child,
        x: clamp(x + Math.cos(childAngle) * childRadius, 8, 92),
        y: clamp(y + Math.sin(childAngle) * childRadius, 8, 92),
        radius: Math.max(child.radius || 4, 4),
      });
    });
  });

  const unpositioned = nodes.filter((node) => !positioned.has(node.id));
  unpositioned.forEach((node, index) => {
    const angle = (index / Math.max(unpositioned.length, 1)) * Math.PI * 2;
    positioned.set(node.id, {
      ...node,
      x: clamp(50 + Math.cos(angle) * 40, 8, 92),
      y: clamp(50 + Math.sin(angle) * 34, 8, 92),
    });
  });

  return Array.from(positioned.values());
};

const normalizeLiveGraph = (graph = {}) => {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];

  const normalizedNodes = nodes.map((node, index) => createBaseNode(node, index));
  const baseNodeIndex = new Map(normalizedNodes.map((node) => [String(node.id), node]));

  const dedupedEdges = [];
  const seen = new Set();

  for (const edge of edges) {
    const from = String(edge.from?._id || edge.from || '');
    const to = String(edge.to?._id || edge.to || '');

    if (!from || !to || from === to || !baseNodeIndex.has(from) || !baseNodeIndex.has(to)) {
      continue;
    }

    const key = `${edge.type || 'semantic'}:${[from, to].sort().join(':')}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    dedupedEdges.push({
      source: from,
      target: to,
      weight: Number(edge.weight ?? 0),
      type: edge.type || 'semantic',
    });
  }

  const hierarchyGraph = ensureHierarchyNodes(normalizedNodes, dedupedEdges);
  const layoutNodes = layoutHierarchyNodes(hierarchyGraph.nodes, hierarchyGraph.edges);
  const nodeIndex = new Map(layoutNodes.map((node) => [String(node.id), node]));

  return {
    nodes: layoutNodes,
    edges: hierarchyGraph.edges,
    nodeIndex,
  };
};

const normalizeNodeRecord = (node, fallback = {}) => {
  if (!node) {
    return null;
  }

  const rawId = node._id || node.id || fallback.id || '';

  return {
    ...fallback,
    ...node,
    id: String(rawId),
    label: node.title || node.label || fallback.label || 'Untitled',
    title: node.title || node.label || fallback.title || 'Untitled',
    summary: node.summary || fallback.summary || '',
    tags: Array.isArray(node.tags) ? node.tags : fallback.tags || [],
    nodeType: node.nodeType || fallback.nodeType || 'bookmark',
    parentHub: node.parentHub || fallback.parentHub || 'General',
    category: node.category || fallback.category || getNodeCategory(node),
    importanceScore: typeof node.importanceScore === 'number' ? node.importanceScore : fallback.importanceScore ?? 0,
    lastAccessed: node.lastAccessed || node.updatedAt || fallback.lastAccessed || null,
  };
};

export const LatticeGraphPage = () => {
  const { projectId } = useParams();
  const location = useLocation();

  const [lattices, setLattices] = useState([]);
  const [latticesLoading, setLatticesLoading] = useState(true);
  const [latticesError, setLatticesError] = useState('');
  const [selectedLatticeId, setSelectedLatticeId] = useState('');
  const [activeNode, setActiveNode] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [graphData, setGraphData] = useState(fallbackGraph);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState('');
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedNodes, setRelatedNodes] = useState([]);
  const [query, setQuery] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState('');
  const [queryMatches, setQueryMatches] = useState([]);
  const [graphViewMode, setGraphViewMode] = useState('2d');
  const [graphViewport, setGraphViewport] = useState({ width: 0, height: 0 });
  const [visibleNodeCount, setVisibleNodeCount] = useState(0);
  const graphCanvasRef = useRef(null);
  const forceGraphRef = useRef(null);

  const isProjectScoped = Boolean(projectId);
  const latticeId = selectedLatticeId.trim();
  const liveMode = Boolean(latticeId);
  const baseUrl = getBackendBaseUrl();
  const routeProjectName = typeof location.state?.projectName === 'string' ? location.state.projectName.trim() : '';

  const normalizedGraph = useMemo(() => {
    if (!liveMode) {
      return normalizeLiveGraph(fallbackGraph);
    }

    return normalizeLiveGraph(graphData);
  }, [graphData, liveMode]);

  useEffect(() => {
    const totalNodes = normalizedGraph.nodes.length;

    if (totalNodes <= 0) {
      setVisibleNodeCount(0);
      return undefined;
    }

    setVisibleNodeCount(0);

    const step = totalNodes > 120 ? 4 : totalNodes > 60 ? 2 : 1;
    const delayMs = totalNodes > 120 ? 12 : 22;

    const intervalId = window.setInterval(() => {
      setVisibleNodeCount((previous) => {
        const next = previous + step;
        if (next >= totalNodes) {
          window.clearInterval(intervalId);
          return totalNodes;
        }

        return next;
      });
    }, delayMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [normalizedGraph.nodes]);

  const renderedGraph = useMemo(() => {
    const targetCount = clamp(visibleNodeCount, 0, normalizedGraph.nodes.length);
    const nodes = normalizedGraph.nodes.slice(0, targetCount);
    const visibleIds = new Set(nodes.map((node) => String(node.id)));

    const edges = normalizedGraph.edges.filter((edge) => {
      return visibleIds.has(String(edge.source)) && visibleIds.has(String(edge.target));
    });

    return {
      nodes,
      edges,
      nodeIndex: new Map(nodes.map((node) => [String(node.id), node])),
    };
  }, [normalizedGraph.edges, normalizedGraph.nodes, visibleNodeCount]);

  const nodeLookup = renderedGraph.nodeIndex;

  useEffect(() => {
    if (isProjectScoped) {
      setLattices([]);
      setLatticesLoading(false);
      setLatticesError('');
      setSelectedLatticeId(projectId || '');
      return;
    }

    let isMounted = true;

    const loadLattices = async () => {
      try {
        setLatticesLoading(true);
        setLatticesError('');

        const response = await getLattices();
        if (!isMounted) {
          return;
        }

        const nextLattices = Array.isArray(response.lattices) ? response.lattices : [];
        setLattices(nextLattices);

        const queryMatch = new URLSearchParams(window.location.search).get('latticeId');
        const fallbackSelection = queryMatch && nextLattices.some((item) => item.id === queryMatch)
          ? queryMatch
          : nextLattices[0]?.id || '';

        setSelectedLatticeId(fallbackSelection);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLattices([]);
        setLatticesError(error.message || 'Could not load your lattices.');
      } finally {
        if (isMounted) {
          setLatticesLoading(false);
        }
      }
    };

    loadLattices();

    return () => {
      isMounted = false;
    };
  }, [isProjectScoped, projectId]);

  useEffect(() => {
    let isMounted = true;

    const loadGraph = async () => {
      if (!liveMode) {
        setGraphData(fallbackGraph);
        setGraphError('');
        return;
      }

      if (!selectedLatticeId) {
        setGraphData(fallbackGraph);
        setGraphError(isProjectScoped ? 'Project graph is unavailable.' : 'Select a lattice loaded from the backend.');
        return;
      }

      const cachedGraph = readGraphCache(selectedLatticeId);
      if (cachedGraph) {
        setGraphData(cachedGraph);
        setGraphError('');
      }

      try {
        if (!cachedGraph) {
          setGraphLoading(true);
        }
        setGraphError('');
        const response = await getLatticeGraph(selectedLatticeId);

        if (!isMounted) {
          return;
        }

        const nextGraph = response.graph || fallbackGraph;
        setGraphData(nextGraph);
        writeGraphCache(selectedLatticeId, nextGraph);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setGraphError(error.message || 'Could not load project graph.');
        if (!cachedGraph) {
          setGraphData(fallbackGraph);
        }
      } finally {
        if (isMounted) {
          setGraphLoading(false);
        }
      }
    };

    const loadGraphDeferred = () => {
      void loadGraph();
    };

    const idleHandle = window.requestIdleCallback
      ? window.requestIdleCallback(loadGraphDeferred, { timeout: 1000 })
      : window.setTimeout(loadGraphDeferred, 150);

    return () => {
      isMounted = false;
      if (typeof window.cancelIdleCallback === 'function' && typeof idleHandle === 'number') {
        window.cancelIdleCallback(idleHandle);
      } else {
        window.clearTimeout(idleHandle);
      }
    };
  }, [isProjectScoped, selectedLatticeId, liveMode]);

  useEffect(() => {
    if (!activeNode?.id || !liveMode || !isObjectId(activeNode.id)) {
      setRelatedNodes([]);
      return;
    }

    let isMounted = true;

    const loadRelated = async () => {
      try {
        setRelatedLoading(true);
        const response = await getRelatedNodes(activeNode.id);

        if (!isMounted) {
          return;
        }

        setRelatedNodes(response.related || []);
      } catch (error) {
        if (isMounted) {
          setRelatedNodes([]);
        }
      } finally {
        if (isMounted) {
          setRelatedLoading(false);
        }
      }
    };

    loadRelated();

    return () => {
      isMounted = false;
    };
  }, [activeNode?.id, liveMode]);

  const edgeKey = (edge) => [edge.source, edge.target].sort().join(':');

  const connectedNodeIds = useMemo(() => {
    if (!activeNode) {
      return new Set();
    }

    const ids = new Set([String(activeNode.id)]);

    renderedGraph.edges.forEach((edge) => {
      if (String(edge.source) === String(activeNode.id)) {
        ids.add(String(edge.target));
      }

      if (String(edge.target) === String(activeNode.id)) {
        ids.add(String(edge.source));
      }
    });

    return ids;
  }, [activeNode, renderedGraph.edges]);

  const graph3dData = useMemo(() => {
    const nodes = renderedGraph.nodes.map((node) => {
      const isActive = activeNode && String(activeNode.id) === String(node.id);
      const isConnected = connectedNodeIds.has(String(node.id));
      const faded = activeNode && !isActive && !isConnected;
      const nodeColor = colorMap[node.category] || '#cbd5e0';

      return {
        ...node,
        id: String(node.id),
        color: faded ? 'rgba(100, 116, 139, 0.35)' : nodeColor,
        val: node.nodeType === 'root' ? 14 : node.nodeType === 'hub' ? 11 : 7,
        x: (Number(node.x ?? 50) - 50) * 4,
        y: (50 - Number(node.y ?? 50)) * 4,
        z: node.nodeType === 'root' ? 14 : node.nodeType === 'hub' ? -6 : -18,
      };
    });

    const nodeById = new Map(nodes.map((node) => [String(node.id), node]));

    const links = renderedGraph.edges
      .map((edge) => {
        const source = nodeById.get(String(edge.source));
        const target = nodeById.get(String(edge.target));
        if (!source || !target) {
          return null;
        }

        const highlighted = activeNode
          && (String(activeNode.id) === String(edge.source) || String(activeNode.id) === String(edge.target));

        return {
          source: String(edge.source),
          target: String(edge.target),
          color: highlighted ? 'rgba(226, 232, 240, 0.85)' : 'rgba(148, 163, 184, 0.34)',
          width: highlighted ? 2.7 : Math.max(1, Number(edge.weight ?? 0.35) * 2.1),
          particles: highlighted ? 1 : 0,
        };
      })
      .filter(Boolean);

    return { nodes, links };
  }, [activeNode, connectedNodeIds, renderedGraph.edges, renderedGraph.nodes]);

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
        forceGraphRef.current?.zoomToFit(560, 30);
      } catch {
        // no-op
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [graph3dData.nodes.length, graphViewMode, graphViewport.height, graphViewport.width]);

  const handleLatticeChange = (event) => {
    setSelectedLatticeId(event.target.value);
    setActiveNode(null);
    setQuery('');
    setQueryResult('');
    setQueryMatches([]);
  };

  const handleNodeSelect = (node) => {
    const nextNode = normalizeNodeRecord(node);

    setActiveNode((previous) => {
      if (previous && String(previous.id) === String(nextNode?.id)) {
        return null;
      }

      return nextNode;
    });
  };

  const handleNodeZoom = (node) => {
    if (!node || graphViewMode !== '3d' || !forceGraphRef.current) {
      return;
    }

    const targetNode = normalizeNodeRecord(node);
    const position = {
      x: Number(targetNode?.x || node.x || 0),
      y: Number(targetNode?.y || node.y || 0),
      z: Number(targetNode?.z || node.z || 0),
    };

    const distance = 80;
    const distRatio = 1 + distance / Math.hypot(position.x || 0, position.y || 0, position.z || 0);

    try {
      forceGraphRef.current.cameraPosition(
        {
          x: position.x * distRatio,
          y: position.y * distRatio,
          z: position.z * distRatio,
        },
        targetNode,
        700
      );
    } catch {
      // Ignore camera animation failures and keep the graph usable.
    }
  };

  const handleQuerySubmit = async (event) => {
    event.preventDefault();

    if (!latticeId || !query.trim()) {
      return;
    }

    try {
      setQueryLoading(true);
      const response = await queryLattice(latticeId, query.trim());
      setQueryResult(response.answer || 'No answer returned.');
      setQueryMatches(response.matchedNodes || []);
    } catch (error) {
      setQueryResult(error.message || 'Query failed.');
      setQueryMatches([]);
    } finally {
      setQueryLoading(false);
    }
  };

  const activeNodeView = graphViewMode === '2d' && activeNode ? normalizeNodeRecord(activeNode) : null;
  const selectedLatticeName = isProjectScoped
    ? (routeProjectName || 'Project graph')
    : (selectedLatticeId ? lattices.find((item) => item.id === selectedLatticeId)?.name || 'Your lattice' : 'Your lattice');

  const relatedItems = relatedNodes.length
    ? relatedNodes.map((entry) => ({
      node: normalizeNodeRecord(entry.node || entry, { weight: entry.weight ?? entry.edge?.weight ?? entry.similarity ?? 0 }),
      weight: entry.weight ?? entry.edge?.weight ?? entry.similarity ?? 0,
    }))
    : normalizedGraph.edges
      .filter((edge) => activeNodeView && (String(edge.source) === String(activeNodeView.id) || String(edge.target) === String(activeNodeView.id)))
      .map((edge) => {
        const relatedId = String(edge.source) === String(activeNodeView.id) ? String(edge.target) : String(edge.source);
        return {
          weight: edge.weight,
          node: nodeLookup.get(relatedId),
        };
      })
      .filter((entry) => entry.node);

  return (
    <LatticeFrame>
      <div className="lat-graph-shell">
        <section className="lat-graph-header-card">
          <div>
            <span className="lat-graph-kicker">Your lattice map</span>
            <h2 className="lat-section-title">{selectedLatticeName}</h2>
            <p className="lat-graph-description">
              {isProjectScoped
                ? 'This graph belongs to the current project and updates from its own knowledge only.'
                : 'Pick one of your spaces and the map, connections, and smart answers will load automatically.'}
            </p>
            {isProjectScoped ? (
              <Link to={`/lattice/project/${projectId}`} state={{ projectName: selectedLatticeName }} className="project-back-link" style={{ marginTop: '12px' }}>
                <ArrowLeft size={14} /> Back to project
              </Link>
            ) : null}
          </div>

          {!isProjectScoped ? (
            <div className="lat-graph-connect-form">
              <label htmlFor="latticeSelect" className="lat-graph-input-label">Your spaces</label>
              <div className="lat-graph-connect-row">
                <select
                  id="latticeSelect"
                  value={selectedLatticeId}
                  onChange={handleLatticeChange}
                  className="lat-graph-connect-input"
                  disabled={latticesLoading || !lattices.length}
                >
                  {!lattices.length ? <option value="">No spaces available yet</option> : null}
                  {lattices.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
        </section>

        <section className="lat-graph-stats-row">
          <div className="lat-graph-stat-card">
            <span>Nodes</span>
            <strong>{renderedGraph.nodes.length}/{normalizedGraph.nodes.length}</strong>
          </div>
          <div className="lat-graph-stat-card">
            <span>Edges</span>
            <strong>{renderedGraph.edges.length}</strong>
          </div>
          <div className="lat-graph-stat-card">
            <span>Mode</span>
            <strong>{latticesLoading ? 'Loading...' : selectedLatticeId ? 'Ready' : 'Demo'}</strong>
          </div>
          <div className="lat-graph-stat-card">
            <span>Status</span>
            <strong>{graphLoading ? 'Loading...' : graphError ? 'Using sample data' : renderedGraph.nodes.length < normalizedGraph.nodes.length ? 'Streaming...' : 'Ready'}</strong>
          </div>
        </section>

        {latticesError ? <div className="lat-graph-alert">{latticesError}</div> : null}

        {graphError ? <div className="lat-graph-alert">{graphError}</div> : null}

        <section className="lat-graph-workspace">
          <div className="lat-graph-canvas-panel">
            <div className="lat-graph-toolbar live">
              <div className="lat-toolbar-pill">
                <Network size={14} color="#a0aec0" />
                <span>{liveMode ? 'Space Map' : 'Sample Map'}</span>
              </div>
              <div className="lat-graph-view-toggle" role="group" aria-label="Project graph view mode">
                <button
                  type="button"
                  className={`lat-graph-view-btn ${graphViewMode === '2d' ? 'active' : ''}`}
                  onClick={() => setGraphViewMode('2d')}
                >
                  2D
                </button>
                <button
                  type="button"
                  className={`lat-graph-view-btn ${graphViewMode === '3d' ? 'active' : ''}`}
                  onClick={() => setGraphViewMode('3d')}
                >
                  3D
                </button>
              </div>
              {graphLoading ? <Loader2 size={14} className="lat-spinner" /> : null}
            </div>

            <div className="lat-graph-canvas-wrap">
              <div className="lat-graph-canvas" ref={graphCanvasRef}>
                {graphViewMode === '3d' && graph3dData.nodes.length > 0 && graphViewport.width > 0 && graphViewport.height > 0 ? (
                  <ForceGraph3D
                    ref={forceGraphRef}
                    graphData={graph3dData}
                    width={graphViewport.width}
                    height={graphViewport.height}
                    backgroundColor="#09090b"
                    showNavInfo={false}
                    nodeLabel={(node) => `${node.label} (${node.nodeType || 'bookmark'})`}
                    nodeColor={(node) => node.color}
                    nodeVal={(node) => node.val}
                    nodeResolution={18}
                    linkColor={(link) => link.color}
                    linkWidth={(link) => link.width}
                    linkDirectionalParticles={(link) => link.particles || 0}
                    linkDirectionalParticleWidth={1.4}
                    linkDirectionalParticleSpeed={0.008}
                    cooldownTicks={36}
                    d3VelocityDecay={0.72}
                    enableNodeDrag={false}
                    onNodeClick={(node) => handleNodeZoom(node)}
                  />
                ) : null}

                {graphViewMode === '2d' ? (
                <svg className="lat-graph-svg">
                  {renderedGraph.edges.map((edge) => {
                    const source = nodeLookup.get(String(edge.source));
                    const target = nodeLookup.get(String(edge.target));

                    if (!source || !target) {
                      return null;
                    }

                    const highlighted = activeNode && (String(activeNode.id) === String(edge.source) || String(activeNode.id) === String(edge.target));
                    const faded = activeNode && !highlighted && !connectedNodeIds.has(String(edge.source)) && !connectedNodeIds.has(String(edge.target));

                    return (
                      <line
                        key={edgeKey(edge)}
                        x1={`${source.x}%`}
                        y1={`${source.y}%`}
                        x2={`${target.x}%`}
                        y2={`${target.y}%`}
                        className={`lat-graph-line ${highlighted ? 'highlighted' : ''} ${faded ? 'faded' : ''}`}
                        style={{ strokeOpacity: clamp(Number(edge.weight || 0.3), 0.08, 1) }}
                      />
                    );
                  })}
                </svg>
                ) : null}

                {graphViewMode === '2d' ? renderedGraph.nodes.map((node) => {
                  const highlighted = activeNode?.id === node.id;
                  const isConnected = connectedNodeIds.has(String(node.id));
                  const faded = activeNode && !highlighted && !isConnected;
                  const nodeColor = colorMap[node.category] || '#cbd5e0';
                  const visualRadius = clamp(Number(node.radius || 4), 3, node.nodeType === 'root' ? 11 : node.nodeType === 'hub' ? 8 : 7);
                  const hitRadius = Math.max(12, visualRadius + 8);

                  return (
                    <button
                      key={node.id}
                      type="button"
                      className={`lat-graph-node reset-button ${faded ? 'faded' : ''} ${highlighted ? 'active' : ''}`}
                      style={{
                        left: `${node.x}%`,
                        top: `${node.y}%`,
                        width: `${hitRadius * 2}px`,
                        height: `${hitRadius * 2}px`,
                      }}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                        onClick={() => handleNodeSelect(node)}
                      aria-label={`Open node ${node.label}`}
                    >
                      <div
                        className="lat-graph-circle"
                        style={{
                          width: `${visualRadius * 2}px`,
                          height: `${visualRadius * 2}px`,
                          backgroundColor: nodeColor,
                          boxShadow: highlighted || hoveredNodeId === node.id ? `0 0 20px ${nodeColor}80` : 'none',
                          opacity: node.category === 'decay' ? 0.45 : 1,
                        }}
                      >
                        {node.category === 'decay' ? <div className="lat-graph-decay-core" /> : null}
                      </div>

                      <div className="lat-graph-label">{node.label}</div>
                    </button>
                  );
                }) : null}
              </div>

              {!normalizedGraph.nodes.length ? (
                <div className="lat-graph-empty-state">
                  <Search size={18} />
                  <p>{isProjectScoped ? 'No graph nodes yet for this project.' : 'Load a lattice ID to render a live knowledge graph from the backend.'}</p>
                </div>
              ) : null}
            </div>
          </div>

          <aside className={`lat-graph-panel open ${graphViewMode === '3d' ? 'graph-panel-3d' : ''}`}>
            {activeNodeView ? (
              <>
                <div className="lat-panel-header">
                  <div className="lat-panel-type">
                    <div className="lat-type-dot" style={{ background: colorMap[activeNodeView.category] || '#94a3b8' }} />
                    {String(activeNodeView.category || 'node').toUpperCase()}
                  </div>
                  <button className="lat-panel-close" onClick={() => setActiveNode(null)} type="button">
                    <X size={18} />
                  </button>
                </div>

                <h2 className="lat-panel-title">{activeNodeView.label}</h2>

                <div className="lat-panel-box ai-summary">
                  <div className="ai-summary-header">
                    <Sparkles size={14} color="#735bf2" /> Smart summary
                  </div>
                  <p>{activeNodeView.summary || 'No summary available.'}</p>
                </div>

                <div className="lat-panel-section">
                  <h3>Tags</h3>
                  <div className="lat-tags-row">
                    {(activeNodeView.tags || []).map((tag) => (
                      <span key={tag} className="lat-panel-tag">
                        <Tag size={12} /> {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="lat-panel-section">
                  <h3>Details</h3>
                  <div className="lat-node-meta-grid">
                    <div>
                      <span className="lat-node-meta-label">Activity</span>
                      <strong>{Number(activeNodeView.importanceScore ?? 0) > 0.6 ? 'High' : Number(activeNodeView.importanceScore ?? 0) > 0.3 ? 'Medium' : 'Low'}</strong>
                    </div>
                    <div>
                      <span className="lat-node-meta-label">Last seen</span>
                      <strong>{activeNodeView.lastAccessed ? new Date(activeNodeView.lastAccessed).toLocaleDateString() : 'Unknown'}</strong>
                    </div>
                  </div>
                </div>

                <div className="lat-panel-section">
                  <h3>Connected ideas</h3>
                  {relatedLoading ? (
                    <div className="lat-panel-loading">
                      <Loader2 size={14} className="lat-spinner" /> Finding related ideas...
                    </div>
                  ) : null}
                  <div className="lat-connections-list">
                    {relatedItems.map((entry, index) => {
                      const entryNode = entry.node;
                      if (!entryNode) {
                        return null;
                      }

                      const relatedLabel = entryNode.label || entryNode.title;
                      const score = entry.weight ?? entry.edge?.weight ?? entry.similarity ?? 0;

                      return (
                        <div key={`${relatedLabel}-${index}`} className="lat-connection-item" onClick={() => handleNodeSelect(entryNode)}>
                          <CornerRightUp size={14} color="#a0aec0" />
                          <span>{relatedLabel}</span>
                          <small>{Number(score).toFixed(2)}</small>
                          <ChevronRight size={14} color="#cbd5e0" style={{ marginLeft: 'auto' }} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lat-panel-actions">
                  <button className="lat-panel-btn" type="button">
                    <Share2 size={14} /> Share idea
                  </button>
                </div>
              </>
            ) : (
              <div className="lat-panel-empty">
                <Network size={18} />
                <p>Select a point to see its connections.</p>
              </div>
            )}
          </aside>
        </section>

        <section className="lat-query-card">
          <div>
            <span className="lat-graph-kicker">Ask your space</span>
            <h3>Ask LATTICE</h3>
            <p>
              Ask a question and LATTICE will answer using the ideas in this space.
            </p>
          </div>

          <form className="lat-query-form" onSubmit={handleQuerySubmit}>
            <textarea
              className="lat-query-input"
              placeholder={latticeId ? 'What would you like to know about this project?' : 'Project not selected.'}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={!latticeId}
            />
            <button className="lat-query-btn" type="submit" disabled={!latticeId || queryLoading}>
              {queryLoading ? <Loader2 size={14} className="lat-spinner" /> : <ArrowRight size={14} />}
              {queryLoading ? 'Thinking...' : 'Ask'}
            </button>
          </form>

          {queryResult ? (
            <div className="lat-query-result">
              <div className="lat-query-result-head">
                <Sparkles size={14} /> Answer
              </div>
              <p>{queryResult}</p>
              {queryMatches.length ? (
                <div className="lat-query-matches">
                  {queryMatches.map((node) => (
                    <span key={String(node._id || node.id)} className="lat-query-match-chip">
                      {node.title || node.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </LatticeFrame>
  );
};