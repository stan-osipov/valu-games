import type { CheckerBoard, CheckerPiece, Color } from '../types';

export function createInitialBoard(): CheckerBoard {
  const board: CheckerBoard = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) board[r][c] = 'b';
    }
  }
  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) board[r][c] = 'w';
    }
  }
  return board;
}

export function serializeBoard(board: CheckerBoard): string {
  return JSON.stringify(board);
}

export function deserializeBoard(s: string): CheckerBoard {
  return JSON.parse(s);
}

function isOwn(piece: CheckerPiece, color: Color): boolean {
  if (!piece) return false;
  return color === 'white' ? (piece === 'w' || piece === 'W') : (piece === 'b' || piece === 'B');
}

function isOpponent(piece: CheckerPiece, color: Color): boolean {
  if (!piece) return false;
  return !isOwn(piece, color);
}

function isKing(piece: CheckerPiece): boolean {
  return piece === 'W' || piece === 'B';
}

function forwardDirs(color: Color): number[] {
  return color === 'white' ? [-1] : [1];
}

function moveDirs(piece: CheckerPiece, color: Color): number[] {
  if (isKing(piece)) return [-1, 1];
  return forwardDirs(color);
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

export interface CheckerMove {
  from: [number, number];
  to: [number, number];
  captures: [number, number][];
  path: [number, number][]; // full path for multi-jumps
}

function findJumps(
  board: CheckerBoard,
  r: number,
  c: number,
  color: Color,
  piece: CheckerPiece,
  captured: Set<string>,
  path: [number, number][]
): CheckerMove[] {
  const dirs = moveDirs(piece, color);
  const moves: CheckerMove[] = [];

  for (const dr of dirs) {
    for (const dc of [-1, 1]) {
      const mr = r + dr;
      const mc = c + dc;
      const lr = r + 2 * dr;
      const lc = c + 2 * dc;
      const midKey = `${mr},${mc}`;

      if (
        inBounds(lr, lc) &&
        isOpponent(board[mr][mc], color) &&
        !captured.has(midKey) &&
        board[lr][lc] === null
      ) {
        const newCaptured = new Set(captured);
        newCaptured.add(midKey);
        const newPath: [number, number][] = [...path, [lr, lc]];

        // Check for promotion mid-chain
        let newPiece = piece;
        if (!isKing(piece)) {
          if ((color === 'white' && lr === 0) || (color === 'black' && lr === 7)) {
            newPiece = color === 'white' ? 'W' : 'B';
          }
        }

        const further = findJumps(board, lr, lc, color, newPiece, newCaptured, newPath);
        if (further.length > 0) {
          moves.push(...further);
        } else {
          moves.push({
            from: path[0],
            to: [lr, lc],
            captures: [...newCaptured].map(k => {
              const [cr, cc] = k.split(',').map(Number);
              return [cr, cc] as [number, number];
            }),
            path: newPath,
          });
        }
      }
    }
  }

  return moves;
}

export function getValidMoves(board: CheckerBoard, color: Color): CheckerMove[] {
  const jumps: CheckerMove[] = [];
  const simple: CheckerMove[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!isOwn(piece, color)) continue;

      // Find jumps
      const pieceJumps = findJumps(board, r, c, color, piece, new Set(), [[r, c]]);
      jumps.push(...pieceJumps);

      // Find simple moves
      const dirs = moveDirs(piece, color);
      for (const dr of dirs) {
        for (const dc of [-1, 1]) {
          const nr = r + dr;
          const nc = c + dc;
          if (inBounds(nr, nc) && board[nr][nc] === null) {
            simple.push({
              from: [r, c],
              to: [nr, nc],
              captures: [],
              path: [[r, c], [nr, nc]],
            });
          }
        }
      }
    }
  }

  // Mandatory capture: if jumps exist, must jump
  return jumps.length > 0 ? jumps : simple;
}

export function getMovesFrom(board: CheckerBoard, color: Color, from: [number, number]): CheckerMove[] {
  const all = getValidMoves(board, color);
  return all.filter(m => m.from[0] === from[0] && m.from[1] === from[1]);
}

export function applyMove(board: CheckerBoard, move: CheckerMove, color: Color): CheckerBoard {
  const newBoard = board.map(row => [...row]);
  const piece = newBoard[move.from[0]][move.from[1]];

  // Remove captured pieces
  for (const [cr, cc] of move.captures) {
    newBoard[cr][cc] = null;
  }

  // Move piece
  newBoard[move.from[0]][move.from[1]] = null;
  let finalPiece = piece;

  // King promotion
  if (piece && !isKing(piece)) {
    if ((color === 'white' && move.to[0] === 0) || (color === 'black' && move.to[0] === 7)) {
      finalPiece = color === 'white' ? 'W' : 'B';
    }
  }

  newBoard[move.to[0]][move.to[1]] = finalPiece;
  return newBoard;
}

export function getWinner(board: CheckerBoard, currentTurn: Color): Color | 'draw' | null {
  const moves = getValidMoves(board, currentTurn);
  if (moves.length === 0) {
    // Current player can't move — they lose
    return currentTurn === 'white' ? 'black' : 'white';
  }
  return null;
}
