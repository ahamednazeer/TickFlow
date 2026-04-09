'use client';

import React from 'react';
import { getLatencyColor, formatLatency } from '@/lib/utils';

interface LatencyGaugeProps {
    value: number; // milliseconds
    label?: string;
    size?: number;
}

export default function LatencyGauge({ value, label = 'System Latency', size = 120 }: LatencyGaugeProps) {
    const color = getLatencyColor(value);
    const maxMs = 500;
    const normalizedValue = Math.min(value / maxMs, 1);
    const angle = normalizedValue * 180;

    // SVG arc path
    const radius = (size / 2) - 8;
    const centerX = size / 2;
    const centerY = size / 2;

    const startAngle = -180;
    const endAngle = startAngle + angle;

    const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
        const angleRad = (angleDeg * Math.PI) / 180;
        return {
            x: cx + r * Math.cos(angleRad),
            y: cy + r * Math.sin(angleRad),
        };
    };

    const start = polarToCartesian(centerX, centerY, radius, startAngle);
    const end = polarToCartesian(centerX, centerY, radius, endAngle);
    const largeArcFlag = angle > 180 ? 1 : 0;

    const arcPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
    const bgPath = `M ${polarToCartesian(centerX, centerY, radius, -180).x} ${polarToCartesian(centerX, centerY, radius, -180).y} A ${radius} ${radius} 0 1 1 ${polarToCartesian(centerX, centerY, radius, 0).x} ${polarToCartesian(centerX, centerY, radius, 0).y}`;

    return (
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-5 flex flex-col items-center">
            <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">{label}</h3>
            <div className="relative" style={{ width: size, height: size / 2 + 20 }}>
                <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
                    {/* Background arc */}
                    <path
                        d={bgPath}
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth={6}
                        strokeLinecap="round"
                    />
                    {/* Value arc */}
                    {value > 0 && (
                        <path
                            d={arcPath}
                            fill="none"
                            stroke={color}
                            strokeWidth={6}
                            strokeLinecap="round"
                            style={{
                                filter: `drop-shadow(0 0 6px ${color}50)`,
                                transition: 'all 0.5s ease',
                            }}
                        />
                    )}
                </svg>
                {/* Center value */}
                <div className="absolute inset-x-0 bottom-0 text-center">
                    <span className="text-xl font-mono font-bold" style={{ color }}>
                        {formatLatency(value)}
                    </span>
                </div>
            </div>
            {/* Scale labels */}
            <div className="flex justify-between w-full mt-1 px-1">
                <span className="text-[9px] font-mono text-slate-600">0ms</span>
                <span className="text-[9px] font-mono text-slate-600">250ms</span>
                <span className="text-[9px] font-mono text-slate-600">500ms</span>
            </div>
        </div>
    );
}
