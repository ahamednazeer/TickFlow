'use client';

import React, { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import {
    Lightning,
    SignOut,
    Gauge,
    MagnifyingGlass,
    ChartLineUp,
    Book,
    ShieldCheck,
    ChartBar,
    GearSix,
    List,
    ArrowsLeftRight,
} from '@phosphor-icons/react';

interface MenuItem {
    icon: React.ElementType;
    label: string;
    path: string;
}

interface DashboardLayoutProps {
    children: ReactNode;
}

const MIN_WIDTH = 60;
const COLLAPSED_WIDTH = 64;
const DEFAULT_WIDTH = 64;
const MAX_WIDTH = 320;

const menuItems: MenuItem[] = [
    { icon: Gauge, label: 'Overview', path: '/dashboard' },
    { icon: MagnifyingGlass, label: 'Scanner', path: '/dashboard/scanner' },
    { icon: ArrowsLeftRight, label: 'Trades', path: '/dashboard/trades' },
    { icon: Book, label: 'Orderbook', path: '/dashboard/orderbook' },
    { icon: ShieldCheck, label: 'Risk', path: '/dashboard/risk' },
    { icon: ChartBar, label: 'Analytics', path: '/dashboard/analytics' },
    { icon: GearSix, label: 'Settings', path: '/dashboard/settings' },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();

    const [user, setUser] = useState<{ username: string; email: string; role: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
    const [isResizing, setIsResizing] = useState(false);
    const [isHidden, setIsHidden] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Load saved width
    useEffect(() => {
        const savedWidth = localStorage.getItem('tf_sidebarWidth');
        const savedHidden = localStorage.getItem('tf_sidebarHidden');
        if (savedWidth) setSidebarWidth(parseInt(savedWidth));
        if (savedHidden === 'true') setIsHidden(true);
    }, []);

    // Save width
    useEffect(() => {
        if (!isResizing) {
            localStorage.setItem('tf_sidebarWidth', sidebarWidth.toString());
            localStorage.setItem('tf_sidebarHidden', isHidden.toString());
        }
    }, [sidebarWidth, isHidden, isResizing]);

    // Mouse resize handlers
    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (isResizing && sidebarRef.current) {
            const newWidth = e.clientX;
            if (newWidth < MIN_WIDTH) {
                setIsHidden(true);
                setSidebarWidth(COLLAPSED_WIDTH);
            } else {
                setIsHidden(false);
                const clampedWidth = Math.min(MAX_WIDTH, Math.max(COLLAPSED_WIDTH, newWidth));
                setSidebarWidth(clampedWidth);
            }
        }
    }, [isResizing]);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    // Auth check
    useEffect(() => {
        async function checkAuth() {
            try {
                const userData = await api.getMe();
                setUser({ username: userData.username, email: userData.email, role: userData.role });
            } catch {
                router.replace('/');
            } finally {
                setLoading(false);
            }
        }
        checkAuth();
    }, [router]);

    const handleLogout = () => {
        api.clearToken();
        router.push('/');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Lightning size={48} className="text-cyan-500 animate-pulse mx-auto" />
                    <div className="text-slate-500 font-mono text-sm animate-pulse">INITIALIZING SYSTEM...</div>
                </div>
            </div>
        );
    }

    const isCollapsed = sidebarWidth < 150;
    const showLabels = sidebarWidth >= 150 && !isHidden;

    return (
        <div className="min-h-screen bg-slate-950 flex">
            <div className="scanlines" />

            {/* Sidebar */}
            <aside
                ref={sidebarRef}
                className={`bg-slate-900 border-r border-slate-800 h-screen sticky top-0 flex flex-col z-50 transition-all ${isResizing ? 'transition-none' : 'duration-200'
                    } ${isHidden ? 'w-0 overflow-hidden border-0' : ''}`}
                style={{ width: isHidden ? 0 : sidebarWidth }}
            >
                {/* Header */}
                <div className={`p-4 border-b border-slate-800 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                    <div className="relative flex-shrink-0">
                        <Lightning size={28} weight="duotone" className="text-cyan-400" />
                    </div>
                    {showLabels && (
                        <div className="overflow-hidden">
                            <h1 className="font-chivo font-bold text-sm uppercase tracking-wider whitespace-nowrap">TickFlow</h1>
                            <p className="text-xs text-slate-500 font-mono">ARBITRAGE</p>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-2 overflow-y-auto overflow-x-hidden">
                    <ul className="space-y-1">
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.path ||
                                (item.path !== '/dashboard' && pathname.startsWith(item.path));
                            return (
                                <li key={item.path}>
                                    <button
                                        onClick={() => router.push(item.path)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all duration-150 text-sm font-medium ${isCollapsed ? 'justify-center' : ''
                                            } ${isActive
                                                ? 'text-cyan-400 bg-cyan-950/50 border-l-2 border-cyan-400'
                                                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                                            }`}
                                        title={isCollapsed ? item.label : undefined}
                                    >
                                        <Icon size={20} weight="duotone" className="flex-shrink-0" />
                                        {showLabels && <span className="truncate">{item.label}</span>}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* System Status */}
                {showLabels && (
                    <div className="p-3 border-t border-slate-800">
                        <div className="bg-slate-950/50 rounded-sm p-2">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="live-dot" />
                                <span className="text-xs font-mono text-green-400 uppercase">System Live</span>
                            </div>
                            <p className="text-[10px] font-mono text-slate-600">4 exchanges connected</p>
                        </div>
                    </div>
                )}

                {/* Logout */}
                <div className="p-2 border-t border-slate-800">
                    <button
                        onClick={handleLogout}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:text-red-300 hover:bg-slate-800 rounded-sm transition-all duration-150 text-sm font-medium ${isCollapsed ? 'justify-center' : ''}`}
                        title={isCollapsed ? 'Sign Out' : undefined}
                    >
                        <SignOut size={20} className="flex-shrink-0" />
                        {showLabels && 'Sign Out'}
                    </button>
                </div>

                {/* Resize Handle */}
                <div
                    className="absolute right-0 top-0 h-full w-1 cursor-ew-resize hover:bg-cyan-500/50 active:bg-cyan-500 transition-colors z-50"
                    onMouseDown={startResizing}
                    style={{ transform: 'translateX(50%)' }}
                />
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto relative z-10">
                {/* Header */}
                <div className="backdrop-blur-md bg-slate-950/80 border-b border-slate-700 sticky top-0 z-40">
                    <div className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-4">
                            {isHidden && (
                                <button
                                    onClick={() => { setIsHidden(false); setSidebarWidth(DEFAULT_WIDTH); }}
                                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                                    title="Show Sidebar"
                                >
                                    <List size={24} />
                                </button>
                            )}
                            <div>
                                <h2 className="font-chivo font-bold text-xl uppercase tracking-wider flex items-center gap-2">
                                    <ChartLineUp size={24} weight="duotone" className="text-cyan-400" />
                                    Dashboard
                                </h2>
                                <p className="text-xs text-slate-400 font-mono mt-1">
                                    BTC/USDT Cross-Exchange Arbitrage
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-mono">Logged in as</p>
                                <p className="text-sm font-mono text-slate-300">{user?.username || 'trader'}</p>
                            </div>
                            <div className="h-9 w-9 rounded-full flex items-center justify-center bg-gradient-to-br from-cyan-600 to-cyan-800 text-white font-bold text-sm shadow-lg">
                                {user?.username?.charAt(0).toUpperCase() || 'T'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Page Content */}
                <div className="p-6">
                    {children}
                </div>
            </main>

            {/* Overlay when resizing */}
            {isResizing && (
                <div className="fixed inset-0 z-[100] cursor-ew-resize" />
            )}
        </div>
    );
}
