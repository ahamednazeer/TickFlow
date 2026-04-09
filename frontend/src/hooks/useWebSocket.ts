'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseWebSocketOptions {
    url: string;
    onMessage?: (data: unknown) => void;
    onOpen?: () => void;
    onClose?: () => void;
    onError?: (error: Event) => void;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    enabled?: boolean;
}

interface UseWebSocketReturn {
    isConnected: boolean;
    lastMessage: unknown | null;
    send: (data: unknown) => void;
    reconnect: () => void;
    disconnect: () => void;
    reconnectCount: number;
}

export function useWebSocket({
    url,
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    enabled = true,
}: UseWebSocketOptions): UseWebSocketReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<unknown | null>(null);
    const [reconnectCount, setReconnectCount] = useState(0);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const connect = useCallback(() => {
        if (!enabled || !url) return;

        try {
            const ws = new WebSocket(url);

            ws.onopen = () => {
                setIsConnected(true);
                setReconnectCount(0);
                onOpen?.();
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setLastMessage(data);
                    onMessage?.(data);
                } catch {
                    setLastMessage(event.data);
                    onMessage?.(event.data);
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
                onClose?.();

                // Auto-reconnect
                if (enabled && reconnectCount < maxReconnectAttempts) {
                    reconnectTimeoutRef.current = setTimeout(() => {
                        setReconnectCount(prev => prev + 1);
                        connect();
                    }, reconnectInterval);
                }
            };

            ws.onerror = (error) => {
                onError?.(error);
            };

            wsRef.current = ws;
        } catch (err) {
            console.error('WebSocket connection error:', err);
        }
    }, [url, enabled, onMessage, onOpen, onClose, onError, reconnectInterval, maxReconnectAttempts, reconnectCount]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
    }, []);

    const send = useCallback((data: unknown) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
        }
    }, []);

    const reconnect = useCallback(() => {
        disconnect();
        setReconnectCount(0);
        setTimeout(connect, 100);
    }, [disconnect, connect]);

    useEffect(() => {
        connect();
        return () => {
            disconnect();
        };
    }, [url, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        isConnected,
        lastMessage,
        send,
        reconnect,
        disconnect,
        reconnectCount,
    };
}
