import { BarChart3, Settings } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { getFactoryRates } from '../utils/economy.js';
import { formatNumber } from '../utils/formatter.js';
import { getLevelInfo } from '../utils/progression.js';
import MoneyDisplay from './MoneyDisplay.jsx';

export default function TopBar() {
  const { state, setModal } = useGame();
  const info = getLevelInfo(state.totalXp);
  const rates = getFactoryRates(state);
  const progress = Math.max(0, Math.min(100, (info.into / info.need) * 100));
  const [levelPop, setLevelPop] = useState(false);
  const lastLevel = useRef(info.level);

  useEffect(() => {
    if (info.level > lastLevel.current) {
      setLevelPop(true);
      const timer = window.setTimeout(() => setLevelPop(false), 900);
      lastLevel.current = info.level;
      return () => window.clearTimeout(timer);
    }
    lastLevel.current = info.level;
    return undefined;
  }, [info.level]);

  return (
    <header className="topbar">
      <div className="hud-group top-actions">
        <button type="button" className="icon-btn" onClick={() => setModal('settings')} aria-label="Settings">
          <Settings size={18} />
        </button>
        <button type="button" className="icon-btn" onClick={() => setModal('stats')} aria-label="Statistics">
          <BarChart3 size={18} />
        </button>
      </div>

      <div className="hud-group hud-money">
        <MoneyDisplay value={state.money} rate={rates.auto} />
      </div>

      <div className={`hud-group level-block ${levelPop ? 'is-up' : ''}`} title={`${Math.floor(info.into)} / ${info.need} XP`}>
        <span className="level-badge" aria-label={`Level ${info.level}`}>{info.level}</span>
        <div className="level-meta">
          <div className="level-row">
            <span className="level-kicker">Level</span>
            <span className="xp-label">{formatNumber(Math.floor(info.into))} / {formatNumber(info.need)} XP</span>
          </div>
          <div className="bar" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </header>
  );
}
