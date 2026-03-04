import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { supabase, generateInviteCode } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { createInitialBoard, serializeBoard } from '../engine/checkers';
import type { GameType } from '../types';

const GAMES = [
  {
    type: 'chess' as GameType,
    title: 'Chess',
    icon: 'fa-solid fa-chess',
    description: 'The classic strategy game. Checkmate your opponent to win.',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    players: '2 Players',
  },
  {
    type: 'checkers' as GameType,
    title: 'Checkers',
    icon: 'fa-solid fa-circle-dot',
    description: 'Jump and capture all opponent pieces. Kings rule the board.',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    players: '2 Players',
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function createGame(gameType: GameType) {
    setError('');
    setLoading(true);
    try {
      const playerId = userId;
      const inviteCode = generateInviteCode();
      const boardState = gameType === 'chess'
        ? new Chess().fen()
        : serializeBoard(createInitialBoard());

      const { error: dbError } = await supabase.from('games').insert({
        invite_code: inviteCode,
        game_type: gameType,
        board_state: boardState,
        current_turn: 'white',
        player_white: playerId,
        status: 'waiting',
      });

      if (dbError) {
        setError(dbError.message);
        return;
      }

      navigate(`/game/${inviteCode}`);
    } finally {
      setLoading(false);
    }
  }

  async function joinGame() {
    setError('');
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError('Please enter an invite code');
      return;
    }

    setLoading(true);
    try {
      const playerId = userId;

      const { data: game, error: fetchError } = await supabase
        .from('games')
        .select('*')
        .eq('invite_code', code)
        .single();

      if (fetchError || !game) {
        setError('Game not found');
        return;
      }

      if (game.player_white === playerId) {
        navigate(`/game/${code}`);
        return;
      }

      if (game.player_black && game.player_black !== playerId) {
        setError('Game is already full');
        return;
      }

      if (!game.player_black) {
        const { error: updateError } = await supabase
          .from('games')
          .update({ player_black: playerId, status: 'playing' })
          .eq('id', game.id);

        if (updateError) {
          setError(updateError.message);
          return;
        }
      }

      navigate(`/game/${code}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="home">
      <section className="games-section">
        <h2 className="section-title">
          <i className="fa-solid fa-dice"></i>
          Choose a Game
        </h2>
        <div className="game-cards">
          {GAMES.map(g => (
            <button
              key={g.type}
              className="game-card"
              onClick={() => createGame(g.type)}
              disabled={loading}
              style={{ '--card-gradient': g.gradient } as React.CSSProperties}
            >
              <div className="game-card-icon">
                <i className={g.icon}></i>
              </div>
              <div className="game-card-info">
                <h3>{g.title}</h3>
                <p>{g.description}</p>
                <span className="game-card-meta">
                  <i className="fa-solid fa-users"></i> {g.players}
                </span>
              </div>
              <div className="game-card-arrow">
                <i className="fa-solid fa-arrow-right"></i>
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="divider-row">
        <span className="divider-line"></span>
        <span className="divider-text">or join a friend</span>
        <span className="divider-line"></span>
      </div>

      <section className="join-section">
        <div className="join-card">
          <div className="join-card-header">
            <i className="fa-solid fa-right-to-bracket"></i>
            <h2>Join with Code</h2>
          </div>
          <div className="join-form">
            <div className="join-input-wrapper">
              <i className="fa-solid fa-hashtag"></i>
              <input
                type="text"
                placeholder="INVITE CODE"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                onKeyDown={e => e.key === 'Enter' && joinGame()}
              />
            </div>
            <button
              className="join-btn"
              onClick={joinGame}
              disabled={loading || !joinCode.trim()}
            >
              {loading ? (
                <i className="fa-solid fa-spinner fa-spin"></i>
              ) : (
                <>
                  Join <i className="fa-solid fa-arrow-right"></i>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="error-banner">
          <i className="fa-solid fa-circle-exclamation"></i>
          {error}
        </div>
      )}
    </div>
  );
}
