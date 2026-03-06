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
import {
  deserializeBoard as deserializeTTT,
  serializeBoard as serializeTTT,
  applyMove as applyTTTMove,
  getWinner as getTTTWinner,
  isValidMove as isTTTValid,
} from '../engine/tictactoe';
import ChessBoard from '../components/ChessBoard';
import CheckersBoard from '../components/CheckersBoard';
import TicTacToeBoard from '../components/TicTacToeBoard';
import BomberLobby from '../components/BomberLobby';
import BomberGame from '../components/BomberGame';
import GameOverModal from '../components/GameOverModal';
import SettingsDialog from '../components/SettingsDialog';
import { generateGrid, getSpawnPositions, PLAYER_COLORS } from '../engine/bomber';
import type { GameRow, Color, MovePayload, GameStatus, Winner, LastMove, BomberPlayer, BomberGrid } from '../types';
import type { CheckerMove } from '../engine/checkers';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { TEST_MODE } from '../config';
import { getDiceBearUrl } from '../utils/dicebear';
import { playMoveSound, playTurnSound } from '../utils/sounds';

export default function Game() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { userId: playerId, isValuVerse, avatarUrl: myAvatarUrl } = useAuth();

  // Persist current game code for auto-rejoin on iframe reload
  useEffect(() => {
    if (code) sessionStorage.setItem('active_game_code', code);
  }, [code]);

  function leaveGame() {
    sessionStorage.removeItem('active_game_code');
    navigate('/');
  }

  const [game, setGame] = useState<GameRow | null>(null);
  const [boardState, setBoardState] = useState<string>('');
  const [currentTurn, setCurrentTurn] = useState<Color>('white');
  const [status, setStatus] = useState<GameStatus>('waiting');
  const [winner, setWinner] = useState<Winner>(null);
  const [myColor, setMyColor] = useState<Color | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [invitedUser, setInvitedUser] = useState<{ id: string; name: string; avatar: string } | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [opponent, setOpponent] = useState<{ nickname: string; avatarUrl: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resignConfirm, setResignConfirm] = useState(false);

  // Bomber invite state (supports multiple invites)
  const [bomberInvitedUsers, setBomberInvitedUsers] = useState<{ id: string; name: string; avatar: string }[]>([]);

  // Bomber-specific state
  const [bomberPlayers, setBomberPlayers] = useState<BomberPlayer[]>([]);
  const [bomberGrid, setBomberGrid] = useState<BomberGrid | null>(null);
  const [bomberStarted, setBomberStarted] = useState(false);
  const bomberPlayersRef = useRef<BomberPlayer[]>([]);
  bomberPlayersRef.current = bomberPlayers;
  const bomberStartedRef = useRef(false);
  bomberStartedRef.current = bomberStarted;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const hasBroadcastJoin = useRef(false);
  const [channelReady, setChannelReady] = useState(false);

  // Callback ref for forwarding bomber game events to BomberGame component
  const bomberEventHandlerRef = useRef<((event: string, payload: any) => void) | null>(null);

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

    // Bomber: parse players and grid from board_state
    if (g.game_type === 'bomber') {
      try {
        const state = JSON.parse(g.board_state);
        if (state.players) setBomberPlayers(state.players);
        if (state.grid) {
          setBomberGrid(state.grid);
          setBomberStarted(true);
        }
      } catch { /* not valid json yet */ }
    }

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

  // Fetch opponent profile
  useEffect(() => {
    if (!game || !myColor) return;
    const opponentId = myColor === 'white' ? game.player_black : game.player_white;
    if (!opponentId) return;

    supabase
      .from('profiles')
      .select('nickname, avatar_seed')
      .eq('id', opponentId)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return;
        let avatarUrl = getDiceBearUrl(data.avatar_seed);

        // In ValuVerse mode, avatar_seed holds the original Valu ID (longer than 8 chars)
        if (isValuVerse && data.avatar_seed && data.avatar_seed.length > 8) {
          try {
            const valuApi = (globalThis as any).valuApi;
            if (valuApi) {
              const usersApi = await valuApi.getApi('users');
              const icon = await usersApi.run('get-icon', { userId: data.avatar_seed, size: 128 });
              if (icon) avatarUrl = icon;
            }
          } catch {
            // fallback to DiceBear
          }
        }

        setOpponent({ nickname: data.nickname, avatarUrl });
      });
  }, [game, myColor, isValuVerse]);

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

        // Set lastMove from broadcast for animation
        const m = payload.move as any;
        if (m?.from && m?.to) {
          if (typeof m.from === 'string') {
            // Chess move
            const fromRow = 8 - parseInt(m.from[1]);
            const fromCol = m.from.charCodeAt(0) - 97;
            const toRow = 8 - parseInt(m.to[1]);
            const toCol = m.to.charCodeAt(0) - 97;
            setLastMove({ from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } });
          } else if (Array.isArray(m.from)) {
            // Checkers move
            setLastMove({
              from: { row: m.from[0], col: m.from[1] },
              to: { row: m.to[0], col: m.to[1] },
              captures: m.captures?.map(([r, c]: [number, number]) => ({ row: r, col: c })),
            });
          }
        }
      })
      .on('broadcast', { event: 'player_joined' }, () => {
        // Only reload from DB during lobby phase — not during active gameplay
        if (!bomberStartedRef.current) loadGame();
      })
      .on('broadcast', { event: 'bomber_start' }, ({ payload }: any) => {
        setBomberGrid(payload.grid);
        setBomberPlayers(payload.players);
        setBomberStarted(true);
        setStatus('playing');
      })
      // Bomber game-phase events — forwarded to BomberGame via callback ref
      .on('broadcast', { event: 'bomber_move' }, ({ payload }: any) => {
        bomberEventHandlerRef.current?.('bomber_move', payload);
      })
      .on('broadcast', { event: 'bomber_bomb' }, ({ payload }: any) => {
        bomberEventHandlerRef.current?.('bomber_bomb', payload);
      })
      .on('broadcast', { event: 'bomber_died' }, ({ payload }: any) => {
        bomberEventHandlerRef.current?.('bomber_died', payload);
      })
      .on('broadcast', { event: 'bomber_powerup' }, ({ payload }: any) => {
        bomberEventHandlerRef.current?.('bomber_powerup', payload);
      })
      .on('broadcast', { event: 'bomber_end' }, ({ payload }: any) => {
        bomberEventHandlerRef.current?.('bomber_end', payload);
      })
      .on('broadcast', { event: 'bomber_walls_destroyed' }, ({ payload }: any) => {
        bomberEventHandlerRef.current?.('bomber_walls_destroyed', payload);
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

  // Bomber: add self to lobby via DB, then notify others
  const hasBomberJoined = useRef(false);
  useEffect(() => {
    if (!game || game.game_type !== 'bomber') return;
    if (!channelReady || hasBomberJoined.current) return;
    if (status === 'playing' || status === 'finished') return;
    hasBomberJoined.current = true;

    async function joinBomberLobby() {
      // Fetch our profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname, avatar_seed')
        .eq('id', playerId)
        .maybeSingle();

      const nickname = profile?.nickname || playerId.slice(0, 8);

      const me: BomberPlayer = {
        id: playerId,
        nickname,
        avatarUrl: myAvatarUrl,
        x: 0, y: 0,
        alive: true,
        bombRange: 2,
        maxBombs: 1,
        moveCooldown: 250,
        kills: 0,
        color: '',
      };

      // Read current board_state, add self, write back
      const { data: current } = await supabase
        .from('games')
        .select('board_state')
        .eq('id', game!.id)
        .single();

      if (current) {
        try {
          const state = JSON.parse(current.board_state);
          const players: BomberPlayer[] = state.players || [];
          if (!players.some((p: BomberPlayer) => p.id === playerId)) {
            players.push(me);
            state.players = players;
            await supabase
              .from('games')
              .update({ board_state: JSON.stringify(state) })
              .eq('id', game!.id);
          }
          setBomberPlayers(players);
        } catch { /* ignore */ }
      }

      // Notify others to reload
      channelRef.current?.send({
        type: 'broadcast',
        event: 'player_joined',
        payload: {},
      });
    }

    joinBomberLobby();
  }, [game, channelReady, playerId, myAvatarUrl, status]);

  // Bomber: host starts the game
  async function handleBomberStart() {
    const playerList = bomberPlayersRef.current;
    if (playerList.length < 2) return;

    const grid = generateGrid(playerList.length);
    const spawns = getSpawnPositions(playerList.length);
    const playersWithPositions = playerList.map((p, i) => ({
      ...p,
      x: spawns[i].x,
      y: spawns[i].y,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    }));

    setBomberGrid(grid);
    setBomberPlayers(playersWithPositions);
    setBomberStarted(true);
    setStatus('playing');

    if (!TEST_MODE && game) {
      const state = { players: playersWithPositions, grid, bombs: [], explosions: [], startedAt: Date.now(), gameTime: 180 };
      await supabase
        .from('games')
        .update({ status: 'playing', board_state: JSON.stringify(state) })
        .eq('id', game.id);

      // Broadcast start event + player_joined so clients reload from DB as fallback
      channelRef.current?.send({
        type: 'broadcast',
        event: 'bomber_start',
        payload: { grid, players: playersWithPositions },
      });
      channelRef.current?.send({
        type: 'broadcast',
        event: 'player_joined',
        payload: {},
      });
    }
  }

  async function broadcastAndPersist(
    newBoardState: string,
    newTurn: Color,
    newStatus: GameStatus,
    newWinner: Winner,
    move: unknown,
  ) {
    // In test mode, only update local state — skip Supabase and broadcast
    if (TEST_MODE) {
      setBoardState(newBoardState);
      setCurrentTurn(newTurn);
      setStatus(newStatus);
      setWinner(newWinner);
      return;
    }

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

      const fromRow = 8 - parseInt(from[1]);
      const fromCol = from.charCodeAt(0) - 97;
      const toRow = 8 - parseInt(to[1]);
      const toCol = to.charCodeAt(0) - 97;
      setLastMove({ from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } });

      broadcastAndPersist(newFen, newTurn, newStatus, newWinner, { from, to, promotion });
      playMoveSound();
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

    setLastMove({
      from: { row: move.from[0], col: move.from[1] },
      to: { row: move.to[0], col: move.to[1] },
      captures: move.captures.map(([r, c]) => ({ row: r, col: c })),
    });

    broadcastAndPersist(newBoardStr, newTurn, newStatus, newWinner, move);
    playMoveSound();
  }

  function handleTicTacToeMove(index: number) {
    const currentBoard = deserializeTTT(boardState);
    if (!isTTTValid(currentBoard, index)) return;

    const newBoard = applyTTTMove(currentBoard, index, currentTurn);
    const newTurn: Color = currentTurn === 'white' ? 'black' : 'white';
    const newBoardStr = serializeTTT(newBoard);

    let newStatus: GameStatus = 'playing';
    let newWinner: Winner = getTTTWinner(newBoard);
    if (newWinner) {
      newStatus = 'finished';
    }

    broadcastAndPersist(newBoardStr, newTurn, newStatus, newWinner, { index });
    playMoveSound();
  }

  function handleResign() {
    if (!effectiveMyColor || effectiveStatus !== 'playing') return;
    const opponentColor: Color = effectiveMyColor === 'white' ? 'black' : 'white';
    broadcastAndPersist(boardState, currentTurn, 'finished', opponentColor, { resign: true });
  }

  function copyInviteCode() {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function sendInvite(forBomber: boolean) {
    try {
      const { Intent } = await import('@arkeytyp/valu-api') as any;
      const valuApi = (globalThis as any).valuApi;
      if (!valuApi) return;
      const intent = new Intent('DataProvider', 'pick-single', {
        providers: ['contacts'],
        title: 'Invite to Game',
        confirmLabel: 'Invite',
      });
      const selected = await valuApi.callService(intent);
      if (!selected?.id) return;

      // Show loader while fetching user info
      setLoadingInvite(true);
      try {
        const usersApi = await valuApi.getApi('users');
        const [userInfo, avatarUrl] = await Promise.all([
          usersApi.run('get', selected.id),
          usersApi.run('get-icon', { userId: selected.id, size: 128 }).catch(() => ''),
        ]);

        const name = userInfo
          ? [userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ').trim() || userInfo.name || 'User'
          : selected.name || 'User';

        const user = { id: selected.id, name, avatar: avatarUrl || '' };
        if (forBomber) {
          setBomberInvitedUsers(prev =>
            prev.some(u => u.id === user.id) ? prev : [...prev, user]
          );
        } else {
          setInvitedUser(user);
        }

        // Send rich message via TextChat with a Join button
        const gameLabel = isChess ? 'Chess' : isCheckers ? 'Checkers' : isBomber ? 'Bomber' : 'Tic Tac Toe';
        const msgIntent = new Intent('textchat', 'send-message', {
          userId: selected.id,
          text: `Join me for a game of ${gameLabel}!`,
          buttons: [{
            text: 'Join Game',
            intent: {
              applicationId: 'games',
              action: 'join-game',
              params: { code },
            },
          }],
        });
        valuApi.sendIntent(msgIntent).catch((e: any) =>
          console.error('Failed to send invite message:', e)
        );
      } finally {
        setLoadingInvite(false);
      }
    } catch (err) {
      console.error('Invite picker failed:', err);
    }
  }

  function handleInvite() { sendInvite(false); }
  function handleBomberInvite() { sendInvite(true); }

  // TEST_MODE overrides: skip waiting, play both sides
  const effectiveStatus = TEST_MODE && status === 'waiting' ? 'playing' : status;
  const effectiveMyColor = TEST_MODE && !myColor ? 'white' : myColor;
  const isMyTurn = TEST_MODE ? true : effectiveMyColor === currentTurn;
  const isChess = game?.game_type === 'chess';
  const isCheckers = game?.game_type === 'checkers';
  const isBomber = game?.game_type === 'bomber';
  const turnClass = effectiveStatus === 'playing' ? (isMyTurn ? 'my-turn' : 'opponent-turn') : '';

  // Play turn sound when it becomes my turn
  const prevIsMyTurn = useRef<boolean | null>(null);
  useEffect(() => {
    if (effectiveStatus !== 'playing') return;
    if (prevIsMyTurn.current !== null && !prevIsMyTurn.current && isMyTurn) {
      playTurnSound();
    }
    prevIsMyTurn.current = isMyTurn;
  });

  if (error) {
    return (
      <div className="game-page">
        <div className="game-error-state">
          <i className="fa-solid fa-circle-xmark"></i>
          <p>{error}</p>
          <button onClick={leaveGame}>
            <i className="fa-solid fa-house"></i> Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!game || (!effectiveMyColor && !isBomber)) {
    return (
      <div className="game-page">
        <div className="loading-state">
          <i className="fa-solid fa-spinner fa-spin"></i>
          <p>Loading game...</p>
        </div>
      </div>
    );
  }

  // Bomber: render lobby or game
  if (isBomber) {
    const isHost = game.player_white === playerId;
    return (
      <div className="game-page">
        <div className="game-header">
          <button className="back-btn" onClick={leaveGame}>
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div className="game-title">
            <i className="fa-solid fa-bomb"></i>
            <h2>Bomber</h2>
          </div>
          <button className="code-badge" onClick={copyInviteCode} title="Copy invite code">
            <i className={copied ? 'fa-solid fa-check' : 'fa-solid fa-copy'}></i>
            <span>{code}</span>
          </button>
          <button className="settings-btn" onClick={() => setSettingsOpen(true)} title="Settings">
            <i className="fa-solid fa-gear"></i>
          </button>
          <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>

        {bomberStarted && bomberGrid ? (
          <BomberGame
            channel={channelRef.current}
            onRegisterHandler={(fn) => { bomberEventHandlerRef.current = fn; }}
            onGameEnd={async (winnerId) => {
              if (!game) return;
              const winnerValue = winnerId || 'draw';
              await supabase
                .from('games')
                .update({ status: 'finished', winner: winnerValue })
                .eq('id', game.id);
            }}
            onReturnToLobby={() => {
              setBomberStarted(false);
              setBomberGrid(null);
              setBomberPlayers(prev => prev.map(p => ({ ...p, alive: true, kills: 0, bombRange: 2, maxBombs: 1, moveCooldown: 250 })));
            }}
            playerId={playerId}
            initialGrid={bomberGrid}
            initialPlayers={bomberPlayers}
          />
        ) : (
          <BomberLobby
            players={bomberPlayers}
            isHost={isHost || TEST_MODE}
            onStart={handleBomberStart}
            inviteCode={code || ''}
            copied={copied}
            onCopy={copyInviteCode}
            isValuVerse={isValuVerse}
            onInvite={handleBomberInvite}
            loadingInvite={loadingInvite}
            invitedUsers={bomberInvitedUsers}
          />
        )}
      </div>
    );
  }

  let mustCapturePieces: Set<string> = new Set();
  if (isCheckers && effectiveStatus === 'playing' && isMyTurn) {
    const moves = getValidMoves(deserializeBoard(boardState), currentTurn);
    if (moves.length > 0 && moves[0].captures.length > 0) {
      for (const m of moves) {
        if (m.captures.length > 0) mustCapturePieces.add(`${m.from[0]},${m.from[1]}`);
      }
    }
  }

  return (
    <div className="game-page">
      <div className="game-header">
        <button className="back-btn" onClick={leaveGame}>
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <div className="game-title">
          <i className={isChess ? 'fa-solid fa-chess' : isCheckers ? 'fa-solid fa-circle-dot' : isBomber ? 'fa-solid fa-bomb' : 'fa-solid fa-hashtag'}></i>
          <h2>{isChess ? 'Chess' : isCheckers ? 'Checkers' : isBomber ? 'Bomber' : 'Tic Tac Toe'}</h2>
        </div>
        <button className="code-badge" onClick={copyInviteCode} title="Copy invite code">
          <i className={copied ? 'fa-solid fa-check' : 'fa-solid fa-copy'}></i>
          <span>{code}</span>
        </button>
        {effectiveStatus === 'playing' && (
          resignConfirm ? (
            <button className="resign-btn confirm" onClick={handleResign}>
              <i className="fa-solid fa-check"></i> Sure?
            </button>
          ) : (
            <button className="resign-btn" onClick={() => { setResignConfirm(true); setTimeout(() => setResignConfirm(false), 3000); }}>
              <i className="fa-solid fa-flag"></i>
            </button>
          )
        )}
        <button className="settings-btn" onClick={() => setSettingsOpen(true)} title="Settings">
          <i className="fa-solid fa-gear"></i>
        </button>
        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>

      {effectiveStatus === 'playing' && (() => {
        const showColor = isChess || isCheckers;
        const opponentColor: Color = effectiveMyColor === 'white' ? 'black' : 'white';
        return (
          <div className="turn-bar">
            <div className={`turn-bar-side ${currentTurn === opponentColor ? 'active' : ''}`}>
              {opponent ? (
                <img className="turn-bar-avatar" src={opponent.avatarUrl} alt="" />
              ) : (
                <div className="turn-bar-avatar placeholder">
                  <i className="fa-solid fa-user"></i>
                </div>
              )}
              <div className="turn-bar-info">
                <span className="turn-bar-name">{opponent?.nickname || 'Opponent'}</span>
                {showColor && (
                  <span className={`turn-bar-color ${opponentColor}`}>
                    <span className={`turn-dot ${opponentColor === 'white' ? 'white-dot' : 'black-dot'}`}></span>
                    {opponentColor}
                  </span>
                )}
              </div>
            </div>

            {isMyTurn ? (
              <div className="turn-bar-label your-turn">YOUR TURN</div>
            ) : (
              <div className="turn-bar-label">waiting...</div>
            )}

            <div className={`turn-bar-side mine ${currentTurn === effectiveMyColor ? 'active' : ''}`}>
              <div className="turn-bar-info right">
                <span className="turn-bar-name">You</span>
                {showColor && (
                  <span className={`turn-bar-color ${effectiveMyColor}`}>
                    <span className={`turn-dot ${effectiveMyColor === 'white' ? 'white-dot' : 'black-dot'}`}></span>
                    {effectiveMyColor}
                  </span>
                )}
              </div>
              <img className="turn-bar-avatar" src={myAvatarUrl} alt="" />
            </div>
          </div>
        );
      })()}

      {effectiveStatus === 'waiting' ? (
        <div className="waiting-screen">
          <div className="waiting-animation">
            <div className="pulse-ring"></div>
            <div className="pulse-ring delay-1"></div>
            <div className="pulse-ring delay-2"></div>
            <div className="waiting-icon">
              <i className={isChess ? 'fa-solid fa-chess-knight' : isCheckers ? 'fa-solid fa-circle-dot' : isBomber ? 'fa-solid fa-bomb' : 'fa-solid fa-hashtag'}></i>
            </div>
          </div>

          <h3>Waiting for opponent</h3>

          {isValuVerse && !invitedUser && !loadingInvite && (
            <>
              <p className="waiting-subtitle">Invite someone to play</p>
              <button className="valu-invite-btn" onClick={handleInvite}>
                <i className="fa-solid fa-user-plus"></i>
                Invite
              </button>
              <div className="waiting-divider">
                <span>or share code</span>
              </div>
            </>
          )}

          {isValuVerse && loadingInvite && (
            <div className="invite-loading">
              <i className="fa-solid fa-spinner fa-spin"></i>
              <span>Loading contact...</span>
            </div>
          )}

          {isValuVerse && invitedUser && !loadingInvite && (
            <>
              <p className="waiting-subtitle">Invitation sent</p>
              <div className="invited-contact-card">
                {invitedUser.avatar ? (
                  <img className="invited-contact-avatar" src={invitedUser.avatar} alt="" />
                ) : (
                  <div className="invited-contact-avatar placeholder">
                    <i className="fa-solid fa-user"></i>
                  </div>
                )}
                <div className="invited-contact-info">
                  <span className="invited-contact-name">{invitedUser.name}</span>
                  <span className="invited-contact-status">
                    <i className="fa-solid fa-paper-plane"></i> Waiting for them to join...
                  </span>
                </div>
              </div>
              <button className="valu-invite-change" onClick={handleInvite}>
                <i className="fa-solid fa-user-plus"></i> Invite someone else
              </button>
            </>
          )}

          {isValuVerse ? (
            <div className="code-fallback">
              <button className="code-fallback-code" onClick={copyInviteCode} title="Tap to copy">
                {code}
                <i className={copied ? 'fa-solid fa-check' : 'fa-regular fa-copy'}></i>
              </button>
              <p className="code-fallback-hint">
                Your friend can also join by entering this code on the home screen
              </p>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      ) : isChess ? (
        <ChessBoard
          fen={boardState}
          myColor={effectiveMyColor!}
          isMyTurn={isMyTurn}
          onMove={handleChessMove}
          gameOver={effectiveStatus === 'finished'}
          turnClass={turnClass}
          lastMove={lastMove}
        />
      ) : isCheckers ? (
        <CheckersBoard
          board={deserializeBoard(boardState)}
          myColor={effectiveMyColor!}
          isMyTurn={isMyTurn}
          onMove={handleCheckersMove}
          gameOver={effectiveStatus === 'finished'}
          turnClass={turnClass}
          lastMove={lastMove}
          mustCapturePieces={mustCapturePieces}
        />
      ) : (
        <TicTacToeBoard
          board={deserializeTTT(boardState)}
          myColor={effectiveMyColor!}
          isMyTurn={isMyTurn}
          onMove={handleTicTacToeMove}
          gameOver={effectiveStatus === 'finished'}
          turnClass={turnClass}
        />
      )}

      {effectiveStatus === 'finished' && winner && (
        <GameOverModal winner={winner} myColor={effectiveMyColor!} />
      )}
    </div>
  );
}
