import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Game from './pages/Game';
import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import './App.css';

function Sidebar() {
  const { nickname, avatarUrl, loading, isValuVerse } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) return null;

  const nav = [
    { path: '/', icon: 'fa-solid fa-gamepad', label: 'Games' },
    { path: '/leaderboard', icon: 'fa-solid fa-ranking-star', label: 'Leaderboard' },
  ];

  async function handleValuClose() {
    try {
      const valuApi = (globalThis as any).valuApi;
      if (!valuApi) return;
      const appApi = await valuApi.getApi('app');
      await appApi.run('close', 'games');
    } catch (e) {
      console.error('Failed to close app:', e);
    }
  }

  return (
    <aside className="sidebar">
      <button className="sidebar-profile" onClick={() => navigate('/profile')}>
        <img src={avatarUrl} alt="" className="sidebar-avatar" />
        <span className="sidebar-nickname">{nickname}</span>
      </button>
      <nav className="sidebar-nav">
        {nav.map((item) => (
          <button
            key={item.path}
            className={`sidebar-nav-item${location.pathname === item.path ? ' active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <i className={item.icon}></i>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {isValuVerse && (
        <button className="valu-close-btn" onClick={handleValuClose} title="Close">
          <i className="fa-solid fa-xmark"></i>
        </button>
      )}
    </aside>
  );
}

function ValuIntentListener() {
  const { isValuVerse } = useAuth();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const registeredRef = useRef(false);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!isValuVerse || registeredRef.current) return;

    const valuApi = (globalThis as any).valuApi;
    if (!valuApi) return;

    registeredRef.current = true;

    const handleIntent = (intent: any) => {
      if (intent?.action === 'join-game' && intent?.params?.code) {
        navigateRef.current(`/?join=${intent.params.code}`);
      }
    };

    import('@arkeytyp/valu-api').then(({ ValuApplication }) => {
      class GamesValuApp extends ValuApplication {
        async onCreate(intent: any) {
          handleIntent(intent);
        }

        async onNewIntent(intent: any) {
          handleIntent(intent);
        }

        onDestroy() {}
      }

      const appInstance = new GamesValuApp();
      valuApi.setApplication(appInstance);
    });
  }, [isValuVerse]);

  return null;
}

function AppContent() {
  const { loading } = useAuth();
  const inIframe = window.self !== window.top;

  if (loading && inIframe) {
    return (
      <div className="valu-connecting">
        <i className="fa-solid fa-link fa-fade"></i>
        <p>Connecting to Valu...</p>
      </div>
    );
  }

  return (
    <>
      <ValuIntentListener />
      <div className="app-layout">
        <Sidebar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/game/:code" element={<Game />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
          </Routes>
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
