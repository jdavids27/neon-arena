import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? window.location.origin
    : 'http://localhost:3001');

export function createNet(url = SERVER_URL) {
  const socket = io(url, { transports: ['websocket'] });
  const listeners = new Map();
  const registered = new Set();

  socket.on('connect', () => console.log('[net] connected as', socket.id));
  socket.on('disconnect', (r) => console.log('[net] disconnected:', r));
  socket.on('connect_error', (e) => console.warn('[net] connect_error:', e.message));

  return {
    on(event, cb) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(cb);
      if (!registered.has(event)) {
        registered.add(event);
        socket.on(event, (msg) => {
          const cbs = listeners.get(event);
          if (cbs) for (const fn of cbs) fn(msg);
        });
      }
      return () => listeners.get(event).delete(cb);
    },
    sendState(s) { socket.emit('state', s); },
    sendFire(shot) { socket.emit('fire', shot); },
    get connected() { return socket.connected; },
    get id() { return socket.id; },
    socket,
  };
}
