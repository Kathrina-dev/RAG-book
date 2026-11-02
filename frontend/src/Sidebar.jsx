import { useAuth } from './context';
import { BookOpenIcon, FolderIcon, MessageSquareIcon, LogOutIcon } from './icons';

export default function Sidebar({ activePage, onNavigate }) {
  const { user, logout } = useAuth();

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'RB';

  return (
    <aside className="sidebar" role="navigation" aria-label="Main navigation">
      <div className="sidebar__logo">
        <div className="logo-mark">
          <div className="logo-icon">
            <BookOpenIcon size={16} style={{ color: 'white' }} />
          </div>
          <span className="logo-text">
            RAG<span>book</span>
          </span>
        </div>
      </div>

      <nav className="sidebar__nav">
        <span className="nav-section-label">Workspace</span>

        <button
          id="nav-materials"
          className={`nav-item ${activePage === 'materials' ? 'active' : ''}`}
          onClick={() => onNavigate('materials')}
          aria-current={activePage === 'materials' ? 'page' : undefined}
        >
          <FolderIcon size={16} />
          Materials
        </button>

        <button
          id="nav-chat"
          className={`nav-item ${activePage === 'chat' ? 'active' : ''}`}
          onClick={() => onNavigate('chat')}
          aria-current={activePage === 'chat' ? 'page' : undefined}
        >
          <MessageSquareIcon size={16} />
          Chat
        </button>
      </nav>

      <div className="sidebar__footer">
        <div className="user-card" title={user?.email}>
          <div className="user-avatar" aria-hidden="true">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user?.email || 'Researcher'}</div>
            <div className="user-role">RAGbook user</div>
          </div>
          <button
            id="sidebar-logout-btn"
            className="btn btn-ghost btn-icon"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOutIcon size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
