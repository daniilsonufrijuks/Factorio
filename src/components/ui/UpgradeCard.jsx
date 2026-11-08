import { useEffect, useRef, useState } from 'react';
import { Check, Lock } from 'lucide-react';

const STATUS_TEXT = {
  available: 'Available',
  ready: 'Ready',
  owned: 'Owned',
  maxed: 'Maxed',
  locked: 'Locked',
  poor: 'Need cash',
  needs: 'Requires',
  idle: 'Idle',
};

export default function UpgradeCard({
  icon: Icon,
  tone,
  eyebrow,
  title,
  description,
  detail,
  status = 'available',
  statusText,
  actionLabel,
  cost,
  onAction,
  disabled,
  progress,
  progressLabel,
  children,
}) {
  const [bought, setBought] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const blocked = disabled ?? !(status === 'available' || status === 'ready');

  const handle = () => {
    if (blocked || !onAction) return;
    onAction();
    setBought(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setBought(false), 520);
  };

  return (
    <article className={`ucard is-${status} ${bought ? 'is-bought' : ''}`} style={tone ? { '--tone': tone } : undefined}>
      {Icon ? (
        <div className="ucard-icon" aria-hidden="true">
          <Icon size={20} />
        </div>
      ) : null}
      <div className="ucard-body">
        <div className="ucard-head">
          <div className="ucard-titles">
            {eyebrow ? <p className="ucard-eyebrow">{eyebrow}</p> : null}
            <h4>{title}</h4>
          </div>
          <span className={`chip chip-${status}`}>
            {status === 'locked' || status === 'needs' ? <Lock size={11} /> : null}
            {status === 'owned' || status === 'maxed' ? <Check size={11} /> : null}
            {statusText || STATUS_TEXT[status]}
          </span>
        </div>
        {description ? <p className="ucard-desc">{description}</p> : null}
        {detail ? <p className="ucard-detail">{detail}</p> : null}
        {progress != null ? (
          <div className="ucard-progress">
            <div className="meter"><span style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }} /></div>
            {progressLabel ? <small>{progressLabel}</small> : null}
          </div>
        ) : null}
        {children}
        {onAction ? (
          <button type="button" className="ucard-buy" disabled={blocked} onClick={handle}>
            <span>{actionLabel}</span>
            {cost ? <strong>{cost}</strong> : null}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function PanelHeader({ icon: Icon, eyebrow, title, text, stats }) {
  return (
    <header className="panel-head">
      <div className="panel-head-row">
        {Icon ? <span className="panel-head-icon" aria-hidden="true"><Icon size={20} /></span> : null}
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>
      {text ? <p className="panel-head-text">{text}</p> : null}
      {stats?.length ? (
        <dl className="kpis">
          {stats.map((item) => (
            <div key={item.label} className={item.tone ? `tone-${item.tone}` : ''}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}

export function SectionTitle({ children, aside }) {
  return (
    <div className="section-title">
      <h3>{children}</h3>
      {aside ? <span>{aside}</span> : null}
    </div>
  );
}

export function cashStatus(money, cost) {
  return money >= cost ? 'available' : 'poor';
}
