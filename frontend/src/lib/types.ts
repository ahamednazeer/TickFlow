// ============================================================
// TickFlow — Core TypeScript Type Definitions
// ============================================================

export enum Exchange {
  BINANCE = 'BINANCE',
  KUCOIN = 'KUCOIN',
  OKX = 'OKX',
  BYBIT = 'BYBIT',
}

export const EXCHANGE_COLORS: Record<Exchange, string> = {
  [Exchange.BINANCE]: '#F0B90B',
  [Exchange.KUCOIN]: '#24AE8F',
  [Exchange.OKX]: '#FFFFFF',
  [Exchange.BYBIT]: '#F7A600',
};

export const EXCHANGE_LABELS: Record<Exchange, string> = {
  [Exchange.BINANCE]: 'Binance',
  [Exchange.KUCOIN]: 'KuCoin',
  [Exchange.OKX]: 'OKX',
  [Exchange.BYBIT]: 'Bybit',
};

// ─── Market Data ────────────────────────────────────────────

export interface TickerData {
  exchange: Exchange;
  symbol: string;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  lastPrice: number;
  volume24h: number;
  change24h: number;
  timestamp: number;
}

export interface OrderbookLevel {
  price: number;
  quantity: number;
  total: number;
}

export interface Orderbook {
  exchange: Exchange;
  symbol: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  timestamp: number;
}

// ─── Arbitrage ──────────────────────────────────────────────

export type OpportunityStatus = 'DETECTED' | 'VALIDATING' | 'VALID' | 'EXPIRED' | 'EXECUTING' | 'EXECUTED';

export interface ArbitrageOpportunity {
  id: string;
  symbol: string;
  buyExchange: Exchange;
  sellExchange: Exchange;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  spreadPercent: number;
  buyFee: number;
  sellFee: number;
  withdrawalFee: number;
  totalFees: number;
  netProfit: number;
  netProfitPercent: number;
  confidence: number; // 0-100
  availableLiquidity: number;
  estimatedSlippage: number;
  status: OpportunityStatus;
  detectedAt: number;
  expiresAt: number;
}

// ─── Trade ──────────────────────────────────────────────────

export type TradeStatus = 'PENDING' | 'EXECUTING' | 'FILLED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';

export interface Trade {
  id: string;
  opportunityId: string;
  symbol: string;
  buyExchange: Exchange;
  sellExchange: Exchange;
  buyPrice: number;
  sellPrice: number;
  buyFilled: number;
  sellFilled: number;
  quantity: number;
  grossProfit: number;
  totalFees: number;
  netProfit: number;
  slippage: number;
  status: TradeStatus;
  executionTimeMs: number;
  createdAt: number;
  completedAt: number | null;
  errorMessage?: string;
}

// ─── Risk Management ────────────────────────────────────────

export interface RiskConfig {
  maxTradeSize: number;
  maxDailyLoss: number;
  maxOpenTrades: number;
  minSpreadPercent: number;
  minConfidence: number;
  volatilityThreshold: number;
  killSwitch: boolean;
  perExchangeAllocation: Record<Exchange, number>;
}

export interface RiskMetrics {
  currentDailyPnL: number;
  dailyLossLimit: number;
  openTrades: number;
  maxOpenTrades: number;
  totalCapital: number;
  utilizationPercent: number;
  volatilityIndex: number;
  isKillSwitchActive: boolean;
}

// ─── System Metrics ─────────────────────────────────────────

export interface ExchangeConnection {
  exchange: Exchange;
  status: 'connected' | 'reconnecting' | 'disconnected' | 'error';
  latencyMs: number;
  lastHeartbeat: number;
  messagesPerSecond: number;
  errorCount: number;
}

export interface SystemMetrics {
  uptime: number;
  avgLatencyMs: number;
  scannerCycleMs: number;
  opportunitiesDetected: number;
  opportunitiesExecuted: number;
  totalTrades: number;
  winRate: number;
  totalProfit: number;
  connections: ExchangeConnection[];
}

// ─── Analytics ──────────────────────────────────────────────

export interface PnLDataPoint {
  timestamp: number;
  profit: number;
  cumulative: number;
  tradeCount: number;
}

export interface ExchangePairPerformance {
  buyExchange: Exchange;
  sellExchange: Exchange;
  totalTrades: number;
  winRate: number;
  avgProfit: number;
  totalProfit: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  avgProfit: number;
  maxProfit: number;
  maxLoss: number;
  avgExecutionTime: number;
  sharpeRatio: number;
  profitFactor: number;
}

// ─── Settings ───────────────────────────────────────────────

export interface ExchangeConfig {
  exchange: Exchange;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  enabled: boolean;
  testMode: boolean;
}

// ─── Auth ───────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'TRADER' | 'VIEWER';
  createdAt: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}
