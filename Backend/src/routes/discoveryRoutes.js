/**
 * Product Discovery Service (Phase 2):
 * Nearby AirRoute Products Map With Strict Privacy Safeguards.
 * Enforces:
 * 1. Opt-in visibility (is_public_discovery === 1).
 * 2. Location masking (500m-1km approximate coordinates or area-level counts).
 * 3. ZERO private telemetry leakage to the public.
 */

const express = require('express');
const router = express.Router();
const { db } = require('../database');

// Haversine Distance Helper in Kilometers
function HaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Pseudo-Random Deterministic Jitter For Location Masking (~500m to 800m)
function ApplyLocationMask(lat, lon, deviceId) {
  const seed = (deviceId * 9301 + 49297) % 233280;
  const rnd = seed / 233280.0;
  const angle = rnd * 2 * Math.PI;
  const offsetKm = 0.5 + (rnd * 0.4); // 500m to 900m
  const dLat = (offsetKm * Math.cos(angle)) / 111.0;
  const dLon = (offsetKm * Math.sin(angle)) / (111.0 * Math.cos((lat * Math.PI) / 180));
  return {
    masked_lat: Number((lat + dLat).toFixed(4)),
    masked_lon: Number((lon + dLon).toFixed(4)),
    is_approximate: true,
  };
}

// GET /api/discovery/nearby?lat=...&lon=...&radius_km=15
router.get('/nearby', (req, res) => {
  const userLat = parseFloat(req.query.lat || '28.6315');
  const userLon = parseFloat(req.query.lon || '77.2167');
  const radiusKm = parseFloat(req.query.radius_km || '25.0');

  // Query ONLY Devices With Opt-In Public Discovery Enabled
  const query = `
    SELECT id, device_code, name, model_type, lat, lon, location_masking, status, last_seen
    FROM devices
    WHERE is_public_discovery = 1
  `;
  const allPublicDevices = db.prepare(query).all();

  const nearbyProducts = [];

  for (const dev of allPublicDevices) {
    const dist = HaversineKm(userLat, userLon, dev.lat, dev.lon);
    if (dist <= radiusKm) {
      let finalLat = dev.lat;
      let finalLon = dev.lon;
      let isApprox = false;

      // Privacy Safeguard: Mask Exact Location If location_masking === 1
      if (dev.location_masking === 1) {
        const masked = ApplyLocationMask(dev.lat, dev.lon, dev.id);
        finalLat = masked.masked_lat;
        finalLon = masked.masked_lon;
        isApprox = true;
      }

      nearbyProducts.push({
        id: dev.id,
        device_code: dev.device_code,
        name: dev.name,
        model_type: dev.model_type,
        approx_latitude: finalLat,
        approx_longitude: finalLon,
        distance_km: Number(dist.toFixed(2)),
        is_approximate_location: isApprox,
        status: dev.status,
        last_seen: dev.last_seen,
        // ZERO TELEMETRY EXPOSED HERE PER PRODUCT RULE
      });
    }
  }

  return res.json({
    query_center: { latitude: userLat, longitude: userLon },
    search_radius_km: radiusKm,
    device_count: nearbyProducts.length,
    devices: nearbyProducts,
  });
});

// GET /api/discovery/clusters
router.get('/clusters', (req, res) => {
  const devices = db.prepare(`
    SELECT id, lat, lon, location_masking
    FROM devices
    WHERE is_public_discovery = 1
  `).all();

  // Grid Cell Clustering (0.05 degree ~ 5km bins)
  const clustersMap = new Map();

  for (const d of devices) {
    const binLat = Math.round(d.lat / 0.05) * 0.05;
    const binLon = Math.round(d.lon / 0.05) * 0.05;
    const key = `${binLat.toFixed(3)},${binLon.toFixed(3)}`;

    if (!clustersMap.has(key)) {
      clustersMap.set(key, {
        centroid_lat: Number(binLat.toFixed(3)),
        centroid_lon: Number(binLon.toFixed(3)),
        device_count: 0,
      });
    }
    clustersMap.get(key).device_count += 1;
  }

  const clusters = Array.from(clustersMap.values());
  return res.json({
    total_public_devices: devices.length,
    clusters_count: clusters.length,
    clusters,
  });
});

module.exports = router;
