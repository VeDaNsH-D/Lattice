import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Command,
  Sparkles,
  Box,
  Link as LinkIcon,
  FileText,
  Loader2,
  Search,
  PlusCircle,
  FolderPlus,
  ArrowRight,
  FolderOpen,
  BrainCircuit,
  Network,
  User,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { searchSpotlight } from '../services/latticeApi';
import { askLatticeAI, parseAIResponse } from '../services/aiQuery';
import './LatticeSpotlight.css';

const getProjectIdFromPath = (pathname = '') => {
  const match = pathname.match(/^\/lattice\/project\/([^/]+)/);
  return match?.[1] || '';
};

export const LatticeSpotlight = ({ isOpen, onClose, currentUserId = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [context, setContext] = useState(null);
  const [contexts, setContexts] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiMode, setAiMode] = useState(false);
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiWarnings, setAiWarnings] = useState([]);
  const [aiError, setAiError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiContextsResolved, setAiContextsResolved] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const inputRef = useRef(null);
  const executeLockRef = useRef(false);

  // Keep Spotlight compact on open until the user interacts.
  useEffect(() => {
    if (!isOpen) {
      setIsInputFocused(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setQuery('');
    setContext(null);
    setAiMode(false);
    setAiAnswer('');
    setAiWarnings([]);
    setAiError('');
    setAiLoading(false);
    setAiContextsResolved(0);
    setError('');
    setResults([]);
    setSelectedIndex(0);
    setLoading(false);

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;

    const loadInitial = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await searchSpotlight({ query: '', limit: 8 });

        if (!isMounted) {
          return;
        }

        setContexts(Array.isArray(response.contexts) ? response.contexts : []);
        setResults([]);
      } catch (requestError) {
        if (isMounted) {
          setError(requestError.message || 'Could not load spotlight.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInitial();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const trimmed = query.trim();
    const isSlashMode = trimmed.startsWith('/');

    if (!trimmed || isSlashMode) {
      setResults([]);
      setSelectedIndex(0);
      setLoading(false);
      setError('');
      return;
    }

    let isMounted = true;
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError('');

        const response = await searchSpotlight({
          query: trimmed,
          latticeId: context?.id || '',
          limit: 10,
        });

        if (!isMounted) {
          return;
        }

        const nextContexts = Array.isArray(response.contexts) ? response.contexts : [];
        const nextResults = Array.isArray(response.results) ? response.results : [];

        setContexts(nextContexts);
        setResults(nextResults);
        setSelectedIndex((previous) => (nextResults.length ? Math.min(previous, nextResults.length - 1) : 0));
      } catch (requestError) {
        if (isMounted) {
          setResults([]);
          setSelectedIndex(0);
          setError(requestError.message || 'Search failed.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }, 280);

    return () => {
      isMounted = false;
      window.clearTimeout(timeout);
    };
  }, [isOpen, query, context?.id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Close on escape
      if (e.key === 'Escape' && isOpen) {
        onClose();
        setQuery('');
        setContext(null);
        setAiMode(false);
        setError('');
        setIsInputFocused(false);
        setSelectedIndex(0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Derive state logic
  const isSlashMode = query.startsWith('/');
  const trimmedQuery = query.trim();
  const isAtMode = trimmedQuery.startsWith('@');
  const mentionToken = isAtMode ? trimmedQuery.slice(1).split(/\s+/)[0] : '';
  const mentionHasOnlyContext = /^@[^\s]*$/.test(trimmedQuery);
  const showAiResponse = aiLoading || Boolean(aiAnswer) || Boolean(aiError);
  const shouldExpand = query.trim().length > 0;
  const activeProjectId = getProjectIdFromPath(location.pathname);
  const isInsideProject = Boolean(activeProjectId);

  const contextSuggestions = useMemo(() => {
    if (!isAtMode) {
      return [];
    }

    const normalizedToken = String(mentionToken || '').toLowerCase();

    return contexts
      .filter((item) => {
        const name = String(item?.name || '').toLowerCase();
        return !normalizedToken || name.startsWith(normalizedToken) || name.includes(normalizedToken);
      })
      .slice(0, 8);
  }, [contexts, isAtMode, mentionToken]);

  const filteredResults = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();

    if (!trimmedQuery) {
      return [];
    }

    return results.filter((item) => {
      const title = String(item?.title || '').toLowerCase();
      const description = String(item?.description || '').toLowerCase();
      const metadata = String(item?.path || item?.project?.name || '').toLowerCase();
      return [title, description, metadata].some((value) => value.includes(trimmedQuery));
    });
  }, [query, results]);

  const resultCommands = useMemo(() => {
    return filteredResults.flatMap((item) => {
      const rawType = String(item?.type || '').toLowerCase();
      const mappedType = rawType === 'project' ? 'lattice' : rawType === 'link' ? 'link' : '';

      if (!mappedType) {
        return [];
      }

      const route = mappedType === 'lattice'
        ? `/lattice/${item.id}`
        : '';

      return {
        id: `result:${item.id}`,
        itemId: item.id,
        label: item.title,
        type: mappedType,
        route,
        metadata: item.path || item.project?.name || 'space',
        description: item.description || 'No preview available.',
        source: item,
      };
    });
  }, [filteredResults]);

  const actionCommands = useMemo(() => {
    const commands = [
      {
        id: 'action:ask-lattice',
        type: 'action',
        label: `Ask Lattice ${query ? `"${query}"` : ''}`,
        description: 'Generate a focused answer from your workspace',
        actionKey: 'ask-lattice',
      },
      {
        id: 'action:add-link',
        type: 'action',
        label: isInsideProject ? 'Add link to this lattice' : `Add something new to ${context ? context.name : 'your space'}`,
        description: 'Capture a new idea, note, or reference',
        actionKey: 'add-link',
      },
      {
        id: 'action:create-lattice',
        type: 'action',
        label: 'Create new lattice',
        description: 'Start a fresh lattice for a new topic',
        actionKey: 'create-lattice',
      },
    ];

    commands.push({
      id: 'action:go-profile',
      type: 'action',
      label: 'Go to profile',
      description: 'Open your public profile page',
      actionKey: 'go-profile',
      route: currentUserId ? `/profile/${currentUserId}` : '',
    });

    return commands;
  }, [context, currentUserId, isInsideProject, query]);

  const allCommands = useMemo(() => {
    if (isSlashMode) {
      return [];
    }

    return [...actionCommands, ...resultCommands];
  }, [actionCommands, resultCommands, isSlashMode]);

  const selectedCommand = useMemo(() => {
    if (!allCommands.length) {
      return null;
    }

    return allCommands[selectedIndex] || allCommands[0];
  }, [allCommands, selectedIndex]);

  const selectedResult = useMemo(() => {
    if (selectedCommand?.type !== 'lattice' && selectedCommand?.type !== 'link') {
      return resultCommands[0]?.source || null;
    }

    return selectedCommand?.source || resultCommands[0]?.source || null;
  }, [resultCommands, selectedCommand]);

  useEffect(() => {
    if (!isOpen || isSlashMode || !allCommands.length) {
      return;
    }

    setSelectedIndex((previous) => {
      if (previous >= 0 && previous < allCommands.length) {
        return previous;
      }

      return 0;
    });
  }, [allCommands, isOpen, isSlashMode]);

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setAiMode(false);
  };

  const selectContext = (ctx) => {
    setContext(ctx);
    setQuery(`@${ctx.name} `);
    setAiMode(false);
    setResults([]);
    setSelectedIndex(0);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const closeSpotlight = () => {
    setQuery('');
    setContext(null);
    setAiMode(false);
    setAiAnswer('');
    setAiWarnings([]);
    setAiError('');
    setAiLoading(false);
    setAiContextsResolved(0);
    setError('');
    setSelectedIndex(0);
    setIsInputFocused(false);
    onClose();
  };

  const runAiQuery = async (rawQuery) => {
    const trimmedQuery = String(rawQuery || '').trim();

    if (!trimmedQuery) {
      return;
    }

    setAiMode(true);
    setAiLoading(true);
    setAiError('');
    setAiAnswer('');
    setAiWarnings([]);
    setAiContextsResolved(0);

    try {
      const response = await askLatticeAI(trimmedQuery, activeProjectId || context?.id || '');
      const parsed = parseAIResponse(response);

      if (!parsed.success) {
        setAiError(parsed.response || 'Unable to generate an answer.');
        return;
      }

      setAiAnswer(parsed.response || 'No response generated.');
      setAiWarnings(Array.isArray(parsed.warnings) ? parsed.warnings : []);
      setAiContextsResolved(Number(parsed.contextsResolved || 0));
    } catch (requestError) {
      setAiError(requestError?.message || 'Unable to generate an answer.');
    } finally {
      setAiLoading(false);
    }
  };

  const executeCommand = async (command) => {
    if (!command || executeLockRef.current) {
      return;
    }

    executeLockRef.current = true;
    setIsExecuting(true);

    try {
      if ((command.type === 'lattice' || command.type === 'profile') && command.route) {
        navigate(command.route);
        closeSpotlight();
        return;
      }

      if (command.type === 'action') {
        if (command.actionKey === 'create-lattice') {
          window.dispatchEvent(new CustomEvent('lattice:open-create-modal', {
            detail: { source: 'spotlight' },
          }));
          navigate('/lattice/personal');
          closeSpotlight();
          return;
        }

        if (command.actionKey === 'add-link') {
          const targetProjectId = activeProjectId || context?.id || '';
          window.dispatchEvent(new CustomEvent('lattice:open-add-link-modal', {
            detail: {
              source: 'spotlight',
              projectId: targetProjectId,
            },
          }));
          if (!targetProjectId) {
            navigate('/lattice');
          }
          closeSpotlight();
          return;
        }

        if (command.actionKey === 'ask-lattice') {
          const trimmedQuery = query.trim();
          if (!trimmedQuery) {
            setAiMode(true);
            return;
          }

          if (/@([a-zA-Z0-9\-_]+)/.test(trimmedQuery)) {
            await runAiQuery(trimmedQuery);
            return;
          }

          window.dispatchEvent(new CustomEvent('lattice:open-chat', {
            detail: {
              source: 'spotlight',
              query: trimmedQuery,
              projectId: activeProjectId || context?.id || '',
            },
          }));

          closeSpotlight();
          return;
        }

        if (command.actionKey === 'go-profile' && command.route) {
          navigate(command.route);
          closeSpotlight();
          return;
        }
      }

      if (command.type === 'link') {
        const source = command.source || {};
        const targetProjectId = source?.project?.id || source?.projectId || context?.id || activeProjectId || '';

        if (targetProjectId && String(targetProjectId) !== String(activeProjectId)) {
          navigate(`/lattice/project/${targetProjectId}`, {
            state: {
              projectName: source?.project?.name || '',
              projectType: source?.project?.kind || 'collaborative',
              openLinkId: command.itemId,
            },
          });
          closeSpotlight();
          return;
        }

        window.dispatchEvent(new CustomEvent('lattice:open-link-modal', {
          detail: {
            id: source.id || command.itemId,
            projectId: targetProjectId,
            payload: source,
          },
        }));
        closeSpotlight();
        return;
      }
    } finally {
      window.setTimeout(() => {
        executeLockRef.current = false;
        setIsExecuting(false);
      }, 140);
    }
  };

  const handleInputKeyDown = (e) => {
    // If backspace on empty query and we have context, remove context
    if (e.key === 'Backspace' && query === '' && context) {
      setContext(null);
    }

    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && allCommands.length) {
      e.preventDefault();

      const direction = e.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (selectedIndex + direction + allCommands.length) % allCommands.length;

      setSelectedIndex(nextIndex);
      return;
    }

    if (e.key === 'Enter' && isAtMode && mentionHasOnlyContext) {
      e.preventDefault();

      const selectedContext = contextSuggestions[0] || null;
      if (!selectedContext) {
        setAiError('No matching context found. Try / to browse spaces.');
        setAiMode(true);
        return;
      }

      const aiQuery = `@${selectedContext.name} summarise all links`;
      setQuery(aiQuery);
      void runAiQuery(aiQuery);
      return;
    }

    if (e.key === 'Enter' && query.length > 0 && !isSlashMode) {
      if (/@([a-zA-Z0-9\-_]+)/.test(query.trim())) {
        e.preventDefault();
        void runAiQuery(query.trim());
        return;
      }

      if (selectedCommand) {
        void executeCommand(selectedCommand);
      } else {
        setAiMode(true);
      }
    }
  };

  const getItemTypeLabel = (item) => {
    const type = String(item?.type || '').toLowerCase();

    if (!type) {
      return 'Item';
    }

    if (type === 'lattice') {
      return 'Lattice';
    }

    if (type === 'link') {
      return 'Link';
    }

    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getResultIcon = (itemType) => {
    const type = String(itemType || '').toLowerCase();

    if (type === 'lattice') {
      return <Network size={15} />;
    }

    if (type === 'link') {
      return <LinkIcon size={15} />;
    }

    if (type === 'note' || type === 'document') {
      return <FileText size={15} />;
    }

    return <BrainCircuit size={15} />;
  };

  const formatDate = (value) => {
    if (!value) {
      return 'Just now';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'Just now';
    }

    return parsed.toLocaleDateString();
  };

  const normalizedAiAnswer = useMemo(() => {
    const raw = String(aiAnswer || '').trim();

    if (!raw) {
      return {
        items: [],
        paragraphs: [],
      };
    }

    // Remove common markdown noise so output reads cleanly in the panel.
    const cleaned = raw
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const looksLikeNumberedList = /\b1\.\s/.test(cleaned) && /\b2\.\s/.test(cleaned);

    if (looksLikeNumberedList) {
      const chunks = cleaned
        .split(/(?=\d+\.\s)/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 8);

      const items = chunks.map((chunk) => {
        const withoutIndex = chunk.replace(/^\d+\.\s*/, '').trim();
        const separatorIndex = withoutIndex.indexOf(' - ');

        if (separatorIndex === -1) {
          return {
            title: '',
            body: withoutIndex,
          };
        }

        return {
          title: withoutIndex.slice(0, separatorIndex).trim(),
          body: withoutIndex.slice(separatorIndex + 3).trim(),
        };
      });

      return {
        items,
        paragraphs: [],
      };
    }

    const paragraphs = cleaned
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 8);

    return {
      items: [],
      paragraphs,
    };
  }, [aiAnswer]);

  const contextLinkCount = context?.links ?? context?.nodes ?? 0;

  if (!isOpen) return null;

  return (
    <div className="spotlight-overlay" onClick={onClose}>
      <div
        className={`spotlight-modal ${shouldExpand ? 'expanded' : 'collapsed'}`}
        onClick={e => e.stopPropagation()}
      >
        
        {/* LEFT PANE */}
        <div className="spotlight-left">
          <div className="spotlight-header">
            <div className="spotlight-input-wrapper">
              <div className="spotlight-input-icon">
                <Search size={16} />
              </div>
              <input
                ref={inputRef}
                className="spotlight-input"
                placeholder="Search or ask Lattice..."
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
              />
              <div className="spotlight-shortcut">
                <Command size={13} />
                <span>K</span>
              </div>
            </div>

            {context && (
              <div className="spotlight-context-badge">
                <Box size={12} />
                <span className="spotlight-context-name">{context.name}</span>
                <span className="spotlight-context-meta">{contextLinkCount} items</span>
              </div>
            )}
          </div>

          <div className="spotlight-scroll">
            {error ? (
              <div className="spotlight-section">
                <span className="spotlight-section-title" style={{ color: '#b91c1c' }}>Error</span>
                <div className="spotlight-ai-response">
                  <p>{error}</p>
                </div>
              </div>
            ) : null}

            {showAiResponse ? (
              <div className="spotlight-section">
                <span className="spotlight-section-title">AI Status</span>
                <div className="spotlight-ai-response">
                  {aiLoading ? (
                    <p style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <Loader2 size={14} className="lat-spinner" />
                      Generating answer...
                    </p>
                  ) : aiError ? (
                    <p>{aiError}</p>
                  ) : (
                    <p>Answer generated. See the right panel for full response.</p>
                  )}
                </div>
              </div>
            ) : isSlashMode || (isAtMode && mentionHasOnlyContext) ? (
              <div className="spotlight-section">
                <span className="spotlight-section-title">Choose a space</span>
                {contextSuggestions.map((item, index) => (
                  <div
                    key={item.id}
                    className={`spotlight-row ${index === 0 ? 'active' : ''}`}
                    onClick={() => selectContext(item)}
                  >
                    <div className="spotlight-action-icon">
                      <FolderOpen size={15} />
                    </div>
                    <div className="spotlight-action-content">
                      <div className="spotlight-action-text">{item.name}</div>
                      <div className="spotlight-action-meta">{item.kind === 'collaborative' ? 'Collaborative' : 'Personal'}</div>
                    </div>
                  </div>
                ))}
                {!contextSuggestions.length ? (
                  <div className="spotlight-row">
                    <div className="spotlight-action-text">No spaces found for this context.</div>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <div className="spotlight-section">
                  <span className="spotlight-section-title">Quick Actions</span>
                  {actionCommands.map((command) => {
                    const isSelectedAction = selectedCommand?.id === command.id;
                    const actionIcon = command.actionKey === 'ask-lattice'
                      ? <Sparkles size={15} />
                      : command.actionKey === 'add-link'
                        ? <PlusCircle size={15} />
                        : command.actionKey === 'create-lattice'
                          ? <FolderPlus size={15} />
                          : <User size={15} />;

                    return (
                      <div
                        key={command.id}
                        className={`spotlight-row ${isSelectedAction ? 'active' : ''}`}
                        onMouseEnter={() => setSelectedIndex(actionCommands.findIndex((item) => item.id === command.id))}
                        onClick={() => void executeCommand(command)}
                      >
                        <div className="spotlight-action-icon">
                          {actionIcon}
                        </div>
                        <div className="spotlight-action-content">
                          <div className="spotlight-action-text">{command.label}</div>
                          <div className="spotlight-action-meta">{command.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="spotlight-section">
                  <span className="spotlight-section-title">Results</span>
                  {loading ? (
                    <div className="spotlight-row">
                      <div className="spotlight-match-content">
                        <div className="spotlight-match-title-row">
                          <span className="spotlight-match-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <Loader2 size={14} className="lat-spinner" /> Searching...
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {resultCommands.map((command, index) => (
                    <div
                      key={command.id}
                      className={`spotlight-row spotlight-result-row ${selectedIndex === actionCommands.length + index ? 'is-selected' : ''}`}
                      onMouseEnter={() => setSelectedIndex(actionCommands.length + index)}
                      onClick={() => void executeCommand(command)}
                    >
                      <div className="spotlight-match-icon">{getResultIcon(command.type)}</div>
                      <div className="spotlight-match-content">
                        <div className="spotlight-match-title-row">
                          <span className="spotlight-match-title">{command.label}</span>
                          <span className="spotlight-match-badge">{getItemTypeLabel(command)}</span>
                        </div>
                        <div className="spotlight-match-path">
                          <FileText size={12} />
                          {command.metadata}
                        </div>
                        <div className="spotlight-match-desc">
                          {command.description}
                        </div>
                      </div>
                      <ArrowRight size={14} className="spotlight-result-arrow" />
                    </div>
                  ))}

                  {!loading && query.trim() && !resultCommands.length ? (
                    <div className="spotlight-row">
                      <div className="spotlight-match-content">
                        <div className="spotlight-match-title-row">
                          <span className="spotlight-match-title">No matches for "{query.trim()}"</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT PANE: PREVIEW */}
        <div className="spotlight-right">
          {showAiResponse ? (
            <>
              <div className="spotlight-right-icon"><Sparkles size={16} /></div>
              <div className="spotlight-right-title">AI Answer</div>
              <div className="spotlight-right-type">Context Query</div>

              <div className="spotlight-preview-card">
                <h3>{query.trim() || 'Query'}</h3>
                {aiLoading ? (
                  <p style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Loader2 size={14} className="lat-spinner" />
                    Generating answer from selected contexts...
                  </p>
                ) : aiError ? (
                  <p>{aiError}</p>
                ) : normalizedAiAnswer.items.length > 0 ? (
                  <div className="spotlight-ai-answer-list compact">
                    {normalizedAiAnswer.items.map((item, index) => (
                      <div key={`right-ai-item-${index}`} className="spotlight-ai-answer-item">
                        {item.title ? <span className="spotlight-ai-answer-item-title">{item.title}</span> : null}
                        <span className="spotlight-ai-answer-item-body">{item.body}</span>
                      </div>
                    ))}
                  </div>
                ) : normalizedAiAnswer.paragraphs.length > 0 ? (
                  <div className="spotlight-ai-answer-paragraphs compact">
                    {normalizedAiAnswer.paragraphs.map((paragraph, index) => (
                      <p key={`right-ai-paragraph-${index}`}>{paragraph}</p>
                    ))}
                  </div>
                ) : (
                  <p>{aiAnswer || 'No answer generated.'}</p>
                )}

                {!aiLoading && aiWarnings.length > 0 ? (
                  <div className="spotlight-ai-warning-list">
                    {aiWarnings.map((warning, index) => (
                      <span key={`ai-warning-${index}`} className="spotlight-ai-warning-chip">{warning}</span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="spotlight-meta-grid">
                <span className="spotlight-meta-label">Contexts</span>
                <span className="spotlight-meta-value">{aiContextsResolved || 0}</span>

                <span className="spotlight-meta-label">Updated</span>
                <span className="spotlight-meta-value">{formatDate(new Date())}</span>
              </div>
            </>
          ) : (
            <>
              <div className="spotlight-right-icon">{selectedResult ? getResultIcon(selectedResult.type) : <Search size={16} />}</div>
              <div className="spotlight-right-title">{selectedResult?.title || 'Search results preview'}</div>
              <div className="spotlight-right-type">{selectedResult ? getItemTypeLabel(selectedResult) : 'Item'}</div>

              <div className="spotlight-right-location">
                <span className="spotlight-meta-label">Location</span>
                <span className="spotlight-meta-value">{selectedResult?.project?.name || 'Your space'}</span>
              </div>

              <div className="spotlight-preview-card faded">
                <h3>{selectedResult?.title || 'Pick a result to preview'}</h3>
                <p>{selectedResult?.description || 'Search across your spaces to see links and notes here.'}</p>
                <p>{selectedResult?.path || 'Use / to pick a space and narrow down results.'}</p>
                {selectedResult?.url ? <p>{selectedResult.url}</p> : null}
              </div>

              <div className="spotlight-meta-grid">
                <span className="spotlight-meta-label">Saved by</span>
                <span className="spotlight-meta-value">You</span>

                <span className="spotlight-meta-label">Updated</span>
                <span className="spotlight-meta-value">{formatDate(selectedResult?.updatedAt)}</span>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
