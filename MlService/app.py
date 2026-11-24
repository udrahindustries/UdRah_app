"""
AirRoute Model 3 Spatial AQI Estimation Microservice.
High-Performance FastAPI Service Wrapping Model 3 (Stage 1 IDW + Stage 2 XGBoost Residual).
Provides Point Queries, Continuous 2D Grids, GeoJSON Surface, And Monitoring Stations.
"""

import sys
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# Ensure Workspace Root Is In Python Module Search Path
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
if str(WORKSPACE_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKSPACE_ROOT))

from Model3.Src.Predict import SpatialAqiPredictor
from Model3.Src.Config import REGION_BOUNDS, GRID_CONFIG


# Initialize FastAPI Application
app = FastAPI(
    title="AirRoute ML Service - Model 3 Spatial AQI Engine",
    description="Spatial Air Quality Estimation API Powered By Two-Stage IDW + XGBoost Residual Correction",
    version="3.0.0",
)

# Enable CORS For Frontend & Node.js Backend Gateway
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Predictor Instance (Initialized At Startup)
PredictorService: Optional[SpatialAqiPredictor] = None


@app.on_event("startup")
def StartupEvent():
    global PredictorService
    print("[ML Service] Initializing SpatialAqiPredictor...")
    PredictorService = SpatialAqiPredictor()
    print(f"[ML Service] Model 3 Loaded. Latest Station Count: {len(PredictorService.LatestObservations)}")


class PointQueryRequest(BaseModel):
    latitude: float = Field(..., ge=20.0, le=35.0, description="Target Latitude Coordinate")
    longitude: float = Field(..., ge=70.0, le=85.0, description="Target Longitude Coordinate")
    use_stage_two: bool = Field(default=True, description="Apply Stage 2 XGBoost Residual Correction")
    temperature: Optional[float] = Field(default=None, description="Optional Ambient Temperature Override")
    humidity: Optional[float] = Field(default=None, description="Optional Ambient Relative Humidity Override")
    wind_speed: Optional[float] = Field(default=None, description="Optional Wind Speed Override")


class GridQueryRequest(BaseModel):
    lat_step: float = Field(default=0.02, ge=0.005, le=0.10, description="Latitude Grid Resolution In Degrees")
    lon_step: float = Field(default=0.02, ge=0.005, le=0.10, description="Longitude Grid Resolution In Degrees")
    use_stage_two: bool = Field(default=True, description="Apply Stage 2 XGBoost Residual Correction")


@app.get("/health")
def HealthCheck() -> Dict[str, Any]:
    """Health Check Endpoint For Container Orchestration And Gateway Heartbeats."""
    global PredictorService
    ModelLoaded = PredictorService is not None and PredictorService.ResidualModel is not None
    StationCount = len(PredictorService.LatestObservations) if PredictorService else 0
    return {
        "status": "healthy",
        "service": "AirRoute ML Service (Model 3)",
        "model_loaded": ModelLoaded,
        "station_count": StationCount,
        "region_bounds": REGION_BOUNDS,
    }


@app.get("/api/ml/stations")
def GetMonitoringStations() -> List[Dict[str, Any]]:
    """Return All Fixed Physical CAAQMS Monitoring Stations With Latest Synchronized Readings."""
    global PredictorService
    if not PredictorService:
        raise HTTPException(status_code=503, detail="ML Service Still Initializing")

    Stations = []
    for _, Row in PredictorService.LatestObservations.iterrows():
        Stations.append({
            "station_id": str(Row["station_id"]),
            "station_name": str(Row["station_name"]),
            "latitude": float(Row["latitude"]),
            "longitude": float(Row["longitude"]),
            "aqi": round(float(Row["aqi"]), 1) if not pd.isna(Row["aqi"]) else None,
            "pm2_5": round(float(Row["pm2_5"]), 1) if not pd.isna(Row["pm2_5"]) else None,
            "pm10": round(float(Row["pm10"]), 1) if not pd.isna(Row["pm10"]) else None,
            "temperature": round(float(Row["temperature"]), 1) if "temperature" in Row and not pd.isna(Row["temperature"]) else None,
            "humidity": round(float(Row["humidity"]), 1) if "humidity" in Row and not pd.isna(Row["humidity"]) else None,
            "wind_speed": round(float(Row["wind_speed"]), 1) if "wind_speed" in Row and not pd.isna(Row["wind_speed"]) else None,
            "qc_flag": str(Row.get("qc_flag", "VALID")),
            "timestamp": str(Row.get("timestamp", "")),
        })
    return Stations


@app.post("/api/ml/spatial/point")
def EstimatePointAqi(Payload: PointQueryRequest) -> Dict[str, Any]:
    """Estimate AQI At An Arbitrary Coordinate Using Two-Stage IDW + XGBoost Residual Model."""
    global PredictorService
    if not PredictorService:
        raise HTTPException(status_code=503, detail="ML Service Still Initializing")

    ContextMeteorology = None
    if any(Val is not None for Val in (Payload.temperature, Payload.humidity, Payload.wind_speed)):
        ContextMeteorology = {}
        if Payload.temperature is not None:
            ContextMeteorology["temperature"] = Payload.temperature
        if Payload.humidity is not None:
            ContextMeteorology["humidity"] = Payload.humidity
        if Payload.wind_speed is not None:
            ContextMeteorology["wind_speed"] = Payload.wind_speed

    PointResult = PredictorService.PredictPoint(
        TargetLatitude=Payload.latitude,
        TargetLongitude=Payload.longitude,
        UseStageTwo=Payload.use_stage_two,
        ContextMeteorology=ContextMeteorology,
    )
    return PointResult


@app.get("/api/ml/spatial/point")
def EstimatePointAqiGet(
    lat: float = Query(..., ge=20.0, le=35.0),
    lon: float = Query(..., ge=70.0, le=85.0),
    stage2: bool = Query(default=True),
) -> Dict[str, Any]:
    """Convenience GET Endpoint For Coordinate Point Queries."""
    return EstimatePointAqi(PointQueryRequest(latitude=lat, longitude=lon, use_stage_two=stage2))


@app.get("/api/ml/spatial/geojson")
def GetSpatialSurfaceGeoJson(
    lat_step: float = Query(default=0.02, ge=0.01, le=0.05),
    lon_step: float = Query(default=0.02, ge=0.01, le=0.05),
    stage2: bool = Query(default=True),
) -> Dict[str, Any]:
    """Generate Continuous 2D Pollution Surface Matrix As Standard GeoJSON FeatureCollection."""
    global PredictorService
    if not PredictorService:
        raise HTTPException(status_code=503, detail="ML Service Still Initializing")

    GridDataFrame = PredictorService.PredictGrid(
        LatitudeStep=lat_step,
        LongitudeStep=lon_step,
        UseStageTwo=stage2,
    )
    GeoJsonResult = PredictorService.ExportGridToGeoJson(GridDataFrame)
    return GeoJsonResult


@app.get("/api/ml/diagnostics")
def GetModelDiagnostics() -> Dict[str, Any]:
    """Return Verified Model 3 Metrics, Acceptance Audit, Moran's I, And Feature Manifest."""
    metrics_path = WORKSPACE_ROOT / "Model3" / "Results" / "XgbMetrics.json"
    if metrics_path.exists():
        with open(metrics_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"status": "NOT_AVAILABLE", "message": "Model 3 metrics artifact not found."}


if __name__ == "__main__":
    import pandas as pd
    uvicorn.run(app, host="127.0.0.1", port=8000)
else:
    import pandas as pd
