'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ScannerViewMode = 'profitable_only' | 'show_detected';

const STORAGE_VIEW_MODE_KEY = 'tickflow.scanner.viewMode';
const STORAGE_MIN_SPREAD_KEY = 'tickflow.scanner.minSpread';
const STORAGE_MIN_PROFIT_KEY = 'tickflow.scanner.minProfit';

type ScannerPreferencesContextValue = {
    viewMode: ScannerViewMode;
    minSpread: number;
    minProfit: number;
    setViewMode: (mode: ScannerViewMode) => void;
    setMinSpread: (value: number) => void;
    setMinProfit: (value: number) => void;
};

const ScannerPreferencesContext = createContext<ScannerPreferencesContextValue | null>(null);

export function ScannerPreferencesProvider({ children }: { children: React.ReactNode }) {
    const [viewMode, setViewModeState] = useState<ScannerViewMode>('profitable_only');
    const [minSpread, setMinSpreadState] = useState(0);
    const [minProfit, setMinProfitState] = useState(0);

    useEffect(() => {
        const storedViewMode = window.localStorage.getItem(STORAGE_VIEW_MODE_KEY);
        const storedMinSpread = window.localStorage.getItem(STORAGE_MIN_SPREAD_KEY);
        const storedMinProfit = window.localStorage.getItem(STORAGE_MIN_PROFIT_KEY);

        if (storedViewMode === 'profitable_only' || storedViewMode === 'show_detected') {
            setViewModeState(storedViewMode);
        }

        if (storedMinSpread) {
            const parsed = Number.parseFloat(storedMinSpread);
            if (Number.isFinite(parsed) && parsed >= 0) {
                setMinSpreadState(parsed);
            }
        }

        if (storedMinProfit) {
            const parsed = Number.parseFloat(storedMinProfit);
            if (Number.isFinite(parsed) && parsed >= 0) {
                setMinProfitState(parsed);
            }
        }
    }, []);

    const value = useMemo<ScannerPreferencesContextValue>(() => ({
        viewMode,
        minSpread,
        minProfit,
        setViewMode: (mode) => {
            setViewModeState(mode);
            window.localStorage.setItem(STORAGE_VIEW_MODE_KEY, mode);
        },
        setMinSpread: (value) => {
            const next = Number.isFinite(value) && value >= 0 ? value : 0;
            setMinSpreadState(next);
            window.localStorage.setItem(STORAGE_MIN_SPREAD_KEY, String(next));
        },
        setMinProfit: (value) => {
            const next = Number.isFinite(value) && value >= 0 ? value : 0;
            setMinProfitState(next);
            window.localStorage.setItem(STORAGE_MIN_PROFIT_KEY, String(next));
        },
    }), [viewMode, minSpread, minProfit]);

    return <ScannerPreferencesContext.Provider value={value}>{children}</ScannerPreferencesContext.Provider>;
}

export function useScannerPreferences() {
    const context = useContext(ScannerPreferencesContext);
    if (!context) {
        throw new Error('useScannerPreferences must be used within ScannerPreferencesProvider');
    }
    return context;
}
