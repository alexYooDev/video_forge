import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

export const useRealtimeJobs = (enabled = true) => {
  const [jobUpdates, setJobUpdates] = useState({});
  const [systemStats, setSystemStats] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!enabled || !mountedRef.current || eventSourceRef.current) return;

    try {
      const token = localStorage.getItem('video_forge_token');
      if (!token) {
        console.log('No token available for SSE connection');
        return;
      }

      // Create a custom fetch-based SSE since EventSource doesn't support custom headers
      const baseUrl = process.env.REACT_APP_SERVER_URL || api.defaults.baseURL || 'http://localhost:8000';
      const url = `${baseUrl}/api/jobs/events`;
      
      const controller = new AbortController();
      
      fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal
      }).then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        setConnectionStatus('connected');
        console.log('SSE connection established');
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        function readStream() {
          return reader.read().then(({ done, value }) => {
            if (done) {
              console.log('SSE stream ended');
              setConnectionStatus('disconnected');
              return;
            }
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            lines.forEach(line => {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  
                  if (data.type === 'job_update' && mountedRef.current) {
                    setJobUpdates(prev => ({
                      ...prev,
                      [data.jobId]: {
                        status: data.status,
                        progress: data.progress,
                        updated_at: data.updated_at,
                        timestamp: Date.now()
                      }
                    }));
                  } else if (data.type === 'system_stats' && mountedRef.current) {
                    // Only log system stats when there are active jobs or changes
                    const hasActiveJobs = data.stats.currentJobs > 0 || data.stats.queueLength > 0;
                    if (hasActiveJobs) {
                      console.log('System stats update:', data.stats);
                    }
                    setSystemStats({
                      ...data.stats,
                      timestamp: Date.now()
                    });
                  }
                } catch (error) {
                  console.error('Error parsing SSE data:', error);
                }
              }
            });
            
            return readStream();
          });
        }
        
        eventSourceRef.current = { close: () => controller.abort() };
        return readStream();
        
      }).catch(error => {
        if (error.name === 'AbortError') {
          console.log('SSE connection aborted');
          return;
        }
        
        console.error('SSE connection error:', error);
        setConnectionStatus('disconnected');
        
        // Reconnect after 5 seconds
        if (enabled && !reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect SSE...');
            connect();
          }, 5000);
        }
      });
      
      setConnectionStatus('connecting');

    } catch (error) {
      console.error('Failed to establish SSE connection:', error);
      setConnectionStatus('error');
    }
  }, [enabled]);

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setConnectionStatus('disconnected');
  };

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [enabled, connect]);

  // Clear old job updates after 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setJobUpdates(prev => {
        const filtered = {};
        Object.entries(prev).forEach(([jobId, update]) => {
          if (now - update.timestamp < 10000) {
            filtered[jobId] = update;
          }
        });
        return filtered;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return {
    jobUpdates,
    systemStats,
    connectionStatus,
    reconnect: connect,
    disconnect
  };
};