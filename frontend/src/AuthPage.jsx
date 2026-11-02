import { useState } from 'react';
import { useAuth, useToast } from './context';
import { setToken } from './api';
import { apiLogin, apiSignup } from './api';
import { BookOpenIcon, SparklesIcon } from './icons';

export default function AuthPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const { addToast } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const data = await apiLogin(email.trim().toLowerCase(), password);
        setToken(data.token);
        login({ email: email.trim().toLowerCase(), token: data.token });
        addToast('Welcome back!', 'success');
      } else {
        await apiSignup(email.trim().toLowerCase(), password);
        addToast('Account created! Please sign in.', 'success');
        setMode('login');
        setPassword('');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">
            <BookOpenIcon size={16} style={{ color: 'white' }} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px' }}>
            RAG<span style={{ color: 'var(--accent-text)' }}>book</span>
          </span>
        </div>

        <h1 className="auth-title">
          {mode === 'login' ? 'Sign in to your workspace' : 'Create your workspace'}
        </h1>
        <p className="auth-subtitle">
          {mode === 'login'
            ? 'Your AI-powered research desk awaits.'
            : 'Start organizing and querying your knowledge base.'}
        </p>

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="auth-email" className="form-label">Email address</label>
            <input
              id="auth-email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="auth-password" className="form-label">Password</label>
            <input
              id="auth-password"
              type="password"
              className="form-input"
              placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              disabled={loading}
            />
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: 8 }}
            disabled={loading}
          >
            {loading ? (
              <span className="spinner sm" />
            ) : (
              <>
                <SparklesIcon size={14} />
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </>
            )}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                id="auth-switch-to-signup"
                onClick={() => { setMode('signup'); setError(''); }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                id="auth-switch-to-login"
                onClick={() => { setMode('login'); setError(''); }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
