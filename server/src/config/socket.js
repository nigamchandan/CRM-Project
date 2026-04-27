const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io;
const userSockets = new Map(); // userId -> Set<socketId>

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || '*', credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next();
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.id;
      next();
    } catch (e) {
      next();
    }
  });

  io.on('connection', (socket) => {
    if (socket.userId) {
      if (!userSockets.has(socket.userId)) userSockets.set(socket.userId, new Set());
      userSockets.get(socket.userId).add(socket.id);
      socket.join(`user:${socket.userId}`);
    }

    socket.on('disconnect', () => {
      if (socket.userId && userSockets.has(socket.userId)) {
        userSockets.get(socket.userId).delete(socket.id);
      }
    });
  });

  return io;
}

function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

function emitBroadcast(event, payload) {
  if (!io) return;
  io.emit(event, payload);
}

module.exports = { initSocket, emitToUser, emitBroadcast };
