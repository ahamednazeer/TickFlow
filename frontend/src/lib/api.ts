// ============================================================
// TickFlow — API Client
// ============================================================

import type {
  AuthResponse,
  User,
  Trade,
  ArbitrageOpportunity,
  RiskConfig,
  RiskMetrics,
  SystemMetrics,
  PerformanceMetrics,
  PnLDataPoint,
  ExchangePairPerformance,
  ExchangeConfig,
  TickerData,
} from './types';
import { API_BASE_URL } from './env';

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('tickflow_token');
    }
  }

  // ─── Token Management ──────────────────────────────────────

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('tickflow_token', token);
    }
  }

  clearToken(): void {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tickflow_token');
    }
  }

  // ─── HTTP Methods ──────────────────────────────────────────

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ─── Auth ──────────────────────────────────────────────────

  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(response.token);
    return response;
  }

  async getMe(): Promise<User> {
    return this.request<User>('/api/auth/me');
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.clearToken();
    }
  }

  // ─── Market Data ──────────────────────────────────────────

  async getTickers(): Promise<TickerData[]> {
    return this.request<TickerData[]>('/api/market/tickers');
  }

  // ─── Arbitrage ────────────────────────────────────────────

  async getOpportunities(): Promise<ArbitrageOpportunity[]> {
    return this.request<ArbitrageOpportunity[]>('/api/arbitrage/opportunities');
  }

  // ─── Trades ───────────────────────────────────────────────

  async getTrades(params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<{ trades: Trade[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.status) query.set('status', params.status);
    return this.request(`/api/trades?${query.toString()}`);
  }

  async getTrade(id: string): Promise<Trade> {
    return this.request<Trade>(`/api/trades/${id}`);
  }

  // ─── Risk Management ─────────────────────────────────────

  async getRiskConfig(): Promise<RiskConfig> {
    return this.request<RiskConfig>('/api/risk/config');
  }

  async updateRiskConfig(config: Partial<RiskConfig>): Promise<RiskConfig> {
    return this.request<RiskConfig>('/api/risk/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async getRiskMetrics(): Promise<RiskMetrics> {
    return this.request<RiskMetrics>('/api/risk/metrics');
  }

  async toggleKillSwitch(active: boolean): Promise<void> {
    await this.request('/api/risk/kill-switch', {
      method: 'POST',
      body: JSON.stringify({ active }),
    });
  }

  // ─── System ───────────────────────────────────────────────

  async getSystemMetrics(): Promise<SystemMetrics> {
    return this.request<SystemMetrics>('/api/system/metrics');
  }

  // ─── Analytics ────────────────────────────────────────────

  async getPerformanceMetrics(period?: string): Promise<PerformanceMetrics> {
    const query = period ? `?period=${period}` : '';
    return this.request<PerformanceMetrics>(`/api/analytics/performance${query}`);
  }

  async getPnLHistory(period?: string): Promise<PnLDataPoint[]> {
    const query = period ? `?period=${period}` : '';
    return this.request<PnLDataPoint[]>(`/api/analytics/pnl${query}`);
  }

  async getExchangePairPerformance(): Promise<ExchangePairPerformance[]> {
    return this.request<ExchangePairPerformance[]>('/api/analytics/exchange-pairs');
  }

  // ─── Settings ─────────────────────────────────────────────

  async getExchangeConfigs(): Promise<ExchangeConfig[]> {
    return this.request<ExchangeConfig[]>('/api/settings/exchanges');
  }

  async updateExchangeConfig(config: ExchangeConfig): Promise<ExchangeConfig> {
    return this.request<ExchangeConfig>(`/api/settings/exchanges/${config.exchange}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async testExchangeConnection(exchange: string): Promise<{ success: boolean; latencyMs: number }> {
    return this.request(`/api/settings/exchanges/${exchange}/test`, {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
