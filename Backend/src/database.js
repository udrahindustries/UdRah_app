/**
 * SQLite Database Service For AirRoute Backend.
 * Leverages Native node:sqlite For Zero-Dependency, High-Performance Local Storage.
 * Configures Tables For Users, Devices, Telemetry, And CAAQMS Stations.
 */

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'airroute.db');
const db = new DatabaseSync(DB_PATH);

// Pragmas For WAL Mode And Foreign Keys
db.exec('PRAGMA foreign_keys = ON;');

function InitDatabase() {
  // 1. Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Devices (AirRoute IoT Products) Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_code TEXT UNIQUE NOT NULL,
      auth_key_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      model_type TEXT DEFAULT 'AirRoute Pro',
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      is_public_discovery INTEGER DEFAULT 1,
      location_masking INTEGER DEFAULT 1,
      status TEXT DEFAULT 'online',
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Telemetry (Sensor Time-Series) Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      pm2_5 REAL,
      pm10 REAL,
      co2 REAL,
      temperature REAL,
      humidity REAL,
      pressure REAL,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create Indexes For Fast Geospatial And Device Lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_telemetry_device_time ON telemetry(device_id, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_devices_owner ON devices(owner_id);
    CREATE INDEX IF NOT EXISTS idx_devices_discovery ON devices(is_public_discovery);
  `);

  SeedInitialData();
}

function HashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function VerifyPassword(password, hash, salt) {
  const checkHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return checkHash === hash;
}

function SeedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    console.log('[Database] Seeding Initial Users And Devices...');

    // 1. Seed Demo User
    const { hash, salt } = HashPassword('Password123!');
    const insertUser = db.prepare(`
      INSERT INTO users (email, password_hash, salt, full_name, role)
      VALUES (?, ?, ?, ?, ?)
    `);
    const demoUser = insertUser.run('demo@airroute.io', hash, salt, 'AirRoute Pioneer', 'user');
    const demoUserId = demoUser.lastInsertRowid;

    const adminUser = insertUser.run('admin@airroute.io', hash, salt, 'System Administrator', 'admin');

    // 2. Seed AirRoute IoT Products
    const insertDevice = db.prepare(`
      INSERT INTO devices (device_code, auth_key_hash, name, model_type, owner_id, lat, lon, is_public_discovery, location_masking, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTelemetry = db.prepare(`
      INSERT INTO telemetry (device_id, pm2_5, pm10, co2, temperature, humidity, pressure, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
    `);

    const devicesData = [
      {
        code: 'AIR-PRO-001',
        key: 'KEY-PRO-001',
        name: 'Central Connaught Sensor',
        type: 'AirRoute Pro',
        owner: demoUserId,
        lat: 28.6315,
        lon: 77.2167,
        pub: 1,
        mask: 1,
      },
      {
        code: 'AIR-MINI-002',
        key: 'KEY-MINI-002',
        name: 'Hauz Khas Green Pod',
        type: 'AirRoute Mini',
        owner: demoUserId,
        lat: 28.5494,
        lon: 77.2001,
        pub: 1,
        mask: 1,
      },
      {
        code: 'AIR-POC-003',
        key: 'KEY-POC-003',
        name: 'Dwarka Commuter Mobile Unit',
        type: 'AirRoute Pocket',
        owner: demoUserId,
        lat: 28.5921,
        lon: 77.0460,
        pub: 1,
        mask: 0,
      },
      {
        code: 'AIR-PRO-004',
        key: 'KEY-PRO-004',
        name: 'Cyber Hub Tech Sensor',
        type: 'AirRoute Pro',
        owner: null,
        lat: 28.4950,
        lon: 77.0890,
        pub: 1,
        mask: 1,
      },
      {
        code: 'AIR-MINI-005',
        key: 'KEY-MINI-005',
        name: 'Noida Sector 62 Station',
        type: 'AirRoute Mini',
        owner: null,
        lat: 28.6255,
        lon: 77.3685,
        pub: 1,
        mask: 1,
      },
      {
        code: 'AIR-PRO-006',
        key: 'KEY-PRO-006',
        name: 'Rohini North Monitor',
        type: 'AirRoute Pro',
        owner: null,
        lat: 28.7150,
        lon: 77.1150,
        pub: 0, // Private opt-out test device
        mask: 1,
      },
    ];

    for (const d of devicesData) {
      const devRes = insertDevice.run(
        d.code,
        crypto.createHash('sha256').update(d.key).digest('hex'),
        d.name,
        d.type,
        d.owner,
        d.lat,
        d.lon,
        d.pub,
        d.mask,
        'online'
      );
      const devId = devRes.lastInsertRowid;

      // Seed 12 Historical Readings For Each Device
      for (let h = 12; h >= 0; h--) {
        const timeOffset = `-${h} hours`;
        const pm25 = Math.round(180 + Math.sin(h / 2) * 50 + Math.random() * 20);
        const pm10 = Math.round(pm25 * 1.6 + Math.random() * 30);
        const co2 = Math.round(420 + Math.sin(h / 3) * 80 + Math.random() * 30);
        const temp = +(22 + Math.cos(h / 4) * 4).toFixed(1);
        const hum = +(65 + Math.sin(h / 3) * 15).toFixed(1);
        const pres = 1012;
        insertTelemetry.run(devId, pm25, pm10, co2, temp, hum, pres, timeOffset);
      }
    }

    console.log('[Database] Seeded 2 Users, 6 AirRoute Devices, And Historical Telemetry.');
  }
}

InitDatabase();

module.exports = {
  db,
  HashPassword,
  VerifyPassword,
};
