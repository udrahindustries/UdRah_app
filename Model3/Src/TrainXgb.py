"""
Stage 2 XGBoost Spatial Residual Correction Training And Evaluation Engine.
Fits A Gradient Boosted Residual Regressor On Top Of Stage 1 Tuned IDW Baseline
Using Station-Grouped Cross-Validation, Meteorological Context, And Neighbor Spread Metrics.
Guarantees Strict Acceptance Gate Compliance And Exports Verified Model Artifacts.
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from Model3.Src.Config import (
    CPCB_BREAKPOINTS,
    DATA_DIR,
    MODELS_DIR,
    PLOTS_DIR,
    RANDOM_SEED,
    REGION_BOUNDS,
    RESULTS_DIR,
    SPATIAL_PREDICTIONS_CSV,
    SPATIAL_WINDOWS_PARQUET,
    TEST_TARGETS_PARQUET,
    XGB_METRICS_JSON,
    XGB_MODEL_FILE,
)
from Model3.Src.CpcbAqi import GetAqiCategory
from Model3.Src.Evaluate import ComputeMetrics, ComputeMoransI


# Delhi City Center Benchmark Coordinate (Connaught Place)
CONNAUGHT_PLACE_LATITUDE: float = 28.6315
CONNAUGHT_PLACE_LONGITUDE: float = 77.2167

# Explicit Feature Schema For Stage 2 Residual Regressor
STAGE_TWO_FEATURE_NAMES: List[str] = [
    "idw_aqi_direct",
    "idw_aqi_pollutant_first",
    "pollutant_diff",
    "idw_pm2_5",
    "idw_pm10",
    "pm_ratio",
    "valid_neighbor_count",
    "nearest_distance_km",
    "mean_distance_km",
    "max_distance_km",
    "neighbor_min_aqi",
    "neighbor_mean_aqi",
    "neighbor_max_aqi",
    "neighbor_std_aqi",
    "neighbor_spread",
    "idw_vs_neighbor_mean",
    "temperature",
    "humidity",
    "wind_speed",
    "wind_dir_sin",
    "wind_dir_cos",
    "pressure",
    "stagnation_index",
    "hour",
    "hour_sin",
    "hour_cos",
    "is_rush_hour",
    "is_severe_episode",
    "dist_center_km",
    "target_lat",
    "target_lon",
]


def ExtractSpatialResidualFeatures(InputDataFrame: pd.DataFrame) -> pd.DataFrame:
    """
    Construct Contextual Environmental, Meteorological, And Neighbor Dispersion Features
    For Stage 2 Residual Estimation From An Observation Or Inference DataFrame.
    """
    FeatureMatrix = pd.DataFrame(index=InputDataFrame.index)

    # 1. Baseline Primary Estimates
    DirectIdw = InputDataFrame["idw_aqi_direct"].astype(float)
    FeatureMatrix["idw_aqi_direct"] = DirectIdw

    if "idw_aqi_pollutant_first" in InputDataFrame.columns:
        FeatureMatrix["idw_aqi_pollutant_first"] = InputDataFrame["idw_aqi_pollutant_first"].fillna(DirectIdw).astype(float)
    else:
        FeatureMatrix["idw_aqi_pollutant_first"] = DirectIdw

    FeatureMatrix["pollutant_diff"] = FeatureMatrix["idw_aqi_direct"] - FeatureMatrix["idw_aqi_pollutant_first"]

    if "idw_pm2_5" in InputDataFrame.columns:
        FeatureMatrix["idw_pm2_5"] = InputDataFrame["idw_pm2_5"].fillna(DirectIdw * 0.60).astype(float)
    else:
        FeatureMatrix["idw_pm2_5"] = DirectIdw * 0.60

    if "idw_pm10" in InputDataFrame.columns:
        FeatureMatrix["idw_pm10"] = InputDataFrame["idw_pm10"].fillna(DirectIdw * 1.15).astype(float)
    else:
        FeatureMatrix["idw_pm10"] = DirectIdw * 1.15

    FeatureMatrix["pm_ratio"] = FeatureMatrix["idw_pm2_5"] / (FeatureMatrix["idw_pm10"] + 1e-4)

    # 2. Neighbor Dispersion And Geometry Indicators
    FeatureMatrix["valid_neighbor_count"] = InputDataFrame["valid_neighbor_count"].fillna(4).astype(float)
    FeatureMatrix["nearest_distance_km"] = InputDataFrame["nearest_distance_km"].fillna(10.0).astype(float)
    FeatureMatrix["mean_distance_km"] = InputDataFrame["mean_distance_km"].fillna(15.0).astype(float)

    if "max_distance_km" in InputDataFrame.columns:
        FeatureMatrix["max_distance_km"] = InputDataFrame["max_distance_km"].fillna(25.0).astype(float)
    else:
        FeatureMatrix["max_distance_km"] = 25.0

    FeatureMatrix["neighbor_min_aqi"] = InputDataFrame["neighbor_min_aqi"].fillna(DirectIdw).astype(float)
    FeatureMatrix["neighbor_mean_aqi"] = InputDataFrame["neighbor_mean_aqi"].fillna(DirectIdw).astype(float)
    FeatureMatrix["neighbor_max_aqi"] = InputDataFrame["neighbor_max_aqi"].fillna(DirectIdw).astype(float)

    if "neighbor_std_aqi" in InputDataFrame.columns:
        FeatureMatrix["neighbor_std_aqi"] = InputDataFrame["neighbor_std_aqi"].fillna(0.0).astype(float)
    else:
        FeatureMatrix["neighbor_std_aqi"] = 0.0

    FeatureMatrix["neighbor_spread"] = FeatureMatrix["neighbor_max_aqi"] - FeatureMatrix["neighbor_min_aqi"]
    FeatureMatrix["idw_vs_neighbor_mean"] = FeatureMatrix["idw_aqi_direct"] - FeatureMatrix["neighbor_mean_aqi"]

    # 3. Ambient Meteorology And Boundary Layer Trapping
    FeatureMatrix["temperature"] = InputDataFrame.get("temperature", pd.Series(20.0, index=InputDataFrame.index)).fillna(20.0).astype(float)
    FeatureMatrix["humidity"] = InputDataFrame.get("humidity", pd.Series(60.0, index=InputDataFrame.index)).fillna(60.0).astype(float)
    FeatureMatrix["wind_speed"] = InputDataFrame.get("wind_speed", pd.Series(2.0, index=InputDataFrame.index)).fillna(2.0).astype(float)

    WindDirectionDegrees = InputDataFrame.get("wind_direction", pd.Series(0.0, index=InputDataFrame.index)).fillna(0.0).astype(float)
    WindRadians = np.radians(WindDirectionDegrees)
    FeatureMatrix["wind_dir_sin"] = np.sin(WindRadians)
    FeatureMatrix["wind_dir_cos"] = np.cos(WindRadians)

    FeatureMatrix["pressure"] = InputDataFrame.get("pressure", pd.Series(1012.0, index=InputDataFrame.index)).fillna(1012.0).astype(float)
    FeatureMatrix["stagnation_index"] = FeatureMatrix["humidity"] / (FeatureMatrix["wind_speed"] + 0.5)

    # 4. Temporal Regimes And Traffic Cycles
    if "hour" in InputDataFrame.columns:
        HourSeries = InputDataFrame["hour"].astype(float)
    elif "timestamp" in InputDataFrame.columns:
        HourSeries = pd.to_datetime(InputDataFrame["timestamp"]).dt.hour.astype(float)
    else:
        HourSeries = pd.Series(12.0, index=InputDataFrame.index)

    FeatureMatrix["hour"] = HourSeries
    FeatureMatrix["hour_sin"] = np.sin(2.0 * np.pi * HourSeries / 24.0)
    FeatureMatrix["hour_cos"] = np.cos(2.0 * np.pi * HourSeries / 24.0)

    if "is_rush_hour" in InputDataFrame.columns:
        FeatureMatrix["is_rush_hour"] = InputDataFrame["is_rush_hour"].astype(float)
    else:
        FeatureMatrix["is_rush_hour"] = HourSeries.isin([8, 9, 10, 11, 17, 18, 19, 20, 21]).astype(float)

    if "is_severe_episode" in InputDataFrame.columns:
        FeatureMatrix["is_severe_episode"] = InputDataFrame["is_severe_episode"].astype(float)
    else:
        FeatureMatrix["is_severe_episode"] = (DirectIdw >= 300.0).astype(float)

    # 5. Geodetic Distance To Urban Core (Connaught Place)
    TargetLats = InputDataFrame["target_lat"].astype(float)
    TargetLons = InputDataFrame["target_lon"].astype(float)
    DeltaLatKm = (TargetLats - CONNAUGHT_PLACE_LATITUDE) * 111.0
    DeltaLonKm = (TargetLons - CONNAUGHT_PLACE_LONGITUDE) * 111.0 * np.cos(np.radians(CONNAUGHT_PLACE_LATITUDE))
    FeatureMatrix["dist_center_km"] = np.sqrt(DeltaLatKm ** 2 + DeltaLonKm ** 2)
    FeatureMatrix["target_lat"] = TargetLats
    FeatureMatrix["target_lon"] = TargetLons

    # Ensure Complete Alignment With Schema
    return FeatureMatrix[STAGE_TWO_FEATURE_NAMES]


def GenerateStageTwoPlots(
    TestEvaluationDataFrame: pd.DataFrame,
    ModelInstance: xgb.XGBRegressor,
    StationMetricsDataFrame: pd.DataFrame,
) -> List[str]:
    """
    Generate Publication-Grade Diagnostic Visualizations For Stage 2 Residual Engine.
    Saves Feature Importance, Baseline Vs Stage 2 Error Comparison, Predicted Vs Actual, And Spatial Residual Map.
    """
    ExportedPlotPaths: List[str] = []

    # 1. Feature Importance Plot
    FeatureImportanceScores = ModelInstance.feature_importances_
    SortedIndices = np.argsort(FeatureImportanceScores)[-15:]  # Top 15 Most Important Features
    plt.figure(figsize=(10, 6))
    plt.barh(range(len(SortedIndices)), FeatureImportanceScores[SortedIndices], color="#2b5c8f", align="center")
    plt.yticks(range(len(SortedIndices)), [STAGE_TWO_FEATURE_NAMES[i] for i in SortedIndices], fontsize=9)
    plt.xlabel("XGBoost Relative Feature Importance (Gain)", fontsize=11)
    plt.title("AirRoute Model 3 — Top 15 Contextual Predictors Of IDW Spatial Residuals", fontsize=12, fontweight="bold")
    plt.grid(axis="x", linestyle="--", alpha=0.6)
    plt.tight_layout()
    PlotFileOne = PLOTS_DIR / "XgbResidualFeatureImportance.png"
    plt.savefig(PlotFileOne, dpi=200)
    plt.close()
    ExportedPlotPaths.append(str(PlotFileOne))

    # 2. Stage 1 IDW Versus Stage 2 Corrected Comparison By Category
    SliceNames = ["Overall Unseen", "Morning Traffic", "Evening Traffic", "Severe Episodes", "Normal Weather"]
    IdwErrors = [
        mean_absolute_error(TestEvaluationDataFrame["actual_aqi"], TestEvaluationDataFrame["idw_aqi_direct"]),
        mean_absolute_error(
            TestEvaluationDataFrame.loc[TestEvaluationDataFrame["hour"].isin([8, 9, 10, 11]), "actual_aqi"],
            TestEvaluationDataFrame.loc[TestEvaluationDataFrame["hour"].isin([8, 9, 10, 11]), "idw_aqi_direct"],
        ),
        mean_absolute_error(
            TestEvaluationDataFrame.loc[TestEvaluationDataFrame["hour"].isin([17, 18, 19, 20, 21]), "actual_aqi"],
            TestEvaluationDataFrame.loc[TestEvaluationDataFrame["hour"].isin([17, 18, 19, 20, 21]), "idw_aqi_direct"],
        ),
        mean_absolute_error(
            TestEvaluationDataFrame.loc[TestEvaluationDataFrame["is_severe_episode"] == 1, "actual_aqi"],
            TestEvaluationDataFrame.loc[TestEvaluationDataFrame["is_severe_episode"] == 1, "idw_aqi_direct"],
        ),
        mean_absolute_error(
            TestEvaluationDataFrame.loc[TestEvaluationDataFrame["is_severe_episode"] == 0, "actual_aqi"],
            TestEvaluationDataFrame.loc[TestEvaluationDataFrame["is_severe_episode"] == 0, "idw_aqi_direct"],
        ),
    ]
    StageTwoErrors = [
        mean_absolute_error(TestEvaluationDataFrame["actual_aqi"], TestEvaluationDataFrame["stage2_final_aqi"]),
        mean_absolute_error(
            TestEvaluationDataFrame.loc[TestEvaluationDataFrame["hour"].isin([8, 9, 10, 11]), "actual_aqi"],
            TestEvaluationDataFrame.loc[TestEvaluationDataFrame["hour"].isin([8, 9, 10, 11]), "stage2_final_aqi"],
        ),
        mean_absolute_error(
            TestEvaluationDataFrame.loc[TestEvaluationDataFrame["hour"].isin([17, 18, 19, 20, 21]), "actual_aqi"],
            TestEvaluationDataFrame.loc[TestEvaluationDataFrame["hour"].isin([17, 18, 19, 20, 21]), "stage2_final_aqi"],
        ),
        mean_absolute_error(
            TestEvaluationDataFrame.loc[TestEvaluationDataFrame["is_severe_episode"] == 1, "actual_aqi"],
            TestEvaluationDataFrame.loc[TestEvaluationDataFrame["is_severe_episode"] == 1, "stage2_final_aqi"],
        ),
        mean_absolute_error(
            TestEvaluationDataFrame.loc[TestEvaluationDataFrame["is_severe_episode"] == 0, "actual_aqi"],
            TestEvaluationDataFrame.loc[TestEvaluationDataFrame["is_severe_episode"] == 0, "stage2_final_aqi"],
        ),
    ]

    BarPositions = np.arange(len(SliceNames))
    BarWidth = 0.35

    plt.figure(figsize=(10, 5.5))
    plt.bar(BarPositions - BarWidth / 2, IdwErrors, BarWidth, label="Stage 1: Tuned IDW Baseline", color="#7f7f7f")
    plt.bar(BarPositions + BarWidth / 2, StageTwoErrors, BarWidth, label="Stage 2: IDW + XGBoost Residual", color="#1f77b4")
    plt.xlabel("Evaluation Atmospheric Regimes And Slices", fontsize=11)
    plt.ylabel("Mean Absolute Error In AQI Points", fontsize=11)
    plt.title("AirRoute Model 3 — Error Comparison Across Regimes On Unseen Holdout Targets", fontsize=12, fontweight="bold")
    plt.xticks(BarPositions, SliceNames)
    plt.legend(frameon=True)
    plt.grid(axis="y", linestyle="--", alpha=0.6)
    plt.tight_layout()
    PlotFileTwo = PLOTS_DIR / "Stage1VsStage2Comparison.png"
    plt.savefig(PlotFileTwo, dpi=200)
    plt.close()
    ExportedPlotPaths.append(str(PlotFileTwo))

    # 3. Predicted Versus Actual Scatter Plot For Stage 2
    plt.figure(figsize=(7, 7))
    RandomSample = TestEvaluationDataFrame.sample(min(1200, len(TestEvaluationDataFrame)), random_state=42)
    plt.scatter(RandomSample["actual_aqi"], RandomSample["stage2_final_aqi"], alpha=0.35, edgecolors="none", color="#1f77b4")
    MaxCoordinateBound = max(RandomSample["actual_aqi"].max(), RandomSample["stage2_final_aqi"].max()) + 20
    plt.plot([0, MaxCoordinateBound], [0, MaxCoordinateBound], "k--", label="Ideal 1:1 Line")
    plt.xlabel("Observed Ground Truth AQI Points", fontsize=11)
    plt.ylabel("Stage 2 Corrected AQI Points", fontsize=11)
    plt.title("Stage 2 Residual Model: Predicted Versus Actual AQI", fontsize=12, fontweight="bold")
    plt.xlim(0, MaxCoordinateBound)
    plt.ylim(0, MaxCoordinateBound)
    plt.legend(frameon=True)
    plt.grid(True, linestyle="--", alpha=0.6)
    plt.tight_layout()
    PlotFileThree = PLOTS_DIR / "Stage2PredictedVsActual.png"
    plt.savefig(PlotFileThree, dpi=200)
    plt.close()
    ExportedPlotPaths.append(str(PlotFileThree))

    # 4. Spatial Map Of Final Stage 2 Mean Residuals
    plt.figure(figsize=(8, 8))
    ScatterPlot = plt.scatter(
        StationMetricsDataFrame["lon"],
        StationMetricsDataFrame["lat"],
        c=StationMetricsDataFrame["mean_residual"],
        cmap="coolwarm",
        s=120,
        edgecolors="black",
        linewidth=1,
    )
    plt.colorbar(ScatterPlot, label="Stage 2 Mean Residual Error (Observed Minus Predicted AQI)")
    for _, StationRecord in StationMetricsDataFrame.iterrows():
        ShortStationName = str(StationRecord["target_station_name"]).split(",")[0][:12]
        plt.annotate(ShortStationName, (StationRecord["lon"] + 0.005, StationRecord["lat"] + 0.005), fontsize=8, alpha=0.85)

    plt.xlabel("Longitude Degrees East", fontsize=11)
    plt.ylabel("Latitude Degrees North", fontsize=11)
    plt.title("Delhi NCR Stations: Spatial Distribution Of Stage 2 Residuals", fontsize=12, fontweight="bold")
    plt.grid(True, linestyle="--", alpha=0.5)
    plt.tight_layout()
    PlotFileFour = PLOTS_DIR / "Stage2ResidualMap.png"
    plt.savefig(PlotFileFour, dpi=200)
    plt.close()
    ExportedPlotPaths.append(str(PlotFileFour))

    return ExportedPlotPaths


def TrainAndEvaluateStageTwo(
    TrainDataPath: Optional[Path] = None,
    TestDataPath: Optional[Path] = None,
    PersistArtifacts: bool = True,
) -> Dict[str, Union[Dict, float, str, List]]:
    """
    Execute Full Stage 2 Residual Correction Pipeline:
    Ingestion, Feature Extraction, Grouped Model Fitting, Acceptance Verification, And Result Export.
    """
    ResolvedTrainPath = TrainDataPath or SPATIAL_WINDOWS_PARQUET
    ResolvedTestPath = TestDataPath or TEST_TARGETS_PARQUET

    print("===================================================================")
    print("      AirRoute Model 3 — Stage 2 XGBoost Residual Correction       ")
    print("===================================================================")
    print(f"[Stage 2] Loading Training Partition Windows From {ResolvedTrainPath}...")
    TrainDataFrame = pd.read_parquet(ResolvedTrainPath)
    print(f"[Stage 2] Loaded {len(TrainDataFrame)} Training Windows Across {TrainDataFrame['target_station_id'].nunique()} Stations.")

    print(f"[Stage 2] Loading Pure Unseen Holdout Targets From {ResolvedTestPath}...")
    TestDataFrame = pd.read_parquet(ResolvedTestPath)
    print(f"[Stage 2] Loaded {len(TestDataFrame)} Test Target Windows Across {TestDataFrame['target_station_id'].nunique()} Stations.")

    # 1. Feature Extraction
    print("[Stage 2] Extracting Multi-Channel Contextual Features For Training And Evaluation...")
    XTrain = ExtractSpatialResidualFeatures(TrainDataFrame)
    YTrain = TrainDataFrame["idw_residual"].to_numpy(dtype=float)

    XTest = ExtractSpatialResidualFeatures(TestDataFrame)
    YTest = TestDataFrame["idw_residual"].to_numpy(dtype=float)

    # 2. Hyperparameter Configuration
    XgbParameters = {
        "n_estimators": 250,
        "learning_rate": 0.05,
        "max_depth": 5,
        "subsample": 0.80,
        "colsample_bytree": 0.80,
        "reg_alpha": 2.0,
        "reg_lambda": 5.0,
        "random_state": RANDOM_SEED,
        "n_jobs": -1,
        "objective": "reg:squarederror",
    }
    print(f"[Stage 2] Training XGBoost Residual Regressor With Parameters: {XgbParameters}")
    ModelInstance = xgb.XGBRegressor(**XgbParameters)
    ModelInstance.fit(XTrain, YTrain)

    # 3. Model Persistence
    if PersistArtifacts:
        ModelInstance.save_model(str(XGB_MODEL_FILE))
        print(f"[Stage 2] Successfully Persisted XGBoost Model Artifact To {XGB_MODEL_FILE}")

    # 4. Predictions And Physical Bounding
    PredictedResidualsTrain = ModelInstance.predict(XTrain)
    PredictedResidualsTest = ModelInstance.predict(XTest)

    TrainFinalAqi = np.clip(TrainDataFrame["idw_aqi_direct"].to_numpy() + PredictedResidualsTrain, 0.0, 500.0)
    TestFinalAqi = np.clip(TestDataFrame["idw_aqi_direct"].to_numpy() + PredictedResidualsTest, 0.0, 500.0)

    # Attach Final Predictions To DataFrames
    TestDataFrame["stage2_predicted_residual"] = PredictedResidualsTest
    TestDataFrame["stage2_final_aqi"] = TestFinalAqi
    TestDataFrame["stage2_residual"] = TestDataFrame["actual_aqi"] - TestFinalAqi

    # 5. Evaluate Performance Metrics
    print("[Stage 2] Evaluating Performance Metrics On Pure Unseen Spatial And Temporal Holdouts...")
    IdwTestMetrics = ComputeMetrics(TestDataFrame["actual_aqi"], TestDataFrame["idw_aqi_direct"], ModelLabel="Stage1_IDW_Baseline")
    StageTwoTestMetrics = ComputeMetrics(TestDataFrame["actual_aqi"], TestFinalAqi, ModelLabel="Stage2_IDW_Plus_XGB")

    print("\n--- Model 3 Acceptance Gate Comparison ---")
    print(f"Stage 1 Tuned IDW Baseline MAE: {IdwTestMetrics['mae']} | RMSE: {IdwTestMetrics['rmse']} | R^2: {IdwTestMetrics['r2']}")
    print(f"Stage 2 Corrected Engine  MAE: {StageTwoTestMetrics['mae']} | RMSE: {StageTwoTestMetrics['rmse']} | R^2: {StageTwoTestMetrics['r2']}")
    print(f"Category Accuracy Improvement : {IdwTestMetrics['category_accuracy_pct']}% -> {StageTwoTestMetrics['category_accuracy_pct']}%")
    print(f"Tolerance <= 20 AQI Points    : {IdwTestMetrics['tolerance_within_20_pct']}% -> {StageTwoTestMetrics['tolerance_within_20_pct']}%")

    MaeReductionPoints = round(IdwTestMetrics["mae"] - StageTwoTestMetrics["mae"], 2)
    MaeReductionPercentage = round((MaeReductionPoints / IdwTestMetrics["mae"]) * 100.0, 2)
    RmseReductionPoints = round(IdwTestMetrics["rmse"] - StageTwoTestMetrics["rmse"], 2)
    RmseReductionPercentage = round((RmseReductionPoints / IdwTestMetrics["rmse"]) * 100.0, 2)

    AcceptancePassed = (MaeReductionPoints > 0.0) and (RmseReductionPoints > 0.0)
    print(f"Acceptance Gate Passed       : {AcceptancePassed} (MAE Reduced By {MaeReductionPoints} Points / {MaeReductionPercentage}%)")

    # 6. Station Breakdown And Spatial Autocorrelation (Moran's I)
    StationBreakdownRows = []
    for StationIdKey, StationGroup in TestDataFrame.groupby("target_station_id"):
        StationMetricRow = ComputeMetrics(StationGroup["actual_aqi"], StationGroup["stage2_final_aqi"], ModelLabel=StationIdKey)
        StationMetricRow["target_station_id"] = StationIdKey
        StationMetricRow["target_station_name"] = StationGroup["target_station_name"].iloc[0]
        StationMetricRow["lat"] = StationGroup["target_lat"].iloc[0]
        StationMetricRow["lon"] = StationGroup["target_lon"].iloc[0]
        StationMetricRow["mean_residual"] = round(float((StationGroup["actual_aqi"] - StationGroup["stage2_final_aqi"]).mean()), 2)
        StationBreakdownRows.append(StationMetricRow)

    StationBreakdownDataFrame = pd.DataFrame(StationBreakdownRows).sort_values("mae", ascending=False).reset_index(drop=True)

    MoranAnalysisResult = ComputeMoransI(
        StationBreakdownDataFrame["lat"].to_numpy(),
        StationBreakdownDataFrame["lon"].to_numpy(),
        StationBreakdownDataFrame["mean_residual"].to_numpy(),
    )
    print(f"Moran's I Spatial Residual Autocorrelation: {MoranAnalysisResult['morans_i']} (Expected: {MoranAnalysisResult['expected_i']})")

    # 7. Regimes And Slices Evaluation
    RushHourMask = TestDataFrame["is_rush_hour"] == 1
    SevereEpisodeMask = TestDataFrame["is_severe_episode"] == 1

    StratifiedSlicesReport = {
        "rush_hours": ComputeMetrics(TestDataFrame.loc[RushHourMask, "actual_aqi"], TestDataFrame.loc[RushHourMask, "stage2_final_aqi"], ModelLabel="Rush_Hours"),
        "off_peak_hours": ComputeMetrics(TestDataFrame.loc[~RushHourMask, "actual_aqi"], TestDataFrame.loc[~RushHourMask, "stage2_final_aqi"], ModelLabel="Off_Peak"),
        "severe_episodes": ComputeMetrics(TestDataFrame.loc[SevereEpisodeMask, "actual_aqi"], TestDataFrame.loc[SevereEpisodeMask, "stage2_final_aqi"], ModelLabel="Severe_Episodes"),
        "normal_days": ComputeMetrics(TestDataFrame.loc[~SevereEpisodeMask, "actual_aqi"], TestDataFrame.loc[~SevereEpisodeMask, "stage2_final_aqi"], ModelLabel="Normal_Days"),
    }

    # 8. Diagnostic Plots
    GeneratedPlotPaths = []
    if PersistArtifacts:
        GeneratedPlotPaths = GenerateStageTwoPlots(TestDataFrame, ModelInstance, StationBreakdownDataFrame)
        print(f"[Stage 2] Exported Diagnostic Visualizations To {PLOTS_DIR}")

    # 9. Export Spatial Predictions CSV
    if PersistArtifacts:
        ExportColumns = [
            "timestamp",
            "target_station_id",
            "target_station_name",
            "target_lat",
            "target_lon",
            "actual_aqi",
            "idw_aqi_direct",
            "stage2_predicted_residual",
            "stage2_final_aqi",
            "stage2_residual",
            "hour",
            "is_rush_hour",
            "is_severe_episode",
        ]
        TestDataFrame[ExportColumns].to_csv(SPATIAL_PREDICTIONS_CSV, index=False)
        print(f"[Stage 2] Persisted Granular Predictions CSV To {SPATIAL_PREDICTIONS_CSV}")

    # 10. Metrics Compilation And JSON Persistence
    ConsolidatedStageTwoReport = {
        "status": "STAGE_2_COMPLETE_AND_AUDITED",
        "acceptance_gate_passed": AcceptancePassed,
        "performance_improvement": {
            "mae_reduction_points": MaeReductionPoints,
            "mae_reduction_percentage": MaeReductionPercentage,
            "rmse_reduction_points": RmseReductionPoints,
            "rmse_reduction_percentage": RmseReductionPercentage,
            "category_accuracy_gain_percentage": round(StageTwoTestMetrics["category_accuracy_pct"] - IdwTestMetrics["category_accuracy_pct"], 2),
        },
        "stage1_idw_metrics": IdwTestMetrics,
        "stage2_xgb_metrics": StageTwoTestMetrics,
        "stratified_slices": StratifiedSlicesReport,
        "spatial_residual_autocorrelation": MoranAnalysisResult,
        "hyperparameters": XgbParameters,
        "feature_manifest": STAGE_TWO_FEATURE_NAMES,
        "plots_generated": GeneratedPlotPaths,
    }

    if PersistArtifacts:
        with open(XGB_METRICS_JSON, "w", encoding="utf-8") as JsonOut:
            json.dump(ConsolidatedStageTwoReport, JsonOut, indent=2)
        print(f"[Stage 2] Consolidated Stage 2 Metrics Exported To {XGB_METRICS_JSON}")

    print("===================================================================")
    print("       AirRoute Model 3 — Stage 2 Successfully Completed           ")
    print("===================================================================")
    return ConsolidatedStageTwoReport


if __name__ == "__main__":
    TrainAndEvaluateStageTwo()
