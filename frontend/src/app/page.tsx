'use client';

import React, { useState, useEffect } from 'react';
import { Lightning, Lock, User } from '@phosphor-icons/react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);

    useEffect(() => {
        async function checkExistingAuth() {
            try {
                const token = api.getToken();
                if (!token) {
                    setCheckingAuth(false);
                    return;
                }
                await api.getMe();
                router.replace('/dashboard');
            } catch {
                api.clearToken();
                setCheckingAuth(false);
            }
        }
        checkExistingAuth();
    }, [router]);

    if (checkingAuth) {
        return (
            <div
                className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
                style={{ backgroundImage: 'linear-gradient(to bottom right, #0f172a, #1e293b)' }}
            >
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
                <div className="relative z-10 text-center space-y-4">
                    <Lightning size={48} className="text-cyan-500 animate-pulse mx-auto" />
                    <div className="text-slate-500 font-mono text-sm animate-pulse">VERIFYING SESSION...</div>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await api.login(username, password);
            router.push('/dashboard');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
            style={{ backgroundImage: 'linear-gradient(to bottom right, #0f172a, #1e293b)' }}
        >
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <div className="scanlines" />

            {/* Animated background grid */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `
                            linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)
                        `,
                        backgroundSize: '60px 60px',
                    }}
                />
            </div>

            <div className="relative z-10 w-full max-w-md mx-4 animate-scale-in">
                <div className="bg-slate-900/90 border border-slate-700 rounded-sm p-8 backdrop-blur-md">
                    {/* Header */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="relative mb-4">
                            <Lightning size={48} weight="duotone" className="text-cyan-400" />
                            <div className="absolute -inset-2 bg-cyan-500/20 rounded-full blur-xl" />
                        </div>
                        <h1 className="text-3xl font-chivo font-bold uppercase tracking-wider text-center">
                            TickFlow
                        </h1>
                        <p className="text-slate-400 text-sm mt-2 font-mono">BTC Arbitrage Engine</p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-950/50 border border-red-800 rounded-sm p-3 mb-4 text-sm text-red-400 font-mono">
                            {error}
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-4" id="login-form">
                        <div>
                            <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2 font-mono">
                                Username
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    className="w-full bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-sm placeholder:text-slate-600 font-mono text-sm pl-10 pr-3 py-2.5 border outline-none"
                                    placeholder="Enter username"
                                    id="username-input"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-slate-400 text-xs uppercase tracking-wider mb-2 font-mono">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full bg-slate-950 border-slate-700 text-slate-100 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-sm placeholder:text-slate-600 font-mono text-sm pl-10 pr-3 py-2.5 border outline-none"
                                    placeholder="••••••••"
                                    id="password-input"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white rounded-sm font-medium tracking-wide uppercase text-sm px-4 py-3 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                            id="login-submit-btn"
                        >
                            {loading ? 'Authenticating...' : 'Access System'}
                        </button>
                    </form>

                    {/* System Info */}
                    <div className="mt-6 p-4 bg-slate-950/50 border border-slate-800 rounded-sm">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-mono">System Status:</p>
                        <div className="flex items-center gap-2">
                            <div className="live-dot" />
                            <span className="text-xs font-mono text-slate-400">Engine Online — 4 Exchanges Connected</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
