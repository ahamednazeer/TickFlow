import React from 'react';
import { cn } from '@/lib/utils';

interface DataCardProps {
    title: string;
    value: string | number;
    icon?: React.ElementType;
    change?: string;
    changeType?: 'positive' | 'negative' | 'neutral';
    subtitle?: string;
    className?: string;
    glowColor?: string;
}

export function DataCard({
    title,
    value,
    icon: Icon,
    change,
    changeType = 'neutral',
    subtitle,
    className = '',
    glowColor,
}: DataCardProps) {
    const changeColorClass = {
        positive: 'text-green-400',
        negative: 'text-red-400',
        neutral: 'text-slate-400',
    }[changeType];

    return (
        <div
            className={cn(
                'bg-slate-800/40 border border-slate-700/60 rounded-sm p-6 transition-all duration-200 hover:border-slate-500 relative overflow-hidden',
                className
            )}
            style={glowColor ? { boxShadow: `0 0 30px ${glowColor}15` } : undefined}
        >
            {/* Subtle gradient overlay */}
            {glowColor && (
                <div
                    className="absolute inset-0 opacity-5"
                    style={{ background: `radial-gradient(circle at top right, ${glowColor}, transparent 70%)` }}
                />
            )}

            <div className="flex items-start justify-between relative z-10">
                <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wider font-mono mb-2">{title}</p>
                    <p className="text-3xl font-bold font-mono text-slate-100">{value}</p>
                    {change && (
                        <p className={`text-xs font-mono mt-1 ${changeColorClass}`}>{change}</p>
                    )}
                    {subtitle && (
                        <p className="text-xs text-slate-500 font-mono mt-1">{subtitle}</p>
                    )}
                </div>
                {Icon && (
                    <div className="text-cyan-400 opacity-60">
                        <Icon size={28} weight="duotone" />
                    </div>
                )}
            </div>
        </div>
    );
}
