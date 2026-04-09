'use client';

import React, { useState } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import { Exchange, EXCHANGE_LABELS, type Orderbook } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import { useCurrency } from '@/lib/currency';

interface OrderbookChartProps {
    orderbooks: Orderbook[];
    selectedExchange?: Exchange;
}

export default function OrderbookChart({ orderbooks, selectedExchange }: OrderbookChartProps) {
    const { formatBTCPrice } = useCurrency();
    const [activeExchange, setActiveExchange] = useState<Exchange>(selectedExchange || Exchange.BINANCE);

    const orderbook = orderbooks.find(ob => ob.exchange === activeExchange);

    if (!orderbook || (orderbook.bids.length === 0 && orderbook.asks.length === 0)) {
        return (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-5">
                <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4">Orderbook Depth</h3>
                <div className="flex items-center justify-center h-64">
                    <p className="text-slate-500 font-mono text-xs">Waiting for orderbook data...</p>
                </div>
            </div>
        );
    }

    // Prepare depth data
    const depthData = [
        ...orderbook.bids.slice(0, 15).reverse().map(level => ({
            price: level.price,
            bid: level.total,
            ask: 0,
        })),
        ...orderbook.asks.slice(0, 15).map(level => ({
            price: level.price,
            bid: 0,
            ask: level.total,
        })),
    ];

    const midPrice = orderbook.bids.length > 0 && orderbook.asks.length > 0
        ? (orderbook.bids[0].price + orderbook.asks[0].price) / 2
        : 0;

    const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; payload: { price: number } }> }) => {
        if (active && payload && payload.length) {
            const p = payload[0];
            return (
                <div className="bg-slate-900 border border-slate-700 rounded-sm p-3 shadow-lg">
                    <p className="text-[10px] text-slate-500 font-mono mb-1">
                        Price: {formatBTCPrice(p.payload.price)}
                    </p>
                    <p className={`text-sm font-mono font-bold ${p.dataKey === 'bid' ? 'text-green-400' : 'text-red-400'}`}>
                        Vol: {formatNumber(p.value, 4)} BTC
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-500" />
                    Orderbook Depth
                </h3>
                <div className="flex gap-1">
                    {Object.values(Exchange).map(ex => (
                        <button
                            key={ex}
                            onClick={() => setActiveExchange(ex)}
                            className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-sm border transition-all ${
                                activeExchange === ex
                                    ? 'bg-cyan-950/50 border-cyan-700 text-cyan-400'
                                    : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500'
                            }`}
                        >
                            {EXCHANGE_LABELS[ex]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Spread indicator */}
            {orderbook.bids.length > 0 && orderbook.asks.length > 0 && (
                <div className="flex items-center justify-center gap-4 mb-3 py-2 bg-slate-900/50 rounded-sm">
                    <span className="text-xs font-mono text-green-400">
                        Bid: {formatBTCPrice(orderbook.bids[0].price)}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                        Spread: {formatBTCPrice(orderbook.asks[0].price - orderbook.bids[0].price)}
                    </span>
                    <span className="text-xs font-mono text-red-400">
                        Ask: {formatBTCPrice(orderbook.asks[0].price)}
                    </span>
                </div>
            )}

            <ResponsiveContainer width="100%" height={280}>
                <BarChart data={depthData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                        dataKey="price"
                        tickFormatter={(price) => `${(price / 1000).toFixed(1)}k`}
                        stroke="#475569"
                        tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#64748b' }}
                    />
                    <YAxis
                        stroke="#475569"
                        tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#64748b' }}
                        tickFormatter={(v) => `${v.toFixed(2)}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {midPrice > 0 && (
                        <ReferenceLine x={midPrice} stroke="#06b6d4" strokeDasharray="3 3" strokeWidth={1} />
                    )}
                    <Bar dataKey="bid" fill="#22c55e" fillOpacity={0.6} />
                    <Bar dataKey="ask" fill="#ef4444" fillOpacity={0.6} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
