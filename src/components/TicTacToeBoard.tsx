import { useState, useEffect } from 'react';
import type { TicTacToeBoard as TTTBoard, Color } from '../types';
import { getWinningLine } from '../engine/tictactoe';

interface Props {
  board: TTTBoard;
  myColor: Color;
  isMyTurn: boolean;
  onMove: (index: number) => void;
  gameOver: boolean;
  turnClass?: string;
}

export default function TicTacToeBoard({ board, isMyTurn, onMove, gameOver, turnClass }: Props) {
  const [lastPlaced, setLastPlaced] = useState<number | null>(null);
  const winLine = getWinningLine(board);
  const winSet = winLine ? new Set(winLine) : null;

  useEffect(() => {
    // Find the most recently placed piece
    const filled = board.reduce((count, c) => count + (c ? 1 : 0), 0);
    if (filled > 0) {
      // Reset animation after it plays
      const timer = setTimeout(() => setLastPlaced(null), 400);
      return () => clearTimeout(timer);
    }
  }, [board]);

  function handleClick(index: number) {
    if (gameOver || !isMyTurn || board[index] !== null) return;
    setLastPlaced(index);
    onMove(index);
  }

  return (
    <div className="board-wrapper">
      <div className={`board-container ${turnClass || ''}`}>
        <div className="ttt-board">
          {board.map((cell, i) => (
            <div
              key={i}
              className={`ttt-cell${cell ? '' : ' ttt-empty'}${winSet?.has(i) ? ' ttt-win' : ''}`}
              onClick={() => handleClick(i)}
            >
              {cell && (
                <span className={`ttt-symbol ttt-${cell.toLowerCase()}${lastPlaced === i ? ' ttt-pop' : ''}`}>
                  {cell}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
