import { useState } from 'react';
import { Chess, type Square } from 'chess.js';
import type { Color } from '../types';

const PIECE_SYMBOLS: Record<string, string> = {
  wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
  bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚',
};

interface Props {
  fen: string;
  myColor: Color;
  isMyTurn: boolean;
  onMove: (from: string, to: string, promotion?: string) => boolean;
  gameOver: boolean;
}

export default function ChessBoard({ fen, myColor, isMyTurn, onMove, gameOver }: Props) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [validSquares, setValidSquares] = useState<Set<string>>(new Set());

  const chess = new Chess(fen);
  const board = chess.board();
  const inCheck = chess.inCheck();
  const kingSquare = inCheck ? findKingSquare(chess) : null;

  const rows = myColor === 'black' ? [...board].reverse() : board;
  const colOrder = myColor === 'black' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const rowLabels = myColor === 'black' ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const colLabels = myColor === 'black'
    ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']
    : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  function findKingSquare(c: Chess): string | null {
    const turn = c.turn();
    for (let r = 0; r < 8; r++) {
      for (let col = 0; col < 8; col++) {
        const file = String.fromCharCode(97 + col);
        const rank = String(8 - r);
        const sq = (file + rank) as Square;
        const piece = c.get(sq);
        if (piece && piece.type === 'k' && piece.color === turn) return sq;
      }
    }
    return null;
  }

  function handleClick(r: number, c: number) {
    if (gameOver || !isMyTurn) return;

    const actualRow = myColor === 'black' ? 7 - r : r;
    const actualCol = myColor === 'black' ? 7 - c : c;
    const file = String.fromCharCode(97 + actualCol);
    const rank = String(8 - actualRow);
    const sq = (file + rank) as Square;

    const piece = chess.get(sq);

    if (selected) {
      if (sq === selected) {
        setSelected(null);
        setValidSquares(new Set());
        return;
      }

      if (validSquares.has(sq)) {
        const movingPiece = chess.get(selected);
        let promotion: string | undefined;
        if (movingPiece?.type === 'p' && (rank === '8' || rank === '1')) {
          promotion = 'q';
        }

        const success = onMove(selected, sq, promotion);
        if (success) {
          setSelected(null);
          setValidSquares(new Set());
          return;
        }
      }

      if (piece && piece.color === (myColor === 'white' ? 'w' : 'b')) {
        selectPiece(sq);
        return;
      }

      setSelected(null);
      setValidSquares(new Set());
      return;
    }

    if (piece && piece.color === (myColor === 'white' ? 'w' : 'b')) {
      selectPiece(sq);
    }
  }

  function selectPiece(sq: Square) {
    setSelected(sq);
    const moves = chess.moves({ square: sq, verbose: true });
    setValidSquares(new Set(moves.map(m => m.to)));
  }

  return (
    <div className="board-wrapper">
      <div className="board-container">
        <div className="board chess-board">
          {rows.map((row, ri) => (
            <div key={ri} className="board-row">
              <span className="row-label">{rowLabels[ri]}</span>
              {colOrder.map((ci, di) => {
                const cell = row[ci];
                const actualRow = myColor === 'black' ? 7 - ri : ri;
                const actualCol = myColor === 'black' ? 7 - di : di;
                const file = String.fromCharCode(97 + actualCol);
                const rank = String(8 - actualRow);
                const sq = file + rank;
                const isDark = (actualRow + actualCol) % 2 === 1;
                const isSelected = selected === sq;
                const isValid = validSquares.has(sq);
                const isKingInCheck = kingSquare === sq;

                let className = `cell ${isDark ? 'dark' : 'light'}`;
                if (isSelected) className += ' selected';
                if (isValid) className += ' valid-target';
                if (isKingInCheck) className += ' in-check';

                return (
                  <div key={di} className={className} onClick={() => handleClick(ri, di)}>
                    {cell && (
                      <span className={`piece ${cell.color === 'w' ? 'white-piece' : 'black-piece'}`}>
                        {PIECE_SYMBOLS[cell.color + cell.type]}
                      </span>
                    )}
                    {isValid && !cell && <span className="dot" />}
                    {isValid && cell && <span className="capture-ring" />}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="col-labels">
            <span className="row-label" />
            {colLabels.map(l => <span key={l} className="col-label">{l}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
