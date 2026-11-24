/**
 * Real-Time WebSocket Telemetry Dispatcher.
 * Delivers Live Ingested IoT Telemetry Updates Directly To Authorized Dashboard Clients.
 */

const { WebSocketServer } = require('ws');
const { VerifyToken } = require('./auth');

let wssInstance = null;

// Map of userId -> Set of WebSocket connections
const connectedUserSockets = new Map();

function InitWebSocket(httpServer) {
  wssInstance = new WebSocketServer({ server: httpServer, path: '/ws' });

  wssInstance.on('connection', (ws, req) => {
    let authenticatedUserId = null;

    ws.on('message', (messageText) => {
      try {
        const message = JSON.parse(messageText.toString());

        // Client Authentication Over WebSocket
        if (message.type === 'AUTH') {
          const payload = VerifyToken(message.token);
          if (payload && payload.userId) {
            authenticatedUserId = payload.userId;
            if (!connectedUserSockets.has(authenticatedUserId)) {
              connectedUserSockets.set(authenticatedUserId, new Set());
            }
            connectedUserSockets.get(authenticatedUserId).add(ws);
            ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', message: 'WebSocket Authenticated' }));
          } else {
            ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Invalid Token' }));
          }
        }
      } catch (err) {
        // Ignore Non-JSON
      }
    });

    ws.on('close', () => {
      if (authenticatedUserId && connectedUserSockets.has(authenticatedUserId)) {
        connectedUserSockets.get(authenticatedUserId).delete(ws);
        if (connectedUserSockets.get(authenticatedUserId).size === 0) {
          connectedUserSockets.delete(authenticatedUserId);
        }
      }
    });

    // Send Initial Welcome
    ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Connected to AirRoute Real-Time Telemetry Stream' }));
  });

  console.log('[WebSocket] Live Telemetry Dispatcher Initialized On /ws');
}

function BroadcastTelemetryToOwner(ownerId, telemetryData) {
  if (!ownerId || !connectedUserSockets.has(ownerId)) return;

  const sockets = connectedUserSockets.get(ownerId);
  const payload = JSON.stringify({
    type: 'TELEMETRY_UPDATE',
    data: telemetryData,
  });

  for (const client of sockets) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(payload);
    }
  }
}

module.exports = {
  InitWebSocket,
  BroadcastTelemetryToOwner,
};
