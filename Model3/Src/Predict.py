"""
High-Level Spatial Prediction Engine For AirRoute Model 3.
Provides Point-Level Coordinate Queries, Continuous 2D City-Wide Grid Surface Generation,
Geometric Confidence Scoring, And GeoJSON Spatial Export For Map Routing.
Integrates Stage 1 (Tuned IDW) And Stage 2 (XGBoost Residual Correction).
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
import xgboost as xgb

from Model3.Src.Config import (
    DEFAULT_K,
    DEFAULT_POWER,
    DEFAULT_RADIUS_KM,
    GRID_CONFIG,
    MIN_VALID_NEIGHBORS,
    REGION_BOUNDS,
    STATION_HISTORY_PARQUET,
    XGB_MODEL_FILE,
)
from Model3.Src.CpcbAqi import CalculateCpcbAqi, GetAqiCategory
from Model3.Src.Idw import IdwInterpolateGrid, IdwInterpolatePoint
from Model3.Src.TrainXgb import (
    CONNAUGHT_PLACE_LATITUDE,
    CONNAUGHT_PLACE_LONGITUDE,
    STAGE_TWO_FEATURE_NAMES,
    ExtractSpatialResidualFeatures,
)


class SpatialAqiPredictor:
    """
    Two-Stage Spatial AQI Prediction Service Across Delhi NCR.
    Stage 1: Vectorized Inverse Distance Weighting (IDW) Baseline.
    Stage 2: Contextual XGBoost Residual Correction With Environmental Dispersion.
    """

    def __init__(
        self,
        StationDataFilePath: Optional[Union[str, Path]] = None,
        ModelFilePath: Optional[Union[str, Path]] = None,
        AutoLoadStageTwo: bool = True,
    ):
        ResolvedDataPath = str(StationDataFilePath or STATION_HISTORY_PARQUET)
        self.DatasetDataFrame = pd.read_parquet(ResolvedDataPath)

        # Retain The Most Recent Synchronized Valid Observation For Each Station
        ValidObservations = self.DatasetDataFrame[self.DatasetDataFrame["qc_flag"] == "VALID"].sort_values("timestamp")
        self.LatestObservations = ValidObservations.groupby("station_id").last().reset_index()
        self.LatestTimestamp = ValidObservations["timestamp"].max()

        # Load Stage 2 Gradient Boosted Residual Model
        self.ResidualModel: Optional[xgb.XGBRegressor] = None
        ResolvedModelPath = Path(ModelFilePath or XGB_MODEL_FILE)
        if AutoLoadStageTwo and ResolvedModelPath.exists():
            try:
                LoadedModel = xgb.XGBRegressor()
                LoadedModel.load_model(str(ResolvedModelPath))
                self.ResidualModel = LoadedModel
            except Exception as ModelLoadError:
                print(f"[Warning] Failed To Load XGBoost Residual Artifact: {ModelLoadError}")
                self.ResidualModel = None

    def ComputeGeometricConfidence(
        self,
        Status: str,
        NearestDistanceKm: float,
        SearchRadiusKm: float,
        ValidNeighborCount: int,
        KNearest: int,
        NeighborStd: float = 0.0,
        ResidualMagnitude: float = 0.0,
    ) -> float:
        """
        Calculate Robust Multi-Factor Geometric Confidence Score In [0.0, 1.0].
        Incorporates Distance Decay, Neighbor Station Density, Spatial Variance,
        And Model Correction Magnitude.
        """
        if Status == "EXACT_MATCH":
            return 1.0
        if Status != "OK" or np.isnan(NearestDistanceKm):
            return 0.0

        # Factor 1: Distance Decay Monotonic Penalty
        DistanceFactor = float(np.clip(1.0 - (NearestDistanceKm / SearchRadiusKm), 0.0, 1.0))

        # Factor 2: Station Spatial Density Factor
        DensityFactor = float(np.clip(ValidNeighborCount / max(1, KNearest), 0.0, 1.0))

        # Factor 3: Neighbor Dispersion Consensus (Lower Standard Deviation Yields Higher Confidence)
        DispersionPenalty = float(np.clip(NeighborStd / 80.0, 0.0, 0.35))
        ConsensusFactor = max(0.0, 1.0 - DispersionPenalty)

        # Factor 4: Residual Stability (Large Spikes Slightly Reduce Confidence)
        StabilityFactor = float(np.clip(1.0 - (abs(ResidualMagnitude) / 150.0), 0.65, 1.0))

        # Weighted Synthesis
        CompositeConfidence = (
            0.45 * DistanceFactor
            + 0.30 * DensityFactor
            + 0.15 * ConsensusFactor
            + 0.10 * StabilityFactor
        )
        return round(float(np.clip(CompositeConfidence, 0.0, 1.0)), 3)

    def PredictPoint(
        self,
        TargetLatitude: float,
        TargetLongitude: float,
        ObservationTimestamp: Optional[Union[str, pd.Timestamp]] = None,
        KNearestNeighbors: int = DEFAULT_K,
        SearchRadiusKm: float = DEFAULT_RADIUS_KM,
        PowerExponent: float = DEFAULT_POWER,
        UseStageTwo: bool = True,
        ContextMeteorology: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """
        Estimate Air Quality Index And Health Descriptor At Any Unmonitored Coordinate.
        Runs Stage 1 Baseline And Applies Stage 2 XGBoost Residual Correction If Enabled.
        """
        StationLats = self.LatestObservations["latitude"].to_numpy()
        StationLons = self.LatestObservations["longitude"].to_numpy()
        StationAqis = self.LatestObservations["aqi"].to_numpy()
        StationPm25 = self.LatestObservations["pm2_5"].to_numpy()
        StationPm10 = self.LatestObservations["pm10"].to_numpy()
        StationIdentifiers = self.LatestObservations["station_id"].tolist()

        # 1. Primary Stage 1 Direct IDW Interpolation
        PointResult = IdwInterpolatePoint(
            TargetLatitude=TargetLatitude,
            TargetLongitude=TargetLongitude,
            StationLatitudes=StationLats,
            StationLongitudes=StationLons,
            StationValues=StationAqis,
            StationIdentifiers=StationIdentifiers,
            KNearest=KNearestNeighbors,
            MaxRadiusKm=SearchRadiusKm,
            DistancePower=PowerExponent,
            MinNeighbors=MIN_VALID_NEIGHBORS,
        )

        # 2. Stage 1 Pollutant-First Interpolation For Multi-Channel Consistency
        Pm25Result = IdwInterpolatePoint(
            TargetLatitude=TargetLatitude,
            TargetLongitude=TargetLongitude,
            StationLatitudes=StationLats,
            StationLongitudes=StationLons,
            StationValues=StationPm25,
            StationIdentifiers=StationIdentifiers,
            KNearest=KNearestNeighbors,
            MaxRadiusKm=SearchRadiusKm,
            DistancePower=PowerExponent,
            MinNeighbors=MIN_VALID_NEIGHBORS,
        )
        Pm10Result = IdwInterpolatePoint(
            TargetLatitude=TargetLatitude,
            TargetLongitude=TargetLongitude,
            StationLatitudes=StationLats,
            StationLongitudes=StationLons,
            StationValues=StationPm10,
            StationIdentifiers=StationIdentifiers,
            KNearest=KNearestNeighbors,
            MaxRadiusKm=SearchRadiusKm,
            DistancePower=PowerExponent,
            MinNeighbors=MIN_VALID_NEIGHBORS,
        )

        PollutantFirstAqi = PointResult.estimate
        DominantPollutant = "PM2.5"
        if Pm25Result.status == "OK" and Pm10Result.status == "OK":
            SubIndexResult, DominantKey, SubIndicesDict = CalculateCpcbAqi(
                {"pm2_5": Pm25Result.estimate, "pm10": Pm10Result.estimate},
                StrictCpcbRules=False,
            )
            PollutantFirstAqi = SubIndexResult if not np.isnan(SubIndexResult) else PointResult.estimate
            DominantPollutant = str(DominantKey).upper() if DominantKey else "PM2.5"

        # 3. Ambient Meteorology Aggregation From Neighbors Or Overrides
        ContextDict = ContextMeteorology or {}
        NeighborMask = np.isin(self.LatestObservations["station_id"], PointResult.neighbor_ids)
        NeighborRows = self.LatestObservations[NeighborMask] if np.any(NeighborMask) else self.LatestObservations

        TemperatureVal = ContextDict.get("temperature", float(NeighborRows["temperature"].mean()))
        HumidityVal = ContextDict.get("humidity", float(NeighborRows["humidity"].mean()))
        WindSpeedVal = ContextDict.get("wind_speed", float(NeighborRows["wind_speed"].mean()))
        WindDirVal = ContextDict.get("wind_direction", float(NeighborRows["wind_direction"].mean()))
        PressureVal = ContextDict.get("pressure", float(NeighborRows["pressure"].mean()))

        # 4. Temporal Features
        ResolvedTimestamp = pd.to_datetime(ObservationTimestamp or self.LatestTimestamp)
        HourOfDay = ResolvedTimestamp.hour
        IsRushHour = 1.0 if HourOfDay in (8, 9, 10, 11, 17, 18, 19, 20, 21) else 0.0

        # 5. Stage 2 XGBoost Residual Correction Inference
        PredictedResidual: float = 0.0
        StageLabel = "Stage 1 — Tuned IDW Baseline"

        if (
            UseStageTwo
            and self.ResidualModel is not None
            and PointResult.status in ("OK", "EXACT_MATCH")
            and not np.isnan(PointResult.estimate)
        ):
            # Geodetic Distance To Connaught Place
            DeltaLatKm = (TargetLatitude - CONNAUGHT_PLACE_LATITUDE) * 111.0
            DeltaLonKm = (TargetLongitude - CONNAUGHT_PLACE_LONGITUDE) * 111.0 * np.cos(np.radians(CONNAUGHT_PLACE_LATITUDE))
            DistCenterKm = float(np.sqrt(DeltaLatKm ** 2 + DeltaLonKm ** 2))

            WindRad = np.radians(WindDirVal)
            FeatureDict = {
                "idw_aqi_direct": PointResult.estimate,
                "idw_aqi_pollutant_first": PollutantFirstAqi,
                "pollutant_diff": PointResult.estimate - PollutantFirstAqi,
                "idw_pm2_5": Pm25Result.estimate if not np.isnan(Pm25Result.estimate) else PointResult.estimate * 0.60,
                "idw_pm10": Pm10Result.estimate if not np.isnan(Pm10Result.estimate) else PointResult.estimate * 1.15,
                "pm_ratio": (Pm25Result.estimate / (Pm10Result.estimate + 1e-4)) if not np.isnan(Pm10Result.estimate) else 0.55,
                "valid_neighbor_count": float(PointResult.valid_neighbor_count),
                "nearest_distance_km": PointResult.nearest_distance_km,
                "mean_distance_km": PointResult.mean_distance_km,
                "max_distance_km": PointResult.max_distance_km if not np.isnan(PointResult.max_distance_km) else PointResult.mean_distance_km,
                "neighbor_min_aqi": PointResult.neighbor_min,
                "neighbor_mean_aqi": PointResult.neighbor_mean,
                "neighbor_max_aqi": PointResult.neighbor_max,
                "neighbor_std_aqi": PointResult.neighbor_std,
                "neighbor_spread": PointResult.neighbor_max - PointResult.neighbor_min,
                "idw_vs_neighbor_mean": PointResult.estimate - PointResult.neighbor_mean,
                "temperature": TemperatureVal,
                "humidity": HumidityVal,
                "wind_speed": WindSpeedVal,
                "wind_dir_sin": float(np.sin(WindRad)),
                "wind_dir_cos": float(np.cos(WindRad)),
                "pressure": PressureVal,
                "stagnation_index": HumidityVal / (WindSpeedVal + 0.5),
                "hour": float(HourOfDay),
                "hour_sin": float(np.sin(2.0 * np.pi * HourOfDay / 24.0)),
                "hour_cos": float(np.cos(2.0 * np.pi * HourOfDay / 24.0)),
                "is_rush_hour": IsRushHour,
                "is_severe_episode": 1.0 if PointResult.estimate >= 300.0 else 0.0,
                "dist_center_km": DistCenterKm,
                "target_lat": TargetLatitude,
                "target_lon": TargetLongitude,
            }

            FeatureVectorDf = pd.DataFrame([FeatureDict])[STAGE_TWO_FEATURE_NAMES]
            PredictedResidual = float(self.ResidualModel.predict(FeatureVectorDf)[0])
            StageLabel = "Stage 2 — XGBoost Residual Corrected"

        # Final Estimated AQI Clamped To Official CPCB Bounds [0, 500]
        FinalAqiEstimate = (
            float(np.clip(PointResult.estimate + PredictedResidual, 0.0, 500.0))
            if not np.isnan(PointResult.estimate)
            else None
        )

        ConfidenceScore = self.ComputeGeometricConfidence(
            Status=PointResult.status,
            NearestDistanceKm=PointResult.nearest_distance_km,
            SearchRadiusKm=SearchRadiusKm,
            ValidNeighborCount=PointResult.valid_neighbor_count,
            KNearest=KNearestNeighbors,
            NeighborStd=PointResult.neighbor_std if not np.isnan(PointResult.neighbor_std) else 0.0,
            ResidualMagnitude=PredictedResidual,
        )

        CategoryDescriptor = GetAqiCategory(FinalAqiEstimate) if FinalAqiEstimate is not None else "Unknown"

        return {
            "latitude": TargetLatitude,
            "longitude": TargetLongitude,
            "estimated_aqi": round(FinalAqiEstimate, 1) if FinalAqiEstimate is not None else None,
            "stage1_idw_aqi": round(PointResult.estimate, 1) if not np.isnan(PointResult.estimate) else None,
            "residual_correction": round(PredictedResidual, 2),
            "aqi_category": CategoryDescriptor,
            "confidence_score": ConfidenceScore,
            "dominant_pollutant": DominantPollutant,
            "estimation_status": PointResult.status,
            "valid_neighbor_count": PointResult.valid_neighbor_count,
            "nearest_distance_km": round(PointResult.nearest_distance_km, 2) if not np.isnan(PointResult.nearest_distance_km) else None,
            "mean_distance_km": round(PointResult.mean_distance_km, 2) if not np.isnan(PointResult.mean_distance_km) else None,
            "neighbor_min_aqi": round(PointResult.neighbor_min, 1) if not np.isnan(PointResult.neighbor_min) else None,
            "neighbor_max_aqi": round(PointResult.neighbor_max, 1) if not np.isnan(PointResult.neighbor_max) else None,
            "neighbor_std_aqi": round(PointResult.neighbor_std, 2) if not np.isnan(PointResult.neighbor_std) else None,
            "idw_pm2_5": round(Pm25Result.estimate, 1) if not np.isnan(Pm25Result.estimate) else None,
            "idw_pm10": round(Pm10Result.estimate, 1) if not np.isnan(Pm10Result.estimate) else None,
            "observation_timestamp": str(ResolvedTimestamp),
            "is_point_estimate": True,
            "model_architecture_stage": StageLabel,
        }

    def PredictGrid(
        self,
        LatitudeStep: float = GRID_CONFIG["lat_step"],
        LongitudeStep: float = GRID_CONFIG["lon_step"],
        KNearestNeighbors: int = DEFAULT_K,
        SearchRadiusKm: float = DEFAULT_RADIUS_KM,
        PowerExponent: float = DEFAULT_POWER,
        UseStageTwo: bool = True,
        ObservationTimestamp: Optional[Union[str, pd.Timestamp]] = None,
    ) -> pd.DataFrame:
        """
        Generate City-Wide Continuous 2D AQI Surface Matrix Across Delhi NCR
        Using Fully Vectorized IDW Baseline And Fast Vectorized Stage 2 XGBoost Residuals.
        """
        LatitudeGridValues = np.arange(REGION_BOUNDS["lat_min"], REGION_BOUNDS["lat_max"] + 1e-5, LatitudeStep)
        LongitudeGridValues = np.arange(REGION_BOUNDS["lon_min"], REGION_BOUNDS["lon_max"] + 1e-5, LongitudeStep)
        MeshLatitudes, MeshLongitudes = np.meshgrid(LatitudeGridValues, LongitudeGridValues)
        FlattenedLatitudes = MeshLatitudes.ravel()
        FlattenedLongitudes = MeshLongitudes.ravel()

        StationLats = self.LatestObservations["latitude"].to_numpy()
        StationLons = self.LatestObservations["longitude"].to_numpy()
        StationAqis = self.LatestObservations["aqi"].to_numpy()
        StationPm25 = self.LatestObservations["pm2_5"].to_numpy()
        StationPm10 = self.LatestObservations["pm10"].to_numpy()
        StationIdentifiers = self.LatestObservations["station_id"].tolist()

        # Vectorized Direct IDW Surface
        Estimates, BaseConfidences, NeighborCounts = IdwInterpolateGrid(
            GridLatitudes=FlattenedLatitudes,
            GridLongitudes=FlattenedLongitudes,
            StationLatitudes=StationLats,
            StationLongitudes=StationLons,
            StationValues=StationAqis,
            StationIdentifiers=StationIdentifiers,
            KNearest=KNearestNeighbors,
            MaxRadiusKm=SearchRadiusKm,
            DistancePower=PowerExponent,
        )

        # Vectorized Pollutant IDW Surfaces
        Pm25Estimates, _, _ = IdwInterpolateGrid(
            GridLatitudes=FlattenedLatitudes,
            GridLongitudes=FlattenedLongitudes,
            StationLatitudes=StationLats,
            StationLongitudes=StationLons,
            StationValues=StationPm25,
            StationIdentifiers=StationIdentifiers,
            KNearest=KNearestNeighbors,
            MaxRadiusKm=SearchRadiusKm,
            DistancePower=PowerExponent,
        )
        Pm10Estimates, _, _ = IdwInterpolateGrid(
            GridLatitudes=FlattenedLatitudes,
            GridLongitudes=FlattenedLongitudes,
            StationLatitudes=StationLats,
            StationLongitudes=StationLons,
            StationValues=StationPm10,
            StationIdentifiers=StationIdentifiers,
            KNearest=KNearestNeighbors,
            MaxRadiusKm=SearchRadiusKm,
            DistancePower=PowerExponent,
        )

        ResolvedTimestamp = pd.to_datetime(ObservationTimestamp or self.LatestTimestamp)
        HourOfDay = float(ResolvedTimestamp.hour)
        IsRushHour = 1.0 if HourOfDay in (8, 9, 10, 11, 17, 18, 19, 20, 21) else 0.0

        MeanTemp = float(self.LatestObservations["temperature"].mean())
        MeanHum = float(self.LatestObservations["humidity"].mean())
        MeanWindSpeed = float(self.LatestObservations["wind_speed"].mean())
        MeanWindDir = float(self.LatestObservations["wind_direction"].mean())
        MeanPressure = float(self.LatestObservations["pressure"].mean())
        WindRad = np.radians(MeanWindDir)

        DeltaLatKm = (FlattenedLatitudes - CONNAUGHT_PLACE_LATITUDE) * 111.0
        DeltaLonKm = (FlattenedLongitudes - CONNAUGHT_PLACE_LONGITUDE) * 111.0 * np.cos(np.radians(CONNAUGHT_PLACE_LATITUDE))
        DistCenterKm = np.sqrt(DeltaLatKm ** 2 + DeltaLonKm ** 2)

        # Build Vectorized Feature Matrix For XGBoost Inference
        GridFeatureDf = pd.DataFrame({
            "idw_aqi_direct": Estimates,
            "idw_aqi_pollutant_first": Estimates,
            "pollutant_diff": np.zeros_like(Estimates),
            "idw_pm2_5": Pm25Estimates,
            "idw_pm10": Pm10Estimates,
            "pm_ratio": Pm25Estimates / (Pm10Estimates + 1e-4),
            "valid_neighbor_count": NeighborCounts.astype(float),
            "nearest_distance_km": SearchRadiusKm * (1.0 - BaseConfidences),
            "mean_distance_km": SearchRadiusKm * 0.65,
            "max_distance_km": SearchRadiusKm,
            "neighbor_min_aqi": Estimates * 0.90,
            "neighbor_mean_aqi": Estimates,
            "neighbor_max_aqi": Estimates * 1.10,
            "neighbor_std_aqi": Estimates * 0.08,
            "neighbor_spread": Estimates * 0.20,
            "idw_vs_neighbor_mean": np.zeros_like(Estimates),
            "temperature": MeanTemp,
            "humidity": MeanHum,
            "wind_speed": MeanWindSpeed,
            "wind_dir_sin": float(np.sin(WindRad)),
            "wind_dir_cos": float(np.cos(WindRad)),
            "pressure": MeanPressure,
            "stagnation_index": MeanHum / (MeanWindSpeed + 0.5),
            "hour": HourOfDay,
            "hour_sin": float(np.sin(2.0 * np.pi * HourOfDay / 24.0)),
            "hour_cos": float(np.cos(2.0 * np.pi * HourOfDay / 24.0)),
            "is_rush_hour": IsRushHour,
            "is_severe_episode": (Estimates >= 300.0).astype(float),
            "dist_center_km": DistCenterKm,
            "target_lat": FlattenedLatitudes,
            "target_lon": FlattenedLongitudes,
        })

        ValidMask = ~np.isnan(Estimates)
        ResidualCorrections = np.zeros_like(Estimates)

        if UseStageTwo and self.ResidualModel is not None and np.any(ValidMask):
            ResidualCorrections[ValidMask] = self.ResidualModel.predict(GridFeatureDf.loc[ValidMask, STAGE_TWO_FEATURE_NAMES])

        FinalGridAqi = np.clip(Estimates + ResidualCorrections, 0.0, 500.0)

        SurfaceGridDataFrame = pd.DataFrame({
            "latitude": FlattenedLatitudes,
            "longitude": FlattenedLongitudes,
            "estimated_aqi": np.round(FinalGridAqi, 1),
            "stage1_idw_aqi": np.round(Estimates, 1),
            "residual_correction": np.round(ResidualCorrections, 2),
            "confidence_score": np.round(BaseConfidences, 3),
            "valid_neighbors": NeighborCounts,
            "model_stage": "Stage 2 (IDW + XGBoost)" if (UseStageTwo and self.ResidualModel is not None) else "Stage 1 (IDW Baseline)",
        })
        SurfaceGridDataFrame["aqi_category"] = SurfaceGridDataFrame["estimated_aqi"].apply(GetAqiCategory)
        return SurfaceGridDataFrame

    def ExportGridToGeoJson(
        self,
        SurfaceGridDataFrame: pd.DataFrame,
        OutputFile: Optional[Union[str, Path]] = None,
    ) -> Dict[str, Any]:
        """
        Convert Continuous Grid Surface DataFrame Into Standard GeoJSON FeatureCollection
        For Direct Display On Web Map Layers And AirRoute Navigation Route Engines.
        """
        GeoJsonFeatures: List[Dict[str, Any]] = []

        for _, GridRow in SurfaceGridDataFrame.iterrows():
            if np.isnan(GridRow["estimated_aqi"]):
                continue

            FeatureEntry = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(GridRow["longitude"]), float(GridRow["latitude"])],
                },
                "properties": {
                    "aqi": float(GridRow["estimated_aqi"]),
                    "category": str(GridRow["aqi_category"]),
                    "confidence": float(GridRow["confidence_score"]),
                    "stage1_idw": float(GridRow["stage1_idw_aqi"]),
                    "residual": float(GridRow["residual_correction"]),
                    "model_stage": str(GridRow["model_stage"]),
                },
            }
            GeoJsonFeatures.append(FeatureEntry)

        FeatureCollectionDict: Dict[str, Any] = {
            "type": "FeatureCollection",
            "features": GeoJsonFeatures,
        }

        if OutputFile:
            OutputFilePath = Path(OutputFile)
            OutputFilePath.parent.mkdir(parents=True, exist_ok=True)
            with open(OutputFilePath, "w", encoding="utf-8") as JsonOut:
                json.dump(FeatureCollectionDict, JsonOut, indent=2)
            print(f"[GeoJSON] Successfully Exported {len(GeoJsonFeatures)} Grid Features To {OutputFilePath}")

        return FeatureCollectionDict

    # Backward Compatibility Aliases
    predict_point = PredictPoint
    predict_grid = PredictGrid
    export_grid_to_geojson = ExportGridToGeoJson


# Backward Compatibility Type Alias
SpatialAQIPredictor = SpatialAqiPredictor
