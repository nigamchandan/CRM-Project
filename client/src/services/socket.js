import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

let socket;

export function connectSocket(token) {
  if (socket) socket.disconnect();
  socket = io(API_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });
  return socket;
}

export function getSocket() { return socket; }

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
