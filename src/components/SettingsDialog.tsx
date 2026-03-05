import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: Props) {
  const [moveSounds, setMoveSounds] = useState(() => localStorage.getItem('sound_moves') !== 'false');
  const [turnDing, setTurnDing] = useState(() => localStorage.getItem('sound_turn') !== 'false');

  if (!open) return null;

  function toggleMove() {
    const next = !moveSounds;
    setMoveSounds(next);
    localStorage.setItem('sound_moves', String(next));
  }

  function toggleTurn() {
    const next = !turnDing;
    setTurnDing(next);
    localStorage.setItem('sound_turn', String(next));
  }

  return (
    <div className="game-over-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <i className="fa-solid fa-gear"></i>
          <h2>Settings</h2>
        </div>

        <div className="settings-toggle" onClick={toggleMove}>
          <span>Move sounds</span>
          <div className={`toggle-switch ${moveSounds ? 'on' : ''}`}>
            <div className="toggle-knob" />
          </div>
        </div>
        <div className="settings-toggle" onClick={toggleTurn}>
          <span>Turn ding</span>
          <div className={`toggle-switch ${turnDing ? 'on' : ''}`}>
            <div className="toggle-knob" />
          </div>
        </div>

        <button className="game-over-btn secondary" onClick={onClose} style={{ marginTop: '0.5rem', width: '100%' }}>
          Done
        </button>
      </div>
    </div>
  );
}
