/**
 * My Devices Dashboard & Device Management Service (Phase 3).
 * Private Dashboard Where Users Monitor Sensor Readings ONLY For Their Own Registered Device(s).
 * Enforces Strict Ownership Authorization On Every Request.
 */

const express = require('express');
const router = express.Router();
const crypto = require('node:crypto');
const { db } = require('../database');
const { RequireAuth } = require('../auth');

// All Routes In This Module Require Authenticated User Session
router.use(RequireAuth);

// GET /api/devices (List Current User's Registered Devices)
router.get('/', (req, res) => {
  const userId = req.user.id;
  const userDevices = db.prepare(`
    SELECT id, device_code, name, model_type, lat, lon, is_public_discovery, location_masking, status, last_seen, created_at
    FROM devices
    WHERE owner_id = ?
    ORDER BY created_at DESC
  `).all(userId);

  // Attach Latest Telemetry Reading To Each Device
  const getLatestTelemetry = db.prepare(`
    SELECT pm2_5, pm10, co2, temperature, humidity, pressure, recorded_at
    FROM telemetry
    WHERE device_id = ?
    ORDER BY recorded_at DESC
    LIMIT 1
  `);

  const enrichedDevices = userDevices.map((dev) => {
    const latest = getLatestTelemetry.get(dev.id);
    return {
      ...dev,
      latest_readings: latest || null,
    };
  });

  return res.json({ devices: enrichedDevices });
});

// POST /api/devices/register (Claim An AirRoute IoT Hardware Product)
router.post('/register', (req, res) => {
  const userId = req.user.id;
  const { device_code, auth_key, custom_name, lat, lon } = req.body;

  if (!device_code || !auth_key) {
    return res.status(400).json({ error: 'Missing Required Fields: device_code, auth_key' });
  }

  const normalizedCode = device_code.trim().toUpperCase();
  const keyHash = crypto.createHash('sha256').update(auth_key.trim()).digest('hex');

  const device = db.prepare('SELECT id, owner_id, auth_key_hash, name FROM devices WHERE device_code = ?').get(normalizedCode);
  if (!device) {
    return res.status(404).json({ error: 'Device Code Not Recognized. Check Hardware Packaging' });
  }

  if (device.owner_id && device.owner_id !== userId) {
    return res.status(403).json({ error: 'Device Is Already Registered To Another User Account' });
  }

  if (device.auth_key_hash !== keyHash) {
    return res.status(401).json({ error: 'Invalid Device Authentication Key' });
  }

  // Update Ownership, Optional Custom Name, And Coordinates
  const updatedName = custom_name ? custom_name.trim() : device.name;
  db.prepare(`
    UPDATE devices
    SET owner_id = ?, name = ?, lat = COALESCE(?, lat), lon = COALESCE(?, lon)
    WHERE id = ?
  `).run(userId, updatedName, lat !== undefined ? parseFloat(lat) : null, lon !== undefined ? parseFloat(lon) : null, device.id);

  const registeredDevice = db.prepare('SELECT * FROM devices WHERE id = ?').get(device.id);
  return res.json({
    message: 'Device Registered To Your Account Successfully',
    device: registeredDevice,
  });
});

// PUT /api/devices/:id/visibility (Update Opt-in Discovery & Masking)
router.put('/:id/visibility', (req, res) => {
  const userId = req.user.id;
  const deviceId = parseInt(req.params.id, 10);
  const { is_public_discovery, location_masking } = req.body;

  const device = db.prepare('SELECT id, owner_id FROM devices WHERE id = ?').get(deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device Not Found' });
  }

  // Strict Authorization Check: Ownership Mandatory
  if (device.owner_id !== userId) {
    return res.status(403).json({ error: 'Forbidden: You Do Not Own This Device' });
  }

  db.prepare(`
    UPDATE devices
    SET is_public_discovery = COALESCE(?, is_public_discovery),
        location_masking = COALESCE(?, location_masking)
    WHERE id = ?
  `).run(
    is_public_discovery !== undefined ? (is_public_discovery ? 1 : 0) : null,
    location_masking !== undefined ? (location_masking ? 1 : 0) : null,
    deviceId
  );

  const updated = db.prepare('SELECT id, device_code, name, is_public_discovery, location_masking FROM devices WHERE id = ?').get(deviceId);
  return res.json({ message: 'Privacy Settings Updated', device: updated });
});

// GET /api/devices/:id/telemetry (Private Sensor Output Stream)
router.get('/:id/telemetry', (req, res) => {
  const userId = req.user.id;
  const deviceId = parseInt(req.params.id, 10);
  const limit = parseInt(req.query.limit || '50', 10);

  const device = db.prepare('SELECT id, owner_id, name, model_type FROM devices WHERE id = ?').get(deviceId);
  if (!device) {
    return res.status(404).json({ error: 'Device Not Found' });
  }

  // Strict Authorization Check: Personal Readings Kept Strictly Private
  if (device.owner_id !== userId) {
    return res.status(403).json({ error: 'Forbidden: You Do Not Have Authorization To View Telemetry For This Device' });
  }

  const readings = db.prepare(`
    SELECT pm2_5, pm10, co2, temperature, humidity, pressure, recorded_at
    FROM telemetry
    WHERE device_id = ?
    ORDER BY recorded_at DESC
    LIMIT ?
  `).all(deviceId, limit);

  return res.json({
    device: {
      id: device.id,
      name: device.name,
      model_type: device.model_type,
    },
    reading_count: readings.length,
    readings: readings.reverse(), // Chronological For Charting
  });
});

module.exports = router;
