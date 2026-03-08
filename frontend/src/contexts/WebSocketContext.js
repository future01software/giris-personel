import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
    const [lastMessage, setLastMessage] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const ws = useRef(null);

    useEffect(() => {
        // Determine WS URL (ws:// for http, wss:// for https)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Use env var or default to window.location
        let host = process.env.REACT_APP_BACKEND_URL
            ? process.env.REACT_APP_BACKEND_URL.replace(/^http(s)?:\/\//, '')
            : window.location.host;

        // Remove /api if present in the host string by mistake, though usually it's just host:port
        host = host.split('/')[0];

        const wsUrl = `${protocol}//${host}/ws`;

        // Connect function with retry logic
        const connect = () => {
            try {
                ws.current = new WebSocket(wsUrl);

                ws.current.onopen = () => {
                    console.log('WS Connected');
                    setIsConnected(true);
                };

                ws.current.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        setLastMessage(data);
                    } catch (e) {
                        console.error('WS Parse Error', e);
                    }
                };

                ws.current.onclose = () => {
                    console.log('WS Disconnected');
                    setIsConnected(false);
                    // Reconnect after 3s
                    setTimeout(() => {
                        if (document.visibilityState === 'visible') {
                            connect();
                        }
                    }, 3000);
                };

                ws.current.onerror = (err) => {
                    console.error('WS Error', err);
                    ws.current.close();
                };

            } catch (error) {
                console.error('WS Connection Attempt Failed', error);
            }
        };

        connect();

        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, []);

    return (
        <WebSocketContext.Provider value={{ isConnected, lastMessage }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    return useContext(WebSocketContext);
};
