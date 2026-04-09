'use client';

import React from 'react';
import { Exchange, EXCHANGE_LABELS, type TickerData } from '@/lib/types';
import { formatPercent } from '@/lib/utils';
import { useCurrency } from '@/lib/currency';

interface PriceTickerBarProps {
    tickers: TickerData[];
}

export default function PriceTickerBar({ tickers }: PriceTickerBarProps) {
    const { formatBTCPrice } = useCurrency();
    const getExchangeClass = (exchange: Exchange) => {
        switch (exchange) {
            case Exchange.BINANCE: return 'exchange-binance';
            case Exchange.KUCOIN: return 'exchange-kucoin';
            case Exchange.OKX: return 'exchange-okx';
            case Exchange.BYBIT: return 'exchange-bybit';
            default: return '';
        }
    };

    if (tickers.length === 0) {
        return (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-4">
                <p className="text-slate-500 font-mono text-xs text-center">Waiting for price data...</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm overflow-hidden">
            <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-700/40">
                <div className="live-dot" />
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Live Prices</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-700/40">
                {tickers.map((ticker) => (
                    <div
                        key={ticker.exchange}
                        className="px-4 py-3 hover:bg-slate-800/30 transition-colors"
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${getExchangeClass(ticker.exchange)}`}>
                                {EXCHANGE_LABELS[ticker.exchange]}
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-lg font-mono font-bold text-slate-100">
                                {formatBTCPrice(ticker.lastPrice)}
                            </span>
                            <span className={`text-xs font-mono ${ticker.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formatPercent(ticker.change24h, 2)}
                            </span>
                        </div>
                        <div className="flex gap-3 mt-1">
                            <span className="text-[10px] font-mono text-green-400/70">
                                B: {formatBTCPrice(ticker.bid)}
                            </span>
                            <span className="text-[10px] font-mono text-red-400/70">
                                A: {formatBTCPrice(ticker.ask)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
