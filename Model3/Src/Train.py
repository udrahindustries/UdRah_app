"""
Training And Tuning Execution Driver For AirRoute Model 3.
Executes Both Stage 1 (IDW Data Pipeline & Baseline Tuning)
And Stage 2 (XGBoost Spatial Residual Correction & Acceptance Gate Verification).
"""

from Model3.Src.TrainXgb import TrainAndEvaluateStageTwo
from Model3.Src.TuneIdw import RunTuningAndEvaluation


def Main():
    print("==============================================================")
    print("       AirRoute Model 3 — Complete End-To-End Pipeline        ")
    print("==============================================================")
    print("\n>>> Executing Stage 1: IDW Data Pipeline And Hyperparameter Tuning...")
    StageOneResults = RunTuningAndEvaluation()
    print("[Pipeline] Stage 1 Execution Completed Successfully.")

    print("\n>>> Executing Stage 2: XGBoost Residual Correction And Verification...")
    StageTwoResults = TrainAndEvaluateStageTwo()
    print("[Pipeline] Stage 2 Execution Completed Successfully.")
    print("==============================================================")
    print("       AirRoute Model 3 Pipeline Fully Ready & Audited         ")
    print("==============================================================")
    return {"stage1": StageOneResults, "stage2": StageTwoResults}


if __name__ == "__main__":
    Main()
