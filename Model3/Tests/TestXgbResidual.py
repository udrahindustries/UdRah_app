"""
Comprehensive Unit Test Suite For Stage 2 XGBoost Spatial Residual Correction.
Tests Artifact Loading, Feature Extraction Consistency, Acceptance Gate Metrics,
Inference Service Integration, And Physical AQI Bounding.
"""

from pathlib import Path
import numpy as np
import pandas as pd
import pytest
import xgboost as xgb

from Model3.Src.Config import (
    SPATIAL_WINDOWS_PARQUET,
    TEST_TARGETS_PARQUET,
    XGB_METRICS_JSON,
    XGB_MODEL_FILE,
)
from Model3.Src.Predict import SpatialAqiPredictor
from Model3.Src.TrainXgb import (
    STAGE_TWO_FEATURE_NAMES,
    ExtractSpatialResidualFeatures,
)


def test_xgb_model_artifact_exists_and_loads():
    """Verify That XGBoost Model Artifact Is Saved And Loads Without Error."""
    assert XGB_MODEL_FILE.exists(), f"XGBoost Model File Not Found At {XGB_MODEL_FILE}"

    LoadedModel = xgb.XGBRegressor()
    LoadedModel.load_model(str(XGB_MODEL_FILE))
    assert LoadedModel is not None, "Failed To Instantiate XGBRegressor From Persisted Artifact"

    # Dummy Inference Vector Verification
    DummyVector = pd.DataFrame([np.zeros(len(STAGE_TWO_FEATURE_NAMES))], columns=STAGE_TWO_FEATURE_NAMES)
    PredictionResult = LoadedModel.predict(DummyVector)
    assert len(PredictionResult) == 1, "Model Must Return Single Scalar Prediction For Single Vector"
    assert not np.isnan(PredictionResult[0]), "Model Prediction Must Be A Valid Float, Not NaN"


def test_feature_extraction_schema_and_types():
    """Verify That Feature Extraction Produces Correct Columns With No Missing Values."""
    assert SPATIAL_WINDOWS_PARQUET.exists(), "Spatial Windows Parquet Dataset Must Exist"
    SampleTrainData = pd.read_parquet(SPATIAL_WINDOWS_PARQUET).head(50)

    ExtractedFeatures = ExtractSpatialResidualFeatures(SampleTrainData)

    # 1. Column Identity And Ordering
    assert list(ExtractedFeatures.columns) == STAGE_TWO_FEATURE_NAMES, (
        f"Feature Names Discrepancy:\nExpected: {STAGE_TWO_FEATURE_NAMES}\nActual: {list(ExtractedFeatures.columns)}"
    )

    # 2. Absence Of Null Or Infinite Values
    assert not ExtractedFeatures.isna().any().any(), "Feature Matrix Must Not Contain Any NaN Values"
    assert not np.isinf(ExtractedFeatures.to_numpy()).any(), "Feature Matrix Must Not Contain Infinite Values"


def test_stage_two_improves_on_unseen_holdout():
    """Verify Acceptance Gate: Stage 2 Achieves Lower Error Than Baseline IDW On Test Targets."""
    assert TEST_TARGETS_PARQUET.exists(), "Test Targets Parquet File Must Exist"
    TestDataFrame = pd.read_parquet(TEST_TARGETS_PARQUET)

    FeaturesTest = ExtractSpatialResidualFeatures(TestDataFrame)

    ModelInstance = xgb.XGBRegressor()
    ModelInstance.load_model(str(XGB_MODEL_FILE))

    PredictedResiduals = ModelInstance.predict(FeaturesTest)
    FinalCorrectedAqi = np.clip(TestDataFrame["idw_aqi_direct"].to_numpy() + PredictedResiduals, 0.0, 500.0)

    GroundTruth = TestDataFrame["actual_aqi"].to_numpy()
    IdwBaseline = TestDataFrame["idw_aqi_direct"].to_numpy()

    IdwMae = float(np.mean(np.abs(GroundTruth - IdwBaseline)))
    StageTwoMae = float(np.mean(np.abs(GroundTruth - FinalCorrectedAqi)))

    IdwRmse = float(np.sqrt(np.mean((GroundTruth - IdwBaseline) ** 2)))
    StageTwoRmse = float(np.sqrt(np.mean((GroundTruth - FinalCorrectedAqi) ** 2)))

    # Acceptance Gate Assertion: Statistically Significant Error Reduction
    assert StageTwoMae < IdwMae, f"Stage 2 MAE ({StageTwoMae:.2f}) Must Be Lower Than IDW MAE ({IdwMae:.2f})"
    assert StageTwoRmse < IdwRmse, f"Stage 2 RMSE ({StageTwoRmse:.2f}) Must Be Lower Than IDW RMSE ({IdwRmse:.2f})"
    assert (IdwMae - StageTwoMae) >= 3.0, f"Stage 2 Must Yield Meaningful Improvement (>= 3 AQI Points), Got {IdwMae - StageTwoMae:.2f}"


