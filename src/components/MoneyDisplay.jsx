import { useEffect, useRef, useState } from 'react';
import { formatMoney, formatRate } from '../utils/formatter.js';

export default function MoneyDisplay({ value, rate }) {
  const [pulse, setPulse] = useState(false);
  const previous = useRef(value);

  useEffect(() => {
    if (value > previous.current + 0.01) {
      setPulse(true);
      const timer = window.setTimeout(() => setPulse(false), 280);
      previous.current = value;
      return () => window.clearTimeout(timer);
    }
    previous.current = value;
    return undefined;
  }, [value]);

  return (
    <div className={`money ${pulse ? 'is-pulsing' : ''}`}>
      <span className="coin" aria-hidden="true" />
      <div className="money-copy">
        <strong>{formatMoney(value)}</strong>
        <span className="money-rate"><b>+{formatRate(rate)}</b>/s income</span>
      </div>
    </div>
  );
}
