export type GameType = 'chess' | 'checkers' | 'tictactoe' | 'bomber';
export type GameStatus = 'waiting' | 'playing' | 'finished';
export type Color = 'white' | 'black';
export type Winner = Color | 'draw' | null | string; // string = player ID for bomber

export interface GameRow {
  id: string;
  invite_code: string;
  game_type: GameType;
  board_state: string;
  current_turn: Color;
  player_white: string | null;
  player_black: string | null;
  status: GameStatus;
  winner: Winner;
  created_at: string;
}

export interface MovePayload {
  type: 'move';
  move: unknown;
  boardState: string;
  turn: Color;
  status: GameStatus;
  winner: Winner;
}

// Move animation
export interface LastMove {
  from: { row: number; col: number };
  to: { row: number; col: number };
  captures?: { row: number; col: number }[];
}

// Tic Tac Toe types
export type TicTacToeCell = 'X' | 'O' | null;
export type TicTacToeBoard = TicTacToeCell[];

// Checkers types
export type CheckerPiece = 'w' | 'W' | 'b' | 'B' | null; // lowercase = normal, uppercase = king
export type CheckerBoard = CheckerPiece[][];

// Bomber types
export type BomberCell = 0 | 1 | 2 | 3 | 4 | 5;
// 0=empty, 1=hardWall, 2=softWall, 3=powerup_range, 4=powerup_bomb, 5=powerup_speed
export type BomberGrid = BomberCell[][];

export interface BomberPlayer {
  id: string;
  nickname: string;
  avatarUrl: string;
  x: number;
  y: number;
  alive: boolean;
  bombRange: number;
  maxBombs: number;
  moveCooldown: number;
  kills: number;
  color: string;
}

export interface BomberBomb {
  id: string;
  playerId: string;
  x: number;
  y: number;
  placedAt: number;
  range: number;
}

export interface BomberExplosion {
  cells: { x: number; y: number }[];
  startedAt: number;
}

export interface BomberGameState {
  grid: BomberGrid;
  players: BomberPlayer[];
  bombs: BomberBomb[];
  explosions: BomberExplosion[];
  startedAt: number;
  gameTime: number; // 180 seconds
}
