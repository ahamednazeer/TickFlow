'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type DisplayCurrency = 'USD' | 'INR';

const STORAGE_CURRENCY_KEY = 'tickflow.displayCurrency';
const STORAGE_USD_INR_RATE_KEY = 'tickflow.usdInrRate';
const DEFAULT_USD_INR_RATE = 83.5;

type CurrencyContextValue = {
    currency: DisplayCurrency;
    usdInrRate: number;
    setCurrency: (currency: DisplayCurrency) => void;
    setUsdInrRate: (rate: number) => void;
    convertFromUsd: (value: number) => number;
    convertToUsd: (value: number) => number;
    formatCurrency: (value: number, decimals?: number) => string;
    formatBTCPrice: (value: number) => string;
    currencyLabel: string;
    currencySymbol: string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function toDisplayCurrency(value: number, currency: DisplayCurrency, usdInrRate: number): number {
    return currency === 'INR' ? value * usdInrRate : value;
}

function toUsd(value: number, currency: DisplayCurrency, usdInrRate: number): number {
    return currency === 'INR' ? value / usdInrRate : value;
}

function formatByCurrency(value: number, currency: DisplayCurrency, usdInrRate: number, decimals = 2): string {
    const displayValue = toDisplayCurrency(value, currency, usdInrRate);
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(displayValue);
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
    const [currency, setCurrencyState] = useState<DisplayCurrency>('USD');
    const [usdInrRate, setUsdInrRateState] = useState<number>(DEFAULT_USD_INR_RATE);

    useEffect(() => {
        const storedCurrency = window.localStorage.getItem(STORAGE_CURRENCY_KEY);
        const storedRate = window.localStorage.getItem(STORAGE_USD_INR_RATE_KEY);

        if (storedCurrency === 'USD' || storedCurrency === 'INR') {
            setCurrencyState(storedCurrency);
        }

        if (storedRate) {
            const parsedRate = Number.parseFloat(storedRate);
            if (Number.isFinite(parsedRate) && parsedRate > 0) {
                setUsdInrRateState(parsedRate);
            }
        }
    }, []);

    const value = useMemo<CurrencyContextValue>(() => ({
        currency,
        usdInrRate,
        setCurrency: (nextCurrency) => {
            setCurrencyState(nextCurrency);
            window.localStorage.setItem(STORAGE_CURRENCY_KEY, nextCurrency);
        },
        setUsdInrRate: (nextRate) => {
            const safeRate = Number.isFinite(nextRate) && nextRate > 0 ? nextRate : DEFAULT_USD_INR_RATE;
            setUsdInrRateState(safeRate);
            window.localStorage.setItem(STORAGE_USD_INR_RATE_KEY, String(safeRate));
        },
        convertFromUsd: (amount) => toDisplayCurrency(amount, currency, usdInrRate),
        convertToUsd: (amount) => toUsd(amount, currency, usdInrRate),
        formatCurrency: (amount, decimals = 2) => formatByCurrency(amount, currency, usdInrRate, decimals),
        formatBTCPrice: (amount) => formatByCurrency(amount, currency, usdInrRate, 2),
        currencyLabel: currency,
        currencySymbol: currency === 'INR' ? '₹' : '$',
    }), [currency, usdInrRate]);

    return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
    const context = useContext(CurrencyContext);
    if (!context) {
        throw new Error('useCurrency must be used within CurrencyProvider');
    }
    return context;
}
