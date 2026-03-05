export type GameType = 'chess' | 'checkers' | 'tictactoe';
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
