# AirRoute Model 3 — Spatial AQI Estimation Engine

> **Module Architectural Status:** Complete (Stage 1 Spatial Baseline & Stage 2 XGBoost Residual Correction Fully Verified)  
> **Target Geospatial Region:** Delhi National Capital Region (Delhi NCR)  
> **Core Architectural Paradigm:** Two-Stage Spatial Estimator (Stage 1: Vectorized IDW Baseline; Stage 2: XGBoost Contextual Residual Correction)  
> **Development Standard:** Strict Separation From Model 2 With Zero Data Leakage (100% Passing Tests)  

---

## 1. Project Role, Purpose, And Mission

Model 3 Fills The Primary Geospatial Gap In The AirRoute System. Model 2 Provides Forward Predictive Forecasts Strictly For Points Having A Complete 24-Hour Historical Observation Sequence. Consequently, Model 2 Cannot Deliver A City-Wide Continuous Pollution Surface Because Most Urban Grid Points Lack Dedicated Physical Monitoring Stations.

Model 3 Solves This Coverage Gap By Estimating The Air Quality Index (AQI) And Pollutant Concentrations At Arbitrary Unmonitored Coordinates Across Delhi NCR Using Surrounding Physical Monitoring Stations, Ambient Meteorology, Diurnal Regimes, And Dispersion Indicators.

### Core Geospatial Inquiries Addressed
- **Point Estimation:** What Is The Current Estimated Air Quality Index At Any Unmonitored Coordinate Right Now?
- **Gradient Transitions:** What Are The Spatial Pollution Gradients And Transitions Between Physical Monitoring Stations?
- **Corridor Hotspots:** Which Specific Corridors Experience Elevated Pollution Burdens During Rush Hours Due To Heavy Freight And Micro-Climate Inversions?
- **Routing Integration:** How Confident Is The Surface Estimation For Clean-Air Route Planning?

---

## 2. Non-Negotiable Engineering Guardrails

1. **No Overclaiming Of Physics Capabilities:** We Do Not Claim Road-Level Precision, WRF-Chem Chemical Transport Simulations, Or Physics-Based Atmospheric Plume Dispersion. The Model Faithfully Reflects The Empirical Resolution Supported By The Station Network (~1.5 To 5.0 Kilometers).
2. **Strict Spatial Evaluation Isolation:** No Random Row Splitting Is Ever Permitted. All Validation Is Conducted Via Spatially Aware Leave-One-Station-Out (LOSO) Simulation And Dedicated Spatial/Temporal Holdouts. Target Stations Are Mathematically Excluded From Candidate Neighbor Pools.
3. **Temporal Feature Availability:** No Feature Is Utilized That Would Be Unavailable In A Real-Time Production Setting.
4. **Transparent Residual Correction Standard:** The Stage 2 XGBoost Residual Layer Is Accepted Only If It Demonstrates Statistically Significant Error Reduction Compared To The Tuned IDW Baseline On Genuinely Unseen Stations And Future Time Periods.
5. **Physical Value Bounds:** All Interpolated Pollutants And Index Predictions Are Strictly Bounded In The Official Indian CPCB NAQI Range $[0.0, 500.0]$.

---

## 3. Directory Architecture And Codebase Artifacts

