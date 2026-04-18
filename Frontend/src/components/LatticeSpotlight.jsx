import React, { useState, useEffect, useRef } from 'react';
import { CloudLightning, Search, Command, ArrowRight, CornerDownLeft, Sparkles, Box, Link, FileText, CheckCircle2 } from 'lucide-react';
import './LatticeSpotlight.css';

export const LatticeSpotlight = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [context, setContext] = useState(null); // { name: 'ai-research', links: 42 }
  const [aiMode, setAiMode] = useState(false);
  const inputRef = useRef(null);

  // Keyboard shortcut listener
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Close on escape
      if (e.key === 'Escape' && isOpen) {
        onClose();
        setQuery('');
        setContext(null);
        setAiMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Derive state logic
  const isSlashMode = query.startsWith('/');
  const showAiResponse = aiMode && query.length > 5 && !isSlashMode;

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setAiMode(false);
  };

  const selectContext = (ctx) => {
    setContext(ctx);
    setQuery('');
    setAiMode(false);
    inputRef.current.focus();
  };

  const handleInputKeyDown = (e) => {
    // If backspace on empty query and we have context, remove context
    if (e.key === 'Backspace' && query === '' && context) {
      setContext(null);
    }
    if (e.key === 'Enter' && query.length > 0 && !isSlashMode) {
      setAiMode(true);
    }
  };

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
                <Box size={12}/> {context.name} <span>• {context.links} links</span>
              </div>
            )}
          </div>

          <div className="spotlight-scroll">
            
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
                <div className="spotlight-row active" onClick={() => selectContext({name: 'ideas', links: 42})}>
                  <div className="spotlight-action-icon"><Box color="#735bf2" size={16}/></div>
                  <div className="spotlight-action-text">ideas</div>
                </div>
                <div className="spotlight-row" onClick={() => selectContext({name: 'shared space', links: 12})}>
                  <div className="spotlight-action-icon"><Box color="#48bb78" size={16}/></div>
                  <div className="spotlight-action-text">shared space</div>
                </div>
                <div className="spotlight-row" onClick={() => selectContext({name: 'learning', links: 18})}>
                  <div className="spotlight-action-icon"><Box color="#ed64a6" size={16}/></div>
                  <div className="spotlight-action-text">learning</div>
                </div>
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
                  
                  <div className="spotlight-row">
                    <div className="spotlight-match-icon">🤔</div>
                    <div className="spotlight-match-content">
                      <div className="spotlight-match-title-row">
                        <span className="spotlight-match-title">Memory and context</span>
                        <span className="spotlight-match-badge verified">Verified</span>
                      </div>
                      <div className="spotlight-match-path">
                        <FileText size={12}/> ideas / architecture / memory
                      </div>
                      <div className="spotlight-match-desc">
                        A note that connects memory, focus, and how you revisit important ideas.
                      </div>
                    </div>
                    <CornerDownLeft size={16} color="#a0a0a0" style={{marginTop:'auto', marginBottom:'auto'}}/>
                  </div>

                  <div className="spotlight-row">
                    <div className="spotlight-match-icon"><img src="https://upload.wikimedia.org/wikipedia/commons/6/63/Wikipedia-logo.png" width={16}/></div>
                    <div className="spotlight-match-content">
                      <div className="spotlight-match-title-row">
                        <span className="spotlight-match-title">Learning basics</span>
                      </div>
                      <div className="spotlight-match-path">
                        Reference
                      </div>
                    </div>
                  </div>
                  
                  <div className="spotlight-row">
                    <div className="spotlight-match-icon"><img src="https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg" width={16}/></div>
                    <div className="spotlight-match-content">
                      <div className="spotlight-match-title-row">
                        <span className="spotlight-match-title">How teams work together</span>
                        <span className="spotlight-match-badge popular">Popular</span>
                      </div>
                      <div className="spotlight-match-path">
                        Reference
                      </div>
                    </div>
                  </div>

                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT PANE: PREVIEW */}
        <div className="spotlight-right">
          <div className="spotlight-right-emoji">🤔</div>
          <div className="spotlight-right-title">
            Memory and context <Link size={16} color="#707070"/>
          </div>
          <div className="spotlight-right-type">
            <FileText size={14}/> Note
          </div>

          <div className="spotlight-preview-card faded">
            <h3>Memory and context</h3>
            <p>This note helps you understand how ideas connect and why some pieces deserve to stay close.</p>
            <p>It’s designed to be easy to revisit later, even when you’ve been away from it for a while.</p>
            <p>Keep the important pieces near the top of your thinking.</p>
          </div>

          <div className="spotlight-meta-grid">
            <span className="spotlight-meta-label">Saved by</span>
            <span className="spotlight-meta-value">You <span>·</span> Today</span>
            
            <span className="spotlight-meta-label">Updated</span>
            <span className="spotlight-meta-value">Just now</span>
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
