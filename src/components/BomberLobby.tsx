import { PLAYER_COLORS } from '../engine/bomber';
import type { BomberPlayer } from '../types';

interface InvitedUser {
  id: string;
  name: string;
  avatar: string;
}

interface Props {
  players: BomberPlayer[];
  isHost: boolean;
  onStart: () => void;
  inviteCode: string;
  copied: boolean;
  onCopy: () => void;
  isValuVerse: boolean;
  onInvite: () => void;
  loadingInvite: boolean;
  invitedUsers: InvitedUser[];
}

export default function BomberLobby({ players, isHost, onStart, inviteCode, copied, onCopy, isValuVerse, onInvite, loadingInvite, invitedUsers }: Props) {
  const canStart = players.length >= 2;

  return (
    <div className="bomber-lobby">
      <div className="bomber-lobby-header">
        <i className="fa-solid fa-bomb"></i>
        <h3>Bomber Lobby</h3>
        <span className="bomber-lobby-count">{players.length}/10</span>
      </div>

      <div className="bomber-lobby-players">
        {players.map((p, i) => (
          <div key={p.id} className="bomber-lobby-player">
            <div
              className="bomber-lobby-avatar"
              style={{ borderColor: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
            >
              <img src={p.avatarUrl} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <span className="bomber-lobby-name">{p.nickname}</span>
            {i === 0 && <span className="bomber-lobby-host">HOST</span>}
          </div>
        ))}

        {players.length < 10 && (
          <div className="bomber-lobby-player empty">
            <div className="bomber-lobby-avatar empty">
              <i className="fa-solid fa-user-plus"></i>
            </div>
            <span className="bomber-lobby-name">Waiting...</span>
          </div>
        )}
      </div>

      <div className="bomber-lobby-invite">
        {isValuVerse && (
          <>
            <button className="valu-invite-btn" onClick={onInvite} disabled={loadingInvite}>
              {loadingInvite ? (
                <><i className="fa-solid fa-spinner fa-spin"></i> Loading...</>
              ) : (
                <><i className="fa-solid fa-user-plus"></i> Invite</>
              )}
            </button>
            {invitedUsers.length > 0 && (
              <div className="bomber-invited-list">
                {invitedUsers.map((u) => (
                  <div key={u.id} className="bomber-invited-user">
                    {u.avatar ? (
                      <img className="bomber-invited-avatar" src={u.avatar} alt="" />
                    ) : (
                      <div className="bomber-invited-avatar placeholder">
                        <i className="fa-solid fa-user"></i>
                      </div>
                    )}
                    <span>{u.name}</span>
                    <i className="fa-solid fa-paper-plane bomber-invited-sent"></i>
                  </div>
                ))}
              </div>
            )}
            <div className="waiting-divider">
              <span>or share code</span>
            </div>
          </>
        )}
        <button className="invite-code-card" onClick={onCopy}>
          <div className="invite-code-digits">
            {inviteCode.split('').map((char, i) => (
              <span key={i} className="code-char">{char}</span>
            ))}
          </div>
          <div className="invite-code-action">
            <i className={copied ? 'fa-solid fa-check' : 'fa-regular fa-copy'}></i>
            {copied ? 'Copied!' : 'Tap to copy'}
          </div>
        </button>
      </div>

      <div className="bomber-howto">
        <h4><i className="fa-solid fa-gamepad"></i> How to Play</h4>
        <div className="bomber-howto-grid">
          <div className="bomber-howto-item">
            <div className="bomber-howto-icon"><i className="fa-solid fa-arrows-up-down-left-right"></i></div>
            <div>
              <strong>Move</strong>
              <span>Arrow keys or WASD</span>
            </div>
          </div>
          <div className="bomber-howto-item">
            <div className="bomber-howto-icon"><i className="fa-solid fa-bomb"></i></div>
            <div>
              <strong>Place Bomb</strong>
              <span>Spacebar or bomb button</span>
            </div>
          </div>
          <div className="bomber-howto-item">
            <div className="bomber-howto-icon"><i className="fa-solid fa-skull-crossbones"></i></div>
            <div>
              <strong>Goal</strong>
              <span>Be the last one standing!</span>
            </div>
          </div>
          <div className="bomber-howto-item">
            <div className="bomber-howto-icon"><i className="fa-solid fa-clock"></i></div>
            <div>
              <strong>Time Limit</strong>
              <span>3 minutes — most kills wins if tied</span>
            </div>
          </div>
        </div>
        <h4><i className="fa-solid fa-star"></i> Power-ups</h4>
        <div className="bomber-howto-powerups">
          <div className="bomber-howto-pw">
            <span className="bomber-howto-pw-icon range"><i className="fa-solid fa-up-right-and-down-left-from-center"></i></span>
            <strong>Range Up</strong> — bigger explosions
          </div>
          <div className="bomber-howto-pw">
            <span className="bomber-howto-pw-icon bomb"><i className="fa-solid fa-bomb"></i></span>
            <strong>Extra Bomb</strong> — place more bombs at once
          </div>
          <div className="bomber-howto-pw">
            <span className="bomber-howto-pw-icon speed"><i className="fa-solid fa-bolt"></i></span>
            <strong>Speed Up</strong> — move faster
          </div>
        </div>
      </div>

      {isHost ? (
        <button
          className="bomber-start-btn"
          onClick={onStart}
          disabled={!canStart}
        >
          {canStart ? (
            <>
              <i className="fa-solid fa-play"></i> Start Game
            </>
          ) : (
            <>
              <i className="fa-solid fa-hourglass-half"></i> Need 2+ players
            </>
          )}
        </button>
      ) : (
        <div className="bomber-lobby-waiting">
          <i className="fa-solid fa-spinner fa-spin"></i>
          <span>Waiting for host to start...</span>
        </div>
      )}
    </div>
  );
}
