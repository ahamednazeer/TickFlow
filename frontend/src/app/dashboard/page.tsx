'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { DataCard } from '@/components/DataCard';
import PriceTickerBar from '@/components/PriceTickerBar';
import SpreadHeatmap from '@/components/SpreadHeatmap';
import ExchangeStatus from '@/components/ExchangeStatus';
import PnLChart from '@/components/PnLChart';
import LatencyGauge from '@/components/LatencyGauge';
import { StatusBadge } from '@/components/StatusBadge';
import {
    Lightning,
    TrendUp,
    ArrowsLeftRight,
    ShieldCheck,
    Gauge,
    Pulse,
    ChartLineUp,
} from '@phosphor-icons/react';
import { Exchange, type TickerData, type ExchangeConnection, type PnLDataPoint, type Trade } from '@/lib/types';
import { formatPercent, formatLatency, formatTimeAgo } from '@/lib/utils';
import { useCurrency } from '@/lib/currency';
import { api } from '@/lib/api';

export default function DashboardOverview() {
    const { formatCurrency } = useCurrency();
    const [tickers, setTickers] = useState<TickerData[]>([]);
    const [connections, setConnections] = useState<ExchangeConnection[]>([]);
    const [pnlData, setPnlData] = useState<PnLDataPoint[]>([]);
    const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
    const [metrics, setMetrics] = useState({
        totalProfit: 0,
        activeOpportunities: 0,
        winRate: 0,
        avgLatency: 0,
        totalTrades: 0,
        opportunitiesDetected: 0,
    });
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const [systemMetrics, pnlHistory, tradesData] = await Promise.allSettled([
                api.getSystemMetrics(),
                api.getPnLHistory('24h'),
                api.getTrades({ limit: 5 }),
            ]);

            if (systemMetrics.status === 'fulfilled') {
                const sm = systemMetrics.value;
                setConnections(sm.connections);
                setMetrics({
                    totalProfit: sm.totalProfit,
                    activeOpportunities: sm.opportunitiesDetected,
                    winRate: sm.winRate,
                    avgLatency: sm.avgLatencyMs,
                    totalTrades: sm.totalTrades,
                    opportunitiesDetected: sm.opportunitiesDetected,
                });
            }

            if (pnlHistory.status === 'fulfilled') {
                setPnlData(pnlHistory.value);
            }

            if (tradesData.status === 'fulfilled') {
                setRecentTrades(tradesData.value.trades);
            }

            // Fetch tickers
            try {
                const tickerData = await api.getTickers();
                setTickers(tickerData);
            } catch {
                // Tickers will be empty until backend is connected
            }
        } catch (err) {
            console.error('Failed to fetch dashboard data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // Refresh every 5s
        return () => clearInterval(interval);
    }, [fetchData]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-slate-700 border-t-cyan-500 animate-spin" />
                    <Pulse size={24} className="absolute inset-0 m-auto text-cyan-400 animate-pulse" />
                </div>
                <p className="text-slate-500 font-mono text-xs uppercase tracking-widest animate-pulse">
                    Loading Dashboard...
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-chivo font-bold uppercase tracking-wider flex items-center gap-3">
                    <Gauge size={28} weight="duotone" className="text-cyan-400" />
                    Overview
                </h1>
                <p className="text-slate-500 mt-1 font-mono text-xs">Real-time arbitrage monitoring & performance</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <DataCard
                    title="Total Profit"
                    value={formatCurrency(metrics.totalProfit)}
                    icon={TrendUp}
                    changeType={metrics.totalProfit >= 0 ? 'positive' : 'negative'}
                    glowColor={metrics.totalProfit >= 0 ? '#22c55e' : '#ef4444'}
                />
                <DataCard
                    title="Opportunities"
                    value={metrics.opportunitiesDetected}
                    icon={Lightning}
                    subtitle="detected today"
                    glowColor="#06b6d4"
                />
                <DataCard
                    title="Win Rate"
                    value={formatPercent(metrics.winRate, 1)}
                    icon={ChartLineUp}
                    changeType={metrics.winRate >= 50 ? 'positive' : 'negative'}
                    glowColor="#3b82f6"
                />
                <DataCard
                    title="Avg Latency"
                    value={formatLatency(metrics.avgLatency)}
                    icon={ShieldCheck}
                    changeType={metrics.avgLatency < 200 ? 'positive' : 'negative'}
                    glowColor={metrics.avgLatency < 200 ? '#22c55e' : '#f59e0b'}
                />
            </div>

            {/* Price Ticker */}
            <PriceTickerBar tickers={tickers} />

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Spread Heatmap — 2 cols */}
                <div className="lg:col-span-2">
                    <SpreadHeatmap tickers={tickers} />
                </div>

                {/* Latency Gauge + Stats */}
                <div className="space-y-4">
                    <LatencyGauge value={metrics.avgLatency} />
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-4">
                        <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Quick Stats</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-mono">
                                <span className="text-slate-500">Total Trades</span>
                                <span className="text-slate-300">{metrics.totalTrades}</span>
                            </div>
                            <div className="flex justify-between text-xs font-mono">
                                <span className="text-slate-500">Active Connections</span>
                                <span className="text-green-400">{connections.filter(c => c.status === 'connected').length}/{connections.length}</span>
                            </div>
                            <div className="flex justify-between text-xs font-mono">
                                <span className="text-slate-500">Scanner Cycle</span>
                                <span className="text-slate-300">&lt; 5ms</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* P&L Chart */}
            <PnLChart data={pnlData} />

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Trades */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-5">
                    <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <ArrowsLeftRight size={16} weight="duotone" className="text-cyan-400" />
                        Recent Trades
                    </h3>
                    {recentTrades.length === 0 ? (
                        <p className="text-slate-600 font-mono text-xs text-center py-8">No trades executed yet</p>
                    ) : (
                        <div className="space-y-2">
                            {recentTrades.map((trade) => (
                                <div key={trade.id} className="bg-slate-900/50 border border-slate-800/50 rounded-sm px-4 py-3 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <StatusBadge status={trade.status} />
                                        <div>
                                            <p className="text-xs font-mono text-slate-300">
                                                {trade.buyExchange} → {trade.sellExchange}
                                            </p>
                                            <p className="text-[10px] font-mono text-slate-600">
                                                {formatTimeAgo(trade.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`text-sm font-mono font-bold ${trade.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {trade.netProfit >= 0 ? '+' : ''}{formatCurrency(trade.netProfit)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Exchange Status */}
                <ExchangeStatus connections={connections} />
            </div>
        </div>
    );
}