def test_physical_clipping_bounds():
    """Verify That Predictions Are Strictly Bounded In The Official Indian AQI Range [0, 500]."""
    PredictorService = SpatialAqiPredictor()

    # Query Multiple Delhi NCR Coordinates
    TestCoordinates = [
        (28.6139, 77.2090),  # India Gate
        (28.6476, 77.3158),  # Anand Vihar
        (28.5562, 77.0999),  # IGI Airport
        (28.7041, 77.1025),  # Rohini
    ]

    for LatVal, LonVal in TestCoordinates:
        ResultDict = PredictorService.PredictPoint(LatVal, LonVal, UseStageTwo=True)
        EstimatedAqi = ResultDict["estimated_aqi"]
        assert EstimatedAqi is not None
        assert 0.0 <= EstimatedAqi <= 500.0, f"Predicted AQI ({EstimatedAqi}) Outside Physical Limits [0, 500]"
        assert ResultDict["confidence_score"] >= 0.0
        assert ResultDict["confidence_score"] <= 1.0


def test_predictor_point_query_integration():
    """Verify SpatialAqiPredictor Executes Both Stage 1 And Stage 2 Cleanly."""
    PredictorService = SpatialAqiPredictor()

    # Query Connaught Place
    CpLat, CpLon = 28.6315, 77.2167

    # Stage 2 Inference
    StageTwoResult = PredictorService.PredictPoint(CpLat, CpLon, UseStageTwo=True)
    assert StageTwoResult["model_architecture_stage"] == "Stage 2 — XGBoost Residual Corrected"
    assert "stage1_idw_aqi" in StageTwoResult
    assert "residual_correction" in StageTwoResult
    assert "confidence_score" in StageTwoResult
    assert "aqi_category" in StageTwoResult

    # Stage 1 Inference Fallback
    StageOneResult = PredictorService.PredictPoint(CpLat, CpLon, UseStageTwo=False)
    assert StageOneResult["model_architecture_stage"] == "Stage 1 — Tuned IDW Baseline"
    assert StageOneResult["residual_correction"] == 0.0
    assert StageOneResult["estimated_aqi"] == StageOneResult["stage1_idw_aqi"]


def test_predictor_grid_and_geojson_export(tmp_path):
    """Verify PredictGrid Surface Generation And GeoJSON Export Format."""
    PredictorService = SpatialAqiPredictor()

    # Coarse Grid For Fast Testing
    GridDf = PredictorService.PredictGrid(LatitudeStep=0.10, LongitudeStep=0.10, UseStageTwo=True)
    assert len(GridDf) > 0, "Grid Surface Must Contain Grid Points"
    assert "estimated_aqi" in GridDf.columns
    assert "stage1_idw_aqi" in GridDf.columns
    assert "residual_correction" in GridDf.columns
    assert "confidence_score" in GridDf.columns
    assert "aqi_category" in GridDf.columns

    # Test GeoJSON Export
    ExportFile = tmp_path / "DelhiSurfaceGrid.geojson"
    GeoJsonDict = PredictorService.ExportGridToGeoJson(GridDf, OutputFile=ExportFile)

    assert ExportFile.exists(), "GeoJSON File Must Be Written To Disk"
    assert GeoJsonDict["type"] == "FeatureCollection"
    ValidPointCount = int(GridDf["estimated_aqi"].notna().sum())
    assert len(GeoJsonDict["features"]) == ValidPointCount
    FirstFeature = GeoJsonDict["features"][0]
    assert FirstFeature["geometry"]["type"] == "Point"
    assert "aqi" in FirstFeature["properties"]
    assert "confidence" in FirstFeature["properties"]
