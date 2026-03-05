import { useState, useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: Props) {
  const [moveSounds, setMoveSounds] = useState(() => localStorage.getItem('sound_moves') !== 'false');
  const [turnDing, setTurnDing] = useState(() => localStorage.getItem('sound_turn') !== 'false');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

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
    <div className="settings-dialog" ref={ref}>
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
    </div>
  );
}
