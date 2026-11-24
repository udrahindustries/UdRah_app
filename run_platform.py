"""
AirRoute: Corporate React Platform & Master Orchestrator.
Starts Both:
1. Python ML Service (Model 3 Spatial AQI API On http://127.0.0.1:8000)
2. Node.js Express & WebSocket Server (React Client On http://127.0.0.1:5000)
"""

import os
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent

def Main():
    print("===================================================================")
    print("      AirRoute: Map-First AQI & IoT Platform — Live System         ")
    print("===================================================================")

    # 0. Ensure Frontend React Bundle Exists
    frontend_dist = ROOT_DIR / "Frontend" / "Dist"
    if not frontend_dist.exists():
        print("[0/2] Building Production React SPA In Frontend/...")
        subprocess.run(["npm", "run", "build"], cwd=str(ROOT_DIR / "Frontend"), shell=True, check=True)
        print("✔ React SPA Compiled Successfully.")

    print("Starting Model 3 ML Service & Node.js Express Backend...")

    # 1. Start Python FastAPI ML Service
    ml_env = os.environ.copy()
    ml_env["PYTHONPATH"] = str(ROOT_DIR)
    ml_process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "MlService.app:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=str(ROOT_DIR),
        env=ml_env,
    )
    print("[1/2] ML Service (Model 3) Launched on http://127.0.0.1:8000")

    time.sleep(2)

    # 2. Start Node.js Express Backend & Web App
    node_env = os.environ.copy()
    node_env["PORT"] = "5000"
    node_env["ML_SERVICE_URL"] = "http://127.0.0.1:8000"
    backend_process = subprocess.Popen(
        ["node", "Backend/src/server.js"],
        cwd=str(ROOT_DIR),
        env=node_env,
    )
    print("[2/2] Backend Server & Web App Launched on http://127.0.0.1:5000")

    print("\n-------------------------------------------------------------------")
    print("  Platform Ready! Open http://127.0.0.1:5000 in your browser.     ")
    print("  Press Ctrl+C in this terminal to shut down both services.        ")
    print("-------------------------------------------------------------------")

    time.sleep(1)
    webbrowser.open("http://127.0.0.1:5000")

    try:
        backend_process.wait()
    except KeyboardInterrupt:
        print("\n[Shutdown] Shutting down AirRoute platform services...")
        backend_process.terminate()
        ml_process.terminate()
        print("[Shutdown] All services stopped cleanly.")


if __name__ == "__main__":
    Main()
