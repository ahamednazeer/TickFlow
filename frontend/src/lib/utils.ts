// ============================================================
// TickFlow — Utility Functions
// ============================================================

import { Exchange, EXCHANGE_LABELS } from './types';

/**
 * Format a number as USD currency
 */
export function formatCurrency(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format BTC price with appropriate precision
 */
export function formatBTCPrice(price: number): string {
  return formatCurrency(price, 2);
}

/**
 * Format percentage with sign
 */
export function formatPercent(value: number, decimals = 4): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format a number with commas
 */
export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format volume with K/M/B suffixes
 */
export function formatVolume(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

/**
 * Format milliseconds as human-readable latency
 */
export function formatLatency(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format timestamp as relative time
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/**
 * Format timestamp as date/time string
 */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Format timestamp as time only
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false,
  });
}

/**
 * Get exchange display name
 */
export function getExchangeName(exchange: Exchange): string {
  return EXCHANGE_LABELS[exchange] || exchange;
}

/**
 * Get CSS class for profit/loss coloring
 */
export function getPnLClass(value: number): string {
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-slate-400';
}

/**
 * Get background class for profit/loss
 */
export function getPnLBgClass(value: number): string {
  if (value > 0) return 'bg-green-950/50 border-green-800/50';
  if (value < 0) return 'bg-red-950/50 border-red-800/50';
  return 'bg-slate-950/50 border-slate-800/50';
}

/**
 * Get color for latency indicator
 */
export function getLatencyColor(ms: number): string {
  if (ms < 50) return '#22c55e';   // green
  if (ms < 100) return '#84cc16';  // lime
  if (ms < 200) return '#f59e0b';  // amber
  if (ms < 500) return '#f97316';  // orange
  return '#ef4444';                // red
}

/**
 * Get status color class
 */
export function getConnectionStatusColor(status: string): string {
  switch (status) {
    case 'connected': return 'text-green-400 bg-green-950/50 border-green-800';
    case 'reconnecting': return 'text-yellow-400 bg-yellow-950/50 border-yellow-800';
    case 'disconnected': return 'text-red-400 bg-red-950/50 border-red-800';
    case 'error': return 'text-red-400 bg-red-950/50 border-red-800';
    default: return 'text-slate-400 bg-slate-950/50 border-slate-800';
  }
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Calculate spread between two prices
 */
export function calculateSpread(buyPrice: number, sellPrice: number): { spread: number; spreadPercent: number } {
  const spread = sellPrice - buyPrice;
  const spreadPercent = (spread / buyPrice) * 100;
  return { spread, spreadPercent };
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Class name merger (simple cn utility)
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
