import type { TicTacToeBoard, TicTacToeCell, Color } from '../types';

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diags
];

export function createInitialBoard(): TicTacToeBoard {
  return Array(9).fill(null);
}

export function serializeBoard(board: TicTacToeBoard): string {
  return JSON.stringify(board);
}

export function deserializeBoard(s: string): TicTacToeBoard {
  return JSON.parse(s);
}

export function colorToSymbol(color: Color): TicTacToeCell {
  return color === 'white' ? 'X' : 'O';
}

export function isValidMove(board: TicTacToeBoard, index: number): boolean {
  return index >= 0 && index < 9 && board[index] === null;
}

export function applyMove(board: TicTacToeBoard, index: number, color: Color): TicTacToeBoard {
  const newBoard = [...board];
  newBoard[index] = colorToSymbol(color);
  return newBoard;
}

export function getWinningLine(board: TicTacToeBoard): number[] | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return line;
    }
  }
  return null;
}

export function getWinner(board: TicTacToeBoard): Color | 'draw' | null {
  const line = getWinningLine(board);
  if (line) {
    return board[line[0]] === 'X' ? 'white' : 'black';
  }
  if (board.every(c => c !== null)) {
    return 'draw';
  }
  return null;
}
