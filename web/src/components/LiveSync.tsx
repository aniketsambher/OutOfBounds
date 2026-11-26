import { useEffect } from 'react';
import { useGame, type CaptureEvent } from '../store/game';

/** How often to look for the API server again while the app is offline. */
const RETRY_MS = 30_000;

/** Connects to the API server (if running), keeps retrying while offline, and listens for live turf events. */
export function LiveSync() {
  const connect = useGame((s) => s.connect);
  const online = useGame((s) => Boolean(s.server));
  const receiveCapture = useGame((s) => s.receiveCapture);
  const refreshTurf = useGame((s) => s.refreshTurf);

  useEffect(() => {
    void connect();
  }, [connect]);

  useEffect(() => {
    if (online) return;
    const timer = window.setInterval(() => void connect(), RETRY_MS);
    return () => window.clearInterval(timer);
  }, [online, connect]);

  useEffect(() => {
    if (!online) return;
    const source = new EventSource('/api/events');
    source.addEventListener('capture', (msg) => {
      try {
        void receiveCapture(JSON.parse((msg as MessageEvent).data) as CaptureEvent);
      } catch {
        /* ignore malformed events */
      }
    });
    source.addEventListener('refresh', () => void refreshTurf());
    return () => source.close();
  }, [online, receiveCapture, refreshTurf]);

  return null;
}
