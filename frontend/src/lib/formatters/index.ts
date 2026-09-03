/**
 * Financial & Technical Formatters
 */

export function formatInr(amount: number, isPaise: boolean = true): string {
  const rupees = isPaise ? amount / 100 : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function formatTimestamp(ts: number | string | Date): string {
  if (!ts) return '-';
  let date: Date;
  if (typeof ts === 'number') {
    // If seconds (< 1e11), multiply by 1000
    date = new Date(ts < 100000000000 ? ts * 1000 : ts);
  } else {
    date = new Date(ts);
  }
  if (isNaN(date.getTime())) return String(ts);
  return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}

export function formatTimeOnly(ts: number | string | Date): string {
  if (!ts) return '-';
  let date: Date;
  if (typeof ts === 'number') {
    date = new Date(ts < 100000000000 ? ts * 1000 : ts);
  } else {
    date = new Date(ts);
  }
  if (isNaN(date.getTime())) return String(ts);
  return date.toLocaleTimeString('en-US', { hour12: false });
}

export function truncateHash(hash?: string | null, left = 8, right = 8): string {
  if (!hash) return '-';
  if (hash.length <= left + right + 3) return hash;
  return `${hash.substring(0, left)}...${hash.substring(hash.length - right)}`;
}

export function formatPercent(bpsOrPct: number, isBps = false): string {
  const pct = isBps ? bpsOrPct / 100 : bpsOrPct;
  return `${pct.toFixed(2)}%`;
}
