import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePlayerStats } from '../hooks/usePlayerStats';
import { supabase } from '../supabaseClient';
import type { GameRow } from '../types';

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ResultBadge({ game, userId }: { game: GameRow; userId: string }) {
  if (game.winner === 'draw') {
    return <span className="profile-result draw">Draw</span>;
  }
  const myColor =
    game.player_white === userId ? 'white' : 'black';
  const won = game.winner === myColor;
  return (
    <span className={`profile-result ${won ? 'win' : 'lose'}`}>
      {won ? 'Win' : 'Loss'}
    </span>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const {
    userId,
    nickname,
    avatarUrl,
    isValuVerse,
    loading: authLoading,
    updateNickname,
    regenerateAvatar,
    logout,
    loginWithId,
  } = useAuth();

  const { total, chess, checkers, recentGames, loading: statsLoading } = usePlayerStats(userId);

  const [editName, setEditName] = useState(nickname);
  const [loginId, setLoginId] = useState('');
  const [loginError, setLoginError] = useState('');
  const [copied, setCopied] = useState(false);
  const [opponentNames, setOpponentNames] = useState<Record<string, string>>({});

  useEffect(() => {
    setEditName(nickname);
  }, [nickname]);

  // Fetch opponent nicknames
  useEffect(() => {
    if (recentGames.length === 0) return;

    const opponentIds = new Set<string>();
    for (const g of recentGames) {
      const oppId = g.player_white === userId ? g.player_black : g.player_white;
      if (oppId) opponentIds.add(oppId);
    }

    if (opponentIds.size === 0) return;

    supabase
      .from('profiles')
      .select('id, nickname')
      .in('id', [...opponentIds])
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        for (const p of data) map[p.id] = p.nickname;
        setOpponentNames(map);
      });
  }, [recentGames, userId]);

  if (authLoading) {
    return (
      <div className="profile-page">
        <div className="loading-state">
          <i className="fa-solid fa-spinner fa-spin"></i>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  function copyId() {
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleNameBlur() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== nickname) {
      updateNickname(trimmed);
    } else {
      setEditName(nickname);
    }
  }

  function handleNameKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  }

  async function handleLogin() {
    setLoginError('');
    const ok = await loginWithId(loginId);
    if (!ok) {
      setLoginError('No profile found for that ID');
    } else {
      setLoginId('');
    }
  }

  function getOpponentName(game: GameRow): string {
    const oppId = game.player_white === userId ? game.player_black : game.player_white;
    if (!oppId) return 'Unknown';
    return opponentNames[oppId] || oppId.slice(0, 8) + '...';
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <h2>Profile</h2>
      </div>

      {/* Identity Card */}
      <div className="profile-identity">
        <div className="profile-avatar-wrapper">
          <img src={avatarUrl} alt="" className="profile-avatar" />
          {!isValuVerse && (
            <button className="profile-regen-btn" onClick={regenerateAvatar} title="New Avatar">
              <i className="fa-solid fa-dice"></i>
            </button>
          )}
        </div>
        <div className="profile-identity-info">
          {isValuVerse ? (
            <p className="profile-name-display">{nickname}</p>
          ) : (
            <>
              <input
                className="profile-name-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={handleNameKey}
                maxLength={24}
              />
              <button className="profile-id-btn" onClick={copyId}>
                <span>{userId.slice(0, 8)}...{userId.slice(-4)}</span>
                <i className={copied ? 'fa-solid fa-check' : 'fa-regular fa-copy'}></i>
              </button>
              <p className="profile-hint">
                <i className="fa-solid fa-circle-info"></i>
                This is your unique player ID. Copy and save it somewhere safe — you'll need it to log back in if you switch devices or clear your browser data.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="profile-section">
        <h3 className="profile-section-title">
          <i className="fa-solid fa-chart-bar"></i> Stats
        </h3>
        {statsLoading ? (
          <div className="loading-state" style={{ padding: '1rem 0' }}>
            <i className="fa-solid fa-spinner fa-spin"></i>
          </div>
        ) : (
          <>
            <div className="profile-stat-cards">
              <div className="profile-stat-card win">
                <span className="profile-stat-num">{total.wins}</span>
                <span className="profile-stat-label">Wins</span>
              </div>
              <div className="profile-stat-card lose">
                <span className="profile-stat-num">{total.losses}</span>
                <span className="profile-stat-label">Losses</span>
              </div>
              <div className="profile-stat-card draw">
                <span className="profile-stat-num">{total.draws}</span>
                <span className="profile-stat-label">Draws</span>
              </div>
            </div>

            <div className="profile-game-stats">
              <div className="profile-game-stat-row">
                <i className="fa-solid fa-chess"></i>
                <span className="profile-game-stat-label">Chess</span>
                <span className="stat-win">{chess.wins}W</span>
                <span className="stat-lose">{chess.losses}L</span>
                <span className="stat-draw">{chess.draws}D</span>
              </div>
              <div className="profile-game-stat-row">
                <i className="fa-solid fa-circle-dot"></i>
                <span className="profile-game-stat-label">Checkers</span>
                <span className="stat-win">{checkers.wins}W</span>
                <span className="stat-lose">{checkers.losses}L</span>
                <span className="stat-draw">{checkers.draws}D</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Game History */}
      <div className="profile-section">
        <h3 className="profile-section-title">
          <i className="fa-solid fa-clock-rotate-left"></i> Recent Games
        </h3>
        {statsLoading ? (
          <div className="loading-state" style={{ padding: '1rem 0' }}>
            <i className="fa-solid fa-spinner fa-spin"></i>
          </div>
        ) : recentGames.length === 0 ? (
          <p className="profile-empty">No games played yet</p>
        ) : (
          <div className="profile-history">
            {recentGames.map((g) => (
              <div key={g.id} className="profile-history-row">
                <i
                  className={
                    g.game_type === 'chess'
                      ? 'fa-solid fa-chess'
                      : 'fa-solid fa-circle-dot'
                  }
                ></i>
                <ResultBadge game={g} userId={userId} />
                <span className="profile-opponent">vs {getOpponentName(g)}</span>
                <span className="profile-time">{timeAgo(g.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account Actions */}
      {!isValuVerse && (
        <div className="profile-section">
          <h3 className="profile-section-title">
            <i className="fa-solid fa-gear"></i> Account
          </h3>
          <div className="profile-actions">
            <div className="profile-action-group">
              <button className="profile-action-btn danger" onClick={logout}>
                <i className="fa-solid fa-rotate-right"></i> New Identity
              </button>
              <p className="profile-hint">
                <i className="fa-solid fa-triangle-exclamation"></i>
                Creates a brand new account with a fresh ID, nickname, and avatar. Your current game history and stats will stay tied to your old ID — make sure to copy it first if you want to come back.
              </p>
            </div>
            <div className="profile-action-group">
              <p className="profile-hint">
                <i className="fa-solid fa-right-to-bracket"></i>
                Have a previous player ID? Paste it below to reclaim your old account, along with all your stats and game history.
              </p>
              <div className="profile-login-row">
                <input
                  type="text"
                  placeholder="Paste your old player ID..."
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="profile-login-input"
                />
                <button
                  className="profile-action-btn"
                  onClick={handleLogin}
                  disabled={!loginId.trim()}
                >
                  <i className="fa-solid fa-right-to-bracket"></i> Login
                </button>
              </div>
              {loginError && (
                <p className="profile-login-error">
                  <i className="fa-solid fa-circle-exclamation"></i> {loginError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
