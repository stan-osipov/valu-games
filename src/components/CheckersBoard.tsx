import { useState } from 'react';
import type { CheckerBoard as CheckerBoardType, Color } from '../types';
import { getMovesFrom, getValidMoves, type CheckerMove } from '../engine/checkers';

interface Props {
  board: CheckerBoardType;
  myColor: Color;
  isMyTurn: boolean;
  onMove: (move: CheckerMove) => void;
  gameOver: boolean;
}

export default function CheckersBoard({ board, myColor, isMyTurn, onMove, gameOver }: Props) {
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves] = useState<CheckerMove[]>([]);

  const flip = myColor === 'black';
  const rows = flip ? [...board].reverse() : board;

  function toActual(ri: number, ci: number): [number, number] {
    return flip ? [7 - ri, 7 - ci] : [ri, ci];
  }

  function handleClick(ri: number, ci: number) {
    if (gameOver || !isMyTurn) return;

    const [ar, ac] = toActual(ri, ci);
    const piece = board[ar][ac];

    if (selected) {
      const matchingMove = validMoves.find(m => m.to[0] === ar && m.to[1] === ac);
      if (matchingMove) {
        onMove(matchingMove);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      if (piece && isOwnPiece(piece)) {
        selectPiece(ar, ac);
        return;
      }

      setSelected(null);
      setValidMoves([]);
      return;
    }

    if (piece && isOwnPiece(piece)) {
      selectPiece(ar, ac);
    }
  }

  function isOwnPiece(p: string): boolean {
    return myColor === 'white'
      ? (p === 'w' || p === 'W')
      : (p === 'b' || p === 'B');
  }

  function selectPiece(r: number, c: number) {
    const allMoves = getValidMoves(board, myColor);
    const piecesWithMoves = new Set(allMoves.map(m => `${m.from[0]},${m.from[1]}`));
    if (!piecesWithMoves.has(`${r},${c}`)) return;

    setSelected([r, c]);
    setValidMoves(getMovesFrom(board, myColor, [r, c]));
  }

  const validTargets = new Set(validMoves.map(m => `${m.to[0]},${m.to[1]}`));

  return (
    <div className="board-wrapper">
      <div className="board-container">
        <div className="board checkers-board">
          {rows.map((row, ri) => {
            const displayRow = flip ? [...row].reverse() : row;
            return (
              <div key={ri} className="board-row">
                <span className="row-label">{flip ? ri + 1 : 8 - ri}</span>
                {displayRow.map((cell, ci) => {
                  const [ar, ac] = toActual(ri, ci);
                  const isDark = (ar + ac) % 2 === 1;
                  const isSelected = selected && selected[0] === ar && selected[1] === ac;
                  const isValid = validTargets.has(`${ar},${ac}`);
                  const isKing = cell === 'W' || cell === 'B';
                  const isWhite = cell?.toLowerCase() === 'w';

                  let className = `cell ${isDark ? 'dark' : 'light'}`;
                  if (isSelected) className += ' selected';
                  if (isValid) className += ' valid-target';

                  return (
                    <div key={ci} className={className} onClick={() => handleClick(ri, ci)}>
                      {cell && (
                        <div className={`checker-disc ${isWhite ? 'disc-white' : 'disc-black'} ${isKing ? 'disc-king' : ''}`}>
                          {isKing && <i className="fa-solid fa-crown crown-icon"></i>}
                        </div>
                      )}
                      {isValid && !cell && <span className="dot" />}
                      {isValid && cell && <span className="capture-ring" />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
