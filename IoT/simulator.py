"""
AirRoute IoT Hardware Telemetry Simulator.
Simulates Periodic Wi-Fi/Cellular Environmental Sensor Transmissions
From AirRoute Products (AirRoute Pro, AirRoute Mini, AirRoute Pocket)
To The Backend Ingestion Endpoint (/api/iot/ingest).
"""

import argparse
import json
import math
import random
import time
import urllib.request
import urllib.error
from datetime import datetime


SIMULATED_DEVICES = [
    {"code": "AIR-PRO-001", "key": "KEY-PRO-001", "name": "Central Connaught Sensor", "base_pm25": 190.0},
    {"code": "AIR-MINI-002", "key": "KEY-MINI-002", "name": "Hauz Khas Green Pod", "base_pm25": 145.0},
    {"code": "AIR-POC-003", "key": "KEY-POC-003", "name": "Dwarka Commuter Mobile Unit", "base_pm25": 210.0},
    {"code": "AIR-PRO-004", "key": "KEY-PRO-004", "name": "Cyber Hub Tech Sensor", "base_pm25": 165.0},
    {"code": "AIR-MINI-005", "key": "KEY-MINI-005", "name": "Noida Sector 62 Station", "base_pm25": 230.0},
]


def SendTelemetryPacket(backend_url: str, device: dict, cycle_index: int) -> bool:
    """Send A Single Simulated Telemetry Packet To The Ingestion API."""
    hour = datetime.now().hour
    # Diurnal Traffic Spike (Morning 8-10, Evening 18-21)
    traffic_factor = 1.35 if (8 <= hour <= 11 or 18 <= hour <= 21) else 1.0

    pm25 = round(device["base_pm25"] * traffic_factor + random.uniform(-15.0, 20.0), 1)
    pm10 = round(pm25 * 1.62 + random.uniform(-10.0, 25.0), 1)
    co2 = round(420.0 + (math.sin(cycle_index * 0.2) * 80.0) + random.uniform(-15.0, 15.0), 1)
    temperature = round(22.0 + math.sin(hour / 24.0 * math.pi) * 6.0 + random.uniform(-0.5, 0.5), 1)
    humidity = round(65.0 - math.sin(hour / 24.0 * math.pi) * 15.0 + random.uniform(-2.0, 2.0), 1)
    pressure = round(1012.0 + random.uniform(-1.0, 1.0), 1)

    payload = {
        "device_code": device["code"],
        "auth_key": device["key"],
        "pm2_5": pm25,
        "pm10": pm10,
        "co2": co2,
        "temperature": temperature,
        "humidity": humidity,
        "pressure": pressure,
    }

    url = f"{backend_url.rstrip('/')}/api/iot/ingest"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "AirRoute-IoT-Firmware/1.2"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 201:
                res_body = json.loads(response.read().decode("utf-8"))
                print(f"[IoT Hardware] [{device['code']}] -> Ingested Telemetry ID {res_body.get('telemetry_id')}: PM2.5={pm25} µg/m³, CO2={co2} ppm, Temp={temperature}°C")
                return True
    except urllib.error.HTTPError as http_err:
        print(f"[IoT Hardware] [{device['code']}] HTTP Error {http_err.code}: {http_err.read().decode('utf-8')}")
    except Exception as err:
        print(f"[IoT Hardware] [{device['code']}] Connection Error: {err}")

    return False


def RunSimulationLoop(backend_url: str, interval: float, iterations: int):
    """Run The Periodic Simulation Loop Across Registered Hardware Products."""
    print("===================================================================")
    print("        AirRoute: IoT Hardware Fleet Telemetry Simulator           ")
    print("===================================================================")
    print(f"Target Backend: {backend_url}")
    print(f"Simulating:     {len(SIMULATED_DEVICES)} Active AirRoute Hardware Products")
    print(f"Interval:       {interval} Seconds Between Cycles")
    print(f"Iterations:     {'Infinite' if iterations <= 0 else iterations}")
    print("===================================================================")

    cycle = 0
    try:
        while True:
            cycle += 1
            print(f"\n--- Transmitting Telemetry Burst (Cycle #{cycle}) ---")
            for dev in SIMULATED_DEVICES:
                SendTelemetryPacket(backend_url, dev, cycle)
                time.sleep(0.15)  # Staggered transmissions

            if iterations > 0 and cycle >= iterations:
                print("\n[Simulator] Completed Configured Number Of Iterations.")
                break

            time.sleep(interval)
    except KeyboardInterrupt:
        print("\n[Simulator] Telemetry Transmission Stopped By User.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AirRoute IoT Hardware Telemetry Simulator")
    parser.add_argument("--url", default="http://127.0.0.1:5000", help="Backend Server URL")
    parser.add_argument("--interval", type=float, default=5.0, help="Transmission Interval In Seconds")
    parser.add_argument("--count", type=int, default=1, help="Number Of Simulation Cycles (0 For Continuous)")
    args = parser.parse_args()

    RunSimulationLoop(backend_url=args.url, interval=args.interval, iterations=args.count)
