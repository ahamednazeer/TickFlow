'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    MagnifyingGlass,
    Pulse,
    Lightning,
    FunnelSimple,
    ArrowRight,
    Play,
    Pause,
} from '@phosphor-icons/react';
import { StatusBadge } from '@/components/StatusBadge';
import { Exchange, EXCHANGE_LABELS, type ArbitrageOpportunity } from '@/lib/types';
import { formatPercent, formatTimeAgo } from '@/lib/utils';
import { useCurrency } from '@/lib/currency';
import { useScannerPreferences } from '@/lib/scanner-preferences';
import { api } from '@/lib/api';

export default function ScannerPage() {
    const { formatBTCPrice, formatCurrency, convertFromUsd, currencyLabel } = useCurrency();
    const {
        viewMode,
        minSpread,
        minProfit,
        setViewMode,
        setMinSpread,
        setMinProfit,
    } = useScannerPreferences();
    const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [filters, setFilters] = useState({
        exchange: '' as string,
    });

    const fetchOpportunities = useCallback(async () => {
        try {
            const data = await api.getOpportunities();
            setOpportunities(data);
        } catch (err) {
            console.error('Failed to fetch opportunities:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOpportunities();
        if (autoRefresh) {
            const interval = setInterval(fetchOpportunities, 2000);
            return () => clearInterval(interval);
        }
    }, [fetchOpportunities, autoRefresh]);

    const filtered = opportunities.filter(opp => {
        if (viewMode === 'profitable_only' && opp.status !== 'VALID') return false;
        if (minSpread > 0 && opp.spreadPercent < minSpread) return false;
        if (minProfit > 0 && convertFromUsd(opp.netProfit) < minProfit) return false;
        if (filters.exchange && opp.buyExchange !== filters.exchange && opp.sellExchange !== filters.exchange) return false;
        return true;
    });

    const validCount = opportunities.filter((opp) => opp.status === 'VALID').length;
    const detectedOnlyCount = opportunities.filter((opp) => opp.status !== 'VALID').length;

    const getExchangeBadgeClass = (exchange: Exchange) => {
        switch (exchange) {
            case Exchange.BINANCE: return 'exchange-binance';
            case Exchange.KUCOIN: return 'exchange-kucoin';
            case Exchange.OKX: return 'exchange-okx';
            case Exchange.BYBIT: return 'exchange-bybit';
            default: return '';
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-slate-700 border-t-cyan-500 animate-spin" />
                    <Pulse size={24} className="absolute inset-0 m-auto text-cyan-400 animate-pulse" />
                </div>
                <p className="text-slate-500 font-mono text-xs uppercase tracking-widest animate-pulse">
                    Initializing Scanner...
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-chivo font-bold uppercase tracking-wider flex items-center gap-3">
                        <MagnifyingGlass size={28} weight="duotone" className="text-cyan-400" />
                        Arbitrage Scanner
                    </h1>
                    <p className="text-slate-500 mt-1 font-mono text-xs">Real-time cross-exchange opportunity detection</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-mono uppercase tracking-wider border transition-all ${autoRefresh
                                ? 'bg-green-950/50 border-green-700 text-green-400'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                    >
                        {autoRefresh ? <Play size={14} weight="fill" /> : <Pause size={14} />}
                        {autoRefresh ? 'Live' : 'Paused'}
                    </button>
                    <div className="flex items-center gap-2">
                        <div className={autoRefresh ? 'live-dot' : 'live-dot live-dot-error'} />
                        <span className="text-xs font-mono text-slate-500">
                            {filtered.length} opportunities
                        </span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                    <FunnelSimple size={16} className="text-slate-500" />
                    <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Filters</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                        <label className="block text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">View Mode</label>
                        <select
                            value={viewMode}
                            onChange={(e) => setViewMode(e.target.value as 'profitable_only' | 'show_detected')}
                            className="input-modern"
                        >
                            <option value="profitable_only">Profitable Only (Recommended)</option>
                            <option value="show_detected">Show Detected Spreads</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">Min Spread %</label>
                        <input
                            type="number"
                            step="0.01"
                            value={minSpread}
                            onChange={(e) => setMinSpread(parseFloat(e.target.value) || 0)}
                            className="input-modern"
                            placeholder="0.00"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">Min Profit ({currencyLabel})</label>
                        <input
                            type="number"
                            step="1"
                            value={minProfit}
                            onChange={(e) => setMinProfit(parseFloat(e.target.value) || 0)}
                            className="input-modern"
                            placeholder="0"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">Exchange</label>
                        <select
                            value={filters.exchange}
                            onChange={(e) => setFilters(f => ({ ...f, exchange: e.target.value }))}
                            className="input-modern"
                        >
                            <option value="">All Exchanges</option>
                            {Object.values(Exchange).map(ex => (
                                <option key={ex} value={ex}>{EXCHANGE_LABELS[ex]}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-[10px] font-mono text-slate-500">
                    <span>{validCount} valid</span>
                    <span>{detectedOnlyCount} detected-only</span>
                    <span>
                        {viewMode === 'profitable_only'
                            ? 'Showing only opportunities that pass fee and risk filters'
                            : 'Showing both profitable and near-miss spreads'}
                    </span>
                </div>
            </div>

            {/* Opportunities List */}
            {filtered.length === 0 ? (
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm text-center py-16">
                    <Lightning size={48} className="text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 font-mono text-sm">
                        {viewMode === 'profitable_only'
                            ? 'No profitable arbitrage opportunities right now'
                            : 'No detected spreads match your current filters'}
                    </p>
                    <p className="text-slate-600 font-mono text-xs mt-1">
                        {viewMode === 'profitable_only'
                            ? 'Live spreads exist, but none currently survive fees and scanner thresholds.'
                            : 'Try lowering your spread/profit filters or switching exchange scope.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((opp) => (
                        <div
                            key={opp.id}
                            className={`bg-slate-800/40 border rounded-sm p-5 transition-all duration-300 hover:border-slate-500 ${opp.status === 'VALID' ? 'border-green-800/30' : 'border-amber-800/30'
                                }`}
                        >
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                {/* Left: Exchange flow */}
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border ${getExchangeBadgeClass(opp.buyExchange)}`}>
                                            {EXCHANGE_LABELS[opp.buyExchange]}
                                        </span>
                                        <div className="text-center">
                                            <p className="text-[9px] font-mono text-slate-600 uppercase">Buy</p>
                                            <p className="text-sm font-mono text-slate-200 font-bold">{formatBTCPrice(opp.buyPrice)}</p>
                                        </div>
                                    </div>

                                    <ArrowRight size={20} className="text-cyan-500" />

                                    <div className="flex items-center gap-2">
                                        <div className="text-center">
                                            <p className="text-[9px] font-mono text-slate-600 uppercase">Sell</p>
                                            <p className="text-sm font-mono text-slate-200 font-bold">{formatBTCPrice(opp.sellPrice)}</p>
                                        </div>
                                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border ${getExchangeBadgeClass(opp.sellExchange)}`}>
                                            {EXCHANGE_LABELS[opp.sellExchange]}
                                        </span>
                                    </div>
                                </div>

                                {/* Right: Metrics */}
                                <div className="flex items-center gap-6">
                                    <div className="text-center">
                                        <p className="text-[9px] font-mono text-slate-600 uppercase">Spread</p>
                                        <p className="text-sm font-mono text-cyan-400 font-bold">{formatPercent(opp.spreadPercent, 3)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] font-mono text-slate-600 uppercase">Fees</p>
                                        <p className="text-sm font-mono text-amber-400">{formatCurrency(opp.totalFees)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] font-mono text-slate-600 uppercase">Net Profit</p>
                                        <p className={`text-sm font-mono font-bold ${opp.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {formatCurrency(opp.netProfit)}
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] font-mono text-slate-600 uppercase">Confidence</p>
                                        <p className="text-sm font-mono text-slate-300">{opp.confidence}%</p>
                                    </div>
                                    <StatusBadge status={opp.status} />
                                    <span className="text-[10px] font-mono text-slate-600">{formatTimeAgo(opp.detectedAt)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
