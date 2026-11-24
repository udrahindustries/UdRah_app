# AirRoute: Map-First AQI & IoT Platform — Complete Architecture & Implementation Manual

**Document Reference:** `AirRoute_Map_First_AQI_IoT_App_Plan.pdf` & System Architecture Specification  
**Current State:** Total Base Fully Implemented, Integrated With Model 3 Spatial AQI Engine, And Verified End-To-End (100% Integration Tests Passing)  
**Core Technologies:** Node.js, Express, WebSocket, Python FastAPI, XGBoost, Vectorized IDW, Leaflet.js, Chart.js, SQLite / Spatial Indexing  

---

## 1. Architectural Blueprint & Component Map

The AirRoute Platform Realizes The Three-Phase Map-First Concept Specified In The Master Architecture Plan:

```
+-----------------------------------------------------------------------------------------+
|                                CLIENT APPLICATIONS                                      |
|   • Web Application (Map-First UI, Responsive Single Page App, Leaflet.js Canvas)      |
|   • Mobile App Ready (REST API + WebSocket Stream for React Native / Expo)              |
+-----------------------------------------------------------------------------------------+
                                          ▲
                                          │  HTTPS (REST) & WSS (WebSocket /ws)
                                          ▼
+-----------------------------------------------------------------------------------------+
|                             BACKEND SERVER (Node.js + Express)                          |
|   ├── Authentication Service       - JWT Tokens, PBKDF2 Password Hashing, RBAC          |
|   ├── AQI Data Service (Phase 1)   - Proxies Fixed Stations & Model 3 Spatial Surfaces  |
|   ├── Product Discovery (Phase 2)  - Geospatial Clustering, Opt-In Masking (~600m Ring) |
|   ├── Device Management (Phase 3)  - Hardware Serial & Auth Key Registration            |
|   ├── Private Telemetry (Phase 3)  - Time-Series Sensor Stream (Authorized Owner Only)  |
|   ├── IoT Ingestion Service        - Hardware Pre-Shared Key Verification (/api/iot)    |
|   └── WebSocket Telemetry Hub      - Real-Time Live Push Directly To User Dashboard     |
+-----------------------------------------------------------------------------------------+
              ▲                                                       ▲
              │ Internal HTTP Bridge                                  │ Hardware Ingestion
              ▼                                                       ▼
+---------------------------------------+             +-----------------------------------+
|      ML SERVICE (FastAPI / Model 3)   |             |   IoT SENSORS (AirRoute Products) |
|   • Two-Stage Spatial AQI Estimator   |             |   • AirRoute Pro                  |
|   • Stage 1: Vectorized IDW (K=8, 25km|             |   • AirRoute Mini                 |
|   • Stage 2: Contextual XGBoost Res.  |             |   • AirRoute Pocket               |
|   • 4-Factor Geometric Confidence     |             |   • Python Fleet Simulator CLI    |
|   • Continuous 2D GeoJSON Surface Grid|             |   (PM2.5, PM10, CO2, Temp, Hum)   |
+---------------------------------------+             +-----------------------------------+
```

---

## 2. Product Phases Implementation Details

### Phase 1 — AQI Map & Model 3 Spatial Surface
- **Fixed Station Layer:** Ingests and renders official real-time CAAQMS physical monitoring stations (DPCC, CPCB, IMD, HSPCB, UPPCB) across Delhi NCR with CPCB category color coding (Good to Severe).
- **Model 3 Spatial Surface:** Generates a continuous 2D spatial pollution surface grid (1.6 km resolution) directly connecting to our Stage 2 XGBoost residual model, bridging unmonitored geographic gaps across the National Capital Region.
- **Interactive Point Inspection:** Users can click any coordinate on the map to query Model 3 in real-time, receiving:
  - Final Estimated AQI (Clamped to $[0, 500]$)
  - Geometric Confidence Score in $[0.0, 1.0]$
  - Baseline Stage 1 IDW Estimate
  - Contextual Residual Shift
  - Nearest Monitoring Station Distance
  - Identified Dominant Pollutant (PM2.5 / PM10)

### Phase 2 — Nearby AirRoute Products Discovery Map
- **Location-Based Product Discovery:** Displays active AirRoute hardware devices in the area with an interactive discovery toggle.
- **Strict Privacy Safeguards (Enforced by Backend):**
  1. **Opt-in Visibility:** Only devices with `is_public_discovery === 1` appear on the map.
  2. **Location Masking:** If `location_masking === 1`, exact coordinates are obfuscated using a deterministic 500m–900m privacy jitter and surrounded by a visual privacy ring. Exact home or room coordinates are never revealed.
  3. **Zero Telemetry Leakage:** The discovery endpoint returns device metadata only (Name, Model, Status, Distance). Sensor readings (`pm2_5`, `co2`, etc.) are **never** exposed in public discovery queries.

