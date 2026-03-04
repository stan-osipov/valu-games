export type GameType = 'chess' | 'checkers';
export type GameStatus = 'waiting' | 'playing' | 'finished';
export type Color = 'white' | 'black';
export type Winner = 'white' | 'black' | 'draw' | null;

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

// Checkers types
export type CheckerPiece = 'w' | 'W' | 'b' | 'B' | null; // lowercase = normal, uppercase = king
export type CheckerBoard = CheckerPiece[][];
