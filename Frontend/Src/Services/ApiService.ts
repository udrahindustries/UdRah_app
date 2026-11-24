// Central API Client For AirRoute Services
// Communicates With Node.js Backend And Dispatches REST Requests

const BASE_URL = '';

export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
}

export interface AqiStation {
  id: number;
  station_name: string;
  station_code: string;
  latitude: number;
  longitude: number;
  city: string;
  current_aqi: number;
  dominant_pollutant: string;
  last_updated: string;
}

export interface SpatialEstimate {
  latitude: number;
  longitude: number;
  estimated_aqi: number;
  category: string;
  confidence_score: number;
  stage1_idw_aqi: number;
  stage2_residual_correction: number;
  model_pipeline: string;
  nearest_station_km: number;
  nearest_station_name: string;
  dominant_pollutant: string;
  pollutant_breakdown: Record<string, number>;
  health_advisory: string;
}

export interface DiscoveredDevice {
  id: number;
  device_code: string;
  name: string;
  model_type: string;
  approx_latitude: number;
  approx_longitude: number;
  distance_km: number;
  status: string;
  last_seen: string;
  is_approximate_location: boolean;
}

export interface MyDevice {
  id: number;
  device_code: string;
  name: string;
  model_type: string;
  lat: number;
  lon: number;
  is_public_discovery: number;
  location_masking: number;
  status: string;
  last_seen: string;
  created_at: string;
}

export interface TelemetryReading {
  id: number;
  device_id: number;
  pm2_5: number;
  pm10: number;
  co2: number;
  temperature: number;
  humidity: number;
  pressure: number;
  recorded_at: string;
}

export interface AdminMetrics {
  total_users: number;
  total_devices: number;
  online_devices: number;
  offline_devices: number;
  telemetry_packets_ingested: number;
  system_uptime: number;
}

export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  created_at: string;
  registered_device_count: number;
}

export interface ModelDiagnostics {
  status: string;
  acceptance_gate_passed: boolean;
  performance_improvement: {
    mae_reduction_points: number;
    mae_reduction_percentage: number;
    rmse_reduction_points: number;
    rmse_reduction_percentage: number;
    category_accuracy_gain_percentage: number;
  };
  stage1_idw_metrics: {
    mae: number;
    rmse: number;
    r2: number;
    category_accuracy_pct: number;
  };
  stage2_xgb_metrics: {
    mae: number;
    rmse: number;
    r2: number;
    category_accuracy_pct: number;
  };
  spatial_residual_autocorrelation: {
    morans_i: number;
    spatial_structure_detected: boolean;
  };
}

// Request Helper With Bearer Authentication
async function FetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('airroute_token');
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = data.error || 'Network Request Failed In AirRoute Client';
    console.error(`API Error On ${path}: ${errorMessage}`);
    throw new Error(errorMessage);
  }

  return data as T;
}

