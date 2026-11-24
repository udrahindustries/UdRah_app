/**
 * End-To-End Integration Test Suite For AirRoute Platform.
 * Tests:
 * 1. Authentication (Register, Login, JWT tokens)
 * 2. Phase 1: AQI Map Services (Stations, Model 3 Point Query, 2D Surface Grid)
 * 3. Phase 2: Product Discovery & Privacy Safeguards (Opt-in, Location Masking, No Telemetry Leak)
 * 4. Phase 3: My Devices Management & Private Telemetry Access Control
 * 5. IoT Sensor Hardware Ingestion (/api/iot/ingest)
 */

const assert = require('node:assert');
const http = require('node:http');
const { app, server } = require('../src/server');

const TEST_PORT = 5099;

function Request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const json = body ? JSON.parse(body) : null;
            resolve({ status: res.statusCode, data: json, headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, data: body, headers: res.headers });
          }
        });
      }
    );
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function RunAllIntegrationTests() {
  console.log('===================================================================');
  console.log('     AirRoute Platform — Comprehensive End-To-End Integration Tests');
  console.log('===================================================================');

  await new Promise((resolve) => server.listen(TEST_PORT, '127.0.0.1', resolve));
  console.log(`[Test Server] Listening on http://127.0.0.1:${TEST_PORT}`);

  try {
    // TEST 1: Health Check
    console.log('\n[Test 1] Verifying System Health API...');
    const health = await Request({ path: '/api/health', method: 'GET' });
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.data.status, 'ONLINE');
    console.log('✔ Health Check Passed');

    // TEST 2: User Authentication
    console.log('\n[Test 2] Verifying User Authentication (Login Demo & Register)...');
    const loginRes = await Request(
      { path: '/api/auth/login', method: 'POST' },
      { email: 'demo@airroute.io', password: 'Password123!' }
    );
    assert.strictEqual(loginRes.status, 200);
    assert.ok(loginRes.data.token, 'Must return JWT token');
    const demoToken = loginRes.data.token;
    console.log('✔ Login Successful. Received Token.');

    // Profile check
    const meRes = await Request({
      path: '/api/auth/me',
      method: 'GET',
      headers: { Authorization: `Bearer ${demoToken}` },
    });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.user.email, 'demo@airroute.io');
    console.log('✔ Authenticated User Profile Verified.');

    // TEST 3: Phase 1 AQI Map Data
    console.log('\n[Test 3] Verifying Phase 1 AQI Data Service...');
    const stationsRes = await Request({ path: '/api/aqi/stations', method: 'GET' });
    assert.strictEqual(stationsRes.status, 200);
    assert.ok(stationsRes.data.stations.length > 0, 'Must return physical monitoring stations');
    console.log(`✔ Physical Monitoring Stations: ${stationsRes.data.stations.length} Active Stations.`);

    // Point Estimation (Calls Model 3 Bridge)
    const estimateRes = await Request(
      { path: '/api/aqi/estimate', method: 'POST' },
      { latitude: 28.6315, longitude: 77.2167, use_stage_two: true }
    );
    assert.strictEqual(estimateRes.status, 200);
    assert.ok(estimateRes.data.estimated_aqi > 0, 'Must return positive estimated AQI');
    assert.ok(estimateRes.data.confidence_score !== undefined, 'Must include geometric confidence');
    console.log(`✔ Model 3 Point Query Verified: AQI=${estimateRes.data.estimated_aqi}, Confidence=${estimateRes.data.confidence_score}`);

    // Surface Grid
    const surfaceRes = await Request({ path: '/api/aqi/surface?lat_step=0.04&lon_step=0.04', method: 'GET' });
    assert.strictEqual(surfaceRes.status, 200);
    assert.strictEqual(surfaceRes.data.type, 'FeatureCollection');
    assert.ok(surfaceRes.data.features.length > 0, 'Surface must return GeoJSON grid features');
    console.log(`✔ Model 3 2D Spatial Surface: Generated ${surfaceRes.data.features.length} GeoJSON Features.`);

    // TEST 4: Phase 2 Product Discovery & Strict Privacy Safeguards
    console.log('\n[Test 4] Verifying Phase 2 Product Discovery & Privacy Safeguards...');
    const discoveryRes = await Request({ path: '/api/discovery/nearby?lat=28.6315&lon=77.2167&radius_km=30', method: 'GET' });
    assert.strictEqual(discoveryRes.status, 200);
    assert.ok(discoveryRes.data.device_count > 0, 'Must discover nearby AirRoute products');

    for (const dev of discoveryRes.data.devices) {
      // Rule 1: Zero Private Telemetry Leakage
      assert.strictEqual(dev.pm2_5, undefined, 'CRITICAL PRIVACY VIOLATION: Telemetry must NEVER appear in public discovery!');
      assert.strictEqual(dev.pm10, undefined, 'CRITICAL PRIVACY VIOLATION: Telemetry must NEVER appear in public discovery!');
      assert.strictEqual(dev.co2, undefined, 'CRITICAL PRIVACY VIOLATION: Telemetry must NEVER appear in public discovery!');

      // Rule 2: Approximate Location Notice If Masked
      if (dev.is_approximate_location) {
        assert.ok(dev.approx_latitude !== undefined);
        assert.ok(dev.approx_longitude !== undefined);
      }
    }
    console.log(`✔ Public Discovery Passed: ${discoveryRes.data.device_count} Devices Found With Privacy Masking & Zero Telemetry Leak.`);

    // TEST 5: Phase 3 My Devices Dashboard & Authorization
    console.log('\n[Test 5] Verifying Phase 3 My Devices Private Dashboard & Ownership Enforcement...');
    const devicesRes = await Request({
      path: '/api/devices',
      method: 'GET',
      headers: { Authorization: `Bearer ${demoToken}` },
    });
    assert.strictEqual(devicesRes.status, 200);
    assert.ok(devicesRes.data.devices.length > 0, 'User must have registered devices');
    const myDevice = devicesRes.data.devices[0];
    console.log(`✔ Owned Devices Retrieved: ${devicesRes.data.devices.length} Devices For User.`);

    // Private Telemetry Access For Owner
    const telemetryRes = await Request({
      path: `/api/devices/${myDevice.id}/telemetry?limit=10`,
      method: 'GET',
      headers: { Authorization: `Bearer ${demoToken}` },
    });
    assert.strictEqual(telemetryRes.status, 200);
    assert.ok(telemetryRes.data.readings.length > 0, 'Owner must receive telemetry readings');
    console.log(`✔ Private Telemetry Access Granted To Owner (${telemetryRes.data.reading_count} Readings).`);

    // Unauthorized Access Test: Non-Owner Blocked
    const intruderEmail = `intruder_${Date.now()}@test.com`;
    const otherTokenRes = await Request(
      { path: '/api/auth/register', method: 'POST' },
      { email: intruderEmail, password: 'Password123!', full_name: 'Intruder User' }
    );
    const intruderToken = otherTokenRes.data.token;
    const unauthorizedTelemetry = await Request({
      path: `/api/devices/${myDevice.id}/telemetry`,
      method: 'GET',
      headers: { Authorization: `Bearer ${intruderToken}` },
    });
    assert.strictEqual(unauthorizedTelemetry.status, 403, 'Must return 403 Forbidden for non-owner');
    console.log('✔ Unauthorized Telemetry Access Strictly Forbidden (403).');

    // TEST 6: Hardware Sensor Ingestion
    console.log('\n[Test 6] Verifying Hardware Telemetry Ingestion (/api/iot/ingest)...');
    const ingestRes = await Request(
      { path: '/api/iot/ingest', method: 'POST' },
      {
        device_code: myDevice.device_code,
        auth_key: `KEY-${myDevice.device_code.slice(4)}`,
        pm2_5: 215.4,
        pm10: 342.1,
        co2: 520.0,
        temperature: 24.2,
        humidity: 62.5,
        pressure: 1011.8,
      }
    );
    assert.strictEqual(ingestRes.status, 201);
    assert.strictEqual(ingestRes.data.status, 'INGESTED');
    console.log(`✔ Hardware Sensor Packet Ingested Successfully (Telemetry ID: ${ingestRes.data.telemetry_id}).`);

    // TEST 7: Admin Panel Operations & Role Guard
    console.log('\n[Test 7] Verifying Admin Dashboard & RBAC Guards (/api/admin/*)...');
    // Non-admin attempt should be rejected with 403
    const forbiddenAdminRes = await Request({
      path: '/api/admin/overview',
      method: 'GET',
      headers: { Authorization: `Bearer ${demoToken}` },
    });
    assert.strictEqual(forbiddenAdminRes.status, 403, 'Demo user must be rejected with 403 from admin overview');
    console.log('✔ RBAC Guard Verified: Regular user blocked from admin endpoints (403).');

    // Admin login
    const adminLoginRes = await Request(
      { path: '/api/auth/login', method: 'POST' },
      { email: 'admin@airroute.io', password: 'Password123!' }
    );
    assert.strictEqual(adminLoginRes.status, 200);
    const adminToken = adminLoginRes.data.token;
    assert.strictEqual(adminLoginRes.data.user.role, 'admin');

    // Admin overview
    const adminOverviewRes = await Request({
      path: '/api/admin/overview',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminOverviewRes.status, 200);
    assert.ok(adminOverviewRes.data.metrics.total_users >= 2);
    assert.ok(adminOverviewRes.data.metrics.total_devices >= 5);
    console.log(`✔ Admin Overview Verified: ${adminOverviewRes.data.metrics.total_users} Users, ${adminOverviewRes.data.metrics.total_devices} Devices.`);

    // Admin users list
    const adminUsersRes = await Request({
      path: '/api/admin/users',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminUsersRes.status, 200);
    assert.ok(adminUsersRes.data.users.length >= 2);

    // Admin telemetry recent stream
    const adminTelemetryRes = await Request({
      path: '/api/admin/telemetry/recent?limit=5',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminTelemetryRes.status, 200);
    assert.ok(adminTelemetryRes.data.stream.length > 0);
    console.log(`✔ Admin Telemetry Stream Verified: ${adminTelemetryRes.data.stream.length} Packets Read.`);

    // Admin Model 3 diagnostics
    const adminMlDiagRes = await Request({
      path: '/api/admin/ml/diagnostics',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminMlDiagRes.status, 200);
    assert.strictEqual(adminMlDiagRes.data.status, 'STAGE_2_COMPLETE_AND_AUDITED');
    assert.strictEqual(adminMlDiagRes.data.acceptance_gate_passed, true);
    console.log(`✔ Admin Model 3 Diagnostics Verified: MAE Improvement=${adminMlDiagRes.data.performance_improvement.mae_reduction_percentage}%.`);

    console.log('\n===================================================================');
    console.log('        ALL AIRROUTE PLATFORM INTEGRATION TESTS PASSED (100%)       ');
    console.log('===================================================================');
  } finally {
    server.close();
  }
}

if (require.main === module) {
  RunAllIntegrationTests()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Integration Test Failure:', err);
      process.exit(1);
    });
}

module.exports = { RunAllIntegrationTests };
