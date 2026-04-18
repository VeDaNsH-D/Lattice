import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Command, CornerDownLeft, Sparkles, Box, Link as LinkIcon, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { searchSpotlight } from '../services/latticeApi';
import './LatticeSpotlight.css';

export const LatticeSpotlight = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [context, setContext] = useState(null);
  const [contexts, setContexts] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedResultId, setSelectedResultId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiMode, setAiMode] = useState(false);
  const inputRef = useRef(null);

  // Keyboard shortcut listener
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
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
      setSelectedResultId('');
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
        setSelectedResultId((previous) => (nextResults.some((item) => item.id === previous) ? previous : (nextResults[0]?.id || '')));
      } catch (requestError) {
        if (isMounted) {
          setResults([]);
          setSelectedResultId('');
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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Derive state logic
  const isSlashMode = query.startsWith('/');
  const showAiResponse = aiMode && query.length > 5 && !isSlashMode;
  const selectedResult = useMemo(() => {
    if (!results.length) {
      return null;
    }

    return results.find((item) => item.id === selectedResultId) || results[0];
  }, [results, selectedResultId]);

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setAiMode(false);
  };

  const selectContext = (ctx) => {
    setContext(ctx);
    setQuery('');
    setAiMode(false);
    setResults([]);
    setSelectedResultId('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleInputKeyDown = (e) => {
    // If backspace on empty query and we have context, remove context
    if (e.key === 'Backspace' && query === '' && context) {
      setContext(null);
    }
    if (e.key === 'Enter' && query.length > 0 && !isSlashMode) {
      if (results.length) {
        setSelectedResultId(results[0].id);
      } else {
        setAiMode(true);
      }
    }
  };

  const contextLinkCount = context?.links ?? context?.nodes ?? 0;

  if (!isOpen) return null;

  return (
    <div className="spotlight-overlay" onClick={onClose}>
      <div className="spotlight-modal" onClick={e => e.stopPropagation()}>
        
        {/* LEFT PANE */}
        <div className="spotlight-left">
          <div className="spotlight-header">
            <div className="spotlight-input-wrapper">
              <div className="spotlight-input-icon">
                {context ? '🧠' : '🤔'}
              </div>
              <input 
                ref={inputRef}
                className="spotlight-input"
                placeholder={context ? `${context.name} · ask anything...` : "Search or ask a question..."}
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
              />
              <div style={{ color: '#a0a0a0', display: 'flex', alignItems: 'center' }}>
                <Command size={16} /> <span style={{fontSize:'0.75rem', marginLeft:'2px'}}>K</span>
              </div>
            </div>
            
            {context && (
              <div className="spotlight-context-badge">
                <Box size={12}/> {context.name} <span>• {contextLinkCount} items</span>
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
                <span className="spotlight-section-title">Answer</span>
                <div className="spotlight-ai-response">
                  <p>Based on <strong>{context ? context.name : "your space"}</strong>, here’s a simple summary of the most relevant ideas. You can keep searching or open the matching note for more detail.</p>
                </div>
              </div>
            ) : isSlashMode ? (
              <div className="spotlight-section">
                <span className="spotlight-section-title">Choose a space</span>
                {contexts.map((item, index) => (
                  <div
                    key={item.id}
                    className={`spotlight-row ${index === 0 ? 'active' : ''}`}
                    onClick={() => selectContext(item)}
                  >
                    <div className="spotlight-action-icon"><Box color={item.kind === 'collaborative' ? '#48bb78' : '#735bf2'} size={16}/></div>
                    <div className="spotlight-action-text">{item.name}</div>
                  </div>
                ))}
                {!contexts.length ? (
                  <div className="spotlight-row">
                    <div className="spotlight-action-text">No spaces found.</div>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <div className="spotlight-section">
                  <span className="spotlight-section-title">Quick actions</span>
                  <div className="spotlight-row active">
                    <div className="spotlight-action-icon"><Sparkles color="#735bf2" size={18}/></div>
                    <div className="spotlight-action-text">Ask LATTICE {query ? `"${query}"` : ""}</div>
                  </div>
                  <div className="spotlight-row">
                    <div className="spotlight-action-icon" style={{background:'#48bb78', borderRadius:'50%'}}></div>
                    <div className="spotlight-action-text">Add something new to {context ? context.name : "your space"}</div>
                  </div>
                  {!context && (
                    <div className="spotlight-row">
                      <div className="spotlight-action-icon"><PlusCircle size={18} color="#e53e3e"/></div>
                      <div className="spotlight-action-text">Create a new space</div>
                    </div>
                  )}
                </div>

                <div className="spotlight-section">
                  <span className="spotlight-section-title">Suggested matches</span>
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
                  
                  {results.map((item) => (
                    <div
                      key={item.id}
                      className="spotlight-row"
                      onClick={() => setSelectedResultId(item.id)}
                      style={{ borderColor: selectedResult?.id === item.id ? '#dbeafe' : undefined, background: selectedResult?.id === item.id ? '#f8fbff' : undefined }}
                    >
                      <div className="spotlight-match-icon">{item.type === 'project' ? '📁' : item.type === 'link' ? '🔗' : '🧠'}</div>
                      <div className="spotlight-match-content">
                        <div className="spotlight-match-title-row">
                          <span className="spotlight-match-title">{item.title}</span>
                          {item.type === 'node' ? <span className="spotlight-match-badge verified">Node</span> : null}
                        </div>
                        <div className="spotlight-match-path">
                          <FileText size={12}/> {item.path || item.project?.name || 'space'}
                        </div>
                        <div className="spotlight-match-desc">
                          {item.description || 'No preview available.'}
                        </div>
                      </div>
                      <CornerDownLeft size={16} color="#a0a0a0" style={{marginTop:'auto', marginBottom:'auto'}}/>
                    </div>
                  ))}

                  {!loading && query.trim() && !results.length ? (
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
          <div className="spotlight-right-emoji">{selectedResult?.type === 'project' ? '📁' : selectedResult?.type === 'link' ? '🔗' : '🧠'}</div>
          <div className="spotlight-right-title">
            {selectedResult?.title || 'Search results preview'} <LinkIcon size={16} color="#707070"/>
          </div>
          <div className="spotlight-right-type">
            <FileText size={14}/> {selectedResult?.type ? selectedResult.type[0].toUpperCase() + selectedResult.type.slice(1) : 'Item'}
          </div>

          <div className="spotlight-preview-card faded">
            <h3>{selectedResult?.title || 'Pick a result to preview'}</h3>
            <p>{selectedResult?.description || 'Search across your spaces to see links and notes here.'}</p>
            <p>{selectedResult?.path || 'Use / to pick a space and narrow down results.'}</p>
            {selectedResult?.url ? <p>{selectedResult.url}</p> : null}
          </div>

          <div className="spotlight-meta-grid">
            <span className="spotlight-meta-label">Saved by</span>
            <span className="spotlight-meta-value">You <span>·</span> {selectedResult?.project?.name || 'Your space'}</span>
            
            <span className="spotlight-meta-label">Updated</span>
            <span className="spotlight-meta-value">{selectedResult?.updatedAt ? new Date(selectedResult.updatedAt).toLocaleDateString() : 'Just now'}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

/* Auxiliary for the plus icon missed up top */
const PlusCircle = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="16"></line>
    <line x1="8" y1="12" x2="16" y2="12"></line>
  </svg>
);
