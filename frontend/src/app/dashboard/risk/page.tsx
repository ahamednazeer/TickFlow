'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    ShieldCheck,
    Pulse,
    Warning,
    Power,
    CurrencyDollar,
    Percent,
    ChartLineUp,
    Lightning,
} from '@phosphor-icons/react';
import { Exchange, EXCHANGE_LABELS, type RiskConfig, type RiskMetrics } from '@/lib/types';
import { formatPercent } from '@/lib/utils';
import { useCurrency } from '@/lib/currency';
import { api } from '@/lib/api';

export default function RiskPage() {
    const { currencyLabel, formatCurrency, convertFromUsd, convertToUsd } = useCurrency();
    const [config, setConfig] = useState<RiskConfig | null>(null);
    const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [riskConfig, riskMetrics] = await Promise.allSettled([
                api.getRiskConfig(),
                api.getRiskMetrics(),
            ]);

            if (riskConfig.status === 'fulfilled') setConfig(riskConfig.value);
            if (riskMetrics.status === 'fulfilled') setMetrics(riskMetrics.value);
        } catch (err) {
            console.error('Failed to fetch risk data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const saveConfig = async () => {
        if (!config) return;
        setSaving(true);
        try {
            await api.updateRiskConfig(config);
        } catch (err) {
            console.error('Failed to save config:', err);
        } finally {
            setSaving(false);
        }
    };

    const toggleKillSwitch = async () => {
        if (!config) return;
        const newState = !config.killSwitch;
        try {
            await api.toggleKillSwitch(newState);
            setConfig(prev => prev ? { ...prev, killSwitch: newState } : null);
        } catch (err) {
            console.error('Failed to toggle kill switch:', err);
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
                    Loading Risk Controls...
                </p>
            </div>
        );
    }

    const dailyLossPercent = metrics
        ? Math.abs(metrics.currentDailyPnL) / metrics.dailyLossLimit * 100
        : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-chivo font-bold uppercase tracking-wider flex items-center gap-3">
                        <ShieldCheck size={28} weight="duotone" className="text-cyan-400" />
                        Risk Management
                    </h1>
                    <p className="text-slate-500 mt-1 font-mono text-xs">Trade controls, limits, and safety mechanisms</p>
                </div>
                <button
                    onClick={saveConfig}
                    disabled={saving}
                    className="btn-primary"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {/* Kill Switch */}
            <div
                className={`border rounded-sm p-6 transition-all duration-300 ${
                    config?.killSwitch
                        ? 'bg-red-950/30 border-red-700 kill-switch-active'
                        : 'bg-slate-800/40 border-slate-700/60'
                }`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Power
                            size={32}
                            weight="duotone"
                            className={config?.killSwitch ? 'text-red-400' : 'text-green-400'}
                        />
                        <div>
                            <h3 className="text-lg font-chivo font-bold uppercase tracking-wider">
                                Emergency Kill Switch
                            </h3>
                            <p className="text-xs font-mono text-slate-500 mt-1">
                                {config?.killSwitch
                                    ? '⚠️ ALL TRADING IS HALTED — No new trades will be executed'
                                    : 'System is active — trades are being executed normally'
                                }
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={toggleKillSwitch}
                        className={`px-6 py-3 rounded-sm font-bold uppercase tracking-wider text-sm transition-all ${
                            config?.killSwitch
                                ? 'btn-success'
                                : 'btn-danger'
                        }`}
                    >
                        {config?.killSwitch ? 'Resume Trading' : 'Stop All Trading'}
                    </button>
                </div>
            </div>

            {/* Risk Metrics */}
            {metrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <CurrencyDollar size={16} className="text-slate-500" />
                            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Daily P&L</p>
                        </div>
                        <p className={`text-2xl font-mono font-bold ${metrics.currentDailyPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(metrics.currentDailyPnL)}
                        </p>
                        <div className="mt-2">
                            <div className="flex justify-between text-[10px] font-mono text-slate-600 mb-1">
                                <span>Loss Limit</span>
                                <span>{dailyLossPercent.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-1.5">
                                <div
                                    className={`h-1.5 rounded-full transition-all ${dailyLossPercent > 80 ? 'bg-red-500' : dailyLossPercent > 50 ? 'bg-amber-500' : 'bg-green-500'}`}
                                    style={{ width: `${Math.min(dailyLossPercent, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <Lightning size={16} className="text-slate-500" />
                            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Open Trades</p>
                        </div>
                        <p className="text-2xl font-mono font-bold text-slate-100">
                            {metrics.openTrades} / {metrics.maxOpenTrades}
                        </p>
                    </div>

                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <Percent size={16} className="text-slate-500" />
                            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Utilization</p>
                        </div>
                        <p className="text-2xl font-mono font-bold text-slate-100">
                            {formatPercent(metrics.utilizationPercent, 1)}
                        </p>
                    </div>

                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <ChartLineUp size={16} className="text-slate-500" />
                            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Volatility</p>
                        </div>
                        <p className={`text-2xl font-mono font-bold ${metrics.volatilityIndex > 0.7 ? 'text-red-400' : metrics.volatilityIndex > 0.4 ? 'text-amber-400' : 'text-green-400'}`}>
                            {(metrics.volatilityIndex * 100).toFixed(1)}%
                        </p>
                    </div>
                </div>
            )}

            {/* Configuration */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trade Limits */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-5">
                    <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Warning size={16} weight="duotone" className="text-amber-400" />
                        Trade Limits
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">Max Trade Size ({currencyLabel})</label>
                            <input
                                type="number"
                                value={config ? convertFromUsd(config.maxTradeSize) : 0}
                                onChange={(e) => setConfig(c => c ? { ...c, maxTradeSize: convertToUsd(parseFloat(e.target.value) || 0) } : null)}
                                className="input-modern"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">Max Daily Loss ({currencyLabel})</label>
                            <input
                                type="number"
                                value={config ? convertFromUsd(config.maxDailyLoss) : 0}
                                onChange={(e) => setConfig(c => c ? { ...c, maxDailyLoss: convertToUsd(parseFloat(e.target.value) || 0) } : null)}
                                className="input-modern"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">Max Open Trades</label>
                            <input
                                type="number"
                                value={config?.maxOpenTrades || 0}
                                onChange={(e) => setConfig(c => c ? { ...c, maxOpenTrades: parseInt(e.target.value) || 0 } : null)}
                                className="input-modern"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">Min Spread % (filter)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={config?.minSpreadPercent || 0}
                                onChange={(e) => setConfig(c => c ? { ...c, minSpreadPercent: parseFloat(e.target.value) || 0 } : null)}
                                className="input-modern"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">Min Confidence Score (%)</label>
                            <input
                                type="number"
                                value={config?.minConfidence || 0}
                                onChange={(e) => setConfig(c => c ? { ...c, minConfidence: parseInt(e.target.value) || 0 } : null)}
                                className="input-modern"
                            />
                        </div>
                    </div>
                </div>

                {/* Per-Exchange Allocation */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-5">
                    <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <CurrencyDollar size={16} weight="duotone" className="text-green-400" />
                        Capital Allocation per Exchange
                    </h3>
                    <div className="space-y-4">
                        {Object.values(Exchange).map(ex => (
                            <div key={ex}>
                                <label className="block text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">
                                    {EXCHANGE_LABELS[ex]} ({currencyLabel})
                                </label>
                                <input
                                    type="number"
                                    value={config ? convertFromUsd(config.perExchangeAllocation?.[ex] || 0) : 0}
                                    onChange={(e) => setConfig(c => c ? {
                                        ...c,
                                        perExchangeAllocation: {
                                            ...c.perExchangeAllocation,
                                            [ex]: convertToUsd(parseFloat(e.target.value) || 0),
                                        }
                                    } : null)}
                                    className="input-modern"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
