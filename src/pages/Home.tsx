import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { supabase, generateInviteCode } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { createInitialBoard, serializeBoard } from '../engine/checkers';
import { createInitialBoard as createTTTBoard, serializeBoard as serializeTTTBoard } from '../engine/tictactoe';
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
  {
    type: 'tictactoe' as GameType,
    title: 'Tic Tac Toe',
    icon: 'fa-solid fa-hashtag',
    description: 'Classic X and O. Get three in a row to win!',
    gradient: 'linear-gradient(135deg, #00b894 0%, #00cec9 100%)',
    players: '2 Players',
  },
  {
    type: 'bomber' as GameType,
    title: 'Bomber',
    icon: 'fa-solid fa-bomb',
    description: 'Place bombs, dodge explosions. Last one standing wins!',
    gradient: 'linear-gradient(135deg, #e74c3c 0%, #f39c12 100%)',
    players: '2-10 Players',
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userId } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const autoJoinRef = useRef(false);

  async function createGame(gameType: GameType) {
    setError('');
    setLoading(true);
    try {
      const playerId = userId;
      const inviteCode = generateInviteCode();
      const boardState = gameType === 'chess'
        ? new Chess().fen()
        : gameType === 'tictactoe'
        ? serializeTTTBoard(createTTTBoard())
        : gameType === 'bomber'
        ? JSON.stringify({ players: [], grid: null, bombs: [], explosions: [], startedAt: 0, gameTime: 180 })
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

  const joinWithCode = useCallback(async (rawCode: string) => {
    setError('');
    const code = rawCode.trim().toUpperCase();
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

      // Bomber games use broadcast for joining (multi-player), just navigate
      if (game.game_type === 'bomber') {
        if (game.status === 'finished') {
          setError('Game has already ended');
          return;
        }
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
  }, [userId, navigate]);

  function joinGame() {
    joinWithCode(joinCode);
  }

  // Auto-join when navigated with ?join=CODE (from ValuVerse intent)
  useEffect(() => {
    const code = searchParams.get('join');
    if (code && userId && !autoJoinRef.current) {
      autoJoinRef.current = true;
      setSearchParams({}, { replace: true });
      joinWithCode(code);
    }
  }, [searchParams, setSearchParams, userId, joinWithCode]);

  // Auto-rejoin active game on iframe reload
  useEffect(() => {
    const activeCode = sessionStorage.getItem('active_game_code');
    if (activeCode && userId) {
      navigate(`/game/${activeCode}`, { replace: true });
    }
  }, [userId, navigate]);

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
