/**
 * AQI Data Service (Phase 1):
 * - Physical Monitoring Stations
 * - Arbitrary Coordinate Point Estimation (Model 3)
 * - Continuous 2D GeoJSON Pollution Surface Matrix
 */

const express = require('express');
const router = express.Router();
const { GetPhysicalStations, EstimatePointAqi, GetSurfaceGeoJson } = require('../services/mlClient');
const { RedisCache } = require('../services/RedisCache');

// GET /api/aqi/stations
router.get('/stations', async (req, res) => {
  const cacheKey = 'airroute:stations';
  const cached = await RedisCache.Get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const rawStations = await GetPhysicalStations();
    const stations = rawStations.map((s, idx) => ({
      id: s.station_id || idx + 1,
      station_name: s.station_name || `Station ${idx + 1}`,
      station_code: s.station_id || `CAAQMS-${idx + 1}`,
      latitude: parseFloat(s.latitude),
      longitude: parseFloat(s.longitude),
      city: s.city || 'Delhi NCR',
      current_aqi: s.current_aqi !== undefined ? s.current_aqi : (s.aqi !== undefined ? s.aqi : 200),
      dominant_pollutant: s.dominant_pollutant || (s.pm2_5 && s.pm10 && s.pm2_5 > s.pm10 * 0.5 ? 'PM2.5' : 'PM10'),
      pm2_5: s.pm2_5,
      pm10: s.pm10,
      temperature: s.temperature,
      humidity: s.humidity,
      last_updated: s.timestamp || new Date().toISOString(),
    }));
    const payload = { count: stations.length, stations };
    await RedisCache.Set(cacheKey, payload, 300);
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ error: 'Failed To Retrieve Stations', details: err.message });
  }
});

// POST /api/aqi/estimate
router.post('/estimate', async (req, res) => {
  const { latitude, longitude, use_stage_two = true } = req.body;
  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Missing Required Parameters: latitude, longitude' });
  }

  try {
    const estimate = await EstimatePointAqi(latitude, longitude, use_stage_two);
    return res.json(estimate);
  } catch (err) {
    return res.status(500).json({ error: 'Estimation Failed', details: err.message });
  }
});

// GET /api/aqi/surface
router.get('/surface', async (req, res) => {
  const latStep = parseFloat(req.query.lat_step || '0.02');
  const lonStep = parseFloat(req.query.lon_step || '0.02');
  const useStageTwo = req.query.stage2 !== 'false';
  const cacheKey = `airroute:surface:${latStep}:${lonStep}:${useStageTwo}`;

  const cached = await RedisCache.Get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const geojson = await GetSurfaceGeoJson(latStep, lonStep, useStageTwo);
    await RedisCache.Set(cacheKey, geojson, 300);
    return res.json(geojson);
  } catch (err) {
    return res.status(500).json({ error: 'Surface Generation Failed', details: err.message });
  }
});

module.exports = router;
