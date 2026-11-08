const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td'];

export function formatNumber(value) {
  if (!Number.isFinite(value)) return '0';
  const sign = value < 0 ? '-' : '';
  let n = Math.abs(value);
  if (n < 1000) {
    if (n >= 100) return sign + String(Math.round(n));
    const rounded = Math.round(n * 10) / 10;
    return sign + (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1));
  }
  let index = 0;
  while (n >= 1000 && index < SUFFIXES.length - 1) {
    n /= 1000;
    index += 1;
  }
  const digits = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  const text = n.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  return sign + text + SUFFIXES[index];
}

export function formatMoney(value) {
  if (!Number.isFinite(value)) return '$0';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs < 1000) {
    const rounded = abs < 100 ? Math.round(abs * 10) / 10 : Math.round(abs);
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `${sign}$${text}`;
  }
  return `${sign}$${formatNumber(abs)}`;
}

export function formatRate(value) {
  if (!Number.isFinite(value) || value <= 0) return '$0';
  if (value < 100) {
    const rounded = Math.round(value * 10) / 10;
    return `$${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}`;
  }
  return formatMoney(value);
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '0s';
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value * 100)}%`;
}
