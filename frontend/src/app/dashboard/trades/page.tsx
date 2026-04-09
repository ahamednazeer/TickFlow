'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import {
    ArrowsLeftRight,
    Pulse,
    FunnelSimple,
} from '@phosphor-icons/react';
import { Exchange, EXCHANGE_LABELS, type Trade } from '@/lib/types';
import { formatLatency, formatDateTime } from '@/lib/utils';
import { useCurrency } from '@/lib/currency';
import { api } from '@/lib/api';

export default function TradesPage() {
    const { formatCurrency, formatBTCPrice } = useCurrency();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(0);
    const pageSize = 20;

    const fetchTrades = useCallback(async () => {
        try {
            const data = await api.getTrades({
                limit: pageSize,
                offset: page * pageSize,
                status: statusFilter || undefined,
            });
            setTrades(data.trades);
            setTotal(data.total);
        } catch (err) {
            console.error('Failed to fetch trades:', err);
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter]);

    useEffect(() => {
        fetchTrades();
    }, [fetchTrades]);

    const columns = [
        {
            key: 'createdAt' as keyof Trade,
            label: 'Time',
            render: (trade: Trade) => (
                <span className="text-xs font-mono text-slate-400">{formatDateTime(trade.createdAt)}</span>
            ),
        },
        {
            key: 'symbol' as keyof Trade,
            label: 'Pair',
            render: (trade: Trade) => (
                <span className="text-xs font-mono text-slate-200 font-bold">{trade.symbol}</span>
            ),
        },
        {
            key: 'buyExchange' as keyof Trade,
            label: 'Buy',
            render: (trade: Trade) => (
                <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border exchange-binance">
                        {EXCHANGE_LABELS[trade.buyExchange] || trade.buyExchange}
                    </span>
                    <p className="text-xs font-mono text-slate-400 mt-1">{formatBTCPrice(trade.buyPrice)}</p>
                </div>
            ),
        },
        {
            key: 'sellExchange' as keyof Trade,
            label: 'Sell',
            render: (trade: Trade) => (
                <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border exchange-kucoin">
                        {EXCHANGE_LABELS[trade.sellExchange] || trade.sellExchange}
                    </span>
                    <p className="text-xs font-mono text-slate-400 mt-1">{formatBTCPrice(trade.sellPrice)}</p>
                </div>
            ),
        },
        {
            key: 'quantity' as keyof Trade,
            label: 'Size',
            align: 'right' as const,
            render: (trade: Trade) => (
                <span className="text-xs font-mono text-slate-300">{trade.quantity.toFixed(6)} BTC</span>
            ),
        },
        {
            key: 'totalFees' as keyof Trade,
            label: 'Fees',
            align: 'right' as const,
            render: (trade: Trade) => (
                <span className="text-xs font-mono text-amber-400">{formatCurrency(trade.totalFees)}</span>
            ),
        },
        {
            key: 'netProfit' as keyof Trade,
            label: 'Net P&L',
            align: 'right' as const,
            render: (trade: Trade) => (
                <span className={`text-xs font-mono font-bold ${trade.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trade.netProfit >= 0 ? '+' : ''}{formatCurrency(trade.netProfit)}
                </span>
            ),
        },
        {
            key: 'executionTimeMs' as keyof Trade,
            label: 'Latency',
            align: 'right' as const,
            render: (trade: Trade) => (
                <span className="text-xs font-mono text-slate-400">{formatLatency(trade.executionTimeMs)}</span>
            ),
        },
        {
            key: 'status' as keyof Trade,
            label: 'Status',
            render: (trade: Trade) => <StatusBadge status={trade.status} />,
        },
    ];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-slate-700 border-t-cyan-500 animate-spin" />
                    <Pulse size={24} className="absolute inset-0 m-auto text-cyan-400 animate-pulse" />
                </div>
                <p className="text-slate-500 font-mono text-xs uppercase tracking-widest animate-pulse">
                    Loading Trades...
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
                        <ArrowsLeftRight size={28} weight="duotone" className="text-cyan-400" />
                        Trade History
                    </h1>
                    <p className="text-slate-500 mt-1 font-mono text-xs">{total} total trades executed</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-4 flex items-center gap-4">
                <FunnelSimple size={16} className="text-slate-500" />
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
                    className="input-modern max-w-xs"
                >
                    <option value="">All Statuses</option>
                    <option value="FILLED">Filled</option>
                    <option value="PARTIAL">Partial</option>
                    <option value="FAILED">Failed</option>
                    <option value="CANCELLED">Cancelled</option>
                </select>
            </div>

            {/* Table */}
            <DataTable
                data={trades}
                columns={columns}
                emptyMessage="No trades found"
                maxHeight="600px"
            />

            {/* Pagination */}
            {total > pageSize && (
                <div className="flex items-center justify-between">
                    <p className="text-xs font-mono text-slate-500">
                        Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="btn-secondary text-xs disabled:opacity-30"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={(page + 1) * pageSize >= total}
                            className="btn-secondary text-xs disabled:opacity-30"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
