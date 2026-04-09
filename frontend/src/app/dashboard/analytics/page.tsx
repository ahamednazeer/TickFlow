'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    ChartBar,
    Pulse,
    TrendUp,
    Trophy,
    Timer,
    Target,
} from '@phosphor-icons/react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import { DataCard } from '@/components/DataCard';
import PnLChart from '@/components/PnLChart';
import { EXCHANGE_LABELS, type PerformanceMetrics, type PnLDataPoint, type ExchangePairPerformance } from '@/lib/types';
import { formatPercent, formatLatency } from '@/lib/utils';
import { useCurrency } from '@/lib/currency';
import { api } from '@/lib/api';

export default function AnalyticsPage() {
    const { formatCurrency, currencySymbol, convertFromUsd } = useCurrency();
    const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
    const [pnlData, setPnlData] = useState<PnLDataPoint[]>([]);
    const [pairPerformance, setPairPerformance] = useState<ExchangePairPerformance[]>([]);
    const [period, setPeriod] = useState('24h');
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const [perf, pnl, pairs] = await Promise.allSettled([
                api.getPerformanceMetrics(period),
                api.getPnLHistory(period),
                api.getExchangePairPerformance(),
            ]);

            if (perf.status === 'fulfilled') setPerformance(perf.value);
            if (pnl.status === 'fulfilled') setPnlData(pnl.value);
            if (pairs.status === 'fulfilled') setPairPerformance(pairs.value);
        } catch (err) {
            console.error('Failed to fetch analytics:', err);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const PIE_COLORS = ['#22c55e', '#ef4444', '#64748b'];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-slate-700 border-t-cyan-500 animate-spin" />
                    <Pulse size={24} className="absolute inset-0 m-auto text-cyan-400 animate-pulse" />
                </div>
                <p className="text-slate-500 font-mono text-xs uppercase tracking-widest animate-pulse">
                    Loading Analytics...
                </p>
            </div>
        );
    }

    const winLossData = performance ? [
        { name: 'Wins', value: performance.winningTrades },
        { name: 'Losses', value: performance.losingTrades },
    ] : [];

    const pairData = pairPerformance.map(p => ({
        name: `${EXCHANGE_LABELS[p.buyExchange]?.substring(0, 3) || p.buyExchange}→${EXCHANGE_LABELS[p.sellExchange]?.substring(0, 3) || p.sellExchange}`,
        profit: p.totalProfit,
        trades: p.totalTrades,
        winRate: p.winRate,
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-chivo font-bold uppercase tracking-wider flex items-center gap-3">
                        <ChartBar size={28} weight="duotone" className="text-cyan-400" />
                        Analytics
                    </h1>
                    <p className="text-slate-500 mt-1 font-mono text-xs">Performance metrics & trading insights</p>
                </div>
                <div className="flex gap-1">
                    {['1h', '24h', '7d', '30d'].map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`text-xs font-mono uppercase tracking-wider px-3 py-1.5 rounded-sm border transition-all ${
                                period === p
                                    ? 'bg-cyan-950/50 border-cyan-700 text-cyan-400'
                                    : 'border-slate-700 text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Performance Cards */}
            {performance && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <DataCard
                        title="Total Profit"
                        value={formatCurrency(performance.totalProfit)}
                        icon={TrendUp}
                        changeType={performance.totalProfit >= 0 ? 'positive' : 'negative'}
                        glowColor={performance.totalProfit >= 0 ? '#22c55e' : '#ef4444'}
                    />
                    <DataCard
                        title="Win Rate"
                        value={formatPercent(performance.winRate, 1)}
                        icon={Trophy}
                        subtitle={`${performance.winningTrades}W / ${performance.losingTrades}L`}
                        changeType={performance.winRate >= 50 ? 'positive' : 'negative'}
                    />
                    <DataCard
                        title="Avg Execution"
                        value={formatLatency(performance.avgExecutionTime)}
                        icon={Timer}
                        changeType={performance.avgExecutionTime < 200 ? 'positive' : 'negative'}
                    />
                    <DataCard
                        title="Profit Factor"
                        value={performance.profitFactor.toFixed(2)}
                        icon={Target}
                        changeType={performance.profitFactor >= 1 ? 'positive' : 'negative'}
                    />
                </div>
            )}

            {/* P&L Chart */}
            <PnLChart data={pnlData} height={350} />

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Exchange Pair Performance */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-5">
                    <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-500" />
                        Profit by Exchange Pair
                    </h3>
                    {pairData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={pairData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis
                                    dataKey="name"
                                    stroke="#475569"
                                    tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: '#64748b' }}
                                />
                                <YAxis
                                    stroke="#475569"
                                    tickFormatter={(v) => `${currencySymbol}${convertFromUsd(v).toFixed(0)}`}
                                    tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: '#64748b' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#0f172a',
                                        border: '1px solid #334155',
                                        borderRadius: '2px',
                                        fontFamily: 'JetBrains Mono',
                                        fontSize: '11px',
                                    }}
                                />
                                <Bar dataKey="profit" fill="#06b6d4" radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-64">
                            <p className="text-slate-600 font-mono text-xs">No pair data available</p>
                        </div>
                    )}
                </div>

                {/* Win/Loss Distribution */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-5">
                    <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-500" />
                        Win/Loss Distribution
                    </h3>
                    {winLossData.length > 0 && (winLossData[0].value > 0 || winLossData[1].value > 0) ? (
                        <div className="flex items-center gap-6">
                            <ResponsiveContainer width="60%" height={220}>
                                <PieChart>
                                    <Pie
                                        data={winLossData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        dataKey="value"
                                        strokeWidth={0}
                                    >
                                        {winLossData.map((_, index) => (
                                            <Cell key={index} fill={PIE_COLORS[index]} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-3">
                                {performance && (
                                    <>
                                        <div>
                                            <p className="text-[10px] font-mono text-slate-600 uppercase">Total Trades</p>
                                            <p className="text-xl font-mono font-bold text-slate-100">{performance.totalTrades}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-mono text-slate-600 uppercase">Max Profit</p>
                                            <p className="text-sm font-mono text-green-400">{formatCurrency(performance.maxProfit)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-mono text-slate-600 uppercase">Max Loss</p>
                                            <p className="text-sm font-mono text-red-400">{formatCurrency(performance.maxLoss)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-mono text-slate-600 uppercase">Sharpe Ratio</p>
                                            <p className="text-sm font-mono text-slate-300">{performance.sharpeRatio.toFixed(2)}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-64">
                            <p className="text-slate-600 font-mono text-xs">No trade data available</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
