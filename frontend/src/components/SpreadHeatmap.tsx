'use client';

import React from 'react';
import { Exchange, EXCHANGE_LABELS, type TickerData } from '@/lib/types';
import { formatPercent } from '@/lib/utils';

interface SpreadHeatmapProps {
    tickers: TickerData[];
}

export default function SpreadHeatmap({ tickers }: SpreadHeatmapProps) {
    const exchanges = Object.values(Exchange);

    const getSpread = (buyExchange: Exchange, sellExchange: Exchange): number | null => {
        if (buyExchange === sellExchange) return null;
        const buyTicker = tickers.find(t => t.exchange === buyExchange);
        const sellTicker = tickers.find(t => t.exchange === sellExchange);
        if (!buyTicker || !sellTicker) return null;
        return ((sellTicker.bid - buyTicker.ask) / buyTicker.ask) * 100;
    };

    const getCellColor = (spread: number | null): string => {
        if (spread === null) return 'bg-slate-900/50';
        if (spread > 0.1) return 'bg-green-900/40 border-green-700/30';
        if (spread > 0.05) return 'bg-green-900/20 border-green-800/20';
        if (spread > 0) return 'bg-green-950/30 border-green-900/10';
        if (spread > -0.05) return 'bg-red-950/20 border-red-900/10';
        return 'bg-red-900/30 border-red-800/20';
    };

    const getTextColor = (spread: number | null): string => {
        if (spread === null) return 'text-slate-700';
        if (spread > 0.05) return 'text-green-400';
        if (spread > 0) return 'text-green-500/70';
        if (spread > -0.05) return 'text-red-500/70';
        return 'text-red-400';
    };

    return (
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-5 relative overflow-hidden">
            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                Cross-Exchange Spread Matrix
            </h3>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr>
                            <th className="text-[10px] font-mono text-slate-600 uppercase tracking-wider p-2 text-left">
                                Buy ↓ / Sell →
                            </th>
                            {exchanges.map(ex => (
                                <th key={ex} className="text-[10px] font-mono text-slate-500 uppercase tracking-wider p-2 text-center">
                                    {EXCHANGE_LABELS[ex]}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {exchanges.map(buyEx => (
                            <tr key={buyEx}>
                                <td className="text-[10px] font-mono text-slate-500 uppercase tracking-wider p-2">
                                    {EXCHANGE_LABELS[buyEx]}
                                </td>
                                {exchanges.map(sellEx => {
                                    const spread = getSpread(buyEx, sellEx);
                                    return (
                                        <td key={sellEx} className="p-1">
                                            <div
                                                className={`text-center rounded-sm py-2 px-3 border transition-all duration-300 ${getCellColor(spread)} ${buyEx === sellEx ? 'opacity-20' : 'hover:scale-105'}`}
                                            >
                                                <span className={`text-xs font-mono font-bold ${getTextColor(spread)}`}>
                                                    {spread !== null ? formatPercent(spread, 3) : '—'}
                                                </span>
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 text-[10px] font-mono text-slate-500">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-green-900/40 border border-green-700/30" />
                    <span>Profitable</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-red-900/30 border border-red-800/20" />
                    <span>Loss</span>
                </div>
            </div>
        </div>
    );
}
