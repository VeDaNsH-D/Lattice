import React, { useEffect, useRef, useState } from 'react';
import { Send, Loader2, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import { askLatticeAI, getAIContextSuggestions, formatAIQuery, parseAIResponse } from '../services/aiQuery';
import './AskLatticeModal.css';

/**
 * Ask Lattice Modal Component
 * Allows users to query the AI with context mentions (@lattice-name)
 * 
 * Usage:
 * <AskLatticeModal isOpen={true} onClose={() => {}} projectId="..." />
 */
export const AskLatticeModal = ({ isOpen = false, onClose, projectId = null }) => {
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [atCursorPos, setAtCursorPos] = useState(false);
    const inputRef = useRef(null);
    const suggestionsRef = useRef(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResponse(null);
            setError(null);
            setShowSuggestions(false);
            inputRef.current?.focus();
        }
    }, [isOpen]);

    // Handle @ mention for suggestions
    useEffect(() => {
        if (!query.includes('@')) {
            setShowSuggestions(false);
            setSuggestions([]);
            return;
        }

        // Extract the word after the last @
        const parts = query.split('@');
        const lastPart = parts[parts.length - 1];
        const hasSpace = lastPart.includes(' ');

        if (hasSpace) {
            setShowSuggestions(false);
            return;
        }

        setAtCursorPos(true);
        setShowSuggestions(true);

        // Fetch suggestions (debounced)
        const timer = setTimeout(async () => {
            try {
                const sug = await getAIContextSuggestions(lastPart, 8);
                setSuggestions(sug);
            } catch (err) {
                console.error('Error fetching suggestions:', err);
                setSuggestions([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    const handleSelectSuggestion = (suggestionName) => {
        // Replace the partial mention with the full one
        const parts = query.split('@');
        const lastPart = parts[parts.length - 1];
        const beforeMention = query.slice(0, query.lastIndexOf(lastPart));

        const newQuery = `${beforeMention}@${suggestionName} `;
        setQuery(newQuery);
        setShowSuggestions(false);
        setSuggestions([]);
        inputRef.current?.focus();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!query.trim()) {
            setError('Query cannot be empty');
            return;
        }

        setLoading(true);
        setError(null);
        setResponse(null);

        try {
            const aiResponse = await askLatticeAI(query, projectId);
            const parsed = parseAIResponse(aiResponse);

            if (parsed.success) {
                setResponse(parsed);
                setError(null);
            } else {
                setError(parsed.response);
                setResponse(null);
            }
        } catch (err) {
            setError(err.message || 'Failed to get AI response');
            setResponse(null);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) {
        return null;
    }

    const queryInfo = formatAIQuery(query);

    return (
        <div className="ask-lattice-modal-backdrop" onClick={onClose}>
            <div className="ask-lattice-modal" onClick={(e) => e.stopPropagation()}>
                <div className="ask-lattice-modal-header">
                    <div className="ask-lattice-header-label">
                        <Sparkles size={16} />
                        Ask Lattice
                    </div>
                    <button 
                        className="ask-lattice-close-btn" 
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {!response ? (
                    <div className="ask-lattice-modal-body">
                        <form onSubmit={handleSubmit} className="ask-lattice-form">
                            <div className="ask-lattice-input-wrap">
                                <div className="ask-lattice-query-hint">
                                    {queryInfo.isValid && (
                                        <div className="ask-lattice-hint-valid">
                                            <CheckCircle size={13} />
                                            Contexts: {queryInfo.displayContexts}
                                        </div>
                                    )}
                                    {!queryInfo.isValid && query.length > 0 && (
                                        <div className="ask-lattice-hint-invalid">
                                            <AlertCircle size={13} />
                                            {queryInfo.contexts.length === 0 
                                                ? 'Use @contextname to reference a lattice or node'
                                                : 'Query text needed'}
                                        </div>
                                    )}
                                </div>

                                <div className="ask-lattice-input-field">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        placeholder="@colab1 summarise all links..."
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        className="ask-lattice-input"
                                        disabled={loading}
                                    />
                                    {showSuggestions && atCursorPos && suggestions.length > 0 && (
                                        <div 
                                            ref={suggestionsRef}
                                            className="ask-lattice-suggestions"
                                        >
                                            {suggestions.map((sug) => (
                                                <button
                                                    key={sug.name}
                                                    type="button"
                                                    className="ask-lattice-suggestion-item"
                                                    onClick={() => handleSelectSuggestion(sug.name)}
                                                >
                                                    <span className="ask-lattice-suggestion-name">
                                                        @{sug.name}
                                                    </span>
                                                    <span className="ask-lattice-suggestion-type">
                                                        {sug.projectType === 'collaborative' ? 'Shared' : 'Personal'}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {error && (
                                    <div className="ask-lattice-error">
                                        <AlertCircle size={14} />
                                        {error}
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="ask-lattice-submit-btn"
                                disabled={loading || !queryInfo.isValid}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={14} className="ask-lattice-loading-spinner" />
                                        Thinking...
                                    </>
                                ) : (
                                    <>
                                        <Send size={14} />
                                        Ask
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="ask-lattice-modal-response">
                        <div className="ask-lattice-response-header">
                            <div className="ask-lattice-query-display">
                                <strong>Query:</strong> {response.contexts.join(', ')} • {query}
                            </div>
                            <button 
                                className="ask-lattice-edit-btn"
                                onClick={() => setResponse(null)}
                            >
                                ← Edit
                            </button>
                        </div>

                        <div className="ask-lattice-response-content">
                            <p>{response.response}</p>
                        </div>

                        {response.warnings && response.warnings.length > 0 && (
                            <div className="ask-lattice-response-warnings">
                                {response.warnings.map((warn, idx) => (
                                    <div key={idx} className="ask-lattice-warning">
                                        {warn}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="ask-lattice-response-meta">
                            Contexts resolved: {response.contextsResolved}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AskLatticeModal;
