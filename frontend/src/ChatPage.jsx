import { useState, useEffect, useRef, useCallback } from 'react';
import {
  apiListConversations,
  apiGetConversation,
  apiListDocuments,
  apiStreamQuestion,
} from './api';
import { useToast } from './context';
import {
  PlusIcon,
  SendIcon,
  SparklesIcon,
  FileTextIcon,
  PanelRightIcon,
  MessageSquareIcon,
} from './icons';
import StreamingActivity from './StreamingActivity';
import MarkdownMessage from './MarkdownMessage';

// =====================
// Utilities
// =====================
function formatRelativeTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 2) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getMimeLabel(mime) {
  if (mime === 'application/pdf') return 'PDF';
  if (mime?.includes('wordprocessingml')) return 'DOCX';
  return 'FILE';
}

// =====================
// Sub-components
// =====================

function ConversationSidebar({ conversations, activeId, onSelect, onNew, loading }) {
  return (
    <aside className="conv-sidebar" aria-label="Conversation history">
      <div className="conv-sidebar__header">
        <button
          id="new-chat-btn"
          className="btn btn-primary btn-full"
          onClick={onNew}
          style={{ gap: 6, justifyContent: 'flex-start', padding: '8px 12px' }}
        >
          <PlusIcon size={14} />
          New chat
        </button>
      </div>

      <div className="conv-sidebar__body" role="list" aria-label="Past conversations">
        {loading && (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ padding: '8px 10px' }}>
                <div className="skeleton" style={{ height: 12, width: '80%', borderRadius: 4, marginBottom: 5 }} />
                <div className="skeleton" style={{ height: 10, width: '40%', borderRadius: 4 }} />
              </div>
            ))}
          </>
        )}

        {!loading && conversations.length === 0 && (
          <div className="conv-list-empty">
            <MessageSquareIcon size={22} style={{ marginBottom: 8, opacity: 0.4 }} />
            <div>No conversations yet.</div>
            <div style={{ marginTop: 4, fontSize: 11 }}>Start a new chat above.</div>
          </div>
        )}

        {conversations.map((conv) => {
          const title = conv.messages?.[0]?.question || 'New conversation';
          return (
            <button
              key={conv.id}
              id={`conv-${conv.id}`}
              role="listitem"
              className={`conv-item ${conv.id === activeId ? 'active' : ''}`}
              onClick={() => onSelect(conv.id)}
              title={title}
            >
              <div className="conv-item-content">
                <div className="conv-item-title">{title}</div>
                <div className="conv-item-meta">
                  <span>{formatRelativeTime(conv.updatedAt)}</span>
                  <span>·</span>
                  <span>{conv._count?.messages ?? 0} msg{conv._count?.messages !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function SourcesPanel({ documents, docCount, collapsed, onToggle }) {
  return (
    <aside className={`sources-panel ${collapsed ? 'collapsed' : ''}`} aria-label="Document sources">
      {!collapsed && (
        <>
          <div className="sources-header">
            <div className="sources-title">
              Sources
              <span className="sources-count">{docCount}</span>
            </div>
            <button
              id="sources-collapse-btn"
              className="btn btn-ghost btn-icon"
              onClick={onToggle}
              aria-label="Collapse sources panel"
              title="Collapse panel"
            >
              <PanelRightIcon size={14} />
            </button>
          </div>
          <div className="sources-body" role="list" aria-label="Available documents">
            {documents.length === 0 && (
              <div style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                <FileTextIcon size={20} style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                No documents uploaded yet.
              </div>
            )}
            {documents.map((doc) => {
              const typeLabel = getMimeLabel(doc.mimeType);
              return (
                <div key={doc.id} className="source-item" role="listitem">
                  <div className={`source-doc-icon ${typeLabel.toLowerCase()}`}>
                    <FileTextIcon size={13} />
                  </div>
                  <div className="source-item-info">
                    <div className="source-item-name" title={doc.originalName}>{doc.originalName}</div>
                    <div className="source-item-status">● Indexed</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {collapsed && (
        <button
          id="sources-expand-btn"
          className="btn btn-ghost btn-icon"
          onClick={onToggle}
          aria-label="Expand sources panel"
          title="Show sources"
          style={{ margin: '12px auto', display: 'flex' }}
        >
          <PanelRightIcon size={16} style={{ transform: 'scaleX(-1)' }} />
        </button>
      )}
    </aside>
  );
}

function MessageGroup({ message, streamingState }) {
  return (
    <div className="message-group">
      {/* User message */}
      <div className="user-message">
        <div className="user-bubble">{message.question}</div>
      </div>

      {/* Streaming activity (while generating) */}
      {streamingState && (
        <StreamingActivity
          currentEvent={streamingState.currentEvent}
          completedEvents={streamingState.completedEvents}
          isDone={streamingState.isDone}
        />
      )}

      {/* Assistant response */}
      {message.answer && (
        <div className="assistant-message">
          <div className="assistant-avatar" aria-hidden="true">
            <SparklesIcon size={14} />
          </div>
          <div className="assistant-content">
            <MarkdownMessage content={message.answer} />
          </div>
        </div>
      )}

      {/* Error state */}
      {message.error && (
        <div className="assistant-message">
          <div className="assistant-avatar" aria-hidden="true">
            <SparklesIcon size={14} />
          </div>
          <div className="assistant-content">
            <div style={{
              color: 'var(--danger)',
              fontSize: 13.5,
              padding: '8px 12px',
              background: 'var(--danger-dim)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(248,113,113,0.2)',
            }}>
              {message.error}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatEmpty({ docCount, onSuggestedQuestion }) {
  const suggestions = [
    'What are the main themes in these documents?',
    'Summarize the key findings.',
    'What recommendations are made?',
  ];

  return (
    <div className="chat-empty">
      <div className="chat-empty-logo">
        <SparklesIcon size={24} />
      </div>
      <h2 className="chat-empty-title">Ask your documents anything</h2>
      <p className="chat-empty-sub">
        {docCount > 0
          ? `${docCount} document${docCount !== 1 ? 's' : ''} available as context. Start asking questions below.`
          : 'Upload documents in the Materials tab, then return here to start a conversation.'}
      </p>
      {docCount > 0 && (
        <div className="suggested-questions">
          {suggestions.map((q) => (
            <button
              key={q}
              className="suggested-q-btn"
              onClick={() => onSuggestedQuestion(q)}
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageComposer({ onSend, disabled }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  return (
    <div className="composer-wrapper">
      <div className="composer-box">
        <textarea
          ref={textareaRef}
          id="chat-input"
          className="composer-textarea"
          placeholder="Ask a question about your documents…"
          value={value}
          onChange={(e) => { setValue(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          aria-label="Message input"
          aria-multiline="true"
        />
        <button
          id="chat-send-btn"
          className="composer-send"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          title="Send (Enter)"
        >
          {disabled
            ? <span className="spinner sm" style={{ borderTopColor: 'var(--text-muted)' }} />
            : <SendIcon size={14} />}
        </button>
      </div>
      <div className="composer-hint">
        Enter to send · Shift+Enter for new line
      </div>
    </div>
  );
}

// =====================
// Main Chat Page
// =====================
export default function ChatPage() {
  const [conversations, setConversations] = useState([]);
  const [convsLoading, setConvsLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingState, setStreamingState] = useState(null);

  const messagesEndRef = useRef(null);
  const cancelStreamRef = useRef(null);
  const userScrolledUpRef = useRef(false);
  const messagesAreaRef = useRef(null);
  const { addToast } = useToast();

  // Scroll management — auto-scroll unless user has scrolled up
  function scrollToBottom(force = false) {
    if (force || !userScrolledUpRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }

  function handleMessagesScroll() {
    const el = messagesAreaRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    userScrolledUpRef.current = !atBottom;
  }

  // Fetch conversations list
  const fetchConversations = useCallback(async () => {
    setConvsLoading(true);
    try {
      const data = await apiListConversations();
      setConversations(data.conversations || []);
    } catch (err) {
      // Non-fatal: silently fail
      console.warn('Failed to load conversations:', err.message);
    } finally {
      setConvsLoading(false);
    }
  }, []);

  // Fetch documents for sources panel
  const fetchDocuments = useCallback(async () => {
    try {
      const data = await apiListDocuments();
      setDocuments(data.documents || []);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchDocuments();
  }, [fetchConversations, fetchDocuments]);

  // Load a conversation's messages
  async function loadConversation(id) {
    setActiveConvId(id);
    setMessages([]);
    try {
      const data = await apiGetConversation(id);
      const msgs = (data.conversation?.messages || []).map((m) => ({
        id: m.id,
        question: m.question,
        answer: m.answer || '',
        error: null,
      }));
      setMessages(msgs);
      userScrolledUpRef.current = false;
      setTimeout(() => scrollToBottom(true), 50);
    } catch (err) {
      addToast('Failed to load conversation.', 'error');
    }
  }

  function startNewChat() {
    // Cancel any running stream
    cancelStreamRef.current?.();
    setActiveConvId(null);
    setMessages([]);
    setStreaming(false);
    setStreamingState(null);
    userScrolledUpRef.current = false;
  }

  async function handleSend(question) {
    if (streaming) return;

    // Optimistically add user message
    const pendingId = `pending-${Date.now()}`;
    const pendingMsg = { id: pendingId, question, answer: '', error: null, pending: true };
    setMessages((prev) => [...prev, pendingMsg]);
    userScrolledUpRef.current = false;
    setTimeout(() => scrollToBottom(true), 20);

    setStreaming(true);
    setStreamingState({
      currentEvent: 'started',
      completedEvents: [],
      isDone: false,
    });

    let convId = activeConvId;
    let finalAnswer = '';
    let finalConvId = null;

    const cancel = apiStreamQuestion(question, convId, {
      onEvent: (eventType, data) => {
        setStreamingState((prev) => {
          if (!prev) return prev;
          const newCompleted = prev.completedEvents.includes(prev.currentEvent)
            ? prev.completedEvents
            : [...prev.completedEvents, prev.currentEvent];
          return {
            currentEvent: eventType,
            completedEvents: newCompleted,
            isDone: false,
          };
        });
        scrollToBottom();
      },

      onDone: async (data) => {
        finalAnswer = data.answer || '';
        finalConvId = data.conversationId;

        setStreamingState((prev) => ({
          ...(prev || {}),
          currentEvent: 'done',
          completedEvents: [...(prev?.completedEvents || []), prev?.currentEvent || 'done'],
          isDone: true,
        }));

        // Update the pending message with the final answer
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, id: data.messageId || pendingId, answer: finalAnswer, pending: false }
              : m
          )
        );

        // Set the conversation ID so subsequent messages go to same conv
        if (finalConvId) {
          setActiveConvId(finalConvId);
          convId = finalConvId;
        }

        // Brief delay then clear streaming state
        setTimeout(() => {
          setStreamingState(null);
          setStreaming(false);
        }, 1800);

        // Refresh conversation list
        await fetchConversations();
        scrollToBottom(true);
      },

      onError: (err) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, error: err.message || 'Something went wrong.', pending: false }
              : m
          )
        );
        setStreamingState(null);
        setStreaming(false);
        addToast('Failed to get a response. Please try again.', 'error');
      },
    });

    cancelStreamRef.current = cancel;
  }

  // Active conversation title
  const activeConv = conversations.find((c) => c.id === activeConvId);
  const convTitle = activeConv?.messages?.[0]?.question
    ? activeConv.messages[0].question.slice(0, 60) + (activeConv.messages[0].question.length > 60 ? '…' : '')
    : activeConvId ? 'Conversation' : 'New chat';

  const currentStreamingIdx = messages.findLastIndex?.((m) => m.pending) ?? -1;

  return (
    <div className="chat-page">
      {/* Left: Conversation list */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={loadConversation}
        onNew={startNewChat}
        loading={convsLoading}
      />

      {/* Center: Conversation */}
      <div className="conv-center">
        {/* Header */}
        <div className="conv-header">
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <span className="conv-title">{convTitle}</span>
            <span className="conv-doc-badge">
              <FileTextIcon size={12} />
              {documents.length} source{documents.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messagesAreaRef}
          className="messages-area"
          onScroll={handleMessagesScroll}
          role="main"
          aria-label="Conversation messages"
          aria-live="polite"
        >
          {messages.length === 0 && !streaming ? (
            <ChatEmpty
              docCount={documents.length}
              onSuggestedQuestion={(q) => handleSend(q)}
            />
          ) : (
            messages.map((msg, idx) => (
              <MessageGroup
                key={msg.id}
                message={msg}
                streamingState={msg.pending ? streamingState : null}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <MessageComposer onSend={handleSend} disabled={streaming} />
      </div>

      {/* Right: Sources */}
      <SourcesPanel
        documents={documents}
        docCount={documents.length}
        collapsed={sourcesCollapsed}
        onToggle={() => setSourcesCollapsed((v) => !v)}
      />
    </div>
  );
}
