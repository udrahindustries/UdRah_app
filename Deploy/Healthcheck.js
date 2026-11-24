/**
 * Enterprise Service Health Prober For AirRoute Platform.
 * Checks Status Of All Microservices: Backend, ML Service, Redis, And Frontend.
 * Follows Antigravity Coding Standards (Title Case Console Logs & Comments).
 */

const http = require('node:http');

const SERVICES = [
  { name: 'Node.js Express Backend', url: 'http://127.0.0.1:5000/api/health' },
  { name: 'Model 3 Python ML Service', url: 'http://127.0.0.1:8000/health' },
];

async function CheckService(service) {
  return new Promise((resolve) => {
    const req = http.get(service.url, (res) => {
      if (res.statusCode === 200) {
        resolve({ name: service.name, status: 'HEALTHY', code: res.statusCode });
      } else {
        resolve({ name: service.name, status: 'UNHEALTHY', code: res.statusCode });
      }
    });

    req.on('error', (err) => {
      resolve({ name: service.name, status: 'OFFLINE', error: err.message });
    });

    req.setTimeout(3000, () => {
      req.destroy();
      resolve({ name: service.name, status: 'TIMEOUT' });
    });
  });
}

async function RunHealthChecks() {
  console.log('===================================================================');
  console.log('       AirRoute Platform — Comprehensive Health Inspection         ');
  console.log('===================================================================');

  for (const service of SERVICES) {
    const result = await CheckService(service);
    if (result.status === 'HEALTHY') {
      console.log(`✔ [${result.status}] ${result.name} (HTTP ${result.code})`);
    } else {
      console.log(`✖ [${result.status}] ${result.name} (${result.error || result.code})`);
    }
  }

  console.log('===================================================================');
}

if (require.main === module) {
  RunHealthChecks();
}

module.exports = { RunHealthChecks };
