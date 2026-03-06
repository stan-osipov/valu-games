import { useState, useEffect, useRef } from 'react';
import type { CheckerBoard as CheckerBoardType, Color, LastMove } from '../types';
import { getMovesFrom, getValidMoves, type CheckerMove } from '../engine/checkers';

interface Props {
  board: CheckerBoardType;
  myColor: Color;
  isMyTurn: boolean;
  onMove: (move: CheckerMove) => void;
  gameOver: boolean;
  turnClass?: string;
  lastMove?: LastMove | null;
  mustCapturePieces?: Set<string>;
}

export default function CheckersBoard({ board, myColor, isMyTurn, onMove, gameOver, turnClass, lastMove, mustCapturePieces }: Props) {
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves] = useState<CheckerMove[]>([]);
  const [animating, setAnimating] = useState<{ row: number; col: number; dx: number; dy: number } | null>(null);
  const [capturedSquares, setCapturedSquares] = useState<Set<string>>(new Set());
  const animFrameRef = useRef(0);

  useEffect(() => {
    if (!lastMove) return;
    const dx = lastMove.from.col - lastMove.to.col;
    const dy = lastMove.from.row - lastMove.to.row;

    // Animate captured pieces
    if (lastMove.captures && lastMove.captures.length > 0) {
      const caps = new Set(lastMove.captures.map(c => `${c.row},${c.col}`));
      setCapturedSquares(caps);
      setTimeout(() => setCapturedSquares(new Set()), 400);
    }

    if (dx === 0 && dy === 0) return;

    setAnimating({ row: lastMove.to.row, col: lastMove.to.col, dx, dy });
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => {
      animFrameRef.current = requestAnimationFrame(() => {
        setAnimating((prev) => prev ? { ...prev, dx: 0, dy: 0 } : null);
      });
    });
    const timer = setTimeout(() => setAnimating(null), 350);
    return () => { clearTimeout(timer); cancelAnimationFrame(animFrameRef.current); };
  }, [lastMove]);

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
      <div className={`board-container ${turnClass || ''}`}>
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

                  const isMustCapture = mustCapturePieces?.has(`${ar},${ac}`) ?? false;

                  let className = `cell ${isDark ? 'dark' : 'light'}`;
                  if (isSelected) className += ' selected';
                  if (isValid) className += ' valid-target';
                  if (isMustCapture) className += ' must-capture';

                  const isAnimTarget = animating && animating.row === ar && animating.col === ac;
                  const animStyle = isAnimTarget
                    ? { transform: `translate(${animating!.dx * 100}%, ${animating!.dy * 100}%)` }
                    : undefined;
                  const isCaptured = capturedSquares.has(`${ar},${ac}`);

                  return (
                    <div key={ci} className={className} onClick={() => handleClick(ri, ci)}>
                      {cell && (
                        <div
                          className={`checker-disc ${isWhite ? 'disc-white' : 'disc-black'} ${isKing ? 'disc-king' : ''}${isAnimTarget ? ' piece-animate' : ''}${isCaptured ? ' checker-captured' : ''}`}
                          style={animStyle}
                        >
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
