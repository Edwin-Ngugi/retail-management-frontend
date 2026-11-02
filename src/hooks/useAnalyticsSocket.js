// useAnalyticsSocket.js
import { useEffect, useRef, useCallback } from 'react';

export function useAnalyticsSocket(branchId, onMessage) {
  const socketRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  const reconnectTimeoutRef = useRef(null);

  // Keep callback reference updated without triggering re-connections
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!branchId) return;

    let isComponentMounted = true;
    let reconnectAttempts = 0;

    const connect = () => {
      // Check if running on local development host
      const isLocalhost =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

      // Dynamic protocol support (ws for local HTTP, wss for secure production HTTPS)
      const protocol =
        window.location.protocol === 'https:' && !isLocalhost ? 'wss:' : 'ws:';

      let host = '127.0.0.1:8000';

      if (!isLocalhost) {
        // Extract root backend domain (strips http://, https://, /api, and trailing slashes)
        const rawApiUrl =
          import.meta.env.VITE_API_BASE_URL ||
          'https://api.melvexbusinesssolutions.com';
        
        host = rawApiUrl
          .replace(/^https?:\/\//, '')
          .replace(/\/api\/?$/, '')
          .replace(/\/$/, '');
      }

      // Retrieve JWT authentication token
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';

      const wsUrl = `${protocol}//${host}/ws/analytics/${branchId}/${tokenQuery}`;

      console.log(`[WS ATTEMPT] Connecting to: ${wsUrl}`);
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log(`[WS CONNECTED] Analytics stream connected for Branch: ${branchId}`);
        reconnectAttempts = 0; // Reset reconnect timer on success
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessageRef.current) {
            onMessageRef.current(data);
          }
        } catch (err) {
          console.error('[WS PARSE ERROR]', err);
        }
      };

      socket.onerror = (error) => {
        if (socket.readyState !== WebSocket.CLOSED) {
          console.error('[WS ERROR]', error);
        }
      };

      socket.onclose = (event) => {
        console.log(`[WS CLOSED] Code: ${event.code}`);

        if (isComponentMounted && event.code !== 1000) {
          const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
          reconnectAttempts++;
          console.log(`[WS RECONNECTING] Attempting in ${timeout}ms...`);
          reconnectTimeoutRef.current = setTimeout(connect, timeout);
        }
      };
    };

    connect();

    return () => {
      isComponentMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        const socket = socketRef.current;
        if (socket.readyState === WebSocket.CONNECTING) {
          socket.onopen = () => socket.close(1000, 'Component unmounted');
        } else if (socket.readyState === WebSocket.OPEN) {
          socket.close(1000, 'Component unmounted');
        }
      }
    };
  }, [branchId]);

  // Helper to send messages over the active connection
  const sendMessage = useCallback((data) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    } else {
      console.warn('[WS SEND WARNING] Socket is not open.');
    }
  }, []);

  return { sendMessage };
}