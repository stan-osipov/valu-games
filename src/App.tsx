import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Game from './pages/Game';
import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import './App.css';

function Sidebar() {
  const { nickname, avatarUrl, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) return null;

  const nav = [
    { path: '/', icon: 'fa-solid fa-gamepad', label: 'Games' },
    { path: '/leaderboard', icon: 'fa-solid fa-ranking-star', label: 'Leaderboard' },
  ];

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
    </aside>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
      </AuthProvider>
    </BrowserRouter>
  );
}
