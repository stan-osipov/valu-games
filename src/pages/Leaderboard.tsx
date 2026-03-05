import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLeaderboard, type LeaderboardEntry } from '../hooks/useLeaderboard';
import type { GameType } from '../types';

type Tab = 'overall' | GameType;

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'overall', label: 'Overall', icon: 'fa-solid fa-trophy' },
  { key: 'chess', label: 'Chess', icon: 'fa-solid fa-chess' },
  { key: 'checkers', label: 'Checkers', icon: 'fa-solid fa-circle-dot' },
  { key: 'tictactoe', label: 'Tic Tac Toe', icon: 'fa-solid fa-hashtag' },
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="lb-rank gold"><i className="fa-solid fa-crown"></i></span>;
  if (rank === 2) return <span className="lb-rank silver">2</span>;
  if (rank === 3) return <span className="lb-rank bronze">3</span>;
  return <span className="lb-rank">{rank}</span>;
}

function LeaderboardTable({ entries, currentUserId }: { entries: LeaderboardEntry[]; currentUserId: string }) {
  if (entries.length === 0) {
    return <p className="profile-empty">No games played yet</p>;
  }

  return (
    <div className="lb-table">
      <div className="lb-header-row">
        <span className="lb-col-rank">#</span>
        <span className="lb-col-player">Player</span>
        <span className="lb-col-stat">W</span>
        <span className="lb-col-stat">L</span>
        <span className="lb-col-stat">D</span>
        <span className="lb-col-rate">Win%</span>
      </div>
      {entries.map((entry, i) => (
        <div
          key={entry.id}
          className={`lb-row${entry.id === currentUserId ? ' lb-row-me' : ''}`}
        >
          <span className="lb-col-rank">
            <RankBadge rank={i + 1} />
          </span>
          <span className="lb-col-player">
            <img src={entry.avatarUrl} alt="" className="lb-avatar" />
            <span className="lb-name">{entry.nickname}</span>
            {entry.id === currentUserId && <span className="lb-you-badge">You</span>}
          </span>
          <span className="lb-col-stat stat-win">{entry.wins}</span>
          <span className="lb-col-stat stat-lose">{entry.losses}</span>
          <span className="lb-col-stat stat-draw">{entry.draws}</span>
          <span className="lb-col-rate">{entry.winRate}%</span>
        </div>
      ))}
    </div>
  );
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { overall, chess, checkers, tictactoe, loading } = useLeaderboard();
  const [tab, setTab] = useState<Tab>('overall');

  const entries = tab === 'chess' ? chess : tab === 'checkers' ? checkers : tab === 'tictactoe' ? tictactoe : overall;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <h2><i className="fa-solid fa-ranking-star"></i> Leaderboard</h2>
      </div>

      <div className="lb-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`lb-tab${tab === t.key ? ' lb-tab-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <i className={t.icon}></i>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="profile-section">
        {loading ? (
          <div className="loading-state" style={{ padding: '2rem 0' }}>
            <i className="fa-solid fa-spinner fa-spin"></i>
            <p>Loading rankings...</p>
          </div>
        ) : (
          <LeaderboardTable entries={entries} currentUserId={userId} />
        )}
      </div>
    </div>
  );
}
