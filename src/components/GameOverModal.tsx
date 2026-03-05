import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Color, Winner } from '../types';
import { playWinSound, playLoseSound } from '../utils/sounds';

interface Props {
  winner: Winner;
  myColor: Color;
}

export default function GameOverModal({ winner, myColor }: Props) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  const isWin = winner === myColor;
  const isDraw = winner === 'draw';

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
      if (isWin) playWinSound();
      else if (!isDraw) playLoseSound();
    }, 500);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  const theme = isWin ? 'win' : isDraw ? 'draw' : 'lose';
  const icon = isWin ? 'fa-solid fa-trophy' : isDraw ? 'fa-solid fa-handshake' : 'fa-solid fa-flag';
  const title = isWin ? 'Victory!' : isDraw ? 'Draw Game' : 'Defeat';
  const subtitle = isWin ? 'Well played!' : isDraw ? 'A close match!' : 'Better luck next time';

  return (
    <div className="game-over-overlay" onClick={() => setVisible(false)}>
      <div className={`game-over-modal ${theme}`} onClick={(e) => e.stopPropagation()}>
        {isWin && (
          <div className="confetti-container">
            {Array.from({ length: 30 }, (_, i) => (
              <div
                key={i}
                className="confetti-piece"
                style={{
                  '--x': `${Math.random() * 100}%`,
                  '--r': `${Math.random() * 360}deg`,
                  '--d': `${0.5 + Math.random() * 1}s`,
                  '--h': `${Math.random() * 360}`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        )}

        <div className={`game-over-icon ${theme}`}>
          <i className={icon}></i>
        </div>

        <h2 className="game-over-title">{title}</h2>
        <p className="game-over-subtitle">{subtitle}</p>

        <div className="game-over-buttons">
          <button className="game-over-btn primary" onClick={() => { sessionStorage.removeItem('active_game_code'); navigate('/'); }}>
            <i className="fa-solid fa-house"></i> Home
          </button>
        </div>
      </div>
    </div>
  );
}