export const ApiService = {
  // Authentication Endpoints
  async Login(email: string, password: string): Promise<{ token: string; user: UserProfile }> {
    console.log('Dispatching User Authentication Request');
    return FetchJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async Register(email: string, password: string, fullName: string): Promise<{ token: string; user: UserProfile }> {
    console.log('Registering New AirRoute Account');
    return FetchJson('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
  },

  async GetProfile(): Promise<{ user: UserProfile }> {
    return FetchJson('/api/auth/me');
  },

  // AQI Map Endpoints
  async GetStations(): Promise<{ stations: AqiStation[] }> {
    return FetchJson('/api/aqi/stations');
  },

  async EstimatePoint(latitude: number, longitude: number, useStageTwo: boolean = true): Promise<SpatialEstimate> {
    return FetchJson('/api/aqi/estimate', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, use_stage_two: useStageTwo }),
    });
  },

  async GetSurface(latStep: number = 0.03, lonStep: number = 0.03): Promise<any> {
    return FetchJson(`/api/aqi/surface?lat_step=${latStep}&lon_step=${lonStep}`);
  },

  // Product Discovery Endpoints
  async GetNearbyDevices(lat: number = 28.6139, lon: number = 77.2090, radiusKm: number = 30): Promise<{ devices: DiscoveredDevice[] }> {
    return FetchJson(`/api/discovery/nearby?lat=${lat}&lon=${lon}&radius_km=${radiusKm}`);
  },

  // My Devices Endpoints
  async GetMyDevices(): Promise<{ devices: MyDevice[] }> {
    return FetchJson('/api/devices');
  },

  async RegisterDevice(deviceCode: string, authKey: string, customName?: string, lat?: number, lon?: number): Promise<{ device: MyDevice }> {
    console.log(`Registering Hardware Sensor: ${deviceCode}`);
    return FetchJson('/api/devices/register', {
      method: 'POST',
      body: JSON.stringify({ device_code: deviceCode, auth_key: authKey, custom_name: customName, lat, lon }),
    });
  },

  async UpdateDeviceVisibility(deviceId: number, isPublic: boolean, locationMasking: boolean): Promise<{ device: MyDevice }> {
    return FetchJson(`/api/devices/${deviceId}/visibility`, {
      method: 'PUT',
      body: JSON.stringify({ is_public_discovery: isPublic, location_masking: locationMasking }),
    });
  },

  async GetDeviceTelemetry(deviceId: number, limit: number = 20): Promise<{ readings: TelemetryReading[] }> {
    return FetchJson(`/api/devices/${deviceId}/telemetry?limit=${limit}`);
  },

  async SendTestBurst(deviceCode: string, authKey: string): Promise<any> {
    console.log(`Sending Realtime Sensor Packet For ${deviceCode}`);
    return FetchJson('/api/iot/ingest', {
      method: 'POST',
      body: JSON.stringify({
        device_code: deviceCode,
        auth_key: authKey,
        pm2_5: Math.round(140 + Math.random() * 80),
        pm10: Math.round(220 + Math.random() * 110),
        co2: Math.round(410 + Math.random() * 70),
        temperature: parseFloat((23.0 + Math.random() * 4.0).toFixed(1)),
        humidity: parseFloat((58.0 + Math.random() * 10.0).toFixed(1)),
        pressure: 1012.4,
      }),
    });
  },

  // Admin Portal Endpoints
  async GetAdminOverview(): Promise<{ metrics: AdminMetrics; latest_telemetry_stream: any[] }> {
    return FetchJson('/api/admin/overview');
  },

  async GetAdminUsers(): Promise<{ users: AdminUser[] }> {
    return FetchJson('/api/admin/users');
  },

  async UpdateUserRole(userId: number, role: 'user' | 'admin'): Promise<any> {
    console.log(`Updating User ${userId} Role To ${role}`);
    return FetchJson(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  async GetAdminDevices(): Promise<{ devices: any[] }> {
    return FetchJson('/api/admin/devices');
  },

  async ProvisionDevice(deviceData: { device_code: string; auth_key: string; name: string; model_type?: string; lat?: number; lon?: number }): Promise<any> {
    console.log(`Provisioning New Fleet Device: ${deviceData.device_code}`);
    return FetchJson('/api/admin/devices', {
      method: 'POST',
      body: JSON.stringify(deviceData),
    });
  },

  async DecommissionDevice(deviceId: number): Promise<any> {
    console.log(`Decommissioning Fleet Device ${deviceId}`);
    return FetchJson(`/api/admin/devices/${deviceId}`, {
      method: 'DELETE',
    });
  },

  async GetRecentTelemetry(limit: number = 30): Promise<{ stream: any[] }> {
    return FetchJson(`/api/admin/telemetry/recent?limit=${limit}`);
  },

  async GetModelDiagnostics(): Promise<ModelDiagnostics> {
    return FetchJson('/api/admin/ml/diagnostics');
  },
};