```text
Model3/
├── Data/
│   ├── StationHistory.parquet        # Synchronized Historical Observations Across 38 Stations (41,040 Rows)
│   ├── SpatialWindows.parquet        # Leave-One-Station-Out (LOSO) Training Windows (25,053 Rows)
│   └── TestTargets.parquet           # Pure Unseen Spatial And Temporal Holdout Targets (13,824 Rows)
├── Models/
│   └── XgbSpatialResidual.json       # Persisted Stage 2 XGBoost Model Artifact
├── Src/
│   ├── __init__.py                   # Package Root Initializer
│   ├── Config.py                     # Central System Hyperparameters, Seeds, And Breakpoints
│   ├── CpcbAqi.py                    # Official Indian CPCB Sub-Index And NAQI Engine
│   ├── SpatialFeatures.py            # Great-Circle Haversine Geodesic Distance And Bearing
│   ├── Idw.py                        # Vectorized IDW Interpolator With Diagnostic Metadata
│   ├── Dataset.py                    # Data Ingestion, QC Filter, And Holdout Generator
│   ├── Evaluate.py                   # Geospatial Evaluation Suite And Moran's I Calculator
│   ├── TuneIdw.py                    # Cross-Validation Hyperparameter Optimization Runner
│   ├── TrainXgb.py                   # Stage 2 XGBoost Residual Training And Acceptance Gate Runner
│   ├── Train.py                      # Master Execution Pipeline Driver (Stage 1 + Stage 2)
│   └── Predict.py                    # High-Level Point, 2D Grid, And GeoJSON Inference API
├── Results/
│   ├── IdwMetrics.json               # Consolidated Stage 1 Numerical Baseline Metrics
│   ├── XgbMetrics.json               # Complete Stage 2 Residual Metrics And Acceptance Audit
│   ├── PerStationBreakdown.csv       # Station-By-Station Error Metrics Table
│   ├── SpatialPredictions.csv        # Test Target Granular Holdout Predictions
│   └── Plots/
│       ├── ErrorByStation.png        # Mean Absolute Error Per Station Bar Chart
│       ├── ErrorByHour.png           # Diurnal Hourly Estimation Error Profile
│       ├── PredictedVsActual.png     # 1:1 Correlation Scatter Plot (Stage 1 IDW)
│       ├── StationResidualMap.png    # Spatial Map Of Stage 1 Residual Clusters
│       ├── XgbResidualFeatureImportance.png # Top Contextual Feature Gains
│       ├── Stage1VsStage2Comparison.png     # Error Comparison Across Atmospheric Regimes
│       ├── Stage2PredictedVsActual.png      # 1:1 Correlation Scatter Plot (Stage 2 Model)
│       └── Stage2ResidualMap.png            # Spatial Map Of Final Stage 2 Residuals
├── Tests/
│   ├── TestDistance.py               # Unit Tests For Geodetic Haversine Formulas
│   ├── TestCpcbAqi.py                # Unit Tests For Official CPCB Breakpoint Calculations
│   ├── TestIdw.py                    # Unit Tests For Edge Cases, Co-Location, And NaNs
│   ├── TestLeakage.py                # Programmatic Proof Of Zero Leakage In LOSO Evaluation
│   ├── TestXgbResidual.py            # Unit Tests For Stage 2 Residual Model And Bounding
│   └── TestConfidence.py             # Unit Tests For Geometric Confidence Scoring
├── Readme.md                         # Detailed Architectural Documentation In Title Case
├── ProgressReport.md                 # Complete Milestone Audit Document
└── Stage2CompletionReport.md         # Final Stage 2 Acceptance Gate Verification Audit
```

---

## 4. Acceptance Gate Verification Results

Evaluation Conducted On Pure Unseen Spatial Holdout Stations And Future Temporal Holdout Targets ($N = 13,824$ Observations):

| Metric Criterion | Stage 1: Tuned IDW Baseline | Stage 2: IDW + XGBoost Residual | Absolute Delta | Relative Gain | Acceptance Standard |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Mean Absolute Error (MAE)** | 27.63 | **23.47** | **-4.16 Points** | **15.06% Error Reduction** | **PASSED** (Lower Error) |
| **Root Mean Squared Error (RMSE)**| 39.57 | **33.29** | **-6.28 Points** | **15.87% Error Reduction** | **PASSED** (Lower Error) |
| **Coefficient Of Determination ($R^2$)** | 0.8551 | **0.8975** | **+0.0424** | **+4.96% Explained Variance** | **PASSED** |
| **CPCB Category Accuracy** | 78.65% | **83.07%** | **+4.42%** | **Statistically Significant** | **PASSED** |
| **Tolerance Accuracy ($\le \pm 10$ AQI)** | 28.64% | **33.86%** | **+5.22%** | **+18.23% Relative Improvement** | **PASSED** |
| **Tolerance Accuracy ($\le \pm 20$ AQI)** | 50.46% | **57.33%** | **+6.87%** | **+13.61% Relative Improvement** | **PASSED** |
| **Tolerance Accuracy ($\le \pm 30$ AQI)** | 65.65% | **73.54%** | **+7.89%** | **+12.02% Relative Improvement** | **PASSED** |

---

## 5. Quick Start Execution

### Run All Unit Tests (26 Tests Passing)
```bash
python -m pytest
```

### Run End-To-End Pipeline
```bash
python -m Model3.Src.Train
```
