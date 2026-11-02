import { useState, useEffect } from 'react';
import { useAuth } from './context';
import { setToken, getToken } from './api';
import AuthPage from './AuthPage';
import Sidebar from './Sidebar';
import MaterialsPage from './MaterialsPage';
import ChatPage from './ChatPage';

export default function App() {
  const { user } = useAuth();
  const [activePage, setActivePage] = useState('chat');

  // Restore token from session on mount
  useEffect(() => {
    if (user?.token && !getToken()) {
      setToken(user.token);
    }
  }, [user]);

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="app-layout">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="main-content">
        {activePage === 'materials' && <MaterialsPage />}
        {activePage === 'chat' && <ChatPage />}
      </main>
    </div>
  );
}
