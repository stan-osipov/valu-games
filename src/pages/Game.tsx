import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import {
  deserializeBoard,
  serializeBoard,
  applyMove,
  getWinner,
  getValidMoves,
} from '../engine/checkers';
import ChessBoard from '../components/ChessBoard';
import CheckersBoard from '../components/CheckersBoard';
import type { GameRow, Color, MovePayload, GameStatus, Winner } from '../types';
import type { CheckerMove } from '../engine/checkers';
import type { RealtimeChannel } from '@supabase/supabase-js';

export default function Game() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { userId: playerId } = useAuth();

  const [game, setGame] = useState<GameRow | null>(null);
  const [boardState, setBoardState] = useState<string>('');
  const [currentTurn, setCurrentTurn] = useState<Color>('white');
  const [status, setStatus] = useState<GameStatus>('waiting');
  const [winner, setWinner] = useState<Winner>(null);
  const [myColor, setMyColor] = useState<Color | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const hasBroadcastJoin = useRef(false);
  const [channelReady, setChannelReady] = useState(false);

  const loadGame = useCallback(async () => {
    if (!code) return;

    const { data, error: fetchErr } = await supabase
      .from('games')
      .select('*')
      .eq('invite_code', code)
      .single();

    if (fetchErr || !data) {
      setError('Game not found');
      return;
    }

    const g = data as GameRow;
    setGame(g);
    setBoardState(g.board_state);
    setCurrentTurn(g.current_turn as Color);
    setStatus(g.status as GameStatus);
    setWinner(g.winner as Winner);

    if (g.player_white === playerId) {
      setMyColor('white');
    } else if (g.player_black === playerId) {
      setMyColor('black');
    } else {
      setMyColor(null);
    }
  }, [code, playerId]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  useEffect(() => {
    if (!code) return;

    const channel = supabase.channel(`game:${code}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'move' }, ({ payload }: { payload: MovePayload }) => {
        setBoardState(payload.boardState);
        setCurrentTurn(payload.turn);
        setStatus(payload.status);
        setWinner(payload.winner);
      })
      .on('broadcast', { event: 'player_joined' }, () => {
        loadGame();
      })
      .subscribe((subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          setChannelReady(true);
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setChannelReady(false);
    };
  }, [code, loadGame]);

  // When player 2 (black) arrives and channel is ready, notify player 1
  useEffect(() => {
    if (
      myColor === 'black' &&
      status === 'playing' &&
      channelReady &&
      !hasBroadcastJoin.current
    ) {
      hasBroadcastJoin.current = true;
      channelRef.current?.send({
        type: 'broadcast',
        event: 'player_joined',
        payload: {},
      });
    }
  }, [myColor, status, channelReady]);

  async function broadcastAndPersist(
    newBoardState: string,
    newTurn: Color,
    newStatus: GameStatus,
    newWinner: Winner,
    move: unknown,
  ) {
    const payload: MovePayload = {
      type: 'move',
      move,
      boardState: newBoardState,
      turn: newTurn,
      status: newStatus,
      winner: newWinner,
    };

    channelRef.current?.send({
      type: 'broadcast',
      event: 'move',
      payload,
    });

    if (game) {
      await supabase
        .from('games')
        .update({
          board_state: newBoardState,
          current_turn: newTurn,
          status: newStatus,
          winner: newWinner,
        })
        .eq('id', game.id);
    }

    setBoardState(newBoardState);
    setCurrentTurn(newTurn);
    setStatus(newStatus);
    setWinner(newWinner);
  }

  function handleChessMove(from: string, to: string, promotion?: string): boolean {
    try {
      const chess = new Chess(boardState);
      const move = chess.move({ from, to, promotion });
      if (!move) return false;

      const newFen = chess.fen();
      const newTurn: Color = chess.turn() === 'w' ? 'white' : 'black';
      let newStatus: GameStatus = 'playing';
      let newWinner: Winner = null;

      if (chess.isCheckmate()) {
        newStatus = 'finished';
        newWinner = currentTurn;
      } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
        newStatus = 'finished';
        newWinner = 'draw';
      }

      broadcastAndPersist(newFen, newTurn, newStatus, newWinner, { from, to, promotion });
      return true;
    } catch {
      return false;
    }
  }

  function handleCheckersMove(move: CheckerMove) {
    const currentBoard = deserializeBoard(boardState);
    const newBoard = applyMove(currentBoard, move, currentTurn);
    const newTurn: Color = currentTurn === 'white' ? 'black' : 'white';
    const newBoardStr = serializeBoard(newBoard);

    let newStatus: GameStatus = 'playing';
    let newWinner: Winner = getWinner(newBoard, newTurn);
    if (newWinner) {
      newStatus = 'finished';
    }

    const hasWhite = newBoard.some(r => r.some(c => c === 'w' || c === 'W'));
    const hasBlack = newBoard.some(r => r.some(c => c === 'b' || c === 'B'));
    if (!hasWhite) {
      newStatus = 'finished';
      newWinner = 'black';
    } else if (!hasBlack) {
      newStatus = 'finished';
      newWinner = 'white';
    }

    broadcastAndPersist(newBoardStr, newTurn, newStatus, newWinner, move);
  }

  function copyInviteCode() {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const isMyTurn = myColor === currentTurn;
  const isChess = game?.game_type === 'chess';

  if (error) {
    return (
      <div className="game-page">
        <div className="game-error-state">
          <i className="fa-solid fa-circle-xmark"></i>
          <p>{error}</p>
          <button onClick={() => navigate('/')}>
            <i className="fa-solid fa-house"></i> Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!game || !myColor) {
    return (
      <div className="game-page">
        <div className="loading-state">
          <i className="fa-solid fa-spinner fa-spin"></i>
          <p>Loading game...</p>
        </div>
      </div>
    );
  }

  const statusIcon = (() => {
    if (status === 'waiting') return 'fa-solid fa-hourglass-half';
    if (status === 'finished') {
      if (winner === 'draw') return 'fa-solid fa-handshake';
      if (winner === myColor) return 'fa-solid fa-trophy';
      return 'fa-solid fa-flag';
    }
    return isMyTurn ? 'fa-solid fa-hand-pointer' : 'fa-solid fa-clock';
  })();

  const statusText = (() => {
    if (status === 'waiting') return 'Waiting for opponent...';
    if (status === 'finished') {
      if (winner === 'draw') return 'Draw!';
      if (winner === myColor) return 'You win!';
      return 'You lose!';
    }
    return isMyTurn ? 'Your turn' : "Opponent's turn";
  })();

  let mustCapture = false;
  if (!isChess && status === 'playing' && isMyTurn) {
    const moves = getValidMoves(deserializeBoard(boardState), currentTurn);
    mustCapture = moves.length > 0 && moves[0].captures.length > 0;
  }

  return (
    <div className="game-page">
      <div className="game-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <div className="game-title">
          <i className={isChess ? 'fa-solid fa-chess' : 'fa-solid fa-circle-dot'}></i>
          <h2>{isChess ? 'Chess' : 'Checkers'}</h2>
        </div>
        <button className="code-badge" onClick={copyInviteCode} title="Copy invite code">
          <i className={copied ? 'fa-solid fa-check' : 'fa-solid fa-copy'}></i>
          <span>{code}</span>
        </button>
      </div>

      <div className="game-status-bar">
        <div className={`player-badge ${myColor}`}>
          <i className={myColor === 'white' ? 'fa-regular fa-circle' : 'fa-solid fa-circle'}></i>
          {myColor}
        </div>
        <div className={`status-badge ${status} ${status === 'playing' && isMyTurn ? 'my-turn' : ''}`}>
          <i className={statusIcon}></i>
          {statusText}
        </div>
        {mustCapture && (
          <div className="capture-badge">
            <i className="fa-solid fa-crosshairs"></i> Must capture!
          </div>
        )}
      </div>

      {status === 'waiting' ? (
        <div className="waiting-screen">
          <div className="waiting-animation">
            <div className="pulse-ring"></div>
            <div className="pulse-ring delay-1"></div>
            <div className="pulse-ring delay-2"></div>
            <div className="waiting-icon">
              <i className={isChess ? 'fa-solid fa-chess-knight' : 'fa-solid fa-circle-dot'}></i>
            </div>
          </div>

          <h3>Waiting for opponent</h3>
          <p className="waiting-subtitle">Share the invite code below with a friend</p>

          <button className="invite-code-card" onClick={copyInviteCode}>
            <div className="invite-code-digits">
              {code?.split('').map((char, i) => (
                <span key={i} className="code-char">{char}</span>
              ))}
            </div>
            <div className="invite-code-action">
              <i className={copied ? 'fa-solid fa-check' : 'fa-regular fa-copy'}></i>
              {copied ? 'Copied!' : 'Tap to copy'}
            </div>
          </button>

          <div className="waiting-tips">
            <div className="tip">
              <i className="fa-solid fa-share-nodes"></i>
              Send this code to your friend
            </div>
            <div className="tip">
              <i className="fa-solid fa-right-to-bracket"></i>
              They enter it on the home page
            </div>
            <div className="tip">
              <i className="fa-solid fa-play"></i>
              Game starts automatically
            </div>
          </div>
        </div>
      ) : isChess ? (
        <ChessBoard
          fen={boardState}
          myColor={myColor}
          isMyTurn={isMyTurn}
          onMove={handleChessMove}
          gameOver={status === 'finished'}
        />
      ) : (
        <CheckersBoard
          board={deserializeBoard(boardState)}
          myColor={myColor}
          isMyTurn={isMyTurn}
          onMove={handleCheckersMove}
          gameOver={status === 'finished'}
        />
      )}

      {status === 'finished' && (
        <div className="game-over-actions">
          <div className={`result-banner ${winner === myColor ? 'win' : winner === 'draw' ? 'draw' : 'lose'}`}>
            <i className={winner === myColor ? 'fa-solid fa-trophy' : winner === 'draw' ? 'fa-solid fa-handshake' : 'fa-solid fa-flag'}></i>
            <span>{winner === myColor ? 'Victory!' : winner === 'draw' ? 'Draw Game' : 'Defeat'}</span>
          </div>
          <button className="new-game-btn" onClick={() => navigate('/')}>
            <i className="fa-solid fa-rotate-right"></i> Play Again
          </button>
        </div>
      )}
    </div>
  );
}
