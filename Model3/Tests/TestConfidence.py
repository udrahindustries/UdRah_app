"""
Unit Tests For Multi-Factor Geometric Confidence And Coverage Scoring.
Validates Bounding In [0.0, 1.0], Distance Decay Monotonicity,
Station Density Scaling, And Error Status Handling.
"""

import numpy as np
import pytest

from Model3.Src.Predict import SpatialAqiPredictor


@pytest.fixture
def PredictorInstance():
    return SpatialAqiPredictor()


def test_confidence_bounds(PredictorInstance):
    """Verify That Confidence Scores Are Strictly Bounded In [0.0, 1.0]."""
    for DistKm in [0.5, 5.0, 15.0, 24.9, 35.0]:
        for Neighbors in [1, 4, 8, 12]:
            Score = PredictorInstance.ComputeGeometricConfidence(
                Status="OK",
                NearestDistanceKm=DistKm,
                SearchRadiusKm=25.0,
                ValidNeighborCount=Neighbors,
                KNearest=8,
                NeighborStd=15.0,
                ResidualMagnitude=10.0,
            )
            assert 0.0 <= Score <= 1.0, f"Confidence Score ({Score}) Outside Valid Interval [0, 1]"


def test_exact_match_confidence(PredictorInstance):
    """Verify That A Physical Station Co-Location Yields Exactly 1.0 Confidence."""
    ExactScore = PredictorInstance.ComputeGeometricConfidence(
        Status="EXACT_MATCH",
        NearestDistanceKm=0.0,
        SearchRadiusKm=25.0,
        ValidNeighborCount=8,
        KNearest=8,
    )
    assert ExactScore == 1.0, f"Exact Match Score Must Be 1.0, Got {ExactScore}"


def test_invalid_status_confidence(PredictorInstance):
    """Verify That Insufficient Coverage Or Errors Yield Exactly 0.0 Confidence."""
    ZeroScore = PredictorInstance.ComputeGeometricConfidence(
        Status="INSUFFICIENT_COVERAGE",
        NearestDistanceKm=np.nan,
        SearchRadiusKm=25.0,
        ValidNeighborCount=1,
        KNearest=8,
    )
    assert ZeroScore == 0.0, f"Insufficient Coverage Score Must Be 0.0, Got {ZeroScore}"


def test_distance_decay_monotonicity(PredictorInstance):
    """Verify That Confidence Decreases Monotonically As Distance Increases."""
    Distances = [1.0, 5.0, 10.0, 18.0, 24.0]
    Scores = [
        PredictorInstance.ComputeGeometricConfidence(
            Status="OK",
            NearestDistanceKm=D,
            SearchRadiusKm=25.0,
            ValidNeighborCount=8,
            KNearest=8,
            NeighborStd=10.0,
        )
        for D in Distances
    ]

    for i in range(len(Scores) - 1):
        assert Scores[i] >= Scores[i + 1], (
            f"Non-Monotonic Distance Decay: Score At {Distances[i]}km ({Scores[i]}) "
            f"Should Be >= Score At {Distances[i+1]}km ({Scores[i+1]})"
        )


def test_density_scaling(PredictorInstance):
    """Verify That Higher Neighbor Counts Increase Confidence."""
    LowDensityScore = PredictorInstance.ComputeGeometricConfidence(
        Status="OK",
        NearestDistanceKm=5.0,
        SearchRadiusKm=25.0,
        ValidNeighborCount=2,
        KNearest=8,
    )
    HighDensityScore = PredictorInstance.ComputeGeometricConfidence(
        Status="OK",
        NearestDistanceKm=5.0,
        SearchRadiusKm=25.0,
        ValidNeighborCount=8,
        KNearest=8,
    )
    assert HighDensityScore > LowDensityScore, (
        f"Higher Density Score ({HighDensityScore}) Must Exceed Low Density Score ({LowDensityScore})"
    )


def test_dispersion_penalty(PredictorInstance):
    """Verify That High Neighbor Disagreement Penalizes Confidence."""
    ConsensusScore = PredictorInstance.ComputeGeometricConfidence(
        Status="OK",
        NearestDistanceKm=5.0,
        SearchRadiusKm=25.0,
        ValidNeighborCount=8,
        KNearest=8,
        NeighborStd=5.0,
    )
    HighVarianceScore = PredictorInstance.ComputeGeometricConfidence(
        Status="OK",
        NearestDistanceKm=5.0,
        SearchRadiusKm=25.0,
        ValidNeighborCount=8,
        KNearest=8,
        NeighborStd=80.0,
    )
    assert ConsensusScore > HighVarianceScore, (
        f"Consensus Score ({ConsensusScore}) Must Exceed High Variance Score ({HighVarianceScore})"
    )
