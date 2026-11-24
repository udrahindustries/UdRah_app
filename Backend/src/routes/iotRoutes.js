/**
 * IoT Hardware Sensor Ingestion Endpoint.
 * Ingests Real-Time Sensor Telemetry (PM2.5, PM10, CO2, Temp, Humidity) From AirRoute Products
 * Authenticating Via Hardware Device Code & Secret Key.
 * Persists To Time-Series Storage And Dispatches Real-Time WebSocket Alerts.
 */

const express = require('express');
const router = express.Router();
const crypto = require('node:crypto');
const { db } = require('../database');
const { BroadcastTelemetryToOwner } = require('../websocket');

// POST /api/iot/ingest
router.post('/ingest', (req, res) => {
  const { device_code, auth_key, pm2_5, pm10, co2, temperature, humidity, pressure } = req.body;

  if (!device_code || !auth_key) {
    return res.status(400).json({ error: 'Missing Hardware Credentials: device_code, auth_key' });
  }

  const normalizedCode = device_code.trim().toUpperCase();
  const keyHash = crypto.createHash('sha256').update(auth_key.trim()).digest('hex');

  const device = db.prepare('SELECT id, owner_id, auth_key_hash, name, model_type FROM devices WHERE device_code = ?').get(normalizedCode);
  if (!device) {
    return res.status(404).json({ error: 'Device Code Not Recognized' });
  }

  // Verify Hardware Pre-Shared Secret Key
  if (device.auth_key_hash !== keyHash) {
    return res.status(401).json({ error: 'Unauthorized Hardware Ingestion: Invalid Auth Key' });
  }

  // 1. Insert Telemetry Record
  const insertStmt = db.prepare(`
    INSERT INTO telemetry (device_id, pm2_5, pm10, co2, temperature, humidity, pressure)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = insertStmt.run(
    device.id,
    pm2_5 !== undefined ? parseFloat(pm2_5) : null,
    pm10 !== undefined ? parseFloat(pm10) : null,
    co2 !== undefined ? parseFloat(co2) : null,
    temperature !== undefined ? parseFloat(temperature) : null,
    humidity !== undefined ? parseFloat(humidity) : null,
    pressure !== undefined ? parseFloat(pressure) : null
  );

  // 2. Update Device Status And Last Seen
  db.prepare(`
    UPDATE devices
    SET status = 'online', last_seen = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(device.id);

  // 3. Dispatch Live Telemetry Over WebSocket To Authorized Owner
  const telemetryPacket = {
    telemetry_id: Number(result.lastInsertRowid),
    device_id: device.id,
    device_code: device.device_code,
    name: device.name,
    pm2_5: pm2_5 !== undefined ? parseFloat(pm2_5) : null,
    pm10: pm10 !== undefined ? parseFloat(pm10) : null,
    co2: co2 !== undefined ? parseFloat(co2) : null,
    temperature: temperature !== undefined ? parseFloat(temperature) : null,
    humidity: humidity !== undefined ? parseFloat(humidity) : null,
    pressure: pressure !== undefined ? parseFloat(pressure) : null,
    recorded_at: new Date().toISOString(),
  };

  if (device.owner_id) {
    BroadcastTelemetryToOwner(device.owner_id, telemetryPacket);
  }

  return res.status(201).json({
    status: 'INGESTED',
    message: 'Sensor Telemetry Ingested Successfully',
    telemetry_id: Number(result.lastInsertRowid),
  });
});

module.exports = router;
