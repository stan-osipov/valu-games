import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GRID_COLS,
  GRID_ROWS,
  PLAYER_COLORS,
  canMoveTo,
  calculateExplosion,
} from '../engine/bomber';
import { playExplosionSound, playPlaceBombSound } from '../utils/sounds';
import type {
  BomberGrid,
  BomberPlayer,
  BomberBomb,
  BomberExplosion,
  BomberCell,
} from '../types';
import type { RealtimeChannel } from '@supabase/supabase-js';

const BOMB_FUSE = 3000;
const EXPLOSION_DURATION = 500;
const GAME_DURATION = 180;
const MOVE_INTERVAL = 150;

interface Props {
  channel: RealtimeChannel | null;
  onRegisterHandler: (fn: ((event: string, payload: any) => void) | null) => void;
  onGameEnd: (winnerId: string | null) => void;
  playerId: string;
  initialGrid: BomberGrid;
  initialPlayers: BomberPlayer[];
}

// Deterministic RNG so all clients produce the same powerups
function seededRandom(x: number, y: number, seed: number): number {
  let h = seed ^ (x * 374761393) ^ (y * 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

export default function BomberGame({
  channel,
  onRegisterHandler,
  onGameEnd,
  playerId,
  initialGrid,
  initialPlayers,
}: Props) {
  const navigate = useNavigate();
  const [grid, setGrid] = useState<BomberGrid>(initialGrid);
  const [players, setPlayers] = useState<BomberPlayer[]>(initialPlayers);
  const [bombs, setBombs] = useState<BomberBomb[]>([]);
  const [explosions, setExplosions] = useState<BomberExplosion[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [gameStarted, setGameStarted] = useState(false);

  const gridRef = useRef(grid);
  const playersRef = useRef(players);
  const bombsRef = useRef(bombs);
  const gameOverRef = useRef(false);
  const gameStartedRef = useRef(false);
  const gameStartTime = useRef(0);

  gridRef.current = grid;
  playersRef.current = players;
  bombsRef.current = bombs;
  gameOverRef.current = gameOver;
  gameStartedRef.current = gameStarted;

  const heldKeys = useRef(new Set<string>());
  const moveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Register event handler via callback — Game.tsx forwards broadcast events here
  useEffect(() => {
    onRegisterHandler((event: string, payload: any) => {
      switch (event) {
        case 'bomber_move':
          if (payload.playerId === playerId) return;
          setPlayers(prev => prev.map(p =>
            p.id === payload.playerId ? { ...p, x: payload.x, y: payload.y } : p
          ));
          break;
        case 'bomber_bomb':
          if (payload.playerId === playerId) return;
          setBombs(prev => [...prev, {
            id: `${payload.playerId}-${payload.placedAt}`,
            playerId: payload.playerId,
            x: payload.x,
            y: payload.y,
            placedAt: payload.placedAt,
            range: payload.range,
          }]);
          break;
        case 'bomber_died':
          if (payload.playerId === playerId) return;
          setPlayers(prev => prev.map(p =>
            p.id === payload.playerId ? { ...p, alive: false } : p
          ));
          if (payload.killedBy && payload.killedBy !== payload.playerId) {
            setPlayers(prev => prev.map(p =>
              p.id === payload.killedBy ? { ...p, kills: p.kills + 1 } : p
            ));
          }
          break;
        case 'bomber_powerup':
          if (payload.playerId === playerId) return;
          setGrid(prev => {
            const newGrid = prev.map(row => [...row]) as BomberGrid;
            newGrid[payload.y][payload.x] = 0;
            return newGrid;
          });
          break;
        case 'bomber_end':
          if (!gameOverRef.current) {
            setGameOver(true);
            gameOverRef.current = true;
            setWinnerId(payload.winnerId === 'draw' ? null : payload.winnerId);
          }
          break;
      }
    });
    return () => { onRegisterHandler(null); };
  }, [playerId, onRegisterHandler]);

  // Countdown — channel is already subscribed (managed by Game.tsx)
  useEffect(() => {
    if (countdown <= 0) {
      setGameStarted(true);
      gameStartedRef.current = true;
      gameStartTime.current = Date.now();
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Game timer
  useEffect(() => {
    if (!gameStarted || gameOver) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - gameStartTime.current) / 1000);
      const remaining = GAME_DURATION - elapsed;
      setTimeLeft(Math.max(0, remaining));
      if (remaining <= 0) handleTimeUp();
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStarted, gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  // Game loop
  useEffect(() => {
    if (!gameStarted || gameOver) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setExplosions(prev => {
        const filtered = prev.filter(e => now - e.startedAt < EXPLOSION_DURATION);
        return filtered.length !== prev.length ? filtered : prev;
      });
      processBombs(now);
      checkWinCondition();
    }, 50);
    return () => clearInterval(interval);
  }, [gameStarted, gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  function processBombs(now: number) {
    const currentBombs = bombsRef.current;
    const toExplode = currentBombs.filter(b => now - b.placedAt >= BOMB_FUSE);
    if (toExplode.length === 0) return;

    const remaining = currentBombs.filter(b => now - b.placedAt < BOMB_FUSE);
    const explodedSet = new Set<string>();
    const queue = [...toExplode];
    const allExplosionCells: { x: number; y: number }[] = [];
    const currentGrid = gridRef.current;
    const newGrid = currentGrid.map(row => [...row]) as BomberGrid;

    while (queue.length > 0) {
      const bomb = queue.shift()!;
      const key = `${bomb.x},${bomb.y}`;
      if (explodedSet.has(key)) continue;
      explodedSet.add(key);

      const cells = calculateExplosion(currentGrid, bomb.x, bomb.y, bomb.range);
      allExplosionCells.push(...cells);

      for (const cell of cells) {
        if (newGrid[cell.y][cell.x] === 2) {
          const r = seededRandom(cell.x, cell.y, 42);
          if (r > 0.3) {
            newGrid[cell.y][cell.x] = 0;
          } else {
            const r2 = seededRandom(cell.x, cell.y, 137);
            newGrid[cell.y][cell.x] = r2 < 0.33 ? 3 : r2 < 0.66 ? 4 : 5;
          }
        }
      }

      const chainBombs = remaining.filter(
        b => !explodedSet.has(`${b.x},${b.y}`) && cells.some(c => c.x === b.x && c.y === b.y)
      );
      for (const cb of chainBombs) {
        queue.push(cb);
        const idx = remaining.indexOf(cb);
        if (idx >= 0) remaining.splice(idx, 1);
      }
    }

    setGrid(newGrid);
    gridRef.current = newGrid;
    setBombs(remaining);
    setExplosions(prev => [...prev, { cells: allExplosionCells, startedAt: now }]);
    playExplosionSound();
    checkDeaths(allExplosionCells);
  }

  function checkDeaths(explosionCells: { x: number; y: number }[]) {
    const me = playersRef.current.find(p => p.id === playerId);
    if (!me || !me.alive) return;
    if (explosionCells.some(c => c.x === me.x && c.y === me.y)) {
      setPlayers(prev => prev.map(p =>
        p.id === playerId ? { ...p, alive: false } : p
      ));
      channel?.send({
        type: 'broadcast',
        event: 'bomber_died',
        payload: { playerId, killedBy: playerId },
      });
    }
  }

  function checkWinCondition() {
    if (gameOverRef.current) return;
    const alive = playersRef.current.filter(p => p.alive);
    if (alive.length <= 1) {
      endGame(alive.length === 1 ? alive[0].id : null);
    }
  }

  function handleTimeUp() {
    if (gameOverRef.current) return;
    const alive = playersRef.current.filter(p => p.alive);
    if (alive.length <= 1) {
      endGame(alive.length === 1 ? alive[0].id : null);
    } else {
      alive.sort((a, b) => b.kills - a.kills);
      endGame(alive[0].kills > alive[1].kills ? alive[0].id : 'draw');
    }
  }

  function endGame(winner: string | null) {
    setGameOver(true);
    gameOverRef.current = true;
    setWinnerId(winner);
    channel?.send({
      type: 'broadcast',
      event: 'bomber_end',
      payload: { winnerId: winner || 'draw' },
    });
    onGameEnd(winner);
  }

  const doMove = useCallback((dx: number, dy: number) => {
    if (!gameStartedRef.current || gameOverRef.current) return;
    const me = playersRef.current.find(p => p.id === playerId);
    if (!me || !me.alive) return;

    const nx = me.x + dx;
    const ny = me.y + dy;
    if (bombsRef.current.some(b => b.x === nx && b.y === ny)) return;
    if (!canMoveTo(gridRef.current, nx, ny)) return;

    const cell = gridRef.current[ny][nx];
    if (cell >= 3 && cell <= 5) {
      const newGrid = gridRef.current.map(row => [...row]) as BomberGrid;
      newGrid[ny][nx] = 0;
      setGrid(newGrid);
      gridRef.current = newGrid;

      setPlayers(prev => prev.map(p => {
        if (p.id !== playerId) return p;
        const updated = { ...p, x: nx, y: ny };
        if (cell === 3) updated.bombRange = p.bombRange + 1;
        if (cell === 4) updated.maxBombs = p.maxBombs + 1;
        if (cell === 5) updated.moveCooldown = Math.max(100, p.moveCooldown - 50);
        return updated;
      }));

      channel?.send({
        type: 'broadcast',
        event: 'bomber_powerup',
        payload: { playerId, x: nx, y: ny, type: cell },
      });
    } else {
      setPlayers(prev => prev.map(p =>
        p.id === playerId ? { ...p, x: nx, y: ny } : p
      ));
    }

    channel?.send({
      type: 'broadcast',
      event: 'bomber_move',
      payload: { playerId, x: nx, y: ny },
    });
  }, [playerId, channel]);

  const doPlaceBomb = useCallback(() => {
    if (!gameStartedRef.current || gameOverRef.current) return;
    const me = playersRef.current.find(p => p.id === playerId);
    if (!me || !me.alive) return;
    if (bombsRef.current.filter(b => b.playerId === playerId).length >= me.maxBombs) return;
    if (bombsRef.current.some(b => b.x === me.x && b.y === me.y)) return;

    const now = Date.now();
    const bomb: BomberBomb = {
      id: `${playerId}-${now}`,
      playerId,
      x: me.x,
      y: me.y,
      placedAt: now,
      range: me.bombRange,
    };
    setBombs(prev => [...prev, bomb]);
    playPlaceBombSound();

    channel?.send({
      type: 'broadcast',
      event: 'bomber_bomb',
      payload: { playerId, x: me.x, y: me.y, placedAt: now, range: me.bombRange },
    });
  }, [playerId, channel]);

  // Held-key smooth movement
  function getDirFromKeys(keys: Set<string>): [number, number] | null {
    if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) return [0, -1];
    if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) return [0, 1];
    if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) return [-1, 0];
    if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) return [1, 0];
    return null;
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === ' ') { e.preventDefault(); doPlaceBomb(); return; }
      const isDir = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','W','a','A','s','S','d','D'].includes(e.key);
      if (!isDir) return;
      e.preventDefault();
      if (heldKeys.current.has(e.key)) return;
      heldKeys.current.add(e.key);
      const dir = getDirFromKeys(heldKeys.current);
      if (dir) doMove(dir[0], dir[1]);
      if (!moveTimerRef.current) {
        moveTimerRef.current = setInterval(() => {
          const d = getDirFromKeys(heldKeys.current);
          if (d) doMove(d[0], d[1]);
        }, MOVE_INTERVAL);
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      heldKeys.current.delete(e.key);
      if (heldKeys.current.size === 0 && moveTimerRef.current) {
        clearInterval(moveTimerRef.current);
        moveTimerRef.current = null;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (moveTimerRef.current) clearInterval(moveTimerRef.current);
    };
  }, [doMove, doPlaceBomb]);

  // Rendering helpers
  const explosionSet = new Set<string>();
  for (const exp of explosions) for (const cell of exp.cells) explosionSet.add(`${cell.x},${cell.y}`);
  const bombMap = new Map<string, BomberBomb>();
  for (const bomb of bombs) bombMap.set(`${bomb.x},${bomb.y}`, bomb);
  const playerMap = new Map<string, BomberPlayer>();
  for (const p of players) if (p.alive) playerMap.set(`${p.x},${p.y}`, p);

  const me = players.find(p => p.id === playerId);
  const alivePlayers = players.filter(p => p.alive);
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (countdown > 0) {
    return (
      <div className="bomber-countdown">
        <div className="bomber-countdown-number">{countdown}</div>
      </div>
    );
  }

  return (
    <div className="bomber-container">
      <div className="bomber-hud">
        <div className="bomber-timer">
          <i className="fa-solid fa-clock"></i>
          <span className={timeLeft <= 30 ? 'bomber-timer-danger' : ''}>{formatTime(timeLeft)}</span>
        </div>
        <div className="bomber-alive-strip">
          {players.map((p, i) => (
            <div key={p.id} className={`bomber-alive-avatar ${!p.alive ? 'dead' : ''}`} style={{ borderColor: PLAYER_COLORS[i % PLAYER_COLORS.length] }} title={p.nickname}>
              <img src={p.avatarUrl} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              {!p.alive && <div className="bomber-dead-x">X</div>}
            </div>
          ))}
          <span className="bomber-alive-count">{alivePlayers.length} alive</span>
        </div>
      </div>

      <div className="bomber-grid" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)` }}>
        {grid.map((row, y) =>
          row.map((cell, x) => {
            const key = `${x},${y}`;
            const bomb = bombMap.get(key);
            const player = playerMap.get(key);
            const isExplosion = explosionSet.has(key);
            const playerIndex = player ? players.findIndex(p => p.id === player.id) : -1;
            return (
              <div key={key} className={`bomber-cell ${getCellClass(cell)} ${isExplosion ? 'explosion' : ''}`}>
                {cell === 3 && !isExplosion && <div className="bomber-powerup range"><i className="fa-solid fa-up-right-and-down-left-from-center"></i></div>}
                {cell === 4 && !isExplosion && <div className="bomber-powerup bomb"><i className="fa-solid fa-bomb"></i></div>}
                {cell === 5 && !isExplosion && <div className="bomber-powerup speed"><i className="fa-solid fa-bolt"></i></div>}
                {bomb && !isExplosion && <div className="bomber-bomb-sprite"><i className="fa-solid fa-bomb"></i></div>}
                {player && (
                  <div className="bomber-player-sprite" style={{ borderColor: PLAYER_COLORS[playerIndex % PLAYER_COLORS.length] }}>
                    <img src={player.avatarUrl} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="bomber-legend">
        <span><i className="fa-solid fa-arrow-up"></i><i className="fa-solid fa-arrow-down"></i><i className="fa-solid fa-arrow-left"></i><i className="fa-solid fa-arrow-right"></i> / WASD Move</span>
        <span><kbd>Space</kbd> Bomb</span>
        <span className="bomber-legend-sep">|</span>
        <span><i className="fa-solid fa-up-right-and-down-left-from-center bomber-pw-range"></i> +Range</span>
        <span><i className="fa-solid fa-bomb bomber-pw-bomb"></i> +Bomb</span>
        <span><i className="fa-solid fa-bolt bomber-pw-speed"></i> +Speed</span>
      </div>

      <div className="bomber-mobile-controls">
        <div className="bomber-dpad">
          <button className="bomber-dpad-btn up" onTouchStart={(e) => { e.preventDefault(); doMove(0, -1); }}><i className="fa-solid fa-chevron-up"></i></button>
          <button className="bomber-dpad-btn left" onTouchStart={(e) => { e.preventDefault(); doMove(-1, 0); }}><i className="fa-solid fa-chevron-left"></i></button>
          <button className="bomber-dpad-btn right" onTouchStart={(e) => { e.preventDefault(); doMove(1, 0); }}><i className="fa-solid fa-chevron-right"></i></button>
          <button className="bomber-dpad-btn down" onTouchStart={(e) => { e.preventDefault(); doMove(0, 1); }}><i className="fa-solid fa-chevron-down"></i></button>
        </div>
        <button className="bomber-bomb-btn" onTouchStart={(e) => { e.preventDefault(); doPlaceBomb(); }}><i className="fa-solid fa-bomb"></i></button>
      </div>

      {gameOver && (
        <div className="bomber-game-over-overlay">
          <div className={`bomber-game-over-modal ${winnerId === playerId ? 'win' : winnerId === null ? 'draw' : 'lose'}`}>
            <div className={`game-over-icon ${winnerId === playerId ? 'win' : winnerId === null ? 'draw' : 'lose'}`}>
              <i className={winnerId === playerId ? 'fa-solid fa-trophy' : winnerId === null ? 'fa-solid fa-handshake' : 'fa-solid fa-skull'}></i>
            </div>
            <h2 className="game-over-title">{winnerId === playerId ? 'Victory!' : winnerId === null || winnerId === 'draw' ? 'Draw!' : 'Defeated'}</h2>
            <p className="game-over-subtitle">
              {winnerId === playerId ? 'You are the last one standing!'
                : winnerId === null || winnerId === 'draw' ? 'No clear winner'
                : (() => { const w = players.find(p => p.id === winnerId); return w ? `${w.nickname} wins!` : 'Game over'; })()}
            </p>
            <div className="game-over-buttons">
              <button className="game-over-btn primary" onClick={() => { sessionStorage.removeItem('active_game_code'); navigate('/'); }}>
                <i className="fa-solid fa-house"></i> Home
              </button>
            </div>
          </div>
        </div>
      )}

      {me && !me.alive && !gameOver && (
        <div className="bomber-spectating"><i className="fa-solid fa-eye"></i> Spectating</div>
      )}
    </div>
  );
}

function getCellClass(cell: BomberCell): string {
  switch (cell) {
    case 1: return 'hard-wall';
    case 2: return 'soft-wall';
    default: return 'empty';
  }
}
