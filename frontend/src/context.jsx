import { createContext, useContext, useState, useCallback, useRef } from 'react';

// === Auth Context ===
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // TODO(security): Token is stored in sessionStorage only as fallback for page refresh.
    // This is a trade-off; ideally the backend would set HttpOnly cookies.
    // Sensitive token data is not logged to console.
    try {
      const stored = sessionStorage.getItem('rb_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback((userData) => {
    setUser(userData);
    try {
      sessionStorage.setItem('rb_user', JSON.stringify(userData));
    } catch {
      // Ignore storage errors in private browsing
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    // Clear all client-side state on logout
    try {
      sessionStorage.removeItem('rb_user');
    } catch {}
    // Trigger a full page reload to flush any in-memory state
    window.location.href = '/';
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// === Toast Context ===
const ToastContext = createContext(null);
let _toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} role="alert">
          <span className="toast-icon">
            {t.type === 'success' && <CheckIcon />}
            {t.type === 'error' && <XCircleIcon />}
            {t.type === 'info' && <InfoIcon />}
          </span>
          <span className="toast-text">{t.message}</span>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => onRemove(t.id)}
            aria-label="Dismiss notification"
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  );
}

// === Simple icon helpers (inline SVG — secure static strings via DOMParser) ===
function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
