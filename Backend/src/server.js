/**
 * Master Node.js Express HTTP & WebSocket Server For AirRoute Platform.
 * Routes All Requests To Auth, AQI, Discovery, Device Management, And IoT Ingestion Services.
 * Serves The Map-First Client Single Page Application.
 */

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const cors = require('cors');

const { InitWebSocket } = require('./websocket');
const authRoutes = require('./routes/authRoutes');
const aqiRoutes = require('./routes/aqiRoutes');
const discoveryRoutes = require('./routes/discoveryRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const iotRoutes = require('./routes/iotRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const server = http.createServer(app);

const PORT = parseInt(process.env.PORT || '5000', 10);

// Middleware Configuration
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.startsWith('/css') && !req.path.startsWith('/js') && !req.path.startsWith('/assets')) {
      console.log(`[HTTP] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// REST API Route Registrations
app.use('/api/auth', authRoutes);
app.use('/api/aqi', aqiRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/iot', iotRoutes);
app.use('/api/admin', adminRoutes);

// Health & System Status Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'AirRoute Platform Backend (Node.js + Express)',
    timestamp: new Date().toISOString(),
    uptime_seconds: process.uptime(),
  });
});

// Serve Client Application (React SPA In Frontend/Dist Or Static Fallback)
const REACT_APP_PATH = path.join(__dirname, '..', '..', 'Frontend', 'Dist');
const WEB_APP_PATH = path.join(__dirname, '..', '..', 'WebApp', 'public');
const ACTIVE_STATIC_PATH = fs.existsSync(REACT_APP_PATH) ? REACT_APP_PATH : WEB_APP_PATH;

app.use(express.static(ACTIVE_STATIC_PATH));

// Single Page Application Fallback Middleware
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
    const indexPath = path.join(ACTIVE_STATIC_PATH, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Error] Unhandled Express Exception:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Initialize Real-Time WebSocket Telemetry Dispatcher
InitWebSocket(server);

// Start HTTP Server
if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`===================================================================`);
    console.log(`   AirRoute: Map-First AQI & IoT Platform Backend Server Active    `);
    console.log(`===================================================================`);
    console.log(`-> Local URL:        http://127.0.0.1:${PORT}`);
    console.log(`-> WebSocket Stream: ws://127.0.0.1:${PORT}/ws`);
    console.log(`-> Web Application:  Serving From ${WEB_APP_PATH}`);
    console.log(`===================================================================`);
  });
}

module.exports = { app, server };
