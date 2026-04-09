'use client';

import React, { useEffect, useState, useCallback } from 'react';
import OrderbookChart from '@/components/OrderbookChart';
import {
    Book,
    Pulse,
} from '@phosphor-icons/react';
import { Exchange, EXCHANGE_LABELS, type Orderbook } from '@/lib/types';
import { API_BASE_URL } from '@/lib/env';
import { formatNumber } from '@/lib/utils';
import { useCurrency } from '@/lib/currency';

export default function OrderbookPage() {
    const { formatBTCPrice } = useCurrency();
    const [orderbooks, setOrderbooks] = useState<Orderbook[]>([]);
    const [selectedExchange, setSelectedExchange] = useState<Exchange>(Exchange.BINANCE);
    const [loading, setLoading] = useState(true);

    const fetchOrderbooks = useCallback(async () => {
        try {
            // Orderbook data is currently read from the gateway REST view.
            const res = await fetch(`${API_BASE_URL}/api/market/orderbooks`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('tickflow_token')}`,
                },
            });
            if (res.ok) {
                const data = await res.json();
                setOrderbooks(data);
            }
        } catch (err) {
            console.error('Failed to fetch orderbooks:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrderbooks();
        const interval = setInterval(fetchOrderbooks, 3000);
        return () => clearInterval(interval);
    }, [fetchOrderbooks]);

    const activeOrderbook = orderbooks.find(ob => ob.exchange === selectedExchange);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-slate-700 border-t-cyan-500 animate-spin" />
                    <Pulse size={24} className="absolute inset-0 m-auto text-cyan-400 animate-pulse" />
                </div>
                <p className="text-slate-500 font-mono text-xs uppercase tracking-widest animate-pulse">
                    Loading Orderbooks...
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-chivo font-bold uppercase tracking-wider flex items-center gap-3">
                    <Book size={28} weight="duotone" className="text-cyan-400" />
                    Orderbook
                </h1>
                <p className="text-slate-500 mt-1 font-mono text-xs">Live orderbook depth across exchanges</p>
            </div>

            {/* Depth Chart */}
            <OrderbookChart orderbooks={orderbooks} selectedExchange={selectedExchange} />

            {/* Dual Orderbook View */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bids */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
                        <h3 className="text-sm font-mono text-green-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            Bids (Buy Orders)
                        </h3>
                        <select
                            value={selectedExchange}
                            onChange={(e) => setSelectedExchange(e.target.value as Exchange)}
                            className="input-modern max-w-[140px] text-xs py-1"
                        >
                            {Object.values(Exchange).map(ex => (
                                <option key={ex} value={ex}>{EXCHANGE_LABELS[ex]}</option>
                            ))}
                        </select>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-900/50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-[10px] font-mono text-slate-600 uppercase">Price</th>
                                    <th className="px-4 py-2 text-right text-[10px] font-mono text-slate-600 uppercase">Qty (BTC)</th>
                                    <th className="px-4 py-2 text-right text-[10px] font-mono text-slate-600 uppercase">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeOrderbook?.bids.slice(0, 20).map((level, i) => {
                                    const maxTotal = activeOrderbook.bids[activeOrderbook.bids.length - 1]?.total || 1;
                                    const widthPercent = (level.total / maxTotal) * 100;
                                    return (
                                        <tr key={i} className="relative hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-1.5 text-xs font-mono text-green-400 relative z-10">
                                                {formatBTCPrice(level.price)}
                                            </td>
                                            <td className="px-4 py-1.5 text-xs font-mono text-slate-300 text-right relative z-10">
                                                {formatNumber(level.quantity, 6)}
                                            </td>
                                            <td className="px-4 py-1.5 text-xs font-mono text-slate-400 text-right relative z-10">
                                                {formatNumber(level.total, 4)}
                                            </td>
                                            <td className="absolute inset-0 pointer-events-none">
                                                <div
                                                    className="h-full depth-bid"
                                                    style={{ width: `${widthPercent}%` }}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                                {(!activeOrderbook || activeOrderbook.bids.length === 0) && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-xs font-mono text-slate-600">
                                            No bid data available
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Asks */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-700/40">
                        <h3 className="text-sm font-mono text-red-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            Asks (Sell Orders)
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-900/50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-[10px] font-mono text-slate-600 uppercase">Price</th>
                                    <th className="px-4 py-2 text-right text-[10px] font-mono text-slate-600 uppercase">Qty (BTC)</th>
                                    <th className="px-4 py-2 text-right text-[10px] font-mono text-slate-600 uppercase">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeOrderbook?.asks.slice(0, 20).map((level, i) => {
                                    const maxTotal = activeOrderbook.asks[activeOrderbook.asks.length - 1]?.total || 1;
                                    const widthPercent = (level.total / maxTotal) * 100;
                                    return (
                                        <tr key={i} className="relative hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-1.5 text-xs font-mono text-red-400 relative z-10">
                                                {formatBTCPrice(level.price)}
                                            </td>
                                            <td className="px-4 py-1.5 text-xs font-mono text-slate-300 text-right relative z-10">
                                                {formatNumber(level.quantity, 6)}
                                            </td>
                                            <td className="px-4 py-1.5 text-xs font-mono text-slate-400 text-right relative z-10">
                                                {formatNumber(level.total, 4)}
                                            </td>
                                            <td className="absolute inset-0 pointer-events-none">
                                                <div
                                                    className="h-full depth-ask ml-auto"
                                                    style={{ width: `${widthPercent}%` }}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                                {(!activeOrderbook || activeOrderbook.asks.length === 0) && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-xs font-mono text-slate-600">
                                            No ask data available
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
