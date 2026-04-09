'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { ExchangeConnection } from '@/lib/types';
import { EXCHANGE_LABELS } from '@/lib/types';
import { formatLatency, formatTimeAgo } from '@/lib/utils';

interface ExchangeStatusProps {
    connections: ExchangeConnection[];
    className?: string;
}

export default function ExchangeStatus({ connections, className }: ExchangeStatusProps) {
    const getStatusDot = (status: string) => {
        switch (status) {
            case 'connected': return 'live-dot';
            case 'reconnecting': return 'live-dot live-dot-warn';
            case 'disconnected': return 'live-dot live-dot-error';
            case 'error': return 'live-dot live-dot-error';
            default: return 'live-dot live-dot-error';
        }
    };

    const getExchangeBadge = (exchange: string) => {
        switch (exchange) {
            case 'BINANCE': return 'exchange-binance';
            case 'KUCOIN': return 'exchange-kucoin';
            case 'OKX': return 'exchange-okx';
            case 'BYBIT': return 'exchange-bybit';
            default: return '';
        }
    };

    return (
        <div className={cn('bg-slate-800/40 border border-slate-700/60 rounded-sm p-5', className)}>
            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                Exchange Connections
            </h3>

            <div className="space-y-3">
                {connections.map((conn) => (
                    <div
                        key={conn.exchange}
                        className="bg-slate-900/50 border border-slate-800/50 rounded-sm px-4 py-3 hover:bg-slate-800/50 transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={getStatusDot(conn.status)} />
                                <span className={`text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${getExchangeBadge(conn.exchange)}`}>
                                    {EXCHANGE_LABELS[conn.exchange as keyof typeof EXCHANGE_LABELS] || conn.exchange}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-right">
                                <div>
                                    <p className="text-[10px] text-slate-600 font-mono uppercase">Latency</p>
                                    <p className="text-xs font-mono text-slate-300">{formatLatency(conn.latencyMs)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-600 font-mono uppercase">Msg/s</p>
                                    <p className="text-xs font-mono text-slate-300">{conn.messagesPerSecond}</p>
                                </div>
                                <div className="hidden sm:block">
                                    <p className="text-[10px] text-slate-600 font-mono uppercase">Heartbeat</p>
                                    <p className="text-xs font-mono text-slate-300">{formatTimeAgo(conn.lastHeartbeat)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
