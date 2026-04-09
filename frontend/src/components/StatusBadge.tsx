import React from 'react';

interface StatusBadgeProps {
    status: string;
    className?: string;
}

const statusStyles: Record<string, string> = {
    // Connection status
    CONNECTED: 'text-green-400 bg-green-950/50 border-green-800',
    RECONNECTING: 'text-yellow-400 bg-yellow-950/50 border-yellow-800',
    DISCONNECTED: 'text-red-400 bg-red-950/50 border-red-800',
    ERROR: 'text-red-400 bg-red-950/50 border-red-800',

    // Trade status
    PENDING: 'text-yellow-400 bg-yellow-950/50 border-yellow-800',
    EXECUTING: 'text-blue-400 bg-blue-950/50 border-blue-800',
    FILLED: 'text-green-400 bg-green-950/50 border-green-800',
    PARTIAL: 'text-amber-400 bg-amber-950/50 border-amber-800',
    FAILED: 'text-red-400 bg-red-950/50 border-red-800',
    CANCELLED: 'text-slate-400 bg-slate-950/50 border-slate-800',

    // Opportunity status
    DETECTED: 'text-cyan-400 bg-cyan-950/50 border-cyan-800',
    VALIDATING: 'text-blue-400 bg-blue-950/50 border-blue-800',
    VALID: 'text-green-400 bg-green-950/50 border-green-800',
    EXPIRED: 'text-slate-400 bg-slate-950/50 border-slate-800',
    EXECUTED: 'text-green-400 bg-green-950/50 border-green-800',

    // Generic
    ACTIVE: 'text-green-400 bg-green-950/50 border-green-800',
    INACTIVE: 'text-red-400 bg-red-950/50 border-red-800',
    SUCCESS: 'text-green-400 bg-green-950/50 border-green-800',
    ONLINE: 'text-green-400 bg-green-950/50 border-green-800',
    OFFLINE: 'text-red-400 bg-red-950/50 border-red-800',
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
    const style = statusStyles[status.toUpperCase()] || 'text-slate-400 bg-slate-950/50 border-slate-800';

    return (
        <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${style} ${className}`}
        >
            {status === 'CONNECTED' || status === 'FILLED' || status === 'VALID' || status === 'ACTIVE' || status === 'ONLINE' ? (
                <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
            ) : null}
            {status.replace(/_/g, ' ')}
        </span>
    );
}
