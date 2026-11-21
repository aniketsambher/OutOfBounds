import { useEffect } from 'react';
import { useGame, type CaptureEvent } from '../store/game';

/** Connects to the API server (if running) and listens for live capture events. */
export function LiveSync() {
  const connect = useGame((s) => s.connect);
  const online = useGame((s) => Boolean(s.server));
  const receiveCapture = useGame((s) => s.receiveCapture);

  useEffect(() => {
    void connect();
  }, [connect]);

  useEffect(() => {
    if (!online) return;
    const source = new EventSource('/api/events');
    source.addEventListener('capture', (msg) => {
      try {
        receiveCapture(JSON.parse((msg as MessageEvent).data) as CaptureEvent);
      } catch {
        /* ignore malformed events */
      }
    });
    return () => source.close();
  }, [online, receiveCapture]);

  return null;
}
