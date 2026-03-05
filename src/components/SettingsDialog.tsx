import { useState, useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export default function SettingsDialog({ open, onClose, anchorRef }: Props) {
  const [moveSounds, setMoveSounds] = useState(() => localStorage.getItem('sound_moves') !== 'false');
  const [turnDing, setTurnDing] = useState(() => localStorage.getItem('sound_turn') !== 'false');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose, anchorRef]);

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