### Phase 3 — My Devices Dashboard & Private Telemetry
- **Private Hardware Dashboard:** Authenticated users can view live sensor readings for their own registered devices.
- **Ownership Authorization:** The backend checks device ownership (`device.owner_id === req.user.id`) on every telemetry request. Unauthorized users receive `403 Forbidden`.
- **Live Time-Series Graphs:** Interactive multi-channel timeline graphs (PM2.5, PM10, CO2, Temperature, Humidity) powered by Chart.js.
- **Device Claiming & Registration:** Users claim new hardware products by providing the unique Device Serial Code and hardware Pre-Shared Secret Key.
- **Real-Time WebSocket Stream:** As hardware devices transmit readings, the WebSocket hub immediately pushes updates to the owner's open dashboard with zero polling delay.

---

## 3. REST API Endpoint Reference

### 3.1 Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/auth/register` | Register new user account (`email`, `password`, `full_name`) | No |
| `POST` | `/api/auth/login` | Login and receive signed JWT token | No |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Yes (Bearer Token) |

### 3.2 AQI Data Service (`/api/aqi`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/aqi/stations` | List physical CAAQMS stations with current pollutant readings | No |
| `POST` | `/api/aqi/estimate` | Point AQI query using Model 3 (`latitude`, `longitude`, `use_stage_two`) | No |
| `GET` | `/api/aqi/surface` | Continuous 2D GeoJSON spatial surface matrix across Delhi NCR | No |

### 3.3 Product Discovery (`/api/discovery`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/discovery/nearby` | Nearby AirRoute products with location masking & zero telemetry leak | No |
| `GET` | `/api/discovery/clusters` | Area-level product density bins and counts | No |

### 3.4 Device Management & Private Telemetry (`/api/devices`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/devices` | List authenticated user's registered devices and latest readings | Yes |
| `POST` | `/api/devices/register` | Claim hardware device (`device_code`, `auth_key`, `custom_name`, `lat`, `lon`) | Yes |
| `PUT` | `/api/devices/:id/visibility` | Update privacy settings (`is_public_discovery`, `location_masking`) | Yes (Owner) |
| `GET` | `/api/devices/:id/telemetry` | Private time-series sensor history (`limit=24`) | Yes (Owner) |

### 3.5 IoT Hardware Ingestion (`/api/iot`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/iot/ingest` | Secure hardware telemetry ingestion (`device_code`, `auth_key`, sensor readings) | Hardware Key |

---

## 4. How To Run & Operate The Platform

### Quick Launch (Master Orchestrator)
Execute the single-command launcher to boot both the Python ML Service and the Node.js Express Server:

```bash
python run_platform.py
```
*Or double-click `start_platform.bat` on Windows.*

The orchestrator will:
1. Boot the Model 3 FastAPI microservice on `http://127.0.0.1:8000`.
2. Boot the Node.js Express & WebSocket server on `http://127.0.0.1:5000`.
3. Open the interactive map-first web app automatically in your default browser.

### Run Automated Integration Tests
Verify the entire end-to-end platform (Auth, Phase 1, Phase 2, Phase 3, IoT Ingestion, and Privacy Enforcement):

```bash
node Backend/tests/integration.js
```

### Run IoT Hardware Fleet Simulator
Simulate live AirRoute hardware products transmitting real-time sensor packets:

```bash
python IoT/simulator.py --url http://127.0.0.1:5000 --interval 3.0 --count 5
```

---

## 5. Seeded Demo Accounts & Devices

For Instant Testing Out Of The Box:
- **Demo User:** `demo@airroute.io` / `Password123!` (Pre-configured with 3 owned devices).
- **Admin User:** `admin@airroute.io` / `Password123!`.
- **Pre-Configured Hardware Products:**
  - `AIR-PRO-001` (Key: `KEY-PRO-001`) — Central Connaught Sensor (AirRoute Pro)
  - `AIR-MINI-002` (Key: `KEY-MINI-002`) — Hauz Khas Green Pod (AirRoute Mini)
  - `AIR-POC-003` (Key: `KEY-POC-003`) — Dwarka Commuter Mobile Unit (AirRoute Pocket)
  - `AIR-PRO-004` (Key: `KEY-PRO-004`) — Cyber Hub Tech Sensor (Unclaimed — ready for registration testing)
