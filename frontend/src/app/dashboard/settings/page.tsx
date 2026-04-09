'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    GearSix,
    Pulse,
    Key,
    TestTube,
    Eye,
    EyeSlash,
    CheckCircle,
    XCircle,
} from '@phosphor-icons/react';
import { StatusBadge } from '@/components/StatusBadge';
import { Exchange, EXCHANGE_LABELS, type ExchangeConfig } from '@/lib/types';
import { formatLatency } from '@/lib/utils';
import { useCurrency } from '@/lib/currency';
import { useScannerPreferences } from '@/lib/scanner-preferences';
import { api } from '@/lib/api';

export default function SettingsPage() {
    const { currency, setCurrency, usdInrRate, setUsdInrRate } = useCurrency();
    const { viewMode, minSpread, minProfit, setViewMode, setMinSpread, setMinProfit } = useScannerPreferences();
    const [configs, setConfigs] = useState<ExchangeConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [testResults, setTestResults] = useState<Record<string, { success: boolean; latencyMs: number } | null>>({});
    const [testing, setTesting] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState<Record<string, boolean>>({});

    const fetchConfigs = useCallback(async () => {
        try {
            const data = await api.getExchangeConfigs();
            setConfigs(data);
        } catch (err) {
            console.error('Failed to fetch configs:', err);
            // Initialize with empty configs for all exchanges
            setConfigs(Object.values(Exchange).map(ex => ({
                exchange: ex,
                apiKey: '',
                apiSecret: '',
                passphrase: '',
                enabled: false,
                testMode: true,
            })));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfigs();
    }, [fetchConfigs]);

    const updateConfig = (exchange: Exchange, field: keyof ExchangeConfig, value: string | boolean) => {
        setConfigs(prev => prev.map(c =>
            c.exchange === exchange ? { ...c, [field]: value } : c
        ));
    };

    const saveConfig = async (config: ExchangeConfig) => {
        setSaving(prev => ({ ...prev, [config.exchange]: true }));
        try {
            await api.updateExchangeConfig(config);
        } catch (err) {
            console.error('Failed to save config:', err);
        } finally {
            setSaving(prev => ({ ...prev, [config.exchange]: false }));
        }
    };

    const testConnection = async (exchange: Exchange) => {
        setTesting(prev => ({ ...prev, [exchange]: true }));
        setTestResults(prev => ({ ...prev, [exchange]: null }));
        try {
            const result = await api.testExchangeConnection(exchange);
            setTestResults(prev => ({ ...prev, [exchange]: result }));
        } catch {
            setTestResults(prev => ({ ...prev, [exchange]: { success: false, latencyMs: 0 } }));
        } finally {
            setTesting(prev => ({ ...prev, [exchange]: false }));
        }
    };

    const getExchangeBadge = (exchange: Exchange) => {
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
                    Loading Settings...
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-chivo font-bold uppercase tracking-wider flex items-center gap-3">
                    <GearSix size={28} weight="duotone" className="text-cyan-400" />
                    Settings
                </h1>
                <p className="text-slate-500 mt-1 font-mono text-xs">Exchange API configuration & connection management</p>
            </div>

            {/* Warning */}
            <div className="bg-amber-950/30 border border-amber-800/50 rounded-sm p-4 flex items-start gap-3">
                <Key size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-mono text-amber-400 font-bold uppercase">API Key Security</p>
                    <p className="text-xs font-mono text-amber-400/70 mt-1">
                        API keys are encrypted and stored securely. Never share your API secrets.
                        Enable IP whitelisting on your exchange accounts for maximum security.
                    </p>
                </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-5">
                <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4">Display Currency</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">Currency</label>
                        <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value as 'USD' | 'INR')}
                            className="input-modern"
                        >
                            <option value="USD">USD</option>
                            <option value="INR">INR</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">USD to INR Rate</label>
                        <input
                            type="number"
                            step="0.01"
                            value={usdInrRate}
                            onChange={(e) => setUsdInrRate(parseFloat(e.target.value) || usdInrRate)}
                            className="input-modern"
                        />
                        <p className="text-[10px] font-mono text-slate-600 mt-1">
                            Backend values remain in USD. INR display uses this conversion rate locally.
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-5">
                <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4">Scanner Display</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">Default View</label>
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
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">Min Profit ({currency})</label>
                        <input
                            type="number"
                            step="1"
                            value={minProfit}
                            onChange={(e) => setMinProfit(parseFloat(e.target.value) || 0)}
                            className="input-modern"
                        />
                    </div>
                </div>
                <p className="text-[10px] font-mono text-slate-600 mt-3">
                    These settings only change what the dashboard shows. Execution still only acts on backend opportunities marked VALID.
                </p>
            </div>

            {/* Exchange Configurations */}
            <div className="space-y-4">
                {configs.map((config) => (
                    <div
                        key={config.exchange}
                        className={`bg-slate-800/40 border rounded-sm p-6 transition-all ${
                            config.enabled ? 'border-slate-600' : 'border-slate-700/60 opacity-80'
                        }`}
                    >
                        {/* Exchange Header */}
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <span className={`text-xs font-mono uppercase tracking-wider px-2.5 py-1 rounded border ${getExchangeBadge(config.exchange)}`}>
                                    {EXCHANGE_LABELS[config.exchange]}
                                </span>
                                <StatusBadge status={config.enabled ? 'ACTIVE' : 'INACTIVE'} />
                                {config.testMode && (
                                    <span className="text-[10px] font-mono text-amber-400 bg-amber-950/50 border border-amber-800 px-2 py-0.5 rounded">
                                        TESTNET
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Test Connection */}
                                <button
                                    onClick={() => testConnection(config.exchange)}
                                    disabled={testing[config.exchange]}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-700 rounded-sm transition-all disabled:opacity-50"
                                >
                                    <TestTube size={14} />
                                    {testing[config.exchange] ? 'Testing...' : 'Test'}
                                </button>
                                {/* Save */}
                                <button
                                    onClick={() => saveConfig(config)}
                                    disabled={saving[config.exchange]}
                                    className="btn-primary text-xs py-1.5"
                                >
                                    {saving[config.exchange] ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>

                        {/* Test Result */}
                        {testResults[config.exchange] && (
                            <div className={`mb-4 p-3 rounded-sm border text-xs font-mono flex items-center gap-2 ${
                                testResults[config.exchange]!.success
                                    ? 'bg-green-950/30 border-green-800/50 text-green-400'
                                    : 'bg-red-950/30 border-red-800/50 text-red-400'
                            }`}>
                                {testResults[config.exchange]!.success ? (
                                    <>
                                        <CheckCircle size={16} weight="fill" />
                                        Connection successful — Latency: {formatLatency(testResults[config.exchange]!.latencyMs)}
                                    </>
                                ) : (
                                    <>
                                        <XCircle size={16} weight="fill" />
                                        Connection failed — Check your API credentials
                                    </>
                                )}
                            </div>
                        )}

                        {/* Config Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">API Key</label>
                                <div className="relative">
                                    <input
                                        type={showSecrets[`${config.exchange}_key`] ? 'text' : 'password'}
                                        value={config.apiKey}
                                        onChange={(e) => updateConfig(config.exchange, 'apiKey', e.target.value)}
                                        className="input-modern pr-10"
                                        placeholder="Enter API key"
                                    />
                                    <button
                                        onClick={() => setShowSecrets(s => ({ ...s, [`${config.exchange}_key`]: !s[`${config.exchange}_key`] }))}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                    >
                                        {showSecrets[`${config.exchange}_key`] ? <EyeSlash size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">API Secret</label>
                                <div className="relative">
                                    <input
                                        type={showSecrets[`${config.exchange}_secret`] ? 'text' : 'password'}
                                        value={config.apiSecret}
                                        onChange={(e) => updateConfig(config.exchange, 'apiSecret', e.target.value)}
                                        className="input-modern pr-10"
                                        placeholder="Enter API secret"
                                    />
                                    <button
                                        onClick={() => setShowSecrets(s => ({ ...s, [`${config.exchange}_secret`]: !s[`${config.exchange}_secret`] }))}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                    >
                                        {showSecrets[`${config.exchange}_secret`] ? <EyeSlash size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            {(config.exchange === Exchange.KUCOIN || config.exchange === Exchange.OKX) && (
                                <div>
                                    <label className="block text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">Passphrase</label>
                                    <div className="relative">
                                        <input
                                            type={showSecrets[`${config.exchange}_pass`] ? 'text' : 'password'}
                                            value={config.passphrase || ''}
                                            onChange={(e) => updateConfig(config.exchange, 'passphrase', e.target.value)}
                                            className="input-modern pr-10"
                                            placeholder="Enter passphrase"
                                        />
                                        <button
                                            onClick={() => setShowSecrets(s => ({ ...s, [`${config.exchange}_pass`]: !s[`${config.exchange}_pass`] }))}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                        >
                                            {showSecrets[`${config.exchange}_pass`] ? <EyeSlash size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Toggles */}
                        <div className="flex gap-6 mt-4 pt-4 border-t border-slate-700/40">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.enabled}
                                    onChange={(e) => updateConfig(config.exchange, 'enabled', e.target.checked)}
                                    className="w-4 h-4 rounded-sm bg-slate-950 border-slate-700 text-cyan-500 focus:ring-cyan-500"
                                />
                                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Enabled</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.testMode}
                                    onChange={(e) => updateConfig(config.exchange, 'testMode', e.target.checked)}
                                    className="w-4 h-4 rounded-sm bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500"
                                />
                                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Test Mode (Sandbox)</span>
                            </label>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
