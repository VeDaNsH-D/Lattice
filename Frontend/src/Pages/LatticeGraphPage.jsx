import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  CornerRightUp,
  Loader2,
  Network,
  Sparkles,
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
  core: '#735bf2',
  research: '#ed64a6',
  dev: '#48bb78',
  data: '#4299e1',
  concept: '#ecc94b',
  decay: '#718096',
  collab: '#14b8a6',
};

const fallbackGraph = {
  nodes: demoNodes,
  edges: demoEdges,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const isObjectId = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);

const getNodeCategory = (node) => {
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

const buildLayoutNodes = (nodes) => {
  if (!nodes.length) {
    return [];
  }

  const centerX = 50;
  const centerY = 50;
  const radius = 30;

  return nodes.map((node, index) => {
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
    const importance = clamp(Number(node.importanceScore ?? 0.4), 0.15, 1);
    const nodeRadius = Math.round(12 + importance * 18);

    return {
      ...node,
      id: String(node._id || node.id),
      label: node.title || node.label || 'Untitled',
      category: node.category || getNodeCategory(node),
      summary: node.summary || '',
      tags: node.tags || [],
      radius: node.radius || nodeRadius,
      x: node.x ?? clamp(centerX + Math.cos(angle) * radius, 10, 90),
      y: node.y ?? clamp(centerY + Math.sin(angle) * radius, 12, 88),
    };
  });
};

const normalizeLiveGraph = (graph = {}) => {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];

  const layoutNodes = buildLayoutNodes(nodes);
  const nodeIndex = new Map(layoutNodes.map((node) => [String(node.id), node]));

  const dedupedEdges = [];
  const seen = new Set();

  for (const edge of edges) {
    const from = String(edge.from?._id || edge.from || '');
    const to = String(edge.to?._id || edge.to || '');

    if (!from || !to || from === to) {
      continue;
    }

    const key = [from, to].sort().join(':');
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

  return {
    nodes: layoutNodes,
    edges: dedupedEdges,
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

  const nodeLookup = normalizedGraph.nodeIndex;

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

      try {
        setGraphLoading(true);
        setGraphError('');
        const response = await getLatticeGraph(selectedLatticeId);

        if (!isMounted) {
          return;
        }

        setGraphData(response.graph || fallbackGraph);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setGraphError(error.message || 'Could not load project graph.');
        setGraphData(fallbackGraph);
      } finally {
        if (isMounted) {
          setGraphLoading(false);
        }
      }
    };

    loadGraph();

    return () => {
      isMounted = false;
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

    normalizedGraph.edges.forEach((edge) => {
      if (String(edge.source) === String(activeNode.id)) {
        ids.add(String(edge.target));
      }

      if (String(edge.target) === String(activeNode.id)) {
        ids.add(String(edge.source));
      }
    });

    return ids;
  }, [activeNode, normalizedGraph.edges]);

  const handleLatticeChange = (event) => {
    setSelectedLatticeId(event.target.value);
    setActiveNode(null);
    setQuery('');
    setQueryResult('');
    setQueryMatches([]);
  };

  const handleNodeSelect = (node) => {
    setActiveNode(normalizeNodeRecord(node));
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

  const activeNodeView = activeNode ? normalizeNodeRecord(activeNode) : null;
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
            <strong>{normalizedGraph.nodes.length}</strong>
          </div>
          <div className="lat-graph-stat-card">
            <span>Edges</span>
            <strong>{normalizedGraph.edges.length}</strong>
          </div>
          <div className="lat-graph-stat-card">
            <span>Mode</span>
            <strong>{latticesLoading ? 'Loading...' : selectedLatticeId ? 'Ready' : 'Demo'}</strong>
          </div>
          <div className="lat-graph-stat-card">
            <span>Status</span>
            <strong>{graphLoading ? 'Loading...' : graphError ? 'Using sample data' : 'Ready'}</strong>
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
              <button className="lat-toolbar-btn ai-btn" type="button" onClick={() => activeNode && handleNodeSelect(activeNode)}>
                <Sparkles size={14} /> Find patterns
              </button>
              {graphLoading ? <Loader2 size={14} className="lat-spinner" /> : null}
            </div>

            <div className="lat-graph-canvas-wrap">
              <div className="lat-graph-canvas">
                <svg className="lat-graph-svg">
                  {normalizedGraph.edges.map((edge) => {
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

                {normalizedGraph.nodes.map((node) => {
                  const highlighted = activeNode?.id === node.id;
                  const isConnected = connectedNodeIds.has(String(node.id));
                  const faded = activeNode && !highlighted && !isConnected;
                  const nodeColor = colorMap[node.category] || '#cbd5e0';

                  return (
                    <button
                      key={node.id}
                      type="button"
                      className={`lat-graph-node reset-button ${faded ? 'faded' : ''} ${highlighted ? 'active' : ''}`}
                      style={{ left: `${node.x}%`, top: `${node.y}%` }}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      onClick={() => handleNodeSelect(node)}
                    >
                      <div
                        className="lat-graph-circle"
                        style={{
                          width: `${node.radius * 2}px`,
                          height: `${node.radius * 2}px`,
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
                })}
              </div>

              {!normalizedGraph.nodes.length ? (
                <div className="lat-graph-empty-state">
                  <Search size={18} />
                  <p>{isProjectScoped ? 'No graph nodes yet for this project.' : 'Load a lattice ID to render a live knowledge graph from the backend.'}</p>
                </div>
              ) : null}
            </div>
          </div>

          <aside className={`lat-graph-panel open`}>
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