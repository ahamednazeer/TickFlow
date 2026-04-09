'use client';

import React from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import type { PnLDataPoint } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';
import { useCurrency } from '@/lib/currency';

interface PnLChartProps {
    data: PnLDataPoint[];
    height?: number;
}

export default function PnLChart({ data, height = 300 }: PnLChartProps) {
    const { formatCurrency, currencySymbol, convertFromUsd } = useCurrency();
    if (data.length === 0) {
        return (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-5 flex items-center justify-center" style={{ height }}>
                <p className="text-slate-500 font-mono text-xs">No P&L data available</p>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: number }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 border border-slate-700 rounded-sm p-3 shadow-lg">
                    <p className="text-[10px] text-slate-500 font-mono mb-1">
                        {label ? formatDateTime(label) : ''}
                    </p>
                    <p className={`text-sm font-mono font-bold ${payload[0].value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(payload[0].value)}
                    </p>
                </div>
            );
        }
        return null;
    };

    const isProfit = data.length > 0 && data[data.length - 1].cumulative >= 0;

    return (
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-5">
            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isProfit ? 'bg-green-500' : 'bg-red-500'}`} />
                Cumulative P&L
            </h3>
            <ResponsiveContainer width="100%" height={height}>
                <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <defs>
                        <linearGradient id="pnlGradientGreen" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="pnlGradientRed" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                        dataKey="timestamp"
                        tickFormatter={(ts) => {
                            const d = new Date(ts);
                            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                        }}
                        stroke="#475569"
                        tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: '#64748b' }}
                        axisLine={{ stroke: '#334155' }}
                    />
                    <YAxis
                        tickFormatter={(v) => `${currencySymbol}${convertFromUsd(v).toFixed(0)}`}
                        stroke="#475569"
                        tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: '#64748b' }}
                        axisLine={{ stroke: '#334155' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                        type="monotone"
                        dataKey="cumulative"
                        stroke={isProfit ? '#22c55e' : '#ef4444'}
                        strokeWidth={2}
                        fill={isProfit ? 'url(#pnlGradientGreen)' : 'url(#pnlGradientRed)'}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
