// Main Application Container Component For AirRoute Corporate Web Platform
// Integrates Authentication, Geospatial Map, Device Dashboard, Discovery, And Admin Console

import React, { useState, useEffect } from 'react';
import {
  ApiService,
  UserProfile,
  AqiStation,
  DiscoveredDevice,
  MyDevice,
  SpatialEstimate,
  TelemetryReading,
} from './Services/ApiService';
import { WebSocketService } from './Services/WebSocketService';
import { Navbar } from './Components/Navbar/Navbar';
import { AqiMap } from './Components/Map/AqiMap';
import { DeviceDashboard } from './Components/Dashboard/DeviceDashboard';
import { DiscoveryList } from './Components/Discovery/DiscoveryList';
import { AdminPanel } from './Components/Admin/AdminPanel';
import { AuthModal } from './Components/Auth/AuthModal';

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<'map' | 'discovery' | 'devices' | 'admin'>('map');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Core Data States
  const [stations, setStations] = useState<AqiStation[]>([]);
  const [surfaceGeoJson, setSurfaceGeoJson] = useState<any>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [myDevices, setMyDevices] = useState<MyDevice[]>([]);
  const [latestPacket, setLatestPacket] = useState<TelemetryReading | undefined>(undefined);

  // 1. Authenticate Initial User Session
  useEffect(() => {
    const token = localStorage.getItem('airroute_token');
    if (token) {
      ApiService.GetProfile()
        .then((res) => {
          setCurrentUser(res.user);
          console.log(`User Session Verified: ${res.user.email} (${res.user.role})`);
        })
        .catch(() => {
          localStorage.removeItem('airroute_token');
          setCurrentUser(null);
        });
    }
  }, []);

  // 2. Fetch Fixed CAAQMS Stations & Model 3 Surface Grid
  useEffect(() => {
    ApiService.GetStations()
      .then((res) => {
        setStations(res.stations);
        console.log(`Loaded ${res.stations.length} Physical Monitoring Stations`);
      })
      .catch((err) => console.error('Failed To Fetch Physical Monitoring Stations'));

    ApiService.GetSurface(0.04, 0.04)
      .then((data) => {
        setSurfaceGeoJson(data);
        console.log(`Loaded Model 3 2D Spatial Surface Grid (${data?.features?.length || 0} Cells)`);
      })
      .catch((err) => console.error('Failed To Fetch Model 3 Spatial Surface'));

    ApiService.GetNearbyDevices()
      .then((res) => {
        setDiscoveredDevices(res.devices);
        console.log(`Loaded ${res.devices.length} Public Community AirRoute Devices`);
      })
      .catch((err) => console.error('Failed To Fetch Community Devices'));
  }, []);

  // 3. Fetch User Owned Hardware Devices When Authenticated
  useEffect(() => {
    if (currentUser) {
      ApiService.GetMyDevices()
        .then((res) => {
          setMyDevices(res.devices);
          console.log(`Loaded ${res.devices.length} Private Hardware Devices For User`);
        })
        .catch(() => setMyDevices([]));
    } else {
      setMyDevices([]);
    }
  }, [currentUser]);

  // 4. Subscribe To Realtime Telemetry WebSocket Broadcasts
  useEffect(() => {
    const unsubscribe = WebSocketService.Subscribe((packet: any) => {
      console.log(`Incoming Sensor Telemetry Packet From ${packet.device_code}`);
      setLatestPacket(packet);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Coordinate Selection Handler (Triggers Model 3 Point Inference)
  const handleSelectCoordinate = async (lat: number, lon: number): Promise<SpatialEstimate> => {
    console.log(`Inquiring Model 3 Estimate At ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    return ApiService.EstimatePoint(lat, lon, true);
  };

  const handleLogout = () => {
    localStorage.removeItem('airroute_token');
    setCurrentUser(null);
    setActiveView('map');
    console.log('User Signed Out Successfully');
  };

  const handleDeviceClaimed = (newDevice: MyDevice) => {
    setMyDevices((prev) => [newDevice, ...prev]);
    console.log(`New Device Claimed: ${newDevice.device_code}`);
  };

  const handleFocusDiscoveredDevice = (device: DiscoveredDevice) => {
    setActiveView('map');
  };

  const handleSearchLocation = (query: string) => {
    setActiveView('map');
    console.log(`Searching Location: ${query}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Top Corporate Navigation */}
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        deviceCount={myDevices.length}
        onSearchLocation={handleSearchLocation}
      />

      {/* Main View Router */}
      <main className="flex-1 relative">
        {activeView === 'map' && (
          <AqiMap
            stations={stations}
            discoveredDevices={discoveredDevices}
            onSelectCoordinate={handleSelectCoordinate}
            surfaceGeoJson={surfaceGeoJson}
            showDiscovery={false}
          />
        )}

        {activeView === 'discovery' && (
          <DiscoveryList
            devices={discoveredDevices}
            onFocusDevice={handleFocusDiscoveredDevice}
          />
        )}

        {activeView === 'devices' && (
          <DeviceDashboard
            devices={myDevices}
            onDeviceClaimed={handleDeviceClaimed}
            latestTelemetry={latestPacket}
          />
        )}

        {activeView === 'admin' && (
          <AdminPanel
            currentUserRole={currentUser?.role || null}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}
      </main>

      {/* Global Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
      />
    </div>
  );
};
