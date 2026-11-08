import { useState } from 'react';
import { Music, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import { useGame } from '../context/GameContext.jsx';

export default function SettingsModal() {
  const { state, modal, setModal, updateSettings, resetGame } = useGame();
  const [confirming, setConfirming] = useState(false);
  if (modal !== 'settings') return null;
  const { settings } = state;

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="modal">
        <header className="split">
          <div>
            <p className="eyebrow">Settings</p>
            <h2 id="settings-title">How the mill behaves</h2>
          </div>
          <button type="button" className="icon-btn" onClick={() => setModal(null)} aria-label="Close settings">
            <X size={18} />
          </button>
        </header>
        <ul className="help">
          <li>Machines finish goods onto the belt. Without auto-sell, they wait in the crate.</li>
          <li>Sell crates for cash, or fill a customer order for a larger payout.</li>
          <li>Automation keeps selling while you are away, up to the night-shift cap.</li>
        </ul>
        <div className="setting-row">
          <span><Volume2 size={18} /> Sound effects</span>
          <button type="button" className={`switch ${settings.sound ? 'is-on' : ''}`} onClick={() => updateSettings({ sound: !settings.sound })}>
            <i />
            {settings.sound ? 'On' : 'Off'}
          </button>
        </div>
        <div className="setting-row">
          <span><Music size={18} /> Music</span>
          <button type="button" className={`switch ${settings.music ? 'is-on' : ''}`} onClick={() => updateSettings({ music: !settings.music })}>
            <i />
            {settings.music ? 'On' : 'Off'}
          </button>
        </div>
        <div className="setting-row column">
          <span>{settings.sound ? <Volume2 size={18} /> : <VolumeX size={18} />} Animation quality</span>
          <div className="segment">
            {['high', 'medium', 'low'].map((quality) => (
              <button
                key={quality}
                type="button"
                className={settings.quality === quality ? 'is-on' : ''}
                onClick={() => updateSettings({ quality })}
              >
                {quality}
              </button>
            ))}
          </div>
        </div>
        <div className="danger-zone">
          <p>Reset clears cash, crew, lines, and orders on this browser.</p>
          {confirming ? (
            <div className="line-actions">
              <button type="button" className="btn btn-danger" onClick={resetGame}><RotateCcw size={16} /> Erase progress</button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>Keep playing</button>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setConfirming(true)}>Reset game</button>
          )}
        </div>
      </div>
    </div>
  );
}
